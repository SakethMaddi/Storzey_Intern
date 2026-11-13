import type { Order, OrderStage } from "../../types";
import { attentionItems } from "./order-documents";

export function OrderAttention({
  orders,
  stages,
  onOpenOrder,
}: {
  orders: Order[];
  stages: Record<number, OrderStage[]>;
  onOpenOrder: (orderId: number) => void;
}) {
  const items = attentionItems(
    orders.map((order) => ({
      id: order.id,
      itemName: order.itemName,
      totalAmount: order.totalAmount,
      balance: order.balance,
      paymentStatus: order.paymentStatus,
      status: order.status,
      promisedDate: order.promisedDate,
      createdAt: order.createdAt,
      isArchived: order.isArchived,
      customerName: order.customer?.name || "Customer",
      boutiqueName: "",
    })),
    stages
  );

  if (items.length === 0) return null;
  const visible = items.slice(0, 4);

  return (
    <section className="attention-panel" aria-label="Orders needing attention">
      <div className="attention-head">
        <h2>Needs attention</h2>
        <p>
          {items.length > visible.length
            ? `Showing ${visible.length} of ${items.length} loaded orders. These are not scheduled messages.`
            : "From the orders currently loaded. These are not scheduled messages."}
        </p>
      </div>
      <ul>
        {visible.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.label}</strong>
              <span>
                {item.customerName} · Order #{item.orderId}
              </span>
              <p>{item.detail}</p>
            </div>
            <button type="button" className="customers-btn customers-btn-ghost" onClick={() => onOpenOrder(item.orderId)}>
              Open order
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
