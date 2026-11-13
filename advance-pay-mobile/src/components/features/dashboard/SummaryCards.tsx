import React from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MetricCard } from "../../ui/MetricCard";
import { formatINR } from "../../../utils/currency";
import { colors } from "../../../theme";
import type { DashboardStats } from "../../../types/dashboard";

export interface SummaryCardsProps {
  stats: DashboardStats;
  onNavigateToOrders?: () => void;
  onNavigateToCustomers?: () => void;
}

export function SummaryCards({
  stats,
  onNavigateToOrders,
  onNavigateToCustomers,
}: SummaryCardsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.column}>
          <MetricCard
            label="Total Orders"
            value={stats.totalOrders}
            subtitle={`${stats.paidCount} paid • ${stats.partiallyPaidCount} partial`}
            variant="primary"
            icon={<Ionicons name="receipt-outline" size={16} color={colors.primary} />}
            onPress={onNavigateToOrders}
          />
        </View>
        <View style={styles.column}>
          <MetricCard
            label="Total Customers"
            value={stats.totalCustomers}
            subtitle="Active client profiles"
            variant="neutral"
            icon={<Ionicons name="people-outline" size={16} color={colors.powderBlue[600]} />}
            onPress={onNavigateToCustomers}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.column}>
          <MetricCard
            label="Revenue Collected"
            value={formatINR(stats.totalCollected)}
            subtitle="Captured & completed"
            variant="success"
            icon={<Ionicons name="cash-outline" size={16} color={colors.status.paid.dot} />}
          />
        </View>
        <View style={styles.column}>
          <MetricCard
            label="Outstanding Balance"
            value={formatINR(stats.totalOutstanding)}
            subtitle="To be collected"
            variant="warning"
            icon={<Ionicons name="time-outline" size={16} color={colors.status.partiallyPaid.dot} />}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  row: {
    flexDirection: "row",
    marginHorizontal: -6,
    marginBottom: 12,
  },
  column: {
    flex: 1,
    paddingHorizontal: 6,
  },
});

