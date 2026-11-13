import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard.service";
import { useAuth } from "./use-auth";
import type { DashboardStats } from "../types/dashboard";

export const DASHBOARD_QUERY_KEY = ["dashboard", "stats"] as const;

export function useDashboardStats() {
  const { isAuthenticated } = useAuth();

  return useQuery<DashboardStats>({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: () => dashboardService.getStats(),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  });
}

