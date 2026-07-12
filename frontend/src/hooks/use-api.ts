import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type {
  Medicine,
  MedicineCreate,
  MedicineUpdate,
  Supplier,
  SupplierUpdate,
  TransactionResponse,
  TransactionCreate,
  PurchaseOrderResponse,
  PredictionResponse,
  ManualPurchaseOrderCreate,
  RestockingEvalResponse,
} from "@/types/api.types";

export const queryKeys = {
  medicines: ["medicines"] as const,
  suppliers: ["suppliers"] as const,
  transactions: ["transactions"] as const,
  predictions: (medicineId: number) => ["predictions", medicineId] as const,
  purchaseOrders: ["purchase-orders"] as const,
};

export function useMedicines() {
  return useQuery({
    queryKey: queryKeys.medicines,
    queryFn: () => apiFetch<Medicine[]>("/api/medicines"), // NOTE: you may need to add GET /api/medicines to FastAPI
    staleTime: 30_000,
    select: (data) => data ?? [],
    placeholderData: [],
  });
}

export function useTransactions(limit = 50) {
  return useQuery({
    queryKey: queryKeys.transactions,
    queryFn: () => apiFetch<TransactionResponse[]>(`/api/transactions?limit=${limit}`),
    staleTime: 20_000,
    refetchInterval: 60_000,
    select: (data) => data ?? [],
    placeholderData: [],
  });
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: queryKeys.purchaseOrders,
    queryFn: () => apiFetch<PurchaseOrderResponse[]>("/api/restocking/purchase-orders"),
    staleTime: 15_000,
    select: (data) => data ?? [],
    placeholderData: [],
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => apiFetch<Supplier[]>("/api/suppliers"),
    staleTime: 30_000,
    select: (data) => data ?? [],
    placeholderData: [],
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SupplierUpdate }) =>
      apiFetch<Supplier>(`/api/suppliers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.suppliers });
    },
  });
}

export function usePredictions(medicineId: number | null) {
  return useQuery({
    queryKey: medicineId ? queryKeys.predictions(medicineId) : ["predictions-disabled"],
    queryFn: () => apiFetch<PredictionResponse[]>(`/api/predictions/${medicineId}`),
    enabled: medicineId !== null,
    staleTime: 5 * 60_000,
    select: (data) => data ?? [],
    placeholderData: [],
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransactionCreate) =>
      apiFetch<TransactionResponse>("/api/transactions", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medicines });
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions });
    },
  });
}

export function useCreateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MedicineCreate) =>
      apiFetch<Medicine>("/api/medicines", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medicines });
    },
  });
}

export function useUpdateMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: MedicineUpdate }) =>
      apiFetch<Medicine>(`/api/medicines/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medicines });
    },
  });
}

export function useDeleteMedicine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/medicines/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.medicines });
    },
  });
}

export function useCreateManualPurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualPurchaseOrderCreate) =>
      apiFetch<PurchaseOrderResponse>("/api/restocking/purchase-orders/manual", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
    },
  });
}

export function useEvaluateRestocking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ medicineId, supplierId }: { medicineId: number; supplierId?: number | null }) =>
      apiFetch<RestockingEvalResponse>(
        `/api/restocking/evaluate/${medicineId}${supplierId ? `?supplier_id=${supplierId}` : ""}`,
        {
          method: "POST",
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
      queryClient.invalidateQueries({ queryKey: queryKeys.medicines });
    },
  });
}
