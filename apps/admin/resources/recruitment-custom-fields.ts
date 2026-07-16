import { defineResource } from "@/lib/resource";
import { jsonPreview, recruitmentTitle } from "@/lib/resource-cells";

export const recruitmentCustomFieldResource = defineResource({
  name: "RecruitmentCustomField",
  slug: "recruitment-custom-fields",
  endpoint: "/api/recruitment_custom_fields",
  icon: "Database",
  label: { singular: "Recruitment Custom Field", plural: "Recruitment Custom Fields" },
  table: {
    columns: [
      // grit:cols:auto-start
      {
        key: "recruitment",
        label: "Recruitment",
        cell: (row) => recruitmentTitle(row),
      },
      { key: "field_label", label: "Field Label", sortable: true, searchable: true },
      {
        key: "field_type",
        label: "Field Type",
        sortable: true,
        format: "badge",
        badge: {
          text: { color: "muted", label: "Text" },
          number: { color: "info", label: "Number" },
          textarea: { color: "muted", label: "Textarea" },
          select: { color: "accent", label: "Select" },
          file: { color: "warning", label: "File" },
        },
      },
      {
        key: "field_options",
        label: "Field Options",
        cell: (row) => jsonPreview(row.field_options),
      },
      { key: "is_required", label: "Required", format: "boolean" },
      { key: "order_index", label: "Order", sortable: true },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      { key: "is_required", label: "Required", type: "boolean" },
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
      {
        key: "recruitment_id",
        label: "Recruitment",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/recruitments",
        displayField: "title",
      },
      { key: "field_label", label: "Field Label", type: "text", required: true },
      {
        key: "field_type",
        label: "Field Type",
        type: "select",
        required: true,
        options: [
          { label: "Text", value: "text" },
          { label: "Number", value: "number" },
          { label: "Textarea", value: "textarea" },
          { label: "Select", value: "select" },
          { label: "File", value: "file" },
        ],
      },
      {
        key: "field_options",
        label: "Field Options",
        type: "textarea",
        description:
          'Untuk tipe Select: satu opsi per baris (atau JSON ["A","B"]). Kosongkan jika bukan select.',
        placeholder: "Opsi 1\nOpsi 2\nOpsi 3",
        rows: 4,
      },
      { key: "is_required", label: "Required", type: "toggle" },
      { key: "order_index", label: "Order Index", type: "number" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Recruitment Custom Fields",
        endpoint: "/api/recruitment_custom_fields",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
