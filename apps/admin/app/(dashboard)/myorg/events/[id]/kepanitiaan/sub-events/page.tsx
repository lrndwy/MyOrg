"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PermissionGate } from "@/components/auth/permission-gate";
import { CommitteeNav } from "@/components/events/committee-nav";
import { PageHeader } from "@/components/chrome/PageHeader";
import { useEventCommitteeOverview, useEventSubEvents } from "@/hooks/use-event-committee";
import { useCreateResource } from "@/hooks/use-resource";
import { formatRelative } from "@/lib/formatters";
import { Loader2, Plus } from "@/lib/icons";

export default function EventSubEventsPage() {
  return (
    <PermissionGate permission="events.sub_events.view">
      <SubEventsContent />
    </PermissionGate>
  );
}

function SubEventsContent() {
  const params = useParams<{ id: string }>();
  const { data: overview } = useEventCommitteeOverview(params.id);
  const { data: subEvents, isLoading, refetch } = useEventSubEvents(params.id);
  const { mutate: createSubEvent, isPending } = useCreateResource("/api/event_sub_events");

  const [form, setForm] = useState({
    title: "",
    location: "",
    sie_id: "",
    ketua_pelaksana_id: "",
    attendance_mode: "manual",
    start_time: "",
    end_time: "",
  });

  const members = (overview?.sies ?? []).flatMap((s) => s.members ?? []);
  const uniqueMembers = Array.from(new Map(members.map((m) => [m.user_id, m])).values());

  const onCreate = () => {
    if (!form.title.trim() || !form.location.trim() || !form.ketua_pelaksana_id) return;
    createSubEvent(
      {
        event_id: params.id,
        title: form.title.trim(),
        location: form.location.trim(),
        sie_id: form.sie_id || undefined,
        ketua_pelaksana_id: form.ketua_pelaksana_id,
        attendance_mode: form.attendance_mode,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        status: "upcoming",
      },
      {
        onSuccess: () => {
          setForm({
            title: "",
            location: "",
            sie_id: "",
            ketua_pelaksana_id: "",
            attendance_mode: "manual",
            start_time: "",
            end_time: "",
          });
          refetch();
        },
      },
    );
  };

  return (
    <div>
      <PageHeader title="Sub Event" subtitle={overview?.event.title} />
      <CommitteeNav active="sub-events" />

      <PermissionGate permission="events.sub_events.manage">
        <div className="mb-6 rounded-xl border border-border bg-bg-secondary p-4 space-y-3">
          <h3 className="font-semibold">Buat Sub Event</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              placeholder="Judul (mis. Rapat Koordinasi Acara)"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            />
            <input
              placeholder="Lokasi"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            />
            <select
              value={form.sie_id}
              onChange={(e) => setForm((f) => ({ ...f, sie_id: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            >
              <option value="">Semua kepanitiaan (tanpa Sie)</option>
              {(overview?.sies ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={form.ketua_pelaksana_id}
              onChange={(e) => setForm((f) => ({ ...f, ketua_pelaksana_id: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            >
              <option value="">Ketua Pelaksana *</option>
              {uniqueMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {(
                    m.user as { full_name?: string; email?: string } | null
                  )?.full_name ||
                    (m.user as { full_name?: string; email?: string } | null)?.email ||
                    m.user_id}
                </option>
              ))}
            </select>
            <select
              value={form.attendance_mode}
              onChange={(e) => setForm((f) => ({ ...f, attendance_mode: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            >
              <option value="manual">Absensi Manual</option>
              <option value="selfie">Absensi Selfie</option>
            </select>
            <input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={onCreate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Buat Sub Event
          </button>
        </div>
      </PermissionGate>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          {!subEvents?.length ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">Belum ada sub event.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-text-muted">
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Sie</th>
                  <th className="px-4 py-3">Ketua</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {subEvents.map((se) => (
                  <tr key={se.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{se.title}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {(se.sie as { name?: string } | null)?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {(se.ketua_pelaksana as { full_name?: string; email?: string } | null)?.full_name ||
                        (se.ketua_pelaksana as { full_name?: string; email?: string } | null)?.email ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 capitalize">{se.attendance_mode}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {se.start_time ? formatRelative(se.start_time) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/myorg/events/${params.id}/kepanitiaan/sub-events/${se.id}`}
                        className="text-accent hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
