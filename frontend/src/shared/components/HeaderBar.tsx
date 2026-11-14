import { useState, useRef, useEffect } from "react";

export type NavTab =
  | "orders"
  | "customers"
  | "payments"
  | "reports"
  | "settings"
  | "new-order"
  | "dashboard"; // Kept for backwards compatibility, redirects to orders

export interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: "customers",
    label: "Customers",
    icon: (active) => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0284c7" : "currentColor"}
        strokeWidth={active ? "2.2" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "orders",
    label: "Orders",
    icon: (active) => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0284c7" : "currentColor"}
        strokeWidth={active ? "2.2" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
  {
    id: "payments",
    label: "Payments",
    icon: (active) => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0284c7" : "currentColor"}
        strokeWidth={active ? "2.2" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <path d="M6 15h2" />
        <path d="M12 15h6" />
      </svg>
    ),
  },
  {
    id: "reports",
    label: "Reports",
    icon: (active) => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0284c7" : "currentColor"}
        strokeWidth={active ? "2.2" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    id: "settings",
    label: "Settings",
    icon: (active) => (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? "#0284c7" : "currentColor"}
        strokeWidth={active ? "2.2" : "1.8"}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export interface HeaderBarProps {
  ownerEmail: string;
  ownerName?: string;
  businessName?: string | null;
  onLogout: () => void;
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

export function HeaderBar({
  ownerEmail,
  ownerName,
  businessName,
  onLogout,
  activeTab = "customers",
  onTabChange,
}: HeaderBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize active tab (if dashboard passed, treat as orders)
  const currentTab = activeTab === "dashboard" ? "orders" : activeTab;

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
    <>
      <div className="owner-chrome">
        <header className="owner-top-bar" role="banner">
        {/* Left: Advance Pay Brand Logo */}
        <div className="owner-top-left">
          <button
            type="button"
            onClick={() => onTabChange?.("customers")}
            className="owner-brand-btn"
            aria-label="Advance Pay Customers"
          >
            <div className="brand-mark-gem" aria-hidden="true">
              AP
            </div>
            <div className="brand-titles">
              <span className="owner-brand-title">Advance Pay</span>
              {businessName ? (
                <span className="owner-brand-badge" title={businessName}>
                  {businessName}
                </span>
              ) : (
                <span className="owner-brand-tag">Boutique Suite</span>
              )}
            </div>
          </button>
        </div>

        {/* Center: Desktop Clean Horizontal Navigation */}
        <nav className="desktop-nav-menu" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`desktop-nav-link ${isActive ? "is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={() => onTabChange?.(item.id)}
              >
                <span className="nav-link-icon">{item.icon(isActive)}</span>
                <span className="nav-link-label">{item.label}</span>
                {isActive && <span className="nav-link-indicator" />}
              </button>
            );
          })}
        </nav>

        {/* Right: Profile Avatar & Dropdown */}
        <div className="owner-top-right">
          <div style={{ position: "relative" }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={dropdownOpen}
              aria-label="Owner profile menu"
              className={`owner-profile-trigger ${dropdownOpen ? "open" : ""}`}
            >
              <div className="owner-profile-avatar" aria-hidden="true">
                {initials || "O"}
              </div>

              <div className="owner-profile-text">
                <div className="owner-profile-name">{displayName}</div>
                <div className="owner-profile-role">Owner</div>
              </div>

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

            {dropdownOpen && (
              <div role="menu" className="owner-profile-dropdown">
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

                <div className="dropdown-nav-section">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      onTabChange?.("customers");
                    }}
                    className={`dropdown-item ${currentTab === "customers" ? "active" : ""}`}
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
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Customers</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      onTabChange?.("orders");
                    }}
                    className={`dropdown-item ${currentTab === "orders" ? "active" : ""}`}
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
                      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                    <span>Orders</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setDropdownOpen(false);
                      onTabChange?.("settings");
                    }}
                    className={`dropdown-item ${currentTab === "settings" ? "active" : ""}`}
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
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    <span>Settings & Profile</span>
                  </button>
                </div>

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
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>

    {/* Mobile Fixed Bottom Navigation Bar (< 768px) */}
    <nav className="owner-mobile-bottom-nav" aria-label="Mobile Navigation">
      {NAV_ITEMS.map((item) => {
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`mobile-nav-btn ${isActive ? "is-active" : ""}`}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onTabChange?.(item.id)}
          >
            <span className="mobile-nav-icon">{item.icon(isActive)}</span>
            <span className="mobile-nav-label">{item.label}</span>
            {isActive && <span className="mobile-nav-active-pill" />}
          </button>
        );
      })}
    </nav>
  </>
);
}
