"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Shield } from "@/lib/icons";
import { hasAnyPermission, useMyPermissions } from "@/hooks/use-permissions-gate";

interface PermissionGateProps {
  permission?: string;
  /** When set, any listed permission grants access (combined with `permission`). */
  permissions?: string[];
  children: ReactNode;
  /** When omitted, shows a default access-denied panel. */
  fallback?: ReactNode;
}

function AccessDenied({ permission }: { permission?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-center">
      <Shield className="h-10 w-10 text-text-muted" />
      <h2 className="text-lg font-semibold text-foreground">Akses ditolak</h2>
      <p className="max-w-md text-sm text-text-secondary">
        Role Anda tidak memiliki izin untuk halaman ini
        {permission ? ` (${permission})` : ""}.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
      >
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

export function PermissionGate({
  permission,
  permissions,
  children,
  fallback,
}: PermissionGateProps) {
  const { data, isLoading } = useMyPermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const codes = [
    ...(permissions ?? []),
    ...(permission ? [permission] : []),
  ];
  const allowed =
    codes.length === 0 ? true : hasAnyPermission(data, codes);

  if (!allowed) {
    return fallback ?? <AccessDenied permission={permission ?? permissions?.[0]} />;
  }

  return <>{children}</>;
}
