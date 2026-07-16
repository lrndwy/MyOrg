"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/chrome/PageHeader";
import { useToastedMutation } from "@/hooks/use-toasted-mutation";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatRelative } from "@/lib/formatters";
import { Loader2, Check, X, ExternalLink, Lock, AlertCircle } from "@/lib/icons";
import type { PermissionRequest } from "@repo/shared/types";

const PERMISSION_REQUESTS_KEY = ["myorg", "permission-requests"];

type StatusTab = "pending" | "approved" | "rejected" | "all";

const TABS: { key: StatusTab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function userLabel(u?: PermissionRequest["user"]): string {
  if (!u) return "Unknown user";
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return u.full_name || full || u.email || "Unknown user";
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    approved: "bg-success/15 text-success",
    rejected: "bg-danger/15 text-danger",
  };
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize " + (styles[status] ?? "bg-text-muted/15 text-text-muted")}>
      {status}
    </span>
  );
}

function ReviewModal({
  open,
  action,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  action: "approve" | "reject" | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
  loading: boolean;
}) {
  const [note, setNote] = useState("");

  if (!open || !action) return null;

  const isReject = action === "reject";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-bg-secondary p-6 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full " + (isReject ? "bg-danger/10" : "bg-success/10")}>
            {isReject ? <X className="h-5 w-5 text-danger" /> : <Check className="h-5 w-5 text-success" />}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {isReject ? "Reject permission request" : "Approve permission request"}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {isReject
                ? "The requester will see this as rejected. Add a note explaining why (optional)."
                : "The requester's attendance will be marked as permitted for this event."}
            </p>
          </div>
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={isReject ? "Reason for rejection (optional)" : "Note (optional)"}
          className="mt-4 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted outline-none focus:border-accent"
        />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(note)}
            disabled={loading}
            className={
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 " +
              (isReject ? "bg-danger hover:bg-danger/90" : "bg-accent hover:bg-accent-hover")
            }
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isReject ? "Reject" : "Approve"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyOrgPermissionApprovalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<StatusTab>("pending");
  const [reviewing, setReviewing] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const { data, isLoading, isError } = useQuery<PermissionRequest[]>({
    queryKey: PERMISSION_REQUESTS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get(
        "/api/permission_requests?page_size=100&sort_by=created_at&sort_order=desc"
      );
      return (data.data ?? []) as PermissionRequest[];
    },
    refetchInterval: 30_000,
  });

  const requests = data ?? [];

  const filtered = useMemo(() => {
    if (tab === "all") return requests;
    return requests.filter((r) => r.status === tab);
  }, [requests, tab]);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { pending: 0, approved: 0, rejected: 0, all: requests.length };
    for (const r of requests) {
      if (r.status === "pending") c.pending++;
      else if (r.status === "approved") c.approved++;
      else if (r.status === "rejected") c.rejected++;
    }
    return c;
  }, [requests]);

  const review = useToastedMutation<
    PermissionRequest,
    unknown,
    { id: string; action: "approve" | "reject"; note: string }
  >({
    mutationFn: async ({ id, action, note }) => {
      const { data } = await apiClient.put(`/api/attendance/permission-requests/${id}`, { action, note });
      return data.data as PermissionRequest;
    },
    successMessage: (data) => (data.status === "approved" ? "Request approved" : "Request rejected"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PERMISSION_REQUESTS_KEY });
      setReviewing(null);
    },
  });

  return (
    <div>
      <PageHeader
        title="Permission Approvals"
        subtitle="Review and act on leave/permission requests submitted for events."
        refreshKeys={["myorg"]}
      />

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors " +
              (tab === t.key ? "bg-accent text-white" : "text-text-secondary hover:bg-bg-hover")
            }
          >
            {t.label}
            <span className="ml-1.5 text-xs opacity-75">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          Failed to load permission requests.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Lock className="h-8 w-8 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">No {tab !== "all" ? tab : ""} permission requests</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3">Proof</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reviewed</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 text-foreground">{r.event?.title ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{userLabel(r.user)}</td>
                    <td className="px-4 py-3 max-w-xs text-text-secondary">
                      <p className="line-clamp-2">{r.reason || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {r.proof_url ? (
                        <a
                          href={r.proof_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                      {r.status !== "pending" && r.review_note ? (
                        <p className="mt-1 max-w-[180px] truncate text-xs text-text-muted" title={r.review_note}>
                          {r.review_note}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {r.reviewed_by ? (
                        <>
                          <p>{userLabel(r.reviewed_by)}</p>
                          {r.reviewed_at && <p className="text-xs text-text-muted">{formatDate(r.reviewed_at)}</p>}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary" title={formatDate(r.created_at)}>
                      {formatRelative(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setReviewing({ id: r.id, action: "approve" })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20"
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => setReviewing({ id: r.id, action: "reject" })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20"
                          >
                            <X className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <ReviewModal
        open={!!reviewing}
        action={reviewing?.action ?? null}
        loading={review.isPending}
        onCancel={() => setReviewing(null)}
        onConfirm={(note) => {
          if (!reviewing) return;
          review.mutate({ id: reviewing.id, action: reviewing.action, note });
        }}
      />
    </div>
  );
}
