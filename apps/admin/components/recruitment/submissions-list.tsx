"use client";

import { CustomAnswersCell } from "@/components/recruitment/custom-answers-cell";
import { formatDate, formatRelative } from "@/lib/formatters";
import { Eye, Pencil, Trash2 } from "@/lib/icons";
import type { RecruitmentCustomField, RecruitmentSubmission } from "@repo/shared/types";

export function SubmissionStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    submitted: "bg-info/15 text-info",
    interview: "bg-warning/15 text-warning",
    accepted: "bg-success/15 text-success",
    approved: "bg-success/15 text-success",
    rejected: "bg-danger/15 text-danger",
  };
  return (
    <span
      className={
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize " +
        (styles[status] ?? "bg-text-muted/15 text-text-muted")
      }
    >
      {status}
    </span>
  );
}

function divisionLabel(s: RecruitmentSubmission): string {
  return (s.division_interest as { name?: string } | null | undefined)?.name ?? "—";
}

function recruitmentLabel(s: RecruitmentSubmission): string {
  return (s.recruitment as { title?: string } | null | undefined)?.title?.trim() || "—";
}

interface SubmissionsListProps {
  rows: RecruitmentSubmission[];
  fields?: RecruitmentCustomField[];
  showRecruitment?: boolean;
  onView?: (submission: RecruitmentSubmission) => void;
  onEdit?: (submission: RecruitmentSubmission) => void;
  onDelete?: (submission: RecruitmentSubmission) => void;
}

export function SubmissionsTable({ rows, fields = [], showRecruitment = false }: SubmissionsListProps) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
          {showRecruitment && <th className="px-4 py-3">Recruitment</th>}
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Division Interest</th>
          <th className="px-4 py-3">Contact</th>
          <th className="min-w-[220px] px-4 py-3">Custom Answers</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3">Submitted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id} className="border-b border-border last:border-0 align-top">
            {showRecruitment && (
              <td className="px-4 py-3 text-text-secondary">{recruitmentLabel(s)}</td>
            )}
            <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
            <td className="px-4 py-3 text-text-secondary">{divisionLabel(s)}</td>
            <td className="px-4 py-3 text-text-secondary">{s.contact}</td>
            <td className="px-4 py-3 max-w-md text-text-secondary">
              <CustomAnswersCell answers={s.custom_answers} fields={fields} variant="compact" />
            </td>
            <td className="px-4 py-3">
              <SubmissionStatusBadge status={s.status} />
            </td>
            <td className="px-4 py-3 text-text-secondary" title={formatDate(s.created_at)}>
              {formatRelative(s.created_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SubmissionsCards({
  rows,
  fields = [],
  showRecruitment = false,
  onView,
  onEdit,
  onDelete,
}: SubmissionsListProps) {
  const hasActions = Boolean(onView || onEdit || onDelete);

  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((s) => (
        <article
          key={s.id}
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-bg-primary shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="border-b border-border bg-bg-secondary/50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-semibold text-foreground">{s.name}</h3>
                {showRecruitment && (
                  <p className="mt-0.5 truncate text-xs font-medium text-accent/90">
                    {recruitmentLabel(s)}
                  </p>
                )}
              </div>
              <SubmissionStatusBadge status={s.status} />
            </div>
            <p className="mt-2 text-xs text-text-muted" title={formatDate(s.created_at)}>
              Dikirim {formatRelative(s.created_at)}
            </p>
          </div>

          <div className="flex flex-1 flex-col px-4 py-3">
            <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-bg-secondary/60 px-3 py-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Divisi
                </dt>
                <dd className="mt-1 font-medium text-foreground">{divisionLabel(s)}</dd>
              </div>
              <div className="rounded-lg bg-bg-secondary/60 px-3 py-2 sm:col-span-1">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  Kontak
                </dt>
                <dd className="mt-1 break-all font-medium text-foreground">{s.contact}</dd>
              </div>
            </dl>

            <div className="mt-3 flex-1 rounded-lg border border-border/70 bg-bg-secondary/30 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                Jawaban Custom
              </p>
              <div className="max-h-40 overflow-y-auto pr-1">
                <CustomAnswersCell answers={s.custom_answers} fields={fields} variant="expanded" />
              </div>
            </div>
          </div>

          {hasActions && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-bg-secondary/30 px-4 py-3">
              {onView && (
                <button
                  type="button"
                  onClick={() => onView(s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-bg-hover"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Details
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-bg-hover"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(s)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
