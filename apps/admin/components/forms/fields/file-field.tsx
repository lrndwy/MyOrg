"use client";

// FileField. By default value is a FileRef. When field.storeAs === "url",
// value is a plain URL string (same pattern as ImageField / VideoField) —
// used for columns like letterhead_template_url.

import type { FieldDefinition } from "@/lib/resource";
import type { FileRef } from "@repo/shared/schemas";
import { Dropzone, type UploadedFile } from "@/components/ui/dropzone";
import { acceptsToReactDropzoneFormat, buildUploadEndpoint } from "@/lib/file-accepts";

interface FileFieldProps {
  field: FieldDefinition;
  value: FileRef | string | null;
  onChange: (value: FileRef | string | null) => void;
  error?: string;
}

function extractKeyFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}

function toUploaded(value: FileRef | string | null): UploadedFile[] {
  if (!value) return [];
  if (typeof value === "string") {
    const name = value.split("/").pop()?.split("?")[0] || "Current file";
    return [{ url: value, name: decodeURIComponent(name), size: 0, type: "" }];
  }
  return [
    {
      url: value.url,
      key: value.key,
      name: value.name,
      size: value.size,
      type: value.mime,
      thumbnail_url: value.thumbnail_url,
    },
  ];
}

export function FileField({ field, value, onChange, error }: FileFieldProps) {
  const maxBytes = (field.maxSizeMB ?? 5) * 1024 * 1024;
  const storeAsUrl = field.storeAs === "url";

  return (
    <Dropzone
      variant={field.dropzone ?? "default"}
      progress={field.progress ?? "bar"}
      maxFiles={1}
      maxSize={maxBytes}
      accept={acceptsToReactDropzoneFormat(field.accepts ?? ["all"])}
      uploadEndpoint={buildUploadEndpoint(field.accepts, maxBytes)}
      value={toUploaded(value)}
      onFilesChange={(files) => {
        if (!files[0]) {
          onChange(storeAsUrl ? "" : null);
          return;
        }
        if (storeAsUrl) {
          onChange(files[0].url || "");
          return;
        }
        onChange({
          url: files[0].url,
          key: files[0].key || extractKeyFromUrl(files[0].url),
          name: files[0].name,
          mime: files[0].type,
          size: files[0].size,
          thumbnail_url: files[0].thumbnail_url,
        });
      }}
      label={field.label}
      description={field.description}
      error={error}
    />
  );
}
