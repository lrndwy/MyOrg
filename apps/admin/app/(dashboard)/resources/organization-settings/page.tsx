"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "@/lib/icons";

/** Organization Settings is a singleton — always use /myorg/settings. */
export default function OrganizationSettingsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/myorg/settings");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
    </div>
  );
}
