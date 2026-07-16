"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { recruitmentCustomFieldResource } from "@/resources/recruitment-custom-fields";

export default function RecruitmentCustomFieldsPage() {
  return <ResourcePage resource={recruitmentCustomFieldResource} />;
}
