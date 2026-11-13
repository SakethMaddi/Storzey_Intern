/**
 * Advance Pay Mobile Design System
 * Theme: Powder Blue, White, and Slate
 * Style: Premium, minimal boutique management
 */

export const colors = {
  // Brand & Primaries
  primary: "#2563EB", // Blue 600
  primaryDark: "#1D4ED8", // Blue 700
  primaryNavy: "#1E3A8A", // Blue 900
  primaryDeep: "#1E40AF", // Blue 800

  // Powder Blue Accents
  powderBlue: {
    50: "#F0F9FF",
    100: "#E0F2FE", // Soft Powder Blue highlight
    200: "#BAE6FD",
    300: "#7DD3FC",
    400: "#38BDF8",
    500: "#0EA5E9",
    600: "#0284C7",
    700: "#0369A1",
  },

  // Slate Neutrals
  slate: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },

  // Base
  white: "#FFFFFF",
  background: "#F4F6FB", // Soft cool background
  surface: "#FFFFFF",
  surfaceMuted: "#F8FAFC",
  border: "#E2E8F0",
  borderFocus: "#2563EB",

  // Text
  textPrimary: "#1E293B",
  textSecondary: "#475569",
  textMuted: "#64748B",
  textLight: "#94A3B8",
  textInverse: "#FFFFFF",

  // Semantic Status Colors
  status: {
    paid: {
      text: "#047857",
      background: "#ECFDF5",
      border: "#A7F3D0",
      dot: "#10B981",
    },
    partiallyPaid: {
      text: "#B45309",
      background: "#FFFBEB",
      border: "#FDE68A",
      dot: "#F59E0B",
    },
    pending: {
      text: "#0369A1",
      background: "#E0F2FE",
      border: "#BAE6FD",
      dot: "#0284C7",
    },
    cancelled: {
      text: "#B91C1C",
      background: "#FEF2F2",
      border: "#FECACA",
      dot: "#EF4444",
    },
    completed: {
      text: "#047857",
      background: "#ECFDF5",
      border: "#A7F3D0",
      dot: "#10B981",
    },
    inProgress: {
      text: "#1D4ED8",
      background: "#EFF6FF",
      border: "#BFDBFE",
      dot: "#3B82F6",
    },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700" as const,
    color: colors.primaryNavy,
  },
  h2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700" as const,
    color: colors.primaryDeep,
  },
  h3: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600" as const,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "500" as const,
    color: colors.textSecondary,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
    color: colors.textPrimary,
  },
  bodySmall: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
    color: colors.textMuted,
  },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600" as const,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  button: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600" as const,
  },
  metric: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
};

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
};

export default theme;

