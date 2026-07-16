"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  LogOut,
  User as UserIcon,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import { canAccessAdminPanel } from "@repo/shared/constants";
import { useIsAuthenticated } from "@/lib/auth";
import { useLogout, useMe } from "@/hooks/use-auth";
import { usePublicSettings } from "@/hooks/use-public-settings";

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001";

const authLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/events", label: "Events" },
  { href: "/announcements", label: "Pengumuman" },
  { href: "/my-permissions", label: "Izin Saya" },
];

function linkActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const mobileMoreRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const isAuthenticated = useIsAuthenticated();
  const { data: user } = useMe();
  const { data: settings } = usePublicSettings();
  const { mutate: logout, isPending: loggingOut } = useLogout();
  const showAdminLink = canAccessAdminPanel(user?.role);
  const brand = settings?.web_name || "MyOrg";
  const logo = settings?.logo_url || settings?.icon_url;
  const displayName = user?.full_name || user?.username || user?.email || "";
  const initials = (displayName || brand)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  useEffect(() => {
    setUserMenuOpen(false);
    setMobileMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!userMenuOpen && !mobileMoreOpen) return;
    const onPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (userMenuOpen && !userMenuRef.current?.contains(t)) {
        setUserMenuOpen(false);
      }
      if (mobileMoreOpen && !mobileMoreRef.current?.contains(t)) {
        setMobileMoreOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMobileMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen, mobileMoreOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link
          href={user || isAuthenticated ? "/dashboard" : "/login"}
          className="flex min-w-0 items-center gap-2.5"
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={brand}
              className="h-8 w-8 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10">
              <span className="text-sm font-bold text-accent">
                {brand.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <span className="truncate text-base font-semibold tracking-tight">
            {brand}
          </span>
        </Link>

        {/* Desktop primary nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Utama">
          {(user || isAuthenticated ? authLinks : [{ href: "/login", label: "Login" }]).map(
            (link) => {
              const active = linkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-bg-tertiary font-medium text-foreground"
                      : "text-text-secondary hover:bg-bg-hover hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            }
          )}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          {showAdminLink && (
            <a
              href={ADMIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-foreground"
            >
              <Shield className="h-3.5 w-3.5" />
              Admin
            </a>
          )}

          {user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated py-1 pl-1 pr-2.5 text-sm transition-colors hover:bg-bg-hover"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/10 text-xs font-semibold text-accent">
                  {initials || "U"}
                </span>
                <span className="max-w-[7.5rem] truncate font-medium text-foreground">
                  {displayName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-bg-elevated py-1 shadow-lg"
                >
                  <Link
                    href="/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground"
                  >
                    <UserIcon className="h-4 w-4" />
                    Profil
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {loggingOut ? "Keluar…" : "Logout"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Login
            </Link>
          )}
        </div>

        {/* Mobile: overflow for Admin / Logout (primary tabs live in bottom nav) */}
        <div className="relative md:hidden" ref={mobileMoreRef}>
          {user ? (
            <>
              <button
                type="button"
                onClick={() => setMobileMoreOpen((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-foreground"
                aria-label="Menu lainnya"
                aria-expanded={mobileMoreOpen}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {mobileMoreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-bg-elevated py-1 shadow-lg"
                >
                  {showAdminLink && (
                    <a
                      href={ADMIN_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      role="menuitem"
                      onClick={() => setMobileMoreOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground"
                    >
                      <Shield className="h-4 w-4" />
                      Admin Panel
                    </a>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMobileMoreOpen(false);
                      logout();
                    }}
                    disabled={loggingOut}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-foreground disabled:opacity-50"
                  >
                    <LogOut className="h-4 w-4" />
                    {loggingOut ? "Keluar…" : "Logout"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
