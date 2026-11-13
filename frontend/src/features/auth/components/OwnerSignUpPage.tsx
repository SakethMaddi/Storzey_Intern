import React, { useRef, useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../../config";
import { ownerRegisterSchema, capitalizeFirstLetter } from "../../../validation";
import { PasswordInput } from "../../../shared/components/PasswordInput";

export interface OwnerSignUpPageProps {
  onSwitchToLogin: () => void;
  onRegistrationSuccess: (ownerProfile: { email: string; name?: string; businessName?: string | null }) => void;
}

export function OwnerSignUpPage({
  onSwitchToLogin,
  onRegistrationSuccess,
}: OwnerSignUpPageProps) {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    const validationResult = ownerRegisterSchema.safeParse({
      name,
      businessName,
      email,
      phone,
      password,
      confirmPassword,
    });

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
      const res = await axios.post(`${API_BASE_URL}/auth/register`, {
        name: validationResult.data.name,
        businessName: validationResult.data.businessName ?? null,
        email: validationResult.data.email,
        phone: validationResult.data.phone ?? null,
        password: validationResult.data.password,
        confirmPassword: validationResult.data.confirmPassword,
      });

      if (res.data?.success) {
        // Fetch the authenticated owner profile using GET /auth/me to verify the session
        try {
          const meRes = await axios.get(`${API_BASE_URL}/auth/me`);
          if (meRes.data?.success && meRes.data?.data?.role === "owner" && meRes.data?.data?.email) {
            onRegistrationSuccess({
              email: meRes.data.data.email,
              name: meRes.data.data.name,
              businessName: meRes.data.data.businessName,
            });
            return;
          }
          // If role is not owner or response is not successful, do not authenticate
          setError("Registration completed, but session verification failed. Please sign in.");
        } catch {
          // If GET /auth/me failed, do not mark user authenticated or redirect to dashboard
          setError("Registration completed, but session verification failed. Please sign in.");
        }
      }
    } catch (err: any) {
      if (!err.response || err.code === "ERR_NETWORK" || err.message === "Network Error") {
        setError("Unable to connect. Please check your internet connection and try again.");
        setRefId("");
        return;
      }

      const status = err.response?.status;
      const responseData = err.response?.data;

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
            ? "Please correct the highlighted fields."
            : (msg || "Please correct the highlighted fields.")
        );
        setRefId("");
        return;
      }

      if (status === 409) {
        setError(responseData?.message || "An account with these details already exists.");
        setRefId("");
        return;
      }

      if (status === 502 || status === 503) {
        setError(
          responseData?.message ||
            "Unable to connect to the backend server. Please try again in a few moments."
        );
        setRefId("");
        return;
      }

      const serverRefId = responseData?.refId || "";
      setRefId(serverRefId);
      setError(
        serverRefId
          ? `We couldn't complete your registration right now. Please try again in a few moments. If the issue continues, contact support (Reference: ${serverRefId}).`
          : "We couldn't complete your registration right now. Please try again in a few moments. If the issue continues, contact support."
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
        <h2>Register Boutique Owner</h2>
        <p style={{ color: "#64748b", fontSize: "14px", margin: "0 0 20px" }}>
          Secure login for your boutique business.
        </p>

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
              Owner Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Anusha Rao"
              value={name}
              onChange={(e) => {
                setName(capitalizeFirstLetter(e.target.value));
                if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: "" }));
              }}
              onBlur={() => setName((prev) => capitalizeFirstLetter(prev.trim()))}
              disabled={submitting}
              required
              style={fieldErrors.name ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.name && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.name}
              </span>
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Boutique / Business Name <span style={{ color: "#94a3b8", fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Anusha Haute Couture"
              value={businessName}
              onChange={(e) => {
                setBusinessName(capitalizeFirstLetter(e.target.value));
                if (fieldErrors.businessName) setFieldErrors((prev) => ({ ...prev, businessName: "" }));
              }}
              onBlur={() => setBusinessName((prev) => capitalizeFirstLetter(prev.trim()))}
              disabled={submitting}
              style={fieldErrors.businessName ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.businessName && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.businessName}
              </span>
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Email Address *
            </label>
            <input
              type="email"
              placeholder="owner@yourboutique.com"
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
              Phone Number <span style={{ color: "#94a3b8", fontWeight: 400 }}>(10-digit mobile)</span>
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: "" }));
              }}
              disabled={submitting}
              style={fieldErrors.phone ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.phone && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.phone}
              </span>
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Password (min. 8 characters) *
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
              autoComplete="new-password"
              style={fieldErrors.password ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.password && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.password}
              </span>
            )}
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={{ display: "block", fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>
              Confirm Password *
            </label>
            <PasswordInput
              placeholder="••••••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (fieldErrors.confirmPassword) setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
              }}
              disabled={submitting}
              required
              autoComplete="new-password"
              style={fieldErrors.confirmPassword ? { borderColor: "#ef4444" } : undefined}
            />
            {fieldErrors.confirmPassword && (
              <span style={{ color: "#ef4444", fontSize: "12px", display: "block", marginTop: "4px" }}>
                {fieldErrors.confirmPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ width: "100%", marginTop: "18px" }}
          >
            {submitting ? "Registering Boutique..." : "Register Boutique Account"}
          </button>
        </form>

        <div style={{ marginTop: "20px", textAlign: "center", fontSize: "14px" }}>
          <span style={{ color: "#64748b" }}>Already registered? </span>
          <button
            type="button"
            className="auth-toggle-link"
            onClick={onSwitchToLogin}
          >
            Sign in to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
