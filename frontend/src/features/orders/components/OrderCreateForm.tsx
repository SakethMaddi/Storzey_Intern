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
    <>
      {/* Toast Notification outside the form flow */}
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

      <h2>Create Order</h2>

      <form onSubmit={onSubmit} noValidate>
        <div>
          <select
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

        <div>
          <input
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

        <div>
          <input
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

        <div>
          <input
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

        <div>
          <input
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

        {/* Custom Order Stages Management */}
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

        {orderApiError && <div className="api-error-banner">{orderApiError}</div>}

        <button
          type="submit"
          disabled={isSubmittingOrder}
          style={{ marginTop: "12px" }}
        >
          {isSubmittingOrder ? "Creating Order..." : "Create Order"}
        </button>
      </form>
    </>
  );
}

