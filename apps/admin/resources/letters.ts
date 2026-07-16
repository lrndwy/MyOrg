import { defineResource } from "@/lib/resource";
import { categoryName } from "@/lib/resource-cells";

function textOrDash(value: unknown, max = 80): string {
  if (value == null) return "—";
  const s = String(value).trim();
  if (!s) return "—";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Resource definition kept for nav/export; create UI is a custom page. */
export const letterResource = defineResource({
  name: "Letter",
  slug: "letters",
  endpoint: "/api/letters",
  icon: "Database",
  label: { singular: "Letter", plural: "Letters" },
  table: {
    columns: [
      {
        key: "type",
        label: "Type",
        sortable: true,
        format: "badge",
        badge: {
          incoming: { color: "info", label: "Incoming" },
          outgoing: { color: "accent", label: "Outgoing" },
        },
      },
      {
        key: "category",
        label: "Category",
        cell: (row) => categoryName(row),
      },
      { key: "letter_code", label: "Letter Code", sortable: true, searchable: true },
      { key: "subject", label: "Subject", sortable: true, searchable: true },
      { key: "letter_date", label: "Letter Date", sortable: true, format: "date" },
      {
        key: "recipient",
        label: "Recipient",
        cell: (row) => textOrDash(row.recipient),
      },
      {
        key: "document_url",
        label: "Document",
        format: "link",
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
    ],
    filters: [
      {
        key: "type",
        label: "Type",
        type: "select",
        options: [
          { label: "Incoming", value: "incoming" },
          { label: "Outgoing", value: "outgoing" },
        ],
      },
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    searchPlaceholder: "Cari kode, subject…",
    pageSize: 20,
    actions: ["view", "delete", "export"],
    bulkActions: ["delete", "export"],
    import: false,
    dateFilter: {
      enabled: true,
      field: "created_at",
      label: "Created",
    },
  },
  form: {
    fields: [
      {
        key: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { label: "Incoming", value: "incoming" },
          { label: "Outgoing", value: "outgoing" },
        ],
      },
      {
        key: "category_id",
        label: "Category",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/letter_categories",
        displayField: "name",
      },
      { key: "subject", label: "Subject", type: "text" },
      { key: "letter_date", label: "Letter Date", type: "date" },
      { key: "recipient", label: "Recipient", type: "text" },
      {
        key: "document_url",
        label: "Document URL",
        type: "text",
        description: "Generated or uploaded document — prefer Create via Letters page.",
      },
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Letters",
        endpoint: "/api/letters",
        icon: "Database",
        color: "accent",
      },
    ],
  },
  // Custom letters page renders these via StatsGrid (not the generic resource page).
  stats: {
    cards: [
      {
        label: "Total",
        endpoint: "/api/letters?page_size=1",
        field: "meta.total",
        icon: "FileText",
      },
      {
        label: "Total Incoming",
        endpoint: "/api/letters?page_size=1&type=incoming",
        field: "meta.total",
        icon: "Download",
        color: "info",
      },
      {
        label: "Total Outgoing",
        endpoint: "/api/letters?page_size=1&type=outgoing",
        field: "meta.total",
        icon: "Upload",
        color: "success",
      },
      {
        label: "Total This Month",
        endpoint: "/api/letters?page_size=1&created_since=30d",
        field: "meta.total",
        icon: "Calendar",
        color: "warning",
      },
    ],
  },
});
