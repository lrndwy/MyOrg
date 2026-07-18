import type { MyPermissionsData } from "@/hooks/use-permissions-gate";
import { hasPermission } from "@/hooks/use-permissions-gate";

/** Custom MyOrg workflow pages outside the resources registry. */
export const MYORG_PAGE_PERMISSIONS: Record<string, string> = {
  "/myorg/finance": "finance.view",
  "/myorg/settings": "settings.manage",
  "/myorg/permissions": "attendance.approve",
};

/** Prefix match for nested MyOrg routes (e.g. event recap). */
export const MYORG_ROUTE_PREFIX_PERMISSIONS: { prefix: string; permission: string }[] = [
  { prefix: "/myorg/events/", permission: "events.view" },
  { prefix: "/myorg/recruitments/", permission: "recruitment.manage" },
];

export function permissionForPath(pathname: string): string | undefined {
  if (MYORG_PAGE_PERMISSIONS[pathname]) {
    return MYORG_PAGE_PERMISSIONS[pathname];
  }
  for (const { prefix, permission } of MYORG_ROUTE_PREFIX_PERMISSIONS) {
    if (pathname.startsWith(prefix)) return permission;
  }
  return undefined;
}

export function canAccessWithPermissions(
  data: MyPermissionsData | undefined,
  permission: string | undefined
): boolean {
  return hasPermission(data, permission);
}
