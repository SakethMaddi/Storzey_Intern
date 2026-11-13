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
import { loginSchema, type LoginFormData } from "../../src/validation/auth.schema";
import { Input } from "../../src/components/ui/Input";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, typography, shadows } from "../../src/theme";
import type { ApiError } from "../../src/types/api";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [refId, setRefId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setRefId(null);
    setIsSubmitting(true);

    try {
      await login({
        email: data.email,
        password: data.password,
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      const apiErr = err as ApiError;
      if (apiErr?.status === 401) {
        setServerError("Incorrect email or password. Please try again.");
      } else if (apiErr?.status === 429) {
        setServerError("Too many login attempts. Please wait a few minutes.");
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
          apiErr?.message || "Unable to sign in. Please verify your connection."
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
          {/* Header Brand Branding */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={26} color={colors.primary} />
            </View>
            <Text style={styles.appName}>Advance Pay</Text>
            <Text style={styles.tagline}>Owner Mobile Portal</Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Owner Sign In</Text>
            <Text style={styles.cardSubtitle}>
              Access your boutique dashboard and orders
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
                  {refId && (
                    <Text style={styles.refIdText}>Ref ID: {refId}</Text>
                  )}
                </View>
              </View>
            )}

            {/* Email Field */}
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Owner Email Address"
                  placeholder="owner@boutique.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  returnKeyType="next"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.email?.message}
                  leftIcon={
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={colors.slate[400]}
                    />
                  }
                />
              )}
            />

            {/* Password Field */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password"
                  placeholder="Enter your password"
                  isPassword
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    handleSubmit(onSubmit)();
                  }}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={errors.password?.message}
                  leftIcon={
                    <Ionicons
                      name="lock-closed-outline"
                      size={18}
                      color={colors.slate[400]}
                    />
                  }
                />
              )}
            />

            {/* Submit Button */}
            <Button
              title="Sign In to Dashboard"
              onPress={() => {
                handleSubmit(onSubmit)();
              }}
              loading={isSubmitting}
              size="lg"
              style={styles.submitButton}
            />

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push("/(auth)/register")}
              style={styles.registerLink}
            >
              <Text style={styles.registerLinkText}>
                New boutique owner? <Text style={styles.registerLinkBold}>Create an account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color={colors.slate[400]} />
            <Text style={styles.footerNoteText}>
              Multi-tenant isolated • Encrypted owner credentials
            </Text>
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
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: radius.xl,
    backgroundColor: colors.powderBlue[100],
    borderWidth: 1,
    borderColor: colors.powderBlue[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appName: {
    ...typography.h1,
    color: colors.primaryNavy,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: 24,
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
    marginBottom: 20,
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
    marginTop: 8,
  },
  registerLink: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  registerLinkText: {
    ...typography.bodySmall,
    color: colors.slate[600],
  },
  registerLinkBold: {
    color: colors.primary,
    fontWeight: "700",
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 24,
  },
  footerNoteText: {
    ...typography.caption,
    color: colors.slate[400],
  },
});
