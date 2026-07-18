"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { eventSubEventResource } from "@/resources/event-sub-events";

export default function EventSubEventsPage() {
  return <ResourcePage resource={eventSubEventResource} />;
}
