"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { recruitmentResource } from "@/resources/recruitments";

export default function RecruitmentsPage() {
  return <ResourcePage resource={recruitmentResource} />;
}
