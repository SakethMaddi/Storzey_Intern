import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useOrder,
  useCancelOrder,
  useArchiveOrder,
  useRestoreOrder,
  useUpdateStage,
} from "../../src/hooks/use-orders";
import { useRecordPayment } from "../../src/hooks/use-payments";
import { apiClient } from "../../src/lib/api-client";
import { formatINR } from "../../src/utils/currency";
import { formatDate, formatDateTime } from "../../src/utils/date";
import { formatIndianPhone } from "../../src/utils/phone";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { LoadingSkeleton } from "../../src/components/ui/LoadingSkeleton";
import { colors, radius, typography, shadows } from "../../src/theme";
import type { PaymentType } from "../../src/types/payment";

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const router = useRouter();

  const { data: order, isLoading, isError, error, refetch } = useOrder(orderId);
  const cancelOrderMutation = useCancelOrder();
  const archiveOrderMutation = useArchiveOrder();
  const restoreOrderMutation = useRestoreOrder();
  const updateStageMutation = useUpdateStage();
  const recordPaymentMutation = useRecordPayment();

  // Cancel Order Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Computed Financial Metrics
  const payments = order?.payments || [];
  const stages = order?.stages || [];
  const totalPaid = order ? Math.max(0, order.totalAmount - order.balance) : 0;
  const paidAdvance = payments
    .filter((p) => p.paymentType === "ADVANCE" && (p.status === "COMPLETED" || p.status === "CAPTURED"))
    .reduce((sum, p) => sum + p.amount, 0);
  const remainingAdvance = Math.max(0, (order?.advance ?? 0) - paidAdvance);

  // Record Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmountStr, setPaymentAmountStr] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("BALANCE");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Stage Advancement Handler
  const handleStagePress = async (stage: { id: number; name: string; status: string }) => {
    if (order?.status === "CANCELLED") {
      Alert.alert("Order Cancelled", "Production milestones cannot be updated because this order is cancelled.");
      return;
    }
    if (updateStageMutation.isPending) return;

    let nextStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED" = "IN_PROGRESS";
    if (stage.status === "PENDING") {
      nextStatus = "IN_PROGRESS";
    } else if (stage.status === "IN_PROGRESS") {
      nextStatus = "COMPLETED";
    } else {
      nextStatus = "PENDING";
    }

    try {
      await updateStageMutation.mutateAsync({
        stageId: stage.id,
        status: nextStatus,
        orderId,
      });
      refetch();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to update production stage.");
    }
  };

  // Cancel Order Handler
  const handleCancelOrderSubmit = async () => {
    if (!cancelReason.trim()) {
      setCancelError("A reason is required to cancel this order.");
      return;
    }
    setCancelError(null);

    try {
      await cancelOrderMutation.mutateAsync({
        id: orderId,
        reason: cancelReason.trim(),
      });
      setShowCancelModal(false);
      setCancelReason("");
      refetch();
      Alert.alert("Order Cancelled", "This order has been marked as cancelled.");
    } catch (err: any) {
      setCancelError(err?.message || "Failed to cancel order.");
    }
  };

  // Archive / Restore Order Handler
  const handleArchiveToggle = () => {
    if (!order) return;
    const action = order.isArchived ? "Restore" : "Archive";

    Alert.alert(
      `${action} Order`,
      `Are you sure you want to ${action.toLowerCase()} this order record?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          style: order.isArchived ? "default" : "destructive",
          onPress: async () => {
            try {
              if (order.isArchived) {
                await restoreOrderMutation.mutateAsync(orderId);
              } else {
                await archiveOrderMutation.mutateAsync(orderId);
              }
              refetch();
            } catch (err: any) {
              Alert.alert("Error", err?.message || `Failed to ${action.toLowerCase()} order.`);
            }
          },
        },
      ]
    );
  };

  // Record Manual Payment Handler
  const openRecordPaymentModal = () => {
    if (!order) return;
    const defaultType: PaymentType = remainingAdvance > 0 ? "ADVANCE" : "BALANCE";
    setPaymentType(defaultType);
    const suggestedAmount =
      defaultType === "ADVANCE"
        ? Math.min(remainingAdvance, order.balance)
        : order.balance;
    setPaymentAmountStr(String(suggestedAmount > 0 ? suggestedAmount : 1000));
    setPaymentError(null);
    setShowPaymentModal(true);
  };

  const handleRecordPaymentSubmit = () => {
    if (recordPaymentMutation.isPending) return; // Prevent duplicate submissions

    const amount = parseInt(paymentAmountStr, 10);
    if (!amount || amount <= 0) {
      setPaymentError("Please enter a valid amount greater than ₹0.");
      return;
    }
    if (amount > (order?.balance ?? 0)) {
      setPaymentError(`Payment amount cannot exceed the remaining balance of ${formatINR(order?.balance)}.`);
      return;
    }

    if (paymentType === "ADVANCE") {
      if (remainingAdvance <= 0) {
        setPaymentError("Advance payment has already been completed for this order. Please record as Balance.");
        return;
      }
      if (amount > remainingAdvance) {
        setPaymentError(`Advance payment amount exceeds remaining advance due of ${formatINR(remainingAdvance)}.`);
        return;
      }
    }

    Alert.alert(
      "Confirm Payment",
      `Record in-person payment of ${formatINR(amount)} as ${paymentType}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Payment",
          onPress: async () => {
            try {
              await recordPaymentMutation.mutateAsync({
                orderId,
                data: { amount, paymentType },
              });
              setShowPaymentModal(false);
              refetch();
              Alert.alert("Payment Recorded", `${formatINR(amount)} has been credited to this order.`);
            } catch (err: any) {
              setPaymentError(err?.message || "Failed to record payment.");
            }
          },
        },
      ]
    );
  };

  // Cancel Payment Handler
  const handleCancelPayment = (paymentId: number, amount: number) => {
    Alert.alert(
      "Cancel Payment",
      `Are you sure you want to cancel the payment of ${formatINR(amount)}? The order balance will be adjusted automatically.`,
      [
        { text: "Dismiss", style: "cancel" },
        {
          text: "Cancel Payment",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.patch(`/payments/${paymentId}/cancel`, {
                reason: "Cancelled by boutique owner on mobile app",
              });
              refetch();
              Alert.alert("Payment Cancelled", "The payment record was marked cancelled and balance updated.");
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Failed to cancel payment.");
            }
          },
        },
      ]
    );
  };

  if (isLoading && !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingSkeleton message="Loading order details..." />
      </SafeAreaView>
    );
  }

  if (isError || !order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notFoundContainer}>
          <Ionicons name="receipt-outline" size={56} color={colors.slate[400]} />
          <Text style={styles.notFoundTitle}>Order Not Found</Text>
          <Text style={styles.notFoundSubtitle}>
            {(error as any)?.message || "This order could not be located in your boutique records."}
          </Text>
          <Button title="Back to Orders" onPress={() => router.back()} style={{ marginTop: 16 }} />
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
        <Text style={styles.headerTitle}>Order #{order.id}</Text>
        <Badge status={order.paymentStatus} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Item Title & Core Status Card */}
        <View style={styles.card}>
          <Text style={styles.itemName}>{order.itemName}</Text>
          <Text style={styles.orderCreatedAt}>Booked on {formatDate(order.createdAt)}</Text>

          <View style={styles.tagsRow}>
            <Badge status={order.paymentStatus} />
            {order.status === "CANCELLED" && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>Order Cancelled</Text>
              </View>
            )}
            {order.isArchived && (
              <View style={styles.archivedBadge}>
                <Text style={styles.archivedBadgeText}>Archived</Text>
              </View>
            )}
          </View>

          {order.cancellationReason && (
            <View style={styles.cancellationNotice}>
              <Text style={styles.cancellationNoticeTitle}>Cancellation Reason:</Text>
              <Text style={styles.cancellationNoticeText}>{order.cancellationReason}</Text>
            </View>
          )}
        </View>

        {/* Customer Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Customer Information</Text>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.customerAvatarText}>
                {(order.customer?.name || "C").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.customerDetails}>
              <Text style={styles.customerNameText}>{order.customer?.name}</Text>
              <Text style={styles.customerPhoneText}>
                {formatIndianPhone(order.customer?.phone)}
              </Text>
            </View>
            {order.customer?.phone && (
              <TouchableOpacity
                onPress={() => Linking.openURL(`tel:${order.customer?.phone}`)}
                style={styles.callIconBtn}
              >
                <Ionicons name="call" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Financial Summary Card */}
        <View style={styles.card}>
          <View style={styles.cardHeadingRow}>
            <Text style={styles.cardHeading}>Financial Breakdown</Text>
            {order.balance > 0 && order.status !== "CANCELLED" && (
              <TouchableOpacity onPress={openRecordPaymentModal} style={styles.recordPaymentHeaderBtn}>
                <Ionicons name="add-circle" size={16} color={colors.primary} />
                <Text style={styles.recordPaymentHeaderText}>Record Payment</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.financialTable}>
            <View style={styles.financialTableRow}>
              <Text style={styles.financialTableLabel}>Total Order Amount</Text>
              <Text style={styles.financialTableValue}>{formatINR(order.totalAmount)}</Text>
            </View>
            <View style={styles.financialTableRow}>
              <Text style={styles.financialTableLabel}>Agreed Advance</Text>
              <Text style={styles.financialTableValue}>{formatINR(order.advance)}</Text>
            </View>
            <View style={styles.financialTableRow}>
              <Text style={styles.financialTableLabel}>Total Paid to Date</Text>
              <Text style={[styles.financialTableValue, { color: colors.status.paid.dot }]}>
                {formatINR(totalPaid)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.financialTableRow}>
              <Text style={[styles.financialTableLabel, { fontWeight: "700" }]}>Balance Remaining</Text>
              <Text
                style={[
                  styles.financialTableValue,
                  order.balance > 0 ? { color: colors.status.partiallyPaid.text } : { color: colors.status.paid.dot },
                ]}
              >
                {formatINR(order.balance)}
              </Text>
            </View>
          </View>

          <View style={styles.promisedDateRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.slate[500]} />
            <Text style={styles.promisedDateText}>
              Promised Delivery: <Text style={{ fontWeight: "700" }}>{order.promisedDate ? formatDate(order.promisedDate) : "Not set"}</Text>
            </Text>
          </View>
        </View>

        {/* Production Stages Card */}
        {stages.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Production Progress</Text>
            <Text style={styles.sectionSubtitle}>
              {order.status === "CANCELLED"
                ? "Production milestones are frozen because this order has been cancelled."
                : "Tap any stage to advance its status (Pending → In Progress → Done)"}
            </Text>

            <View style={styles.stagesList}>
              {stages.map((stage, idx) => {
                const isCompleted = stage.status === "COMPLETED";
                const isInProgress = stage.status === "IN_PROGRESS";

                return (
                  <TouchableOpacity
                    key={stage.id}
                    activeOpacity={0.7}
                    disabled={order.status === "CANCELLED" || updateStageMutation.isPending}
                    onPress={() => handleStagePress(stage)}
                    style={[
                      styles.stageItem,
                      isCompleted && styles.stageItemCompleted,
                      isInProgress && styles.stageItemInProgress,
                    ]}
                  >
                    <View style={styles.stageStatusIconBox}>
                      {isCompleted ? (
                        <Ionicons name="checkmark-circle" size={20} color={colors.status.paid.dot} />
                      ) : isInProgress ? (
                        <Ionicons name="hourglass" size={20} color={colors.primary} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color={colors.slate[400]} />
                      )}
                    </View>
                    <View style={styles.stageTextContainer}>
                      <Text style={[styles.stageName, isCompleted && styles.stageNameCompleted]}>
                        {idx + 1}. {stage.name}
                      </Text>
                      <Text style={styles.stageStatusLabel}>
                        Status: <Text style={{ fontWeight: "700" }}>{stage.status}</Text>
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.slate[300]} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Payment History for this Order */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Order Payment History ({payments.length})</Text>

          {payments.length === 0 ? (
            <Text style={styles.emptyPaymentsText}>No payments recorded for this order yet.</Text>
          ) : (
            payments.map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <View style={styles.paymentRowLeft}>
                  <Text
                    style={[
                      styles.paymentAmountText,
                      p.status === "CANCELLED" && styles.paymentAmountCancelled,
                    ]}
                  >
                    {formatINR(p.amount)}
                  </Text>
                  <Text style={styles.paymentMetaText}>
                    {p.paymentType} • {formatDateTime(p.createdAt)}
                  </Text>
                </View>
                <View style={styles.paymentRowRight}>
                  <Badge status={p.status} />
                  {p.status !== "CANCELLED" && order.status !== "CANCELLED" && (
                    <TouchableOpacity
                      onPress={() => handleCancelPayment(p.id, p.amount)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.cancelPaymentLink}
                    >
                      <Text style={styles.cancelPaymentLinkText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          {order.status !== "CANCELLED" && (
            <Button
              title="Cancel Order"
              variant="danger"
              onPress={() => {
                setCancelReason("");
                setCancelError(null);
                setShowCancelModal(true);
              }}
              icon={<Ionicons name="close-circle-outline" size={18} color={colors.status.cancelled.text} />}
            />
          )}

          <TouchableOpacity onPress={handleArchiveToggle} style={styles.archiveOrderButton}>
            <Text style={styles.archiveOrderButtonText}>
              {order.isArchived ? "Restore Archived Order" : "Archive Order Record"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Record Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Record Manual Payment</Text>
            <Text style={styles.modalSubtitle}>
              Log an in-person, cash or UPI transfer received from {order.customer?.name}
            </Text>

            {paymentError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{paymentError}</Text>
              </View>
            )}

            <Input
              label="Payment Amount (₹) *"
              value={paymentAmountStr}
              keyboardType="numeric"
              onChangeText={(val) => setPaymentAmountStr(val.replace(/\D/g, ""))}
              leftIcon={<Text style={{ fontWeight: "700", color: colors.slate[500] }}>₹</Text>}
            />

            <Text style={styles.modalTypeLabel}>Payment Type</Text>
            <View style={styles.paymentTypeRow}>
              {(["ADVANCE", "BALANCE"] as PaymentType[]).map((type) => {
                const isAdvanceSettled = type === "ADVANCE" && remainingAdvance <= 0;
                return (
                  <TouchableOpacity
                    key={type}
                    disabled={isAdvanceSettled}
                    onPress={() => {
                      setPaymentType(type);
                      setPaymentError(null);
                      if (type === "ADVANCE") {
                        setPaymentAmountStr(String(Math.min(remainingAdvance, order.balance)));
                      } else {
                        setPaymentAmountStr(String(order.balance));
                      }
                    }}
                    style={[
                      styles.typePill,
                      paymentType === type && styles.typePillSelected,
                      isAdvanceSettled && { opacity: 0.4 },
                    ]}
                  >
                    <Text style={[styles.typePillText, paymentType === type && styles.typePillTextSelected]}>
                      {type === "ADVANCE"
                        ? isAdvanceSettled
                          ? "Advance (Settled)"
                          : `Advance (${formatINR(remainingAdvance)})`
                        : `Balance (${formatINR(order.balance)})`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtonRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowPaymentModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save Payment"
                onPress={handleRecordPaymentSubmit}
                loading={recordPaymentMutation.isPending}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.status.cancelled.text }]}>
              Cancel Order #{order.id}
            </Text>
            <Text style={styles.modalSubtitle}>
              A cancellation reason is required for boutique audit and client records.
            </Text>

            {cancelError && (
              <View style={styles.modalErrorBox}>
                <Text style={styles.modalErrorText}>{cancelError}</Text>
              </View>
            )}

            <Input
              label="Cancellation Reason *"
              placeholder="e.g. Customer requested cancellation due to change of event date"
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={3}
              style={{ minHeight: 70 }}
            />

            <View style={styles.modalButtonRow}>
              <Button
                title="Keep Order"
                variant="outline"
                onPress={() => setShowCancelModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Confirm Cancel"
                variant="danger"
                onPress={handleCancelOrderSubmit}
                loading={cancelOrderMutation.isPending}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...shadows.sm,
  },
  cardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardHeading: {
    ...typography.h3,
    color: colors.slate[900],
  },
  recordPaymentHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recordPaymentHeaderText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  itemName: {
    ...typography.h2,
    color: colors.slate[900],
  },
  orderCreatedAt: {
    ...typography.caption,
    color: colors.slate[500],
    marginTop: 2,
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelledBadge: {
    backgroundColor: colors.status.cancelled.background,
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  cancelledBadgeText: {
    ...typography.caption,
    color: colors.status.cancelled.text,
    fontWeight: "700",
  },
  archivedBadge: {
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[300],
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
  },
  archivedBadgeText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  cancellationNotice: {
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.status.cancelled.background,
    borderRadius: radius.md,
  },
  cancellationNoticeTitle: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.status.cancelled.text,
  },
  cancellationNoticeText: {
    ...typography.bodySmall,
    color: colors.slate[700],
    marginTop: 2,
  },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  customerAvatarText: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: "700",
  },
  customerDetails: {
    flex: 1,
  },
  customerNameText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  customerPhoneText: {
    ...typography.bodySmall,
    color: colors.slate[600],
    marginTop: 1,
  },
  callIconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[50],
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    alignItems: "center",
    justifyContent: "center",
  },
  financialTable: {
    backgroundColor: colors.slate[50],
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  financialTableRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  financialTableLabel: {
    ...typography.bodySmall,
    color: colors.slate[600],
  },
  financialTableValue: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[200],
    marginVertical: 6,
  },
  promisedDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  promisedDateText: {
    ...typography.bodySmall,
    color: colors.slate[700],
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.slate[500],
    marginBottom: 12,
    marginTop: -4,
  },
  stagesList: {
    gap: 8,
  },
  stageItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 10,
  },
  stageItemCompleted: {
    backgroundColor: colors.status.paid.background,
    borderColor: colors.status.paid.border,
  },
  stageItemInProgress: {
    backgroundColor: colors.powderBlue[50],
    borderColor: colors.powderBlue[200],
  },
  stageStatusIconBox: {
    marginRight: 10,
  },
  stageTextContainer: {
    flex: 1,
  },
  stageName: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.slate[900],
  },
  stageNameCompleted: {
    color: colors.status.paid.text,
  },
  stageStatusLabel: {
    ...typography.caption,
    color: colors.slate[500],
    marginTop: 2,
  },
  emptyPaymentsText: {
    ...typography.bodySmall,
    color: colors.slate[400],
    fontStyle: "italic",
    paddingVertical: 8,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate[100],
  },
  paymentRowLeft: {
    flex: 1,
  },
  paymentAmountText: {
    ...typography.body,
    fontWeight: "700",
    color: colors.status.paid.dot,
  },
  paymentAmountCancelled: {
    color: colors.slate[400],
    textDecorationLine: "line-through",
  },
  paymentMetaText: {
    ...typography.caption,
    color: colors.slate[500],
    marginTop: 2,
  },
  paymentRowRight: {
    alignItems: "flex-end",
  },
  cancelPaymentLink: {
    marginTop: 4,
  },
  cancelPaymentLinkText: {
    ...typography.caption,
    color: colors.status.cancelled.text,
    fontWeight: "600",
  },
  actionsSection: {
    gap: 12,
    marginTop: 8,
  },
  archiveOrderButton: {
    alignItems: "center",
    paddingVertical: 10,
  },
  archiveOrderButtonText: {
    ...typography.caption,
    color: colors.slate[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
    ...shadows.lg,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.slate[900],
  },
  modalSubtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 4,
    marginBottom: 16,
  },
  modalErrorBox: {
    backgroundColor: colors.status.cancelled.background,
    borderRadius: radius.md,
    padding: 10,
    marginBottom: 12,
  },
  modalErrorText: {
    ...typography.caption,
    color: colors.status.cancelled.text,
  },
  modalTypeLabel: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.slate[700],
    marginBottom: 8,
  },
  paymentTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  typePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.slate[50],
  },
  typePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typePillText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  typePillTextSelected: {
    color: colors.white,
    fontWeight: "700",
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
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

