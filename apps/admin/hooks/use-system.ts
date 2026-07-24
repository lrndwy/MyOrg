import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Upload, PaginatedResponse, StorageFolder, StorageBreadcrumb } from "@repo/shared/types";
import { apiClient, uploadFile } from "@/lib/api-client";

// ── Jobs ────────────────────────────────────────────────────────

interface QueueStats {
  queue: string;
  size: number;
  active: number;
  pending: number;
  completed: number;
  failed: number;
  retry: number;
  scheduled: number;
  processed: number;
}

interface Job {
  id: string;
  type: string;
  queue: string;
  max_retry: number;
  retried: number;
  last_error: string;
}

export function useJobStats() {
  return useQuery<QueueStats[]>({
    queryKey: ["admin", "jobs", "stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/admin/jobs/stats");
      return data.data;
    },
    refetchInterval: 5000,
  });
}

export function useJobsByStatus(status: string, queue = "default") {
  return useQuery<Job[]>({
    queryKey: ["admin", "jobs", status, queue],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/admin/jobs/${status}?queue=${queue}`);
      return data.data;
    },
    refetchInterval: 5000,
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, queue }: { id: string; queue?: string }) => {
      await apiClient.post(`/api/admin/jobs/${id}/retry?queue=${queue || "default"}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] });
    },
  });
}

export function useClearQueue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (queue: string) => {
      await apiClient.delete(`/api/admin/jobs/queue/${queue}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] });
    },
  });
}

// ── Files ───────────────────────────────────────────────────────
// Upload + PaginatedResponse are imported from @repo/shared/types so
// the same shapes flow through web, admin, and the Go API (via
// grit sync) — no inline duplicates that silently drift.
type UploadListResponse = PaginatedResponse<Upload>;

export function useUploads(
  page = 1,
  pageSize = 20,
  opts?: { search?: string; kind?: string; folderId?: string | null },
) {
  return useQuery<UploadListResponse>({
    queryKey: ["admin", "uploads", page, pageSize, opts?.search, opts?.kind, opts?.folderId ?? "root"],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        all: "true",
        folder_id: opts?.folderId ?? "",
      });
      if (opts?.search) params.set("search", opts.search);
      if (opts?.kind) params.set("kind", opts.kind);
      const { data } = await apiClient.get(`/api/uploads?${params}`);
      return data;
    },
  });
}

// v3.31.32 — storage stats. Returns total file count, total bytes,
// and a per-kind breakdown (image / video / audio / pdf / document /
// spreadsheet / other) so the Files admin page can show usage at a
// glance.
export interface UploadStats {
  total_count: number;
  total_size: number;
  by_kind: { kind: string; count: number; size: number }[];
}

export function useUploadStats() {
  return useQuery<{ data: UploadStats }>({
    queryKey: ["admin", "uploads", "stats"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/uploads/stats?all=true");
      return data;
    },
  });
}

export function useUploadFile(folderId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      const params = new URLSearchParams({ source: "cloud", accepts: "all" });
      if (folderId) params.set("folder_id", folderId);
      const { data } = await apiClient.post(`/api/uploads?${params}`, form);
      return data.data as unknown as Upload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "uploads"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "storage-folders"] });
    },
  });
}

export function useDeleteUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/uploads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "uploads"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "uploads", "stats"] });
    },
  });
}

export function useStorageFolders(parentId?: string | null) {
  return useQuery<{ data: StorageFolder[] }>({
    queryKey: ["admin", "storage-folders", parentId ?? "root"],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (parentId) params.set("parent_id", parentId);
      const { data } = await apiClient.get(`/api/storage/folders?${params}`);
      return data;
    },
  });
}

export function useStorageBreadcrumb(folderId?: string | null) {
  return useQuery<{ data: StorageBreadcrumb[] }>({
    queryKey: ["admin", "storage-folders", "breadcrumb", folderId ?? "root"],
    enabled: !!folderId,
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/storage/folders/${folderId}/breadcrumb`);
      return data;
    },
  });
}

export function useCreateStorageFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; parent_id?: string | null }) => {
      const { data } = await apiClient.post("/api/storage/folders", payload);
      return data.data as StorageFolder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "storage-folders"] });
    },
  });
}

export function useDeleteStorageFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/storage/folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "storage-folders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "uploads"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "uploads", "stats"] });
    },
  });
}

export function useMoveUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
      const { data } = await apiClient.patch(`/api/uploads/${id}/move`, {
        folder_id: folderId,
      });
      return data.data as Upload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "uploads"] });
    },
  });
}

export async function fetchUploadDownloadUrl(id: string) {
  const { data } = await apiClient.get(`/api/uploads/${id}/download`);
  return data.data as { url: string; filename: string; expires_in: number };
}

// ── Cron ────────────────────────────────────────────────────────

interface CronTask {
  name: string;
  schedule: string;
  type: string;
}

export function useCronTasks() {
  return useQuery<CronTask[]>({
    queryKey: ["admin", "cron", "tasks"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/admin/cron/tasks");
      return data.data;
    },
  });
}
