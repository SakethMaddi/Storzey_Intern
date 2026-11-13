import { useState } from "react";
import type { Order, Payment, OrderStage } from "../../../types";
import { ManualPaymentForm } from "../../payments/components/ManualPaymentForm";
import { capitalizeFirstLetter } from "../../../validation";
import {
  inr,
  formatOrderDate,
  getOrderProductionStatus,
} from "../order-utils";
import {
  buildInvoiceHtml,
  buildReceiptHtml,
  openPrintableDocument,
  trackingShareMessage,
  whatsAppShareUrl,
} from "../../documents/order-documents";

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
  const isArchived = Boolean(order.isArchived);

  // Cancellation form state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [documentNotice, setDocumentNotice] = useState("");

  const amountPaid = Math.max(0, order.totalAmount - order.balance);
  const paidPercentage = Math.min(
    100,
    Math.max(0, Math.round((amountPaid / order.totalAmount) * 100))
  );

  const prodStatus = getOrderProductionStatus(order, orderStages);

  const ownerDocumentOrder = {
    id: order.id,
    itemName: order.itemName,
    totalAmount: order.totalAmount,
    balance: order.balance,
    paymentStatus: order.paymentStatus,
    status: order.status,
    promisedDate: order.promisedDate,
    createdAt: order.createdAt,
    customerName: order.customer?.name || "Customer",
    customerPhone: order.customer?.phone,
    boutiqueName: "Advance Pay",
  };

  const downloadOwnerDocument = (html: string | null) => {
    if (!html || !openPrintableDocument(html)) {
      setDocumentNotice("Allow pop-ups to save this document as a PDF.");
      return;
    }
    setDocumentNotice("Choose Save as PDF in the print dialog.");
  };

  const handleSubmitCancel = () => {
    const trimmed = capitalizeFirstLetter(cancelReason.trim());
    if (!trimmed) {
      setCancelError("Please enter a cancellation reason (required).");
      return;
    }
    if (trimmed.length < 3) {
      setCancelError("Cancellation reason must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 500) {
      setCancelError("Cancellation reason cannot exceed 500 characters.");
      return;
    }
    onCancelOrder(order.id, trimmed);
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
      id={`order-card-${order.id}`}
      className={`boutique-order-card ${isSelected ? "is-selected" : ""}`}
      aria-label={`Order #${order.id}: ${order.itemName}`}
    >
      {/* ── CARD HEADER ── */}
      <div className="card-top-row">
        <div className="card-id-name">
          <span className="order-num-pill">#{order.id}</span>
          <div>
            <h3 className="card-customer-title">{order.customer?.name || "Customer"}</h3>
            <span className="card-item-tag">{order.itemName}</span>
          </div>
        </div>

        <div className="card-badges-row">
          <span className={`status-badge ${isCancelled ? "badge-cancelled" : prodStatus.badgeClass}`}>
            {isCancelled ? "Cancelled" : prodStatus.label}
          </span>
          <span
            className={`status-badge ${
              order.paymentStatus === "PAID"
                ? "badge-paid"
                : order.paymentStatus === "PARTIALLY_PAID"
                ? "badge-partial"
                : "badge-pending"
            }`}
          >
            {order.paymentStatus === "PAID"
              ? "Paid"
              : order.paymentStatus === "PARTIALLY_PAID"
              ? "Partial"
              : "Pending"}
          </span>
          {isArchived && <span className="status-badge badge-archived">Archived</span>}
        </div>
      </div>

      {/* ── FINANCIAL & DATE ROW ── */}
      <div className="card-metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Total</span>
          <strong className="metric-value">{inr(order.totalAmount)}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-label">Paid</span>
          <strong className="metric-value metric-paid">{inr(amountPaid)}</strong>
        </div>
        <div className="metric-box">
          <span className="metric-label">Balance Due</span>
          <strong className={`metric-value ${order.balance > 0 ? "metric-balance" : "metric-settled"}`}>
            {inr(order.balance)}
          </strong>
        </div>
      </div>

      {/* ── MICRO PROGRESS BAR & DATES ── */}
      <div className="card-progress-section">
        <div className="micro-progress-track">
          <div
            className="micro-progress-fill"
            style={{ width: `${paidPercentage}%` }}
          />
        </div>
        <div className="card-dates-row">
          <span className="card-date-item">
            Ordered: {formatOrderDate(order.createdAt)}
          </span>
          {order.promisedDate && (
            <span className="card-date-item delivery">
              Delivery: {formatOrderDate(order.promisedDate)}
            </span>
          )}
        </div>
      </div>

      {/* ── CANCELLATION NOTICE BANNER ── */}
      {isCancelled && order.cancellationReason && (
        <div className="order-cancel-alert" role="alert">
          <strong>Cancelled:</strong> {order.cancellationReason}
          {order.cancelledAt && (
            <span className="cancel-subtext">
              ({new Date(order.cancelledAt).toLocaleDateString("en-IN")})
            </span>
          )}
        </div>
      )}

      {/* ── QUICK ACTIONS BAR ── */}
      <div className="card-actions-bar">
        <button
          type="button"
          onClick={onToggleDetails}
          className="btn-action-view"
        >
          {isSelected ? "Hide Details" : "View Order"}
        </button>

        {!isCancelled && !isArchived && (
          <button
            type="button"
            onClick={() => setShowCancelForm((v) => !v)}
            className="btn-action-ghost-danger"
          >
            {showCancelForm ? "Cancel" : "Cancel Order"}
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
            className="btn-action-ghost"
          >
            Archive
          </button>
        )}

        {isArchived && (
          <button
            type="button"
            onClick={() => onRestoreOrder(order.id)}
            className="btn-action-ghost-success"
          >
            Restore
          </button>
        )}
      </div>

      {/* ── CANCELLATION DIALOG ── */}
      {showCancelForm && (
        <div className="cancel-form-box">
          <h4>Cancel Order #{order.id}</h4>
          <p>Production stages will be frozen. Ledger history is preserved.</p>
          <textarea
            placeholder="Reason for cancellation (required)..."
            value={cancelReason}
            maxLength={500}
            onChange={(e) => {
              setCancelReason(capitalizeFirstLetter(e.target.value));
              if (cancelError) setCancelError("");
            }}
            rows={2}
            className={`text-area ${cancelError ? "has-error" : ""}`}
          />
          {cancelError && <div className="field-error-msg">{cancelError}</div>}
          <div className="cancel-form-actions">
            <button
              type="button"
              onClick={handleSubmitCancel}
              className="btn-danger-sm"
            >
              Confirm Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCancelForm(false);
                setCancelReason("");
                setCancelError("");
              }}
              className="btn-ghost-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── PROGRESSIVE DISCLOSURE: ORDER DETAILS PANEL ── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isSelected && (
        <div className="order-details-expanded">
          {/* Section 1: Customer & Delivery Info */}
          <div className="detail-panel-section">
            <div className="detail-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <h4>Customer & Delivery</h4>
            </div>
            <div className="detail-data-grid">
              <div className="data-item">
                <span className="data-label">Customer</span>
                <strong className="data-value">{order.customer?.name || "—"}</strong>
              </div>
              <div className="data-item">
                <span className="data-label">Phone</span>
                <strong className="data-value">
                  {order.customer?.phone ? (
                    <a href={`tel:${order.customer.phone}`} className="link-phone">
                      {order.customer.phone}
                    </a>
                  ) : "—"}
                </strong>
              </div>
              <div className="data-item">
                <span className="data-label">Email</span>
                <strong className="data-value">{order.customer?.email || "—"}</strong>
              </div>
              <div className="data-item">
                <span className="data-label">Delivery Date</span>
                <strong className="data-value delivery-highlight">
                  {formatOrderDate(order.promisedDate)}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 2: Production Stages Timeline */}
          <div className="detail-panel-section">
            <div className="detail-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h4>Production Stages</h4>
            </div>

            {orderStages.length === 0 ? (
              <p className="detail-empty-text">No custom production stages recorded.</p>
            ) : (
              <div className="timeline-stages-list">
                {orderStages.map((stage, index) => {
                  const isDone = stage.status === "COMPLETED";
                  const isCurrent = stage.status === "IN_PROGRESS";

                  return (
                    <div
                      key={stage.id}
                      className={`timeline-stage-row ${
                        isDone ? "is-done" : isCurrent ? "is-current" : "is-pending"
                      }`}
                    >
                      <div className="stage-step-dot">
                        {isDone ? "✓" : index + 1}
                      </div>
                      <div className="stage-info-wrap">
                        <span className="stage-name">{stage.name}</span>
                        <span className={`status-badge-sm ${
                          isDone ? "badge-paid" : isCurrent ? "badge-partial" : "badge-pending"
                        }`}>
                          {stage.status.replace("_", " ")}
                        </span>
                      </div>

                      {!isCancelled && (
                        <div className="stage-actions-wrap">
                          <select
                            value={stage.status}
                            onChange={(e) => onUpdateStageStatus(stage.id, e.target.value)}
                            disabled={isUpdatingStage}
                            className="select-field-sm"
                            aria-label={`Update stage ${stage.name}`}
                          >
                            <option value="PENDING">Pending</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="COMPLETED">Completed</option>
                          </select>

                          {stage.status === "PENDING" && (
                            <button
                              type="button"
                              disabled={isUpdatingStage}
                              onClick={() => onUpdateStageStatus(stage.id, "IN_PROGRESS")}
                              className="btn-quick-stage"
                            >
                              Start
                            </button>
                          )}
                          {stage.status === "IN_PROGRESS" && (
                            <button
                              type="button"
                              disabled={isUpdatingStage}
                              onClick={() => onUpdateStageStatus(stage.id, "COMPLETED")}
                              className="btn-quick-stage-done"
                            >
                              Done ✓
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

          {/* Section 3: Payment Summary & Ledger */}
          <div className="detail-panel-section">
            <div className="detail-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
              <h4>Payment Ledger & Documents</h4>
              <div className="doc-btns-group">
                <button
                  type="button"
                  className="btn-doc-download"
                  onClick={() => downloadOwnerDocument(buildInvoiceHtml(ownerDocumentOrder, orderPayments))}
                >
                  Invoice 📄
                </button>
              </div>
            </div>

            {documentNotice && <p className="doc-notice-banner">{documentNotice}</p>}

            <div className="financial-ledger-cards">
              <div className="ledger-card">
                <span>Agreed Advance</span>
                <strong>{inr(order.advance)}</strong>
              </div>
              <div className="ledger-card">
                <span>Amount Paid</span>
                <strong className="text-paid">{inr(amountPaid)}</strong>
              </div>
              <div className="ledger-card">
                <span>Balance Due</span>
                <strong className={order.balance > 0 ? "text-balance" : "text-paid"}>
                  {inr(order.balance)}
                </strong>
              </div>
            </div>

            {/* Guided Manual Cash Payment Form */}
            {!isCancelled && !isArchived && order.balance > 0 && (
              <div className="record-payment-subpanel">
                <h5 className="subpanel-title">Record Payment</h5>
                <ManualPaymentForm
                  orderId={order.id}
                  orderLabel={`#${order.id} · ${order.itemName}`}
                  customerName={order.customer?.name}
                  totalAmount={order.totalAmount}
                  balance={order.balance}
                  remainingAdvance={Math.max(
                    0,
                    order.advance -
                      orderPayments
                        .filter(
                          (payment) =>
                            payment.paymentType === "ADVANCE" &&
                            (payment.status === "COMPLETED" || payment.status === "CAPTURED")
                        )
                        .reduce((sum, payment) => sum + payment.amount, 0)
                  )}
                  amount={paymentInput.amount}
                  type={paymentInput.type}
                  error={paymentError}
                  success={paymentSuccess}
                  submitting={isSubmittingPayment}
                  onAmountChange={onPaymentAmountChange}
                  onTypeChange={onPaymentTypeChange}
                  onSubmit={onRecordPayment}
                  onReconcile={onReconcile}
                  onDownloadReceipt={() => {
                    const verified = orderPayments.find(
                      (p) => p.status === "COMPLETED" || p.status === "CAPTURED"
                    );
                    const html = verified
                      ? buildReceiptHtml(ownerDocumentOrder, verified, orderPayments)
                      : null;
                    if (!html) {
                      setDocumentNotice("A receipt is available once payment is verified as completed.");
                      return;
                    }
                    downloadOwnerDocument(html);
                  }}
                />
              </div>
            )}

            {/* Payment Transactions History */}
            <div className="history-subpanel">
              <h5 className="subpanel-title">Transaction History</h5>
              {orderPayments.length === 0 ? (
                <p className="detail-empty-text">No payment records saved for this order yet.</p>
              ) : (
                <div className="history-list">
                  {orderPayments.map((p) => {
                    const isSuccessful = p.status === "COMPLETED" || p.status === "CAPTURED";
                    return (
                      <div key={p.id} className="history-item-row">
                        <div className="history-main">
                          <strong className="history-amount">{inr(p.amount)}</strong>
                          <span className="history-type">({p.paymentType})</span>
                          <span className={`status-badge-sm ${
                            isSuccessful ? "badge-paid" : p.status === "CANCELLED" ? "badge-cancelled" : "badge-pending"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="history-actions">
                          <span className="history-date">{formatOrderDate(p.createdAt)}</span>
                          {isSuccessful && (
                            <button
                              type="button"
                              className="btn-receipt-sm"
                              onClick={() => downloadOwnerDocument(buildReceiptHtml(ownerDocumentOrder, p, orderPayments))}
                            >
                              Receipt
                            </button>
                          )}
                          {p.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Cancel this payment of ${inr(p.amount)}?`)) {
                                  onCancelPayment?.(order.id, p.id);
                                }
                              }}
                              className="btn-cancel-sm"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Customer Live Tracking Share Link */}
          <div className="detail-panel-section">
            <div className="detail-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <h4>Customer Tracking Link</h4>
            </div>
            <p className="tracking-help-text">
              Share this live link with the customer to view tailoring progress and pay their balance securely online.
            </p>
            <div className="tracking-row">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/track/${order.publicToken}`}
                className="tracking-input"
                aria-label="Customer public tracking link"
              />
              <div className="tracking-buttons">
                <button
                  type="button"
                  onClick={handleCopyTrackingLink}
                  className="btn-copy-link"
                >
                  {copiedLink ? "✓ Copied" : "Copy"}
                </button>
                <a
                  href={whatsAppShareUrl(trackingShareMessage({
                    boutiqueName: "Advance Pay",
                    orderId: order.id,
                    customerName: order.customer?.name || "Customer",
                    paymentStatus: order.paymentStatus,
                    balance: order.balance,
                    url: `${window.location.origin}/track/${order.publicToken}`,
                  }))}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-whatsapp-share"
                >
                  WhatsApp
                </a>
                <a
                  href={`/track/${order.publicToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-preview-link"
                >
                  Open ↗
                </a>
              </div>
            </div>
          </div>

          {/* Close Panel Button */}
          <div className="detail-footer-close">
            <button
              type="button"
              onClick={onToggleDetails}
              className="btn-ghost-full"
            >
              Close Details ↑
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
