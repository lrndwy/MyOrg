"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/chrome/PageHeader";
import { IconButton } from "@/components/ui/IconButton";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatRelative } from "@/lib/formatters";
import { ArrowLeft, Loader2, Database, AlertCircle } from "@/lib/icons";
import type { Recruitment, RecruitmentSubmission } from "@repo/shared/types";

type StatusTab = "all" | "pending" | "accepted" | "rejected";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    accepted: "bg-success/15 text-success",
    approved: "bg-success/15 text-success",
    rejected: "bg-danger/15 text-danger",
  };
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize " + (styles[status] ?? "bg-text-muted/15 text-text-muted")}>
      {status}
    </span>
  );
}

function formatCustomAnswers(raw: unknown): string {
  if (raw == null || raw === "") return "—";
  if (typeof raw === "object") {
    const entries = Object.entries(raw as Record<string, unknown>);
    if (!entries.length) return "—";
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  const s = String(raw);
  try {
    const parsed = JSON.parse(s) as Record<string, unknown>;
    const entries = Object.entries(parsed);
    if (!entries.length) return "—";
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  } catch {
    return s;
  }
}

export default function RecruitmentSubmissionsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");

  const { data: recruitment } = useQuery<Recruitment>({
    queryKey: ["myorg", "recruitment", params.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/recruitments/${params.id}`);
      return data.data as Recruitment;
    },
    enabled: !!params.id,
  });

  const {
    data: submissions,
    isLoading,
    isError,
  } = useQuery<RecruitmentSubmission[]>({
    queryKey: ["myorg", "recruitment-submissions", params.id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/api/recruitment_submissions?recruitment_id=${params.id}&page_size=200&sort_by=created_at&sort_order=desc`
      );
      return (data.data ?? []) as RecruitmentSubmission[];
    },
    enabled: !!params.id,
  });

  const rows = submissions ?? [];

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: rows.length, pending: 0, accepted: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === "pending") c.pending++;
      else if (r.status === "accepted" || r.status === "approved") c.accepted++;
      else if (r.status === "rejected") c.rejected++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== "all") {
      list = list.filter((r) => (tab === "accepted" ? r.status === "accepted" || r.status === "approved" : r.status === tab));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.contact.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, tab, search]);

  return (
    <div>
      <PageHeader
        title={recruitment?.title ? `Submissions — ${recruitment.title}` : "Recruitment Submissions"}
        subtitle={
          recruitment
            ? `${rows.length} submission(s) · status: ${recruitment.status}`
            : undefined
        }
        searchPlaceholder="Search by name or contact..."
        searchValue={search}
        onSearchChange={setSearch}
        actions={
          <IconButton
            variant="secondary"
            icon={<ArrowLeft className="h-4 w-4" />}
            label="Back to Recruitments"
            onClick={() => router.push("/resources/recruitments")}
          />
        }
      />

      <div className="mb-4 flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1 w-fit">
        {([
          { key: "all", label: "All" },
          { key: "pending", label: "Pending" },
          { key: "accepted", label: "Accepted" },
          { key: "rejected", label: "Rejected" },
        ] as { key: StatusTab; label: string }[]).map((t) => (
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
          Failed to load submissions for this recruitment.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-bg-secondary overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
            </div>
          ) : !filtered.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Database className="h-8 w-8 text-text-muted" />
              <p className="mt-3 text-sm text-text-secondary">No submissions found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Division Interest</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Answers</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.division_interest?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-text-secondary">{s.contact}</td>
                    <td className="px-4 py-3 max-w-xs text-text-secondary">
                      <p className="line-clamp-2" title={formatCustomAnswers(s.custom_answers)}>
                        {formatCustomAnswers(s.custom_answers)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-text-secondary" title={formatDate(s.created_at)}>
                      {formatRelative(s.created_at)}
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
