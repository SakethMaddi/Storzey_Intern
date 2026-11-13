import { apiClient } from "../lib/api-client";
import type { ApiResponse } from "../types/api";
import type { DashboardStats } from "../types/dashboard";

export const dashboardService = {
  /**
   * Fetches real aggregated owner metrics, recent orders, and recent payments
   * Endpoint: GET /dashboard/stats
   */
  async getStats(): Promise<DashboardStats> {
    const res = await apiClient.get<ApiResponse<DashboardStats>>("/dashboard/stats");
    if (!res.data.success || !res.data.data) {
      throw new Error(res.data.message || "Failed to load dashboard metrics");
    }
    return res.data.data;
  },
};

