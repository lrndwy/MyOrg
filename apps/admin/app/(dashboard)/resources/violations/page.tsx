"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { violationResource } from "@/resources/violations";

export default function ViolationsPage() {
  return <ResourcePage resource={violationResource} />;
}
