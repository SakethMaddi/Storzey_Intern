import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Customer } from "../../../types";
import { StageManagerInput } from "./StageManagerInput";
import { capitalizeFirstLetter } from "../../../validation";
import {
  ORDER_WIZARD_STEPS,
  validateOrderStep,
  type OrderWizardInput,
} from "../order-wizard";

export interface OrderCreateFormProps {
  customers: Customer[];
  customerId: string;
  itemName: string;
  totalAmount: string;
  advance: string;
  promisedDate: string;
  orderErrors: {
    customerId?: string;
    itemName?: string;
    totalAmount?: string;
    advance?: string;
    promisedDate?: string;
    stages?: string;
  };
  orderSuccess: string;
  orderApiError: string;
  isSubmittingOrder: boolean;
  onDismissSuccess?: () => void;
  orderStages: string[];
  newStageInput: string;
  stageInputError: string;
  onCustomerIdChange: (val: string) => void;
  onItemNameChange: (val: string) => void;
  onTotalAmountChange: (val: string) => void;
  onAdvanceChange: (val: string) => void;
  onPromisedDateChange: (val: string) => void;
  onNewStageInputChange: (val: string) => void;
  onAddStage: () => void;
  onRemoveStage: (index: number) => void;
  onMoveStage: (index: number, direction: "up" | "down") => void;
  onEditStageName: (index: number, newName: string) => void;
  onResetDefaultStages: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onStartAddCustomer?: () => void;
  onViewCreatedOrder?: () => void;
}

function inr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function OrderCreateForm({
  customers,
  customerId,
  itemName,
  totalAmount,
  advance,
  promisedDate,
  orderErrors,
  orderSuccess,
  orderApiError,
  isSubmittingOrder,
  onDismissSuccess,
  orderStages,
  newStageInput,
  stageInputError,
  onCustomerIdChange,
  onItemNameChange,
  onTotalAmountChange,
  onAdvanceChange,
  onPromisedDateChange,
  onNewStageInputChange,
  onAddStage,
  onRemoveStage,
  onMoveStage,
  onEditStageName,
  onResetDefaultStages,
  onSubmit,
  onStartAddCustomer,
  onViewCreatedOrder,
}: OrderCreateFormProps) {
  const [step, setStep] = useState(0);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [customerQuery, setCustomerQuery] = useState("");
  const [handledSuccess, setHandledSuccess] = useState("");
  const [handledErrorKey, setHandledErrorKey] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const skipScroll = useRef(true);

  const errorKey = [
    orderErrors.customerId,
    orderErrors.itemName,
    orderErrors.stages,
    orderErrors.totalAmount,
    orderErrors.promisedDate,
    orderErrors.advance,
  ].filter(Boolean).join("|");

  if (orderSuccess && orderSuccess !== handledSuccess) {
    setHandledSuccess(orderSuccess);
    setStep(0);
    setCustomerQuery("");
    setStepErrors({});
  }

  if (errorKey && errorKey !== handledErrorKey) {
    setHandledErrorKey(errorKey);
    if (orderErrors.customerId) setStep(0);
    else if (orderErrors.itemName || orderErrors.stages) setStep(1);
    else if (orderErrors.totalAmount || orderErrors.promisedDate) setStep(2);
    else if (orderErrors.advance) setStep(3);
  }

  const draft = useMemo<OrderWizardInput>(
    () => ({ customerId, itemName, totalAmount, advance, promisedDate, stages: orderStages }),
    [customerId, itemName, totalAmount, advance, promisedDate, orderStages]
  );

  useEffect(() => {
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [step]);

  const selectedCustomer = customers.find((c) => String(c.id) === customerId);
  const filteredCustomers = customers.filter((c) => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.phone.includes(customerQuery.trim());
  });

  const customerOptions =
    selectedCustomer && !filteredCustomers.some((c) => c.id === selectedCustomer.id)
      ? [selectedCustomer, ...filteredCustomers]
      : filteredCustomers;

  const totalNumber = /^\d+$/.test(totalAmount) ? Number(totalAmount) : null;
  const advanceNumber = /^\d+$/.test(advance) ? Number(advance) : null;

  const message = (field: string) => stepErrors[field] || orderErrors[field as keyof typeof orderErrors];
  const clearStepError = (field: string) => {
    setStepErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const goTo = (target: number) => {
    if (isSubmittingOrder || target === step) return;
    if (target < step) {
      setStep(target);
      return;
    }
    for (let index = step; index < target; index += 1) {
      const errors = validateOrderStep(index, draft);
      if (Object.keys(errors).length > 0) {
        setStepErrors(errors);
        setStep(index);
        return;
      }
    }
    setStep(target);
  };

  const continueStep = () => {
    const errors = validateOrderStep(step, draft);
    setStepErrors(errors);
    if (Object.keys(errors).length === 0) {
      setStep((curr) => Math.min(curr + 1, ORDER_WIZARD_STEPS.length - 1));
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (step !== ORDER_WIZARD_STEPS.length - 1) {
      continueStep();
      return;
    }
    const errors = validateOrderStep(4, draft);
    setStepErrors(errors);
    if (Object.keys(errors).length > 0) {
      if (errors.customerId) setStep(0);
      else if (errors.itemName || errors.stages) setStep(1);
      else if (errors.totalAmount || errors.promisedDate) setStep(2);
      else if (errors.advance) setStep(3);
      return;
    }
    onSubmit(event);
  };

  if (orderSuccess) {
    return (
      <div className="wizard-card-container wizard-success-state" role="status">
        <div className="success-badge-icon">✓</div>
        <h2 className="success-title">Order Created Successfully</h2>
        <p className="success-desc">{orderSuccess}</p>
        <div className="success-notice-pill">
          <strong>Important:</strong> Agreed advance is an agreed deposit, not collected money. Initial outstanding balance starts at the full order total until a payment is recorded.
        </div>
        <div className="wizard-actions-row">
          {onViewCreatedOrder && (
            <button type="button" className="btn-primary" onClick={onViewCreatedOrder}>
              View Created Order
            </button>
          )}
          {onDismissSuccess && (
            <button type="button" className="btn-ghost" onClick={onDismissSuccess}>
              Create Another Order
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-card-container" ref={rootRef}>
      {/* ── STEP INDICATOR ── */}
      <ol className="modern-step-indicator" aria-label="Create Order Steps">
        {ORDER_WIZARD_STEPS.map((label, index) => {
          const isCurrent = index === step;
          const isComplete = index < step;
          return (
            <li
              key={label}
              className={`step-item ${isCurrent ? "is-current" : isComplete ? "is-complete" : ""}`}
            >
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-current={isCurrent ? "step" : undefined}
                disabled={isSubmittingOrder}
                className="step-btn"
              >
                <span className="step-circle">{isComplete ? "✓" : index + 1}</span>
                <span className="step-text">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <form onSubmit={handleSubmit} noValidate className="wizard-form-body">
        {/* ── STEP 1: CUSTOMER SELECTION ── */}
        {step === 0 && (
          <div className="step-panel">
            <div className="step-header">
              <span className="step-badge">Step 1 of 5</span>
              <h2 className="step-title">Select Customer</h2>
              <p className="step-subtitle">Choose the client placing this bespoke order or add a new customer.</p>
            </div>

            {selectedCustomer ? (
              <div className="selected-customer-pill">
                <div className="customer-avatar-mini">
                  {selectedCustomer.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="customer-meta">
                  <strong>{selectedCustomer.name}</strong>
                  <span>{selectedCustomer.phone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onCustomerIdChange("");
                    setCustomerQuery("");
                  }}
                  className="btn-change-customer"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="customer-picker-wrap">
                <div className="field-group">
                  <label htmlFor="order-customer-search" className="field-label">Search Client</label>
                  <input
                    id="order-customer-search"
                    type="search"
                    value={customerQuery}
                    placeholder="Search by client name or phone number..."
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    disabled={isSubmittingOrder}
                    className="input-text"
                  />
                </div>

                <div className="field-group">
                  <label htmlFor="order-customer-select" className="field-label">
                    Select from List <span className="req-star">*</span>
                  </label>
                  <select
                    id="order-customer-select"
                    value={customerId}
                    className={`select-field ${message("customerId") ? "has-error" : ""}`}
                    onChange={(e) => {
                      clearStepError("customerId");
                      onCustomerIdChange(e.target.value);
                    }}
                    disabled={isSubmittingOrder}
                  >
                    <option value="">-- Choose Customer --</option>
                    {customerOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                  {message("customerId") && (
                    <div className="field-error-msg">{message("customerId")}</div>
                  )}
                  {customerQuery && customerOptions.length === 0 && (
                    <p className="field-hint">No existing client found matching "{customerQuery}".</p>
                  )}
                </div>

                {onStartAddCustomer && (
                  <div className="add-client-callout">
                    <span>New client?</span>
                    <button
                      type="button"
                      className="btn-link-action"
                      onClick={onStartAddCustomer}
                      disabled={isSubmittingOrder}
                    >
                      + Add New Customer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: GARMENT & STAGES ── */}
        {step === 1 && (
          <div className="step-panel">
            <div className="step-header">
              <span className="step-badge">Step 2 of 5</span>
              <h2 className="step-title">Garment & Production Stages</h2>
              <p className="step-subtitle">Specify what garment is being tailored and configure milestone stages.</p>
            </div>

            <div className="field-group">
              <label htmlFor="order-item-name" className="field-label">
                Garment / Item Name <span className="req-star">*</span>
              </label>
              <input
                id="order-item-name"
                placeholder="e.g. Silk Saree Blouse, Embroidered Sherwani, Anarkali Suit"
                value={itemName}
                maxLength={100}
                className={`input-text ${message("itemName") ? "has-error" : ""}`}
                onChange={(e) => {
                  clearStepError("itemName");
                  onItemNameChange(capitalizeFirstLetter(e.target.value));
                }}
                disabled={isSubmittingOrder}
              />
              {message("itemName") && (
                <div className="field-error-msg">{message("itemName")}</div>
              )}
            </div>

            <div className="stages-setup-wrap">
              <StageManagerInput
                stages={orderStages}
                newStageInput={newStageInput}
                stageInputError={stageInputError}
                orderErrorStage={message("stages")}
                disabled={isSubmittingOrder}
                onNewStageInputChange={onNewStageInputChange}
                onAddStage={onAddStage}
                onRemoveStage={onRemoveStage}
                onMoveStage={onMoveStage}
                onEditStageName={onEditStageName}
                onResetDefaultStages={onResetDefaultStages}
              />
            </div>
          </div>
        )}

        {/* ── STEP 3: PRICING & PROMISED DELIVERY ── */}
        {step === 2 && (
          <div className="step-panel">
            <div className="step-header">
              <span className="step-badge">Step 3 of 5</span>
              <h2 className="step-title">Pricing & Promised Delivery</h2>
              <p className="step-subtitle">Set the total order price and promised date of delivery to the client.</p>
            </div>

            <div className="form-grid-two">
              <div className="field-group">
                <label htmlFor="order-total-amount" className="field-label">
                  Total Order Amount (₹) <span className="req-star">*</span>
                </label>
                <div className="input-with-prefix">
                  <span className="input-prefix">₹</span>
                  <input
                    id="order-total-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 15000"
                    value={totalAmount}
                    className={`input-text ${message("totalAmount") ? "has-error" : ""}`}
                    onChange={(e) => {
                      clearStepError("totalAmount");
                      onTotalAmountChange(e.target.value.replace(/\D/g, ""));
                    }}
                    disabled={isSubmittingOrder}
                  />
                </div>
                {message("totalAmount") && (
                  <div className="field-error-msg">{message("totalAmount")}</div>
                )}
              </div>

              <div className="field-group">
                <label htmlFor="order-promised-date" className="field-label">
                  Promised Delivery Date <span className="req-star">*</span>
                </label>
                <input
                  id="order-promised-date"
                  type="date"
                  value={promisedDate}
                  min={new Date().toISOString().split("T")[0]}
                  className={`input-text ${message("promisedDate") ? "has-error" : ""}`}
                  onChange={(e) => {
                    clearStepError("promisedDate");
                    onPromisedDateChange(e.target.value);
                  }}
                  disabled={isSubmittingOrder}
                />
                {message("promisedDate") && (
                  <div className="field-error-msg">{message("promisedDate")}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: AGREED ADVANCE ── */}
        {step === 3 && (
          <div className="step-panel">
            <div className="step-header">
              <span className="step-badge">Step 4 of 5</span>
              <h2 className="step-title">Agreed Advance Deposit</h2>
              <p className="step-subtitle">Enter the advance deposit agreed with the customer at booking.</p>
            </div>

            <div className="field-group">
              <label htmlFor="order-advance-amount" className="field-label">
                Agreed Advance (₹) <span className="req-star">*</span>
              </label>
              <div className="input-with-prefix">
                <span className="input-prefix">₹</span>
                <input
                  id="order-advance-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0 if no advance agreed"
                  value={advance}
                  className={`input-text ${message("advance") ? "has-error" : ""}`}
                  onChange={(e) => {
                    clearStepError("advance");
                    onAdvanceChange(e.target.value.replace(/\D/g, ""));
                  }}
                  disabled={isSubmittingOrder}
                />
              </div>
              {message("advance") && (
                <div className="field-error-msg">{message("advance")}</div>
              )}
            </div>

            <div className="advance-rule-banner">
              <strong>Notice:</strong> An agreed advance is an agreed target, not money received. The initial outstanding balance starts at the full order total until an actual payment is saved.
            </div>

            <div className="summary-calculation-box">
              <div className="calc-row">
                <span>Total Order Value:</span>
                <strong>{totalNumber === null ? "—" : inr(totalNumber)}</strong>
              </div>
              <div className="calc-row">
                <span>Agreed Advance Deposit:</span>
                <strong className="text-brand">{advanceNumber === null ? "—" : inr(advanceNumber)}</strong>
              </div>
              <div className="calc-row highlight">
                <span>Initial Balance when Created:</span>
                <strong className="text-balance">{totalNumber === null ? "—" : inr(totalNumber)}</strong>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 5: REVIEW AND CONFIRM ── */}
        {step === 4 && (
          <div className="step-panel">
            <div className="step-header">
              <span className="step-badge">Step 5 of 5</span>
              <h2 className="step-title">Review & Confirm Order</h2>
              <p className="step-subtitle">Please verify all order details before creating the order in the ledger.</p>
            </div>

            <div className="order-ticket-preview">
              <div className="ticket-item-row">
                <div>
                  <span className="ticket-label">Customer</span>
                  <strong className="ticket-val">
                    {selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : "Not selected"}
                  </strong>
                </div>
                <button type="button" className="btn-edit-step" onClick={() => goTo(0)}>
                  Edit
                </button>
              </div>

              <div className="ticket-item-row">
                <div>
                  <span className="ticket-label">Garment / Item</span>
                  <strong className="ticket-val">{itemName || "Not specified"}</strong>
                </div>
                <button type="button" className="btn-edit-step" onClick={() => goTo(1)}>
                  Edit
                </button>
              </div>

              <div className="ticket-item-row">
                <div>
                  <span className="ticket-label">Production Stages</span>
                  <strong className="ticket-val">
                    {orderStages.filter((s) => s.trim()).join(" → ") || "Default stages"}
                  </strong>
                </div>
                <button type="button" className="btn-edit-step" onClick={() => goTo(1)}>
                  Edit
                </button>
              </div>

              <div className="ticket-item-row">
                <div>
                  <span className="ticket-label">Total Amount</span>
                  <strong className="ticket-val">{totalNumber === null ? "—" : inr(totalNumber)}</strong>
                </div>
                <button type="button" className="btn-edit-step" onClick={() => goTo(2)}>
                  Edit
                </button>
              </div>

              <div className="ticket-item-row">
                <div>
                  <span className="ticket-label">Promised Delivery</span>
                  <strong className="ticket-val">{promisedDate || "Not chosen"}</strong>
                </div>
                <button type="button" className="btn-edit-step" onClick={() => goTo(2)}>
                  Edit
                </button>
              </div>

              <div className="ticket-item-row">
                <div>
                  <span className="ticket-label">Agreed Advance</span>
                  <strong className="ticket-val">{advanceNumber === null ? "—" : inr(advanceNumber)}</strong>
                </div>
                <button type="button" className="btn-edit-step" onClick={() => goTo(3)}>
                  Edit
                </button>
              </div>

              <div className="ticket-item-row total-highlight">
                <div>
                  <span className="ticket-label">Initial Balance Due</span>
                  <strong className="ticket-val text-balance">{totalNumber === null ? "—" : inr(totalNumber)}</strong>
                </div>
              </div>
            </div>

            {(message("customerId") || message("itemName") || message("stages") || message("totalAmount") || message("promisedDate") || message("advance")) && (
              <div className="field-error-msg">Please review the highlighted step before submitting.</div>
            )}
          </div>
        )}

        {orderApiError && <div className="api-error-banner">{orderApiError}</div>}

        {/* ── STEP ACTION BUTTONS ── */}
        <div className="wizard-actions-bar">
          {step > 0 && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => goTo(step - 1)}
              disabled={isSubmittingOrder}
            >
              ← Back
            </button>
          )}

          {step < ORDER_WIZARD_STEPS.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={continueStep}
              disabled={isSubmittingOrder}
            >
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmittingOrder}
            >
              {isSubmittingOrder ? "Creating Order..." : "Confirm & Create Order"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
