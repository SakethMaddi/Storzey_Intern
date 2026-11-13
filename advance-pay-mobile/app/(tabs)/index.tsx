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
import { useAuth } from "../../src/hooks/use-auth";
import { useDashboardStats } from "../../src/hooks/use-dashboard";
import { SummaryCards } from "../../src/components/features/dashboard/SummaryCards";
import { QuickActions } from "../../src/components/features/dashboard/QuickActions";
import { RecentOrdersList } from "../../src/components/features/dashboard/RecentOrdersList";
import { RecentPaymentsList } from "../../src/components/features/dashboard/RecentPaymentsList";
import { LoadingSkeleton } from "../../src/components/ui/LoadingSkeleton";
import { ErrorState } from "../../src/components/ui/ErrorState";
import { colors, radius, typography } from "../../src/theme";

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: stats, isLoading, isError, error, refetch, isRefetching } = useDashboardStats();

  const businessDisplayName = user?.businessName || "Advance Pay Boutique";
  const ownerName = user?.name || "Owner";

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Boutique Navigation Header */}
      <View style={styles.topHeader}>
        <View style={styles.greetingContainer}>
          <Text style={styles.businessBadge}>{businessDisplayName}</Text>
          <Text style={styles.greetingTitle}>Hello, {ownerName}</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push("/(tabs)/settings")}
          style={styles.profileButton}
        >
          <Ionicons name="person-circle-outline" size={32} color={colors.primaryNavy} />
        </TouchableOpacity>
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
          <LoadingSkeleton message="Loading boutique metrics..." />
        ) : isError ? (
          <ErrorState
            title="Failed to Load Dashboard"
            message={(error as any)?.message || "Could not retrieve live metrics."}
            refId={(error as any)?.refId}
            onRetry={() => refetch()}
          />
        ) : stats ? (
          <>
            {/* 1. Summary Cards */}
            <SummaryCards
              stats={stats}
              onNavigateToOrders={() => router.push("/(tabs)/orders")}
              onNavigateToCustomers={() => router.push("/(tabs)/customers")}
            />

            {/* 2. Quick Actions */}
            <QuickActions
              onNewOrder={() => router.push("/orders/new")}
              onNewCustomer={() => router.push("/customers/new")}
              onRefresh={() => refetch()}
            />

            {/* 3. Recent Orders */}
            <RecentOrdersList
              orders={stats.recentOrders}
              onOrderPress={(orderId) => router.push(`/orders/${orderId}`)}
              onViewAll={() => router.push("/(tabs)/orders")}
            />

            {/* 4. Recent Collections */}
            <RecentPaymentsList
              payments={stats.recentPayments}
              onPaymentPress={(orderId) => router.push(`/orders/${orderId}`)}
            />
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
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  greetingContainer: {
    flex: 1,
  },
  businessBadge: {
    ...typography.caption,
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  greetingTitle: {
    ...typography.h2,
    color: colors.slate[900],
    marginTop: 2,
  },
  profileButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
});
