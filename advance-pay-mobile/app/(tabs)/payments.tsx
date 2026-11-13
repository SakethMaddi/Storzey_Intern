import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDashboardStats } from "../../src/hooks/use-dashboard";
import { formatINR } from "../../src/utils/currency";
import { formatDateTime } from "../../src/utils/date";
import { Badge } from "../../src/components/ui/Badge";
import { LoadingSkeleton } from "../../src/components/ui/LoadingSkeleton";
import { ErrorState } from "../../src/components/ui/ErrorState";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { colors, radius, typography, shadows } from "../../src/theme";

export default function PaymentsScreen() {
  const router = useRouter();
  const { data: stats, isLoading, isError, error, refetch, isRefetching } = useDashboardStats();

  const recentPayments = stats?.recentPayments || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Payments & Collections</Text>
          <Text style={styles.headerSubtitle}>Verified settlements and receipts</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading && !isRefetching ? (
          <LoadingSkeleton message="Loading payment records..." />
        ) : isError ? (
          <ErrorState
            title="Failed to Load Payments"
            message={(error as any)?.message || "Could not retrieve collections."}
            refId={(error as any)?.refId}
            onRetry={() => refetch()}
          />
        ) : stats ? (
          <>
            {/* Top Revenue Summary Banner */}
            <View style={styles.bannerCard}>
              <View style={styles.bannerHeader}>
                <Ionicons name="wallet-outline" size={20} color={colors.primary} />
                <Text style={styles.bannerLabel}>Total Completed Revenue</Text>
              </View>
              <Text style={styles.bannerAmount}>
                {formatINR(stats.totalCollected)}
              </Text>
              <View style={styles.bannerFooter}>
                <Text style={styles.bannerSubtext}>
                  Outstanding to collect: {formatINR(stats.totalOutstanding)}
                </Text>
              </View>
            </View>

            {/* Recent Payments Section */}
            <Text style={styles.sectionHeader}>Settlement History</Text>

            {recentPayments.length === 0 ? (
              <EmptyState
                title="No Collections Yet"
                message="Payments received from customers via Razorpay or manual records will appear here."
                iconName="cash-outline"
              />
            ) : (
              recentPayments.map((payment) => {
                const orderId = payment.order?.id;
                return (
                  <TouchableOpacity
                    key={payment.id}
                    activeOpacity={0.7}
                    disabled={!orderId}
                    onPress={() => orderId && router.push(`/orders/${orderId}`)}
                    style={styles.paymentCard}
                  >
                    <View style={styles.paymentHeader}>
                      <View style={styles.paymentLeft}>
                        <Text style={styles.paymentOrderName} numberOfLines={1}>
                          {payment.order?.itemName || `Order #${payment.id}`}
                        </Text>
                        <Text style={styles.paymentCustomer}>
                          Customer: {payment.order?.customer?.name || "Client"}
                        </Text>
                      </View>
                      <Text style={styles.paymentAmount}>{formatINR(payment.amount)}</Text>
                    </View>

                    <View style={styles.paymentFooter}>
                      <View style={styles.metaBadge}>
                        <Text style={styles.metaBadgeText}>{payment.paymentType}</Text>
                      </View>
                      <Badge status={payment.status} />
                      <Text style={styles.paymentDate}>
                        {formatDateTime(payment.createdAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.primaryNavy,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    flexGrow: 1,
  },
  bannerCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    marginBottom: 20,
    ...shadows.sm,
  },
  bannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  bannerLabel: {
    ...typography.caption,
    color: colors.slate[500],
    textTransform: "uppercase",
  },
  bannerAmount: {
    ...typography.h1,
    color: colors.primaryNavy,
    fontSize: 32,
    lineHeight: 38,
  },
  bannerFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  bannerSubtext: {
    ...typography.bodySmall,
    color: colors.status.partiallyPaid.text,
    fontWeight: "600",
  },
  sectionHeader: {
    ...typography.h3,
    color: colors.slate[800],
    marginBottom: 12,
  },
  paymentCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  paymentHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  paymentLeft: {
    flex: 1,
    paddingRight: 10,
  },
  paymentOrderName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  paymentCustomer: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 2,
  },
  paymentAmount: {
    ...typography.body,
    fontWeight: "700",
    color: colors.status.paid.dot,
    fontSize: 16,
  },
  paymentFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  metaBadge: {
    backgroundColor: colors.slate[100],
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.xs,
  },
  metaBadgeText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  paymentDate: {
    ...typography.caption,
    color: colors.slate[400],
  },
});
