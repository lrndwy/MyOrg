import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface LetterTemplate {
  id: string;
  name: string;
  category_id: string;
  category?: any;
  template_url: string;
  created_at: string;
  updated_at: string;
}

interface LetterTemplatesResponse {
  data: LetterTemplate[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseLetterTemplatesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useLetterTemplates({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseLetterTemplatesParams = {}) {
  return useQuery<LetterTemplatesResponse>({
    queryKey: ["letter_templates", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/letter_templates?${params}`);
      return data;
    },
  });
}

export function useGetLetterTemplate(id: string) {
  return useQuery<LetterTemplate>({
    queryKey: ["letter_templates", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/letter_templates/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateLetterTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/letter_templates", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letter_templates"] });
    },
  });
}

export function useUpdateLetterTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/letter_templates/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letter_templates"] });
    },
  });
}

export function useDeleteLetterTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/letter_templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letter_templates"] });
    },
  });
}
