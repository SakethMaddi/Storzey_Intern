import { useState } from "react";
import { remainingAfterPayment, validateCashPayment } from "../../orders/order-wizard";

export interface ManualPaymentFormProps {
  orderId?: number;
  orderLabel?: string;
  customerName?: string;
  totalAmount?: number;
  balance: number;
  remainingAdvance?: number;
  amount: string;
  type: string;
  error?: string;
  success?: string;
  submitting: boolean;
  onAmountChange: (val: string) => void;
  onTypeChange: (val: string) => void;
  onSubmit: () => void;
  onReconcile: () => void;
  onDownloadReceipt?: () => void;
}

const PAYMENT_STEPS = ["Order", "Amount", "Review", "Done"] as const;

function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function ManualPaymentForm({
  orderLabel,
  customerName,
  totalAmount = 0,
  balance,
  remainingAdvance,
  amount,
  type,
  error,
  success,
  submitting,
  onAmountChange,
  onTypeChange,
  onSubmit,
  onReconcile,
  onDownloadReceipt,
}: ManualPaymentFormProps) {
  const [step, setStep] = useState(0);
  const [localError, setLocalError] = useState("");
  const [confirmedAmount, setConfirmedAmount] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [seenSuccess, setSeenSuccess] = useState("");
  const [seenError, setSeenError] = useState("");
  const paidSoFar = Math.max(0, totalAmount - balance);
  const remaining = remainingAfterPayment(balance, confirmedAmount || amount);

  if (success && success !== seenSuccess && !acknowledged) {
    setSeenSuccess(success);
    setStep(3);
  }
  if (!success && (acknowledged || seenSuccess)) {
    setAcknowledged(false);
    setSeenSuccess("");
  }
  if (error && error !== seenError) {
    setSeenError(error);
    setStep(2);
  }

  if (balance <= 0 && (!success || acknowledged)) {
    return (
      <div className="payment-settled" role="status">
        <span>Payment completed. No balance is due.</span>
      </div>
    );
  }

  const shownError = localError || error;

  const continueAmount = () => {
    const nextError = validateCashPayment(amount, balance, {
      type,
      remainingAdvance,
    });
    setLocalError(nextError || "");
    if (!nextError) {
      setConfirmedAmount(amount);
      setStep(2);
    }
  };

  const confirm = () => {
    const nextError = validateCashPayment(amount, balance, {
      type,
      remainingAdvance,
    });
    setLocalError(nextError || "");
    if (nextError || submitting) return;
    setConfirmedAmount(amount);
    onSubmit();
  };

  return (
    <div className="payment-wizard">
      <ol className="wizard-progress" aria-label="Record payment progress">
        {PAYMENT_STEPS.map((label, index) => (
          <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="wizard-panel">
          <h5>This payment is for the open order</h5>
          <dl className="wizard-balance">
            <div>
              <dt>Order</dt>
              <dd>{orderLabel || "Selected order"}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{customerName || "—"}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{inr(totalAmount)}</dd>
            </div>
            <div>
              <dt>Already paid</dt>
              <dd>{inr(paidSoFar)}</dd>
            </div>
            <div>
              <dt>Outstanding</dt>
              <dd>{inr(balance)}</dd>
            </div>
          </dl>
          <div className="order-wizard-actions">
            <button type="button" className="orders-btn orders-btn-primary" onClick={() => setStep(1)}>
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="wizard-panel">
          <h5>Cash received in the shop</h5>
          <p className="wizard-help">
            Online payments stay on the customer tracking page and are marked paid only after Razorpay verification.
            {type === "ADVANCE" && remainingAdvance !== undefined
              ? ` An advance entry cannot exceed the unpaid agreed advance of ₹${remainingAdvance.toLocaleString("en-IN")}.`
              : ""}
          </p>
          <div className="manual-payment-grid">
            <div>
              <label htmlFor="cash-amount-input" className="orders-form-label">
                Amount received (₹) <span className="required-star">*</span>
              </label>
              <input
                id="cash-amount-input"
                type="text"
                inputMode="numeric"
                placeholder="Whole rupees"
                value={amount}
                className={shownError ? "input-error" : ""}
                disabled={submitting}
                onChange={(event) => {
                  setLocalError("");
                  onAmountChange(event.target.value.replace(/\D/g, ""));
                }}
              />
            </div>
            <div>
              <label htmlFor="payment-type-select" className="orders-form-label">
                Payment type
              </label>
              <select
                id="payment-type-select"
                value={type}
                disabled={submitting}
                onChange={(event) => onTypeChange(event.target.value)}
              >
                <option value="ADVANCE">Advance</option>
                <option value="BALANCE">Balance</option>
              </select>
            </div>
          </div>
          {shownError && <div className="error-message">{shownError}</div>}
          <div className="order-wizard-actions">
            <button type="button" className="orders-btn orders-btn-ghost" onClick={() => setStep(0)} disabled={submitting}>
              Back
            </button>
            <button type="button" className="orders-btn orders-btn-primary" onClick={continueAmount} disabled={submitting}>
              Review payment
            </button>
            <button type="button" className="orders-btn orders-btn-ghost" onClick={onReconcile} disabled={submitting}>
              Sync gateway status
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-panel">
          <h5>Confirm cash payment</h5>
          <dl className="wizard-balance">
            <div>
              <dt>Amount received</dt>
              <dd>{/^\d+$/.test(amount) ? inr(Number(amount)) : "—"}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{type === "BALANCE" ? "Balance" : "Advance"}</dd>
            </div>
            <div>
              <dt>Remaining after this payment</dt>
              <dd>{remaining === null ? "—" : inr(remaining)}</dd>
            </div>
          </dl>
          {shownError && <div className="error-message">{shownError}</div>}
          <div className="order-wizard-actions">
            <button type="button" className="orders-btn orders-btn-ghost" onClick={() => setStep(1)} disabled={submitting}>
              Back
            </button>
            <button type="button" className="orders-btn orders-btn-primary" onClick={confirm} disabled={submitting}>
              {submitting ? "Recording payment..." : "Record payment"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="wizard-panel" role="status">
          <h5>Payment recorded</h5>
          <p>{success || "The payment was saved."}</p>
          <dl className="wizard-balance">
            <div>
              <dt>Amount received</dt>
              <dd>{/^\d+$/.test(confirmedAmount) ? inr(Number(confirmedAmount)) : "Saved"}</dd>
            </div>
            <div>
              <dt>Outstanding now</dt>
              <dd>{inr(balance)}</dd>
            </div>
          </dl>
          <div className="order-wizard-actions">
            {onDownloadReceipt && (
              <button type="button" className="orders-btn orders-btn-primary" onClick={onDownloadReceipt}>
                Download receipt
              </button>
            )}
            <button
              type="button"
              className="orders-btn orders-btn-ghost"
              onClick={() => {
                setAcknowledged(true);
                setConfirmedAmount("");
                setLocalError("");
                setStep(0);
              }}
            >
              Record another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
