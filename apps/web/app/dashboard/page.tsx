"use client";

import Link from "next/link";
import { Calendar, MapPin, Megaphone, ArrowRight } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, EventStatusBadge } from "@/components/display";
import { EventsCalendar } from "@/components/events-calendar";
import { stripHtml } from "@/components/rich-content";
import {
  PageContainer,
  PageHeader,
  SectionTitle,
  Surface,
} from "@/components/page-shell";
import { formatDateTime } from "@/lib/datetime";
import { useEvents } from "@/hooks/use-events";
import { useAnnouncements } from "@/hooks/use-announcements";

export default function DashboardPage() {
  return (
    <RequireAuth>
      {(user) => <DashboardContent name={user.full_name || user.first_name} />}
    </RequireAuth>
  );
}

function DashboardContent({ name }: { name: string }) {
  const {
    data: eventsData,
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useEvents({
    pageSize: 100,
    sortBy: "start_time",
    sortOrder: "asc",
  });
  const {
    data: announcementsData,
    isLoading: announcementsLoading,
    isError: announcementsError,
    refetch: refetchAnnouncements,
  } = useAnnouncements({
    pageSize: 5,
    sortBy: "created_at",
    sortOrder: "desc",
  });

  const allEvents = eventsData?.data || [];
  const upcomingEvents = allEvents
    .filter((e) => e.status === "upcoming" || e.status === "ongoing")
    .slice(0, 5);

  return (
    <PageContainer>
      <PageHeader
        title={`Selamat datang, ${name || "teman"}`}
        description="Ringkasan event dan pengumuman organisasi Anda."
      />

      <Surface className="mb-8 p-4 sm:p-5">
        {eventsError ? (
          <ErrorState
            message="Gagal memuat kalender acara."
            onRetry={() => refetchEvents()}
          />
        ) : (
          <EventsCalendar events={allEvents} isLoading={eventsLoading} />
        )}
      </Surface>

      <div className="grid gap-6 lg:grid-cols-2">
        <Surface>
          <SectionTitle
            action={
              <Link
                href="/events"
                className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
              >
                Semua <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              Event mendatang
            </span>
          </SectionTitle>

          {eventsLoading ? (
            <SkeletonList />
          ) : eventsError ? (
            <ErrorState
              message="Gagal memuat events."
              onRetry={() => refetchEvents()}
            />
          ) : upcomingEvents.length === 0 ? (
            <EmptyState>Belum ada event upcoming/ongoing.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="block rounded-lg border border-border bg-background p-3.5 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground">{event.title}</p>
                    <EventStatusBadge status={event.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Surface>

        <Surface>
          <SectionTitle
            action={
              <Link
                href="/announcements"
                className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent-hover"
              >
                Semua <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <span className="inline-flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-accent" />
              Pengumuman terbaru
            </span>
          </SectionTitle>

          {announcementsLoading ? (
            <SkeletonList />
          ) : announcementsError ? (
            <ErrorState
              message="Gagal memuat pengumuman."
              onRetry={() => refetchAnnouncements()}
            />
          ) : !announcementsData?.data?.length ? (
            <EmptyState>Belum ada pengumuman.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {announcementsData.data.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  href="/announcements"
                  className="block rounded-lg border border-border bg-background p-3.5 transition-colors hover:border-accent/40"
                >
                  <p className="font-medium text-foreground">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                    {stripHtml(a.content || "") || "—"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </PageContainer>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2.5">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 animate-pulse rounded-lg border border-border bg-bg-secondary"
        />
      ))}
    </div>
  );
}
