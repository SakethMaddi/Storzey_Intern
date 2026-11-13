import { QueryClient } from "@tanstack/react-query";
import type { ApiError } from "../types/api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 10, // 10 minutes
      retry: (failureCount, error: any) => {
        const apiError = error as ApiError;
        // Do not retry on client auth errors (401, 403) or not found (404)
        if (
          apiError?.status === 401 ||
          apiError?.status === 403 ||
          apiError?.status === 404
        ) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});

