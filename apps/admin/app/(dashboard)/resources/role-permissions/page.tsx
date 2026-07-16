"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { rolePermissionResource } from "@/resources/role-permissions";

export default function RolePermissionsPage() {
  return <ResourcePage resource={rolePermissionResource} />;
}
