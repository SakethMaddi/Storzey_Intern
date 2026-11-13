import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/hooks/use-auth";
import { Button } from "../../src/components/ui/Button";
import { colors, radius, typography, shadows } from "../../src/theme";
import { formatIndianPhone } from "../../src/utils/phone";
import { getApiBaseUrl } from "../../src/lib/api-client";

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of your Advance Pay owner session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              router.replace("/(auth)/login");
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const maskedApiUrl = (() => {
    try {
      const url = new URL(getApiBaseUrl());
      return `${url.protocol}//${url.host}`;
    } catch {
      return getApiBaseUrl();
    }
  })();

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Boutique Settings</Text>
        <Text style={styles.headerSubtitle}>Owner credentials & preferences</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.name || "O").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || "Owner"}</Text>
              <Text style={styles.profileBusiness}>
                {user?.businessName || "Advance Pay Boutique"}
              </Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>Multi-Tenant Owner</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email || "—"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone</Text>
            <Text style={styles.infoValue}>
              {user?.phone ? formatIndianPhone(user.phone) : "Not configured"}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Owner ID</Text>
            <Text style={styles.infoValue}>#{user?.id || "—"}</Text>
          </View>
        </View>

        {/* Security & Isolation Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Security & Tenant Isolation</Text>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={20} color={colors.status.paid.dot} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Tenant-Level Data Isolation</Text>
              <Text style={styles.featureDesc}>
                All orders, customers, and receipts are strictly scoped by backend middleware.
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="key" size={20} color={colors.primary} />
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Hardware SecureStore</Text>
              <Text style={styles.featureDesc}>
                Tokens and credentials stored in native Keychain / Keystore.
              </Text>
            </View>
          </View>
        </View>

        {/* Network & Environment Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Environment Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>API Host</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {maskedApiUrl}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version</Text>
            <Text style={styles.infoValue}>1.0.0 (Expo SDK 58)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>React Native • TypeScript</Text>
          </View>
        </View>

        {/* Logout Button */}
        <Button
          title="Sign Out of Boutique"
          onPress={handleLogout}
          loading={loggingOut}
          variant="danger"
          size="lg"
          icon={<Ionicons name="log-out-outline" size={18} color={colors.status.cancelled.text} />}
          style={styles.logoutButton}
        />
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
    paddingBottom: 32,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    ...shadows.sm,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  avatarText: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    ...typography.h3,
    color: colors.slate[900],
  },
  profileBusiness: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.powderBlue[50],
    borderColor: colors.powderBlue[200],
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    marginTop: 6,
  },
  roleBadgeText: {
    ...typography.caption,
    color: colors.powderBlue[700],
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate[100],
    marginVertical: 14,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.slate[800],
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.slate[500],
  },
  infoValue: {
    ...typography.bodySmall,
    fontWeight: "600",
    color: colors.slate[800],
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.slate[900],
  },
  featureDesc: {
    ...typography.caption,
    color: colors.slate[500],
    marginTop: 2,
    lineHeight: 16,
  },
  logoutButton: {
    marginTop: 8,
  },
});

