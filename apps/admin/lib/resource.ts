// Resource Definition Types — The foundation of Grit Admin Panel
// Define resources with defineResource() and get full CRUD pages automatically.

import type { ReactNode } from "react";

// ─── Column Definitions ─────────────────────────────────────────────

export type ColumnFormat = "text" | "badge" | "currency" | "date" | "relative" | "boolean" | "image" | "video" | "file" | "files" | "link" | "email" | "color" | "richtext" | "user";

export interface BadgeConfig {
  [value: string]: { color: string; label: string };
}

export interface ColumnDefinition {
  key: string;
  label: string;
  sortable?: boolean;
  searchable?: boolean;
  hidden?: boolean;
  width?: string;
  format?: ColumnFormat;
  badge?: BadgeConfig;
  currencyPrefix?: string;
  className?: string;
  // v3.31.15: optional custom cell renderer. Lets you pack multiple
  // fields into one column (Name + email stacked, price + currency
  // badge, status pill + relative date) without dropping out to a
  // hand-written page. Receives the full row so dotted keys aren't
  // necessary. When defined, takes precedence over format / badge.
  cell?: (row: Record<string, unknown>) => ReactNode;
}

// ─── Filter Definitions ─────────────────────────────────────────────

export type FilterType = "select" | "date-range" | "number-range" | "boolean";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
}

// ─── Table Definitions ──────────────────────────────────────────────

export type TableAction = "create" | "view" | "edit" | "delete" | "export";
export type BulkAction = "delete" | "export";

export interface TableDefinition {
  columns: ColumnDefinition[];
  filters?: FilterDefinition[];
  searchable?: boolean;
  searchPlaceholder?: string;
  actions?: TableAction[];
  bulkActions?: BulkAction[];
  defaultSort?: { key: string; direction: "asc" | "desc" };
  pageSize?: number;
  // v3.31.34 — date-window filter on this resource's list page.
  // Defaults to enabled with field="created_at", label="Created".
  // Set enabled:false to hide; override field to filter on a domain
  // column (e.g. "scheduled_for" for a Booking resource).
  dateFilter?: {
    enabled?: boolean;
    field?: string;
    label?: string;
  };
  // v3.31.35 — client-side export formats offered in the toolbar's
  // download menu. Defaults to all three on. Set the whole field to
  // false to hide the menu entirely; flip individual flags to hide a
  // single format. allPages (default true) means the menu fetches
  // every page from the API before building the file -- otherwise
  // only the rows currently on screen get exported.
  export?: false | {
    csv?: boolean;
    json?: boolean;
    excel?: boolean;
    allPages?: boolean;
  };
  // v3.31.35 — Excel import button + modal flow. Defaults to enabled.
  // Set to false to hide. fields restricts which form fields are
  // accepted in the upload (useful for excluding computed columns or
  // user-supplied IDs); defaults to every form field.
  import?: false | {
    excel?: boolean;
    fields?: string[];
  };
}

// ─── Form Field Definitions ─────────────────────────────────────────

export type FieldType = "text" | "textarea" | "number" | "select" | "date" | "datetime" | "toggle" | "checkbox" | "radio" | "richtext" | "image" | "images" | "video" | "videos" | "file" | "files" | "relationship-select" | "multi-relationship-select";

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: unknown;
  options?: FilterOption[];
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  rows?: number;
  colSpan?: 1 | 2;
  accept?: string;
  maxSize?: number;
  relatedEndpoint?: string;
  displayField?: string;
  relationshipKey?: string;

  // v3.31.30 — file / files field knobs. Set by the resource generator
  // from the CLI :file:<accepts> / :files:<accepts> syntax, but can be
  // overridden by hand in the resource definition.
  /** Accept-alias list ("image", "all", or e.g. ["pdf","doc"]). */
  accepts?: string[];
  /** Per-field max size in megabytes. Defaults: 5MB, 300MB for video. */
  maxSizeMB?: number;
  // v3.31.31 — visual knobs for the FileField / FilesField.
  /** Dropzone visual variant. "default" boxed-dashed, "compact" inline,
   *  "minimal" link, "avatar" circular for profile pics,
   *  "inline" tag-style. */
  dropzone?: "default" | "compact" | "minimal" | "avatar" | "inline";
  /** Progress indicator variant. "bar" (default linear), "circular"
   *  (donut with % inside), "pulse" (three dots + %, minimal). */
  progress?: "bar" | "circular" | "pulse";
  /** Allow up/down arrow reordering of files in the preview list.
   *  Multi-file (:files:) only. Defaults to true. */
  reorderable?: boolean;
  /** For type "file": store just the uploaded URL string (like image/video)
   *  instead of a full FileRef object. Use when the Go column is a string URL. */
  storeAs?: "url" | "ref";

  // v3.31.38 — number-input behaviour. Only applies when type === "number".
  /** Domain of the underlying Go column. Controls comma formatting:
   *  "int" allows negatives, no decimals; "uint" disallows negatives
   *  + decimals; "float" allows both. The generator sets this from
   *  the Go field type. Unset = "float" (legacy permissive). */
  numberKind?: "int" | "uint" | "float";
}

export interface StepDefinition {
  title: string;
  description?: string;
  fields: string[];
}

// v3.31.18: groups unify the Create wizard and the Update cards view.
// On Create (sheet/modal/page) they render as a stepped wizard with
// Next/Back. On Update they render as per-group cards, each with its
// own Save button that PATCHes only that group's fields — so editing
// "Address" doesn't rewrite "Pricing".
//
// scope picks which contexts the group appears in:
//   "create"  — wizard step on Create only; hidden on Update
//   "update"  — card on Update only; hidden on Create
//   "both"    — both contexts (default)
//
// Useful pattern: minimal Create with title + price (scope: "create"),
// the rest deferred to Update cards (scope: "update").
export interface GroupDefinition {
  title: string;
  description?: string;
  fields: string[];
  scope?: "create" | "update" | "both";
}

export interface FormDefinition {
  fields: FieldDefinition[];
  layout?: "single" | "two-column";
  steps?: StepDefinition[];
  groups?: GroupDefinition[];
  fieldsPerStep?: number;
  stepVariant?: "horizontal" | "vertical";
}

// ─── Widget Definitions ─────────────────────────────────────────────

export type WidgetType = "stat" | "chart" | "activity";
export type ChartType = "line" | "bar" | "pie";
export type WidgetFormat = "number" | "currency" | "percentage";

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  endpoint?: string;
  icon?: string;
  color?: string;
  format?: WidgetFormat;
  chartType?: ChartType;
  limit?: number;
  colSpan?: 1 | 2 | 3 | 4;
}

export interface DashboardDefinition {
  // v3.31.44 -- set to false to hide the per-resource preset widgets
  // (Total + sparkline + Latest N) from the main dashboard. The
  // widgets are opt-in disabled, not opt-in enabled: every newly
  // generated resource gets them by default.
  enabled?: boolean;
  // Reserved for the custom widget builder (v3.31.40 dashboard
  // layout work). Existing resources may already declare widgets[];
  // the preset Total + Latest N widgets render even when this is
  // empty.
  widgets?: WidgetDefinition[];
}

// ─── Resource Definition ────────────────────────────────────────────

export interface ResourceDefinition {
  name: string;
  slug: string;
  endpoint: string;
  icon: string;
  label?: { singular: string; plural: string };
  // How the Create / Edit form is presented:
  //   "sheet"        — right-drawer on desktop, bottom-sheet on mobile (default)
  //   "modal"        — centered dialog, best for short forms (1-6 fields)
  //   "page"         — a dedicated route at /resources/<slug>?action=create|edit
  //   "modal-steps"  — sheet/drawer with multi-step wizard
  //   "page-steps"   — dedicated page with multi-step wizard
  // Leave undefined to inherit the "sheet" default. (Pre-v3.31.17 the
  // bare "modal" value also rendered as a sheet — now "modal" is a
  // proper centered dialog. Switch to "sheet" if you preferred the
  // old behavior.)
  formView?: "sheet" | "modal" | "page" | "modal-steps" | "page-steps";
  table: TableDefinition;
  form: FormDefinition;
  dashboard?: DashboardDefinition;
  stats?: StatsConfig | boolean;
  // Optional sidebar nav grouping. Resources sharing the same group key
  // render under a collapsible group header in the sidebar.
  group?: string;
  // Hide this resource from the sidebar for users without ADMIN/EDITOR role.
  adminOnly?: boolean;
}

// Stats cards shown above the data table on every resource page.
// See GRIT_STYLE_GUIDE §7.8 (Page Header).
// Set stats: false to disable stats on this resource page.
// Omit stats to get 4 auto-generated default cards (Total, This Week, This Month, Updated Recently).
// Provide stats: { cards: [...] } to fully customize.
export interface StatsConfig {
  enabled?: boolean;
  cards?: StatCardConfig[];
}

export interface StatCardConfig {
  label: string;
  icon?: string;
  color?: "default" | "success" | "warning" | "danger" | "info";
  value?: string | number;
  endpoint?: string;
  field?: string;
  trend?: { value: number; direction: "up" | "down" };
}

// ─── defineResource Helper ──────────────────────────────────────────

export function defineResource(config: ResourceDefinition): ResourceDefinition {
  return {
    ...config,
    label: config.label ?? {
      singular: config.name,
      plural: config.slug.charAt(0).toUpperCase() + config.slug.slice(1),
    },
    table: {
      ...config.table,
      pageSize: config.table.pageSize ?? 20,
      actions: config.table.actions ?? ["create", "view", "edit", "delete"],
      searchable: config.table.searchable ?? true,
    },
    form: {
      ...config.form,
      layout: config.form.layout ?? "single",
    },
  };
}
