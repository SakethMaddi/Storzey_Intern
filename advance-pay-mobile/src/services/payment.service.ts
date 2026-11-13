import { apiClient } from "../lib/api-client";
import type { ApiResponse } from "../types/api";
import type { Payment, ManualPaymentInput } from "../types/payment";

export const paymentService = {
  /**
   * Get payments for a specific order
   * Endpoint: GET /orders/:id/payments
   */
  async getOrderPayments(orderId: number): Promise<Payment[]> {
    const res = await apiClient.get<ApiResponse<Payment[]>>(`/orders/${orderId}/payments`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to fetch payments");
    }
    return res.data.data;
  },

  /**
   * Record a manual payment (Cash / UPI / In-person)
   * Endpoint: POST /orders/:id/payments
   */
  async recordManualPayment(orderId: number, data: ManualPaymentInput): Promise<any> {
    const res = await apiClient.post<ApiResponse<any>>(`/orders/${orderId}/payments`, data);
    if (!res.data.success) {
      throw new Error(res.data.message || "Failed to record payment");
    }
    return res.data;
  },

  /**
   * Cancel an existing payment
   * Endpoint: PATCH /payments/:id/cancel
   */
  async cancelPayment(paymentId: number, reason?: string): Promise<any> {
    const res = await apiClient.patch<ApiResponse<any>>(`/payments/${paymentId}/cancel`, {
      reason,
    });
    if (!res.data.success) {
      throw new Error(res.data.message || "Failed to cancel payment");
    }
    return res.data;
  },
};

