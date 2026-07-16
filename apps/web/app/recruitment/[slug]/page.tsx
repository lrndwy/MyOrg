"use client";

import { use, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { apiErrorMessage } from "@repo/shared/types";
import type { RecruitmentCustomField } from "@repo/shared/types";
import {
  usePublicRecruitment,
  useSubmitPublicRecruitment,
} from "@/hooks/use-public-recruitment";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicRecruitmentPage({ params }: PageProps) {
  const { slug } = use(params);
  return <RecruitmentForm slug={slug} />;
}

function RecruitmentForm({ slug }: { slug: string }) {
  const { data, isLoading, isError } = usePublicRecruitment(slug);
  const { mutate: submit, isPending, error, isSuccess } = useSubmitPublicRecruitment(slug);

  const [name, setName] = useState("");
  const [divisionInterestId, setDivisionInterestId] = useState("");
  const [contact, setContact] = useState("");
  const [customAnswers, setCustomAnswers] = useState<Record<string, string | number | boolean>>({});

  const updateCustom = (field: RecruitmentCustomField, value: string | number | boolean) => {
    setCustomAnswers((prev) => ({ ...prev, [field.field_label]: value }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit({
      name,
      division_interest_id: divisionInterestId,
      contact,
      custom_answers: customAnswers,
    });
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-8 text-center">
          <h1 className="text-xl font-semibold text-foreground">Recruitment not found</h1>
          <p className="mt-2 text-sm text-text-secondary">
            This recruitment link doesn&apos;t exist or is no longer open.
          </p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-bg-secondary p-8 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Application received</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Thank you for applying to {data.recruitment.title}. We&apos;ll follow up via the contact you
            provided.
          </p>
        </div>
      </div>
    );
  }

  const { recruitment, fields, targets } = data;

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-bg-secondary p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{recruitment.title}</h1>
        {recruitment.description && (
          <p className="mt-2 text-sm text-text-secondary whitespace-pre-line">{recruitment.description}</p>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Full name <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Division of interest <span className="text-danger">*</span>
            </label>
            <select
              required
              value={divisionInterestId}
              onChange={(e) => setDivisionInterestId(e.target.value)}
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            >
              <option value="" disabled>
                Select a division…
              </option>
              {targets.map((t) => (
                <option key={t.id} value={t.division_id}>
                  {t.division?.name || t.division_id}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Contact (phone/email) <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {fields
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((field) => (
              <CustomFieldInput
                key={field.id}
                field={field}
                value={customAnswers[field.field_label] ?? ""}
                onChange={(v) => updateCustom(field, v)}
              />
            ))}

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {apiErrorMessage(error, "Submission failed")}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: RecruitmentCustomField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const label = (
    <label className="block text-sm font-medium text-foreground">
      {field.field_label} {field.is_required && <span className="text-danger">*</span>}
    </label>
  );
  const inputClass =
    "block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

  switch (field.field_type) {
    case "textarea":
      return (
        <div className="space-y-1.5">
          {label}
          <textarea
            required={field.is_required}
            rows={3}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    case "select":
    case "dropdown":
      return (
        <div className="space-y-1.5">
          {label}
          <select
            required={field.is_required}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select…
            </option>
            {(field.field_options || []).map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {field.field_label} {field.is_required && <span className="text-danger">*</span>}
        </label>
      );
    case "number":
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="number"
            required={field.is_required}
            value={value === "" ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={inputClass}
          />
        </div>
      );
    case "date":
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="date"
            required={field.is_required}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
    default:
      return (
        <div className="space-y-1.5">
          {label}
          <input
            type="text"
            required={field.is_required}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
        </div>
      );
  }
}
