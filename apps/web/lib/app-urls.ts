import { resolvePublicAppUrl } from "@repo/shared/constants";

const ADMIN_FALLBACK = "http://localhost:3001";
const WEB_FALLBACK = "http://localhost:3000";

/** Admin panel origin for navigation — rewrites localhost → current host in prod. */
export function getAdminAppUrl(): string {
  return resolvePublicAppUrl(
    process.env.NEXT_PUBLIC_ADMIN_URL,
    ADMIN_FALLBACK
  );
}

/** Web app origin (same rewrite rules as admin → web). */
export function getWebAppUrl(): string {
  return resolvePublicAppUrl(process.env.NEXT_PUBLIC_WEB_URL, WEB_FALLBACK);
}

export function getConfiguredAdminAppUrl(): string {
  return (process.env.NEXT_PUBLIC_ADMIN_URL || ADMIN_FALLBACK).replace(
    /\/$/,
    ""
  );
}
