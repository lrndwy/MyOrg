/** Shared table cell helpers for admin resource definitions (no JSX). */

export function eventTitle(row: Record<string, unknown>): string {
  const event = row.event as { title?: string } | null | undefined;
  return event?.title?.trim() || "—";
}

export function announcementTitle(row: Record<string, unknown>): string {
  const a = row.announcement as { title?: string } | null | undefined;
  return a?.title?.trim() || "—";
}

export function recruitmentTitle(row: Record<string, unknown>): string {
  const r = row.recruitment as { title?: string } | null | undefined;
  return r?.title?.trim() || "—";
}

export function divisionName(
  row: Record<string, unknown>,
  key = "division"
): string {
  const d = row[key] as { name?: string } | null | undefined;
  return d?.name?.trim() || "—";
}

export function categoryName(row: Record<string, unknown>): string {
  const c = row.category as { name?: string } | null | undefined;
  return c?.name?.trim() || "—";
}

type UserLike = {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string;
} | null | undefined;

export function userLabelFrom(user: UserLike): string {
  if (!user) return "—";
  const full =
    user.full_name?.trim() ||
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return full || user.username?.trim() || user.email?.trim() || "—";
}

export function userLabel(
  row: Record<string, unknown>,
  key = "user"
): string {
  return userLabelFrom(row[key] as UserLike);
}

export function relatedName(
  row: Record<string, unknown>,
  key: string
): string {
  const rel = row[key] as { name?: string; title?: string } | null | undefined;
  return rel?.name?.trim() || rel?.title?.trim() || "—";
}

export function roleName(row: Record<string, unknown>, key = "role"): string {
  return relatedName(row, key);
}

export function permissionCode(row: Record<string, unknown>, key = "permission"): string {
  const p = row[key] as { code?: string } | null | undefined;
  return p?.code?.trim() || "—";
}

export function permissionField(
  row: Record<string, unknown>,
  field: "module" | "description",
  key = "permission"
): string {
  const p = row[key] as Record<string, string> | null | undefined;
  const val = p?.[field]?.trim();
  return val || "—";
}

export function jsonPreview(value: unknown, max = 80): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return "—";
    try {
      const parsed = JSON.parse(t);
      const s = JSON.stringify(parsed);
      return s.length > max ? s.slice(0, max) + "…" : s;
    } catch {
      return t.length > max ? t.slice(0, max) + "…" : t;
    }
  }
  try {
    const s = JSON.stringify(value);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return "—";
  }
}
