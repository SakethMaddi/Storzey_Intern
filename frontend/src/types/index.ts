export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  createdAt: string;
  isArchived?: boolean;
  archivedAt?: string | null;
}

export interface OrderStage {
  id: number;
  name: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  orderId: number;
  position?: number;
  createdAt: string;
}

export interface Payment {
  id: number;
  orderId: number;
  amount: number;
  status: string;
  paymentType: string;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  itemName: string;
  totalAmount: number;
  advance: number;
  balance: number;
  paymentStatus: string;
  status?: string;
  customerId: number;
  customer: Customer;
  promisedDate?: string | null;
  paymentLinkExpiresAt?: string | null;
  publicToken: string;
  createdAt: string;
  stages?: OrderStage[];
  payments?: Payment[];
  isArchived?: boolean;
  archivedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}


