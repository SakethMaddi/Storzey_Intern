import { useState } from "react";
import type { Order, Payment, OrderStage } from "../../../types";
import { ManualPaymentForm } from "../../payments/components/ManualPaymentForm";

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
  const amountPaid = order.totalAmount - order.balance;
  const paidPercentage = Math.min(
    100,
    Math.max(0, Math.round((amountPaid / order.totalAmount) * 100))
  );

  const isCancelled = order.status === "CANCELLED";
  const isArchived = !!order.isArchived;

  // Inline cancellation form state
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");

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

  return (
    <article className="order-card" aria-label={`Order ${order.id}: ${order.itemName}`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
        <h3 style={{ margin: 0, fontSize: "18px" }}>
          {order.customer?.name} — {order.itemName}
          {isCancelled && (
            <span
              style={{
                marginLeft: 10,
                fontSize: 12,
                fontWeight: 700,
                background: "#fef2f2",
                color: "#b91c1c",
                borderRadius: 4,
                padding: "2px 8px",
                border: "1px solid #fecaca",
              }}
            >
              CANCELLED
            </span>
          )}
          {isArchived && (
            <span
              style={{
                marginLeft: 10,
                fontSize: 12,
                fontWeight: 700,
                background: "#e2e8f0",
                color: "#475569",
                borderRadius: 4,
                padding: "2px 8px",
              }}
            >
              ARCHIVED
            </span>
          )}
        </h3>

        <div style={{ fontSize: "13px", color: "#64748b", fontWeight: 600 }}>
          Order #{order.id}
        </div>
      </div>

      {/* Prominent High-Level Status Summary (Visible without expanding) */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          flexWrap: "wrap",
          fontSize: "13px",
          margin: "10px 0 12px",
          padding: "8px 12px",
          background: "#f8fafc",
          borderRadius: "6px",
          border: "1px solid #e2e8f0",
          color: "#334155",
        }}
      >
        <div>
          <span style={{ color: "#64748b" }}>Total: </span>
          <strong>₹{order.totalAmount.toLocaleString("en-IN")}</strong>
        </div>
        <div>
          <span style={{ color: "#64748b" }}>Balance: </span>
          <strong style={{ color: order.balance > 0 ? "#b91c1c" : "#166534" }}>
            ₹{order.balance.toLocaleString("en-IN")}
          </strong>
        </div>
        <div>
          <span style={{ color: "#64748b" }}>Payment: </span>
          <span
            style={{
              fontWeight: 600,
              color:
                order.paymentStatus === "PAID"
                  ? "#166534"
                  : order.paymentStatus === "PARTIALLY_PAID"
                  ? "#b45309"
                  : "#b91c1c",
            }}
          >
            {order.paymentStatus}
          </span>
        </div>
        {order.promisedDate && (
          <div>
            <span style={{ color: "#64748b" }}>Promised Delivery: </span>
            <strong>
              {new Date(order.promisedDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </div>
        )}
      </div>

      {/* Cancellation Reason Notice */}
      {isCancelled && order.cancellationReason && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 12,
            fontSize: "13px",
            color: "#b91c1c",
          }}
        >
          <strong>Cancellation Reason:</strong> {order.cancellationReason}
          {order.cancelledAt && (
            <span style={{ display: "block", fontSize: "11px", color: "#991b1b", marginTop: "2px" }}>
              Cancelled on {new Date(order.cancelledAt).toLocaleString("en-IN")}
            </span>
          )}
        </div>
      )}

      {/* Actions Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          type="button"
          onClick={onToggleDetails}
          style={{
            background: isSelected ? "#475569" : "#2563eb",
            padding: "8px 14px",
            fontSize: "14px",
            borderRadius: "8px",
          }}
        >
          {isSelected ? "Hide Details" : "View Details"}
        </button>

        {/* Cancel button — only for non-cancelled, non-archived orders */}
        {!isCancelled && !isArchived && (
          <button
            type="button"
            onClick={() => setShowCancelForm((v) => !v)}
            style={{
              background: "#ef4444",
              padding: "8px 14px",
              fontSize: "14px",
              borderRadius: "8px",
            }}
          >
            {showCancelForm ? "Hide Cancel" : "Cancel Order"}
          </button>
        )}

        {/* Archive button — for cancelled or paid orders that aren't archived yet */}
        {(isCancelled || order.paymentStatus === "PAID") && !isArchived && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Archive this order for "${order.itemName}"?`)) {
                onArchiveOrder(order.id);
              }
            }}
            style={{
              background: "#64748b",
              padding: "8px 14px",
              fontSize: "14px",
              borderRadius: "8px",
            }}
          >
            Archive Order
          </button>
        )}

        {/* Restore button for archived orders */}
        {isArchived && (
          <button
            type="button"
            onClick={() => onRestoreOrder(order.id)}
            style={{
              background: "#059669",
              padding: "8px 14px",
              fontSize: "14px",
              borderRadius: "8px",
            }}
          >
            Restore Order
          </button>
        )}
      </div>

      {/* Inline Cancellation Form */}
      {showCancelForm && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: 8,
            padding: 14,
            marginBottom: 14,
          }}
        >
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#b91c1c", fontSize: "14px" }}>
            Cancel Order #{order.id} — {order.itemName}
          </p>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#7f1d1d" }}>
            Cancelling this order preserves all historical customer data and payment records, but stops all further production and marks the order as cancelled.
          </p>
          <textarea
            placeholder="Enter reason for cancelling this order (e.g., Customer requested change, duplicate order)..."
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              if (cancelError) setCancelError("");
            }}
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: cancelError ? "1px solid #ef4444" : "1px solid #fca5a5",
              borderRadius: 8,
              fontSize: 14,
              background: "#fff",
              resize: "vertical",
              marginBottom: 8,
              boxSizing: "border-box",
            }}
          />
          {cancelError && (
            <div style={{ color: "#dc2626", fontSize: "12px", marginBottom: "8px" }}>
              {cancelError}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={handleSubmitCancel}
              style={{ background: "#dc2626", padding: "8px 16px", fontSize: "13px", fontWeight: 600 }}
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
              style={{
                background: "#f1f5f9",
                color: "#334155",
                border: "1px solid #cbd5e1",
                padding: "8px 16px",
                fontSize: "13px",
              }}
            >
              Go Back
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div>
        <progress value={amountPaid} max={order.totalAmount} />
        <p style={{ fontSize: "12px", color: "#64748b", margin: "4px 0 0" }}>
          {paidPercentage}% Paid ({amountPaid >= order.totalAmount ? "Fully Paid" : `₹${order.balance.toLocaleString("en-IN")} Remaining`})
        </p>
      </div>

      {/* Expanded Details Section */}
      {isSelected && (
        <div style={{ marginTop: 16, borderTop: "1px solid #e2e8f0", paddingTop: 16 }}>
          <p>
            <strong>Customer:</strong> {order.customer?.name} ({order.customer?.phone})
          </p>
          <p>
            <strong>Advance Paid:</strong> ₹{order.advance.toLocaleString("en-IN")}
          </p>
          <p>
            <strong>Outstanding Balance:</strong>{" "}
            <span style={{ color: order.balance > 0 ? "#b91c1c" : "#166534", fontWeight: 700 }}>
              ₹{order.balance.toLocaleString("en-IN")}
            </span>
          </p>

          {/* Customer Public Tracking URL */}
          <div style={{ margin: "16px 0", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "13px", color: "#1e293b" }}>
              Customer Public Tracking Link:
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                value={`${window.location.origin}/track/${order.publicToken}`}
                readOnly
                style={{ flex: 1, minWidth: "220px", fontSize: "12px", margin: 0 }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/track/${order.publicToken}`
                  );
                  alert("Tracking link copied to clipboard!");
                }}
                style={{ padding: "8px 14px", fontSize: "13px", background: "#0284c7" }}
              >
                Copy Link
              </button>
              <a
                href={`/track/${order.publicToken}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 14px",
                  fontSize: "13px",
                  background: "#e2e8f0",
                  color: "#1e293b",
                  borderRadius: "8px",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                Open Page ↗
              </a>
            </div>
          </div>

          {/* Record Cash Payment Form */}
          {!isCancelled && !isArchived && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ margin: "0 0 10px", fontSize: "15px", color: "#1e293b" }}>
                Record Cash Payment
              </h4>
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

          {/* Payment History */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "15px", color: "#1e293b" }}>
              Payment History
            </h4>
            {orderPayments.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748b" }}>No payments recorded yet.</p>
            ) : (
              orderPayments.map((p) => (
                <div
                  key={p.id}
                  style={{
                    padding: "8px 12px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    marginBottom: "6px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <strong>₹{p.amount.toLocaleString("en-IN")}</strong> ({p.paymentType})
                    <span
                      style={{
                        marginLeft: 8,
                        fontSize: 11,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background:
                          p.status === "COMPLETED" || p.status === "CAPTURED"
                            ? "#dcfce7"
                            : p.status === "CANCELLED"
                            ? "#fee2e2"
                            : p.status === "FAILED"
                            ? "#fee2e2"
                            : "#fef3c7",
                        color:
                          p.status === "COMPLETED" || p.status === "CAPTURED"
                            ? "#166534"
                            : p.status === "CANCELLED"
                            ? "#991b1b"
                            : p.status === "FAILED"
                            ? "#991b1b"
                            : "#92400e",
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>
                      {new Date(p.createdAt).toLocaleDateString("en-IN")}
                    </span>
                    {p.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Are you sure you want to cancel this payment of ₹${p.amount.toLocaleString("en-IN")}?`
                            )
                          ) {
                            onCancelPayment?.(order.id, p.id);
                          }
                        }}
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          border: "1px solid #fecaca",
                          padding: "3px 8px",
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel Payment
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Production Stages */}
          <div style={{ marginTop: 20 }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "15px", color: "#1e293b" }}>
              Production Stages
            </h4>
            {orderStages.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#64748b" }}>No stages defined.</p>
            ) : (
              orderStages.map((stage) => (
                <div
                  key={stage.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    marginBottom: "6px",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{stage.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background:
                          stage.status === "COMPLETED"
                            ? "#dcfce7"
                            : stage.status === "IN_PROGRESS"
                            ? "#eff6ff"
                            : "#f1f5f9",
                        color:
                          stage.status === "COMPLETED"
                            ? "#15803d"
                            : stage.status === "IN_PROGRESS"
                            ? "#1d4ed8"
                            : "#64748b",
                      }}
                    >
                      {stage.status}
                    </span>
                    {!isCancelled && (
                      <select
                        value={stage.status}
                        onChange={(e) => onUpdateStageStatus(stage.id, e.target.value)}
                        disabled={isUpdatingStage}
                        style={{
                          fontSize: "12px",
                          padding: "3px 6px",
                          width: "auto",
                          margin: 0,
                          borderRadius: "4px",
                        }}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}
