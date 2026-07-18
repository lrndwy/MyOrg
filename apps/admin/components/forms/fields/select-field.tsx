"use client";

import type { FieldDefinition } from "@/lib/resource";
import { CustomSelect } from "@/components/ui/custom-select";

interface SelectFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function SelectField({ field, value, onChange, error }: SelectFieldProps) {
  const placeholder = field.placeholder ?? `Pilih ${field.label.toLowerCase()}...`;

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-danger ml-1">*</span>}
      </label>

      <CustomSelect
        value={value}
        onChange={onChange}
        options={field.options ?? []}
        placeholder={placeholder}
        allowClear={!field.required}
        clearLabel={placeholder}
        error={!!error}
      />

      {field.description && !error && (
        <p className="text-xs text-text-muted">{field.description}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
