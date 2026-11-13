import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, typography } from "../../theme";
import { Button } from "./Button";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  refId?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load the requested data. Please try again.",
  refId,
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.status.cancelled.text} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {refId && <Text style={styles.refId}>Reference ID: {refId}</Text>}
      {onRetry && (
        <Button
          title="Try Again"
          onPress={onRetry}
          variant="outline"
          size="sm"
          style={styles.retryButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: radius.full,
    backgroundColor: colors.status.cancelled.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    ...typography.h3,
    color: colors.slate[800],
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    ...typography.bodySmall,
    color: colors.slate[600],
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  refId: {
    ...typography.caption,
    color: colors.slate[400],
    marginTop: 6,
  },
  retryButton: {
    marginTop: 18,
  },
});

