import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { colors, radius, typography } from "../../theme";

export interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case "primary":
        return styles.primaryContainer;
      case "secondary":
        return styles.secondaryContainer;
      case "outline":
        return styles.outlineContainer;
      case "danger":
        return styles.dangerContainer;
      case "ghost":
        return styles.ghostContainer;
    }
  };

  const getTextStyle = (): TextStyle => {
    switch (variant) {
      case "primary":
        return styles.primaryText;
      case "secondary":
        return styles.secondaryText;
      case "outline":
        return styles.outlineText;
      case "danger":
        return styles.dangerText;
      case "ghost":
        return styles.ghostText;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case "sm":
        return styles.sizeSm;
      case "md":
        return styles.sizeMd;
      case "lg":
        return styles.sizeLg;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      disabled={isDisabled}
      style={[
        styles.base,
        getSizeStyle(),
        getContainerStyle(),
        isDisabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? colors.white : colors.primary}
        />
      ) : (
        <>
          {icon && <>{icon}</>}
          <Text style={[getTextStyle(), icon ? styles.textWithIcon : undefined]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
  },
  sizeMd: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    minHeight: 46,
  },
  sizeLg: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    minHeight: 52,
  },
  primaryContainer: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    ...typography.button,
    color: colors.white,
  },
  secondaryContainer: {
    backgroundColor: colors.powderBlue[100],
  },
  secondaryText: {
    ...typography.button,
    color: colors.powderBlue[700],
  },
  outlineContainer: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  outlineText: {
    ...typography.button,
    color: colors.slate[700],
  },
  dangerContainer: {
    backgroundColor: colors.status.cancelled.background,
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
  },
  dangerText: {
    ...typography.button,
    color: colors.status.cancelled.text,
  },
  ghostContainer: {
    backgroundColor: "transparent",
  },
  ghostText: {
    ...typography.button,
    color: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  textWithIcon: {
    marginLeft: 8,
  },
});

