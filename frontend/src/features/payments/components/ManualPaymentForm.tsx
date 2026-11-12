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
      <p style={{ color: "#166534", fontWeight: 600 }}>
        Payment Completed — No Balance Due
      </p>
    );
  }

  return (
    <div>
      <input
        type="number"
        min="1"
        max={balance}
        placeholder={`Payment amount (Max ₹${balance.toLocaleString("en-IN")})`}
        value={amount}
        className={error ? "input-error" : ""}
        disabled={submitting}
        onChange={(e) => onAmountChange(e.target.value)}
      />

      <select
        value={type}
        disabled={submitting}
        onChange={(e) => onTypeChange(e.target.value)}
      >
        <option value="ADVANCE">Advance</option>
        <option value="BALANCE">Balance</option>
      </select>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-banner">{success}</div>}

      <button onClick={onSubmit} disabled={submitting}>
        {submitting ? "Recording Payment..." : "Submit Payment"}
      </button>

      <button
        onClick={onReconcile}
        style={{ marginLeft: "10px", background: "#475569" }}
      >
        Sync Gateway Status
      </button>
    </div>
  );
}
