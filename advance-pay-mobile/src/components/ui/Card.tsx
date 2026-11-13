import React from "react";
import { View, StyleSheet, type ViewProps } from "react-native";
import { colors, radius, shadows } from "../../theme";

export interface CardProps extends ViewProps {
  variant?: "default" | "elevated" | "flat" | "accent";
}

export function Card({ variant = "default", style, children, ...props }: CardProps) {
  const getVariantStyle = () => {
    switch (variant) {
      case "elevated":
        return styles.elevated;
      case "flat":
        return styles.flat;
      case "accent":
        return styles.accent;
      default:
        return styles.defaultCard;
    }
  };

  return (
    <View style={[styles.base, getVariantStyle(), style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    padding: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  defaultCard: {
    ...shadows.sm,
  },
  elevated: {
    ...shadows.md,
    borderColor: "transparent",
  },
  flat: {
    backgroundColor: colors.slate[50],
    borderColor: colors.border,
  },
  accent: {
    backgroundColor: colors.powderBlue[50],
    borderColor: colors.powderBlue[200],
  },
});

