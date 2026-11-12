import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config";
import { ownerLoginSchema } from "../../../validation";
import { PasswordInput } from "../../../shared/components/PasswordInput";

export interface OwnerLoginPageProps {
  onLoginSuccess: (ownerEmail: string) => void;
  onSwitchToSignUp?: () => void;
  successNotice?: string;
}

export function OwnerLoginPage({
  onLoginSuccess,
  onSwitchToSignUp,
  successNotice,
}: OwnerLoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationResult = ownerLoginSchema.safeParse({ email, password });
    if (!validationResult.success) {
      setError(validationResult.error.issues[0]?.message || "Invalid credentials.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      onLoginSuccess(res.data?.data?.email || validationResult.data.email);
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid credentials or login failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Advance Pay</h1>
        <h2>Owner Dashboard Login</h2>
        <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px" }}>
          Secure login for your boutique business.
        </p>

        {successNotice && (
          <div
            style={{
              padding: "10px 14px",
              backgroundColor: "#dcfce7",
              border: "1px solid #86efac",
              color: "#166534",
              borderRadius: "8px",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            {successNotice}
          </div>
        )}

        {error && <div className="api-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Owner Email
            </label>
            <input
              type="email"
              placeholder="e.g. owner@advancepay.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Password
            </label>
            <PasswordInput
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ width: "100%", marginTop: "18px" }}
          >
            {submitting ? "Authenticating..." : "Sign In to Dashboard"}
          </button>
        </form>

        {onSwitchToSignUp && (
          <div style={{ marginTop: "20px", textAlign: "center", fontSize: "14px" }}>
            <span style={{ color: "#64748b" }}>Don't have an account? </span>
            <button
              type="button"
              className="auth-toggle-link"
              onClick={onSwitchToSignUp}
            >
              Create Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
