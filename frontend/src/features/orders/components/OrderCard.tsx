import { useState } from "react";
import type { Order, Payment, OrderStage } from "../../../types";
import { ManualPaymentForm } from "../../payments/components/ManualPaymentForm";
import {
  inr,
  formatOrderDate,
  getOrderProductionStatus,
} from "../order-utils";

export interface OrderCardProps {
  order: Order;
  isSelected: boolean;
  orderPayments?: Payment[];
  orderStages?: OrderStage[];
  paymentInput?: { amount: string; type: string };
  paymentError?: string;
  paymentSuccess?: string;
  isSubmittingPayment?: boolean;
  isUpdatingStage?: boolean;
  onToggleDetails: () => void;
  onPaymentAmountChange: (amount: string) => void;
  onPaymentTypeChange: (type: string) => void;
  onRecordPayment: () => void;
  onReconcile: () => void;
  onCancelPayment?: (orderId: number, paymentId: number) => void;
  onUpdateStageStatus: (stageId: number, status: string) => void;
  onCancelOrder: (orderId: number, reason: string) => void;
  onArchiveOrder: (orderId: number) => void;
  onRestoreOrder: (orderId: number) => void;
}

export function OrderCard({
  order,
  isSelected,
  orderPayments = [],
  orderStages = [],
  paymentInput = { amount: "", type: "ADVANCE" },
  paymentError,
  paymentSuccess,
  isSubmittingPayment = false,
  isUpdatingStage = false,
  onToggleDetails,
  onPaymentAmountChange,
  onPaymentTypeChange,
  onRecordPayment,
  onReconcile,
  onCancelPayment,
  onUpdateStageStatus,
  onCancelOrder,
  onArchiveOrder,
  onRestoreOrder,
}: OrderCardProps) {
  const isCancelled = order.status === "CANCELLED";
  const isArchived = !!order.isArchived;

  // Inline cancellation form state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const amountPaid = order.totalAmount - order.balance;
  const paidPercentage = Math.min(
    100,
    Math.max(0, Math.round((amountPaid / order.totalAmount) * 100))
  );

  const prodStatus = getOrderProductionStatus(order, orderStages);

  const handleSubmitCancel = () => {
    if (!cancelReason.trim()) {
      setCancelError("Please enter a cancellation reason (required).");
      return;
    }
    onCancelOrder(order.id, cancelReason.trim());
    setShowCancelForm(false);
    setCancelReason("");
    setCancelError("");
  };

  const handleCopyTrackingLink = () => {
    const url = `${window.location.origin}/track/${order.publicToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <article
      className={`order-card orders-item-card ${isSelected ? "is-expanded" : ""}`}
      aria-label={`Order ${order.id}: ${order.itemName}`}
    >
      {/* ── CARD HEADER ── */}
      <div className="orders-card-head">
        <div className="orders-card-title-group">
          <div className="orders-id-badge">#{order.id}</div>
          <div>
            <h3 className="orders-card-title">
              {order.customer?.name} — {order.itemName}
            </h3>
            <span className="orders-card-sub">
              Placed {formatOrderDate(order.createdAt)} • Phone: {order.customer?.phone}
            </span>
          </div>
        </div>

        <div className="orders-card-head-badges">
          {/* Production Status Badge */}
          <span className={`orders-badge ${prodStatus.badgeClass}`}>
            {prodStatus.label}
          </span>

          {/* Payment Status Badge */}
          <span
            className={`orders-badge ${
              order.paymentStatus === "PAID"
                ? "badge-paid"
                : order.paymentStatus === "PARTIALLY_PAID"
                ? "badge-partial"
                : "badge-pending"
            }`}
          >
            {order.paymentStatus === "PAID"
              ? "Fully Paid"
              : order.paymentStatus === "PARTIALLY_PAID"
              ? "Partially Paid"
              : "Pending Payment"}
          </span>

          {isCancelled && (
            <span className="orders-badge badge-cancelled">CANCELLED</span>
          )}
          {isArchived && (
            <span className="orders-badge badge-archived">ARCHIVED</span>
          )}
        </div>
      </div>

      {/* ── FINANCIAL & DELIVERY SUMMARY ── */}
      <div className="orders-summary-bar">
        <div className="orders-sum-cell">
          <span className="orders-sum-label">Total Amount</span>
          <strong className="orders-sum-val">{inr(order.totalAmount)}</strong>
        </div>

        <div className="orders-sum-cell">
          <span className="orders-sum-label">Advance Paid</span>
          <strong className="orders-sum-val" style={{ color: "#166534" }}>
            {inr(order.advance)}
          </strong>
        </div>

        <div className="orders-sum-cell">
          <span className="orders-sum-label">Balance Due</span>
          <strong
            className="orders-sum-val"
            style={{ color: order.balance > 0 ? "#b91c1c" : "#166534" }}
          >
            {inr(order.balance)}
          </strong>
        </div>

        <div className="orders-sum-cell">
          <span className="orders-sum-label">Promised Delivery</span>
          <strong className="orders-sum-val">
            {formatOrderDate(order.promisedDate)}
          </strong>
        </div>
      </div>

      {/* ── PROGRESS BAR ── */}
      <div className="orders-progress-bar-wrap">
        <div className="orders-progress-track">
          <div
            className="orders-progress-fill"
            style={{ width: `${paidPercentage}%` }}
          />
        </div>
        <div className="orders-progress-labels">
          <span>{paidPercentage}% Paid</span>
          <span>
            {order.balance <= 0 ? "Settled" : `${inr(order.balance)} Remaining`}
          </span>
        </div>
      </div>

      {/* ── CANCELLATION NOTICE BANNER ── */}
      {isCancelled && order.cancellationReason && (
        <div className="orders-cancel-notice" role="alert">
          <strong>Cancellation Reason:</strong> {order.cancellationReason}
          {order.cancelledAt && (
            <span className="orders-cancel-date">
              Cancelled on {new Date(order.cancelledAt).toLocaleString("en-IN")}
            </span>
          )}
        </div>
      )}

      {/* ── CARD ACTION BUTTONS ── */}
      <div className="orders-actions-bar">
        <button
          type="button"
          onClick={onToggleDetails}
          className="orders-btn orders-btn-primary"
        >
          {isSelected ? "Hide Details" : "View Details"}
        </button>

        {!isCancelled && !isArchived && (
          <button
            type="button"
            onClick={() => setShowCancelForm((v) => !v)}
            className="orders-btn orders-btn-danger"
          >
            {showCancelForm ? "Hide Cancel" : "Cancel Order"}
          </button>
        )}

        {(isCancelled || order.paymentStatus === "PAID") && !isArchived && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Archive this order for "${order.itemName}"?`)) {
                onArchiveOrder(order.id);
              }
            }}
            className="orders-btn orders-btn-ghost"
          >
            Archive Order
          </button>
        )}

        {isArchived && (
          <button
            type="button"
            onClick={() => onRestoreOrder(order.id)}
            className="orders-btn orders-btn-success"
          >
            Restore Order
          </button>
        )}
      </div>

      {/* ── INLINE CANCELLATION FORM ── */}
      {showCancelForm && (
        <div className="orders-cancel-dialog">
          <h4>Cancel Order #{order.id} — {order.itemName}</h4>
          <p>
            Cancelling this order stops production milestones while safely preserving
            all financial transaction records.
          </p>
          <textarea
            placeholder="Enter reason for cancelling this order (e.g., Customer requested change, duplicate order)..."
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelError) setCancelError("");
            }}
            rows={3}
            className={`orders-textarea ${cancelError ? "input-error" : ""}`}
          />
          {cancelError && <div className="error-message">{cancelError}</div>}
          <div className="orders-dialog-actions">
            <button
              type="button"
              onClick={handleSubmitCancel}
              className="orders-btn orders-btn-danger"
            >
              Confirm Cancellation
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason("");
                setCancelError("");
              }}
              className="orders-btn orders-btn-ghost"
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── 6-SECTION EXPANDED ORDER DETAILS ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isSelected && (
        <div className="order-details-panel">
          {/* SECTION 1: CUSTOMER DETAILS */}
          <section className="order-detail-section" aria-label="Customer Details">
            <div className="order-section-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h4>1. Customer Details</h4>
            </div>
            <div className="order-detail-grid">
              <div className="order-detail-item">
                <span className="order-detail-label">Customer Name</span>
                <strong className="order-detail-value">{order.customer?.name}</strong>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Phone Number</span>
                <strong className="order-detail-value">
                  <a href={`tel:${order.customer?.phone}`} style={{ color: "#0284c7", textDecoration: "none" }}>
                    {order.customer?.phone}
                  </a>
                </strong>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Email</span>
                <strong className="order-detail-value">
                  {order.customer?.email || "Not provided"}
                </strong>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Account Status</span>
                <strong className="order-detail-value">
                  {order.customer?.isArchived ? "Archived Client" : "Active Client"}
                </strong>
              </div>
            </div>
          </section>

          {/* SECTION 2: ORDER INFORMATION */}
          <section className="order-detail-section" aria-label="Order Information">
            <div className="order-section-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <h4>2. Order Information</h4>
            </div>
            <div className="order-detail-grid">
              <div className="order-detail-item">
                <span className="order-detail-label">Order Reference</span>
                <strong className="order-detail-value">Order #{order.id}</strong>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Order Date</span>
                <strong className="order-detail-value">
                  {formatOrderDate(order.createdAt)}
                </strong>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Promised Delivery Date</span>
                <strong className="order-detail-value">
                  {formatOrderDate(order.promisedDate)}
                </strong>
              </div>
              <div className="order-detail-item">
                <span className="order-detail-label">Current Status</span>
                <strong className="order-detail-value">
                  {isCancelled ? "Cancelled" : "Active Production"}
                </strong>
              </div>
            </div>
          </section>

          {/* SECTION 3: ITEM & SERVICE DETAILS */}
          <section className="order-detail-section" aria-label="Item and Service Details">
            <div className="order-section-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <h4>3. Item & Service Details</h4>
            </div>
            <div className="order-item-desc-box">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <span className="order-detail-label">Item / Garment</span>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", marginTop: "2px" }}>
                    {order.itemName}
                  </div>
                </div>
                <div style={{ fontSize: "13px", color: "#64748b" }}>
                  Bespoke tailored boutique order
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: PAYMENT SUMMARY */}
          <section className="order-detail-section" aria-label="Payment Summary">
            <div className="order-section-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                <line x1="1" y1="10" x2="23" y2="10" />
              </svg>
              <h4>4. Payment Summary</h4>
            </div>

            {/* Financial 4-Stat Cards */}
            <div className="order-payment-metrics">
              <div className="order-pay-card">
                <span>Total Amount</span>
                <strong>{inr(order.totalAmount)}</strong>
              </div>
              <div className="order-pay-card">
                <span>Advance Paid</span>
                <strong style={{ color: "#166534" }}>{inr(order.advance)}</strong>
              </div>
              <div className="order-pay-card">
                <span>Remaining Balance</span>
                <strong style={{ color: order.balance > 0 ? "#b91c1c" : "#166534" }}>
                  {inr(order.balance)}
                </strong>
              </div>
              <div className="order-pay-card">
                <span>Payment Status</span>
                <strong style={{ color: order.paymentStatus === "PAID" ? "#166534" : "#b45309" }}>
                  {order.paymentStatus}
                </strong>
              </div>
            </div>

            {/* Record Cash Payment Form */}
            {!isCancelled && !isArchived && (
              <div style={{ marginTop: "16px" }}>
                <h5 style={{ margin: "0 0 10px", fontSize: "14px", color: "#1e293b", fontWeight: 700 }}>
                  Record Cash Payment
                </h5>
                <ManualPaymentForm
                  orderId={order.id}
                  balance={order.balance}
                  amount={paymentInput.amount}
                  type={paymentInput.type}
                  error={paymentError}
                  success={paymentSuccess}
                  submitting={isSubmittingPayment}
                  onAmountChange={onPaymentAmountChange}
                  onTypeChange={onPaymentTypeChange}
                  onSubmit={onRecordPayment}
                  onReconcile={onReconcile}
                />
              </div>
            )}

            {/* Payment History List */}
            <div style={{ marginTop: "20px" }}>
              <h5 style={{ margin: "0 0 10px", fontSize: "14px", color: "#1e293b", fontWeight: 700 }}>
                Payment History
              </h5>
              {orderPayments.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  No payments recorded yet.
                </p>
              ) : (
                <div className="orders-payment-history-list">
                  {orderPayments.map((p) => (
                    <div key={p.id} className="orders-payment-item">
                      <div className="orders-pay-info">
                        <strong>{inr(p.amount)}</strong>
                        <span className="orders-pay-type">({p.paymentType})</span>
                        <span
                          className={`orders-badge ${
                            p.status === "COMPLETED" || p.status === "CAPTURED"
                              ? "badge-paid"
                              : p.status === "CANCELLED" || p.status === "FAILED"
                              ? "badge-cancelled"
                              : "badge-partial"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div className="orders-pay-actions">
                        <span className="orders-pay-date">
                          {formatOrderDate(p.createdAt)}
                        </span>
                        {p.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Are you sure you want to cancel this payment of ${inr(p.amount)}?`
                                )
                              ) {
                                onCancelPayment?.(order.id, p.id);
                              }
                            }}
                            className="orders-btn orders-btn-danger"
                            style={{ padding: "3px 8px", fontSize: "11px" }}
                          >
                            Cancel Payment
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 5: PRODUCTION PROGRESS & TRACKER */}
          <section className="order-detail-section" aria-label="Production Stages">
            <div className="order-section-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h4>5. Production Stages</h4>
            </div>

            {/* Five-Stage Production Tracker */}
            <div className="production-tracker" role="region" aria-label="Production stages timeline">
              {orderStages.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
                  No production stages assigned to this order.
                </p>
              ) : (
                <div className="tracker-stages-list">
                  {orderStages.map((stage, index) => {
                    const isCompleted = stage.status === "COMPLETED";
                    const isInProgress = stage.status === "IN_PROGRESS";
                    const isPending = stage.status === "PENDING";

                    return (
                      <div
                        key={stage.id}
                        className={`tracker-stage-card ${
                          isCompleted
                            ? "stage-done"
                            : isInProgress
                            ? "stage-active"
                            : "stage-pending"
                        }`}
                      >
                        <div className="stage-card-header">
                          <div className="stage-node-indicator">
                            {isCompleted ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </div>
                          <span className="stage-card-name">{stage.name}</span>
                          <span
                            className={`orders-badge ${
                              isCompleted
                                ? "badge-paid"
                                : isInProgress
                                ? "badge-inprogress"
                                : "badge-archived"
                            }`}
                            style={{ marginLeft: "auto" }}
                          >
                            {stage.status}
                          </span>
                        </div>

                        {/* Controls: select dropdown and quick advance button */}
                        {!isCancelled && (
                          <div className="stage-controls-wrap">
                            <select
                              value={stage.status}
                              onChange={(e) =>
                                onUpdateStageStatus(stage.id, e.target.value)
                              }
                              disabled={isUpdatingStage}
                              className="stage-status-select"
                              aria-label={`Status for ${stage.name}`}
                            >
                              <option value="PENDING">Pending</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="COMPLETED">Completed</option>
                            </select>

                            {/* Quick advance button */}
                            {isPending && (
                              <button
                                type="button"
                                disabled={isUpdatingStage}
                                onClick={() =>
                                  onUpdateStageStatus(stage.id, "IN_PROGRESS")
                                }
                                className="orders-btn orders-btn-primary stage-quick-btn"
                              >
                                Start Stage
                              </button>
                            )}

                            {isInProgress && (
                              <button
                                type="button"
                                disabled={isUpdatingStage}
                                onClick={() =>
                                  onUpdateStageStatus(stage.id, "COMPLETED")
                                }
                                className="orders-btn orders-btn-success stage-quick-btn"
                              >
                                Mark Completed
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 6: CUSTOMER TRACKING LINK & ORDER AUDIT */}
          <section className="order-detail-section" aria-label="Customer Tracking Link">
            <div className="order-section-head">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <h4>6. Customer Public Tracking Link</h4>
            </div>

            <div className="tracking-link-box">
              <p className="tracking-link-desc">
                Share this secure tracking link with the customer to allow them to view live
                tailoring milestones and pay their advance or remaining balance online.
              </p>
              <div className="tracking-input-row">
                <input
                  type="text"
                  value={`${window.location.origin}/track/${order.publicToken}`}
                  readOnly
                  className="tracking-url-input"
                />
                <button
                  type="button"
                  onClick={handleCopyTrackingLink}
                  className="orders-btn orders-btn-primary"
                >
                  {copiedLink ? "✓ Copied!" : "Copy Link"}
                </button>
                <a
                  href={`/track/${order.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="orders-btn orders-btn-ghost"
                  style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                >
                  Open Page ↗
                </a>
              </div>
            </div>
          </section>
        </div>
      )}
    </article>
  );
}
