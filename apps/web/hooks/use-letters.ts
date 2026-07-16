import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface Letter {
  id: string;
  type: string;
  category_id: string;
  category?: any;
  letter_code: string;
  subject: string;
  letter_date: string | null;
  sender: string;
  recipient: string;
  description: string;
  attachment_url: string;
  created_at: string;
  updated_at: string;
}

interface LettersResponse {
  data: Letter[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseLettersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useLetters({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseLettersParams = {}) {
  return useQuery<LettersResponse>({
    queryKey: ["letters", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/letters?${params}`);
      return data;
    },
  });
}

export function useGetLetter(id: string) {
  return useQuery<Letter>({
    queryKey: ["letters", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/letters/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateLetter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/letters", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letters"] });
    },
  });
}

export function useUpdateLetter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/letters/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letters"] });
    },
  });
}

export function useDeleteLetter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/letters/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["letters"] });
    },
  });
}
