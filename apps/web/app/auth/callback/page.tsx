"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ApiResponse, User } from "@repo/shared/types";
import { apiClient } from "@/lib/api";
import { navigateAfterLogin } from "@/lib/post-login";

/**
 * OAuth return target for the centralized web login.
 * API redirects here after setting HttpOnly auth cookies
 * (OAUTH_FRONTEND_URL should point at the web app :3000).
 */
export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackSpinner />}>
      <CallbackInner />
    </Suspense>
  );
}

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const error = searchParams.get("error");
    const next = searchParams.get("next");

    if (error) {
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    apiClient
      .get<ApiResponse<User>>("/api/me")
      .then(({ data }) => {
        queryClient.setQueryData(["me"], data.data);
        navigateAfterLogin(data.data, next);
      })
      .catch(() => {
        router.replace("/login?error=" + encodeURIComponent("Authentication failed"));
      });
  }, [searchParams, router, queryClient]);

  return <CallbackSpinner />;
}

function CallbackSpinner() {
  return (
    <div className="login-root flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--login-border)] border-t-[var(--login-accent)]" />
        <p className="mt-4 text-sm text-[var(--login-muted)]">Signing you in…</p>
      </div>
    </div>
  );
}
