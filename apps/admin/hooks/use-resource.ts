import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface ResourceQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, string>;
  // v3.31.34 — date-window filter. dateParams comes from
  // dateRangeToQueryParams(); dateField overrides the server's
  // default "created_at" target column when set.
  dateParams?: Record<string, string>;
  dateField?: string;
}

interface PaginatedResponse<T = Record<string, unknown>> {
  data: T[];
  meta: {
    total: number;
    page: number;
    page_size: number;
    pages: number;
  };
}

export function useResource<T = Record<string, unknown>>(
  endpoint: string,
  params: ResourceQueryParams = {}
) {
  const { page = 1, pageSize = 20, search, sortBy, sortOrder, filters, dateParams, dateField } = params;

  return useQuery<PaginatedResponse<T>>({
    // v3.31.34: dateParams + dateField included in key so a date
    // filter change invalidates the cache and the list refetches.
    queryKey: [endpoint, { page, pageSize, search, sortBy, sortOrder, filters, dateParams, dateField }],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
      });

      if (search) searchParams.set("search", search);
      if (sortBy) {
        searchParams.set("sort_by", sortBy);
        searchParams.set("sort_order", sortOrder ?? "desc");
      }
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value) searchParams.set(key, value);
        });
      }
      if (dateParams) {
        Object.entries(dateParams).forEach(([key, value]) => {
          if (value) searchParams.set(key, value);
        });
      }
      if (dateField && dateField !== "created_at") {
        searchParams.set("date_field", dateField);
      }

      const { data } = await apiClient.get(`${endpoint}?${searchParams}`);
      return data;
    },
  });
}

export function useResourceItem<T = Record<string, unknown>>(
  endpoint: string,
  id: string,
  options?: { enabled?: boolean }
) {
  return useQuery<{ data: T }>({
    queryKey: [endpoint, id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${endpoint}/${id}`);
      return data;
    },
    enabled: (options?.enabled ?? true) && !!id,
  });
}

export function useCreateResource(endpoint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post(endpoint, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast.success("Created successfully");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(axiosErr?.response?.data?.error?.message || "Failed to create");
    },
  });
}

export function useUpdateResource(endpoint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await apiClient.put(`${endpoint}/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast.success("Updated successfully");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(axiosErr?.response?.data?.error?.message || "Failed to update");
    },
  });
}

// v3.31.18: partial updates for the grouped update view. Each group's
// Save button calls patch() with only the fields it owns. The Go-side
// Patch handler whitelists writable columns and silently drops anything
// else, so it's safe to send only a subset.
export function usePatchResource(endpoint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await apiClient.patch(`${endpoint}/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast.success("Saved");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(axiosErr?.response?.data?.error?.message || "Failed to save");
    },
  });
}

export function useDeleteResource(endpoint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`${endpoint}/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast.success("Deleted successfully");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(axiosErr?.response?.data?.error?.message || "Failed to delete");
    },
  });
}

export function useBulkDeleteResource(endpoint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    // ids are strings because Grit's models use UUID primary keys
    // (the User.ID column in packages/shared/types/user.ts is 'string',
    // and the same is true for every grit generate'd model).
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.delete(`${endpoint}/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
      toast.success("Deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete some items");
    },
  });
}
