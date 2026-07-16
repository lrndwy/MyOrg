import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface PermissionRequest {
  id: string;
  event_id: string;
  event?: any;
  user_id: string;
  user?: any;
  reason: string;
  proof_url: string;
  status: string;
  reviewed_by_id: string;
  reviewed_by?: any;
  review_note: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PermissionRequestsResponse {
  data: PermissionRequest[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

interface UsePermissionRequestsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

export function usePermissionRequests({ page = 1, pageSize = 20, search = "", sortBy = "created_at", sortOrder = "desc" }: UsePermissionRequestsParams = {}) {
  return useQuery<PermissionRequestsResponse>({
    queryKey: ["permission_requests", { page, pageSize, search, sortBy, sortOrder }],
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
      const { data } = await apiClient.get(`/api/permission_requests?${params}`);
      return data;
    },
  });
}

export function useGetPermissionRequest(id: string) {
  return useQuery<PermissionRequest>({
    queryKey: ["permission_requests", id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/permission_requests/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useCreatePermissionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      const { data } = await apiClient.post("/api/permission_requests", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission_requests"] });
    },
  });
}

export function useUpdatePermissionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const { data } = await apiClient.put(`/api/permission_requests/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission_requests"] });
    },
  });
}

export function useDeletePermissionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/permission_requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permission_requests"] });
    },
  });
}

// --- MyOrg custom endpoints (distinct from the generated CRUD above:
// note the hyphenated path, not permission_requests) ---

export interface CreateMyPermissionRequestInput {
  event_id: string;
  reason: string;
  proof_url: string;
}

// POST /api/permission-requests — the current user submits a leave
// request for an event, instead of an admin creating one on someone
// else's behalf.
export function useCreateMyPermissionRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateMyPermissionRequestInput) => {
      const { data } = await apiClient.post("/api/permission-requests", input);
      return data.data as PermissionRequest;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["my-permission-requests"] });
      if (data?.event_id) {
        queryClient.invalidateQueries({
          queryKey: ["events", data.event_id, "my-attendance"],
        });
      }
    },
  });
}

// GET /api/permission-requests/me — the current user's own permission
// request history (no pagination — capped server-side by user scope).
export function useMyPermissionRequests() {
  return useQuery<PermissionRequest[]>({
    queryKey: ["my-permission-requests"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/permission-requests/me");
      return data.data as PermissionRequest[];
    },
  });
}
