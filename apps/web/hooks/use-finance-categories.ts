import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface FinanceCategory {
  id: string;
  name: string;
  type: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface FinanceCategoriesResponse {
  data: FinanceCategory[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseFinanceCategoriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useFinanceCategories({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseFinanceCategoriesParams = {}) {
  return useQuery<FinanceCategoriesResponse>({
    queryKey: ["finance_categories", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/finance_categories?${params}`);
      return data;
    },
  });
}

export function useGetFinanceCategory(id: string) {
  return useQuery<FinanceCategory>({
    queryKey: ["finance_categories", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/finance_categories/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateFinanceCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/finance_categories", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_categories"] });
    },
  });
}

export function useUpdateFinanceCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/finance_categories/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_categories"] });
    },
  });
}

export function useDeleteFinanceCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/finance_categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance_categories"] });
    },
  });
}
