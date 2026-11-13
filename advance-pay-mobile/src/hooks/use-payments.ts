import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentService } from "../services/payment.service";
import { useAuth } from "./use-auth";
import type { ManualPaymentInput } from "../types/payment";

export function useOrderPayments(orderId: number) {
  const { isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ["payments", orderId],
    queryFn: () => paymentService.getOrderPayments(orderId),
    enabled: isAuthenticated && Boolean(orderId),
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, data }: { orderId: number; data: ManualPaymentInput }) =>
      paymentService.recordManualPayment(orderId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payments", variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "stats"] });
    },
  });
}

