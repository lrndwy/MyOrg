"use client";

import { use, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, Upload } from "lucide-react";
import { apiErrorMessage } from "@repo/shared/types";
import type { RecruitmentCustomField } from "@repo/shared/types";
import { FormSelect, parseFieldOptions } from "@/components/form-select";
import {
  fileAcceptsFromFieldOptions,
  usePublicRecruitment,
  usePublicRecruitmentUpload,
  useSubmitPublicRecruitment,
} from "@/hooks/use-public-recruitment";

interface PageProps {
  params: Promise<{ slug: string }>;
}

const INPUT_CLASS =
  "block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20";

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

  const divisionOptions = useMemo(
    () =>
      (data?.targets ?? []).map((t) => ({
        value: t.division_id,
        label:
          (t.division as { name?: string } | null)?.name || t.division_id,
      })),
    [data?.targets],
  );

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

  const { recruitment, fields } = data;

  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto w-full max-w-lg rounded-xl border border-border bg-bg-secondary p-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{recruitment.title}</h1>
        {recruitment.description && (
          <p className="mt-2 whitespace-pre-line text-sm text-text-secondary">{recruitment.description}</p>
        )}

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <FormField label="Full name" required>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Your full name"
            />
          </FormField>

          <FormField label="Division of interest" required>
            <FormSelect
              value={divisionInterestId}
              onChange={setDivisionInterestId}
              options={divisionOptions}
              placeholder="Select a division…"
              required
              emptyLabel="No divisions available"
            />
          </FormField>

          <FormField label="Contact (phone/email)" required>
            <input
              type="text"
              required
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Phone number or email"
            />
          </FormField>

          {fields
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((field) => (
              <CustomFieldInput
                key={field.id}
                slug={slug}
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
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Submit application"}
          </button>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function CustomFieldInput({
  slug,
  field,
  value,
  onChange,
}: {
  slug: string;
  field: RecruitmentCustomField;
  value: string | number | boolean;
  onChange: (value: string | number | boolean) => void;
}) {
  const selectOptions = useMemo(() => {
    return parseFieldOptions(field.field_options).map((opt) => ({
      value: opt,
      label: opt,
    }));
  }, [field.field_options]);

  switch (field.field_type) {
    case "textarea":
      return (
        <FormField label={field.field_label} required={field.is_required}>
          <textarea
            required={field.is_required}
            rows={3}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
      );
    case "select":
    case "dropdown":
      return (
        <FormField label={field.field_label} required={field.is_required}>
          <FormSelect
            value={String(value)}
            onChange={onChange}
            options={selectOptions}
            placeholder="Select an option…"
            required={field.is_required}
            emptyLabel="No options configured"
          />
        </FormField>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent/20"
          />
          {field.field_label} {field.is_required && <span className="text-danger">*</span>}
        </label>
      );
    case "number":
      return (
        <FormField label={field.field_label} required={field.is_required}>
          <input
            type="number"
            required={field.is_required}
            value={value === "" ? "" : String(value)}
            onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
            className={INPUT_CLASS}
          />
        </FormField>
      );
    case "date":
      return (
        <FormField label={field.field_label} required={field.is_required}>
          <input
            type="date"
            required={field.is_required}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
      );
    case "file":
      return (
        <FileFieldInput
          slug={slug}
          field={field}
          value={String(value)}
          onChange={onChange}
        />
      );
    default:
      return (
        <FormField label={field.field_label} required={field.is_required}>
          <input
            type="text"
            required={field.is_required}
            value={String(value)}
            onChange={(e) => onChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
      );
  }
}

function FileFieldInput({
  slug,
  field,
  value,
  onChange,
}: {
  slug: string;
  field: RecruitmentCustomField;
  value: string;
  onChange: (value: string) => void;
}) {
  const { mutateAsync: uploadFile, isPending, error } = usePublicRecruitmentUpload(slug);
  const [fileName, setFileName] = useState("");
  const accepts = useMemo(
    () => fileAcceptsFromFieldOptions(field.field_options),
    [field.field_options],
  );
  const acceptAttr = useMemo(() => {
    const map: Record<string, string> = {
      image: "image/*",
      video: "video/*",
      pdf: "application/pdf",
      doc: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      excel: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      csv: ".csv,text/csv",
      zip: ".zip,application/zip",
    };
    return accepts
      .split(",")
      .map((k) => map[k.trim()] ?? "")
      .filter(Boolean)
      .join(",");
  }, [accepts]);

  return (
    <FormField label={field.field_label} required={field.is_required}>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-bg-elevated px-4 py-5 text-sm text-text-secondary transition-colors hover:border-accent hover:bg-bg-hover/40">
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        ) : (
          <Upload className="h-5 w-5 text-text-muted" />
        )}
        <span>{value ? "Replace file" : "Choose file to upload"}</span>
        <input
          type="file"
          className="hidden"
          accept={acceptAttr || undefined}
          disabled={isPending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const ref = await uploadFile({
                file,
                fieldId: field.id,
                accepts,
              });
              onChange(ref.url);
              setFileName(ref.name || file.name);
            } catch {
              /* error shown below */
            }
          }}
        />
      </label>
      {field.is_required && !value && (
        <input
          tabIndex={-1}
          aria-hidden
          value=""
          onChange={() => {}}
          required
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      )}
      {fileName && value && (
        <p className="text-xs text-text-muted">
          Selected: <span className="font-medium text-foreground">{fileName}</span>
        </p>
      )}
      {value && (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Preview uploaded file
        </a>
      )}
      {error && (
        <p className="text-xs text-danger">
          {apiErrorMessage(error, "File upload failed")}
        </p>
      )}
    </FormField>
  );
}
