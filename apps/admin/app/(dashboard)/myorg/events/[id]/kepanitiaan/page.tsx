"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PermissionGate } from "@/components/auth/permission-gate";
import { CommitteeNav } from "@/components/events/committee-nav";
import { PageHeader } from "@/components/chrome/PageHeader";
import { useEventCommitteeOverview } from "@/hooks/use-event-committee";
import { apiClient } from "@/lib/api-client";
import { formatRelative } from "@/lib/formatters";
import { Calendar, Loader2, Users } from "@/lib/icons";
import type { Event } from "@repo/shared/types";

export default function EventKepanitiaanPage() {
  return (
    <PermissionGate permission="events.view">
      <EventKepanitiaanContent />
    </PermissionGate>
  );
}

function EventKepanitiaanContent() {
  const params = useParams<{ id: string }>();
  const { data: overview, isLoading, isError } = useEventCommitteeOverview(params.id);

  const { data: event } = useQuery<Event>({
    queryKey: ["events", params.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/events/${params.id}`);
      return data.data as Event;
    },
    enabled: !!params.id && !overview,
  });

  const ev = overview?.event ?? event;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (isError || !ev) {
    return <p className="text-sm text-danger">Gagal memuat data kepanitiaan.</p>;
  }

  if (ev.event_type !== "kepanitiaan") {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
        Event ini bukan tipe kepanitiaan. Ubah <code>event_type</code> menjadi kepanitiaan di form edit event.
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`Kepanitiaan — ${ev.title}`} subtitle={ev.committee_description || ev.description} />
      <CommitteeNav active="overview" />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Sie" value={overview?.sies.length ?? 0} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Total Anggota" value={overview?.member_count ?? 0} />
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Sub Event" value={overview?.sub_events.length ?? 0} />
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Sub Event Mendatang</h2>
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          {!overview?.sub_events.length ? (
            <p className="px-4 py-8 text-center text-sm text-text-muted">Belum ada sub event.</p>
          ) : (
            <ul className="divide-y divide-border">
              {overview.sub_events.slice(0, 5).map((se) => (
                <li key={se.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="font-medium text-foreground">{se.title}</p>
                    <p className="text-xs text-text-muted">
                      {(se.sie as { name?: string } | null)?.name
                        ? `${(se.sie as { name: string }).name} · `
                        : ""}
                      {se.start_time ? formatRelative(se.start_time) : "—"} · {se.attendance_mode}
                    </p>
                  </div>
                  <Link
                    href={`/myorg/events/${params.id}/kepanitiaan/sub-events/${se.id}`}
                    className="text-sm text-accent hover:underline"
                  >
                    Detail
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Sie Kepanitiaan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(overview?.sies ?? []).map((sie) => (
            <div key={sie.id} className="rounded-xl border border-border bg-bg-secondary p-4">
              <h3 className="font-semibold text-foreground">{sie.name}</h3>
              {sie.description && <p className="mt-1 text-sm text-text-secondary">{sie.description}</p>}
              <p className="mt-2 text-xs text-text-muted">{sie.members?.length ?? 0} anggota</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-text-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
