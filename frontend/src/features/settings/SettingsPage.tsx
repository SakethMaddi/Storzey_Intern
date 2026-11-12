import { useState } from "react";
import axios from "axios";
import { API_BASE_URL } from "../../config";
import { PasswordInput } from "../../shared/components/PasswordInput";

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

    const trimmedName = profileName.trim();
    const trimmedPhone = profilePhone.trim();
    const trimmedBusiness = profileBusiness.trim();

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
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Failed to update profile. Please try again.";
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
    } catch (err: any) {
      const msg =
        err.response?.data?.message || "Failed to change password. Please try again.";
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 0 40px" }}>
      <h2 style={{ marginBottom: 24 }}>Settings</h2>

      {/* ---- Section 1: Business Profile ---- */}
      <div
        className="order-card"
        style={{ marginBottom: 24 }}
      >
        <h3 style={{ marginBottom: 16 }}>Business Profile</h3>
        <form onSubmit={handleSaveProfile} noValidate>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Owner Name
            </label>
            <input
              type="text"
              placeholder="Your name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              disabled={savingProfile}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Business Name
            </label>
            <input
              type="text"
              placeholder="Business / shop name"
              value={profileBusiness}
              onChange={(e) => setProfileBusiness(e.target.value)}
              disabled={savingProfile}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Phone Number
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="10-digit Indian mobile number"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
              disabled={savingProfile}
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Email
            </label>
            <input
              type="email"
              value={ownerEmail}
              readOnly
              style={{ background: "#f8fafc", color: "#64748b", cursor: "not-allowed" }}
            />
            <p style={{ fontSize: 12, color: "#64748b", margin: "-4px 0 8px" }}>
              Email cannot be changed.
            </p>
          </div>

          {profileError && (
            <div className="api-error-banner">{profileError}</div>
          )}
          {profileSuccess && (
            <div className="success-banner">{profileSuccess}</div>
          )}

          <button type="submit" disabled={savingProfile} style={{ marginTop: 8 }}>
            {savingProfile ? "Saving..." : "Save Profile"}
          </button>
        </form>
      </div>

      {/* ---- Section 2: Change Password ---- */}
      <div className="order-card">
        <h3 style={{ marginBottom: 16 }}>Change Password</h3>
        <form onSubmit={handleChangePassword} noValidate>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Current Password
            </label>
            <PasswordInput
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={savingPassword}
              autoComplete="current-password"
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              New Password
            </label>
            <PasswordInput
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={savingPassword}
              autoComplete="new-password"
            />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
              Confirm New Password
            </label>
            <PasswordInput
              placeholder="Repeat new password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              disabled={savingPassword}
              autoComplete="new-password"
            />
          </div>

          {passwordError && (
            <div className="api-error-banner">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="success-banner">{passwordSuccess}</div>
          )}

          <button type="submit" disabled={savingPassword} style={{ marginTop: 8 }}>
            {savingPassword ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
