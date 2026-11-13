import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config";
import {
  buildRazorpayCheckoutOptions,
  type RazorpayCheckoutOptions,
} from "../razorpay-checkout";
import {
  inr,
  formatOrderDate,
  getOrderProductionStatus,
} from "../../orders/order-utils";
import type { Order, OrderStage, Payment } from "../../../types";

const API_URL = API_BASE_URL;

interface RazorpayFailureResponse {
  error?: {
    description?: string;
    reason?: string;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (
    event: "payment.failed",
    handler: (res: RazorpayFailureResponse) => void
  ) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

export interface PublicCustomerOrder extends Omit<Order, "customer"> {
  customer?: {
    name: string;
    phone?: string;
  } | null;
  owner?: {
    name: string;
    businessName: string | null;
  } | null;
  isGatewayConfigured?: boolean;
  advancePaid?: number;
  outstandingBalance?: number;
  stages?: OrderStage[];
  payments?: Payment[];
}

export function CustomerOrderPage({ token }: { token: string }) {
  const [order, setOrder] = useState<PublicCustomerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [now] = useState(() => Date.now());
  const payingRef = useRef(false);

  const fetchOrder = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/public/orders/${token}`
      );
      setOrder(response.data.data);
    } catch {
      setError("Order not found or tracking link has expired.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const response = await axios.get(
          `${API_URL}/api/public/orders/${token}`
        );
        if (!ignore) {
          setOrder(response.data.data);
        }
      } catch {
        if (!ignore) {
          setError("Order not found or tracking link has expired.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      ignore = true;
    };
  }, [token]);

  // Real Razorpay gateway payment flow
  const handleGatewayPayment = async (paymentType: "ADVANCE" | "BALANCE") => {
    if (payingRef.current) return;
    if (!order || (order.balance <= 0 && (order.outstandingBalance ?? 0) <= 0)) {
      setError("This order is already fully paid.");
      return;
    }

    try {
      payingRef.current = true;
      setPaying(true);
      setError("");
      setSuccessMessage("");

      // 1. Create Razorpay order on backend using secure public token
      const { data: orderRes } = await axios.post(
        `${API_URL}/api/public/orders/${token}/razorpay-order`,
        { paymentType }
      );

      const { razorpayOrderId, amount, currency, keyId } = orderRes.data;

      // 2. Open official Razorpay modal checkout
      if (typeof window.Razorpay === "undefined") {
        throw new Error(
          "Razorpay Checkout SDK not loaded. Check internet connection or refresh."
        );
      }

      let checkoutClosedAfterResult = false;
      const finishCheckout = () => {
        payingRef.current = false;
        setPaying(false);
      };

      const rzp = new window.Razorpay(
        buildRazorpayCheckoutOptions({
          keyId,
          amount,
          currency,
          description: `${paymentType} payment for ${order.itemName}`,
          orderId: razorpayOrderId,
          customerName: order.customer?.name || "",
          handler: async (response) => {
            checkoutClosedAfterResult = true;
            try {
              const verifyRes = await axios.post(
                `${API_URL}/payments/verify`,
                response
              );
              if (verifyRes.data?.success !== true) {
                setSuccessMessage("");
                setError(
                  verifyRes.data?.message ||
                    "Payment is not confirmed yet. The order was not marked as paid."
                );
              } else {
                setSuccessMessage(
                  verifyRes.data.message || "Payment verified and recorded successfully!"
                );
              }
              await fetchOrder();
            } catch (vErr: unknown) {
              const vErrObj = vErr as { response?: { data?: { message?: string } } };
              setSuccessMessage("");
              setError(
                vErrObj.response?.data?.message ||
                  "Payment verification failed on backend. The order was not marked as paid."
              );
              await fetchOrder();
            } finally {
              finishCheckout();
            }
          },
          onDismiss: () => {
            if (checkoutClosedAfterResult) {
              finishCheckout();
              return;
            }
            setSuccessMessage("");
            setError(
              "Checkout closed. If you approved the payment in your UPI app, this order updates only after Razorpay confirms it. Closing checkout does not mark the order as paid."
            );
            finishCheckout();
            void fetchOrder();
          },
        })
      );

      rzp.on("payment.failed", (failedRes: RazorpayFailureResponse) => {
        checkoutClosedAfterResult = true;
        const description = String(failedRes?.error?.description || "");
        const reason = String(failedRes?.error?.reason || "");
        const cancelled =
          reason === "payment_cancelled" || /cancel/i.test(description);
        setSuccessMessage("");
        setError(
          cancelled
            ? "Payment cancelled. The order was not marked as paid."
            : `Payment failed: ${description || "Transaction declined by gateway."} The order was not marked as paid.`
        );
        finishCheckout();
        void fetchOrder();
      });

      rzp.open();
    } catch (err: unknown) {
      const errObj = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const msg =
        errObj.response?.data?.message ||
        errObj.message ||
        "Gateway checkout failed.";
      setError(msg);
      payingRef.current = false;
      setPaying(false);
    }
  };

  // Demo fallback payment simulation
  const handleDemoPayment = async (paymentType: "ADVANCE" | "BALANCE") => {
    if (payingRef.current) return;

    if (!order || (order.balance <= 0 && (order.outstandingBalance ?? 0) <= 0)) {
      setError("This order is already fully paid.");
      return;
    }

    try {
      payingRef.current = true;
      setPaying(true);
      setError("");
      setSuccessMessage("");

      const choice = window.confirm(
        "DEMO PAYMENT SIMULATION (Test Mode)\n\nPress OK to simulate SUCCESSFUL payment.\nPress Cancel to simulate FAILED payment."
      );

      const response = await axios.post(
        `${API_URL}/api/public/orders/${token}/demo-payment`,
        {
          paymentType,
          outcome: choice ? "SUCCESS" : "FAILED",
        }
      );

      setSuccessMessage(
        response.data.message || "Demo payment simulation finished."
      );
      await fetchOrder();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setError(
        errObj.response?.data?.message || "Unable to process demo payment."
      );
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="customer-portal-root">
        <header className="customer-header-bar" role="banner">
          <div className="customer-header-inner">
            <div className="customer-brand-group">
              <span className="customer-brand-title">Advance Pay</span>
              <span className="customer-brand-badge">Order Tracking</span>
            </div>
          </div>
        </header>
        <div className="customer-portal-state-container">
          <div className="customer-state-card">
            <div className="customer-spinner" aria-hidden="true" />
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", color: "#1e3a8a" }}>
              Loading Your Order
            </h3>
            <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
              Retrieving live tailoring milestones and payment details...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (error && !order) {
    return (
      <div className="customer-portal-root">
        <header className="customer-header-bar" role="banner">
          <div className="customer-header-inner">
            <div className="customer-brand-group">
              <span className="customer-brand-title">Advance Pay</span>
              <span className="customer-brand-badge">Order Tracking</span>
            </div>
          </div>
        </header>
        <div className="customer-portal-state-container">
          <div className="customer-state-card">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#b91c1c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ margin: "0 auto 12px" }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#1e3a8a" }}>
              Tracking Link Unavailable
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#64748b", lineHeight: 1.5 }}>
              {error || "We could not find an order matching this tracking link. The link may have expired or is invalid."}
            </p>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8" }}>
              Please contact the boutique to request an updated public tracking link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // Authoritative financial calculations
  const successfulPayments = (order.payments || []).filter(
    (p) => p.status === "COMPLETED" || p.status === "CAPTURED"
  );
  const advancePaid = typeof order.advancePaid === "number"
    ? order.advancePaid
    : successfulPayments.reduce((sum: number, p) => sum + (p.amount || 0), 0);
  const outstandingBalance = typeof order.outstandingBalance === "number"
    ? order.outstandingBalance
    : Math.max(0, order.totalAmount - advancePaid);
  const isOrderCancelled = order.status === "CANCELLED";

  const advanceDue = Math.max((order.advance || 0) - advancePaid, 0);
  const isLinkExpired =
    Boolean(order.paymentLinkExpiresAt) &&
    new Date(order.paymentLinkExpiresAt as string).getTime() < now;

  const paidPercentage = Math.min(
    100,
    Math.max(0, Math.round((advancePaid / (order.totalAmount || 1)) * 100))
  );

  // Computes authoritative production stage tracker information
  const prodStatus = getOrderProductionStatus(order as unknown as Order, order.stages);
  const businessName = order.owner?.businessName || "Advance Pay Boutique";

  return (
    <div className="customer-portal-root">
      {/* ── A. POLISHED HEADER ── */}
      <header className="customer-header-bar" role="banner">
        <div className="customer-header-inner">
          <div className="customer-brand-group">
            <span className="customer-brand-title">{businessName}</span>
            <span className="customer-brand-badge">Order Tracking</span>
          </div>
          <div className="customer-header-status">
            <span className="customer-secure-badge" title="Official customer tracking portal">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Verified Tracking</span>
            </span>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="customer-main-container">
        {/* ── B. WELCOME SECTION ── */}
        <section className="customer-welcome-banner" aria-label="Customer Greeting">
          <div className="customer-welcome-text">
            <h1>Hello, {order.customer?.name || "Valued Customer"}!</h1>
            <p>
              Here is the real-time bespoke tailoring progress and payment summary for your order with {businessName}.
            </p>
          </div>
          <div className="customer-order-pill" aria-label={`Order reference ${order.id}`}>
            <span className="pill-label">Order Ref</span>
            <strong className="pill-id">#{order.id}</strong>
          </div>
        </section>

        {/* ── ALERTS: CANCELLATION / EXPIRY / MESSAGES ── */}
        {isOrderCancelled && (
          <div className="customer-notice-card customer-notice-cancelled" role="alert">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14.5px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span>Order Cancelled</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "13.5px", lineHeight: 1.4 }}>
              This custom tailoring order has been cancelled by the boutique.
              {order.cancellationReason && (
                <> Reason: <strong>{order.cancellationReason}</strong>.</>
              )}
            </p>
            {order.cancelledAt && (
              <span style={{ display: "block", marginTop: "4px", fontSize: "12px", opacity: 0.9 }}>
                Cancelled on {new Date(order.cancelledAt).toLocaleString("en-IN")}
              </span>
            )}
          </div>
        )}

        {!isOrderCancelled && isLinkExpired && outstandingBalance > 0 && (
          <div className="customer-notice-card customer-notice-expired" role="alert">
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14.5px" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>Payment Link Expired</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "13.5px", lineHeight: 1.4 }}>
              Online payments are no longer accepted through this link as it expired on{" "}
              {new Date(order.paymentLinkExpiresAt!).toLocaleString("en-IN")}. Please contact {businessName} to request a refreshed payment link.
            </p>
          </div>
        )}

        {error && <div className="api-error-banner" role="alert">{error}</div>}
        {successMessage && <div className="success-banner" role="status">{successMessage}</div>}

        {/* ── TWO-COLUMN BALANCED CONTENT GRID ── */}
        <div className="customer-content-grid">
          {/* ════ LEFT COLUMN: ORDER OVERVIEW & PRODUCTION PROGRESS ════ */}
          <div className="customer-col-main">
            {/* ── C. ORDER OVERVIEW CARD ── */}
            <section className="customer-card order-overview-card" aria-label="Order Overview">
              <div className="customer-card-header">
                <div className="card-header-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <h3>Order Overview</h3>
                </div>
                <span
                  className={`orders-badge ${
                    isOrderCancelled
                      ? "badge-cancelled"
                      : order.paymentStatus === "PAID"
                      ? "badge-paid"
                      : order.paymentStatus === "PARTIALLY_PAID"
                      ? "badge-partial"
                      : "badge-pending"
                  }`}
                >
                  {isOrderCancelled ? "Cancelled" : "Active Production"}
                </span>
              </div>

              <div className="customer-overview-grid">
                <div className="overview-item">
                  <span className="overview-label">Garment / Item</span>
                  <strong className="overview-value" style={{ color: "#1e3a8a", fontSize: "15px" }}>
                    {order.itemName}
                  </strong>
                </div>

                <div className="overview-item">
                  <span className="overview-label">Order Placed</span>
                  <strong className="overview-value">
                    {formatOrderDate(order.createdAt)}
                  </strong>
                </div>

                <div className="overview-item">
                  <span className="overview-label">Promised Delivery</span>
                  <strong className="overview-value delivery-highlight">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatOrderDate(order.promisedDate)}
                  </strong>
                </div>

                <div className="overview-item">
                  <span className="overview-label">Current Milestone</span>
                  <strong className="overview-value">
                    {prodStatus.label}
                  </strong>
                </div>
              </div>
            </section>

            {/* ── D. PRODUCTION PROGRESS TIMELINE CARD ── */}
            <section className="customer-card production-progress-card" aria-label="Production Progress Tracker">
              <div className="customer-card-header">
                <div className="card-header-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <h3>Production Milestones</h3>
                </div>
                <span className={`orders-badge ${prodStatus.badgeClass}`}>
                  {prodStatus.completedCount} of {prodStatus.totalStages} Completed
                </span>
              </div>

              <p className="card-desc">
                Follow each tailoring milestone as your custom garment moves from cutting to ready for collection.
              </p>

              <div className="customer-timeline" role="region" aria-label="Production stages timeline">
                {order.stages && order.stages.length > 0 ? (
                  order.stages.map((stage, index) => {
                    const isCompleted = stage.status === "COMPLETED";
                    const isInProgress = stage.status === "IN_PROGRESS";

                    return (
                      <div
                        key={stage.id}
                        className={`timeline-step ${
                          isCompleted
                            ? "is-completed"
                            : isInProgress
                            ? "is-active"
                            : "is-pending"
                        }`}
                      >
                        <div className="step-indicator" aria-hidden="true">
                          {isCompleted ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>

                        {index < (order.stages?.length ?? 0) - 1 && (
                          <div className="step-connector" aria-hidden="true" />
                        )}

                        <div className="step-content">
                          <div className="step-title-row">
                            <strong className="step-name">{stage.name}</strong>
                            <span
                              className={`step-badge ${
                                isCompleted
                                  ? "step-badge-done"
                                  : isInProgress
                                  ? "step-badge-active"
                                  : "step-badge-pending"
                              }`}
                            >
                              {isCompleted
                                ? "Completed"
                                : isInProgress
                                ? "In Progress"
                                : "Upcoming"}
                            </span>
                          </div>
                          <span className="step-desc">
                            {isCompleted
                              ? "Quality inspected and approved for the next stage."
                              : isInProgress
                              ? "Currently in work with our master tailoring team."
                              : "Scheduled in the boutique tailoring queue."}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ fontSize: "13px", color: "#64748b", margin: "10px 0" }}>
                    Standard boutique stages assigned.
                  </p>
                )}
              </div>
            </section>
          </div>

          {/* ════ RIGHT COLUMN: PAYMENT SUMMARY, ACTIONS & HISTORY ════ */}
          <div className="customer-col-side">
            {/* ── E. PAYMENT SUMMARY CARD ── */}
            <section className="customer-card payment-summary-card" aria-label="Payment Summary">
              <div className="customer-card-header">
                <div className="card-header-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                  <h3>Payment Summary</h3>
                </div>
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
                    : "Pending"}
                </span>
              </div>

              {/* 3-Stat Metric Row */}
              <div className="customer-financial-metrics">
                <div className="fin-metric-cell">
                  <span className="fin-label">Total Amount</span>
                  <strong className="fin-val">{inr(order.totalAmount)}</strong>
                </div>

                <div className="fin-metric-cell">
                  <span className="fin-label">Advance Paid</span>
                  <strong className="fin-val fin-val-paid">{inr(advancePaid)}</strong>
                </div>

                <div className="fin-metric-cell fin-balance-cell">
                  <span className="fin-label">Balance Due</span>
                  <strong
                    className={`fin-val ${outstandingBalance > 0 ? "fin-val-due" : "fin-val-paid"}`}
                  >
                    {inr(outstandingBalance)}
                  </strong>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="customer-pay-progress">
                <div className="progress-track" aria-hidden="true">
                  <div className="progress-fill" style={{ width: `${paidPercentage}%` }} />
                </div>
                <div className="progress-labels">
                  <span>{paidPercentage}% Settled</span>
                  <span>
                    {outstandingBalance <= 0 ? "Fully Paid" : `${inr(outstandingBalance)} Remaining`}
                  </span>
                </div>
              </div>
            </section>

            {/* ── F. PAYMENT ACTIONS CARD ── */}
            <section className="customer-card payment-actions-card" aria-label="Payment Actions">
              <div className="customer-card-header">
                <div className="card-header-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  <h3>Make Payment</h3>
                </div>
                {outstandingBalance > 0 && !isOrderCancelled && !isLinkExpired && (
                  <span className="secure-checkout-pill">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Razorpay Secure
                  </span>
                )}
              </div>

              {isOrderCancelled ? (
                <div className="payment-notice-closed">
                  <p style={{ margin: 0 }}>
                    Online and cash payments are closed because this order has been cancelled.
                  </p>
                </div>
              ) : outstandingBalance === 0 ? (
                <div className="payment-notice-settled">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: "2px" }} aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <div>
                    <strong>Payment Completed</strong>
                    <p>All payments for this order are complete. No remaining balance is due.</p>
                  </div>
                </div>
              ) : isLinkExpired ? (
                <div className="payment-notice-expired">
                  <p style={{ margin: 0 }}>
                    This payment link has expired. Please contact the boutique to request an updated payment link.
                  </p>
                </div>
              ) : (
                <div className="payment-action-buttons-wrap">
                  {order.isGatewayConfigured ? (
                    <>
                      <p className="payment-methods-hint">
                        Accepted methods include UPI (Google Pay, PhonePe, Paytm), Netbanking, and Debit/Credit cards.
                      </p>
                      <div className="payment-btn-stack">
                        {advanceDue > 0 && (
                          <button
                            type="button"
                            disabled={paying}
                            onClick={() => handleGatewayPayment("ADVANCE")}
                            className="customer-btn customer-btn-secondary"
                            aria-label={`Pay Advance of ${inr(advanceDue)}`}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="2" y="5" width="20" height="14" rx="2" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                            <span>{paying ? "Opening Checkout..." : `Pay Advance ${inr(advanceDue)}`}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={paying}
                          onClick={() => handleGatewayPayment("BALANCE")}
                          className="customer-btn customer-btn-primary"
                          aria-label={`Pay Balance of ${inr(outstandingBalance)}`}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span>{paying ? "Opening Checkout..." : `Pay Balance ${inr(outstandingBalance)}`}</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="demo-gateway-box">
                        <strong>Demo Test Simulation</strong>
                        <p>
                          Razorpay Gateway test credentials are not loaded in backend environment. You can test payment transitions using Demo Simulation below.
                        </p>
                      </div>
                      <div className="payment-btn-stack">
                        {advanceDue > 0 && (
                          <button
                            type="button"
                            disabled={paying}
                            onClick={() => handleDemoPayment("ADVANCE")}
                            className="customer-btn customer-btn-demo"
                          >
                            {paying ? "Processing..." : `Simulate Advance ${inr(advanceDue)} (Demo)`}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={paying}
                          onClick={() => handleDemoPayment("BALANCE")}
                          className="customer-btn customer-btn-demo"
                        >
                          {paying ? "Processing..." : `Simulate Balance ${inr(outstandingBalance)} (Demo)`}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* ── G. PAYMENT HISTORY CARD ── */}
            <section className="customer-card payment-history-card" aria-label="Payment History">
              <div className="customer-card-header">
                <div className="card-header-title">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 10" />
                  </svg>
                  <h3>Payment History</h3>
                </div>
                <span className="history-count">
                  {order.payments ? order.payments.length : 0} {order.payments?.length === 1 ? "record" : "records"}
                </span>
              </div>

              {order.payments && order.payments.length > 0 ? (
                <div className="customer-history-list">
                  {order.payments.map((payment) => {
                    const isSuccess =
                      payment.status === "COMPLETED" || payment.status === "CAPTURED";
                    const isFailed =
                      payment.status === "CANCELLED" || payment.status === "FAILED";

                    return (
                      <div key={payment.id} className="history-item-row">
                        <div className="history-item-main">
                          <strong className="history-amount">+{inr(payment.amount)}</strong>
                          <span className="history-type">({payment.paymentType})</span>
                          <span
                            className={`orders-badge ${
                              isSuccess
                                ? "badge-paid"
                                : isFailed
                                ? "badge-cancelled"
                                : "badge-partial"
                            }`}
                          >
                            {payment.status}
                          </span>
                        </div>
                        <span className="history-date">
                          {payment.createdAt
                            ? new Date(payment.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="history-empty-state">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  <p>No payments recorded yet.</p>
                  <span>Online and boutique cash receipts will appear here once confirmed.</span>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CustomerOrderPage;
