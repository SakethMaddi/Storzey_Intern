import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCustomers } from "../../src/hooks/use-customers";
import { useCreateOrder } from "../../src/hooks/use-orders";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { formatINR } from "../../src/utils/currency";
import { formatIndianPhone } from "../../src/utils/phone";
import { colors, radius, typography, shadows } from "../../src/theme";
import type { Customer } from "../../src/types/customer";

const DEFAULT_STAGES = [
  "Order Placed",
  "Cutting",
  "Stitching",
  "Finishing",
  "Ready for Delivery",
];

export default function NewOrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ preselectedCustomerId?: string }>();
  const createOrderMutation = useCreateOrder();

  const { data: customersResponse, isLoading: loadingCustomers } = useCustomers({ limit: 100 });
  const customers = customersResponse?.data || [];

  // Form State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);

  const [itemName, setItemName] = useState("");
  const [totalAmountStr, setTotalAmountStr] = useState("");
  const [advanceStr, setAdvanceStr] = useState("");

  // Default promised date: 7 days from today in YYYY-MM-DD
  const getDefaultPromisedDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  };

  const [promisedDate, setPromisedDate] = useState(getDefaultPromisedDate());
  const [stages, setStages] = useState<string[]>([...DEFAULT_STAGES]);
  const [newStageName, setNewStageName] = useState("");

  // Review step modal / toggle
  const [isReviewing, setIsReviewing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Preselect customer if param provided
  useEffect(() => {
    if (params.preselectedCustomerId && customers.length > 0) {
      const match = customers.find((c) => String(c.id) === params.preselectedCustomerId);
      if (match) {
        setSelectedCustomer(match);
      }
    }
  }, [params.preselectedCustomerId, customers]);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
  );

  const totalAmount = parseInt(totalAmountStr, 10) || 0;
  const advance = parseInt(advanceStr, 10) || 0;
  const calculatedBalance = Math.max(0, totalAmount - advance);

  const validateForm = (): boolean => {
    setValidationError(null);
    if (!selectedCustomer) {
      setValidationError("Please select a customer for this order.");
      return false;
    }
    if (!itemName.trim()) {
      setValidationError("Please enter an item name or description.");
      return false;
    }
    if (totalAmount <= 0) {
      setValidationError("Total amount must be greater than ₹0.");
      return false;
    }
    if (advance < 0) {
      setValidationError("Advance amount cannot be negative.");
      return false;
    }
    if (advance > totalAmount) {
      setValidationError("Advance amount cannot exceed the total order amount.");
      return false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(promisedDate)) {
      setValidationError("Promised date must be in YYYY-MM-DD format.");
      return false;
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    if (promisedDate < todayStr) {
      setValidationError("Promised delivery date cannot be in the past.");
      return false;
    }
    return true;
  };

  const handleProceedToReview = () => {
    if (validateForm()) {
      setIsReviewing(true);
    }
  };

  const handleAddStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed) return;
    if (stages.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate Stage", "A stage with this name already exists in the list.");
      return;
    }
    if (stages.length >= 15) {
      Alert.alert("Stage Limit", "You can have a maximum of 15 production stages.");
      return;
    }
    setStages([...stages, trimmed]);
    setNewStageName("");
  };

  const handleRemoveStage = (index: number) => {
    setStages(stages.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = async () => {
    if (!selectedCustomer) return;
    try {
      const createdOrder = await createOrderMutation.mutateAsync({
        customerId: selectedCustomer.id,
        itemName: itemName.trim(),
        totalAmount,
        advance,
        promisedDate,
        stages: stages.length > 0 ? stages : undefined,
      });

      Alert.alert(
        "Order Created",
        `Order for "${createdOrder.itemName}" has been successfully booked.`,
        [
          {
            text: "View Order",
            onPress: () => router.replace(`/orders/${createdOrder.id}`),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error Creating Order", err?.message || "Failed to create order. Please try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (isReviewing ? setIsReviewing(false) : router.back())} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isReviewing ? "Review Order" : "New Order"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {validationError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={colors.status.cancelled.text} style={styles.errorIcon} />
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          )}

          {isReviewing ? (
            /* Review Step */
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Order Confirmation</Text>
              <Text style={styles.cardSubtitle}>Verify all details before final booking</Text>

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Customer</Text>
                <Text style={styles.reviewValue}>{selectedCustomer?.name}</Text>
                <Text style={styles.reviewSubvalue}>{formatIndianPhone(selectedCustomer?.phone)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Item Description</Text>
                <Text style={styles.reviewValue}>{itemName}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.financialReviewBox}>
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Total Order Amount:</Text>
                  <Text style={styles.financialValue}>{formatINR(totalAmount)}</Text>
                </View>
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Agreed Advance:</Text>
                  <Text style={styles.financialValue}>{formatINR(advance)}</Text>
                </View>
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Amount Paid at Booking:</Text>
                  <Text style={[styles.financialValue, { color: colors.slate[600] }]}>{formatINR(0)}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.financialRow}>
                  <Text style={[styles.financialLabel, { fontWeight: "700" }]}>Initial Outstanding Balance:</Text>
                  <Text style={[styles.financialValue, { color: colors.status.partiallyPaid.text, fontWeight: "700" }]}>
                    {formatINR(totalAmount)}
                  </Text>
                </View>
                {advance > 0 && (
                  <View style={[styles.financialRow, { marginTop: 4 }]}>
                    <Text style={[styles.financialLabel, { fontSize: 12, color: colors.slate[500] }]}>
                      Remaining after advance is collected:
                    </Text>
                    <Text style={[styles.financialValue, { fontSize: 12, color: colors.slate[600] }]}>
                      {formatINR(totalAmount - advance)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Promised Delivery Date</Text>
                <Text style={styles.reviewValue}>{promisedDate}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.reviewSection}>
                <Text style={styles.reviewLabel}>Production Stages ({stages.length})</Text>
                <View style={styles.stagesReviewList}>
                  {stages.map((stage, idx) => (
                    <Text key={idx} style={styles.stageReviewItem}>
                      {idx + 1}. {stage}
                    </Text>
                  ))}
                </View>
              </View>

              <View style={styles.buttonRow}>
                <Button
                  title="Edit Details"
                  variant="outline"
                  onPress={() => setIsReviewing(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Confirm & Book"
                  onPress={handleSubmitOrder}
                  loading={createOrderMutation.isPending}
                  style={{ flex: 1.5 }}
                />
              </View>
            </View>
          ) : (
            /* Input Step */
            <>
              {/* Step 1: Customer Selection */}
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>1. Customer Selection</Text>
                {selectedCustomer ? (
                  <View style={styles.selectedCustomerCard}>
                    <View style={styles.selectedCustomerAvatar}>
                      <Text style={styles.selectedCustomerAvatarText}>
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.selectedCustomerInfo}>
                      <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                      <Text style={styles.selectedCustomerPhone}>
                        {formatIndianPhone(selectedCustomer.phone)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedCustomer(null)}
                      style={styles.changeCustomerButton}
                    >
                      <Text style={styles.changeCustomerText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setShowCustomerPicker((prev) => !prev)}
                      style={styles.customerPickerToggle}
                    >
                      <Ionicons name="people-outline" size={20} color={colors.primary} />
                      <Text style={styles.customerPickerToggleText}>
                        {showCustomerPicker ? "Hide Customer Directory" : "Select Customer from Directory"}
                      </Text>
                      <Ionicons
                        name={showCustomerPicker ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={colors.slate[500]}
                      />
                    </TouchableOpacity>

                    {showCustomerPicker && (
                      <View style={styles.pickerContainer}>
                        <Input
                          placeholder="Search clients by name or phone..."
                          value={customerSearch}
                          onChangeText={setCustomerSearch}
                          leftIcon={<Ionicons name="search" size={16} color={colors.slate[400]} />}
                        />
                        {loadingCustomers ? (
                          <Text style={styles.loadingClientsText}>Loading clients...</Text>
                        ) : filteredCustomers.length === 0 ? (
                          <View style={styles.emptyClientBox}>
                            <Text style={styles.emptyClientText}>No clients found.</Text>
                            <TouchableOpacity onPress={() => router.push("/customers/new")}>
                              <Text style={styles.createClientLink}>+ Create New Customer</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.customerListContainer}>
                            {filteredCustomers.slice(0, 6).map((c) => (
                              <TouchableOpacity
                                key={c.id}
                                activeOpacity={0.7}
                                onPress={() => {
                                  setSelectedCustomer(c);
                                  setShowCustomerPicker(false);
                                }}
                                style={styles.customerPickerItem}
                              >
                                <View style={styles.pickerItemAvatar}>
                                  <Text style={styles.pickerItemAvatarText}>
                                    {c.name.charAt(0).toUpperCase()}
                                  </Text>
                                </View>
                                <View style={styles.pickerItemInfo}>
                                  <Text style={styles.pickerItemName}>{c.name}</Text>
                                  <Text style={styles.pickerItemPhone}>{formatIndianPhone(c.phone)}</Text>
                                </View>
                                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* Step 2: Order Details */}
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>2. Order Description & Amounts</Text>

                <Input
                  label="Item Name / Description *"
                  placeholder="e.g. Designer Bridal Lehenga"
                  value={itemName}
                  onChangeText={setItemName}
                  leftIcon={<Ionicons name="shirt-outline" size={18} color={colors.slate[400]} />}
                />

                <Input
                  label="Total Order Amount (₹) *"
                  placeholder="e.g. 15000"
                  keyboardType="numeric"
                  value={totalAmountStr}
                  onChangeText={(val) => setTotalAmountStr(val.replace(/\D/g, ""))}
                  leftIcon={<Text style={styles.currencySymbol}>₹</Text>}
                />

                <Input
                  label="Agreed Advance Payment (₹)"
                  placeholder="e.g. 5000"
                  keyboardType="numeric"
                  value={advanceStr}
                  onChangeText={(val) => setAdvanceStr(val.replace(/\D/g, ""))}
                  leftIcon={<Text style={styles.currencySymbol}>₹</Text>}
                />

                {totalAmount > 0 && (
                  <View style={styles.balanceSummaryBox}>
                    <View style={styles.balanceSummaryHeaderRow}>
                      <Text style={styles.balanceSummaryLabel}>Initial Outstanding Balance:</Text>
                      <Text style={styles.balanceSummaryAmount}>{formatINR(totalAmount)}</Text>
                    </View>
                    <Text style={styles.balanceSummaryHint}>
                      {advance > 0
                        ? `Amount paid starts at ₹0. Once agreed advance of ${formatINR(advance)} is recorded, remaining balance will be ${formatINR(totalAmount - advance)}.`
                        : "No advance agreed. The full order amount will be outstanding."}
                    </Text>
                  </View>
                )}

                <Input
                  label="Promised Delivery Date (YYYY-MM-DD) *"
                  placeholder="2026-12-01"
                  value={promisedDate}
                  onChangeText={setPromisedDate}
                  leftIcon={<Ionicons name="calendar-outline" size={18} color={colors.slate[400]} />}
                />
              </View>

              {/* Step 3: Production Stages Configuration */}
              <View style={styles.card}>
                <Text style={styles.sectionHeading}>3. Production Stages ({stages.length})</Text>
                <Text style={styles.sectionSubtext}>
                  Track your boutique's stitching & finishing progress
                </Text>

                <View style={styles.stagesList}>
                  {stages.map((stage, idx) => (
                    <View key={idx} style={styles.stageTag}>
                      <Text style={styles.stageIndex}>{idx + 1}</Text>
                      <Text style={styles.stageTagText}>{stage}</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveStage(idx)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={16} color={colors.slate[400]} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {stages.length < 15 && (
                  <View style={styles.addStageRow}>
                    <Input
                      placeholder="Add custom stage (e.g. Embroidery)"
                      value={newStageName}
                      onChangeText={setNewStageName}
                      style={{ marginBottom: 0 }}
                    />
                    <Button
                      title="Add"
                      variant="secondary"
                      size="sm"
                      onPress={handleAddStage}
                      style={styles.addStageButton}
                    />
                  </View>
                )}
              </View>

              <Button
                title="Review Order"
                onPress={handleProceedToReview}
                size="lg"
                style={styles.proceedButton}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  sectionHeading: {
    ...typography.h3,
    color: colors.slate[900],
    marginBottom: 12,
  },
  sectionSubtext: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginBottom: 14,
  },
  selectedCustomerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.powderBlue[50],
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    borderRadius: radius.md,
    padding: 12,
  },
  selectedCustomerAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectedCustomerAvatarText: {
    color: colors.white,
    fontWeight: "700",
  },
  selectedCustomerInfo: {
    flex: 1,
  },
  selectedCustomerName: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  selectedCustomerPhone: {
    ...typography.caption,
    color: colors.slate[600],
  },
  changeCustomerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  changeCustomerText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: "700",
  },
  customerPickerToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  customerPickerToggleText: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.slate[700],
    flex: 1,
    marginLeft: 8,
  },
  pickerContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
    paddingTop: 12,
  },
  loadingClientsText: {
    ...typography.caption,
    color: colors.slate[500],
    textAlign: "center",
    paddingVertical: 12,
  },
  emptyClientBox: {
    alignItems: "center",
    paddingVertical: 14,
  },
  emptyClientText: {
    ...typography.bodySmall,
    color: colors.slate[500],
  },
  createClientLink: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 4,
  },
  customerListContainer: {
    gap: 6,
  },
  customerPickerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.slate[50],
  },
  pickerItemAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  pickerItemAvatarText: {
    ...typography.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemName: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.slate[800],
  },
  pickerItemPhone: {
    ...typography.caption,
    color: colors.slate[500],
  },
  currencySymbol: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[500],
    marginRight: 4,
  },
  balanceSummaryBox: {
    backgroundColor: colors.powderBlue[50],
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  balanceSummaryHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  balanceSummaryLabel: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.slate[700],
  },
  balanceSummaryAmount: {
    ...typography.body,
    fontWeight: "700",
    color: colors.status.partiallyPaid.text,
  },
  balanceSummaryHint: {
    ...typography.caption,
    color: colors.slate[500],
    marginTop: 4,
    lineHeight: 16,
  },
  stagesList: {
    gap: 8,
    marginBottom: 14,
  },
  stageTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.slate[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  stageIndex: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
    marginRight: 8,
  },
  stageTagText: {
    ...typography.bodySmall,
    color: colors.slate[800],
    flex: 1,
  },
  addStageRow: {
    gap: 8,
  },
  addStageButton: {
    alignSelf: "flex-end",
    marginTop: -8,
    marginBottom: 4,
  },
  proceedButton: {
    marginTop: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.status.cancelled.background,
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.status.cancelled.text,
    flex: 1,
  },
  reviewSection: {
    paddingVertical: 6,
  },
  reviewLabel: {
    ...typography.caption,
    color: colors.slate[500],
    textTransform: "uppercase",
  },
  reviewValue: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
    marginTop: 2,
  },
  reviewSubvalue: {
    ...typography.bodySmall,
    color: colors.slate[600],
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginVertical: 10,
  },
  financialReviewBox: {
    backgroundColor: colors.slate[50],
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.slate[200],
  },
  financialRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  financialLabel: {
    ...typography.bodySmall,
    color: colors.slate[600],
  },
  financialValue: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  stagesReviewList: {
    gap: 4,
    marginTop: 6,
  },
  stageReviewItem: {
    ...typography.bodySmall,
    color: colors.slate[700],
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.slate[900],
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginBottom: 16,
  },
});
