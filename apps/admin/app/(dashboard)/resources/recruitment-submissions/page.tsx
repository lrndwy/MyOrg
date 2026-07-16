"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { recruitmentSubmissionResource } from "@/resources/recruitment-submissions";

export default function RecruitmentSubmissionsPage() {
  return <ResourcePage resource={recruitmentSubmissionResource} />;
}
