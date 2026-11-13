import React from "react";
import type { Customer } from "../../../types";

export interface CustomerEditModalProps {
  customer: Customer;
  editName: string;
  editPhone: string;
  editEmail?: string;
  errors: { name?: string; phone?: string; email?: string };
  apiError: string;
  successMessage: string;
  submitting: boolean;
  onNameChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onEmailChange?: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function CustomerEditModal({
  customer,
  editName,
  editPhone,
  editEmail = "",
  errors,
  apiError,
  successMessage,
  submitting,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  onSubmit,
  onCancel,
}: CustomerEditModalProps) {
  return (
    <div className="customers-edit">
      <div className="customers-panel-head">
        <h3>Edit {customer.name}</h3>
        <button
          type="button"
          className="customers-btn customers-btn-ghost"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>

      <form className="customers-form" onSubmit={onSubmit} noValidate>
        <div className="customers-form-grid">
          <label className="customers-field">
            <span>Customer name</span>
            <input
              value={editName}
              placeholder="Full customer name"
              className={errors.name ? "input-error" : ""}
              onChange={(e) => onNameChange(e.target.value)}
              disabled={submitting}
              aria-invalid={errors.name ? true : undefined}
              required
            />
            {errors.name && (
              <div className="error-message" role="alert">
                {errors.name}
              </div>
            )}
          </label>

          <label className="customers-field">
            <span>10-digit phone number</span>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={editPhone}
              className={errors.phone ? "input-error" : ""}
              onChange={(e) => onPhoneChange(e.target.value)}
              disabled={submitting}
              aria-invalid={errors.phone ? true : undefined}
              required
            />
            {errors.phone && (
              <div className="error-message" role="alert">
                {errors.phone}
              </div>
            )}
          </label>

          <label className="customers-field">
            <span>Email address</span>
            <input
              type="email"
              placeholder="Optional, for payment receipts"
              value={editEmail}
              className={errors.email ? "input-error" : ""}
              onChange={(e) => onEmailChange?.(e.target.value)}
              disabled={submitting}
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email && (
              <div className="error-message" role="alert">
                {errors.email}
              </div>
            )}
          </label>
        </div>

        {apiError && (
          <div className="api-error-banner" role="alert">
            {apiError}
          </div>
        )}
        {successMessage && (
          <div className="success-banner" role="status">
            {successMessage}
          </div>
        )}

        <div className="customers-form-actions">
          <button
            type="submit"
            className="customers-btn customers-btn-primary"
            disabled={submitting}
          >
            {submitting ? "Saving changes..." : "Save changes"}
          </button>
          <button
            type="button"
            className="customers-btn customers-btn-ghost"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
