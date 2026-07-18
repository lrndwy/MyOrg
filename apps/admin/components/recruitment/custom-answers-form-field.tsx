"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CustomSelect } from "@/components/ui/custom-select";
import { apiClient } from "@/lib/api-client";
import {
  normalizeCustomAnswerInputValue,
  parseCustomAnswers,
  parseFieldOptions,
} from "@/lib/recruitment-custom-answers";
import { ExternalLink } from "@/lib/icons";
import type { RecruitmentCustomField } from "@repo/shared/types";

interface RecruitmentCustomAnswersFormFieldProps {
  recruitmentId: string | null | undefined;
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  error?: string;
}

const INPUT_CLASS =
  "block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function RecruitmentCustomAnswersFormField({
  recruitmentId,
  value,
  onChange,
  error,
}: RecruitmentCustomAnswersFormFieldProps) {
  const answers = useMemo(() => parseCustomAnswers(value), [value]);

  const { data: fields = [], isLoading } = useQuery<RecruitmentCustomField[]>({
    queryKey: ["/api/recruitment_custom_fields", "form", recruitmentId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/api/recruitment_custom_fields?recruitment_id=${recruitmentId}&page_size=100&sort_by=order_index&sort_order=asc`,
      );
      return (data.data ?? []) as RecruitmentCustomField[];
    },
    enabled: !!recruitmentId,
  });

  const updateAnswer = (label: string, next: string | number | boolean) => {
    onChange({ ...answers, [label]: next });
  };

  if (!recruitmentId) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg-tertiary/40 px-4 py-3 text-sm text-text-muted">
        Pilih recruitment terlebih dahulu untuk mengisi jawaban custom.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-bg-tertiary/40 px-4 py-3 text-sm text-text-muted">
        Memuat field custom…
      </div>
    );
  }

  if (!fields.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-bg-tertiary/40 px-4 py-3 text-sm text-text-muted">
        Recruitment ini tidak memiliki field custom.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Custom Answers</p>
        <p className="mt-0.5 text-xs text-text-muted">
          Jawaban dari form publik, ditampilkan per label field recruitment.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-bg-tertiary/30 p-4">
        {fields.map((field) => (
          <CustomFieldEditor
            key={field.id}
            field={field}
            value={normalizeCustomAnswerInputValue(answers[field.field_label])}
            onChange={(next) => updateAnswer(field.field_label, next)}
          />
        ))}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function CustomFieldEditor({
  field,
  value,
  onChange,
}: {
  field: RecruitmentCustomField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const selectOptions = useMemo(
    () =>
      parseFieldOptions(field.field_options).map((opt) => ({
        value: opt,
        label: opt,
      })),
    [field.field_options],
  );

  const label = (
    <label className="block text-sm font-medium text-foreground">
      {field.field_label}
      {field.is_required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  );

  switch (field.field_type) {
    case "textarea":
      return (
        <div className="space-y-1.5">
          {label}
          <textarea
            rows={3}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      );
    case "select":
    case "dropdown":
      return (
        <div className="space-y-1.5">
          {label}
          <CustomSelect
            value={String(value)}
            onChange={onChange}
            options={selectOptions}
            placeholder="Pilih opsi…"
            emptyLabel="Belum ada opsi"
          />
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          {field.field_label}
          {field.is_required && <span className="text-danger">*</span>}
        </label>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="number"
            value={value === "" ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={INPUT_CLASS}
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="date"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      );
    case "file": {
      const url = String(value).trim();
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="url"
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="URL file hasil upload"
            className={INPUT_CLASS}
          />
          {url && /^https?:\/\//i.test(url) && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              Lihat file
            </a>
          )}
        </div>
      );
    }
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="text"
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      );
  }
}
