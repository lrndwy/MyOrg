import type { FieldDefinition } from "@/lib/resource";

interface DateFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** Store RFC3339 for API; show datetime-local in the input. */
function toLocalInput(isoOrLocal: string, inputType: string): string {
  if (!isoOrLocal) return "";
  if (inputType === "date") {
    return isoOrLocal.slice(0, 10);
  }
  // Already datetime-local (no Z / offset)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(isoOrLocal) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(isoOrLocal)) {
    return isoOrLocal.slice(0, 16);
  }
  const d = new Date(isoOrLocal);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string, inputType: string): string {
  if (!local) return "";
  if (inputType === "date") {
    // Send RFC3339 so Go time.Time / FlexTime both accept it.
    const d = new Date(`${local}T00:00:00`);
    if (Number.isNaN(d.getTime())) return local;
    return d.toISOString();
  }
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local;
  const d = new Date(withSeconds);
  if (Number.isNaN(d.getTime())) return local;
  return d.toISOString();
}

export function DateField({ field, value, onChange, error }: DateFieldProps) {
  const inputType = field.type === "datetime" ? "datetime-local" : "date";
  const displayValue = toLocalInput(value || "", inputType);

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-danger ml-1">*</span>}
      </label>
      <input
        type={inputType}
        value={displayValue}
        onChange={(e) => onChange(fromLocalInput(e.target.value, inputType))}
        className={`w-full rounded-lg border border-border bg-bg-tertiary px-4 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${error ? "border-danger" : ""}`}
      />
      {field.description && !error && (
        <p className="text-xs text-text-muted">{field.description}</p>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
