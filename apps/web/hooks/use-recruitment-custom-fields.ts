import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface RecruitmentCustomField {
  id: string;
  recruitment_id: string;
  recruitment?: any;
  field_label: string;
  field_type: string;
  field_options: string[];
  is_required: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface RecruitmentCustomFieldsResponse {
  data: RecruitmentCustomField[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseRecruitmentCustomFieldsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useRecruitmentCustomFields({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseRecruitmentCustomFieldsParams = {}) {
  return useQuery<RecruitmentCustomFieldsResponse>({
    queryKey: ["recruitment_custom_fields", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/recruitment_custom_fields?${params}`);
      return data;
    },
  });
}

export function useGetRecruitmentCustomField(id: string) {
  return useQuery<RecruitmentCustomField>({
    queryKey: ["recruitment_custom_fields", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/recruitment_custom_fields/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateRecruitmentCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/recruitment_custom_fields", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_custom_fields"] });
    },
  });
}

export function useUpdateRecruitmentCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/recruitment_custom_fields/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_custom_fields"] });
    },
  });
}

export function useDeleteRecruitmentCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/recruitment_custom_fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_custom_fields"] });
    },
  });
}
