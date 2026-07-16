import { defineResource } from "@/lib/resource";

export const letterCategoryResource = defineResource({
  name: "LetterCategory",
  slug: "letter-categories",
  endpoint: "/api/letter_categories",
  icon: "FolderTree",
  label: { singular: "Letter Category", plural: "Letter Categories" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true },
      { key: "code", label: "Code", sortable: true, searchable: true },
      { key: "start_number", label: "Start Number", sortable: true },
      { key: "current_number", label: "Current Number", sortable: true },
      { key: "number_format_template", label: "Number Format Template", sortable: true, searchable: true },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
    { key: "name", label: "Name", type: "text", required: true },
    { key: "code", label: "Code", type: "text", required: true },
    { key: "start_number", label: "Start Number", type: "number", numberKind: "int" },
    { key: "current_number", label: "Current Number", type: "number", numberKind: "int" },
    { key: "number_format_template", label: "Number Format Template", type: "text", required: true },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Letter Categories",
        endpoint: "/api/letter_categories",
        icon: "FolderTree",
        color: "accent",
      },
    ],
  },
});
