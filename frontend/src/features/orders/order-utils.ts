import type { Order, OrderStage } from "../../types";

export type ProductionStatusType =
  | "ORDER_PLACED"
  | "CUTTING"
  | "STITCHING"
  | "FINISHING"
  | "IN_PROGRESS"
  | "READY_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export interface ProductionStatusInfo {
  status: ProductionStatusType;
  label: string;
  badgeClass: string;
  currentStageName: string;
  completedCount: number;
  totalStages: number;
  percentage: number;
}

/** Formats a numeric amount to Indian Rupee representation (e.g. ₹15,000) */
export function inr(amount: number | string | undefined | null): string {
  const val = Number(amount) || 0;
  return `₹${val.toLocaleString("en-IN")}`;
}

/** Formats a date string into readable short format (e.g. 15 Dec 2026) */
export function formatOrderDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Computes authoritative production stage status from an order and its stages.
 */
export function getOrderProductionStatus(
  order: Order,
  stages?: OrderStage[]
): ProductionStatusInfo {
  if (order.status === "CANCELLED") {
    return {
      status: "CANCELLED",
      label: "Cancelled",
      badgeClass: "badge-cancelled",
      currentStageName: "Order Cancelled",
      completedCount: 0,
      totalStages: stages?.length || 5,
      percentage: 0,
    };
  }

  const orderStages = (stages && stages.length > 0 ? stages : order.stages) || [];

  if (!orderStages.length) {
    // If stages are not loaded, infer from payment status and dates
    if (order.paymentStatus === "PAID") {
      return {
        status: "DELIVERED",
        label: "Delivered",
        badgeClass: "badge-delivered",
        currentStageName: "Delivered",
        completedCount: 5,
        totalStages: 5,
        percentage: 100,
      };
    }
    return {
      status: "IN_PROGRESS",
      label: "In Progress",
      badgeClass: "badge-inprogress",
      currentStageName: "Order Placed",
      completedCount: 1,
      totalStages: 5,
      percentage: 20,
    };
  }

  const completedCount = orderStages.filter((s) => s.status === "COMPLETED").length;
  const inProgressStage = orderStages.find((s) => s.status === "IN_PROGRESS");
  const lastStage = orderStages[orderStages.length - 1];

  // 1. All stages completed => DELIVERED
  if (completedCount === orderStages.length || lastStage?.status === "COMPLETED") {
    return {
      status: "DELIVERED",
      label: "Delivered",
      badgeClass: "badge-delivered",
      currentStageName: lastStage?.name || "Ready for Delivery",
      completedCount: orderStages.length,
      totalStages: orderStages.length,
      percentage: 100,
    };
  }

  // 2. Last stage is IN_PROGRESS or penultimate completed with last stage pending => READY_FOR_DELIVERY
  const isLastStageActive =
    lastStage?.status === "IN_PROGRESS" ||
    (lastStage?.name.toLowerCase().includes("ready") &&
      completedCount >= Math.max(1, orderStages.length - 1));

  if (isLastStageActive) {
    return {
      status: "READY_FOR_DELIVERY",
      label: "Ready for Delivery",
      badgeClass: "badge-ready",
      currentStageName: lastStage?.name || "Ready for Delivery",
      completedCount: Math.max(completedCount, orderStages.length - 1),
      totalStages: orderStages.length,
      percentage: 90,
    };
  }

  // 3. In Progress (Cutting, Stitching, Finishing, etc.)
  const activeStage =
    inProgressStage ||
    orderStages.find((s) => s.status === "PENDING") ||
    orderStages[0];

  const rawPercent = Math.round(
    ((completedCount + (inProgressStage ? 0.5 : 0)) / orderStages.length) * 100
  );
  const percentage = Math.max(15, Math.min(85, rawPercent));

  const lowerName = activeStage.name.toLowerCase();
  let badgeClass = "badge-inprogress";
  let statusType: ProductionStatusType = "IN_PROGRESS";

  if (lowerName.includes("placed")) {
    statusType = "ORDER_PLACED";
    badgeClass = "badge-order-placed";
  } else if (lowerName.includes("cut")) {
    statusType = "CUTTING";
    badgeClass = "badge-cutting";
  } else if (lowerName.includes("stitch")) {
    statusType = "STITCHING";
    badgeClass = "badge-stitching";
  } else if (lowerName.includes("finish")) {
    statusType = "FINISHING";
    badgeClass = "badge-finishing";
  }

  return {
    status: statusType,
    label: activeStage.name,
    badgeClass,
    currentStageName: activeStage.name,
    completedCount,
    totalStages: orderStages.length,
    percentage,
  };
}
