import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, typography, shadows } from "../../../theme";
import { formatIndianPhone } from "../../../utils/phone";
import { formatDate } from "../../../utils/date";
import type { Customer } from "../../../types/customer";

export interface CustomerCardProps {
  customer: Customer;
  onPress?: () => void;
}

export function CustomerCard({ customer, onPress }: CustomerCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={!onPress}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(customer.name || "C").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.nameContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {customer.name}
          </Text>
          <Text style={styles.phone}>{formatIndianPhone(customer.phone)}</Text>
        </View>
        {customer.isArchived && (
          <View style={styles.archivedBadge}>
            <Text style={styles.archivedText}>Archived</Text>
          </View>
        )}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.slate[400]} />
          <Text style={styles.detailText}>Joined {formatDate(customer.createdAt)}</Text>
        </View>
        {customer.email && (
          <View style={styles.detailItem}>
            <Ionicons name="mail-outline" size={13} color={colors.slate[400]} />
            <Text style={styles.detailText} numberOfLines={1}>
              {customer.email}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    ...shadows.sm,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.powderBlue[100],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: "700",
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    ...typography.body,
    fontWeight: "700",
    color: colors.slate[900],
  },
  phone: {
    ...typography.bodySmall,
    color: colors.slate[600],
    marginTop: 2,
  },
  archivedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radius.full,
    backgroundColor: colors.slate[100],
    borderWidth: 1,
    borderColor: colors.slate[300],
  },
  archivedText: {
    ...typography.caption,
    color: colors.slate[600],
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.slate[100],
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    ...typography.caption,
    color: colors.slate[500],
  },
});

