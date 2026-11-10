
import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

function CustomerOrderPage({ token }: { token: string }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  const fetchOrder = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/public/orders/${token}`
      );
      setOrder(response.data.data);
    } catch {
      setError("Order not found. Please check your tracking link.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [token]);

  
const handlePayment = async (paymentType: "ADVANCE" | "BALANCE") => {
  try {
    setPaying(true);
    setError("");

    const choice = window.confirm(
      "DEMO PAYMENT\n\nPress OK to simulate SUCCESS.\nPress Cancel to simulate FAILURE."
    );

    const response = await axios.post(
      `${API_URL}/orders/${order.id}/demo-payment`,
      {
        paymentType,
        outcome: choice ? "SUCCESS" : "FAILED",
      }
    );

    alert(response.data.message);

    await fetchOrder();
  } catch (err: any) {
    setError(
      err.response?.data?.message || "Unable to process demo payment."
    );
  } finally {
    setPaying(false);
  }
};


  if (loading) return <p>Loading your order...</p>;
  if (error && !order) return <p>{error}</p>;
  if (!order) return <p>Order not found.</p>;

  const amountPaid = order.totalAmount - order.balance;
  const advanceDue = Math.max(order.advance - amountPaid, 0);

  return (
    <div className="customer-order-page">
      <h1>Order Tracking</h1>

      <h2>Hello, {order.customer.name}!</h2>
      <p>Here is the latest update on your order.</p>

      <h3>Order Details</h3>
      <p>Item: {order.itemName}</p>
      <p>
        Promised Delivery:{" "}
        {order.promisedDate
          ? new Date(order.promisedDate).toLocaleDateString("en-IN")
          : "Not specified"}
      </p>

      <h3>Payment Details</h3>
      <p>Total Amount: ₹{order.totalAmount}</p>
      <p>Advance Amount: ₹{order.advance}</p>
      <p>Amount Paid: ₹{amountPaid}</p>
      <p>Balance Due: ₹{order.balance}</p>
      <p>Payment Status: {order.paymentStatus}</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {advanceDue > 0 && (
        <button
          disabled={paying}
          onClick={() => handlePayment("ADVANCE")}
        >
          {paying ? "Processing..." : `Pay Advance ₹${advanceDue}`}
        </button>
      )}

      {advanceDue === 0 && order.balance > 0 && (
        <button
          disabled={paying}
          onClick={() => handlePayment("BALANCE")}
        >
          {paying ? "Processing..." : `Pay Balance ₹${order.balance}`}
        </button>
      )}

      {order.balance <= 0 && <p>All payments completed. Thank you!</p>}

      <h3>Order Progress</h3>
      {order.stages.map((stage: any) => (
        <div key={stage.id}>
          <p>
            {stage.name} — {stage.status.replace("_", " ")}
          </p>
        </div>
      ))}

      <h3>Payment History</h3>
      {order.payments.length > 0 ? (
        order.payments.map((payment: any) => (
          <div key={payment.id}>
            <p>Amount: ₹{payment.amount}</p>
            <p>Type: {payment.paymentType}</p>
            <p>Status: {payment.status}</p>
          </div>
        ))
      ) : (
        <p>No payment history available.</p>
      )}
    </div>
  );
}

export default CustomerOrderPage;
