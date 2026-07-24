let csrfMemory: string | null = null;

/** Read grit_csrf from document.cookie (non-HttpOnly double-submit token). */
export function readCsrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )grit_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function getCachedCsrfToken(): string | null {
  return readCsrfCookie() || csrfMemory;
}

export function rememberCsrfToken(token: string | null): void {
  csrfMemory = token;
}

/** Fetch /api/auth/csrf when the cookie is not yet readable (cross-subdomain bootstrap). */
export async function fetchCsrfToken(apiBaseUrl: string): Promise<string | null> {
  const fromCookie = readCsrfCookie();
  if (fromCookie) {
    csrfMemory = fromCookie;
    return fromCookie;
  }
  if (csrfMemory) return csrfMemory;

  try {
    const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}/api/auth/csrf`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { csrf_token?: string } };
    const token = body.data?.csrf_token ?? readCsrfCookie();
    csrfMemory = token ?? null;
    return csrfMemory;
  } catch {
    return null;
  }
}
