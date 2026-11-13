import type { Customer } from "./customer";
import type { Payment } from "./payment";

export type OrderPaymentStatus = "PENDING" | "PARTIALLY_PAID" | "PAID";
export type OrderStatus = "ACTIVE" | "CANCELLED" | "COMPLETED";
export type OrderStageStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export interface OrderStage {
  id: number;
  name: string;
  status: OrderStageStatus;
  orderId: number;
  position: number;
  createdAt: string;
}

export interface Order {
  id: number;
  ownerId: number;
  customerId: number;
  itemName: string;
  totalAmount: number;
  advance: number;
  balance: number;
  paymentStatus: OrderPaymentStatus;
  status: OrderStatus;
  promisedDate?: string | null;
  paymentLinkExpiresAt?: string | null;
  publicToken: string;
  createdAt: string;
  isArchived: boolean;
  archivedAt?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  cancellationReason?: string | null;
  customer?: Customer;
  payments?: Payment[];
  stages?: OrderStage[];
}

export interface OrderCreateInput {
  itemName: string;
  totalAmount: number;
  advance: number;
  customerId: number;
  promisedDate: string; // YYYY-MM-DD
  stages?: string[];
}

