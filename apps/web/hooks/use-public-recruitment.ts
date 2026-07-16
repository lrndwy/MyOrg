"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type {
  Recruitment,
  RecruitmentCustomField,
  RecruitmentTargetDivision,
} from "@repo/shared/types";

export interface PublicRecruitmentData {
  recruitment: Recruitment;
  fields: RecruitmentCustomField[];
  targets: RecruitmentTargetDivision[];
}

// GET /api/public/recruitment/:slug — unauthenticated. 404s when the
// recruitment doesn't exist or isn't currently "open".
export function usePublicRecruitment(slug: string) {
  return useQuery<PublicRecruitmentData>({
    queryKey: ["public-recruitment", slug],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/public/recruitment/${slug}`);
      return data.data as PublicRecruitmentData;
    },
    enabled: !!slug,
    retry: false,
  });
}

export interface SubmitPublicRecruitmentInput {
  name: string;
  division_interest_id: string;
  contact: string;
  custom_answers: Record<string, unknown>;
}

export function useSubmitPublicRecruitment(slug: string) {
  return useMutation({
    mutationFn: async (input: SubmitPublicRecruitmentInput) => {
      const { data } = await apiClient.post(
        `/api/public/recruitment/${slug}/submit`,
        input
      );
      return data.data;
    },
  });
}
