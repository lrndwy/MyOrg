"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PermissionGate } from "@/components/auth/permission-gate";
import { CommitteeNav } from "@/components/events/committee-nav";
import { PageHeader } from "@/components/chrome/PageHeader";
import {
  useMarkSubEventAttendance,
  useSubEventRecap,
  useUploadSubEventMinutes,
} from "@/hooks/use-event-committee";
import { formatDate, formatRelative } from "@/lib/formatters";
import { ArrowLeft, ExternalLink, Loader2 } from "@/lib/icons";

export default function SubEventDetailPage() {
  return (
    <PermissionGate permission="events.sub_events.view">
      <SubEventDetailContent />
    </PermissionGate>
  );
}

function SubEventDetailContent() {
  const params = useParams<{ id: string; subId: string }>();
  const { data, isLoading, refetch } = useSubEventRecap(params.subId);
  const { mutate: markAttendance, isPending: marking } = useMarkSubEventAttendance(params.subId);
  const { mutate: uploadMinutes, isPending: uploading } = useUploadSubEventMinutes(params.subId);
  const [minutesUrl, setMinutesUrl] = useState("");

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-danger">Sub event tidak ditemukan.</p>;
  }

  const se = data.sub_event;

  return (
    <div>
      <Link
        href={`/myorg/events/${params.id}/kepanitiaan/sub-events`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke daftar Sub Event
      </Link>

      <PageHeader
        title={se.title}
        subtitle={`${se.location} · ${se.start_time ? formatRelative(se.start_time) : "—"} · mode: ${se.attendance_mode}`}
      />
      <CommitteeNav active="sub-events" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Info label="Status" value={se.status} />
        <Info label="Sie" value={(se.sie as { name?: string } | null)?.name || "Semua kepanitiaan"} />
        <Info
          label="Ketua Pelaksana"
          value={
            (se.ketua_pelaksana as { full_name?: string; email?: string } | null)?.full_name ||
            (se.ketua_pelaksana as { full_name?: string; email?: string } | null)?.email ||
            "—"
          }
        />
      </div>

      {se.description && (
        <p className="mb-6 whitespace-pre-line text-sm text-text-secondary">{se.description}</p>
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href={`/myorg/events/${params.id}/kepanitiaan/sub-events/${params.subId}/recap`}
          className="rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm font-medium hover:bg-bg-hover"
        >
          Rekap Absensi
        </Link>
        {se.minutes_url && (
          <a
            href={se.minutes_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-medium text-accent"
          >
            <ExternalLink className="h-4 w-4" />
            Lihat Notulensi
          </a>
        )}
      </div>

      <PermissionGate permission="events.sub_events.manage">
        <div className="mb-8 rounded-xl border border-border bg-bg-secondary p-4">
          <h3 className="mb-3 font-semibold">Upload Notulensi</h3>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={minutesUrl}
              onChange={(e) => setMinutesUrl(e.target.value)}
              placeholder="URL file notulensi (PDF/DOCX)"
              className="min-w-[240px] flex-1 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!minutesUrl.trim() || uploading}
              onClick={() =>
                uploadMinutes(minutesUrl.trim(), {
                  onSuccess: () => {
                    setMinutesUrl("");
                    refetch();
                  },
                })
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              Simpan
            </button>
          </div>
        </div>
      </PermissionGate>

      {se.attendance_mode === "manual" && (
        <PermissionGate permission="sub_events.attendance.manage">
          <div className="rounded-xl border border-border bg-bg-secondary p-4">
            <h3 className="mb-3 font-semibold">Tandai Absensi Manual</h3>
            <ul className="space-y-2">
              {data.expected_participants.map((u) => {
                const att = data.attendances.find((a) => a.user_id === u.id);
                return (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-primary px-3 py-2 text-sm">
                    <span>{u.full_name || u.email}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs capitalize text-text-muted">{att?.status ?? "belum"}</span>
                      <button
                        type="button"
                        disabled={marking}
                        onClick={() => markAttendance({ userId: u.id, status: "present" }, { onSuccess: () => refetch() })}
                        className="rounded border border-success/30 bg-success/10 px-2 py-1 text-xs text-success"
                      >
                        Hadir
                      </button>
                      <button
                        type="button"
                        disabled={marking}
                        onClick={() => markAttendance({ userId: u.id, status: "absent" }, { onSuccess: () => refetch() })}
                        className="rounded border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger"
                      >
                        Tidak Hadir
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </PermissionGate>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 font-medium capitalize text-foreground">{value}</p>
    </div>
  );
}
