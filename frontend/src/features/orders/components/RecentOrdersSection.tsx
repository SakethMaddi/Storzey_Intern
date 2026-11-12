import type { RecentOrder } from "./DashboardSummary";

export interface RecentOrdersSectionProps {
  recentOrders: RecentOrder[];
  onViewOrderDetails?: (orderId: number) => void;
}

function inr(amount: number | undefined): string {
  const val = Number(amount) || 0;
  return `₹${val.toLocaleString("en-IN")}`;
}

function statusBadge(status: string) {
  let bg = "#fef2f2";
  let color = "#b91c1c";
  let border = "#fecaca";
  let label = "Pending";

  if (status === "PAID") {
    bg = "#f0fdf4";
    color = "#15803d";
    border = "#bbf7d0";
    label = "Paid";
  } else if (status === "PARTIALLY_PAID") {
    bg = "#fefce8";
    color = "#a16207";
    border = "#fef08a";
    label = "Partial";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "12px",
        fontWeight: 600,
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function RecentOrdersSection({
  recentOrders,
  onViewOrderDetails,
}: RecentOrdersSectionProps) {
  if (!recentOrders || recentOrders.length === 0) {
    return (
      <div id="recent-orders" className="order-card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "18px", color: "#1e3a8a", marginBottom: "12px" }}>
          Recent Orders
        </h2>
        <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
          No recent orders recorded yet.
        </div>
      </div>
    );
  }

  return (
    <section id="recent-orders" className="order-card" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <h2 style={{ fontSize: "18px", color: "#1e3a8a", margin: 0 }}>
          Recent Orders
        </h2>
        <span style={{ fontSize: "13px", color: "#64748b" }}>
          Latest {recentOrders.length} orders
        </span>
      </div>

      {/* Desktop Table View (Hidden on mobile <768px) */}
      <div className="desktop-table-container">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#475569", fontWeight: 600 }}>#</th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#475569", fontWeight: 600 }}>Item</th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#475569", fontWeight: 600 }}>Customer</th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Total</th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Balance</th>
              <th style={{ padding: "10px 12px", textAlign: "center", color: "#475569", fontWeight: 600 }}>Status</th>
              {onViewOrderDetails && (
                <th style={{ padding: "10px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Action</th>
              )}
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "12px", fontWeight: 600, color: "#64748b" }}>#{o.id}</td>
                <td style={{ padding: "12px", fontWeight: 600, color: "#1e293b" }}>{o.itemName}</td>
                <td style={{ padding: "12px", color: "#334155" }}>{o.customer?.name ?? "—"}</td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: 600 }}>{inr(o.totalAmount)}</td>
                <td style={{ padding: "12px", textAlign: "right", color: o.balance > 0 ? "#b91c1c" : "#166534", fontWeight: 600 }}>
                  {inr(o.balance)}
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>{statusBadge(o.paymentStatus)}</td>
                {onViewOrderDetails && (
                  <td style={{ padding: "12px", textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={() => onViewOrderDetails(o.id)}
                      style={{
                        padding: "4px 10px",
                        fontSize: "12px",
                        background: "#f1f5f9",
                        color: "#2563eb",
                        border: "1px solid #cbd5e1",
                      }}
                    >
                      View
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Responsive Cards (Visible on mobile <768px) */}
      <div className="mobile-cards-container">
        {recentOrders.map((o) => (
          <div
            key={o.id}
            style={{
              padding: "12px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              marginBottom: "10px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
              <div>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>#{o.id}</span>
                <h4 style={{ margin: "2px 0 0", fontSize: "15px", color: "#1e293b" }}>{o.itemName}</h4>
                <div style={{ fontSize: "13px", color: "#475569" }}>{o.customer?.name ?? "—"}</div>
              </div>
              <div>{statusBadge(o.paymentStatus)}</div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                paddingTop: "8px",
                borderTop: "1px dashed #cbd5e1",
                fontSize: "13px",
              }}
            >
              <div>
                <span style={{ color: "#64748b" }}>Total: </span>
                <span style={{ fontWeight: 600 }}>{inr(o.totalAmount)}</span>
              </div>
              <div>
                <span style={{ color: "#64748b" }}>Balance: </span>
                <span style={{ fontWeight: 600, color: o.balance > 0 ? "#b91c1c" : "#166534" }}>
                  {inr(o.balance)}
                </span>
              </div>
            </div>

            {onViewOrderDetails && (
              <button
                type="button"
                onClick={() => onViewOrderDetails(o.id)}
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "6px",
                  fontSize: "12px",
                  background: "#f1f5f9",
                  color: "#2563eb",
                  border: "1px solid #cbd5e1",
                }}
              >
                View Order Details
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

