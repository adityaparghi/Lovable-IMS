import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Package, Boxes, AlertTriangle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const [{ count: totalSku }, { data: stockSum }, { count: outStock }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("current_stock,min_stock"),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("current_stock", 0),
      ]);
      const totalStock = (stockSum ?? []).reduce((a: number, r: any) => a + (r.current_stock ?? 0), 0);
      const low = (stockSum ?? []).filter((p: any) => p.current_stock > 0 && p.current_stock <= p.min_stock).length;
      return { totalSku: totalSku ?? 0, totalStock, lowStock: low, outStock: outStock ?? 0 };
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["dash-recent"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_transactions")
        .select("*").order("created_at", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: lowList } = useQuery({
    queryKey: ["dash-low"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,sku,item_name,current_stock,min_stock")
        .order("current_stock").limit(8);
      return (data ?? []).filter((p: any) => p.current_stock <= p.min_stock);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your wholesale inventory</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total SKUs" value={stats?.totalSku ?? "—"} tone="primary" />
        <StatCard icon={Boxes} label="Total Stock Units" value={stats?.totalStock ?? "—"} tone="success" />
        <StatCard icon={AlertTriangle} label="Low Stock" value={stats?.lowStock ?? "—"} tone="warning" />
        <StatCard icon={XCircle} label="Out of Stock" value={stats?.outStock ?? "—"} tone="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Recent Activity</h2>
            <Link to="/reports" className="text-xs text-primary">View all</Link>
          </div>
          <div className="divide-y">
            {(recent ?? []).map((t: any) => (
              <div key={t.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{t.product_name} <span className="text-muted-foreground">({t.sku})</span></div>
                  <div className="text-xs text-muted-foreground">{t.employee_name ?? "—"} · {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</div>
                </div>
                <div className={`text-sm font-semibold ${t.txn_type === "stock_in" ? "text-success" : t.txn_type === "stock_out" ? "text-destructive" : ""}`}>
                  {t.txn_type === "stock_in" ? "+" : t.txn_type === "stock_out" ? "−" : "±"}{t.quantity}
                </div>
              </div>
            ))}
            {!recent?.length && <div className="text-sm text-muted-foreground py-4">No activity yet.</div>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Low / Out of Stock</h2>
            <Link to="/inventory" className="text-xs text-primary">View inventory</Link>
          </div>
          <div className="divide-y">
            {(lowList ?? []).map((p: any) => (
              <div key={p.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{p.item_name}</div>
                  <div className="text-xs text-muted-foreground">{p.sku}</div>
                </div>
                <div className={`text-sm font-semibold ${p.current_stock === 0 ? "text-destructive" : "text-warning"}`}>
                  {p.current_stock} / {p.min_stock}
                </div>
              </div>
            ))}
            {!lowList?.length && <div className="text-sm text-muted-foreground py-4">All stock healthy.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone as string];
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-md grid place-items-center ${toneClass}`}><Icon className="w-6 h-6" /></div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </div>
    </Card>
  );
}
