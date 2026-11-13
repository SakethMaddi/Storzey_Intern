import type { OrderPaymentStatus } from "./order";
import type { PaymentStatus, PaymentType } from "./payment";

export interface DashboardRecentOrder {
  id: number;
  itemName: string;
  totalAmount: number;
  balance: number;
  paymentStatus: OrderPaymentStatus;
  createdAt: string;
  customer: {
    id: number;
    name: string;
  };
}

export interface DashboardRecentPayment {
  id: number;
  amount: number;
  paymentType: PaymentType;
  status: PaymentStatus;
  createdAt: string;
  order: {
    id: number;
    itemName: string;
    customer: {
      id: number;
      name: string;
    };
  };
}

export interface DashboardStats {
  totalOrders: number;
  totalCustomers: number;
  totalOrderValue: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
  recentOrders: DashboardRecentOrder[];
  recentPayments: DashboardRecentPayment[];
}

