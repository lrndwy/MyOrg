import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface Permission {
  id: string;
  code: string;
  module: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface PermissionsResponse {
  data: Permission[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UsePermissionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function usePermissions({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UsePermissionsParams = {}) {
  return useQuery<PermissionsResponse>({
    queryKey: ["permissions", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/permissions?${params}`);
      return data;
    },
  });
}

export function useGetPermission(id: string) {
  return useQuery<Permission>({
    queryKey: ["permissions", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/permissions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/permissions", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/permissions/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });
}

export function useDeletePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/permissions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });
}
