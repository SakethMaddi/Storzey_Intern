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

type SettingsTab = "business" | "owner" | "contact" | "security";

export function SettingsPage({
  ownerEmail,
  ownerName,
  ownerPhone,
  businessName,
  onLogout,
  onProfileUpdated,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("business");

  // --- Profile State ---
  const [profileName, setProfileName] = useState(ownerName);
  const [profilePhone, setProfilePhone] = useState(ownerPhone ?? "");
  const [profileBusiness, setProfileBusiness] = useState(businessName ?? "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // --- Password State ---
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

    // Build only changed fields
    const payload: { name?: string; phone?: string; businessName?: string } = {};
    if (trimmedName && trimmedName !== ownerName) payload.name = trimmedName;
    if (trimmedPhone !== (ownerPhone ?? "")) {
      payload.phone = trimmedPhone || undefined;
    }
    if (trimmedBusiness !== (businessName ?? "")) {
      payload.businessName = trimmedBusiness;
    }

    if (Object.keys(payload).length === 0) {
      setProfileError("No changes detected to save.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await axios.patch(`${API_BASE}/auth/profile`, payload);
      const updated = res.data?.data;
      setProfileSuccess("Settings updated successfully!");
      onProfileUpdated({
        name: updated?.name ?? trimmedName,
        phone: updated?.phone ?? (trimmedPhone || null),
        businessName: updated?.businessName ?? (trimmedBusiness || null),
      });
      setTimeout(() => setProfileSuccess(""), 3500);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errObj.response?.data?.message || "Failed to update settings. Please try again.";
      setProfileError(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetProfile = () => {
    setProfileName(ownerName);
    setProfilePhone(ownerPhone ?? "");
    setProfileBusiness(businessName ?? "");
    setProfileError("");
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
      setPasswordSuccess("Password changed successfully. Redirecting to login...");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        onLogout();
      }, 1800);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      const msg =
        errObj.response?.data?.message || "Failed to change password. Please check your current password.";
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="boutique-section" aria-label="Settings">
      {/* ── 1. HEADER ── */}
      <div className="section-header-row">
        <div>
          <h1 className="section-title">Settings & Profile</h1>
          <p className="section-subtitle">
            Configure your boutique profile, owner credentials, and account security.
          </p>
        </div>
      </div>

      {/* ── 2. TABS NAVIGATION ── */}
      <div className="settings-tabs-row" role="tablist" aria-label="Settings navigation">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "business"}
          className={`settings-tab-btn ${activeTab === "business" ? "is-active" : ""}`}
          onClick={() => setActiveTab("business")}
        >
          <span className="tab-icon">🏪</span>
          <span>Business Profile</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "owner"}
          className={`settings-tab-btn ${activeTab === "owner" ? "is-active" : ""}`}
          onClick={() => setActiveTab("owner")}
        >
          <span className="tab-icon">👤</span>
          <span>Owner Information</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "contact"}
          className={`settings-tab-btn ${activeTab === "contact" ? "is-active" : ""}`}
          onClick={() => setActiveTab("contact")}
        >
          <span className="tab-icon">📞</span>
          <span>Contact Details</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "security"}
          className={`settings-tab-btn ${activeTab === "security" ? "is-active" : ""}`}
          onClick={() => setActiveTab("security")}
        >
          <span className="tab-icon">🔒</span>
          <span>Account & Security</span>
        </button>
      </div>

      {/* ── 3. TAB PANELS ── */}
      <div className="settings-panel-container">
        {/* Tab 1: Business Profile */}
        {activeTab === "business" && (
          <form onSubmit={handleSaveProfile} noValidate className="settings-card-form">
            <div className="panel-header">
              <h3>Boutique Identity</h3>
              <p>This brand name appears on invoices, receipts, and customer tracking pages.</p>
            </div>

            {profileSuccess && <div className="inline-alert alert-success">{profileSuccess}</div>}
            {profileError && <div className="inline-alert alert-error">{profileError}</div>}

            <div className="field-group">
              <label htmlFor="settings-business-name" className="field-label">
                Business / Boutique Name
              </label>
              <input
                id="settings-business-name"
                type="text"
                placeholder="e.g. Saffron Bridal Studio, Royal Tailors"
                value={profileBusiness}
                onChange={(e) => setProfileBusiness(capitalizeFirstLetter(e.target.value))}
                onBlur={() => setProfileBusiness((prev) => capitalizeFirstLetter(prev.trim()))}
                disabled={savingProfile}
                className="input-text"
              />
              <span className="field-hint">Displayed in customer headers and printable documents.</span>
            </div>

            <div className="settings-actions-footer">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleResetProfile}
                className="btn-ghost"
              >
                Reset
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Owner Information */}
        {activeTab === "owner" && (
          <form onSubmit={handleSaveProfile} noValidate className="settings-card-form">
            <div className="panel-header">
              <h3>Owner Information</h3>
              <p>Primary account holder name and boutique administrator identity.</p>
            </div>

            {profileSuccess && <div className="inline-alert alert-success">{profileSuccess}</div>}
            {profileError && <div className="inline-alert alert-error">{profileError}</div>}

            <div className="field-group">
              <label htmlFor="settings-owner-name" className="field-label">
                Owner Full Name
              </label>
              <input
                id="settings-owner-name"
                type="text"
                placeholder="e.g. Anusha Rao"
                value={profileName}
                onChange={(e) => setProfileName(capitalizeFirstLetter(e.target.value))}
                onBlur={() => setProfileName((prev) => capitalizeFirstLetter(prev.trim()))}
                disabled={savingProfile}
                className="input-text"
              />
              <span className="field-hint">Appears in your profile badge and signature.</span>
            </div>

            <div className="settings-actions-footer">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleResetProfile}
                className="btn-ghost"
              >
                Reset
              </button>
            </div>
          </form>
        )}

        {/* Tab 3: Contact Details */}
        {activeTab === "contact" && (
          <form onSubmit={handleSaveProfile} noValidate className="settings-card-form">
            <div className="panel-header">
              <h3>Contact Details</h3>
              <p>Manage store communication channels and verify your registered email address.</p>
            </div>

            {profileSuccess && <div className="inline-alert alert-success">{profileSuccess}</div>}
            {profileError && <div className="inline-alert alert-error">{profileError}</div>}

            <div className="field-group">
              <label htmlFor="settings-owner-phone" className="field-label">
                Owner Mobile Number
              </label>
              <input
                id="settings-owner-phone"
                type="tel"
                placeholder="10-digit Indian phone (e.g. 9876543210)"
                maxLength={10}
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                disabled={savingProfile}
                className="input-text"
              />
              <span className="field-hint">For owner account notifications and verification.</span>
            </div>

            <div className="field-group">
              <label htmlFor="settings-owner-email" className="field-label">
                Registered Login Email <span className="badge-readonly">Non-editable</span>
              </label>
              <input
                id="settings-owner-email"
                type="email"
                value={ownerEmail}
                readOnly
                disabled
                className="input-text is-readonly"
              />
              <span className="field-hint">Your login email is securely locked to your account.</span>
            </div>

            <div className="settings-actions-footer">
              <button type="submit" disabled={savingProfile} className="btn-primary">
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                disabled={savingProfile}
                onClick={handleResetProfile}
                className="btn-ghost"
              >
                Reset
              </button>
            </div>
          </form>
        )}

        {/* Tab 4: Account & Security */}
        {activeTab === "security" && (
          <form onSubmit={handleChangePassword} noValidate className="settings-card-form">
            <div className="panel-header">
              <h3>Account & Password Security</h3>
              <p>Update your master login password to protect your store ledger and customer data.</p>
            </div>

            {passwordSuccess && <div className="inline-alert alert-success">{passwordSuccess}</div>}
            {passwordError && <div className="inline-alert alert-error">{passwordError}</div>}

            <div className="field-group">
              <label htmlFor="settings-current-password" className="field-label">
                Current Password <span className="req-star">*</span>
              </label>
              <PasswordInput
                id="settings-current-password"
                placeholder="Enter existing password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={savingPassword}
                required
              />
            </div>

            <div className="form-grid-two">
              <div className="field-group">
                <label htmlFor="settings-new-password" className="field-label">
                  New Password <span className="req-star">*</span>
                </label>
                <PasswordInput
                  id="settings-new-password"
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                  required
                />
              </div>

              <div className="field-group">
                <label htmlFor="settings-confirm-password" className="field-label">
                  Confirm New Password <span className="req-star">*</span>
                </label>
                <PasswordInput
                  id="settings-confirm-password"
                  placeholder="Re-type new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  disabled={savingPassword}
                  required
                />
              </div>
            </div>

            <div className="settings-actions-footer">
              <button type="submit" disabled={savingPassword} className="btn-primary">
                {savingPassword ? "Updating Password..." : "Change Password"}
              </button>
              <button
                type="button"
                disabled={savingPassword}
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmNewPassword("");
                  setPasswordError("");
                }}
                className="btn-ghost"
              >
                Clear
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
