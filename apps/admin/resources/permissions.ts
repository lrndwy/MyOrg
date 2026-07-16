import { defineResource } from "@/lib/resource";

export const permissionResource = defineResource({
  name: "Permission",
  slug: "permissions",
  endpoint: "/api/permissions",
  icon: "Lock",
  label: { singular: "Permission", plural: "Permissions" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "code", label: "Code", sortable: true, searchable: true },
      { key: "module", label: "Module", sortable: true, searchable: true },
      { key: "description", label: "Description", sortable: true, searchable: true },
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
    { key: "code", label: "Code", type: "text", required: true },
    { key: "module", label: "Module", type: "text", required: true },
    { key: "description", label: "Description", type: "text" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Permissions",
        endpoint: "/api/permissions",
        icon: "Lock",
        color: "accent",
      },
    ],
  },
});
