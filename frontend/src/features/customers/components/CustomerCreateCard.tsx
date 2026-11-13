import React from "react";
import { capitalizeFirstLetter } from "../../../validation";

export interface CustomerCreateCardProps {
  name: string;
  phone: string;
  email?: string;
  errors: { name?: string; phone?: string; email?: string };
  apiError: string;
  successMessage: string;
  isSubmitting: boolean;
  onNameChange: (val: string) => void;
  onPhoneChange: (val: string) => void;
  onEmailChange?: (val: string) => void;
  onPhonePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose?: () => void;
}

export function CustomerCreateCard({
  name,
  phone,
  email = "",
  errors,
  apiError,
  successMessage,
  isSubmitting,
  onNameChange,
  onPhoneChange,
  onEmailChange,
  onPhonePaste,
  onSubmit,
  onClose,
}: CustomerCreateCardProps) {
  return (
    <div className="customers-panel" id="add-customer">
      <div className="customers-panel-head">
        <h3>Add customer</h3>
        {onClose && (
          <button
            type="button"
            className="customers-btn customers-btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Close
          </button>
        )}
      </div>

      <form className="customers-form" onSubmit={onSubmit} noValidate>
        <div className="customers-form-grid">
          <label className="customers-field">
            <span>Customer name</span>
            <input
              placeholder="Full name (e.g. Priya Sharma)"
              value={name}
              maxLength={100}
              className={errors.name ? "input-error" : ""}
              onChange={(e) => onNameChange(capitalizeFirstLetter(e.target.value))}
              disabled={isSubmitting}
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
            <span>Phone number</span>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={10}
              placeholder="10 digits, starting 6–9"
              value={phone}
              className={errors.phone ? "input-error" : ""}
              onChange={(e) => onPhoneChange(e.target.value)}
              onKeyDown={(e) => {
                if (["e", "E", "+", "-", "."].includes(e.key)) {
                  e.preventDefault();
                }
              }}
              onPaste={onPhonePaste}
              disabled={isSubmitting}
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
              value={email}
              className={errors.email ? "input-error" : ""}
              onChange={(e) => onEmailChange?.(e.target.value)}
              disabled={isSubmitting}
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

        <button
          type="submit"
          className="customers-btn customers-btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Adding customer..." : "Add customer"}
        </button>
      </form>
    </div>
  );
}
