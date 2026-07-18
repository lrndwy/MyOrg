"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Event,
  EventCommitteeMember,
  EventCommitteeSie,
  EventSubEvent,
  SubEventAttendance,
  User,
} from "@repo/shared/types";

export interface CommitteeSieWithMembers extends EventCommitteeSie {
  members: EventCommitteeMember[];
}

export interface CommitteeOverview {
  event: Event;
  sies: CommitteeSieWithMembers[];
  sub_events: EventSubEvent[];
  member_count: number;
}

export interface SubEventRecapData {
  sub_event: EventSubEvent;
  summary: { present: number; absent: number; other: number };
  attendances: SubEventAttendance[];
  expected_participants: User[];
}

export function useEventCommitteeOverview(eventId: string) {
  return useQuery({
    queryKey: ["events", eventId, "committee"],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/events/${eventId}/committee`);
      return data.data as CommitteeOverview;
    },
    enabled: !!eventId,
  });
}

export function useEventSubEvents(eventId: string, sieId?: string) {
  return useQuery({
    queryKey: ["events", eventId, "sub-events", sieId ?? "all"],
    queryFn: async () => {
      const params = sieId ? `?sie_id=${sieId}` : "";
      const { data } = await apiClient.get(`/api/events/${eventId}/sub-events${params}`);
      return (data.data ?? []) as EventSubEvent[];
    },
    enabled: !!eventId,
  });
}

export function useSubEventRecap(subEventId: string) {
  return useQuery({
    queryKey: ["sub-events", subEventId, "recap"],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/sub_events/${subEventId}/recap`);
      return data.data as SubEventRecapData;
    },
    enabled: !!subEventId,
  });
}

export function useMarkSubEventAttendance(subEventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const { data } = await apiClient.put(`/api/sub_events/${subEventId}/attendance/${userId}`, {
        status,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-events", subEventId, "recap"] });
    },
  });
}

export function useUploadSubEventMinutes(subEventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (minutesUrl: string) => {
      const { data } = await apiClient.post(`/api/sub_events/${subEventId}/minutes`, {
        minutes_url: minutesUrl,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sub-events", subEventId, "recap"] });
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
