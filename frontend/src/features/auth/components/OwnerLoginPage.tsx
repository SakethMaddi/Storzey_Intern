import React, { useRef, useState } from "react";
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
  const [refId, setRefId] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError("");
    setRefId("");
    setFieldErrors({});

    const validationResult = ownerLoginSchema.safeParse({ email, password });
    if (!validationResult.success) {
      const flattened = validationResult.error.flatten().fieldErrors;
      const formattedErrors: Record<string, string> = {};
      for (const [key, msgs] of Object.entries(flattened)) {
        if (msgs && msgs.length > 0) {
          formattedErrors[key] = msgs[0];
        }
      }
      setFieldErrors(formattedErrors);
      setError(validationResult.error.issues[0]?.message || "Please correct the highlighted fields.");
      submitLock.current = false;
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
      // 1. Network / connectivity error (offline, refused, timeout)
      if (!err.response || err.code === "ERR_NETWORK" || err.message === "Network Error") {
        setError("Unable to connect. Please check your internet connection and try again.");
        setRefId("");
        return;
      }

      const status = err.response?.status;
      const responseData = err.response?.data;

      // 2. Authentication failure: HTTP 401
      if (status === 401) {
        setError("Incorrect email or password. Please try again.");
        setRefId("");
        return;
      }

      // 3. Validation errors: HTTP 400
      if (status === 400) {
        if (responseData?.errors && typeof responseData.errors === "object") {
          const backendErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(responseData.errors as Record<string, any>)) {
            if (Array.isArray(msgs) && msgs.length > 0) {
              backendErrors[key] = String(msgs[0]);
            } else if (typeof msgs === "string") {
              backendErrors[key] = msgs;
            }
          }
          setFieldErrors(backendErrors);
        }
        const msg = responseData?.message;
        const isSensitive = /prisma|sql|database|table|column|select|stack|at \//i.test(msg || "");
        setError(
          isSensitive
            ? "Please check your inputs and try again."
            : (msg || "Please correct the highlighted fields.")
        );
        setRefId("");
        return;
      }

      // 4. Unexpected server/database errors: HTTP 500 or any unexpected status
      const serverRefId = responseData?.refId || "";
      setRefId(serverRefId);
      setError(
        "We couldn't complete your sign-in right now. Please try again in a few moments. If the issue continues, contact support."
      );
    } finally {
      submitLock.current = false;
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

        {error && (
          <div className="api-error-banner" role="alert">
            <div>{error}</div>
            {refId && (
              <div style={{ fontSize: "12px", marginTop: "4px", opacity: 0.85 }}>
                Reference ID: <code>{refId}</code>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Owner Email
            </label>
            <input
              type="email"
              placeholder="e.g. owner@advancepay.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: "" }));
              }}
              onBlur={() => setEmail((prev) => prev.trim().toLowerCase())}
              disabled={submitting}
              required
              style={fieldErrors.email ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.email && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Password
            </label>
            <PasswordInput
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: "" }));
              }}
              disabled={submitting}
              required
              autoComplete="current-password"
              style={fieldErrors.password ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.password && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.password}
              </span>
            )}
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
