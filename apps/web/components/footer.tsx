"use client";

import { usePublicSettings } from "@/hooks/use-public-settings";

export function Footer() {
  const { data: settings } = usePublicSettings();
  const brand = settings?.web_name || "MyOrg";
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-5 text-center sm:flex-row sm:px-6 sm:text-left">
        <p className="text-sm font-medium text-foreground">{brand}</p>
        <p className="text-xs text-text-muted">
          © {year} · Portal anggota organisasi
        </p>
      </div>
    </footer>
  );
}
