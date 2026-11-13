import React from "react";
import type { Customer } from "../../../types";
import { StageManagerInput } from "./StageManagerInput";

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
}: OrderCreateFormProps) {
  return (
    <div className="orders-create-card">
      {/* Toast Notification */}
      {orderSuccess && (
        <div className="toast-notification success-toast" role="alert" aria-live="polite">
          <div className="toast-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{orderSuccess}</span>
          </div>
          {onDismissSuccess && (
            <button
              type="button"
              onClick={onDismissSuccess}
              className="toast-dismiss-btn"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="orders-form">
        {/* Section 1: Customer & Garment Details */}
        <fieldset className="orders-form-group">
          <legend className="orders-form-legend">1. Customer & Garment Details</legend>
          <div className="orders-form-grid-2">
            {/* Customer Dropdown */}
            <div className="orders-form-field">
              <label htmlFor="order-customer-select" className="orders-form-label">
                Select Customer <span className="required-star">*</span>
              </label>
              <select
                id="order-customer-select"
                value={customerId}
                className={orderErrors.customerId ? "input-error" : ""}
                onChange={(e) => onCustomerIdChange(e.target.value)}
                disabled={isSubmittingOrder}
                required
              >
                <option value="">Select Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} - {customer.phone}
                  </option>
                ))}
              </select>
              {orderErrors.customerId && (
                <div className="error-message">{orderErrors.customerId}</div>
              )}
            </div>

            {/* Item Name */}
            <div className="orders-form-field">
              <label htmlFor="order-item-name" className="orders-form-label">
                Garment / Item Name <span className="required-star">*</span>
              </label>
              <input
                id="order-item-name"
                placeholder="Item name"
                value={itemName}
                className={orderErrors.itemName ? "input-error" : ""}
                onChange={(e) => onItemNameChange(e.target.value)}
                disabled={isSubmittingOrder}
                required
              />
              {orderErrors.itemName && (
                <div className="error-message">{orderErrors.itemName}</div>
              )}
            </div>
          </div>
        </fieldset>

        {/* Section 2: Pricing & Delivery Schedule */}
        <fieldset className="orders-form-group">
          <legend className="orders-form-legend">2. Pricing & Delivery Schedule</legend>
          <div className="orders-form-grid-3">
            {/* Total Amount */}
            <div className="orders-form-field">
              <label htmlFor="order-total-amount" className="orders-form-label">
                Total Amount (₹) <span className="required-star">*</span>
              </label>
              <input
                id="order-total-amount"
                type="number"
                placeholder="Total amount (₹)"
                value={totalAmount}
                className={orderErrors.totalAmount ? "input-error" : ""}
                onChange={(e) => onTotalAmountChange(e.target.value)}
                disabled={isSubmittingOrder}
                required
              />
              {orderErrors.totalAmount && (
                <div className="error-message">{orderErrors.totalAmount}</div>
              )}
            </div>

            {/* Advance Amount */}
            <div className="orders-form-field">
              <label htmlFor="order-advance-amount" className="orders-form-label">
                Advance Amount (₹) <span className="required-star">*</span>
              </label>
              <input
                id="order-advance-amount"
                type="number"
                placeholder="Advance amount (₹)"
                value={advance}
                className={orderErrors.advance ? "input-error" : ""}
                onChange={(e) => onAdvanceChange(e.target.value)}
                disabled={isSubmittingOrder}
                required
              />
              {orderErrors.advance && (
                <div className="error-message">{orderErrors.advance}</div>
              )}
            </div>

            {/* Promised Date */}
            <div className="orders-form-field">
              <label htmlFor="order-promised-date" className="orders-form-label">
                Promised Delivery Date <span className="required-star">*</span>
              </label>
              <input
                id="order-promised-date"
                type="date"
                value={promisedDate}
                className={orderErrors.promisedDate ? "input-error" : ""}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => onPromisedDateChange(e.target.value)}
                disabled={isSubmittingOrder}
                required
              />
              {orderErrors.promisedDate && (
                <div className="error-message">{orderErrors.promisedDate}</div>
              )}
            </div>
          </div>
        </fieldset>

        {/* Section 3: Custom Order Stages Management */}
        <fieldset className="orders-form-group">
          <legend className="orders-form-legend">3. Production Workflow Stages</legend>
          <StageManagerInput
            stages={orderStages}
            newStageInput={newStageInput}
            stageInputError={stageInputError}
            orderErrorStage={orderErrors.stages}
            disabled={isSubmittingOrder}
            onNewStageInputChange={onNewStageInputChange}
            onAddStage={onAddStage}
            onRemoveStage={onRemoveStage}
            onMoveStage={onMoveStage}
            onEditStageName={onEditStageName}
            onResetDefaultStages={onResetDefaultStages}
          />
        </fieldset>

        {orderApiError && <div className="api-error-banner">{orderApiError}</div>}

        <div className="orders-form-submit-row">
          <button
            type="submit"
            disabled={isSubmittingOrder}
            className="orders-btn orders-btn-primary orders-submit-btn"
          >
            {isSubmittingOrder ? (
              <span>Creating Order...</span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                Create Order & Generate Payment Link
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
