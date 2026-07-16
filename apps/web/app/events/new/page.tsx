"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { useCan } from "@/hooks/use-permissions-gate";
import { useCreateEvent } from "@/hooks/use-events";
import { useDivisions } from "@/hooks/use-divisions";
import { apiErrorMessage } from "@repo/shared/types";
import { EVENT_STATUS_OPTIONS } from "@/components/display";
import { fromDatetimeLocal } from "@/lib/datetime";

export default function NewEventPage() {
  return (
    <RequireAuth>
      {() => <NewEventForm />}
    </RequireAuth>
  );
}

function NewEventForm() {
  const router = useRouter();
  const { "events.create": canCreate, isLoading: permLoading } = useCan(
    "events.create"
  );
  const { data: divisionsData } = useDivisions({ pageSize: 100 });
  const { mutate: createEvent, isPending, error } = useCreateEvent();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState("upcoming");
  const [allowPermission, setAllowPermission] = useState(true);

  if (permLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <p className="text-sm text-text-muted">
          Anda tidak punya permission <code className="text-accent">events.create</code>.
        </p>
        <Link href="/events" className="mt-4 inline-block text-sm text-accent hover:text-accent-hover">
          Kembali ke Events
        </Link>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createEvent(
      {
        title,
        description,
        location,
        division_id: divisionId || null,
        start_time: fromDatetimeLocal(startTime),
        end_time: fromDatetimeLocal(endTime),
        allow_permission: allowPermission,
        status,
      },
      {
        onSuccess: (res) => {
          const id = res?.data?.id;
          router.push(id ? `/events/${id}` : "/events");
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Buat Event</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Default status <span className="font-medium">upcoming</span>; cron akan mengubahnya otomatis sesuai jadwal.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Judul" required>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Deskripsi">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Lokasi" required>
          <input
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Divisi (kosong = General)">
          <select
            value={divisionId}
            onChange={(e) => setDivisionId(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
          >
            <option value="">General</option>
            {(divisionsData?.data || []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mulai">
            <input
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Selesai">
            <input
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Field label="Status" required>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
          >
            {EVENT_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={allowPermission}
            onChange={(e) => setAllowPermission(e.target.checked)}
            className="rounded border-border"
          />
          Izinkan pengajuan izin (permission) untuk event ini
        </label>

        {error && (
          <p className="text-sm text-danger">{apiErrorMessage(error, "Gagal membuat event")}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? "Menyimpan…" : "Simpan Event"}
          </button>
          <Link
            href="/events"
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary hover:bg-bg-hover"
          >
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
