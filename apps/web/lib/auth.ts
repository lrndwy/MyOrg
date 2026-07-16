"use client";

// Lightweight client-side token helper.
//
// The API's primary auth flow is HttpOnly grit_access / grit_refresh
// cookies (set by /api/auth/login, /api/auth/register, /api/auth/refresh)
// which axios already sends automatically via withCredentials in
// lib/api.ts — that's what actually authorizes every request.
//
// This module adds a secondary, JS-visible copy of the same token pair
// (the API returns it in the JSON body for native/bearer clients) so:
//   1. The Authorization header can be attached as a fallback for
//      requests that, for whatever reason, don't carry the cookie.
//   2. UI (navbar, route guards) can synchronously know "is someone
//      probably logged in" without waiting on a network round trip —
//      the real gate is always a server call (GET /api/me).
import { useEffect, useState } from "react";

const ACCESS_TOKEN_KEY = "myorg_access_token";
const REFRESH_TOKEN_KEY = "myorg_refresh_token";
const AUTH_CHANGE_EVENT = "myorg-auth-change";

export interface StoredTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: StoredTokens): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function hasStoredToken(): boolean {
  return !!getAccessToken();
}

// useIsAuthenticated gives components (e.g. the navbar) a reactive,
// no-network read of "is a token stored right now". It updates when
// setTokens/clearTokens run in this tab, or the token changes in
// another tab (storage event). It is a UX hint only — pages that
// actually need to gate content must still verify with GET /api/me,
// since the token can be stale or the cookie session revoked.
//
// Initial state is always false so SSR HTML matches the first client
// paint (localStorage is unavailable on the server). After mount we
// sync from storage — a one-frame delay that avoids hydration errors.
export function useIsAuthenticated(): boolean {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(hasStoredToken());
    sync();
    window.addEventListener(AUTH_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return authed;
}
