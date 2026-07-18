"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { EventSubEvent, SubEventAttendance } from "@repo/shared/types";

export function useMyEventSubEvents(eventId: string) {
  return useQuery({
    queryKey: ["events", eventId, "my-sub-events"],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/events/${eventId}/my-sub-events`);
      return (data.data ?? []) as EventSubEvent[];
    },
    enabled: !!eventId,
  });
}

export function useMySubEventAttendance(subEventId: string) {
  return useQuery({
    queryKey: ["sub-events", subEventId, "my-attendance"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get(`/api/sub_events/${subEventId}/my-attendance`);
        return data.data as SubEventAttendance;
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!subEventId,
  });
}

export function useSubmitSubEventAttendance(subEventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { selfie_url: string; signature_url: string }) => {
      const { data } = await apiClient.post(`/api/sub_events/${subEventId}/attendance`, body);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-events", subEventId, "my-attendance"] });
    },
  });
}

export function useSubEventRecap(subEventId: string) {
  return useQuery({
    queryKey: ["sub-events", subEventId, "recap"],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/sub_events/${subEventId}/recap`);
      return data.data;
    },
    enabled: !!subEventId,
  });
}
