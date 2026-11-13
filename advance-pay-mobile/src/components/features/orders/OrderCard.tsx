import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, typography, shadows } from "../../../theme";
import { Badge } from "../../ui/Badge";
import { formatINR } from "../../../utils/currency";
import { formatDate } from "../../../utils/date";
import type { Order } from "../../../types/order";

export interface OrderCardProps {
  order: Order;
  onPress?: () => void;
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={!onPress}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.titleContainer}>
          <Text style={styles.itemName} numberOfLines={1}>
            {order.itemName}
          </Text>
          <Text style={styles.customerName}>
            Client: {order.customer?.name || `Customer #${order.customerId}`}
          </Text>
        </View>
        <Badge status={order.paymentStatus} />
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Total</Text>
          <Text style={styles.metricValue}>{formatINR(order.totalAmount)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Agreed Adv.</Text>
          <Text style={styles.metricValue}>{formatINR(order.advance)}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Balance</Text>
          <Text
            style={[
              styles.metricValue,
              order.balance > 0 ? styles.balancePending : styles.balanceCleared,
            ]}
          >
            {formatINR(order.balance)}
          </Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <View style={styles.dateItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.slate[400]} />
          <Text style={styles.dateText}>
            Promised: {order.promisedDate ? formatDate(order.promisedDate) : "Not set"}
          </Text>
        </View>
        {order.status === "CANCELLED" && (
          <View style={styles.cancelledTag}>
            <Text style={styles.cancelledText}>Cancelled</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    paddingRight: 10,
  },
  itemName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  customerName: {
    ...typography.bodySmall,
    color: colors.slate[600],
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: colors.slate[50],
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    height: "80%",
    backgroundColor: colors.slate[200],
    alignSelf: "center",
  },
  metricLabel: {
    ...typography.caption,
    color: colors.slate[500],
    marginBottom: 2,
  },
  metricValue: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.slate[900],
  },
  balancePending: {
    color: colors.status.partiallyPaid.text,
  },
  balanceCleared: {
    color: colors.status.paid.text,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateText: {
    ...typography.caption,
    color: colors.slate[500],
  },
  cancelledTag: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.status.cancelled.background,
  },
  cancelledText: {
    ...typography.caption,
    color: colors.status.cancelled.text,
  },
});

