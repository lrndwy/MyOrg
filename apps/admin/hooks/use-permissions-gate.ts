"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface MyPermissionsData {
  codes: string[];
  is_grit_admin: boolean;
}

export function useMyPermissions() {
  return useQuery({
    queryKey: ["me", "permissions"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MyPermissionsData }>(
        "/api/me/permissions"
      );
      return data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function hasPermission(
  data: MyPermissionsData | undefined,
  code: string | undefined
): boolean {
  if (!code) return true;
  if (!data) return false;
  if (data.is_grit_admin) return true;
  return data.codes.includes(code);
}

/** True when the user has at least one of the given permission codes. */
export function hasAnyPermission(
  data: MyPermissionsData | undefined,
  codes: string[]
): boolean {
  if (!data) return false;
  if (data.is_grit_admin) return true;
  const set = new Set(data.codes);
  return codes.some((c) => set.has(c));
}

const FINANCE_WRITE_ALIASES = {
  create: ["finance.create", "finance.manage"],
  edit: ["finance.edit", "finance.manage"],
  delete: ["finance.delete", "finance.manage"],
  categories: ["finance.categories", "finance.manage"],
} as const;

export function canFinanceCreate(data: MyPermissionsData | undefined): boolean {
  return hasAnyPermission(data, [...FINANCE_WRITE_ALIASES.create]);
}

export function canFinanceEdit(data: MyPermissionsData | undefined): boolean {
  return hasAnyPermission(data, [...FINANCE_WRITE_ALIASES.edit]);
}

export function canFinanceDelete(data: MyPermissionsData | undefined): boolean {
  return hasAnyPermission(data, [...FINANCE_WRITE_ALIASES.delete]);
}

export function canFinanceCategories(data: MyPermissionsData | undefined): boolean {
  return hasAnyPermission(data, [...FINANCE_WRITE_ALIASES.categories]);
}

export function canViewResource(
  data: MyPermissionsData | undefined,
  resource: { viewPermission?: string; viewPermissions?: string[] }
): boolean {
  const codes = [
    ...(resource.viewPermissions ?? []),
    ...(resource.viewPermission ? [resource.viewPermission] : []),
  ];
  if (codes.length === 0) return true;
  return hasAnyPermission(data, codes);
}

type UseCanResult<T extends string> = { [K in T]: boolean } & {
  isLoading: boolean;
  codes: string[];
  isGritAdmin: boolean;
};

export function useCan<const T extends string>(...codes: T[]): UseCanResult<T> {
  const { data, isLoading } = useMyPermissions();
  const key = codes.join("|");
  const allowed = useMemo(() => {
    const set = new Set(data?.codes ?? []);
    const isGritAdmin = data?.is_grit_admin ?? false;
    return Object.fromEntries(
      codes.map((c) => [c, isGritAdmin || set.has(c)])
    ) as { [K in T]: boolean };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures codes
  }, [data?.codes, data?.is_grit_admin, key]);

  return {
    ...allowed,
    isLoading,
    codes: data?.codes ?? [],
    isGritAdmin: data?.is_grit_admin ?? false,
  };
}
