import React from "react";
import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, radius, typography } from "../../theme";

export type BadgeStatus =
  | "PAID"
  | "PARTIALLY_PAID"
  | "PENDING"
  | "CANCELLED"
  | "COMPLETED"
  | "CAPTURED"
  | "FAILED"
  | "ACTIVE";

export interface BadgeProps {
  status: BadgeStatus | string;
  label?: string;
  showDot?: boolean;
  style?: ViewStyle;
}

export function Badge({ status, label, showDot = true, style }: BadgeProps) {
  const normalized = (status || "").toUpperCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case "PAID":
      case "COMPLETED":
      case "CAPTURED":
        return {
          bg: colors.status.paid.background,
          border: colors.status.paid.border,
          text: colors.status.paid.text,
          dot: colors.status.paid.dot,
          defaultLabel: normalized === "PAID" ? "Paid" : "Completed",
        };
      case "PARTIALLY_PAID":
      case "IN_PROGRESS":
        return {
          bg: colors.status.partiallyPaid.background,
          border: colors.status.partiallyPaid.border,
          text: colors.status.partiallyPaid.text,
          dot: colors.status.partiallyPaid.dot,
          defaultLabel: normalized === "PARTIALLY_PAID" ? "Partial" : "In Progress",
        };
      case "PENDING":
        return {
          bg: colors.status.pending.background,
          border: colors.status.pending.border,
          text: colors.status.pending.text,
          dot: colors.status.pending.dot,
          defaultLabel: "Pending",
        };
      case "CANCELLED":
      case "FAILED":
        return {
          bg: colors.status.cancelled.background,
          border: colors.status.cancelled.border,
          text: colors.status.cancelled.text,
          dot: colors.status.cancelled.dot,
          defaultLabel: normalized === "CANCELLED" ? "Cancelled" : "Failed",
        };
      case "ACTIVE":
      default:
        return {
          bg: colors.powderBlue[50],
          border: colors.powderBlue[200],
          text: colors.powderBlue[700],
          dot: colors.primary,
          defaultLabel: status,
        };
    }
  };

  const config = getStatusConfig();
  const displayLabel = label || config.defaultLabel;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: config.bg, borderColor: config.border },
        style,
      ]}
    >
      {showDot && <View style={[styles.dot, { backgroundColor: config.dot }]} />}
      <Text style={[styles.text, { color: config.text }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    ...typography.caption,
    textTransform: "uppercase",
  },
});

