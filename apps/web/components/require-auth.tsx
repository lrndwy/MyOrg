"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@repo/shared/types";
import { useMe } from "@/hooks/use-auth";

// Shared client-side gate for every page under this app that needs a
// signed-in user (dashboard, profile, events actions, ...). Renders
// children with the resolved user once GET /api/me confirms the
// session; redirects to /login otherwise. This is a UX convenience,
// not the security boundary — every real permission check still
// happens server-side.
export function RequireAuth({
  children,
}: {
  children: (user: User) => React.ReactNode;
}) {
  const router = useRouter();
  const { data: user, isLoading } = useMe();

  useEffect(() => {
    if (!isLoading && user === null) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return <>{children(user)}</>;
}
