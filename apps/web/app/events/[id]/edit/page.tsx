"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useCan } from "@/hooks/use-permissions-gate";
import { useGetEvent, useUpdateEvent } from "@/hooks/use-events";
import { useDivisions } from "@/hooks/use-divisions";
import { apiErrorMessage } from "@repo/shared/types";
import { fromDatetimeLocal, toDatetimeLocal } from "@/lib/datetime";
import { EVENT_STATUS_OPTIONS } from "@/components/display";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditEventPage({ params }: PageProps) {
  const { id } = use(params);
  return (
    <RequireAuth>
      {() => <EditEventForm id={id} />}
    </RequireAuth>
  );
}

function EditEventForm({ id }: { id: string }) {
  const router = useRouter();
  const { "events.edit": canEdit, isLoading: permLoading } = useCan("events.edit");
  const { data: event, isLoading } = useGetEvent(id);
  const { data: divisionsData } = useDivisions({ pageSize: 100 });
  const { mutate: updateEvent, isPending, error } = useUpdateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [allowPermission, setAllowPermission] = useState(true);
  const [status, setStatus] = useState("upcoming");

  useEffect(() => {
    if (!event) return;
    setTitle(event.title || "");
    setDescription(event.description || "");
    setLocation(event.location || "");
    setDivisionId(event.division_id || "");
    setStartTime(toDatetimeLocal(event.start_time));
    setEndTime(toDatetimeLocal(event.end_time));
    setAllowPermission(!!event.allow_permission);
    setStatus(event.status || "upcoming");
  }, [event]);

  if (permLoading || isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-text-muted">
          Anda tidak punya permission <code className="text-accent">events.edit</code>.
        </p>
        <Link href={`/events/${id}`} className="mt-4 inline-block text-sm text-accent">
          Kembali
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center text-sm text-text-muted">
        Event tidak ditemukan.
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateEvent(
      {
        id,
        title,
        description,
        location,
        division_id: divisionId || null,
        start_time: fromDatetimeLocal(startTime),
        end_time: fromDatetimeLocal(endTime),
        allow_permission: allowPermission,
        status,
      },
      { onSuccess: () => router.push(`/events/${id}`) }
    );
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Edit Event</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Judul *</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Deskripsi</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Lokasi *</span>
          <input required value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Divisi</span>
          <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm">
            <option value="">General</option>
            {(divisionsData?.data || []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Mulai</span>
            <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Selesai</span>
            <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm" />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm">
            {EVENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={allowPermission} onChange={(e) => setAllowPermission(e.target.checked)} />
          Izinkan pengajuan izin
        </label>
        {error && <p className="text-sm text-danger">{apiErrorMessage(error, "Gagal menyimpan")}</p>}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={isPending} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
            {isPending ? "Menyimpan…" : "Simpan"}
          </button>
          <Link href={`/events/${id}`} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary">
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}
