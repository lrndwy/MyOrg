"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { eventResource } from "@/resources/events";

export default function EventsPage() {
  return <ResourcePage resource={eventResource} />;
}
