import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerService, type ListCustomersParams } from "../services/customer.service";
import { useAuth } from "./use-auth";
import type { CustomerCreateInput, CustomerUpdateInput } from "../types/customer";

export const CUSTOMERS_QUERY_KEY = ["customers"] as const;

export function useCustomers(params: ListCustomersParams = {}) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [...CUSTOMERS_QUERY_KEY, params],
    queryFn: () => customerService.listCustomers(params),
    enabled: isAuthenticated,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CustomerCreateInput) => customerService.createCustomer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: CustomerUpdateInput }) =>
      customerService.updateCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
    },
  });
}

export function useArchiveCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => customerService.archiveCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CUSTOMERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

