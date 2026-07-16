"use client";

import { ResourcePage } from "@/components/resource/resource-page";
import { announcementResource } from "@/resources/announcements";

export default function AnnouncementsPage() {
  return <ResourcePage resource={announcementResource} />;
}
