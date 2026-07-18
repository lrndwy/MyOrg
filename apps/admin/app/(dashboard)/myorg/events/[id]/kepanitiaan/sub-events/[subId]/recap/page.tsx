"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PermissionGate } from "@/components/auth/permission-gate";
import { useSubEventRecap } from "@/hooks/use-event-committee";
import { formatDate } from "@/lib/formatters";
import { ArrowLeft, Loader2 } from "@/lib/icons";

export default function SubEventRecapPage() {
  return (
    <PermissionGate permission="events.sub_events.view">
      <SubEventRecapContent />
    </PermissionGate>
  );
}

function SubEventRecapContent() {
  const params = useParams<{ id: string; subId: string }>();
  const { data, isLoading } = useSubEventRecap(params.subId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-danger">Data rekap tidak ditemukan.</p>;
  }

  return (
    <div>
      <Link
        href={`/myorg/events/${params.id}/kepanitiaan/sub-events/${params.subId}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke detail Sub Event
      </Link>

      <h1 className="text-2xl font-bold">Rekap — {data.sub_event.title}</h1>

      <div className="mt-4 mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Hadir" value={data.summary.present} color="text-success" />
        <SummaryCard label="Tidak Hadir" value={data.summary.absent} color="text-danger" />
        <SummaryCard label="Lainnya" value={data.summary.other} color="text-text-muted" />
      </div>

      <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-text-muted">
              <th className="px-4 py-3">Nama</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Waktu</th>
            </tr>
          </thead>
          <tbody>
            {data.expected_participants.map((u) => {
              const att = data.attendances.find((a) => a.user_id === u.id);
              return (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">{u.full_name || u.email}</td>
                  <td className="px-4 py-3 capitalize">{att?.status ?? "belum absen"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {att?.checked_in_at ? formatDate(att.checked_in_at) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
