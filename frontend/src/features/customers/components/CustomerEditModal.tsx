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
    <div
      style={{
        background: "#ffffff",
        border: "2px solid #3b82f6",
        borderRadius: "10px",
        padding: "18px 20px",
        marginBottom: "20px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h3 style={{ margin: 0, color: "#1e3a8a", fontSize: "17px" }}>
          Edit Customer (ID: {customer.id})
        </h3>
        <button
          type="button"
          onClick={onCancel}
          style={{
            background: "#94a3b8",
            padding: "4px 10px",
            fontSize: "12px",
          }}
        >
          Cancel
        </button>
      </div>

      <form onSubmit={onSubmit} noValidate>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "4px",
            }}
          >
            Customer Name
          </label>
          <input
            value={editName}
            placeholder="Full customer name"
            className={errors.name ? "input-error" : ""}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={submitting}
            required
          />
          {errors.name && <div className="error-message">{errors.name}</div>}
        </div>

        <div style={{ marginTop: "10px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "4px",
            }}
          >
            10-Digit Phone Number
          </label>
          <input
            type="tel"
            maxLength={10}
            placeholder="e.g. 9876543210"
            value={editPhone}
            className={errors.phone ? "input-error" : ""}
            onChange={(e) => onPhoneChange(e.target.value)}
            disabled={submitting}
            required
          />
          {errors.phone && <div className="error-message">{errors.phone}</div>}
        </div>

        <div style={{ marginTop: "10px" }}>
          <label
            style={{
              display: "block",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "4px",
            }}
          >
            Email Address (optional)
          </label>
          <input
            type="email"
            placeholder="e.g. customer@example.com"
            value={editEmail}
            className={errors.email ? "input-error" : ""}
            onChange={(e) => onEmailChange?.(e.target.value)}
            disabled={submitting}
          />
          {errors.email && <div className="error-message">{errors.email}</div>}
        </div>

        {apiError && (
          <div className="api-error-banner" style={{ marginTop: "12px" }}>
            {apiError}
          </div>
        )}
        {successMessage && (
          <div className="success-banner" style={{ marginTop: "12px" }}>
            {successMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{ background: "#2563eb" }}
          >
            {submitting ? "Saving Changes..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            style={{ background: "#e2e8f0", color: "#334155" }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

