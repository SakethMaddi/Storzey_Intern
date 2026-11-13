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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCustomers } from "../../src/hooks/use-customers";
import { CustomerCard } from "../../src/components/features/customers/CustomerCard";
import { LoadingSkeleton } from "../../src/components/ui/LoadingSkeleton";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { ErrorState } from "../../src/components/ui/ErrorState";
import { colors, radius, typography } from "../../src/theme";

export default function CustomersScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState<"false" | "true">("false");

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useCustomers({
    search: search.trim() || undefined,
    archived: showArchived,
  });

  const customers = response?.data || [];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Customers</Text>
          <Text style={styles.headerSubtitle}>
            {customers.length} {showArchived === "true" ? "archived" : "active"} clients
          </Text>
        </View>

        <View style={styles.headerActions}>
          {/* Archival Toggle */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              setShowArchived((prev) => (prev === "false" ? "true" : "false"))
            }
            style={[
              styles.filterPill,
              showArchived === "true" && styles.filterPillActive,
            ]}
          >
            <Ionicons
              name={showArchived === "true" ? "archive" : "archive-outline"}
              size={14}
              color={showArchived === "true" ? colors.white : colors.slate[600]}
            />
          </TouchableOpacity>

          {/* Add Customer Button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push("/customers/new")}
            style={styles.addButton}
          >
            <Ionicons name="add" size={18} color={colors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.slate[400]} />
          <TextInput
            placeholder="Search by customer name or phone..."
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

      {/* List */}
      <FlatList
        data={customers}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <CustomerCard
            customer={item}
            onPress={() => router.push(`/customers/${item.id}`)}
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
            <LoadingSkeleton message="Loading customer directory..." />
          ) : isError ? (
            <ErrorState
              title="Failed to Load Customers"
              message={(error as any)?.message || "Could not fetch customer records."}
              refId={(error as any)?.refId}
              onRetry={() => refetch()}
            />
          ) : (
            <EmptyState
              title={search ? "No Matches Found" : "No Customers Yet"}
              message={
                search
                  ? `No customers matched "${search}".`
                  : "Add your first boutique customer to start managing orders."
              }
              iconName="people-outline"
              actionTitle="Add Customer"
              onAction={() => router.push("/customers/new")}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterPill: {
    padding: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate[50],
  },
  filterPillActive: {
    backgroundColor: colors.slate[700],
    borderColor: colors.slate[700],
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
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
});
