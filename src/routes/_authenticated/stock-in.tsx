import { createFileRoute } from "@tanstack/react-router";
import { StockMoveForm } from "@/components/StockMoveForm";

export const Route = createFileRoute("/_authenticated/stock-in")({
  component: () => <StockMoveForm type="stock_in" title="Stock In" subtitle="Record inward stock" />,
});
