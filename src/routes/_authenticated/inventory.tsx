import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Search } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/inventory")({ component: Inventory });

function Inventory() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["inventory-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("item_name").limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const categories = useMemo(() => Array.from(new Set(products.map((p: any) => p.category).filter(Boolean))).sort(), [products]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter((p: any) => {
      if (cat && p.category !== cat) return false;
      if (!needle) return true;
      return [p.sku, p.item_name, p.model_number, p.barcode, p.category, p.brand, p.color]
        .some((v) => v && String(v).toLowerCase().includes(needle));
    });
  }, [products, q, cat]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered.map((p: any) => ({
      SKU: p.sku, "Item Name": p.item_name, Category: p.category, Brand: p.brand, "Model No": p.model_number,
      Color: p.color, Size: p.size, "Purchase Price": p.purchase_price, "Selling Price": p.selling_price,
      "Current Stock": p.current_stock, "Min Stock": p.min_stock, Location: p.location, Supplier: p.supplier,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `inventory-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {products.length} SKUs</p>
        </div>
        <Button onClick={exportExcel} variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
      </div>

      <Card className="p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search SKU, name, model, barcode, category..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <select className="h-9 px-3 rounded-md border bg-background text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c as string} value={c as string}>{c as string}</option>)}
        </select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0 text-xs uppercase">
              <tr>
                <Th>SKU</Th><Th>Product</Th><Th>Model</Th><Th>Color</Th><Th>Size</Th>
                <Th className="text-right">Purchase</Th><Th className="text-right">Selling</Th>
                <Th className="text-right">Stock</Th><Th>Location</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const status = p.current_stock === 0 ? "out" : p.current_stock <= p.min_stock ? "low" : "in";
                return (
                  <tr key={p.id} className="border-t hover:bg-accent/40">
                    <td className="px-3 py-2 font-mono text-xs"><Link to="/products/$id" params={{ id: p.id }} className="text-primary hover:underline">{p.sku}</Link></td>
                    <td className="px-3 py-2">{p.item_name}</td>
                    <td className="px-3 py-2">{p.model_number}</td>
                    <td className="px-3 py-2">{p.color}</td>
                    <td className="px-3 py-2">{p.size}</td>
                    <td className="px-3 py-2 text-right">₹{p.purchase_price}</td>
                    <td className="px-3 py-2 text-right">₹{p.selling_price}</td>
                    <td className="px-3 py-2 text-right font-semibold">{p.current_stock}</td>
                    <td className="px-3 py-2">{p.location}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${status === "in" ? "bg-success" : status === "low" ? "bg-warning" : "bg-destructive"}`} />
                      <span className="text-xs">{status === "in" ? "In Stock" : status === "low" ? "Low" : "Out"}</span>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No products match.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const Th = ({ children, className = "" }: any) => <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
