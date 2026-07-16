import { canAccessAdminPanel } from "@repo/shared/constants";

export const WEB_APP_URL =
  process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";

export const ADMIN_ACCESS_DENIED_MESSAGE =
  "Panel Access USER tidak dapat masuk admin panel. Gunakan aplikasi web.";

export { canAccessAdminPanel };

/**
 * Build the centralized web login URL. Auth lives only on the web app
 * (port 3000); admin (3001) never renders its own login form.
 *
 * `next` tells web where to send ADMIN/EDITOR users after a successful
 * sign-in (typically this admin origin + /dashboard). Extra query params
 * (e.g. `error`) are forwarded so OAuth failures still surface.
 */
export function webLoginUrl(options?: {
  next?: string;
  error?: string | null;
}): string {
  const url = new URL("/login", WEB_APP_URL);
  const next =
    options?.next ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/dashboard`
      : undefined);
  if (next) url.searchParams.set("next", next);
  if (options?.error) url.searchParams.set("error", options.error);
  return url.toString();
}

/** Hard-navigate to the web login (full page load — clears admin SPA state). */
export function redirectToWebLogin(options?: {
  next?: string;
  error?: string | null;
  /** When true, omit `next` so a logged-out admin does not bounce
   *  straight back into the panel after a stale web session probe. */
  fromLogout?: boolean;
}): void {
  if (typeof window === "undefined") return;
  if (options?.fromLogout) {
    const url = new URL("/login", WEB_APP_URL);
    if (options.error) url.searchParams.set("error", options.error);
    // Hint for web: do not auto-follow a previous admin return URL.
    url.searchParams.set("logged_out", "1");
    window.location.href = url.toString();
    return;
  }
  window.location.href = webLoginUrl(options);
}
