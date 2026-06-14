import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function StockMoveForm({ type, title, subtitle }: { type: "stock_in" | "stock_out"; title: string; subtitle: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<any | null>(null);
  const [qty, setQty] = useState(1);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["products-search"],
    queryFn: async () => (await supabase.from("products").select("id,sku,item_name,color,size,current_stock").limit(5000)).data ?? [],
  });

  const results = useMemo(() => {
    if (!q) return [];
    const n = q.toLowerCase();
    return products.filter((p: any) => [p.sku, p.item_name].some((v) => v?.toLowerCase().includes(n))).slice(0, 8);
  }, [products, q]);

  const submit = async () => {
    if (!picked) return toast.error("Pick a product");
    if (qty <= 0) return toast.error("Qty must be positive");
    setBusy(true);
    const { error } = await supabase.rpc("record_stock_movement", {
      _product_id: picked.id, _quantity: qty, _txn_type: type, _remarks: remarks || "",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${title} recorded`);
    setPicked(null); setQty(1); setRemarks(""); setQ("");
    qc.invalidateQueries();
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Card className="p-5 space-y-4">
        <div>
          <Label>Search product (SKU or name)</Label>
          <Input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder="Start typing..." />
          {results.length > 0 && !picked && (
            <div className="mt-2 border rounded-md divide-y max-h-64 overflow-auto">
              {results.map((r: any) => (
                <button key={r.id} type="button" onClick={() => { setPicked(r); setQ(`${r.sku} — ${r.item_name}`); }}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                  <div className="font-medium">{r.item_name} <span className="text-xs text-muted-foreground">{r.color}/{r.size}</span></div>
                  <div className="text-xs text-muted-foreground font-mono">{r.sku} · stock: {r.current_stock}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        {picked && (
          <div className="text-sm bg-accent p-3 rounded-md">
            <div className="font-medium">{picked.item_name}</div>
            <div className="text-xs text-muted-foreground">{picked.sku} · Current stock: {picked.current_stock}</div>
          </div>
        )}
        <div>
          <Label>Quantity</Label>
          <Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
        </div>
        <div>
          <Label>Remarks</Label>
          <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
        </div>
        <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Saving..." : `Record ${title}`}</Button>
      </Card>
    </div>
  );
}
