import React from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { colors, radius, typography } from "../../theme";

export interface LoadingSkeletonProps {
  message?: string;
}

export function LoadingSkeleton({ message = "Loading..." }: LoadingSkeletonProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 12,
  },
});

