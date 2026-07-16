import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface Violation {
  id: string;
  user_id: string;
  user?: any;
  violation_type: string;
  description: string;
  sp_level: string;
  document_url: string;
  issued_by_id: string;
  issued_by?: any;
  issued_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ViolationsResponse {
  data: Violation[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseViolationsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useViolations({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseViolationsParams = {}) {
  return useQuery<ViolationsResponse>({
    queryKey: ["violations", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/violations?${params}`);
      return data;
    },
  });
}

export function useGetViolation(id: string) {
  return useQuery<Violation>({
    queryKey: ["violations", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/violations/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateViolation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/violations", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["violations"] });
    },
  });
}

export function useUpdateViolation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/violations/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["violations"] });
    },
  });
}

export function useDeleteViolation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/violations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["violations"] });
    },
  });
}
