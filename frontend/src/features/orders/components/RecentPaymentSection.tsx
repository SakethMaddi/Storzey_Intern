import type { RecentPayment } from "./DashboardSummary";

export interface RecentPaymentSectionProps {
  recentPayments: RecentPayment[];
}

function inr(amount: number | undefined): string {
  const val = Number(amount) || 0;
  return `₹${val.toLocaleString("en-IN")}`;
}

export function RecentPaymentSection({
  recentPayments,
}: RecentPaymentSectionProps) {
  if (!recentPayments || recentPayments.length === 0) {
    return (
      <div id="recent-payments" className="order-card" style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: "18px", color: "#1e3a8a", marginBottom: "12px" }}>
          Recent Payment Activity
        </h2>
        <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
          No verified payment records found.
        </div>
      </div>
    );
  }

  return (
    <section id="recent-payments" className="order-card" style={{ marginTop: 24, marginBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <h2 style={{ fontSize: "18px", color: "#1e3a8a", margin: 0 }}>
          Recent Payment Activity
        </h2>
        <span style={{ fontSize: "13px", color: "#64748b" }}>
          Latest {recentPayments.length} verified transactions
        </span>
      </div>

      {/* Desktop Table View */}
      <div className="desktop-table-container">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#475569", fontWeight: 600 }}>Order / Item</th>
              <th style={{ padding: "10px 12px", textAlign: "left", color: "#475569", fontWeight: 600 }}>Customer</th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Amount</th>
              <th style={{ padding: "10px 12px", textAlign: "center", color: "#475569", fontWeight: 600 }}>Type</th>
              <th style={{ padding: "10px 12px", textAlign: "right", color: "#475569", fontWeight: 600 }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentPayments.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "12px", fontWeight: 600, color: "#1e293b" }}>
                  {p.order?.itemName ?? `#${p.id}`}
                </td>
                <td style={{ padding: "12px", color: "#334155" }}>
                  {p.order?.customer?.name ?? "—"}
                </td>
                <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#15803d" }}>
                  +{inr(p.amount)}
                </td>
                <td style={{ padding: "12px", textAlign: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    {p.paymentType}
                  </span>
                </td>
                <td style={{ padding: "12px", textAlign: "right", color: "#64748b", fontSize: "13px" }}>
                  {new Date(p.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Responsive Cards */}
      <div className="mobile-cards-container">
        {recentPayments.map((p) => (
          <div
            key={p.id}
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
                <h4 style={{ margin: "0", fontSize: "15px", color: "#1e293b" }}>
                  {p.order?.itemName ?? `#${p.id}`}
                </h4>
                <div style={{ fontSize: "13px", color: "#475569" }}>
                  {p.order?.customer?.name ?? "—"}
                </div>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#15803d",
                }}
              >
                +{inr(p.amount)}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "8px",
                borderTop: "1px dashed #cbd5e1",
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              <span
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 600,
                }}
              >
                {p.paymentType}
              </span>
              <span>
                {new Date(p.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

