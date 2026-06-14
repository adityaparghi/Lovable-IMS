import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/products/$id")({ component: ProductDetail });

function ProductDetail() {
  const { id } = useParams({ from: "/_authenticated/products/$id" });
  const { data: p } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => (await supabase.from("products").select("*").eq("id", id).single()).data,
  });
  const { data: txns = [] } = useQuery({
    queryKey: ["product-txns", id],
    queryFn: async () => (await supabase.from("stock_transactions").select("*").eq("product_id", id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  if (!p) return <div>Loading...</div>;
  const status = p.current_stock === 0 ? "Out of Stock" : p.current_stock <= p.min_stock ? "Low Stock" : "In Stock";

  return (
    <div className="space-y-4">
      <Link to="/inventory" className="text-sm text-primary flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Back to inventory</Link>
      <div>
        <h1 className="text-2xl font-bold">{p.item_name}</h1>
        <p className="text-sm text-muted-foreground">{p.sku} · {p.color} / {p.size}</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-5 md:col-span-2 space-y-2">
          <h2 className="font-semibold mb-3">Product Information</h2>
          <Info k="Category" v={p.category} /><Info k="Brand" v={p.brand} /><Info k="Model" v={p.model_number} />
          <Info k="Barcode" v={p.barcode} /><Info k="Purchase Price" v={`₹${p.purchase_price}`} />
          <Info k="Selling Price" v={`₹${p.selling_price}`} /><Info k="Unit" v={p.unit_type} />
          <Info k="Location" v={p.location} /><Info k="Supplier" v={p.supplier} /><Info k="Notes" v={p.notes} />
          <Info k="Created" v={format(new Date(p.created_at), "PPp")} />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Stock</h2>
          <div className="text-4xl font-bold">{p.current_stock}</div>
          <div className="text-sm text-muted-foreground">Min: {p.min_stock}</div>
          <div className="mt-3 text-sm font-medium">{status}</div>
        </Card>
      </div>
      <Card className="p-5">
        <h2 className="font-semibold mb-3">Stock History</h2>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Date</th><th className="text-left">Type</th><th className="text-right">Qty</th><th className="text-left">By</th><th className="text-left">Remarks</th></tr></thead>
          <tbody>
            {txns.map((t: any) => (
              <tr key={t.id} className="border-t">
                <td className="py-2">{format(new Date(t.created_at), "PP p")}</td>
                <td>{t.txn_type}</td>
                <td className="text-right">{t.quantity}</td>
                <td>{t.employee_name}</td>
                <td>{t.remarks}</td>
              </tr>
            ))}
            {!txns.length && <tr><td colSpan={5} className="py-4 text-muted-foreground text-center">No movements yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
const Info = ({ k, v }: any) => v ? <div className="flex justify-between text-sm border-b py-1.5"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div> : null;
