import { defineResource } from "@/lib/resource";
import { userLabel } from "@/lib/resource-cells";

export const violationResource = defineResource({
  name: "Violation",
  slug: "violations",
  endpoint: "/api/violations",
  icon: "Database",
  label: { singular: "Violation", plural: "Violations" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "user", label: "User", cell: (row) => userLabel(row) },
      { key: "violation_type", label: "Violation Type", sortable: true, searchable: true },
      { key: "description", label: "Description", searchable: true },
      {
        key: "sp_level",
        label: "SP Level",
        sortable: true,
        format: "badge",
        badge: {
          SP1: { color: "warning", label: "SP1" },
          SP2: { color: "danger", label: "SP2" },
          SP3: { color: "danger", label: "SP3" },
        },
      },
      { key: "document_url", label: "Document", format: "link" },
      {
        key: "issued_by",
        label: "Issued By",
        cell: (row) => userLabel(row, "issued_by"),
      },
      { key: "issued_date", label: "Issued Date", sortable: true, format: "relative" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "sp_level",
        label: "SP Level",
        type: "select",
        options: [
          { label: "SP1", value: "SP1" },
          { label: "SP2", value: "SP2" },
          { label: "SP3", value: "SP3" },
        ],
      },
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
      {
        key: "user_id",
        label: "User",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/users",
        displayField: "full_name",
      },
      { key: "violation_type", label: "Violation Type", type: "text", required: true },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "sp_level",
        label: "SP Level",
        type: "select",
        required: true,
        options: [
          { label: "SP1", value: "SP1" },
          { label: "SP2", value: "SP2" },
          { label: "SP3", value: "SP3" },
        ],
      },
      { key: "document_url", label: "Document", type: "text", description: "URL lampiran dokumen" },
      {
        key: "issued_by_id",
        label: "Issued By",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/users",
        displayField: "full_name",
      },
      { key: "issued_date", label: "Issued Date", type: "date" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Violations",
        endpoint: "/api/violations",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
