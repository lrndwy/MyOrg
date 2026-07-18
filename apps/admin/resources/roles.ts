import { defineResource } from "@/lib/resource";

export const roleResource = defineResource({
  name: "Role",
  slug: "roles",
  endpoint: "/api/roles",
  icon: "Shield",
  label: { singular: "Role", plural: "Roles" },
  viewPermission: "roles.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true },
      { key: "description", label: "Description", searchable: true },
      { key: "is_system", label: "Is System", format: "boolean" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
    { key: "is_system", label: "Is System", type: "boolean" },
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
    { key: "is_system", label: "Is System", type: "toggle" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Roles",
        endpoint: "/api/roles",
        icon: "Shield",
        color: "accent",
      },
    ],
  },
});
