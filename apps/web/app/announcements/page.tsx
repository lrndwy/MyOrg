"use client";

import { Megaphone, Paperclip } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, TargetTypeBadge } from "@/components/display";
import { RichContent } from "@/components/rich-content";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { formatDate, isImageUrl } from "@/lib/datetime";
import { useAnnouncements } from "@/hooks/use-announcements";

export default function AnnouncementsPage() {
  return <RequireAuth>{() => <AnnouncementsList />}</RequireAuth>;
}

function AnnouncementsList() {
  const { data, isLoading, isError, refetch } = useAnnouncements({
    pageSize: 50,
    sortBy: "created_at",
    sortOrder: "desc",
  });

  return (
    <PageContainer width="lg">
      <PageHeader
        title="Pengumuman"
        description="Update dan berita dari organisasi Anda."
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-bg-elevated"
            />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Gagal memuat pengumuman." onRetry={() => refetch()} />
      ) : !data?.data?.length ? (
        <EmptyState>Belum ada pengumuman.</EmptyState>
      ) : (
        <div className="space-y-4">
          {data.data.map((a) => {
            const attachments = a.attachments || [];
            return (
              <article
                key={a.id}
                className="overflow-hidden rounded-xl border border-border bg-bg-elevated p-5 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <Megaphone className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold leading-snug text-foreground">
                        {a.title}
                      </h2>
                      <TargetTypeBadge targetType={a.target_type || "all"} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>
                        {a.target_type === "division"
                          ? a.target_division?.name || "Divisi"
                          : "Semua divisi"}
                      </span>
                      <span aria-hidden>·</span>
                      <span>{formatDate(a.publish_date || a.created_at)}</span>
                    </div>
                    <div className="mt-3 border-t border-border/60 pt-3">
                      <RichContent html={a.content} compact />
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {attachments.map((att) =>
                          isImageUrl(att.file_url) ||
                          att.file_type === "image" ||
                          att.file_type?.startsWith("image") ? (
                            <a
                              key={att.id}
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={att.file_url}
                                alt="Lampiran"
                                className="h-16 w-16 rounded-md border border-border object-cover"
                              />
                            </a>
                          ) : (
                            <a
                              key={att.id}
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-accent hover:bg-bg-hover"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              Lampiran
                            </a>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
