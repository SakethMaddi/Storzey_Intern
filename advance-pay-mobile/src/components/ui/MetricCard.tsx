import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, type ViewStyle } from "react-native";
import { colors, radius, shadows, typography } from "../../theme";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "primary" | "warning" | "success" | "neutral";
  onPress?: () => void;
  style?: ViewStyle;
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon,
  variant = "neutral",
  onPress,
  style,
}: MetricCardProps) {
  const getAccentStyle = () => {
    switch (variant) {
      case "primary":
        return styles.accentPrimary;
      case "success":
        return styles.accentSuccess;
      case "warning":
        return styles.accentWarning;
      default:
        return styles.accentNeutral;
    }
  };

  const Content = (
    <View style={[styles.card, getAccentStyle(), style]}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
      </View>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {Content}
      </TouchableOpacity>
    );
  }

  return Content;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  accentPrimary: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  accentSuccess: {
    borderLeftWidth: 4,
    borderLeftColor: colors.status.paid.dot,
  },
  accentWarning: {
    borderLeftWidth: 4,
    borderLeftColor: colors.status.partiallyPaid.dot,
  },
  accentNeutral: {
    borderLeftWidth: 4,
    borderLeftColor: colors.powderBlue[400],
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    ...typography.caption,
    color: colors.slate[500],
    textTransform: "uppercase",
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.powderBlue[50],
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    ...typography.metric,
    color: colors.slate[900],
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 4,
  },
});

