"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe, redirectUserAwayFromAdmin } from "@/hooks/use-auth";
import { canAccessAdminPanel, redirectToWebLogin } from "@/lib/panel-access";

// The auth cookies are HttpOnly so JS can't peek at them to decide
// where to send the user. Instead we ask the API: /api/auth/me returns
// the User on success and 401 (which useMe converts to null) when the
// session is gone or expired. Unauthenticated users go to the centralized
// web login (:3000), not an admin-local login form.
export default function RootPage() {
  const router = useRouter();
  const { data: user, isLoading } = useMe();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (canAccessAdminPanel(user.role)) {
        router.replace("/dashboard");
      } else {
        redirectUserAwayFromAdmin();
      }
    } else {
      redirectToWebLogin();
    }
  }, [router, user, isLoading]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );
}
