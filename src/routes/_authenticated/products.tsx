import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Upload, Download, Trash2, Pencil, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/products")({ component: Products });

const EMPTY = {
  sku: "", item_name: "", category: "", brand: "", model_number: "", barcode: "", color: "", size: "",
  purchase_price: 0, selling_price: 0, current_stock: 0, min_stock: 0, unit_type: "pcs", location: "", supplier: "", notes: "",
};

function Products() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () => (await supabase.from("products").select("*").order("created_at", { ascending: false }).limit(5000)).data ?? [],
  });

  const filtered = products.filter((p: any) => {
    if (!q) return true;
    const n = q.toLowerCase();
    return [p.sku, p.item_name, p.model_number, p.brand, p.category].some((v) => v && String(v).toLowerCase().includes(n));
  });

  const save = async (form: any) => {
    const payload = { ...form, purchase_price: Number(form.purchase_price), selling_price: Number(form.selling_price), current_stock: Number(form.current_stock), min_stock: Number(form.min_stock) };
    const { error } = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["products-all"] });
    qc.invalidateQueries({ queryKey: ["inventory-all"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["products-all"] });
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      "SKU Code": "EX-001", "Item Name": "Cotton Socks", Category: "Socks", Brand: "Wildcraft", "Model Number": "CS-201",
      Color: "Black", Size: "8", "Purchase Price": 45, "Selling Price": 90, "Opening Stock": 100, "Minimum Stock": 20,
      Location: "Rack-A1", Supplier: "ABC Traders", Notes: "",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "product-import-template.xlsx");
  };

  const importFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    const errors: string[] = [];
    const records = rows.map((r, i) => {
      const sku = String(r["SKU Code"] ?? "").trim();
      const name = String(r["Item Name"] ?? "").trim();
      if (!sku) errors.push(`Row ${i + 2}: SKU Code missing`);
      if (!name) errors.push(`Row ${i + 2}: Item Name missing`);
      return {
        sku, item_name: name, category: r["Category"] ?? null, brand: r["Brand"] ?? null,
        model_number: r["Model Number"] ?? null, color: r["Color"] ?? null, size: String(r["Size"] ?? "") || null,
        purchase_price: Number(r["Purchase Price"] ?? 0), selling_price: Number(r["Selling Price"] ?? 0),
        current_stock: Number(r["Opening Stock"] ?? 0), min_stock: Number(r["Minimum Stock"] ?? 0),
        location: r["Location"] ?? null, supplier: r["Supplier"] ?? null, notes: r["Notes"] ?? null,
      };
    });
    if (errors.length) { toast.error(errors.slice(0, 5).join("\n")); return; }
    const { error } = await supabase.from("products").upsert(records, { onConflict: "sku" });
    if (error) return toast.error(error.message);
    toast.success(`Imported ${records.length} products`);
    qc.invalidateQueries({ queryKey: ["products-all"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">Manage SKU master ({products.length})</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={downloadTemplate}><FileSpreadsheet className="w-4 h-4 mr-2" />Template</Button>
          {isAdmin && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Import Excel</Button>
              <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
                <DialogTrigger asChild><Button onClick={() => setEditing(EMPTY)}><Plus className="w-4 h-4 mr-2" />Add Product</Button></DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editing?.id ? "Edit Product" : "New Product"}</DialogTitle></DialogHeader>
                  {editing && <ProductForm initial={editing} onSubmit={save} />}
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <Card className="p-4">
        <Input placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase">
            <tr><th className="px-3 py-2 text-left">SKU</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Brand</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-accent/40">
                <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                <td className="px-3 py-2">{p.item_name} <span className="text-muted-foreground">· {p.color}/{p.size}</span></td>
                <td className="px-3 py-2">{p.category}</td>
                <td className="px-3 py-2">{p.brand}</td>
                <td className="px-3 py-2 text-right">{p.current_stock}</td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ProductForm({ initial, onSubmit }: { initial: any; onSubmit: (v: any) => void }) {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU *"><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} required /></Field>
        <Field label="Item Name *"><Input value={form.item_name} onChange={(e) => set("item_name", e.target.value)} required /></Field>
        <Field label="Category"><Input value={form.category ?? ""} onChange={(e) => set("category", e.target.value)} /></Field>
        <Field label="Brand"><Input value={form.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></Field>
        <Field label="Model Number"><Input value={form.model_number ?? ""} onChange={(e) => set("model_number", e.target.value)} /></Field>
        <Field label="Barcode"><Input value={form.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} /></Field>
        <Field label="Color"><Input value={form.color ?? ""} onChange={(e) => set("color", e.target.value)} /></Field>
        <Field label="Size"><Input value={form.size ?? ""} onChange={(e) => set("size", e.target.value)} /></Field>
        <Field label="Purchase Price"><Input type="number" step="0.01" value={form.purchase_price} onChange={(e) => set("purchase_price", e.target.value)} /></Field>
        <Field label="Selling Price"><Input type="number" step="0.01" value={form.selling_price} onChange={(e) => set("selling_price", e.target.value)} /></Field>
        <Field label="Current Stock"><Input type="number" value={form.current_stock} onChange={(e) => set("current_stock", e.target.value)} /></Field>
        <Field label="Minimum Stock"><Input type="number" value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} /></Field>
        <Field label="Unit"><Input value={form.unit_type ?? "pcs"} onChange={(e) => set("unit_type", e.target.value)} /></Field>
        <Field label="Location"><Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
        <Field label="Supplier"><Input value={form.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div className="flex justify-end gap-2"><Button type="submit">Save</Button></div>
    </form>
  );
}

const Field = ({ label, children }: any) => (
  <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
);
