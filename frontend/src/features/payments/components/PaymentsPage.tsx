import { useState, useMemo } from "react";
import type { Order } from "../../../types";
import type { RecentPayment } from "../../orders/components/DashboardSummary";
import { inr, formatOrderDate } from "../../orders/order-utils";

export interface PaymentsPageProps {
  totalCollected: number;
  totalOutstanding: number;
  recentPayments: RecentPayment[];
  orders: Order[];
  onOpenOrder: (orderId: number) => void;
}

export function PaymentsPage({
  totalCollected,
  totalOutstanding,
  recentPayments,
  orders,
  onOpenOrder,
}: PaymentsPageProps) {
  const [activeTab, setActiveTab] = useState<"outstanding" | "history">("outstanding");
  const [searchQuery, setSearchQuery] = useState("");

  // Orders that have a remaining balance due
  const payableOrders = useMemo(() => {
    return orders.filter(
      (order) =>
        !order.isArchived &&
        order.status !== "CANCELLED" &&
        order.balance > 0
    );
  }, [orders]);

  const filteredPayable = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return payableOrders;
    return payableOrders.filter(
      (o) =>
        o.itemName.toLowerCase().includes(q) ||
        (o.customer?.name && o.customer.name.toLowerCase().includes(q)) ||
        (o.customer?.phone && o.customer.phone.includes(q)) ||
        String(o.id).includes(q)
    );
  }, [payableOrders, searchQuery]);

  return (
    <section className="boutique-section" aria-label="Payments & Financial Overview">
      {/* ── 1. PAGE HEADER ── */}
      <div className="section-header-row">
        <div>
          <h1 className="section-title">Payments & Ledger</h1>
          <p className="section-subtitle">
            Track revenue collections, outstanding client balances, and record payments.
          </p>
        </div>
      </div>

      {/* ── 2. FINANCIAL SUMMARY CARDS ── */}
      <div className="financial-kpi-grid">
        <div className="kpi-card kpi-card-collected">
          <div className="kpi-head">
            <span className="kpi-label">Total Revenue Collected</span>
            <span className="kpi-badge badge-paid">Verified</span>
          </div>
          <strong className="kpi-value text-paid">{inr(totalCollected)}</strong>
          <span className="kpi-footer">Completed & captured payments</span>
        </div>

        <div className="kpi-card kpi-card-outstanding">
          <div className="kpi-head">
            <span className="kpi-label">Total Outstanding Balance</span>
            <span className="kpi-badge badge-pending">Due</span>
          </div>
          <strong className="kpi-value text-balance">{inr(totalOutstanding)}</strong>
          <span className="kpi-footer">Active unpaid balances across all orders</span>
        </div>
      </div>

      {/* ── 3. SECTION NAVIGATION (OUTSTANDING vs HISTORY) ── */}
      <div className="orders-control-bar" style={{ marginTop: "24px" }}>
        <div className="segmented-toggle" role="tablist" aria-label="Payments view">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "outstanding"}
            className={`segmented-btn ${activeTab === "outstanding" ? "is-active" : ""}`}
            onClick={() => setActiveTab("outstanding")}
          >
            Outstanding Balances ({payableOrders.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "history"}
            className={`segmented-btn ${activeTab === "history" ? "is-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            Payment History ({recentPayments.length})
          </button>
        </div>

        {activeTab === "outstanding" && payableOrders.length > 0 && (
          <div className="search-box" style={{ maxWidth: "340px" }}>
            <svg
              className="search-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              placeholder="Filter by customer, garment, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Filter outstanding orders"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="search-clear-btn"
                aria-label="Clear filter"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── 4. OUTSTANDING PAYMENTS TAB ── */}
      {activeTab === "outstanding" && (
        <div className="tab-content-area" role="tabpanel" aria-label="Outstanding Balances">
          {filteredPayable.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-icon-wrap">✓</div>
              <h3>No Outstanding Balances</h3>
              <p>
                {searchQuery.trim()
                  ? `No orders matching "${searchQuery}" have an outstanding balance.`
                  : "All active orders on this page have been settled in full."}
              </p>
            </div>
          ) : (
            <div className="payable-orders-grid">
              {filteredPayable.map((order) => {
                const paid = Math.max(0, order.totalAmount - order.balance);
                return (
                  <article key={order.id} className="boutique-order-card">
                    <div className="card-top-row">
                      <div className="card-id-name">
                        <span className="order-num-pill">#{order.id}</span>
                        <div>
                          <h3 className="card-customer-title">{order.customer?.name || "Customer"}</h3>
                          <span className="card-item-tag">{order.itemName}</span>
                        </div>
                      </div>
                      <span className="status-badge badge-pending">
                        Balance Due: {inr(order.balance)}
                      </span>
                    </div>

                    <div className="card-metrics-grid">
                      <div className="metric-box">
                        <span className="metric-label">Total Order</span>
                        <strong className="metric-value">{inr(order.totalAmount)}</strong>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Agreed Advance</span>
                        <strong className="metric-value">{inr(order.advance)}</strong>
                      </div>
                      <div className="metric-box">
                        <span className="metric-label">Already Paid</span>
                        <strong className="metric-value metric-paid">{inr(paid)}</strong>
                      </div>
                    </div>

                    <div className="card-actions-bar">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onOpenOrder(order.id)}
                      >
                        Record Payment →
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 5. RECENT PAYMENT HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="tab-content-area" role="tabpanel" aria-label="Payment History">
          {recentPayments.length === 0 ? (
            <div className="empty-state-card">
              <div className="empty-icon-wrap">💳</div>
              <h3>No Recorded Payments Yet</h3>
              <p>Verified payments will appear here as you record advance deposits and balance settlements.</p>
            </div>
          ) : (
            <div className="desktop-table-wrapper">
              <table className="boutique-table">
                <thead>
                  <tr>
                    <th>Payment Amount</th>
                    <th>Type</th>
                    <th>Order & Customer</th>
                    <th>Date Recorded</th>
                    <th style={{ textAlign: "center" }}>Status</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((payment) => {
                    const isSuccess = payment.status === "COMPLETED" || payment.status === "CAPTURED";
                    return (
                      <tr key={payment.id} className="table-row">
                        <td className="cell-amount text-paid">
                          <strong>{inr(payment.amount)}</strong>
                        </td>
                        <td>
                          <span className="status-badge-sm badge-active">
                            {payment.paymentType}
                          </span>
                        </td>
                        <td>
                          <div className="customer-info">
                            <strong className="customer-name">
                              {payment.order?.customer?.name || "Customer"}
                            </strong>
                            <span className="customer-phone">
                              Order #{payment.order?.id} · {payment.order?.itemName || "Garment"}
                            </span>
                          </div>
                        </td>
                        <td className="cell-date">
                          {payment.createdAt ? formatOrderDate(payment.createdAt) : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span className={`status-badge-sm ${
                            isSuccess
                              ? "badge-paid"
                              : payment.status === "CANCELLED" || payment.status === "FAILED"
                              ? "badge-cancelled"
                              : "badge-pending"
                          }`}>
                            {payment.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {payment.order && (
                            <button
                              type="button"
                              className="btn-action-sm"
                              onClick={() => onOpenOrder(payment.order!.id)}
                            >
                              View Order
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
