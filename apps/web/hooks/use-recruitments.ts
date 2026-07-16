import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface Recruitment {
  id: string;
  title: string;
  description: string;
  slug: string;
  open_date: string | null;
  close_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RecruitmentsResponse {
  data: Recruitment[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseRecruitmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useRecruitments({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseRecruitmentsParams = {}) {
  return useQuery<RecruitmentsResponse>({
    queryKey: ["recruitments", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/recruitments?${params}`);
      return data;
    },
  });
}

export function useGetRecruitment(id: string) {
  return useQuery<Recruitment>({
    queryKey: ["recruitments", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/recruitments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateRecruitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/recruitments", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitments"] });
    },
  });
}

export function useUpdateRecruitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/recruitments/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitments"] });
    },
  });
}

export function useDeleteRecruitment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/recruitments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitments"] });
    },
  });
}
