import { useState, useRef, useEffect } from "react";

export interface HeaderBarProps {
  ownerEmail: string;
  ownerName?: string;
  businessName?: string | null;
  onLogout: () => void;
  activeTab?: "dashboard" | "settings";
  onTabChange?: (tab: "dashboard" | "settings") => void;
}

export function HeaderBar({
  ownerEmail,
  ownerName,
  businessName,
  onLogout,
  activeTab = "dashboard",
  onTabChange,
}: HeaderBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }

    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [dropdownOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dropdownOpen]);

  // Compute initials for avatar (e.g. "Anusha Rao" -> "AR", "Deepa" -> "D")
  const displayName = ownerName?.trim() || ownerEmail.split("@")[0] || "Owner";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <header className="owner-top-bar" role="banner">
      {/* Left: Advance Pay Brand Logo */}
      <button
        type="button"
        onClick={() => onTabChange?.("dashboard")}
        className="owner-brand-btn"
        aria-label="Advance Pay Dashboard"
      >
        <span className="owner-brand-title">Advance Pay</span>
        {businessName && (
          <span className="owner-brand-badge" title={businessName}>
            {businessName}
          </span>
        )}
      </button>

      {/* Right: Owner Profile with Circular Avatar & Dropdown */}
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
          aria-label="Owner profile menu"
          className={`owner-profile-trigger ${dropdownOpen ? "open" : ""}`}
        >
          {/* Circular Avatar */}
          <div className="owner-profile-avatar" aria-hidden="true">
            {initials || "O"}
          </div>

          {/* Name & Email (desktop only, hidden on mobile for compact layout) */}
          <div className="owner-profile-text">
            <div className="owner-profile-name">{displayName}</div>
            <div className="owner-profile-email">{ownerEmail}</div>
          </div>

          {/* Chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`owner-profile-chevron ${dropdownOpen ? "rotated" : ""}`}
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Dropdown Menu */}
        {dropdownOpen && (
          <div role="menu" className="owner-profile-dropdown">
            {/* 1. Owner avatar, name and email */}
            <div className="dropdown-owner-header">
              <div className="dropdown-avatar" aria-hidden="true">
                {initials || "O"}
              </div>
              <div className="dropdown-owner-meta">
                <div className="dropdown-display-name">{displayName}</div>
                <div className="dropdown-email" title={ownerEmail}>
                  {ownerEmail}
                </div>
                {businessName && (
                  <div className="dropdown-business" title={businessName}>
                    {businessName}
                  </div>
                )}
              </div>
            </div>

            {/* Navigation options */}
            <div className="dropdown-nav-section">
              {/* 2. Dashboard */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  onTabChange?.("dashboard");
                }}
                className={`dropdown-item ${activeTab === "dashboard" ? "active" : ""}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span>Dashboard</span>
              </button>

              {/* 3. Business Profile & Settings */}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  onTabChange?.("settings");
                }}
                className={`dropdown-item ${activeTab === "settings" ? "active" : ""}`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <span>Business Profile & Settings</span>
              </button>
            </div>

            {/* 4. Sign Out */}
            <div className="dropdown-signout-section">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDropdownOpen(false);
                  onLogout();
                }}
                className="dropdown-signout-btn"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
