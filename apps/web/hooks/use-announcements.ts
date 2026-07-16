import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  file_url: string;
  file_type: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  target_type: string;
  target_division_id: string;
  target_division?: { id?: string; name?: string } | null;
  publish_date: string | null;
  attachments?: AnnouncementAttachment[];
  created_at: string;
  updated_at: string;
}

interface AnnouncementsResponse {
  data: Announcement[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseAnnouncementsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useAnnouncements({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseAnnouncementsParams = {}) {
  return useQuery<AnnouncementsResponse>({
    queryKey: ["announcements", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/announcements?${params}`);
      return data;
    },
  });
}

export function useGetAnnouncement(id: string) {
  return useQuery<Announcement>({
    queryKey: ["announcements", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/announcements/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/announcements", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/announcements/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
  });
}
