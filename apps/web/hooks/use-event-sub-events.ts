import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface EventSubEvent {
  id: string;
  event_id: string;
  event?: any;
  sie_id: string;
  sie?: any;
  title: string;
  description: string;
  location: string;
  start_time: string | null;
  end_time: string | null;
  ketua_pelaksana_id: string;
  ketua_pelaksana?: any;
  attendance_mode: string;
  minutes_url: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface EventSubEventsResponse {
  data: EventSubEvent[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseEventSubEventsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useEventSubEvents({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseEventSubEventsParams = {}) {
  return useQuery<EventSubEventsResponse>({
    queryKey: ["event_sub_events", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/event_sub_events?${params}`);
      return data;
    },
  });
}

export function useGetEventSubEvent(id: string) {
  return useQuery<EventSubEvent>({
    queryKey: ["event_sub_events", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/event_sub_events/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateEventSubEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/event_sub_events", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_sub_events"] });
    },
  });
}

export function useUpdateEventSubEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/event_sub_events/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_sub_events"] });
    },
  });
}

export function useDeleteEventSubEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/event_sub_events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_sub_events"] });
    },
  });
}
