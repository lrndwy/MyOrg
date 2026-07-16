import { usersResource } from "./users";
import { divisionResource } from "./divisions";
import { roleResource } from "./roles";
import { permissionResource } from "./permissions";
import { rolePermissionResource } from "./role-permissions";
import { eventResource } from "./events";
import { attendanceResource } from "./attendances";
import { permissionRequestResource } from "./permission-requests";
import { violationResource } from "./violations";
import { recruitmentResource } from "./recruitments";
import { recruitmentTargetDivisionResource } from "./recruitment-target-divisions";
import { recruitmentCustomFieldResource } from "./recruitment-custom-fields";
import { recruitmentSubmissionResource } from "./recruitment-submissions";
import { letterCategoryResource } from "./letter-categories";
import { letterResource } from "./letters";
import { announcementResource } from "./announcements";
// Organization Settings is a singleton — edit via /myorg/settings only.
// Announcement attachments are managed inline on the Announcement form.
// Keep API CRUD where needed; do not register here.
import { letterTemplateResource } from "./letter-templates";
// grit:resources

import type { ResourceDefinition } from "@/lib/resource";

export const resources: ResourceDefinition[] = [
  usersResource,
  divisionResource,
  roleResource,
  permissionResource,
  rolePermissionResource,
  eventResource,
  attendanceResource,
  permissionRequestResource,
  violationResource,
  recruitmentResource,
  recruitmentTargetDivisionResource,
  recruitmentCustomFieldResource,
  recruitmentSubmissionResource,
  letterCategoryResource,
  letterResource,
  announcementResource,
  letterTemplateResource,
  // grit:resource-list
];

export function getResource(slug: string): ResourceDefinition | undefined {
  return resources.find((r) => r.slug === slug);
}

export function getResourceByEndpoint(endpoint: string): ResourceDefinition | undefined {
  return resources.find((r) => r.endpoint === endpoint);
}
