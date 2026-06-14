import { createFileRoute } from "@tanstack/react-router";
import { StockMoveForm } from "@/components/StockMoveForm";

export const Route = createFileRoute("/_authenticated/stock-out")({
  component: () => <StockMoveForm type="stock_out" title="Stock Out" subtitle="Record outward stock" />,
});
