import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface RecruitmentSubmission {
  id: string;
  recruitment_id: string;
  recruitment?: any;
  name: string;
  nim: string;
  division_interest_id: string;
  division_interest?: any;
  contact: string;
  custom_answers: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface RecruitmentSubmissionsResponse {
  data: RecruitmentSubmission[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseRecruitmentSubmissionsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useRecruitmentSubmissions({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseRecruitmentSubmissionsParams = {}) {
  return useQuery<RecruitmentSubmissionsResponse>({
    queryKey: ["recruitment_submissions", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/recruitment_submissions?${params}`);
      return data;
    },
  });
}

export function useGetRecruitmentSubmission(id: string) {
  return useQuery<RecruitmentSubmission>({
    queryKey: ["recruitment_submissions", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/recruitment_submissions/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateRecruitmentSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/recruitment_submissions", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_submissions"] });
    },
  });
}

export function useUpdateRecruitmentSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/recruitment_submissions/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_submissions"] });
    },
  });
}

export function useDeleteRecruitmentSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/recruitment_submissions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment_submissions"] });
    },
  });
}
