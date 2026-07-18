import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface EventCommitteeMember {
  id: string;
  sie_id: string;
  sie?: any;
  user_id: string;
  user?: any;
  role: string;
  created_at: string;
  updated_at: string;
}

interface EventCommitteeMembersResponse {
  data: EventCommitteeMember[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseEventCommitteeMembersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useEventCommitteeMembers({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseEventCommitteeMembersParams = {}) {
  return useQuery<EventCommitteeMembersResponse>({
    queryKey: ["event_committee_members", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/event_committee_members?${params}`);
      return data;
    },
  });
}

export function useGetEventCommitteeMember(id: string) {
  return useQuery<EventCommitteeMember>({
    queryKey: ["event_committee_members", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/event_committee_members/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateEventCommitteeMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/event_committee_members", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_committee_members"] });
    },
  });
}

export function useUpdateEventCommitteeMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/event_committee_members/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_committee_members"] });
    },
  });
}

export function useDeleteEventCommitteeMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/event_committee_members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event_committee_members"] });
    },
  });
}
