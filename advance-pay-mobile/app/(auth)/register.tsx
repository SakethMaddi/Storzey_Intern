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
} from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/hooks/use-auth";
import { registerSchema, type RegisterFormData } from "../../src/validation/auth.schema";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, typography, shadows } from "../../src/theme";
import type { ApiError } from "../../src/types/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [refId, setRefId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      businessName: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setRefId(null);
    setIsSubmitting(true);

    try {
      await register({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        businessName: data.businessName || null,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      const apiErr = err as ApiError;
      if (apiErr?.status === 409) {
        setServerError(apiErr.message || "An account with this email or phone already exists.");
      } else if (apiErr?.status === 429) {
        setServerError("Registration rate limit reached. Please try again later.");
      } else if (apiErr?.status === 400 && apiErr?.errors) {
        const firstFieldErr = Object.values(apiErr.errors)[0];
        setServerError(
          Array.isArray(firstFieldErr) ? firstFieldErr[0] : String(firstFieldErr)
        );
      } else if (apiErr?.refId) {
        setServerError(apiErr.message);
        setRefId(apiErr.refId);
      } else {
        setServerError(
          apiErr?.message || "Unable to register. Please check your network and inputs."
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={24} color={colors.primary} />
            </View>
            <Text style={styles.appName}>Advance Pay</Text>
            <Text style={styles.tagline}>Create Owner Account</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Register Boutique</Text>
            <Text style={styles.cardSubtitle}>
              Create your multi-tenant boutique workspace
            </Text>

            {serverError && (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle"
                  size={18}
                  color={colors.status.cancelled.text}
                  style={styles.errorIcon}
                />
                <View style={styles.errorTextContainer}>
                  <Text style={styles.errorBoxText}>{serverError}</Text>
                  {refId && <Text style={styles.refIdText}>Ref ID: {refId}</Text>}
                </View>
              </View>
            )}

            {/* Owner Name */}
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Owner Full Name *"
                  placeholder="e.g. Priya Sharma"
                  returnKeyType="next"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.name?.message}
                  leftIcon={<Ionicons name="person-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Email Address */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Owner Email Address *"
                  placeholder="owner@boutique.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.email?.message}
                  leftIcon={<Ionicons name="mail-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Phone Number */}
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Owner Phone (10 digits)"
                  placeholder="9876543210"
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  value={value || ""}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.phone?.message}
                  leftIcon={<Ionicons name="call-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Business Name */}
            <Controller
              control={control}
              name="businessName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Boutique / Business Name"
                  placeholder="e.g. Royal Silks & Bridal"
                  returnKeyType="next"
                  value={value || ""}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.businessName?.message}
                  leftIcon={<Ionicons name="business-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Password */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password (min 8 chars) *"
                  placeholder="Create password"
                  isPassword
                  returnKeyType="next"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.password?.message}
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            {/* Confirm Password */}
            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirm Password *"
                  placeholder="Re-enter password"
                  isPassword
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    handleSubmit(onSubmit)();
                  }}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.confirmPassword?.message}
                  leftIcon={<Ionicons name="lock-closed-outline" size={18} color={colors.slate[400]} />}
                />
              )}
            />

            <Button
              title="Create Account & Enter"
              onPress={() => {
                handleSubmit(onSubmit)();
              }}
              loading={isSubmitting}
              size="lg"
              style={styles.submitButton}
            />

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.replace("/(auth)/login")}
              style={styles.loginLink}
            >
              <Text style={styles.loginLinkText}>
                Already have an owner account? <Text style={styles.loginLinkBold}>Sign in</Text>
              </Text>
            </TouchableOpacity>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.powderBlue[100],
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  appName: {
    ...typography.h2,
    color: colors.primaryNavy,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.slate[500],
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.slate[900],
    marginBottom: 4,
  },
  cardSubtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginBottom: 16,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.status.cancelled.background,
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 16,
  },
  errorIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  errorTextContainer: {
    flex: 1,
  },
  errorBoxText: {
    ...typography.bodySmall,
    color: colors.status.cancelled.text,
  },
  refIdText: {
    ...typography.caption,
    color: colors.slate[500],
    marginTop: 4,
  },
  submitButton: {
    marginTop: 10,
  },
  loginLink: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  loginLinkText: {
    ...typography.bodySmall,
    color: colors.slate[600],
  },
  loginLinkBold: {
    color: colors.primary,
    fontWeight: "700",
  },
});

