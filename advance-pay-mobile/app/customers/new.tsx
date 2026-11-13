import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useCreateCustomer } from "../../src/hooks/use-customers";
import { customerFormSchema, type CustomerFormInput } from "../../src/validation/customer.schema";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, typography, shadows } from "../../src/theme";
import type { ApiError } from "../../src/types/api";

export default function NewCustomerScreen() {
  const router = useRouter();
  const createCustomerMutation = useCreateCustomer();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CustomerFormInput>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
    },
  });

  const onSubmit = async (data: CustomerFormInput) => {
    setServerError(null);
    try {
      await createCustomerMutation.mutateAsync({
        name: data.name.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() ? data.email.trim().toLowerCase() : null,
      });

      Alert.alert("Customer Created", `${data.name} has been added to your boutique client list.`, [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const apiErr = err as ApiError;
      if (apiErr?.status === 409) {
        setServerError(apiErr.message || "A customer with this phone number already exists.");
      } else {
        setServerError(apiErr?.message || "Failed to create customer. Please check your inputs.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primaryNavy} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Customer</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Client Information</Text>
            <Text style={styles.cardSubtitle}>
              Register a customer to place orders and receive payment receipts
            </Text>

            {serverError && (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.status.cancelled.text}
                  style={styles.errorIcon}
                />
                <Text style={styles.errorText}>{serverError}</Text>
              </View>
            )}

            {/* Name Input */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Customer Full Name *"
                  placeholder="e.g. Meera Reddy"
                  returnKeyType="next"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.name?.message}
                  leftIcon={<Ionicons name="person-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Phone Input */}
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Indian Mobile Number (10 digits) *"
                  placeholder="e.g. 9876543210"
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.phone?.message}
                  leftIcon={<Ionicons name="call-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Email Input */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Customer Email (Optional)"
                  placeholder="meera@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    handleSubmit(onSubmit)();
                  }}
                  value={value || ""}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.email?.message}
                  leftIcon={<Ionicons name="mail-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            <Button
              title="Save Customer"
              onPress={() => {
                handleSubmit(onSubmit)();
              }}
              loading={createCustomerMutation.isPending}
              size="lg"
              style={styles.submitButton}
            />
          </View>
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
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.slate[900],
    marginBottom: 4,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginBottom: 20,
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
  submitButton: {
    marginTop: 10,
  },
});

