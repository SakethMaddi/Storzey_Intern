export interface RecentOrder {
  id: number;
  itemName: string;
  totalAmount: number;
  balance: number;
  paymentStatus: string;
  createdAt: string;
  customer: { id: number; name: string } | null;
}

export interface RecentPayment {
  id: number;
  amount: number;
  paymentType: string;
  status: string;
  createdAt: string;
  order: {
    id: number;
    itemName: string;
    customer: { id: number; name: string } | null;
  } | null;
}

export type SummaryCardAction =
  | "orders"
  | "customers"
  | "revenue"
  | "outstanding"
  | "paid"
  | "partial"
  | "pending";

export interface DashboardSummaryProps {
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  totalOutstanding: number;
  paidCount?: number;
  partiallyPaidCount?: number;
  pendingCount?: number;
  activeStatusFilter?: string;
  onCardClick?: (action: SummaryCardAction) => void;
}

/** Format integer rupees in Indian locale: ₹1,00,000 */
function inr(amount: number | undefined): string {
  const val = Number(amount) || 0;
  return `₹${val.toLocaleString("en-IN")}`;
}

export function DashboardSummary({
  totalOrders,
  totalCustomers,
  totalRevenue,
  totalOutstanding,
  paidCount = 0,
  partiallyPaidCount = 0,
  pendingCount = 0,
  activeStatusFilter = "ALL",
  onCardClick,
}: DashboardSummaryProps) {
  const handleKeyDown = (e: React.KeyboardEvent, action: SummaryCardAction) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onCardClick?.(action);
    }
  };

  return (
    <div className="dashboard-summary" role="region" aria-label="Dashboard Overview Metrics">
      {/* ── 1. Total Orders ── */}
      <div
        className={`summary-card clickable-card ${activeStatusFilter === "ALL" ? "card-active" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={`Total Orders: ${totalOrders || 0}. Click to view all active orders.`}
        onClick={() => onCardClick?.("orders")}
        onKeyDown={(e) => handleKeyDown(e, "orders")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Total Orders</span>
          <span className="card-action-icon" aria-hidden="true">→</span>
        </div>
        <span className="summary-val">{totalOrders || 0}</span>
        <span className="card-hint">View all active orders</span>
      </div>

      {/* ── 2. Total Customers ── */}
      <div
        className="summary-card clickable-card"
        tabIndex={0}
        role="button"
        aria-label={`Total Customers: ${totalCustomers || 0}. Click to view active customers.`}
        onClick={() => onCardClick?.("customers")}
        onKeyDown={(e) => handleKeyDown(e, "customers")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Total Customers</span>
          <span className="card-action-icon" aria-hidden="true">→</span>
        </div>
        <span className="summary-val">{totalCustomers || 0}</span>
        <span className="card-hint">Manage customers</span>
      </div>

      {/* ── 3. Total Revenue Collected ── */}
      <div
        className="summary-card clickable-card"
        tabIndex={0}
        role="button"
        aria-label={`Total Revenue Collected: ${inr(totalRevenue)}. Click to view recent payment activity.`}
        onClick={() => onCardClick?.("revenue")}
        onKeyDown={(e) => handleKeyDown(e, "revenue")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Total Revenue Collected</span>
          <span className="card-action-icon" aria-hidden="true">→</span>
        </div>
        <span className="summary-val" style={{ color: "#15803d" }}>
          {inr(totalRevenue)}
        </span>
        <span className="card-hint">View payment activity</span>
      </div>

      {/* ── 4. Outstanding Balance ── */}
      <div
        className={`summary-card clickable-card ${activeStatusFilter === "OUTSTANDING" ? "card-active" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={`Outstanding Balance: ${inr(totalOutstanding)}. Click to filter orders with balance.`}
        onClick={() => onCardClick?.("outstanding")}
        onKeyDown={(e) => handleKeyDown(e, "outstanding")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Outstanding Balance</span>
          <span className="card-action-icon" aria-hidden="true">→</span>
        </div>
        <span className="summary-val" style={{ color: "#b91c1c" }}>
          {inr(totalOutstanding)}
        </span>
        <span className="card-hint">Filter unpaid balances</span>
      </div>

      {/* ── 5. Paid Orders ── */}
      <div
        className={`summary-card clickable-card ${activeStatusFilter === "PAID" ? "card-active" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={`Paid Orders: ${paidCount || 0}. Click to filter fully paid orders.`}
        onClick={() => onCardClick?.("paid")}
        onKeyDown={(e) => handleKeyDown(e, "paid")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Paid Orders</span>
          {activeStatusFilter === "PAID" && (
            <span className="active-filter-badge">Active</span>
          )}
        </div>
        <span className="summary-val" style={{ color: "#166534" }}>
          {paidCount || 0}
        </span>
        <span className="card-hint">Filter fully paid</span>
      </div>

      {/* ── 6. Partially Paid ── */}
      <div
        className={`summary-card clickable-card ${activeStatusFilter === "PARTIALLY_PAID" ? "card-active" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={`Partially Paid Orders: ${partiallyPaidCount || 0}. Click to filter partial payments.`}
        onClick={() => onCardClick?.("partial")}
        onKeyDown={(e) => handleKeyDown(e, "partial")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Partially Paid</span>
          {activeStatusFilter === "PARTIALLY_PAID" && (
            <span className="active-filter-badge">Active</span>
          )}
        </div>
        <span className="summary-val" style={{ color: "#b45309" }}>
          {partiallyPaidCount || 0}
        </span>
        <span className="card-hint">Filter partial payments</span>
      </div>

      {/* ── 7. Pending Production ── */}
      <div
        className={`summary-card clickable-card ${activeStatusFilter === "PENDING" ? "card-active" : ""}`}
        tabIndex={0}
        role="button"
        aria-label={`Awaiting payment: ${pendingCount || 0}. Click to filter orders with no recorded payment.`}
        onClick={() => onCardClick?.("pending")}
        onKeyDown={(e) => handleKeyDown(e, "pending")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span className="summary-label">Awaiting payment</span>
          {activeStatusFilter === "PENDING" && (
            <span className="active-filter-badge">Active</span>
          )}
        </div>
        <span className="summary-val" style={{ color: "#b91c1c" }}>
          {pendingCount || 0}
        </span>
        <span className="card-hint">No payment recorded yet</span>
      </div>
    </div>
  );
}
