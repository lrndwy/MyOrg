"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PermissionGate } from "@/components/auth/permission-gate";
import { SubmissionsTable } from "@/components/recruitment/submissions-list";
import { SubmissionCardsView } from "@/components/recruitment/submission-cards-view";
import { IconButton } from "@/components/ui/IconButton";
import { ViewToggle, type TableCardsViewMode } from "@/components/ui/view-toggle";
import { apiClient } from "@/lib/api-client";
import { ArrowLeft, Loader2, Database, AlertCircle } from "@/lib/icons";
import type { Recruitment, RecruitmentCustomField, RecruitmentSubmission } from "@repo/shared/types";

type StatusTab = "all" | "pending" | "accepted" | "rejected";

export default function RecruitmentSubmissionsPage() {
  return (
    <PermissionGate permission="recruitment.manage">
      <RecruitmentSubmissionsPageContent />
    </PermissionGate>
  );
}

function RecruitmentSubmissionsPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<TableCardsViewMode>("table");

  const { data: recruitment } = useQuery<Recruitment>({
    queryKey: ["myorg", "recruitment", params.id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/recruitments/${params.id}`);
      return data.data as Recruitment;
    },
    enabled: !!params.id,
  });

  const { data: customFields } = useQuery<RecruitmentCustomField[]>({
    queryKey: ["myorg", "recruitment-custom-fields", params.id],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/api/recruitment_custom_fields?recruitment_id=${params.id}&page_size=100&sort_by=order_index&sort_order=asc`,
      );
      return (data.data ?? []) as RecruitmentCustomField[];
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
  const fields = customFields ?? [];

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: rows.length, pending: 0, accepted: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status === "pending" || r.status === "submitted" || r.status === "interview") c.pending++;
      else if (r.status === "accepted" || r.status === "approved") c.accepted++;
      else if (r.status === "rejected") c.rejected++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;
    if (tab !== "all") {
      list = list.filter((r) => {
        if (tab === "accepted") return r.status === "accepted" || r.status === "approved";
        if (tab === "pending") {
          return r.status === "pending" || r.status === "submitted" || r.status === "interview";
        }
        return r.status === tab;
      });
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-secondary p-1 w-fit">
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

        <ViewToggle view={view} onChange={setView} />
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
          ) : view === "table" ? (
            <SubmissionsTable rows={filtered} fields={fields} />
          ) : (
            <SubmissionCardsView
              rows={filtered}
              fields={fields}
              invalidateKeys={[["myorg", "recruitment-submissions", params.id]]}
            />
          )}
        </div>
      )}
    </div>
  );
}
