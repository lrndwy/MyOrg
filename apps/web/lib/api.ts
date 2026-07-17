import axios from "axios";
import { getAccessToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// crypto.randomUUID() is secure-context only (HTTPS / localhost).
// Production served over plain HTTP throws "crypto.randomUUID is not a function".
function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  // The browser attaches the HttpOnly grit_access / grit_refresh cookies
  // set by /api/auth/login automatically. Without this, axios skips them
  // on cross-origin requests in dev (api on :8080, web on :3000) and the
  // server treats every request as anonymous.
  withCredentials: true,
});

// Echo the grit_csrf cookie into X-CSRF-Token on every state-changing
// request. The cookie is intentionally not HttpOnly — it's the
// double-submit token, paired with the cookie the AutoCSRF middleware
// enforces. Safe-method requests don't need it; the middleware skips
// them and issues / refreshes the cookie as a side effect.
api.interceptors.request.use((config) => {
  if (typeof document !== "undefined") {
    const m = document.cookie.match(/(?:^|; )grit_csrf=([^;]+)/);
    if (m && config.headers) {
      config.headers["X-CSRF-Token"] = decodeURIComponent(m[1]);
    }
  }

  // Fallback Authorization header. The grit_access HttpOnly cookie is
  // the primary credential and wins server-side when both are present;
  // this just covers the (rare) case where the cookie isn't attached.
  const token = getAccessToken();
  if (token && config.headers && !config.headers["Authorization"]) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }

  // Auto-attach Idempotency-Key on unsafe methods so any mutation gets
  // safe-retry semantics for free.
  const method = (config.method || "get").toUpperCase();
  const unsafe = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  if (unsafe && config.headers && !config.headers["Idempotency-Key"]) {
    config.headers["Idempotency-Key"] = generateIdempotencyKey();
  }
  return config;
});

// v3.31.21: alias kept so generated React Query hooks that import
// { apiClient } from "@/lib/api" resolve symmetrically with apps/admin
// (which exports the same name from its own api-client.ts).
export const apiClient = api;
