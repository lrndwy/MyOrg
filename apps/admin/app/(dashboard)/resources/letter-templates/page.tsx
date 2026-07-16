"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { letterTemplateResource } from "@/resources/letter-templates";

export default function LetterTemplatesPage() {
  return <ResourcePage resource={letterTemplateResource} />;
}
