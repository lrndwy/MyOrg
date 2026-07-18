import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface SubEventAttendance {
  id: string;
  sub_event_id: string;
  sub_event?: any;
  user_id: string;
  user?: any;
  status: string;
  selfie_url: string;
  signature_url: string;
  checked_in_at: string | null;
  marked_by_id: string;
  marked_by?: any;
  created_at: string;
  updated_at: string;
}

interface SubEventAttendancesResponse {
  data: SubEventAttendance[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseSubEventAttendancesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useSubEventAttendances({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseSubEventAttendancesParams = {}) {
  return useQuery<SubEventAttendancesResponse>({
    queryKey: ["sub_event_attendances", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/sub_event_attendances?${params}`);
      return data;
    },
  });
}

export function useGetSubEventAttendance(id: string) {
  return useQuery<SubEventAttendance>({
    queryKey: ["sub_event_attendances", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/sub_event_attendances/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateSubEventAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/sub_event_attendances", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub_event_attendances"] });
    },
  });
}

export function useUpdateSubEventAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/sub_event_attendances/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub_event_attendances"] });
    },
  });
}

export function useDeleteSubEventAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/sub_event_attendances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sub_event_attendances"] });
    },
  });
}
