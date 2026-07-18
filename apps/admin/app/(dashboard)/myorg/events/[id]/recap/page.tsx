"use client";

import type { ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PermissionGate } from "@/components/auth/permission-gate";
import { IconButton } from "@/components/ui/IconButton";
import { apiClient } from "@/lib/api-client";
import { formatDate } from "@/lib/formatters";
import { ArrowLeft, Loader2, Users, Check, Clock, AlertCircle, X } from "@/lib/icons";
import type { Attendance, Event } from "@repo/shared/types";

interface RecapSummary {
  present: number;
  permitted: number;
  absent: number;
  other: number;
}

interface RecapResponse {
  event: Event;
  summary: RecapSummary;
  attendances: Attendance[];
}

function userLabel(u?: Attendance["user"]): string {
  if (!u || typeof u !== "object") return "Unknown user";
  const user = u as {
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
  };
  const full = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return user.full_name || full || user.email || "Unknown user";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    present: "bg-success/15 text-success",
    permitted: "bg-info/15 text-info",
    absent: "bg-danger/15 text-danger",
  };
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize " + (styles[status] ?? "bg-text-muted/15 text-text-muted")}>
      {status}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <div className="flex items-center justify-between">
        <span className={"inline-flex h-9 w-9 items-center justify-center rounded-lg " + color}>{icon}</span>
        <span className="text-2xl font-bold text-foreground">{value}</span>
      </div>
      <p className="mt-2 text-sm text-text-secondary">{label}</p>
    </div>
  );
}

export default function EventRecapPage() {
  return (
    <PermissionGate permission="events.view">
      <EventRecapPageContent />
    </PermissionGate>
  );
}

function EventRecapPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery<RecapResponse>({
    queryKey: ["myorg", "event-recap", params.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/events/${params.id}/recap`);
      return data.data as RecapResponse;
    },
    enabled: !!params.id,
  });

  const total = data
    ? data.summary.present + data.summary.permitted + data.summary.absent + data.summary.other
    : 0;

  return (
    <div>
      <PageHeader
        title={data?.event?.title ? `Recap — ${data.event.title}` : "Event Recap"}
        subtitle={
          data?.event
            ? `${data.event.location || "No location"} · ${
                data.event.start_time ? formatDate(data.event.start_time) : "No date set"
              }`
            : undefined
        }
        actions={
          <IconButton
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            label="Back to Events"
            onClick={() => router.push("/resources/events")}
          />
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : isError || !data ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load the recap for this event. It may not exist.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryCard label="Present" value={data.summary.present} icon={<Check className="h-4 w-4 text-success" />} color="bg-success/10" />
            <SummaryCard label="Permitted" value={data.summary.permitted} icon={<Clock className="h-4 w-4 text-info" />} color="bg-info/10" />
            <SummaryCard label="Absent" value={data.summary.absent} icon={<X className="h-4 w-4 text-danger" />} color="bg-danger/10" />
            <SummaryCard label="Total" value={total} icon={<Users className="h-4 w-4 text-accent" />} color="bg-accent/10" />
          </div>

          <div className="mt-6 rounded-xl border border-border bg-bg-secondary overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-[15px] font-semibold text-foreground">Attendance records</h3>
              <p className="text-sm text-text-secondary">{data.attendances.length} record(s) for this event</p>
            </div>

            {!data.attendances.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-8 w-8 text-text-muted" />
                <p className="mt-3 text-sm text-text-secondary">No attendance records yet</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Selfie</th>
                    <th className="px-4 py-3">Signature</th>
                    <th className="px-4 py-3">Checked in</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendances.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{userLabel(a.user)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={a.status} />
                      </td>
                      <td className="px-4 py-3">
                        {a.selfie_url ? (
                          <a href={a.selfie_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            View
                          </a>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {a.signature_url ? (
                          <a href={a.signature_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                            View
                          </a>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {a.checked_in_at ? formatDate(a.checked_in_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
