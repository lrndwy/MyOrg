import type { RecruitmentCustomField } from "@repo/shared/types";

/** Parse custom_answers from API (object or JSON string). */
export function parseCustomAnswers(raw: unknown): Record<string, unknown> {
  if (raw == null || raw === "") return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return { value: raw };
    }
  }
  return {};
}

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

/** Extract a scalar value from stored answer (string URL, FileRef object, etc.). */
export function normalizeCustomAnswerInputValue(value: unknown): string | number | boolean {
  if (value == null || value === "") return "";
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const url = obj.url ?? obj.file_url ?? obj.fileUrl;
    if (typeof url === "string" && url.trim()) return url.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

/** Parse recruitment custom field option strings (newline or comma separated). */
export function parseFieldOptions(raw: unknown): string[] {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      /* fall through */
    }
  }
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format a single answer value for plain-text preview (table title, export). */
export function formatCustomAnswerValue(value: unknown, fieldType?: string): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const nested = obj.url ?? obj.file_url ?? obj.fileUrl;
    if (typeof nested === "string" && nested.trim()) {
      return formatCustomAnswerValue(nested, fieldType ?? "file");
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "—";
    }
  }

  const s = String(value).trim();
  if (!s) return "—";

  if (fieldType === "file" || (fieldType !== "text" && isUrl(s))) {
    try {
      const url = new URL(s);
      const name = url.pathname.split("/").pop();
      return name ? `File: ${decodeURIComponent(name)}` : "File attached";
    } catch {
      return s;
    }
  }

  if (fieldType === "checkbox") {
    if (s === "true") return "Yes";
    if (s === "false") return "No";
  }

  return s;
}

export interface CustomAnswerRow {
  label: string;
  value: unknown;
  fieldType?: string;
}

/** Build ordered rows using custom field definitions when available. */
export function buildCustomAnswerRows(
  raw: unknown,
  fields?: RecruitmentCustomField[],
): CustomAnswerRow[] {
  const answers = parseCustomAnswers(raw);
  const entries = Object.entries(answers);
  if (!entries.length) return [];

  if (!fields?.length) {
    return entries.map(([label, value]) => ({ label, value }));
  }

  const sorted = [...fields].sort((a, b) => a.order_index - b.order_index);
  const byLabel = new Map(sorted.map((f) => [f.field_label, f]));
  const used = new Set<string>();
  const rows: CustomAnswerRow[] = [];

  for (const field of sorted) {
    if (!(field.field_label in answers)) continue;
    used.add(field.field_label);
    rows.push({
      label: field.field_label,
      value: answers[field.field_label],
      fieldType: field.field_type,
    });
  }

  for (const [label, value] of entries) {
    if (used.has(label)) continue;
    const field = byLabel.get(label);
    rows.push({ label, value, fieldType: field?.field_type });
  }

  return rows;
}

/** One-line summary for narrow table columns. */
export function summarizeCustomAnswers(
  raw: unknown,
  fields?: RecruitmentCustomField[],
): string {
  const rows = buildCustomAnswerRows(raw, fields);
  if (!rows.length) return "—";

  return rows
    .map((row) => {
      const val = formatCustomAnswerValue(row.value, row.fieldType);
      return `${row.label}: ${val}`;
    })
    .join(" · ");
}
