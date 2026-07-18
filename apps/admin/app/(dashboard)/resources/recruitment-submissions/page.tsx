"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PermissionGate } from "@/components/auth/permission-gate";
import { ResourcePage } from "@/components/resource/resource-page";
import { SubmissionCardsView } from "@/components/recruitment/submission-cards-view";
import { PageHeader } from "@/components/layout/page-header";
import { ViewToggle, type TableCardsViewMode } from "@/components/ui/view-toggle";
import { apiClient } from "@/lib/api-client";
import { recruitmentSubmissionResource } from "@/resources/recruitment-submissions";
import { AlertCircle, Database, Loader2 } from "@/lib/icons";
import type { RecruitmentCustomField, RecruitmentSubmission } from "@repo/shared/types";

export default function RecruitmentSubmissionsPage() {
  const [view, setView] = useState<TableCardsViewMode>("table");
  const [search, setSearch] = useState("");

  const {
    data: submissions,
    isLoading,
    isError,
  } = useQuery<RecruitmentSubmission[]>({
    queryKey: ["recruitment-submissions", "cards-view"],
    queryFn: async () => {
      const { data } = await apiClient.get(
        "/api/recruitment_submissions?page_size=200&sort_by=created_at&sort_order=desc",
      );
      return (data.data ?? []) as RecruitmentSubmission[];
    },
    enabled: view === "cards",
  });

  const { data: customFields } = useQuery<RecruitmentCustomField[]>({
    queryKey: ["recruitment-custom-fields", "all"],
    queryFn: async () => {
      const { data } = await apiClient.get(
        "/api/recruitment_custom_fields?page_size=500&sort_by=order_index&sort_order=asc",
      );
      return (data.data ?? []) as RecruitmentCustomField[];
    },
    enabled: view === "cards",
  });

  const filtered = useMemo(() => {
    const rows = submissions ?? [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.contact.toLowerCase().includes(q),
    );
  }, [submissions, search]);

  return (
    <PermissionGate permission="recruitment.manage">
      {view === "table" ? (
        <ResourcePage
          resource={recruitmentSubmissionResource}
          toolbarExtra={<ViewToggle view={view} onChange={setView} />}
        />
      ) : (
        <div>
          <PageHeader
            title="Recruitment Submissions"
            description="Manage recruitment submissions"
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or contact..."
              className="w-full max-w-sm rounded-lg border border-border bg-bg-elevated py-2 px-3 text-sm text-foreground placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <ViewToggle view={view} onChange={setView} />
          </div>

          {isError ? (
            <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Failed to load submissions.
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
                <SubmissionCardsView
                  rows={filtered}
                  fields={customFields ?? []}
                  showRecruitment
                  invalidateKeys={[["recruitment-submissions", "cards-view"]]}
                />
              )}
            </div>
          )}
        </div>
      )}
    </PermissionGate>
  );
}
