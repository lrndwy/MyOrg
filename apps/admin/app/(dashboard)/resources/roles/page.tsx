"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { roleResource } from "@/resources/roles";

export default function RolesPage() {
  return <ResourcePage resource={roleResource} />;
}
