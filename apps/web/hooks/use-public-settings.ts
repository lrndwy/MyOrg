"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";

// GET /api/settings is unauthenticated — a branding subset of
// OrganizationSetting for pre-login surfaces (login, register).
export interface PublicSettings {
  web_name: string;
  logo_url: string;
  icon_url: string;
  theme: string;
  allow_self_register: boolean;
}

export function usePublicSettings() {
  return useQuery<PublicSettings>({
    queryKey: ["public-settings"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/settings");
      return data.data as PublicSettings;
    },
    staleTime: 5 * 60 * 1000,
  });
}
