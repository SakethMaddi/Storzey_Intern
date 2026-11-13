import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orderService, type ListOrdersParams } from "../services/order.service";
import { useAuth } from "./use-auth";
import type { OrderCreateInput } from "../types/order";

export const ORDERS_QUERY_KEY = ["orders"] as const;

export function useOrders(params: ListOrdersParams = {}) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, params],
    queryFn: () => orderService.listOrders(params),
    enabled: isAuthenticated,
  });
}

export function useOrder(id: number) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: [...ORDERS_QUERY_KEY, id],
    queryFn: () => orderService.getOrderById(id),
    enabled: isAuthenticated && Boolean(id),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OrderCreateInput) => orderService.createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      orderService.cancelOrder(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useArchiveOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => orderService.archiveOrder(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useRestoreOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => orderService.restoreOrder(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY, id] });
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      stageId,
      status,
      orderId: _orderId,
    }: {
      stageId: number;
      status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
      orderId: number;
    }) => orderService.updateStage(stageId, status),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...ORDERS_QUERY_KEY, variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ORDERS_QUERY_KEY });
    },
  });
}
