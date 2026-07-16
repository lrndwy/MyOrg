import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface RolePermission {
  id: string;
  role_id: string;
  role?: any;
  permission_id: string;
  permission?: any;
  created_at: string;
  updated_at: string;
}

interface RolePermissionsResponse {
  data: RolePermission[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseRolePermissionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useRolePermissions({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseRolePermissionsParams = {}) {
  return useQuery<RolePermissionsResponse>({
    queryKey: ["role_permissions", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/role_permissions?${params}`);
      return data;
    },
  });
}

export function useGetRolePermission(id: string) {
  return useQuery<RolePermission>({
    queryKey: ["role_permissions", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/role_permissions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/role_permissions", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
    },
  });
}

export function useUpdateRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/role_permissions/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
    },
  });
}

export function useDeleteRolePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/role_permissions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
    },
  });
}
