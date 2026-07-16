import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface RecruitmentTargetDivision {
  id: string;
  recruitment_id: string;
  recruitment?: any;
  division_id: string;
  division?: any;
  created_at: string;
  updated_at: string;
}

interface RecruitmentTargetDivisionsResponse {
  data: RecruitmentTargetDivision[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseRecruitmentTargetDivisionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useRecruitmentTargetDivisions({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseRecruitmentTargetDivisionsParams = {}) {
  return useQuery<RecruitmentTargetDivisionsResponse>({
    queryKey: ["recruitment_target_divisions", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/recruitment_target_divisions?${params}`);
      return data;
    },
  });
}

export function useGetRecruitmentTargetDivision(id: string) {
  return useQuery<RecruitmentTargetDivision>({
    queryKey: ["recruitment_target_divisions", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/recruitment_target_divisions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateRecruitmentTargetDivision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/recruitment_target_divisions", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_target_divisions"] });
    },
  });
}

export function useUpdateRecruitmentTargetDivision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/recruitment_target_divisions/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_target_divisions"] });
    },
  });
}

export function useDeleteRecruitmentTargetDivision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/recruitment_target_divisions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_target_divisions"] });
    },
  });
}
