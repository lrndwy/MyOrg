import { canAccessAdminPanel } from "@repo/shared/constants";
import type { User } from "@repo/shared/types";

const ADMIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";

/**
 * After a successful sign-in on the centralized web login, send the user
 * either to an allowlisted `next` return URL (admin panel) or the web
 * dashboard. Rejects open redirects by only allowing same-origin paths
 * on this web app, or URLs under NEXT_PUBLIC_ADMIN_URL for panel roles.
 */
export function resolvePostLoginDestination(
  user: User,
  nextParam: string | null | undefined
): string {
  const next = (nextParam || "").trim();
  if (!next) return "/dashboard";

  // Relative path on the web app
  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  try {
    const target = new URL(next);
    const admin = new URL(ADMIN_URL);
    if (
      target.origin === admin.origin &&
      canAccessAdminPanel(user.role)
    ) {
      return target.toString();
    }
    // Same-origin absolute URL for the web app
    if (typeof window !== "undefined" && target.origin === window.location.origin) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    // fall through
  }

  return "/dashboard";
}

/** Navigate after login — full page load for cross-origin admin hops. */
export function navigateAfterLogin(
  user: User,
  nextParam: string | null | undefined
): void {
  const dest = resolvePostLoginDestination(user, nextParam);
  if (dest.startsWith("http://") || dest.startsWith("https://")) {
    window.location.href = dest;
    return;
  }
  window.location.href = dest;
}
