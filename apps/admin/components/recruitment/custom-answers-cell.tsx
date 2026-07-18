"use client";

import { ExternalLink } from "@/lib/icons";
import {
  buildCustomAnswerRows,
  formatCustomAnswerValue,
  normalizeCustomAnswerInputValue,
  parseCustomAnswers,
} from "@/lib/recruitment-custom-answers";
import type { RecruitmentCustomField } from "@repo/shared/types";

interface CustomAnswersCellProps {
  answers: unknown;
  fields?: RecruitmentCustomField[];
  /** compact = single line clamp; expanded = stacked list */
  variant?: "compact" | "expanded";
  className?: string;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function AnswerValue({ value, fieldType }: { value: unknown; fieldType?: string }) {
  if (value == null || value === "") {
    return <span className="text-text-muted">—</span>;
  }

  const scalar = normalizeCustomAnswerInputValue(value);
  const text = formatCustomAnswerValue(value, fieldType);
  const raw = typeof scalar === "string" ? scalar.trim() : String(scalar).trim();

  if ((fieldType === "file" || isHttpUrl(raw)) && isHttpUrl(raw)) {
    return (
      <a
        href={raw}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-accent hover:underline break-all"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        {text}
      </a>
    );
  }

  return <span className="break-words">{text}</span>;
}

export function CustomAnswersCell({
  answers,
  fields,
  variant = "compact",
  className = "",
}: CustomAnswersCellProps) {
  const rows = buildCustomAnswerRows(answers, fields);
  const parsed = parseCustomAnswers(answers);

  if (!rows.length) {
    return <span className="text-text-muted">—</span>;
  }

  if (variant === "compact") {
    return (
      <div className={`space-y-1 ${className}`}>
        {rows.map((row) => (
          <div key={row.label} className="text-xs leading-snug">
            <span className="font-medium text-foreground">{row.label}: </span>
            <AnswerValue value={row.value} fieldType={row.fieldType} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <dl className={`space-y-2 ${className}`}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {row.label}
          </dt>
          <dd className="mt-0.5 text-sm text-foreground">
            <AnswerValue value={row.value} fieldType={row.fieldType} />
          </dd>
        </div>
      ))}
      {Object.keys(parsed).length === 0 && (
        <span className="text-text-muted">—</span>
      )}
    </dl>
  );
}
