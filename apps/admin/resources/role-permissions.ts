import { defineResource } from "@/lib/resource";
import { permissionCode, permissionField, roleName } from "@/lib/resource-cells";

export const rolePermissionResource = defineResource({
  name: "RolePermission",
  slug: "role-permissions",
  endpoint: "/api/role_permissions",
  icon: "Shield",
  label: { singular: "Role Permission", plural: "Role Permissions" },
  viewPermission: "roles.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "role", label: "Role", cell: (row) => roleName(row), searchable: true },
      {
        key: "permission",
        label: "Permission",
        cell: (row) => permissionCode(row),
        searchable: true,
      },
      { key: "permission_module", label: "Module", cell: (row) => permissionField(row, "module") },
      {
        key: "permission_description",
        label: "Description",
        cell: (row) => permissionField(row, "description"),
      },
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
