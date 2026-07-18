"use client";

import { useForm, Controller, useWatch } from "react-hook-form";
import type { FieldDefinition, FormDefinition } from "@/lib/resource";
import { TextField } from "./fields/text-field";
import { TextareaField } from "./fields/textarea-field";
import { NumberField } from "./fields/number-field";
import { SelectField } from "./fields/select-field";
import { DateField } from "./fields/date-field";
import { ToggleField } from "./fields/toggle-field";
import { CheckboxField } from "./fields/checkbox-field";
import { RadioField } from "./fields/radio-field";
import { ImageField } from "./fields/image-field";
import { ImagesField } from "./fields/images-field";
import { VideoField } from "./fields/video-field";
import { VideosField } from "./fields/videos-field";
import { FileField } from "./fields/file-field";
import { FilesField } from "./fields/files-field";
import { RichTextField } from "./fields/rich-text-field";
import { RelationshipSelectField } from "./fields/relationship-select-field";
import { MultiRelationshipSelectField } from "./fields/multi-relationship-select-field";
import { RecruitmentCustomAnswersFormField } from "@/components/recruitment/custom-answers-form-field";
import { parseCustomAnswers } from "@/lib/recruitment-custom-answers";
import { Loader2 } from "@/lib/icons";

interface FormBuilderProps {
  form: FormDefinition;
  defaultValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function FormBuilder({
  form: formDef,
  defaultValues = {},
  onSubmit,
  onCancel,
  isSubmitting,
  submitLabel = "Save",
}: FormBuilderProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: buildDefaults(formDef.fields, defaultValues),
  });

  const isTwoColumn = formDef.layout === "two-column";

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(serializeFormPayload(formDef.fields, data)))} className="space-y-6">
      <div
        className={`grid gap-4 ${isTwoColumn ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
      >
        {formDef.fields.map((field) => (
          <div
            key={field.key}
            className={field.colSpan === 2 && isTwoColumn ? "sm:col-span-2" : ""}
          >
            <FieldRenderer
              field={field}
              control={control}
              errors={errors}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50 transition-colors"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export function FieldRenderer({
  field,
  control,
  errors,
}: {
  field: FieldDefinition;
  control: ReturnType<typeof useForm>["control"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: Record<string, any>;
}) {
  const error = errors[field.key]?.message as string | undefined;

  switch (field.type) {
    case "text":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <TextField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "textarea":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <TextareaField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "number":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <NumberField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "select":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <SelectField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "date":
    case "datetime":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <DateField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "toggle":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: formField }) => (
            <ToggleField field={field} value={Boolean(formField.value)} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "checkbox":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: formField }) => (
            <CheckboxField field={field} value={Boolean(formField.value)} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "radio":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <RadioField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "image":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <ImageField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "images":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <ImagesField field={field} value={formField.value ?? []} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "video":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <VideoField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "videos":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <VideosField field={field} value={formField.value ?? []} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "file":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            // buildDefaults seeds file types to null. Coerce here as a
            // belt-and-suspenders in case a stale form passes a string.
            <FileField field={field} value={(formField.value as never) ?? null} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "files":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            // Same array guard as buildDefaults: a non-array value
            // crashes FilesField's refsToUploaded with TypeError on .map.
            <FilesField field={field} value={Array.isArray(formField.value) ? formField.value : []} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "relationship-select":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <RelationshipSelectField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "multi-relationship-select":
      return (
        <Controller
          name={field.key}
          control={control}
          render={({ field: formField }) => (
            <MultiRelationshipSelectField field={field} value={formField.value ?? []} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "richtext":
      return (
        <Controller
          name={field.key}
          control={control}
          rules={field.required ? { required: `${field.label} is required` } : undefined}
          render={({ field: formField }) => (
            <RichTextField field={field} value={formField.value ?? ""} onChange={formField.onChange} error={error} />
          )}
        />
      );
    case "recruitment-custom-answers":
      return (
        <RecruitmentCustomAnswersFieldController control={control} errors={errors} />
      );
    default:
      return null;
  }
}

function RecruitmentCustomAnswersFieldController({
  control,
  errors,
}: {
  control: ReturnType<typeof useForm>["control"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: Record<string, any>;
}) {
  const recruitmentId = useWatch({ control, name: "recruitment_id" });
  const error = errors.custom_answers?.message as string | undefined;

  return (
    <Controller
      name="custom_answers"
      control={control}
      render={({ field: formField }) => (
        <RecruitmentCustomAnswersFormField
          recruitmentId={recruitmentId}
          value={formField.value}
          onChange={formField.onChange}
          error={error}
        />
      )}
    />
  );
}

// Field types whose value is an array. Defaulting to "" breaks the
// field component: FilesField/ImagesField/VideosField call .map() on
// the value and TypeError out, crashing the form sheet into the
// global error boundary. The fix is to default array-shaped types to
// [] and single-object types to null.
const ARRAY_FIELD_TYPES = new Set([
  "files",
  "images",
  "videos",
  "multi-relationship-select",
]);

const NULLABLE_OBJECT_FIELD_TYPES = new Set([
  "file",
  "image",
  "video",
]);

/** Map API attachment rows (file_url/file_type) or FileRef into FileRef for FilesField. */
function normalizeAttachmentToFileRef(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return { url: "", key: "", name: "file", mime: "application/octet-stream", size: 0 };
  }
  const v = value as Record<string, unknown>;
  if (typeof v.url === "string" && v.url) {
    return {
      url: v.url,
      key: typeof v.key === "string" ? v.key : "",
      name: typeof v.name === "string" ? v.name : "file",
      mime: typeof v.mime === "string" ? v.mime : "application/octet-stream",
      size: typeof v.size === "number" ? v.size : 0,
      thumbnail_url: typeof v.thumbnail_url === "string" ? v.thumbnail_url : undefined,
    };
  }
  const url = typeof v.file_url === "string" ? v.file_url : "";
  const fileType = typeof v.file_type === "string" ? v.file_type : "";
  const mime =
    fileType === "image"
      ? "image/jpeg"
      : fileType.includes("/")
        ? fileType
        : "application/octet-stream";
  let name = "file";
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop();
    if (base) name = decodeURIComponent(base);
  } catch {
    /* keep default */
  }
  return {
    url,
    key: typeof v.file_key === "string" ? v.file_key : "",
    name,
    mime,
    size: 0,
  };
}

export function buildDefaults(
  fields: FieldDefinition[],
  existing: Record<string, unknown>
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const field of fields) {
    // multi-relationship-select: extract IDs from the nested array of objects
    if (field.type === "multi-relationship-select" && field.relationshipKey) {
      const related = existing[field.relationshipKey];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      defaults[field.key] = Array.isArray(related) ? related.map((r: any) => r.id) : [];
      continue;
    }
    if (field.key in existing) {
      let value = existing[field.key];
      // Attachment rows from the API use file_url/file_type; FilesField
      // expects FileRef { url, mime, name, … }. Normalize so edit forms
      // rehydrate the dropzone correctly.
      if (field.type === "files" && Array.isArray(value)) {
        value = value.map(normalizeAttachmentToFileRef);
      }
      // Textarea fields sometimes back JSON array columns (e.g. field_options).
      if (field.type === "textarea" && Array.isArray(value)) {
        value = value.map((v) => String(v)).join("\n");
      }
      if (field.type === "textarea" && value && typeof value === "object") {
        value = JSON.stringify(value, null, 2);
      }
      if (field.type === "recruitment-custom-answers") {
        value = parseCustomAnswers(value);
      }
      defaults[field.key] = value;
    } else if (field.defaultValue !== undefined) {
      defaults[field.key] = field.defaultValue;
    } else if (field.type === "recruitment-custom-answers") {
      defaults[field.key] = {};
    } else if (field.type === "toggle" || field.type === "checkbox") {
      defaults[field.key] = false;
    } else if (ARRAY_FIELD_TYPES.has(field.type)) {
      defaults[field.key] = [];
    } else if (NULLABLE_OBJECT_FIELD_TYPES.has(field.type)) {
      defaults[field.key] = null;
    } else {
      defaults[field.key] = "";
    }
  }
  return defaults;
}

function serializeFormPayload(
  fields: FieldDefinition[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const payload = { ...data };
  for (const field of fields) {
    const value = payload[field.key];
    if (field.type === "recruitment-custom-answers" && value != null) {
      payload[field.key] =
        typeof value === "string" ? value : JSON.stringify(value);
    }
  }
  return payload;
}
