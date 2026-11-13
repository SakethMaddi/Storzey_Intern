import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOrders } from "../../src/hooks/use-orders";
import { OrderCard } from "../../src/components/features/orders/OrderCard";
import { LoadingSkeleton } from "../../src/components/ui/LoadingSkeleton";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { ErrorState } from "../../src/components/ui/ErrorState";
import { colors, radius, typography } from "../../src/theme";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "PARTIALLY_PAID", label: "Partial" },
  { key: "PAID", label: "Paid" },
];

export default function OrdersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useOrders({
    search: search.trim() || undefined,
    status: selectedStatus || undefined,
    archived: "false",
  });

  const orders = response?.data || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Boutique Orders</Text>
          <Text style={styles.headerSubtitle}>
            {orders.length} order{orders.length === 1 ? "" : "s"} listed
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push("/orders/new")}
          style={styles.addButton}
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <Text style={styles.addButtonText}>New Order</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.slate[400]} />
          <TextInput
            placeholder="Search by item name or order details..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.slate[400]} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status Filter Horizontal Pills */}
      <View style={styles.filterScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {STATUS_FILTERS.map((filter) => {
            const isSelected = selectedStatus === filter.key;
            return (
              <TouchableOpacity
                key={filter.label}
                activeOpacity={0.7}
                onPress={() => setSelectedStatus(filter.key)}
                style={[styles.statusPill, isSelected && styles.statusPillSelected]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    isSelected && styles.statusPillTextSelected,
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => router.push(`/orders/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
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
        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton message="Loading orders..." />
          ) : isError ? (
            <ErrorState
              title="Failed to Load Orders"
              message={(error as any)?.message || "Could not retrieve order list."}
              refId={(error as any)?.refId}
              onRetry={() => refetch()}
            />
          ) : (
            <EmptyState
              title={search ? "No Orders Found" : "No Orders Yet"}
              message={
                search
                  ? `No orders matched "${search}".`
                  : "Orders placed by boutique customers will appear here."
              }
              iconName="receipt-outline"
              actionTitle="New Order"
              onAction={() => router.push("/orders/new")}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  addButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "700",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: colors.white,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.slate[50],
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 40,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    ...typography.body,
    fontSize: 14,
    color: colors.textPrimary,
  },
  filterScrollWrapper: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 10,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate[50],
  },
  statusPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  statusPillText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  statusPillTextSelected: {
    color: colors.white,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
});
