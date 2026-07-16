import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  announcement?: any;
  file_url: string;
  file_type: string;
  created_at: string;
  updated_at: string;
}

interface AnnouncementAttachmentsResponse {
  data: AnnouncementAttachment[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UseAnnouncementAttachmentsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function useAnnouncementAttachments({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UseAnnouncementAttachmentsParams = {}) {
  return useQuery<AnnouncementAttachmentsResponse>({
    queryKey: ["announcement_attachments", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/announcement_attachments?${params}`);
      return data;
    },
  });
}

export function useGetAnnouncementAttachment(id: string) {
  return useQuery<AnnouncementAttachment>({
    queryKey: ["announcement_attachments", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/announcement_attachments/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreateAnnouncementAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/announcement_attachments", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement_attachments"] });
    },
  });
}

export function useUpdateAnnouncementAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/announcement_attachments/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement_attachments"] });
    },
  });
}

export function useDeleteAnnouncementAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/announcement_attachments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement_attachments"] });
    },
  });
}
