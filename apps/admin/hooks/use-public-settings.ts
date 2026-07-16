"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/** Branding subset from GET /api/settings (public, unauthenticated). */
export interface PublicSettings {
  web_name: string;
  logo_url: string;
  icon_url: string;
  theme: string;
  allow_self_register: boolean;
}

export const PUBLIC_SETTINGS_QUERY_KEY = ["public-settings"] as const;

export function usePublicSettings() {
  return useQuery<PublicSettings>({
    queryKey: PUBLIC_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get("/api/settings");
      return data.data as PublicSettings;
    },
    staleTime: 5 * 60 * 1000,
  });
}
