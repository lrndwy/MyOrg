let csrfMemory: string | null = null;

/** Read grit_csrf from document.cookie (non-HttpOnly double-submit token). */
export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )grit_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function getCachedCsrfToken(apiBaseUrl?: string): string | null {
  // Prefer memory from a recent /api/auth/csrf bootstrap over document.cookie.
  // On cross-subdomain deploys the readable cookie can disagree with the value
  // the API receives when duplicate grit_csrf cookies exist.
  if (apiBaseUrl && isCrossOriginApi(apiBaseUrl)) {
    return csrfMemory;
  }
  return csrfMemory || readCsrfCookie();
}

export function rememberCsrfToken(token: string | null): void {
  csrfMemory = token;
}

function isCrossOriginApi(apiBaseUrl: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(apiBaseUrl).hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

/**
 * Ensure a CSRF token is ready for the next mutation.
 * Cross-subdomain SPAs (admin/web → api) always bootstrap via /api/auth/csrf
 * so the X-CSRF-Token header matches the Set-Cookie the API validates.
 */
export async function ensureCsrfToken(
  apiBaseUrl: string,
  opts?: { force?: boolean }
): Promise<string | null> {
  const force = opts?.force ?? false;
  const crossOrigin = isCrossOriginApi(apiBaseUrl);

  if (!force) {
    if (crossOrigin) {
      if (csrfMemory) return csrfMemory;
    } else {
      const cached = getCachedCsrfToken();
      if (cached) return cached;
    }
  }

  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/auth/csrf`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return getCachedCsrfToken();
    const body = (await res.json()) as { data?: { csrf_token?: string } };
    const token = body.data?.csrf_token ?? readCsrfCookie();
    csrfMemory = token ?? null;
    return csrfMemory;
  } catch {
    return getCachedCsrfToken();
  }
}

/** @deprecated Prefer ensureCsrfToken */
export async function fetchCsrfToken(apiBaseUrl: string): Promise<string | null> {
  return ensureCsrfToken(apiBaseUrl);
}
