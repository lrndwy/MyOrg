"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomAnswersDetailPanel } from "@/components/recruitment/custom-answers-detail";
import { SubmissionStatusBadge } from "@/components/recruitment/submissions-list";
import { apiClient } from "@/lib/api-client";
import { formatDate, formatRelative } from "@/lib/formatters";
import { Pencil, Trash2, X } from "@/lib/icons";
import type { RecruitmentCustomField, RecruitmentSubmission } from "@repo/shared/types";

interface SubmissionDetailsModalProps {
  submission: RecruitmentSubmission | Record<string, unknown>;
  fields?: RecruitmentCustomField[];
  onClose: () => void;
  onEdit?: (submission: RecruitmentSubmission) => void;
  onDelete?: (submission: RecruitmentSubmission) => void;
}

function asSubmission(item: RecruitmentSubmission | Record<string, unknown>): RecruitmentSubmission {
  return item as RecruitmentSubmission;
}

function recruitmentLabel(s: RecruitmentSubmission): string {
  return (s.recruitment as { title?: string } | null | undefined)?.title?.trim() || "—";
}

function divisionLabel(s: RecruitmentSubmission): string {
  return (s.division_interest as { name?: string } | null | undefined)?.name ?? "—";
}

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

export function SubmissionDetailsModal({
  submission: rawSubmission,
  fields: fieldsProp,
  onClose,
  onEdit,
  onDelete,
}: SubmissionDetailsModalProps) {
  const submission = asSubmission(rawSubmission);
  const recruitmentId =
    submission.recruitment_id ??
    (submission.recruitment as { id?: string } | null | undefined)?.id;

  const { data: fetchedFields } = useQuery<RecruitmentCustomField[]>({
    queryKey: ["/api/recruitment_custom_fields", "details", recruitmentId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/api/recruitment_custom_fields?recruitment_id=${recruitmentId}&page_size=100&sort_by=order_index&sort_order=asc`,
      );
      return (data.data ?? []) as RecruitmentCustomField[];
    },
    enabled: !!recruitmentId && !fieldsProp?.length,
  });

  const fields = useMemo(() => {
    const source = fieldsProp?.length ? fieldsProp : (fetchedFields ?? []);
    if (!recruitmentId) return source;
    return source.filter((f) => f.recruitment_id === recruitmentId);
  }, [fieldsProp, fetchedFields, recruitmentId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Recruitment Submission Details
            </p>
            <h2 className="mt-1 truncate text-xl font-semibold text-foreground">{submission.name}</h2>
            <p className="mt-1 text-xs text-text-muted" title={formatDate(submission.created_at)}>
              Dikirim {formatRelative(submission.created_at)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SubmissionStatusBadge status={submission.status} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-bg-hover hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <DetailField label="Recruitment">{recruitmentLabel(submission)}</DetailField>
            <DetailField label="Division Interest">{divisionLabel(submission)}</DetailField>
            <DetailField label="Contact">
              <span className="break-all">{submission.contact || "—"}</span>
            </DetailField>
            <DetailField label="Submitted">
              <span title={formatDate(submission.created_at)}>
                {formatRelative(submission.created_at)}
              </span>
            </DetailField>
          </div>

          <div className="mt-6 border-t border-border pt-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Custom Answers</h3>
            <CustomAnswersDetailPanel answers={submission.custom_answers} fields={fields} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          {onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(submission);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-bg-hover"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(submission);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
