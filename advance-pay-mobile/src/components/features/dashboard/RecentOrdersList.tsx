import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors, radius, typography, shadows } from "../../../theme";
import { Badge } from "../../ui/Badge";
import { formatINR } from "../../../utils/currency";
import { formatDate } from "../../../utils/date";
import type { DashboardRecentOrder } from "../../../types/dashboard";

export interface RecentOrdersListProps {
  orders: DashboardRecentOrder[];
  onOrderPress?: (orderId: number) => void;
  onViewAll?: () => void;
}

export function RecentOrdersList({
  orders,
  onOrderPress,
  onViewAll,
}: RecentOrdersListProps) {
  if (!orders || orders.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>Recent Orders</Text>
        </View>
        <Text style={styles.emptyText}>No recent orders recorded yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Orders</Text>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        )}
      </View>

      {orders.map((order, index) => (
        <TouchableOpacity
          key={order.id}
          activeOpacity={0.7}
          disabled={!onOrderPress}
          onPress={() => onOrderPress && onOrderPress(order.id)}
          style={[styles.itemRow, index === orders.length - 1 && styles.itemRowLast]}
        >
          <View style={styles.itemMain}>
            <Text style={styles.itemName} numberOfLines={1}>
              {order.itemName}
            </Text>
            <Text style={styles.customerName}>
              {order.customer?.name || "Client"} • {formatDate(order.createdAt)}
            </Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.amountText}>{formatINR(order.totalAmount)}</Text>
            <View style={styles.badgeWrapper}>
              <Badge status={order.paymentStatus} />
            </View>
          </View>
        </TouchableOpacity>
      ))}
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
    marginBottom: 16,
    ...shadows.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  title: {
    ...typography.h3,
    color: colors.slate[800],
  },
  viewAllText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "600",
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
  itemName: {
    ...typography.body,
    fontWeight: "600",
    color: colors.slate[900],
  },
  customerName: {
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
    color: colors.slate[900],
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

