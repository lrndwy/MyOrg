"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { eventCommitteeMemberResource } from "@/resources/event-committee-members";

export default function EventCommitteeMembersPage() {
  return <ResourcePage resource={eventCommitteeMemberResource} />;
}
