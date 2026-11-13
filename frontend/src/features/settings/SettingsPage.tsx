import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { PasswordInput } from "../../shared/components/PasswordInput";
import { capitalizeFirstLetter, isValidHumanName, validateStrictIndianPhone } from "../../validation";

const API_BASE = API_BASE_URL;

export interface SettingsPageProps {
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string | null;
  businessName: string | null;
  onLogout: () => void;
  onProfileUpdated: (updated: {
    name: string;
    phone: string | null;
    businessName: string | null;
  }) => void;
}

export function SettingsPage({
  ownerEmail,
  ownerName,
  ownerPhone,
  businessName,
  onLogout,
  onProfileUpdated,
}: SettingsPageProps) {
  // --- Business Profile State ---
  const [profileName, setProfileName] = useState(ownerName);
  const [profilePhone, setProfilePhone] = useState(ownerPhone ?? "");
  const [profileBusiness, setProfileBusiness] = useState(businessName ?? "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // --- Change Password State ---
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const trimmedName = capitalizeFirstLetter(profileName.trim());
    const trimmedPhone = profilePhone.trim();
    const trimmedBusiness = capitalizeFirstLetter(profileBusiness.trim());

    if (trimmedName && !isValidHumanName(trimmedName)) {
      setProfileError("Owner name can only contain letters, spaces, hyphens, apostrophes, and dots.");
      return;
    }

    if (trimmedPhone) {
      const phoneCheck = validateStrictIndianPhone(trimmedPhone);
      if (!phoneCheck.isValid) {
        setProfileError(phoneCheck.message || "Invalid Indian mobile number.");
        return;
      }
    }

    // Build only the changed fields
    const payload: { name?: string; phone?: string; businessName?: string } = {};
    if (trimmedName && trimmedName !== ownerName) payload.name = trimmedName;
    if (trimmedPhone !== (ownerPhone ?? "")) {
      payload.phone = trimmedPhone || undefined;
    }
    if (trimmedBusiness !== (businessName ?? "")) {
      payload.businessName = trimmedBusiness;
    }

    if (Object.keys(payload).length === 0) {
      setProfileError("No changes to save.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await axios.patch(`${API_BASE}/auth/profile`, payload);
      const updated = res.data?.data;
      setProfileSuccess("Profile updated successfully!");
      onProfileUpdated({
        name: updated?.name ?? trimmedName,
        phone: updated?.phone ?? (trimmedPhone || null),
        businessName: updated?.businessName ?? (trimmedBusiness || null),
      });
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errObj.response?.data?.message || "Failed to update profile. Please try again.";
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }

    setSavingPassword(true);
    try {
      await axios.patch(`${API_BASE}/auth/change-password`, {
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      setPasswordSuccess("Password changed. Please log in again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        onLogout();
      }, 2000);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errObj.response?.data?.message || "Failed to change password. Please try again.";
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="settings-container">
      {/* Page Header */}
      <div className="settings-page-header">
        <div>
          <h2>Account & Business Settings</h2>
          <p>Manage your boutique profile information and secure access credentials.</p>
        </div>
      </div>

      <div className="settings-grid">
        {/* ---- Section 1: Business Profile ---- */}
        <section className="settings-card" aria-label="Business Profile Settings">
          <div className="settings-card-header">
            <div className="settings-header-title">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h3>Business Profile</h3>
            </div>
            <span className="settings-section-badge">Boutique Info</span>
          </div>

          <form onSubmit={handleSaveProfile} noValidate className="settings-form">
            <div className="settings-form-field">
              <label htmlFor="settings-owner-name">Owner Name</label>
              <input
                id="settings-owner-name"
                type="text"
                placeholder="Your full name"
                value={profileName}
                onChange={(e) => setProfileName(capitalizeFirstLetter(e.target.value))}
                onBlur={() => setProfileName((prev) => capitalizeFirstLetter(prev.trim()))}
                disabled={savingProfile}
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="settings-business-name">Business / Boutique Name</label>
              <input
                id="settings-business-name"
                type="text"
                placeholder="Shop or brand name"
                value={profileBusiness}
                onChange={(e) => setProfileBusiness(capitalizeFirstLetter(e.target.value))}
                onBlur={() => setProfileBusiness((prev) => capitalizeFirstLetter(prev.trim()))}
                disabled={savingProfile}
              />
              <span className="settings-field-hint">
                Shown to your customers on the public tracking portal and order receipts.
              </span>
            </div>

            <div className="settings-form-field">
              <label htmlFor="settings-phone">Contact Phone Number</label>
              <input
                id="settings-phone"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit Indian mobile number"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                disabled={savingProfile}
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="settings-email">Email Address</label>
              <input
                id="settings-email"
                type="email"
                value={ownerEmail}
                readOnly
                className="input-readonly"
              />
              <span className="settings-field-hint">
                Email address is used for primary authentication and cannot be changed.
              </span>
            </div>

            {profileError && (
              <div className="api-error-banner" role="alert">
                {profileError}
              </div>
            )}
            {profileSuccess && (
              <div className="success-banner" role="status">
                {profileSuccess}
              </div>
            )}

            <div className="settings-form-actions">
              <button
                type="submit"
                disabled={savingProfile}
                className="orders-btn orders-btn-primary"
              >
                {savingProfile ? "Saving Profile..." : "Save Profile"}
              </button>
            </div>
          </form>
        </section>

        {/* ---- Section 2: Change Password ---- */}
        <section className="settings-card" aria-label="Security and Password Settings">
          <div className="settings-card-header">
            <div className="settings-header-title">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <h3>Security & Password</h3>
            </div>
            <span className="settings-section-badge">Authentication</span>
          </div>

          <form onSubmit={handleChangePassword} noValidate className="settings-form">
            <div className="settings-form-field">
              <label htmlFor="settings-current-password">Current Password</label>
              <PasswordInput
                id="settings-current-password"
                placeholder="Enter your current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={savingPassword}
                autoComplete="current-password"
              />
            </div>

            <div className="settings-form-field">
              <label htmlFor="settings-new-password">New Password</label>
              <PasswordInput
                id="settings-new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={savingPassword}
                autoComplete="new-password"
              />
              <span className="settings-field-hint">
                Must be at least 8 characters long.
              </span>
            </div>

            <div className="settings-form-field">
              <label htmlFor="settings-confirm-password">Confirm New Password</label>
              <PasswordInput
                id="settings-confirm-password"
                placeholder="Repeat new password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={savingPassword}
                autoComplete="new-password"
              />
            </div>

            {passwordError && (
              <div className="api-error-banner" role="alert">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="success-banner" role="status">
                {passwordSuccess}
              </div>
            )}

            <div className="settings-form-actions">
              <button
                type="submit"
                disabled={savingPassword}
                className="orders-btn orders-btn-primary"
              >
                {savingPassword ? "Updating Password..." : "Change Password"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
