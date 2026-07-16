import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface LetterCategory {
  id: string;
  name: string;
  code: string;
  start_number: number;
  current_number: number;
  number_format_template: string;
  created_at: string;
  updated_at: string;
}

interface LetterCategoriesResponse {
  data: LetterCategory[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseLetterCategoriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useLetterCategories({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseLetterCategoriesParams = {}) {
  return useQuery<LetterCategoriesResponse>({
    queryKey: ["letter_categories", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/letter_categories?${params}`);
      return data;
    },
  });
}

export function useGetLetterCategory(id: string) {
  return useQuery<LetterCategory>({
    queryKey: ["letter_categories", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/letter_categories/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateLetterCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/letter_categories", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letter_categories"] });
    },
  });
}

export function useUpdateLetterCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/letter_categories/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letter_categories"] });
    },
  });
}

export function useDeleteLetterCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/letter_categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letter_categories"] });
    },
  });
}
