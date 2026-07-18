"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { FieldDefinition } from "@/lib/resource";
import { CustomSelect } from "@/components/ui/custom-select";

interface RelationshipSelectFieldProps {
  field: FieldDefinition;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
}

function itemLabel(item: Record<string, unknown>, field: FieldDefinition): string {
  if (field.displayFields?.length) {
    const parts = field.displayFields
      .map((key) => String(item[key] ?? "").trim())
      .filter(Boolean);
    if (parts.length > 0) return parts.join(" — ");
  }

  const displayField = field.displayField || "name";
  return String(item[displayField] || item.name || item.title || item.id || "");
}

function itemValue(item: Record<string, unknown>, field: FieldDefinition): string {
  if (field.valueField) {
    return String(item[field.valueField] ?? "").trim();
  }
  return String(item.id);
}

export function RelationshipSelectField({ field, value, onChange, error }: RelationshipSelectFieldProps) {
  const placeholder = field.placeholder ?? `Pilih ${field.label.toLowerCase()}...`;

  const { data: options = [], isLoading } = useQuery({
    queryKey: [field.relatedEndpoint, "options"],
    queryFn: async () => {
      const { data } = await apiClient.get(`${field.relatedEndpoint}?page_size=100`);
      return data.data || data || [];
    },
    enabled: !!field.relatedEndpoint,
  });

  const selectOptions = useMemo(() => {
    const mapped = (options as Record<string, unknown>[])
      .map((item) => ({
        value: itemValue(item, field),
        label: itemLabel(item, field),
      }))
      .filter((opt) => (field.valueField ? opt.value !== "" : opt.value !== ""));

    const seen = new Set<string>();
    return mapped.filter((opt) => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });
  }, [options, field]);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const hit = selectOptions.find((opt) => opt.value === value);
    if (hit) return hit.label;
    if (field.valueField === "document_url" && value.startsWith("http")) {
      try {
        const name = decodeURIComponent(new URL(value).pathname.split("/").pop() || "");
        return name || value;
      } catch {
        return value;
      }
    }
    return value;
  }, [selectOptions, value, field.valueField]);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-danger ml-1">*</span>}
      </label>

      <CustomSelect
        value={value ?? ""}
        onChange={(next) => onChange(next || null)}
        options={
          value && !selectOptions.some((opt) => opt.value === value)
            ? [{ value, label: selectedLabel }, ...selectOptions]
            : selectOptions
        }
        placeholder={placeholder}
        allowClear={!field.required}
        clearLabel={placeholder}
        searchable={selectOptions.length > 6}
        searchPlaceholder={`Cari ${field.label.toLowerCase()}...`}
        loading={isLoading}
        emptyLabel="Tidak ada hasil"
        error={!!error}
      />

      {value && field.valueField === "document_url" && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-xs text-accent hover:underline"
        >
          Buka dokumen terpilih
        </a>
      )}

      {field.description && !error && (
        <p className="text-xs text-text-muted">{field.description}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
