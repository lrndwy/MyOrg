"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { redirectToWebLogin } from "@/lib/panel-access";

/**
 * Admin login is removed — auth is centralized on the web app (:3000).
 * This route only forwards visitors (and any error query) to web /login
 * with a `next` return URL back into the admin panel.
 */
export default function AdminLoginRedirectPage() {
  return (
    <Suspense fallback={<RedirectSpinner />}>
      <RedirectInner />
    </Suspense>
  );
}

function RedirectInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    redirectToWebLogin({
      error: searchParams.get("error"),
    });
  }, [searchParams]);

  return <RedirectSpinner />;
}

function RedirectSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="mt-4 text-sm text-text-secondary">
          Mengalihkan ke halaman login…
        </p>
      </div>
    </div>
  );
}
