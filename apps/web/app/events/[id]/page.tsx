"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, MapPin, Camera, FileText, Pencil, Trash2 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EventStatusBadge } from "@/components/display";
import { formatDateTime } from "@/lib/datetime";
import { useGetEvent, useDeleteEvent } from "@/hooks/use-events";
import { useEventCheckInGate } from "@/hooks/use-event-check-in-gate";
import { useCan } from "@/hooks/use-permissions-gate";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EventDetailPage({ params }: PageProps) {
  const { id } = use(params);
  return <RequireAuth>{() => <EventDetail id={id} />}</RequireAuth>;
}

function EventDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: event, isLoading, isError } = useGetEvent(id);
  const {
    attendance: myAttendance,
    activePermission,
    canSubmitAttendance,
    canSubmitPermission,
    isLoading: gateLoading,
  } = useEventCheckInGate(id);
  const {
    "events.edit": canEdit,
    "events.delete": canDelete,
    "attendance.submit": canAttend,
    "permission.submit": canRequestPermission,
  } = useCan(
    "events.edit",
    "events.delete",
    "attendance.submit",
    "permission.submit"
  );
  const { mutate: deleteEvent, isPending: deleting } = useDeleteEvent();

  if (isLoading || gateLoading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="h-40 rounded-xl border border-border bg-bg-secondary animate-pulse" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10 text-center">
        <p className="text-sm text-text-muted">Event tidak ditemukan.</p>
        <Link href="/events" className="mt-4 inline-block text-sm text-accent hover:text-accent-hover">
          Kembali ke Events
        </Link>
      </div>
    );
  }

  const onDelete = () => {
    if (!confirm(`Hapus event "${event.title}"?`)) return;
    deleteEvent(id, { onSuccess: () => router.push("/events") });
  };

  const canShowAbsen =
    canAttend && canSubmitAttendance && event.status === "ongoing";
  const canShowPermission =
    canRequestPermission &&
    event.allow_permission &&
    canSubmitPermission;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {event.banner_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={event.banner_url}
          alt={event.title}
          className="mb-6 h-48 w-full rounded-xl object-cover border border-border"
        />
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {event.division && typeof event.division === "object" && "name" in event.division
              ? (event.division as { name: string }).name
              : "General"}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{event.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Link
              href={`/events/${id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium hover:bg-bg-hover"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleting ? "Menghapus…" : "Hapus"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 text-sm text-text-secondary">
        <span className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {formatDateTime(event.start_time)}
          {event.end_time ? ` — ${formatDateTime(event.end_time)}` : ""}
        </span>
        {event.location && (
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            {event.location}
          </span>
        )}
        <div className="pt-1">
          <EventStatusBadge status={event.status} />
        </div>
      </div>

      {event.description && (
        <p className="mt-6 whitespace-pre-line text-sm text-text-secondary leading-relaxed">
          {event.description}
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        {canAttend && myAttendance && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
            <Camera className="h-4 w-4" />
            Sudah absen
            {myAttendance.status ? ` (${myAttendance.status})` : ""}
          </span>
        )}
        {canAttend && !myAttendance && activePermission && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm font-medium text-text-muted">
            <Camera className="h-4 w-4" />
            Tidak bisa absen — sudah mengajukan izin
          </span>
        )}
        {canAttend && canSubmitAttendance && event.status !== "ongoing" && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm font-medium text-text-muted">
            <Camera className="h-4 w-4" />
            Absensi hanya saat event ongoing
          </span>
        )}
        {canShowAbsen && (
          <Link
            href={`/events/${id}/attendance`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
          >
            <Camera className="h-4 w-4" />
            Absen
          </Link>
        )}
        {activePermission && (
          <Link
            href="/my-permissions"
            className="inline-flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 px-4 py-2.5 text-sm font-semibold text-info"
          >
            <FileText className="h-4 w-4" />
            Izin {activePermission.status}
          </Link>
        )}
        {canShowPermission && (
          <Link
            href={`/events/${id}/permission/create`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-bg-hover transition-colors"
          >
            <FileText className="h-4 w-4" />
            Ajukan Izin
          </Link>
        )}
      </div>
    </div>
  );
}
