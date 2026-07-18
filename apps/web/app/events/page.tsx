"use client";

import Link from "next/link";
import { Calendar, MapPin, Plus } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, EventStatusBadge } from "@/components/display";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { formatDateTime } from "@/lib/datetime";
import { useEvents } from "@/hooks/use-events";
import { useCan } from "@/hooks/use-permissions-gate";

export default function EventsPage() {
  return <RequireAuth>{() => <EventsList />}</RequireAuth>;
}

function EventsList() {
  const { data, isLoading, isError, refetch } = useEvents({
    pageSize: 50,
    sortBy: "start_time",
    sortOrder: "desc",
  });
  const { "events.create": canCreate } = useCan("events.create");

  return (
    <PageContainer>
      <PageHeader
        title="Events"
        description="Lihat event, absensi, dan kelola event sesuai permission Anda."
        actions={
          canCreate ? (
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
            >
              <Plus className="h-4 w-4" />
              Buat Event
            </Link>
          ) : undefined
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Gagal memuat events." onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState>
          Belum ada event.
          {canCreate && (
            <>
              {" "}
              <Link href="/events/new" className="text-accent hover:text-accent-hover">
                Buat yang pertama
              </Link>
            </>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.data.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="block rounded-xl border border-border bg-bg-elevated p-5 shadow-sm transition-colors hover:border-accent/40"
            >
              {event.banner_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={event.banner_url}
                  alt=""
                  className="mb-3 h-28 w-full rounded-lg border border-border object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground">{event.title}</p>
                <EventStatusBadge status={event.status} />
              </div>
              {event.description && (
                <p className="mt-2 line-clamp-2 text-sm text-text-secondary">
                  {event.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(event.start_time)}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {event.location}
                  </span>
                )}
                {(() => {
                  const divisionName =
                    event.division &&
                    typeof event.division === "object" &&
                    "name" in event.division
                      ? (event.division as { name: string }).name
                      : null;
                  if (!divisionName && event.division_id !== null) return null;
                  return (
                    <span className="text-text-muted">{divisionName || "General"}</span>
                  );
                })()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
