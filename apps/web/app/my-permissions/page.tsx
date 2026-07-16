"use client";

import Link from "next/link";
import { RequireAuth } from "@/components/require-auth";
import { EmptyState, ErrorState, PermissionStatusBadge } from "@/components/display";
import { PageContainer, PageHeader } from "@/components/page-shell";
import { formatDate, isImageUrl } from "@/lib/datetime";
import { useMyPermissionRequests } from "@/hooks/use-permission-requests";

export default function MyPermissionsPage() {
  return <RequireAuth>{() => <MyPermissionsList />}</RequireAuth>;
}

function MyPermissionsList() {
  const { data: requests, isLoading, isError, refetch } = useMyPermissionRequests();

  return (
    <PageContainer width="lg">
      <PageHeader
        title="Izin Saya"
        description="Lacak status pengajuan izin yang sudah Anda kirim."
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
        <ErrorState message="Gagal memuat pengajuan izin." onRetry={() => refetch()} />
      ) : !requests?.length ? (
        <EmptyState>Belum ada pengajuan izin.</EmptyState>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className="rounded-xl border border-border bg-bg-elevated p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {req.event?.title || "Event"}
                  </p>
                  <p className="mt-1 text-sm text-text-secondary">{req.reason}</p>
                </div>
                <PermissionStatusBadge status={req.status} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <span>Diajukan {formatDate(req.created_at)}</span>
                {req.reviewed_at && <span>Direview {formatDate(req.reviewed_at)}</span>}
                {req.event_id && (
                  <Link
                    href={`/events/${req.event_id}`}
                    className="text-accent hover:text-accent-hover"
                  >
                    Lihat event
                  </Link>
                )}
              </div>
              {req.proof_url && (
                <div className="mt-3">
                  {isImageUrl(req.proof_url) ? (
                    <a href={req.proof_url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={req.proof_url}
                        alt="Bukti izin"
                        className="h-20 w-20 rounded-md border border-border object-cover"
                      />
                    </a>
                  ) : (
                    <a
                      href={req.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:text-accent-hover"
                    >
                      Lihat bukti
                    </a>
                  )}
                </div>
              )}
              {req.review_note && (
                <p className="mt-2 text-xs italic text-text-muted">
                  Catatan: {req.review_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
