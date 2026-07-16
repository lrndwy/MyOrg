"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { permissionRequestResource } from "@/resources/permission-requests";

export default function PermissionRequestsPage() {
  return <ResourcePage resource={permissionRequestResource} />;
}
