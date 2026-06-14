import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/reports")({ component: Reports });

function Reports() {
  const { data: products = [] } = useQuery({
    queryKey: ["rpt-products"],
    queryFn: async () => (await supabase.from("products").select("*").limit(5000)).data ?? [],
  });
  const { data: txns = [] } = useQuery({
    queryKey: ["rpt-txns"],
    queryFn: async () => (await supabase.from("stock_transactions").select("*").order("created_at", { ascending: false }).limit(2000)).data ?? [],
  });

  const lowStock = products.filter((p: any) => p.current_stock <= p.min_stock);
  const byCategory = products.reduce((acc: any, p: any) => {
    const k = p.category || "Uncategorized";
    if (!acc[k]) acc[k] = { skus: 0, units: 0 };
    acc[k].skus++; acc[k].units += p.current_stock;
    return acc;
  }, {});

  const exportXlsx = (rows: any[], name: string) => {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${name}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>

      <div className="grid md:grid-cols-2 gap-4">
        <ReportCard title="Current Inventory" count={products.length}
          onExport={() => exportXlsx(products.map((p: any) => ({ SKU: p.sku, Item: p.item_name, Category: p.category, Stock: p.current_stock, Min: p.min_stock })), "current-inventory")} />
        <ReportCard title="Low Stock" count={lowStock.length}
          onExport={() => exportXlsx(lowStock.map((p: any) => ({ SKU: p.sku, Item: p.item_name, Stock: p.current_stock, Min: p.min_stock })), "low-stock")} />
        <ReportCard title="Stock Movements" count={txns.length}
          onExport={() => exportXlsx(txns.map((t: any) => ({ Date: t.created_at, SKU: t.sku, Item: t.product_name, Type: t.txn_type, Qty: t.quantity, By: t.employee_name, Remarks: t.remarks })), "stock-movements")} />
        <ReportCard title="Category-wise" count={Object.keys(byCategory).length}
          onExport={() => exportXlsx(Object.entries(byCategory).map(([k, v]: any) => ({ Category: k, SKUs: v.skus, Units: v.units })), "category-report")} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Recent Movements (latest 30)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left py-2">Date</th><th className="text-left">SKU</th><th className="text-left">Item</th><th className="text-left">Type</th><th className="text-right">Qty</th><th className="text-left">By</th></tr></thead>
            <tbody>
              {txns.slice(0, 30).map((t: any) => (
                <tr key={t.id} className="border-t">
                  <td className="py-2">{format(new Date(t.created_at), "PP p")}</td>
                  <td className="font-mono text-xs">{t.sku}</td>
                  <td>{t.product_name}</td>
                  <td>{t.txn_type}</td>
                  <td className="text-right">{t.quantity}</td>
                  <td>{t.employee_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ReportCard({ title, count, onExport }: any) {
  return (
    <Card className="p-5 flex items-center justify-between">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-2xl font-bold">{count}</p>
      </div>
      <Button variant="outline" onClick={onExport}><Download className="w-4 h-4 mr-2" />Export</Button>
    </Card>
  );
}
