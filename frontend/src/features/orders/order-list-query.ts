/** Payment statuses stored on Order.paymentStatus and accepted by GET /orders?status= */
export const SERVER_ORDER_PAYMENT_STATUSES = ["PENDING", "PARTIALLY_PAID", "PAID"] as const;

export function buildOrdersQuery(input: {
  page: number;
  archived: boolean;
  search: string;
  status: string;
}): string {
  const params = new URLSearchParams();
  const page = Number.isInteger(input.page) && input.page > 0 ? input.page : 1;
  params.set("page", String(page));
  params.set("limit", "50");
  params.set("archived", input.archived ? "true" : "false");
  const search = input.search.trim().slice(0, 100);
  if (search) params.set("search", search);
  if ((SERVER_ORDER_PAYMENT_STATUSES as readonly string[]).includes(input.status)) {
    params.set("status", input.status);
  }
  return params.toString();
}
