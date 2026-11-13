import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, typography } from "../../../theme";

export interface QuickActionsProps {
  onNewOrder?: () => void;
  onNewCustomer?: () => void;
  onRefresh?: () => void;
}

export function QuickActions({
  onNewOrder,
  onNewCustomer,
  onRefresh,
}: QuickActionsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Quick Management</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onNewOrder}
          style={styles.actionCard}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.powderBlue[100] }]}>
            <Ionicons name="add-circle" size={24} color={colors.primary} />
          </View>
          <Text style={styles.actionTitle}>Manage Orders</Text>
          <Text style={styles.actionSubtitle}>Track active orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onNewCustomer}
          style={styles.actionCard}
        >
          <View style={[styles.iconBox, { backgroundColor: "#ECFDF5" }]}>
            <Ionicons name="person-add" size={24} color={colors.status.paid.dot} />
          </View>
          <Text style={styles.actionTitle}>Client List</Text>
          <Text style={styles.actionSubtitle}>View boutique clients</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={onRefresh}
          style={styles.actionCard}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.slate[100] }]}>
            <Ionicons name="refresh" size={24} color={colors.slate[700]} />
          </View>
          <Text style={styles.actionTitle}>Refresh Stats</Text>
          <Text style={styles.actionSubtitle}>Sync live records</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.slate[800],
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionTitle: {
    ...typography.bodySmall,
    fontWeight: "700",
    color: colors.slate[900],
    textAlign: "center",
  },
  actionSubtitle: {
    ...typography.caption,
    color: colors.slate[500],
    textAlign: "center",
    marginTop: 2,
  },
});

