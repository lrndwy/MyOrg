"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { subEventAttendanceResource } from "@/resources/sub-event-attendances";

export default function SubEventAttendancesPage() {
  return <ResourcePage resource={subEventAttendanceResource} />;
}
