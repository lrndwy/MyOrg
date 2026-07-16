"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Megaphone,
  ClipboardList,
  User,
} from "lucide-react";
import { useMe } from "@/hooks/use-auth";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/events", label: "Events", icon: Calendar },
  { href: "/announcements", label: "Info", icon: Megaphone },
  { href: "/my-permissions", label: "Izin", icon: ClipboardList },
  { href: "/profile", label: "Profil", icon: User },
] as const;

function tabActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Fixed bottom tab bar for authenticated users on small screens.
 * Hidden from md breakpoint up (desktop keeps the top nav).
 */
export function MobileBottomNav() {
  const pathname = usePathname() ?? "";
  const { data: user, isLoading } = useMe();

  if (isLoading || !user) return null;

  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex h-14 max-w-lg items-stretch justify-between px-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = tabActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex h-full flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors ${
                  active
                    ? "text-accent"
                    : "text-text-muted hover:text-foreground"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className={`h-5 w-5 ${active ? "stroke-[2.25]" : ""}`}
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
