import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface EventCommitteeSie {
  id: string;
  event_id: string;
  event?: any;
  name: string;
  description: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

interface EventCommitteeSiesResponse {
  data: EventCommitteeSie[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseEventCommitteeSiesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useEventCommitteeSies({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseEventCommitteeSiesParams = {}) {
  return useQuery<EventCommitteeSiesResponse>({
    queryKey: ["event_committee_sies", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/event_committee_sies?${params}`);
      return data;
    },
  });
}

export function useGetEventCommitteeSie(id: string) {
  return useQuery<EventCommitteeSie>({
    queryKey: ["event_committee_sies", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/event_committee_sies/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateEventCommitteeSie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/event_committee_sies", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_committee_sies"] });
    },
  });
}

export function useUpdateEventCommitteeSie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/event_committee_sies/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_committee_sies"] });
    },
  });
}

export function useDeleteEventCommitteeSie() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/event_committee_sies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_committee_sies"] });
    },
  });
}
