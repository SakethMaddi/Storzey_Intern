import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../../theme";

export interface HeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function Header({ title, subtitle, rightAction }: HeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {rightAction && <View style={styles.actionContainer}>{rightAction}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    ...typography.h2,
    color: colors.primaryNavy,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 2,
  },
  actionContainer: {
    marginLeft: 12,
  },
});

