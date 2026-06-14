
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles_select_self_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  item_name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  model_number TEXT,
  barcode TEXT,
  color TEXT,
  size TEXT,
  purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_stock INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  unit_type TEXT DEFAULT 'pcs',
  location TEXT,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_sku ON public.products(sku);
CREATE INDEX idx_products_item_name ON public.products(item_name);
CREATE INDEX idx_products_model ON public.products(model_number);
CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_search ON public.products USING gin (to_tsvector('simple', coalesce(sku,'')||' '||coalesce(item_name,'')||' '||coalesce(model_number,'')||' '||coalesce(barcode,'')||' '||coalesce(category,'')));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_insert_auth" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_update_auth" ON public.products FOR UPDATE TO authenticated USING (true);
CREATE POLICY "products_delete_admin" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Stock transactions
CREATE TABLE public.stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('stock_in','stock_out','adjustment')),
  employee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_name TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_product ON public.stock_transactions(product_id);
CREATE INDEX idx_txn_created ON public.stock_transactions(created_at DESC);
GRANT SELECT, INSERT ON public.stock_transactions TO authenticated;
GRANT ALL ON public.stock_transactions TO service_role;
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_select_auth" ON public.stock_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "txn_insert_auth" ON public.stock_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = employee_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);
  -- First user becomes admin
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic stock movement RPC
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  _product_id UUID, _quantity INTEGER, _txn_type TEXT, _remarks TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _txn_id UUID;
  _prod RECORD;
  _delta INTEGER;
  _emp_name TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO _prod FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;

  IF _txn_type = 'stock_in' THEN _delta := _quantity;
  ELSIF _txn_type = 'stock_out' THEN _delta := -_quantity;
  ELSIF _txn_type = 'adjustment' THEN _delta := _quantity;
  ELSE RAISE EXCEPTION 'Invalid txn type'; END IF;

  IF _prod.current_stock + _delta < 0 THEN
    RAISE EXCEPTION 'Insufficient stock';
  END IF;

  UPDATE public.products SET current_stock = current_stock + _delta WHERE id = _product_id;

  SELECT full_name INTO _emp_name FROM public.profiles WHERE id = auth.uid();

  INSERT INTO public.stock_transactions(product_id, sku, product_name, quantity, txn_type, employee_id, employee_name, remarks)
  VALUES (_product_id, _prod.sku, _prod.item_name, _quantity, _txn_type, auth.uid(), _emp_name, _remarks)
  RETURNING id INTO _txn_id;

  RETURN _txn_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.record_stock_movement(UUID, INTEGER, TEXT, TEXT) TO authenticated;
