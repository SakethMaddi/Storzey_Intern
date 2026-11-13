import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCustomers, useUpdateCustomer, useArchiveCustomer } from "../../src/hooks/use-customers";
import { useOrders } from "../../src/hooks/use-orders";
import { formatIndianPhone } from "../../src/utils/phone";
import { formatDate } from "../../src/utils/date";
import { formatINR } from "../../src/utils/currency";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { LoadingSkeleton } from "../../src/components/ui/LoadingSkeleton";
import { colors, radius, typography, shadows } from "../../src/theme";
import type { Customer } from "../../src/types/customer";

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const router = useRouter();

  const { data: customerResponse, isLoading: loadingCustomers, refetch } = useCustomers({
    archived: "all",
  });
  const updateCustomerMutation = useUpdateCustomer();
  const archiveCustomerMutation = useArchiveCustomer();

  const customer: Customer | undefined = customerResponse?.data?.find(
    (c) => c.id === customerId
  );

  // Load orders associated with this customer
  const { data: ordersResponse, isLoading: loadingOrders } = useOrders({
    search: customer?.name || undefined,
  });

  const customerOrders = (ordersResponse?.data || []).filter(
    (o) => o.customerId === customerId || o.customer?.id === customerId
  );

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const startEditing = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setEditEmail(customer.email || "");
    setEditError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!customer) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError("Customer name is required.");
      return;
    }
    if (editPhone.trim().length !== 10 || !/^[6-9]\d{9}$/.test(editPhone.trim())) {
      setEditError("Please enter a valid 10-digit Indian phone number starting with 6–9.");
      return;
    }

    try {
      await updateCustomerMutation.mutateAsync({
        id: customer.id,
        data: {
          name: editName.trim(),
          phone: editPhone.trim(),
          email: editEmail.trim() ? editEmail.trim().toLowerCase() : null,
        },
      });
      setIsEditing(false);
      refetch();
    } catch (err: any) {
      setEditError(err?.message || "Failed to update customer details.");
    }
  };

  const handleArchiveToggle = () => {
    if (!customer) return;
    const action = customer.isArchived ? "Restore" : "Archive";

    Alert.alert(
      `${action} Customer`,
      `Are you sure you want to ${action.toLowerCase()} ${customer.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          style: customer.isArchived ? "default" : "destructive",
          onPress: async () => {
            try {
              await archiveCustomerMutation.mutateAsync(customer.id);
              refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.message || `Failed to ${action.toLowerCase()} customer.`);
            }
          },
        },
      ]
    );
  };

  const handleCall = () => {
    if (!customer?.phone) return;
    Linking.openURL(`tel:${customer.phone}`);
  };

  if (loadingCustomers && !customer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSkeleton message="Loading customer profile..." />
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Profile</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notFoundContainer}>
          <Ionicons name="person-circle-outline" size={56} color={colors.slate[400]} />
          <Text style={styles.notFoundTitle}>Customer Not Found</Text>
          <Text style={styles.notFoundSubtitle}>
            This customer could not be found or belongs to another owner.
          </Text>
          <Button title="Back to Customers" onPress={() => router.back()} style={{ marginTop: 16 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Profile</Text>
        <TouchableOpacity
          onPress={isEditing ? () => setIsEditing(false) : startEditing}
          style={styles.editHeaderButton}
        >
          <Text style={styles.editHeaderButtonText}>{isEditing ? "Cancel" : "Edit"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.customerName}>{customer.name}</Text>
              <Text style={styles.customerPhone}>{formatIndianPhone(customer.phone)}</Text>
              {customer.isArchived && (
                <View style={styles.archivedBadge}>
                  <Text style={styles.archivedBadgeText}>Archived Client</Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Call Button */}
          <TouchableOpacity activeOpacity={0.8} onPress={handleCall} style={styles.callButton}>
            <Ionicons name="call" size={16} color={colors.primary} />
            <Text style={styles.callButtonText}>Call {formatIndianPhone(customer.phone)}</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Details / Inline Edit Mode */}
          {isEditing ? (
            <View style={styles.editForm}>
              {editError && <Text style={styles.errorText}>{editError}</Text>}
              <Input
                label="Full Name"
                value={editName}
                onChangeText={setEditName}
                leftIcon={<Ionicons name="person-outline" size={16} color={colors.slate[400]} />}
              />
              <Input
                label="Phone (10 digits)"
                value={editPhone}
                maxLength={10}
                keyboardType="phone-pad"
                onChangeText={setEditPhone}
                leftIcon={<Ionicons name="call-outline" size={16} color={colors.slate[400]} />}
              />
              <Input
                label="Email (Optional)"
                value={editEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                onChangeText={setEditEmail}
                leftIcon={<Ionicons name="mail-outline" size={16} color={colors.slate[400]} />}
              />
              <Button
                title="Save Changes"
                onPress={handleSaveEdit}
                loading={updateCustomerMutation.isPending}
                size="md"
              />
            </View>
          ) : (
            <View style={styles.detailsList}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>{customer.email || "Not specified"}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Client Since</Text>
                <Text style={styles.detailValue}>{formatDate(customer.createdAt)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Customer ID</Text>
                <Text style={styles.detailValue}>#{customer.id}</Text>
              </View>
            </View>
          )}

          {/* Archive / Restore Button */}
          {!isEditing && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleArchiveToggle}
              style={styles.archiveActionRow}
            >
              <Ionicons
                name={customer.isArchived ? "refresh-circle-outline" : "archive-outline"}
                size={18}
                color={customer.isArchived ? colors.primary : colors.status.cancelled.text}
              />
              <Text
                style={[
                  styles.archiveActionText,
                  customer.isArchived ? { color: colors.primary } : undefined,
                ]}
              >
                {customer.isArchived ? "Restore Customer" : "Archive Customer"}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Order History Section */}
        <View style={styles.ordersHeaderRow}>
          <Text style={styles.sectionTitle}>
            Order History ({customerOrders.length})
          </Text>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() =>
              router.push({
                pathname: "/orders/new",
                params: { preselectedCustomerId: String(customer.id) },
              })
            }
            style={styles.newOrderLink}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text style={styles.newOrderLinkText}>New Order</Text>
          </TouchableOpacity>
        </View>

        {loadingOrders ? (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 20 }} />
        ) : customerOrders.length === 0 ? (
          <View style={styles.emptyOrdersCard}>
            <Ionicons name="receipt-outline" size={32} color={colors.slate[400]} />
            <Text style={styles.emptyOrdersTitle}>No Orders Yet</Text>
            <Text style={styles.emptyOrdersDesc}>
              No orders have been recorded for {customer.name} yet.
            </Text>
          </View>
        ) : (
          customerOrders.map((order) => (
            <TouchableOpacity
              key={order.id}
              activeOpacity={0.7}
              onPress={() => router.push(`/orders/${order.id}`)}
              style={styles.orderItemCard}
            >
              <View style={styles.orderTopRow}>
                <Text style={styles.orderItemName} numberOfLines={1}>
                  {order.itemName}
                </Text>
                <Badge status={order.paymentStatus} />
              </View>
              <View style={styles.orderBottomRow}>
                <Text style={styles.orderMeta}>
                  Total: {formatINR(order.totalAmount)} • Balance: {formatINR(order.balance)}
                </Text>
                <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.primaryNavy,
  },
  editHeaderButton: {
    padding: 6,
  },
  editHeaderButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    ...shadows.sm,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  avatarText: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  customerName: {
    ...typography.h2,
    color: colors.slate[900],
  },
  customerPhone: {
    ...typography.body,
    color: colors.slate[600],
    marginTop: 2,
  },
  archivedBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.slate[100],
    borderRadius: radius.full,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.slate[300],
  },
  archivedBadgeText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.powderBlue[50],
    borderRadius: radius.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    marginTop: 16,
  },
  callButtonText: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginVertical: 16,
  },
  detailsList: {
    gap: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.slate[500],
  },
  detailValue: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.slate[800],
  },
  archiveActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  archiveActionText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.status.cancelled.text,
  },
  editForm: {
    gap: 4,
  },
  errorText: {
    ...typography.caption,
    color: colors.status.cancelled.text,
    marginBottom: 8,
  },
  ordersHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.slate[800],
  },
  newOrderLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  newOrderLinkText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
  },
  emptyOrdersCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  emptyOrdersTitle: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[700],
    marginTop: 8,
  },
  emptyOrdersDesc: {
    ...typography.caption,
    color: colors.slate[500],
    textAlign: "center",
    marginTop: 4,
  },
  orderItemCard: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    ...shadows.sm,
  },
  orderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  orderItemName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
    flex: 1,
    paddingRight: 8,
  },
  orderBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  orderMeta: {
    ...typography.caption,
    color: colors.slate[600],
  },
  orderDate: {
    ...typography.caption,
    color: colors.slate[400],
  },
  notFoundContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  notFoundTitle: {
    ...typography.h2,
    color: colors.slate[800],
    marginTop: 12,
  },
  notFoundSubtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    textAlign: "center",
    marginTop: 6,
  },
});

