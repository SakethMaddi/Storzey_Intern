export type PaymentStatus = "PENDING" | "COMPLETED" | "CAPTURED" | "FAILED" | "CANCELLED";
export type PaymentType = "ADVANCE" | "BALANCE";

export interface Payment {
  id: number;
  orderId: number;
  amount: number;
  status: PaymentStatus;
  paymentType: PaymentType;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  createdAt: string;
  order?: {
    id: number;
    itemName: string;
    customer?: {
      id: number;
      name: string;
    };
  };
}

export interface ManualPaymentInput {
  amount: number;
  paymentType: PaymentType;
}

