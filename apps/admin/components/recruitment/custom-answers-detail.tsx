"use client";

import { ExternalLink } from "@/lib/icons";
import {
  buildCustomAnswerRows,
  formatCustomAnswerValue,
  normalizeCustomAnswerInputValue,
} from "@/lib/recruitment-custom-answers";
import type { RecruitmentCustomField } from "@repo/shared/types";

interface CustomAnswersDetailPanelProps {
  answers: unknown;
  fields?: RecruitmentCustomField[];
  className?: string;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function fieldTypeLabel(type?: string): string | null {
  if (!type) return null;
  const labels: Record<string, string> = {
    text: "Teks",
    textarea: "Paragraf",
    number: "Angka",
    date: "Tanggal",
    select: "Pilihan",
    dropdown: "Pilihan",
    checkbox: "Checkbox",
    file: "File",
  };
  return labels[type] ?? type;
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
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-sm text-accent transition-colors hover:bg-bg-hover"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <span className="break-all">{text}</span>
      </a>
    );
  }

  if (fieldType === "textarea") {
    return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>;
  }

  return <p className="break-words text-sm leading-relaxed">{text}</p>;
}

export function CustomAnswersDetailPanel({
  answers,
  fields,
  className = "",
}: CustomAnswersDetailPanelProps) {
  const rows = buildCustomAnswerRows(answers, fields);

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg-tertiary/40 px-4 py-6 text-center text-sm text-text-muted">
        Tidak ada jawaban custom.
      </div>
    );
  }

  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${className}`}>
      {rows.map((row) => {
        const typeLabel = fieldTypeLabel(row.fieldType);
        return (
          <div
            key={row.label}
            className="rounded-xl border border-border bg-bg-primary/80 p-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{row.label}</p>
              {typeLabel && (
                <span className="shrink-0 rounded-full bg-bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {typeLabel}
                </span>
              )}
            </div>
            <AnswerValue value={row.value} fieldType={row.fieldType} />
          </div>
        );
      })}
    </div>
  );
}
