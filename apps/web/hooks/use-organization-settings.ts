import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface OrganizationSetting {
  id: string;
  web_name: string;
  logo_url: string;
  icon_url: string;
  theme: string;
  allow_self_register: boolean;
  allow_cross_division_events_view: boolean;
  created_at: string;
  updated_at: string;
}

interface OrganizationSettingsResponse {
  data: OrganizationSetting[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseOrganizationSettingsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useOrganizationSettings({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseOrganizationSettingsParams = {}) {
  return useQuery<OrganizationSettingsResponse>({
    queryKey: ["organization_settings", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/organization_settings?${params}`);
      return data;
    },
  });
}

export function useGetOrganizationSetting(id: string) {
  return useQuery<OrganizationSetting>({
    queryKey: ["organization_settings", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/organization_settings/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateOrganizationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/organization_settings", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_settings"] });
    },
  });
}

export function useUpdateOrganizationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/organization_settings/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_settings"] });
    },
  });
}

export function useDeleteOrganizationSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/organization_settings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization_settings"] });
    },
  });
}
