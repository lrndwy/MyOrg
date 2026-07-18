"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { eventCommitteeSieResource } from "@/resources/event-committee-sies";

export default function EventCommitteeSiesPage() {
  return <ResourcePage resource={eventCommitteeSieResource} />;
}
