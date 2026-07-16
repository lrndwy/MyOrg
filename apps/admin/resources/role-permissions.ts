import { defineResource } from "@/lib/resource";

export const rolePermissionResource = defineResource({
  name: "RolePermission",
  slug: "role-permissions",
  endpoint: "/api/role_permissions",
  icon: "Shield",
  label: { singular: "Role Permission", plural: "Role Permissions" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "role.name", label: "Role", searchable: true },
      { key: "permission.code", label: "Permission", searchable: true },
      { key: "permission.module", label: "Module" },
      { key: "permission.description", label: "Description" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
      {
        key: "role_id",
        label: "Role",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/roles",
        displayField: "name",
      },
      {
        key: "permission_id",
        label: "Permission",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/permissions",
        displayField: "code",
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Role Permissions",
        endpoint: "/api/role_permissions",
        icon: "Shield",
        color: "accent",
      },
    ],
  },
});
