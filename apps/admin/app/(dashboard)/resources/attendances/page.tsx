"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { attendanceResource } from "@/resources/attendances";

export default function AttendancesPage() {
  return <ResourcePage resource={attendanceResource} />;
}
