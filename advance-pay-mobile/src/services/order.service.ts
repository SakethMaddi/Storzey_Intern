import { apiClient } from "../lib/api-client";
import type { PaginatedResponse, ApiResponse } from "../types/api";
import type { Order, OrderCreateInput, OrderStage } from "../types/order";

export interface ListOrdersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  archived?: "true" | "false" | "all";
}

export const orderService = {
  /**
   * List orders with pagination, search, and status filters
   * Endpoint: GET /orders
   */
  async listOrders(params: ListOrdersParams = {}): Promise<PaginatedResponse<Order>> {
    const res = await apiClient.get<PaginatedResponse<Order>>("/orders", {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        search: params.search || undefined,
        status: params.status || undefined,
        archived: params.archived ?? "false",
      },
    });
    return res.data;
  },

  /**
   * Get single order by ID
   * Endpoint: GET /orders/:id
   */
  async getOrderById(id: number): Promise<Order> {
    const res = await apiClient.get<ApiResponse<Order>>(`/orders/${id}`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to fetch order");
    }
    return res.data.data;
  },

  /**
   * Create new order
   * Endpoint: POST /orders
   */
  async createOrder(data: OrderCreateInput): Promise<Order> {
    const res = await apiClient.post<ApiResponse<Order>>("/orders", data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to create order");
    }
    return res.data.data;
  },

  /**
   * Cancel an order
   * Endpoint: PATCH /orders/:id/cancel
   */
  async cancelOrder(id: number, reason: string): Promise<Order> {
    const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${id}/cancel`, { reason });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to cancel order");
    }
    return res.data.data;
  },

  /**
   * Archive an order
   * Endpoint: PATCH /orders/:id/archive
   */
  async archiveOrder(id: number): Promise<Order> {
    const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${id}/archive`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to archive order");
    }
    return res.data.data;
  },

  /**
   * Restore an archived order
   * Endpoint: PATCH /orders/:id/restore
   */
  async restoreOrder(id: number): Promise<Order> {
    const res = await apiClient.patch<ApiResponse<Order>>(`/orders/${id}/restore`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to restore order");
    }
    return res.data.data;
  },

  /**
   * Update an order production stage status
   * Endpoint: PATCH /stages/:id
   */
  async updateStage(stageId: number, status: "PENDING" | "IN_PROGRESS" | "COMPLETED"): Promise<OrderStage> {
    const res = await apiClient.patch<ApiResponse<OrderStage>>(`/stages/${stageId}`, { status });
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to update stage status");
    }
    return res.data.data;
  },
};
