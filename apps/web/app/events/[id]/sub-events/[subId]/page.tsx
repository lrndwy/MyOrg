"use client";

import { use } from "react";
import Link from "next/link";
import { Calendar, MapPin, Camera } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { formatDateTime } from "@/lib/datetime";
import { useGetEvent } from "@/hooks/use-events";
import { useMySubEventAttendance } from "@/hooks/use-event-committee";
import { useCan } from "@/hooks/use-permissions-gate";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { EventSubEvent } from "@repo/shared/types";

interface PageProps {
  params: Promise<{ id: string; subId: string }>;
}

export default function SubEventDetailPage({ params }: PageProps) {
  const { id, subId } = use(params);
  return (
    <RequireAuth>
      {() => <SubEventDetail eventId={id} subEventId={subId} />}
    </RequireAuth>
  );
}

function SubEventDetail({ eventId, subEventId }: { eventId: string; subEventId: string }) {
  const { data: event } = useGetEvent(eventId);
  const { data: subEvent, isLoading } = useQuery<EventSubEvent>({
    queryKey: ["sub-events", subEventId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/event_sub_events/${subEventId}`);
      return data.data as EventSubEvent;
    },
    enabled: !!subEventId,
  });
  const { data: myAttendance } = useMySubEventAttendance(subEventId);
  const { "sub_events.attendance.submit": canAttend } = useCan("sub_events.attendance.submit");

  if (isLoading || !subEvent) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="h-32 animate-pulse rounded-xl border border-border bg-bg-secondary" />
      </div>
    );
  }

  const canShowAbsen =
    canAttend &&
    subEvent.attendance_mode === "selfie" &&
    subEvent.status === "ongoing" &&
    !myAttendance;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href={`/events/${eventId}`} className="text-sm text-accent hover:text-accent-hover">
        ← {event?.title || "Event"}
      </Link>

      <h1 className="mt-4 text-2xl font-bold">{subEvent.title}</h1>

      <div className="mt-4 flex flex-col gap-2 text-sm text-text-secondary">
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {formatDateTime(subEvent.start_time)}
          {subEvent.end_time ? ` — ${formatDateTime(subEvent.end_time)}` : ""}
        </span>
        {subEvent.location && (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {subEvent.location}
          </span>
        )}
        <span className="capitalize text-xs text-text-muted">
          Status: {subEvent.status} · Mode: {subEvent.attendance_mode}
        </span>
      </div>

      {subEvent.description && (
        <p className="mt-6 whitespace-pre-line text-sm text-text-secondary">{subEvent.description}</p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {myAttendance && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
            <Camera className="h-4 w-4" />
            Sudah absen ({myAttendance.status})
          </span>
        )}
        {canShowAbsen && (
          <Link
            href={`/events/${eventId}/sub-events/${subEventId}/attendance`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Camera className="h-4 w-4" />
            Absen Sub Event
          </Link>
        )}
      </div>
    </div>
  );
}
