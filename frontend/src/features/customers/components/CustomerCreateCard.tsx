import React from "react";

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
}: CustomerCreateCardProps) {
  return (
    <>
      <h2>Create Customer</h2>

      <form onSubmit={onSubmit} noValidate>
        <div>
          <input
            placeholder="Customer name"
            value={name}
            className={errors.name ? "input-error" : ""}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={isSubmitting}
            required
          />
          {errors.name && <div className="error-message">{errors.name}</div>}
        </div>

        <div>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="Phone number (exactly 10 digits, starts with 6–9)"
            value={phone}
            className={errors.phone ? "input-error" : ""}
            onChange={(e) => onPhoneChange(e.target.value)}
            onPaste={onPhonePaste}
            disabled={isSubmitting}
            required
          />
          {errors.phone && <div className="error-message">{errors.phone}</div>}
        </div>

        <div>
          <input
            type="email"
            placeholder="Email address (optional, for payment receipts)"
            value={email}
            className={errors.email ? "input-error" : ""}
            onChange={(e) => onEmailChange?.(e.target.value)}
            disabled={isSubmitting}
          />
          {errors.email && <div className="error-message">{errors.email}</div>}
        </div>

        {apiError && <div className="api-error-banner">{apiError}</div>}
        {successMessage && <div className="success-banner">{successMessage}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ marginTop: "8px" }}
        >
          {isSubmitting ? "Adding Customer..." : "Add Customer"}
        </button>
      </form>
    </>
  );
}

