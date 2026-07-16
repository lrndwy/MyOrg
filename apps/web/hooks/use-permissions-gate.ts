"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

interface MyPermissionsData {
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

type UseCanResult<T extends string> = { [K in T]: boolean } & {
  isLoading: boolean;
  codes: string[];
};

export function useCan<const T extends string>(...codes: T[]): UseCanResult<T> {
  const { data, isLoading } = useMyPermissions();
  const key = codes.join("|");
  const allowed = useMemo(() => {
    const set = new Set(data?.codes ?? []);
    return Object.fromEntries(codes.map((c) => [c, set.has(c)])) as {
      [K in T]: boolean;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key captures codes
  }, [data?.codes, key]);

  return { ...allowed, isLoading, codes: data?.codes ?? [] };
}
