import { defineResource } from "@/lib/resource";

export const divisionResource = defineResource({
  name: "Division",
  slug: "divisions",
  endpoint: "/api/divisions",
  icon: "Database",
  label: { singular: "Division", plural: "Divisions" },
  viewPermission: "divisions.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true },
      { key: "description", label: "Description", searchable: true },
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
    { key: "description", label: "Description", type: "textarea" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Divisions",
        endpoint: "/api/divisions",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
