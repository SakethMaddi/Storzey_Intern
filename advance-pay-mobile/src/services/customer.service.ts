import { apiClient } from "../lib/api-client";
import type { PaginatedResponse, ApiResponse } from "../types/api";
import type { Customer, CustomerCreateInput, CustomerUpdateInput } from "../types/customer";

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  archived?: "true" | "false" | "all";
}

export const customerService = {
  /**
   * List customers with pagination and search
   * Endpoint: GET /customers
   */
  async listCustomers(params: ListCustomersParams = {}): Promise<PaginatedResponse<Customer>> {
    const res = await apiClient.get<PaginatedResponse<Customer>>("/customers", {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        search: params.search || undefined,
        archived: params.archived ?? "false",
      },
    });
    return res.data;
  },

  /**
   * Create a new customer
   * Endpoint: POST /customers
   */
  async createCustomer(data: CustomerCreateInput): Promise<Customer> {
    const res = await apiClient.post<ApiResponse<Customer>>("/customers", data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to create customer");
    }
    return res.data.data;
  },

  /**
   * Update existing customer
   * Endpoint: PATCH /customers/:id
   */
  async updateCustomer(id: number, data: CustomerUpdateInput): Promise<Customer> {
    const res = await apiClient.patch<ApiResponse<Customer>>(`/customers/${id}`, data);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to update customer");
    }
    return res.data.data;
  },

  /**
   * Archive customer
   * Endpoint: PATCH /customers/:id/archive
   */
  async archiveCustomer(id: number): Promise<Customer> {
    const res = await apiClient.patch<ApiResponse<Customer>>(`/customers/${id}/archive`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to archive customer");
    }
    return res.data.data;
  },

  /**
   * Restore archived customer
   * Endpoint: PATCH /customers/:id/restore
   */
  async restoreCustomer(id: number): Promise<Customer> {
    const res = await apiClient.patch<ApiResponse<Customer>>(`/customers/${id}/restore`);
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to restore customer");
    }
    return res.data.data;
  },
};

