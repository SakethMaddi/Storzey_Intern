import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, radius, typography, shadows } from "../../../theme";
import { Badge } from "../../ui/Badge";
import { formatINR } from "../../../utils/currency";
import { formatDateTime } from "../../../utils/date";
import type { DashboardRecentPayment } from "../../../types/dashboard";

export interface RecentPaymentsListProps {
  payments: DashboardRecentPayment[];
  onPaymentPress?: (orderId: number) => void;
}

export function RecentPaymentsList({ payments, onPaymentPress }: RecentPaymentsListProps) {
  if (!payments || payments.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Collections</Text>
        </View>
        <Text style={styles.emptyText}>No recent payments collected yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Collections</Text>
      </View>

      {payments.map((payment, index) => {
        const orderId = payment.order?.id;
        return (
          <TouchableOpacity
            key={payment.id}
            activeOpacity={0.7}
            disabled={!onPaymentPress || !orderId}
            onPress={() => onPaymentPress && orderId && onPaymentPress(orderId)}
            style={[styles.itemRow, index === payments.length - 1 && styles.itemRowLast]}
          >
            <View style={styles.itemMain}>
              <Text style={styles.orderTitle} numberOfLines={1}>
                {payment.order?.itemName || `Order #${payment.id}`}
              </Text>
              <Text style={styles.metaText}>
                {payment.order?.customer?.name || "Client"} • {payment.paymentType} • {formatDateTime(payment.createdAt)}
              </Text>
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.amountText}>{formatINR(payment.amount)}</Text>
              <View style={styles.badgeWrapper}>
                <Badge status={payment.status} />
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
    ...shadows.sm,
  },
  header: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  title: {
    ...typography.h3,
    color: colors.slate[800],
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  itemRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  itemMain: {
    flex: 1,
    paddingRight: 12,
  },
  orderTitle: {
    ...typography.body,
    fontWeight: "600",
    color: colors.slate[900],
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 2,
  },
  itemRight: {
    alignItems: "flex-end",
  },
  amountText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.status.paid.dot,
  },
  badgeWrapper: {
    marginTop: 4,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.slate[400],
    fontStyle: "italic",
    paddingVertical: 12,
    textAlign: "center",
  },
});

