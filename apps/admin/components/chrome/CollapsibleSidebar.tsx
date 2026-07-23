"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { resources } from "@/resources";
import { brand } from "@repo/shared/brand";
import { useLogout } from "@/hooks/use-auth";
import { usePublicSettings } from "@/hooks/use-public-settings";
import {
  getIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Activity,
  Bell,
  Settings,
  TrendingUp,
  Shield,
  User as UserIcon,
  LogOut,
  Globe,
  ExternalLink,
  CreditCard,
  Database,
  FolderOpen,
} from "@/lib/icons";
import type { User } from "@repo/shared/types";
import { getWebAppUrl } from "@/lib/panel-access";
import { canViewResource, hasPermission, useMyPermissions } from "@/hooks/use-permissions-gate";

// GRIT_CLI_VERSION is the scaffold version that generated this file.
// Surfaced in the sidebar footer so the user can quickly see what Grit
// release their dashboard was built from. Update by re-scaffolding or
// hand-bumping if you carry framework patches locally.
const GRIT_CLI_VERSION = "v3.60.0";

// Internal nav block — pages that exist for every Grit app regardless of
// which resources were generated. Kept out of the resources registry so
// developers don't accidentally remove them when editing resources.ts.
const INTERNAL_NAV = [
  { href: "/system/activity",      label: "Activity",      iconKey: "Activity",       adminOnly: false },
  { href: "/system/notifications", label: "Notifications", iconKey: "Bell",           adminOnly: false },
] as const;

// MyOrg singleton / workflow pages (not grit resource CRUD lists).
const MYORG_NAV = [
  { href: "/myorg/finance",        label: "Keuangan",              iconKey: "CreditCard", adminOnly: true, permission: "finance.view" },
  { href: "/myorg/settings",     label: "Org Settings",          iconKey: "Settings", adminOnly: true, permission: "settings.manage" },
  { href: "/myorg/permissions",  label: "Permission Approvals",  iconKey: "Shield",   adminOnly: true, permission: "attendance.approve" },
] as const;

// v3.31.5: dedicated SYSTEM section for admin-only operational surfaces.
// Health / Performance / Security live here so they're one click away
// during an incident — the System hub at /system still aggregates every
// surface for the broader browse case.
const SYSTEM_NAV = [
  { href: "/settings/dashboard", label: "Dashboard settings", iconKey: "Settings",    adminOnly: false },
  { href: "/system/backups",     label: "Data & Backup",      iconKey: "Database",     adminOnly: true },
  { href: "/system/files",       label: "Penyimpanan Cloud",  iconKey: "FolderOpen",   adminOnly: true, permission: "storage.manage" },
  { href: "/system/health",       label: "System Health", iconKey: "ActivityIcon", adminOnly: true },
  { href: "/system/performance",  label: "Performance",   iconKey: "TrendingUp",   adminOnly: true },
  { href: "/system/security",     label: "Security",      iconKey: "Shield",       adminOnly: true },
  { href: "/system",              label: "System Hub",    iconKey: "Settings",     adminOnly: true },
] as const;

const INTERNAL_ICON: Record<string, React.ReactNode> = {
  Activity: <Activity className="h-5 w-5" />,
  ActivityIcon: <Activity className="h-5 w-5" />,
  Bell: <Bell className="h-5 w-5" />,
  Settings: <Settings className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  Shield: <Shield className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Database: <Database className="h-5 w-5" />,
  FolderOpen: <FolderOpen className="h-5 w-5" />,
};

function inferResourceGroup(slug: string): string | null {
  // Resources in `apps/admin/resources/*` don't currently declare `group`,
  // so infer a stable grouping here to keep the sidebar tidy.
  const KEANGGOTAAN = new Set([
    "users",
    "divisions",
    "roles",
    "permissions",
    "role-permissions",
  ]);
  const KEGIATAN = new Set([
    "events",
    "attendances",
    "violations",
  ]);
  const AKSES_IZIN = new Set(["permission-requests"]);
  const REKRUTMEN = new Set([
    "recruitments",
    "recruitment-target-divisions",
    "recruitment-custom-fields",
    "recruitment-submissions",
  ]);
  const SURAT = new Set([
    "letter-categories",
    "letters",
    "letter-templates",
  ]);
  const PENGUMUMAN = new Set(["announcements"]);
  const KEUANGAN = new Set(["finance-categories", "finance-transactions"]);

  if (KEANGGOTAAN.has(slug)) return "Keanggotaan";
  if (KEGIATAN.has(slug)) return "Kegiatan";
  if (AKSES_IZIN.has(slug)) return "Akses & Izin";
  if (REKRUTMEN.has(slug)) return "Rekrutmen";
  if (SURAT.has(slug)) return "Surat";
  if (PENGUMUMAN.has(slug)) return "Pengumuman";
  if (KEUANGAN.has(slug)) return "Keuangan";
  return null;
}

interface SidebarProps {
  user: User;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/**
 * Collapsible left sidebar. Three vertical zones:
 *
 *   ┌──────────────────────┐
 *   │  [logo]      [<]     │  ← brand + collapse chevron (fixed)
 *   ├──────────────────────┤
 *   │  > Dashboard         │
 *   │  > Resource A        │  ← scrollable nav (overflow-y-auto)
 *   │  > Internal section  │
 *   │  ...                 │
 *   ├──────────────────────┤
 *   │  [avatar] Name +     │  ← rich user menu + version (sticky bottom)
 *   │           email      │
 *   └──────────────────────┘
 */
export function CollapsibleSidebar({
  user,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const { data: permissionsData } = useMyPermissions();
  const { data: orgSettings } = usePublicSettings();
  const webPortalUrl = `${getWebAppUrl()}/dashboard`;

  // Prefer Org Settings (runtime); fall back to static brand.config.
  const brandName = orgSettings?.web_name?.trim() || brand.name;
  const logoUrl = orgSettings?.logo_url?.trim() || "";
  const iconUrl = orgSettings?.icon_url?.trim() || "";
  const brandLetter =
    brandName.charAt(0).toUpperCase() || brand.logo.text;

  const isAdmin = user.role === "ADMIN" || user.role === "EDITOR";
  const canSeePermission = (code: string | undefined) =>
    hasPermission(permissionsData, code);
  const canSeeResource = (resource: (typeof resources)[number]) =>
    canViewResource(permissionsData, resource);
  const isGroupExpanded = (key: string) => expandedGroups[key] !== false;
  const toggle = (key: string) =>
    setExpandedGroups((p) => ({ ...p, [key]: !(p[key] ?? true) }));

  const visibleResources = resources.filter((r) => {
    if (r.adminOnly && !isAdmin) return false;
    if (!canSeeResource(r)) return false;
    return true;
  });
  // Keep sidebar ordering stable and predictable on the dashboard:
  // sort by displayed plural label (fallback to resource name).
  const visibleResourcesSorted = [...visibleResources].sort((a, b) => {
    const aLabel = String(a.label?.plural ?? a.name ?? "");
    const bLabel = String(b.label?.plural ?? b.name ?? "");
    return aLabel.localeCompare(bLabel);
  });
  const visibleMyOrg = MYORG_NAV.filter(
    (r) => (!r.adminOnly || isAdmin) && canSeePermission(r.permission)
  );
  const visibleInternal = INTERNAL_NAV.filter((r) => !r.adminOnly || isAdmin);
  const visibleSystem = SYSTEM_NAV.filter((r) => !r.adminOnly || isAdmin);

  const groups: Record<string, typeof resources> = { _root: [] };
  for (const r of visibleResourcesSorted) {
    const key = r.group ?? inferResourceGroup(r.slug) ?? "_root";
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={
          "fixed top-0 left-0 z-40 flex h-screen flex-col border-r border-border bg-bg-secondary transition-all duration-200 " +
          (collapsed ? "w-16 " : "w-64 ") +
          (mobileOpen ? "translate-x-0 " : "-translate-x-full md:translate-x-0 ")
        }
      >
        {/* Brand row — fixed at top */}
        <div className="relative flex h-16 items-center border-b border-border px-3 shrink-0">
          <Link href="/dashboard" className="flex flex-1 items-center gap-2 overflow-hidden">
            <BrandMark
              collapsed={collapsed}
              name={brandName}
              logoUrl={logoUrl}
              iconUrl={iconUrl}
              letter={brandLetter}
            />
            {!collapsed && (
              <span className="truncate text-base font-bold text-foreground">
                {brandName}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-elevated text-text-secondary shadow-sm hover:text-foreground md:flex"
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Nav — scrollable middle zone. flex-1 + min-h-0 makes it scroll
            instead of pushing the footer off-screen when there are many
            items. Custom scrollbar styles keep the rail subtle. */}
        <nav className="flex-1 min-h-0 space-y-1 overflow-y-auto px-2 py-3 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
          <SidebarLink
            href="/dashboard"
            icon={<LayoutDashboard className="h-5 w-5" />}
            label="Dashboard"
            active={pathname === "/dashboard"}
            collapsed={collapsed}
            onClick={onMobileClose}
          />
          <a
            href={webPortalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onMobileClose}
            aria-label={collapsed ? "Portal Web" : undefined}
            title={collapsed ? "Portal Web" : undefined}
            className={
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
              "text-text-secondary hover:bg-bg-hover hover:text-foreground " +
              (collapsed ? "justify-center" : "")
            }
          >
            <Globe className="h-5 w-5 shrink-0" />
            {!collapsed && (
              <span className="flex flex-1 items-center justify-between gap-2 truncate">
                Portal Web
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-text-muted" />
              </span>
            )}
          </a>
          {groups._root.length > 0 && !collapsed && (
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
              Resources
            </p>
          )}
          {groups._root.map((r) => {
            const Icon = getIcon(r.icon);
            return (
              <SidebarLink
                key={r.slug}
                href={"/resources/" + r.slug}
                icon={<Icon className="h-5 w-5" />}
                label={r.label?.plural ?? r.name}
                active={pathname.startsWith("/resources/" + r.slug)}
                collapsed={collapsed}
                onClick={onMobileClose}
              />
            );
          })}

          {Object.entries(groups)
            .filter(([k]) => k !== "_root")
            .map(([groupName, items]) => (
              <div key={groupName} className="pt-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggle(groupName)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary"
                  >
                    <span>{groupName}</span>
                    <ChevronDown
                      className={
                        "h-3.5 w-3.5 transition-transform " +
                        (isGroupExpanded(groupName) ? "rotate-0" : "-rotate-90")
                      }
                    />
                  </button>
                )}
                {(collapsed || isGroupExpanded(groupName)) && items.map((r) => {
                  const Icon = getIcon(r.icon);
                  return (
                    <SidebarLink
                      key={r.slug}
                      href={"/resources/" + r.slug}
                      icon={<Icon className="h-5 w-5" />}
                      label={r.label?.plural ?? r.name}
                      active={pathname.startsWith("/resources/" + r.slug)}
                      collapsed={collapsed}
                      onClick={onMobileClose}
                    />
                  );
                })}
              </div>
            ))}

          {/* MyOrg — singleton settings & workflow pages */}
          {visibleMyOrg.length > 0 && (
            <div className="pt-3">
              {!collapsed && (
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  MyOrg
                </p>
              )}
              {visibleMyOrg.map((r) => (
                <SidebarLink
                  key={r.href}
                  href={r.href}
                  icon={INTERNAL_ICON[r.iconKey]}
                  label={r.label}
                  active={pathname.startsWith(r.href)}
                  collapsed={collapsed}
                  onClick={onMobileClose}
                />
              ))}
            </div>
          )}

          {/* Internal section — Activity / Notifications. */}
          <div className="pt-3">
            {!collapsed && (
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                Internal
              </p>
            )}
            {visibleInternal.map((r) => (
              <SidebarLink
                key={r.href}
                href={r.href}
                icon={INTERNAL_ICON[r.iconKey]}
                label={r.label}
                active={pathname.startsWith(r.href)}
                collapsed={collapsed}
                onClick={onMobileClose}
              />
            ))}
          </div>

          {/* System section — admin-only operational surfaces (Health,
              Performance, Security, hub). Active-state uses the full path
              so /system/security highlights without /system also lighting up. */}
          {visibleSystem.length > 0 && (
            <div className="pt-3">
              {!collapsed && (
                <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  System
                </p>
              )}
              {visibleSystem.map((r) => (
                <SidebarLink
                  key={r.href}
                  href={r.href}
                  icon={INTERNAL_ICON[r.iconKey]}
                  label={r.label}
                  active={r.href === "/system" ? pathname === "/system" : pathname.startsWith(r.href)}
                  collapsed={collapsed}
                  onClick={onMobileClose}
                />
              ))}
            </div>
          )}
        </nav>

        {/* Footer — sticky bottom: rich user menu + grit version */}
        <SidebarUserMenu user={user} collapsed={collapsed} />
      </aside>
    </>
  );
}

// SidebarUserMenu — sits at the bottom of the sidebar. Click to pop a
// menu with profile / billing / activity / logout. When collapsed shows
// just the avatar + indicator dot. Mirrors the top-right UserMenu but
// renders with the user's name/email visible inline.
function SidebarUserMenu({ user, collapsed }: { user: User; collapsed: boolean }) {
  const { mutate: logout } = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const webPortalUrl = `${getWebAppUrl()}/dashboard`;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initials = ((user.first_name?.[0] || "") + (user.last_name?.[0] || "")).toUpperCase() || "U";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "User";

  return (
    <div ref={ref} className="relative border-t border-border shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open account menu"
        className={
          "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-bg-hover " +
          (collapsed ? "justify-center" : "")
        }
      >
        <span
          className={
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden ring-2 ring-accent/30 bg-bg-elevated text-sm font-semibold text-foreground"
          }
        >
          {user.avatar ? (
            <img src={user.avatar} alt={fullName} className="h-full w-full object-cover" />
          ) : initials}
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">{fullName}</span>
            <span className="block truncate text-xs text-text-muted">{user.email}</span>
          </span>
        )}
        {!collapsed && (
          <ChevronDown className={"h-3.5 w-3.5 text-text-muted transition-transform " + (open ? "rotate-180" : "")} />
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-2 overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-xl">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground truncate">{fullName}</p>
            <p className="text-xs text-text-muted truncate">{user.email}</p>
          </div>
          <nav className="py-1 text-sm">
            <a
              href={webPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:bg-bg-hover hover:text-foreground"
            >
              <Globe className="h-4 w-4" />
              <span className="flex flex-1 items-center justify-between gap-2">
                Portal Web
                <ExternalLink className="h-3.5 w-3.5 text-text-muted" />
              </span>
            </a>
            <Link
              href="/system/activity"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:bg-bg-hover hover:text-foreground"
            >
              <Activity className="h-4 w-4" />
              User Activity
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:bg-bg-hover hover:text-foreground"
            >
              <UserIcon className="h-4 w-4" />
              Profile
            </Link>
            <button
              type="button"
              onClick={() => { setOpen(false); logout(); }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-text-secondary hover:bg-bg-hover hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </nav>
          {!collapsed && (
            <div className="border-t border-border px-4 py-2 text-center">
              <p className="text-[10px] uppercase tracking-wide text-text-muted">Grit {GRIT_CLI_VERSION}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BrandMark({
  collapsed,
  name,
  logoUrl,
  iconUrl,
  letter,
}: {
  collapsed: boolean;
  name: string;
  logoUrl: string;
  iconUrl: string;
  letter: string;
}) {
  // Collapsed rail prefers the square icon; expanded prefers the full logo.
  const staticFallback = collapsed
    ? brand.logo.mark || brand.logo.image
    : brand.logo.image || brand.logo.mark;
  const src = collapsed
    ? iconUrl || logoUrl || staticFallback
    : logoUrl || iconUrl || staticFallback;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={
          collapsed
            ? "h-8 w-8 shrink-0 rounded-lg object-cover"
            : "h-8 w-8 shrink-0 rounded-lg object-cover"
        }
      />
    );
  }

  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
      {letter}
    </span>
  );
}

interface LinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  collapsed: boolean;
  onClick?: () => void;
}

function SidebarLink({ href, icon, label, active, collapsed, onClick }: LinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={
        "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors " +
        (active
          ? "bg-accent/10 text-accent"
          : "text-text-secondary hover:bg-bg-hover hover:text-foreground")
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}
