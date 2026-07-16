import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface Attendance {
  id: string;
  event_id: string;
  event?: any;
  user_id: string;
  user?: any;
  status: string;
  selfie_url: string;
  signature_url: string;
  checked_in_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AttendancesResponse {
  data: Attendance[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseAttendancesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useAttendances({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseAttendancesParams = {}) {
  return useQuery<AttendancesResponse>({
    queryKey: ["attendances", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/attendances?${params}`);
      return data;
    },
  });
}

export function useGetAttendance(id: string) {
  return useQuery<Attendance>({
    queryKey: ["attendances", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/attendances/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/attendances", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
    },
  });
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/attendances/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/attendances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
    },
  });
}

// POST /api/events/:id/attendance — the current user checks in with a
// selfie + signature (both already-uploaded FileRef URLs, see
// hooks/use-uploads.ts). Distinct from the generated /api/attendances
// CRUD above, which is the admin-facing resource endpoint.
export interface SubmitAttendanceInput {
  eventId: string;
  selfieUrl: string;
  signatureUrl: string;
}

export function useSubmitAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, selfieUrl, signatureUrl }: SubmitAttendanceInput) => {
      const { data } = await apiClient.post(`/api/events/${eventId}/attendance`, {
        selfie_url: selfieUrl,
        signature_url: signatureUrl,
      });
      return data.data as Attendance;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["events", variables.eventId] });
      queryClient.invalidateQueries({
        queryKey: ["events", variables.eventId, "my-attendance"],
      });
      queryClient.invalidateQueries({ queryKey: ["attendances"] });
      queryClient.invalidateQueries({ queryKey: ["my-permission-requests"] });
    },
  });
}

/** Current user's attendance for an event (null if not yet submitted). */
export function useMyEventAttendance(eventId: string) {
  return useQuery<Attendance | null>({
    queryKey: ["events", eventId, "my-attendance"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/api/events/${eventId}/attendance`);
        return data.data as Attendance;
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!eventId,
    retry: false,
    staleTime: 30 * 1000,
  });
}
