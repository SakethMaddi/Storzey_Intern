import React, { useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/hooks/use-auth";
import { colors, typography, radius } from "../src/theme";
import { Ionicons } from "@expo/vector-icons";

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, sessionChecked } = useAuth();

  useEffect(() => {
    if (sessionChecked) {
      if (isAuthenticated) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/login");
      }
    }
  }, [sessionChecked, isAuthenticated, router]);

  return (
    <View style={styles.container}>
      <View style={styles.brandWrapper}>
        <View style={styles.iconCircle}>
          <Ionicons name="card-outline" size={42} color={colors.primary} />
        </View>
        <Text style={styles.title}>Advance Pay</Text>
        <Text style={styles.subtitle}>Boutique Management & Payments</Text>
      </View>

      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Checking owner session...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 70,
    paddingHorizontal: 24,
  },
  brandWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    borderWidth: 2,
    borderColor: colors.powderBlue[200],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    ...typography.h1,
    color: colors.primaryNavy,
    letterSpacing: -0.5,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.slate[500],
    marginTop: 6,
    textAlign: "center",
  },
  loaderContainer: {
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    ...typography.caption,
    color: colors.slate[400],
  },
});

