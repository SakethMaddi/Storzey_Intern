import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config";

const API_URL = API_BASE_URL;

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export function CustomerOrderPage({ token }: { token: string }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const payingRef = useRef(false);

  const fetchOrder = async () => {
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
  };

  useEffect(() => {
    fetchOrder();
  }, [token]);

  // Real Razorpay gateway test payment flow
  const handleGatewayPayment = async (paymentType: "ADVANCE" | "BALANCE") => {
    if (payingRef.current) return;
    if (!order || order.balance <= 0) {
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

      const rzp = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "Advance Pay Boutique",
        description: `${paymentType} payment for ${order.itemName}`,
        order_id: razorpayOrderId,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 3. Authoritative backend signature verification
            const verifyRes = await axios.post(
              `${API_URL}/payments/verify`,
              response
            );
            setSuccessMessage(
              verifyRes.data.message || "Payment verified and recorded!"
            );
            await fetchOrder();
          } catch (vErr: any) {
            setError(
              vErr.response?.data?.message ||
                "Payment verification failed on backend. Please contact support."
            );
          }
        },
        modal: {
          ondismiss: () => {
            payingRef.current = false;
            setPaying(false);
          },
        },
        prefill: {
          name: order.customer?.name || "",
        },
        theme: {
          color: "#2563eb",
        },
      });

      rzp.on("payment.failed", (failedRes: any) => {
        setError(
          `Payment failed: ${failedRes.error?.description || "Transaction declined by gateway."}`
        );
        payingRef.current = false;
        setPaying(false);
      });

      rzp.open();
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Gateway checkout failed.";
      setError(msg);
      payingRef.current = false;
      setPaying(false);
    }
  };

  // Demo fallback payment (clearly marked)
  const handleDemoPayment = async (paymentType: "ADVANCE" | "BALANCE") => {
    if (payingRef.current) return;

    if (!order || order.balance <= 0) {
      setError("This order is already fully paid.");
      return;
    }

    try {
      payingRef.current = true;
      setPaying(true);
      setError("");
      setSuccessMessage("");

      const choice = window.confirm(
        "DEMO PAYMENT SIMULATION (Not real gateway)\n\nPress OK to simulate SUCCESS.\nPress Cancel to simulate FAILURE."
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
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Unable to process demo payment."
      );
    } finally {
      payingRef.current = false;
      setPaying(false);
    }
  };

  if (loading) return <p>Loading your order details...</p>;
  if (error && !order) return <p className="api-error-banner">{error}</p>;
  if (!order) return <p>Order not found.</p>;

  // Authoritative financial calculations
  const successfulPayments = (order.payments || []).filter(
    (p: any) => p.status === "COMPLETED" || p.status === "CAPTURED"
  );
  const advancePaid = typeof order.advancePaid === "number"
    ? order.advancePaid
    : successfulPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const outstandingBalance = typeof order.outstandingBalance === "number"
    ? order.outstandingBalance
    : Math.max(0, order.totalAmount - advancePaid);
  const isOrderCancelled = order.status === "CANCELLED";

  const advanceDue = Math.max((order.advance || 0) - advancePaid, 0);
  const isLinkExpired =
    Boolean(order.paymentLinkExpiresAt) &&
    new Date(order.paymentLinkExpiresAt).getTime() < Date.now();

  return (
    <div className="customer-order-page">
      <h1>Order Tracking & Payment</h1>
      {order.owner?.businessName ? (
        <p style={{ fontSize: "16px", color: "#800020", fontWeight: 700, margin: "-10px 0 16px" }}>
          {order.owner.businessName}
        </p>
      ) : null}

      {/* Cancellation Notice Banner */}
      {isOrderCancelled && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "14px 16px",
            borderRadius: "8px",
            margin: "16px 0 20px",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>
            ⚠️ Order Cancelled
          </div>
          <div style={{ fontSize: "14px" }}>
            This order has been cancelled by the boutique.
            {order.cancellationReason && (
              <p style={{ margin: "6px 0 0" }}>
                <strong>Reason:</strong> {order.cancellationReason}
              </p>
            )}
            {order.cancelledAt && (
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#b91c1c" }}>
                Cancelled on {new Date(order.cancelledAt).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </div>
      )}

      <h2>Hello, {order.customer?.name}!</h2>
      <p>Here is the real-time status of your custom boutique order.</p>

      <h3>Order Details</h3>
      <p>
        <strong>Item:</strong> {order.itemName}
      </p>
      <p>
        <strong>Order Status:</strong>{" "}
        <span
          style={{
            fontWeight: 700,
            padding: "2px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            background: isOrderCancelled ? "#fee2e2" : "#dcfce7",
            color: isOrderCancelled ? "#991b1b" : "#166534",
          }}
        >
          {order.status || "ACTIVE"}
        </span>
      </p>
      <p>
        <strong>Promised Delivery Date:</strong>{" "}
        {order.promisedDate
          ? new Date(order.promisedDate).toLocaleDateString("en-IN")
          : "Not specified"}
      </p>
      {order.paymentLinkExpiresAt && (
        <p>
          <strong>Payment Link Expiration:</strong>{" "}
          {new Date(order.paymentLinkExpiresAt).toLocaleString("en-IN", {
            timeZoneName: "short",
          })}
        </p>
      )}

      <h3>Payment Status</h3>
      <p>
        <strong>Total Order Amount:</strong> ₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}
      </p>
      <p>
        <strong>Advance Paid:</strong> ₹{Number(advancePaid || 0).toLocaleString("en-IN")}
      </p>
      <p>
        <strong>Outstanding Balance:</strong>{" "}
        <span
          style={{
            fontWeight: 700,
            color: outstandingBalance > 0 ? "#b91c1c" : "#166534",
          }}
        >
          ₹{Number(outstandingBalance || 0).toLocaleString("en-IN")}
        </span>
      </p>
      <p>
        <strong>Payment Status:</strong>{" "}
        <span
          style={{
            fontWeight: "bold",
            color:
              order.paymentStatus === "PAID"
                ? "#166534"
                : order.paymentStatus === "PARTIALLY_PAID"
                ? "#b45309"
                : "#dc2626",
          }}
        >
          {order.paymentStatus}
        </span>
      </p>

      {error && <div className="api-error-banner">{error}</div>}
      {successMessage && <div className="success-banner">{successMessage}</div>}

      {/* Payment Link Expired Warning */}
      {!isOrderCancelled && isLinkExpired && outstandingBalance > 0 && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "14px",
            borderRadius: "8px",
            margin: "18px 0",
          }}
        >
          <strong style={{ display: "block", marginBottom: "4px" }}>
            Payment Link Expired
          </strong>
          This payment link expired on{" "}
          {new Date(order.paymentLinkExpiresAt).toLocaleString("en-IN")}.
          Online payments are no longer accepted through this link. Please
          contact the boutique owner to request an updated payment link.
        </div>
      )}

      {/* Payment Action Buttons */}
      {isOrderCancelled ? (
        <div style={{ margin: "20px 0" }}>
          <p style={{ color: "#991b1b", fontStyle: "italic", fontSize: "14px", background: "#fef2f2", padding: "10px 14px", borderRadius: "6px" }}>
            Payments are closed because this order has been cancelled.
          </p>
        </div>
      ) : outstandingBalance > 0 && !isLinkExpired ? (
        <div style={{ margin: "20px 0" }}>
          <h4>Make Payment</h4>

          {order.isGatewayConfigured ? (
            <div>
              {advanceDue > 0 && (
                <button
                  disabled={paying}
                  onClick={() => handleGatewayPayment("ADVANCE")}
                  style={{ marginRight: "10px", marginBottom: "8px" }}
                >
                  {paying ? "Opening Checkout..." : `Pay Advance ₹${advanceDue.toLocaleString("en-IN")} (Gateway)`}
                </button>
              )}
              <button
                disabled={paying}
                onClick={() => handleGatewayPayment("BALANCE")}
                style={{ marginRight: "10px", marginBottom: "8px" }}
              >
                {paying ? "Opening Checkout..." : `Pay Balance ₹${Number(outstandingBalance || 0).toLocaleString("en-IN")} (Gateway)`}
              </button>
            </div>
          ) : (
            <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "12px", borderRadius: "8px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#92400e" }}>
                <strong>Note:</strong> Razorpay Gateway is waiting for test credentials in backend <code>.env</code>.
                You can test the flow using Demo Simulation below.
              </p>
              {advanceDue > 0 && (
                <button
                  disabled={paying}
                  onClick={() => handleDemoPayment("ADVANCE")}
                  style={{ marginRight: "10px", marginBottom: "8px", background: "#f59e0b" }}
                >
                  {paying ? "Processing..." : `Simulate Advance ₹${advanceDue.toLocaleString("en-IN")} (Demo)`}
                </button>
              )}
              <button
                disabled={paying}
                onClick={() => handleDemoPayment("BALANCE")}
                style={{ marginBottom: "8px", background: "#f59e0b" }}
              >
                {paying ? "Processing..." : `Simulate Balance ₹${Number(outstandingBalance || 0).toLocaleString("en-IN")} (Demo)`}
              </button>
            </div>
          )}
        </div>
      ) : outstandingBalance === 0 ? (
        <p style={{ color: "#166534", fontWeight: 600, fontSize: "16px" }}>
          ✓ All payments completed. No balance due. Thank you!
        </p>
      ) : null}

      <h3>Order Progress</h3>
      {order.stages && order.stages.length > 0 ? (
        order.stages.map((stage: any, index: number) => (
          <div key={stage.id} className="stage-item">
            <p>
              <strong>{index + 1}. {stage.name}:</strong>{" "}
              <span
                style={{
                  fontWeight: 600,
                  color:
                    stage.status === "COMPLETED"
                      ? "#15803d"
                      : stage.status === "IN_PROGRESS"
                      ? "#d97706"
                      : "#64748b",
                }}
              >
                {stage.status.replace("_", " ")}
              </span>
            </p>
          </div>
        ))
      ) : (
        <p>No stages assigned.</p>
      )}

      <h3>Payment History</h3>
      {order.payments && order.payments.length > 0 ? (
        order.payments.map((payment: any) => (
          <div key={payment.id} className="payment-history-item">
            <p>
              <strong>Amount:</strong> ₹{Number(payment.amount || 0).toLocaleString("en-IN")}
            </p>
            <p>
              <strong>Type:</strong> {payment.paymentType}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              <span
                style={{
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  background:
                    payment.status === "COMPLETED" || payment.status === "CAPTURED"
                      ? "#dcfce7"
                      : payment.status === "CANCELLED"
                      ? "#fee2e2"
                      : payment.status === "FAILED"
                      ? "#fee2e2"
                      : "#fef3c7",
                  color:
                    payment.status === "COMPLETED" || payment.status === "CAPTURED"
                      ? "#15803d"
                      : payment.status === "CANCELLED"
                      ? "#991b1b"
                      : payment.status === "FAILED"
                      ? "#991b1b"
                      : "#92400e",
                }}
              >
                {payment.status}
              </span>
            </p>
            {payment.createdAt && (
              <p>
                <strong>Date:</strong>{" "}
                {new Date(payment.createdAt).toLocaleString()}
              </p>
            )}
          </div>
        ))
      ) : (
        <p>No payments recorded yet.</p>
      )}
    </div>
  );
}

export default CustomerOrderPage;
