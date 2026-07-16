"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { permissionResource } from "@/resources/permissions";

export default function PermissionsPage() {
  return <ResourcePage resource={permissionResource} />;
}
