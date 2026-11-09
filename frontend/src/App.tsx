import "./App.css";
import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [orders, setOrders] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [payments, setPayments] = useState<Record<number, any[]>>({});
  const [stages, setStages] = useState<Record<number, any[]>>({});
  const [selectedOrder, setSelectedOrder] = useState<number | null>(null);

  const [itemName, setItemName] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [advance, setAdvance] = useState("");
  const [customerId, setCustomerId] = useState("");

  const [paymentInputs, setPaymentInputs] = useState< Record<number, { amount: string; type: string }> >({});

  const fetchOrders = async () => {
    const response = await axios.get("http://localhost:5000/orders");
    setOrders(response.data.data);
  };

  const fetchCustomers = async () => {
    const response = await axios.get("http://localhost:5000/customers");
    setCustomers(response.data.data);
  };

  const fetchPayments = async (orderId: number) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/orders/${orderId}/payments`
      );

      setPayments((prev) => ({
        ...prev,
        [orderId]: response.data.data,
      }));
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    }
  };

  const fetchStages = async (orderId: number) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/orders/${orderId}/stages`
      );

      setStages((prev) => ({
        ...prev,
        [orderId]: response.data.data,
      }));
    } catch (error) {
      console.error("Failed to fetch stages:", error);
    }
  };

  const updateStageStatus = async (
    stageId: number,
    orderId: number,
    status: string
  ) => {
    try {
      await axios.patch(`http://localhost:5000/stages/${stageId}`, {
        status,
      });

      await fetchStages(orderId);
    } catch (error) {
      console.error("Failed to update stage:", error);
      alert("Failed to update stage status");
    }
  };

  const recordPayment = async (orderId: number) => {
    const payment = paymentInputs[orderId];

    if (
      !payment ||
      !Number.isInteger(Number(payment.amount)) ||
      Number(payment.amount) <= 0
    ) {
      alert("Enter a valid payment amount.");
      return;
    }

    try {
      await axios.post(
        `http://localhost:5000/orders/${orderId}/payments`,
        {
          amount: Number(payment.amount),
          paymentType: payment.type,
        }
      );

      alert("Payment recorded successfully!");

      setPaymentInputs((prev) => ({
        ...prev,
        [orderId]: { amount: "", type: "ADVANCE" },
      }));

      await fetchOrders();
      await fetchPayments(orderId);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.message || "Failed to record payment");
      } else {
        alert("Something went wrong");
      }
    }
  };

  const toggleOrderDetails = async (orderId: number) => {
    if (selectedOrder === orderId) {
      setSelectedOrder(null);
      return;
    }

    setSelectedOrder(orderId);

    await Promise.all([
      fetchPayments(orderId),
      fetchStages(orderId),
    ]);
  };

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, []);

  const createCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await axios.post("http://localhost:5000/customers", {
        name,
        phone,
      });

      alert("Customer created successfully!");
      setName("");
      setPhone("");
      await fetchCustomers();
    } catch (error) {
      alert("Failed to create customer");
    }
  };

  const createOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      !itemName.trim() ||
      Number(totalAmount) <= 0 ||
      Number(advance) < 0 ||
      Number(advance) > Number(totalAmount) ||
      !customerId
    ) {
      alert("Please enter valid order details.");
      return;
    }

    try {
      await axios.post("http://localhost:5000/orders", {
        itemName,
        totalAmount: Number(totalAmount),
        advance: Number(advance),
        customerId: Number(customerId),
      });

      alert("Order created successfully!");

      setItemName("");
      setTotalAmount("");
      setAdvance("");
      setCustomerId("");

      await fetchOrders();
    } catch (error) {
      alert("Failed to create order");
    }
  };

  return (
    <div>
      <h1>Advance Pay</h1>

      <h2>Create Customer</h2>

      <form onSubmit={createCustomer}>
        <input
          placeholder="Customer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />

        <button type="submit">Add Customer</button>
      </form>

      <h2>Customers</h2>

      {customers.map((customer) => (
        <div className="customer-card" key={customer.id}>
          <p>Name: {customer.name}</p>
          <p>Phone: {customer.phone}</p>
        </div>
      ))}

      <h2>Orders</h2>

      <h2>Create Order</h2>

      <form onSubmit={createOrder}>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
        >
          <option value="">Select Customer</option>

          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name} - {customer.phone}
            </option>
          ))}
        </select>

        <input
          placeholder="Item name"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Total amount"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Advance amount"
          value={advance}
          onChange={(e) => setAdvance(e.target.value)}
          required
        />

        <button type="submit">Create Order</button>
      </form>

      {orders.map((order) => {
        const amountPaid = order.totalAmount - order.balance;
        const paidPercentage = Math.min( 100, Math.max( 0, Math.round((amountPaid / order.totalAmount) * 100)));

        return (
          <div className="order-card" key={order.id}>
            <h3>{order.customer.name}</h3>

            <button onClick={() => toggleOrderDetails(order.id)}>
              {selectedOrder === order.id ? "Hide Details" : "View Details"}
            </button>

            <div>
              <progress
                value={amountPaid}
                max={order.totalAmount}
              />
              <p>{paidPercentage}% Paid</p>
            </div>

            {selectedOrder === order.id && (
              <>
                <p>Item: {order.itemName}</p>
                <p>Total: ₹{order.totalAmount}</p>
                <p>Advance: ₹{order.advance}</p>
                <p>Balance: ₹{order.balance}</p>
                <p>Amount Paid: ₹{amountPaid}</p>
                <p>Payment Status: {order.paymentStatus}</p>

                <h4>Record Payment</h4>

                {order.balance > 0 ? (
                  <>
                    <input
                      type="number"
                      min="1"
                      max={order.balance}
                      placeholder="Payment amount"
                      value={paymentInputs[order.id]?.amount || ""}
                      onChange={(e) =>
                        setPaymentInputs((prev) => ({
                          ...prev,
                          [order.id]: {
                            amount: e.target.value,
                            type: prev[order.id]?.type || "ADVANCE",
                          },
                        }))
                      }
                    />

                    <select
                      value={paymentInputs[order.id]?.type || "ADVANCE"}
                      onChange={(e) =>
                        setPaymentInputs((prev) => ({
                          ...prev,
                          [order.id]: {
                            amount: prev[order.id]?.amount || "",
                            type: e.target.value,
                          },
                        }))
                      }
                    >
                      <option value="ADVANCE">Advance</option>
                      <option value="BALANCE">Balance</option>
                    </select>

                    <button onClick={() => recordPayment(order.id)}>
                      Submit Payment
                    </button>
                  </>
                ) : (
                  <p>Payment Completed — No Balance Due</p>
                )}

                <h4>Payment History</h4>

                {payments[order.id]?.length ? (
                  payments[order.id].map((payment) => (
                    <div key={payment.id}>
                      <p>Amount: ₹{payment.amount}</p>
                      <p>Type: {payment.paymentType}</p>
                      <p>Status: {payment.status}</p>
                      <p>
                        Date: {new Date(payment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <p>No payments recorded yet.</p>
                )}

                <h4>Order Stages</h4>

                {stages[order.id]?.length ? (
                  stages[order.id].map((stage) => (
                    <div key={stage.id}>
                      <p>{stage.name}</p>

                      <select
                        value={stage.status}
                        onChange={(e) =>
                          updateStageStatus(
                            stage.id,
                            order.id,
                            e.target.value
                          )
                        }
                      >
                        <option value="PENDING">Pending</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  ))
                ) : (
                  <p>No stages found.</p>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default App;
