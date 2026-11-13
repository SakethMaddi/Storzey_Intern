export interface ManualPaymentFormProps {
  orderId?: number;
  balance: number;
  amount: string;
  type: string;
  error?: string;
  success?: string;
  submitting: boolean;
  onAmountChange: (val: string) => void;
  onTypeChange: (val: string) => void;
  onSubmit: () => void;
  onReconcile: () => void;
}

export function ManualPaymentForm({
  balance,
  amount,
  type,
  error,
  success,
  submitting,
  onAmountChange,
  onTypeChange,
  onSubmit,
  onReconcile,
}: ManualPaymentFormProps) {
  if (balance <= 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 16px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          color: "#166534",
          fontWeight: 600,
          fontSize: "14px",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>Payment Completed — No Balance Due</span>
      </div>
    );
  }

  return (
    <div className="manual-payment-box">
      <div className="manual-payment-grid">
        <div style={{ flex: 1, minWidth: "180px" }}>
          <label
            htmlFor="cash-amount-input"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#475569",
              marginBottom: "4px",
            }}
          >
            Cash Amount (₹) <span style={{ color: "#b91c1c" }}>*</span>
          </label>
          <input
            id="cash-amount-input"
            type="number"
            inputMode="numeric"
            min="1"
            max={balance}
            step="1"
            placeholder="Enter cash amount in ₹"
            value={amount}
            className={error ? "input-error" : ""}
            disabled={submitting}
            onChange={(e) => onAmountChange(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", "."].includes(e.key)) {
                e.preventDefault();
              }
            }}
            style={{ margin: 0 }}
          />
        </div>

        <div style={{ minWidth: "140px" }}>
          <label
            htmlFor="payment-type-select"
            style={{
              display: "block",
              fontSize: "12px",
              fontWeight: 600,
              color: "#475569",
              marginBottom: "4px",
            }}
          >
            Payment Type
          </label>
          <select
            id="payment-type-select"
            value={type}
            disabled={submitting}
            onChange={(e) => onTypeChange(e.target.value)}
            style={{ margin: 0 }}
          >
            <option value="ADVANCE">Advance</option>
            <option value="BALANCE">Balance</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message" style={{ marginTop: "8px" }}>{error}</div>}
      {success && <div className="success-banner" style={{ marginTop: "8px" }}>{success}</div>}

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
          marginTop: "12px",
        }}
      >
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="orders-btn orders-btn-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
          </svg>
          {submitting ? "Recording Payment..." : "Record Cash Payment"}
        </button>

        <button
          type="button"
          onClick={onReconcile}
          className="orders-btn orders-btn-ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          title="Sync Razorpay gateway status"
        >
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
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          Sync Gateway Status
        </button>
      </div>
    </div>
  );
}
