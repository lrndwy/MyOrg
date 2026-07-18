import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface FinanceTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  proof_url: string;
  transaction_date: string | null;
  category_id: string;
  category?: any;
  recorded_by_id: string;
  recorded_by?: any;
  created_at: string;
  updated_at: string;
}

interface FinanceTransactionsResponse {
  data: FinanceTransaction[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseFinanceTransactionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useFinanceTransactions({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseFinanceTransactionsParams = {}) {
  return useQuery<FinanceTransactionsResponse>({
    queryKey: ["finance_transactions", { page, pageSize, search, sortBy, sortOrder }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      if (search) {
        params.set("search", search);
      }
      const { data } = await apiClient.get(`/api/finance_transactions?${params}`);
      return data;
    },
  });
}

export function useGetFinanceTransaction(id: string) {
  return useQuery<FinanceTransaction>({
    queryKey: ["finance_transactions", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/finance_transactions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateFinanceTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/finance_transactions", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_transactions"] });
    },
  });
}

export function useUpdateFinanceTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/finance_transactions/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_transactions"] });
    },
  });
}

export function useDeleteFinanceTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/finance_transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_transactions"] });
    },
  });
}
