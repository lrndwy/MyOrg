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

export interface UploadRecruitmentFileInput {
  file: File;
  fieldId?: string;
  accepts?: string;
}

export function usePublicRecruitmentUpload(slug: string) {
  return useMutation({
    mutationFn: async ({ file, fieldId, accepts }: UploadRecruitmentFileInput) => {
      const form = new FormData();
      form.append("file", file, file.name);
      const params = new URLSearchParams();
      if (fieldId) params.set("field_id", fieldId);
      if (accepts) params.set("accepts", accepts);
      const qs = params.toString();
      const { data } = await apiClient.post(
        `/api/public/recruitment/${slug}/upload${qs ? `?${qs}` : ""}`,
        form,
      );
      return data.data as { url: string; name: string };
    },
  });
}

function fileAcceptsFromFieldOptions(raw: unknown): string {
  const opts = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(/\r?\n|,/)
      : [];
  const allowed = new Set(["image", "video", "pdf", "doc", "excel", "csv", "zip", "archive", "all"]);
  const parts = opts
    .flatMap((o) => o.split(","))
    .map((s) => s.trim().toLowerCase())
    .filter((s) => allowed.has(s));
  return parts.length > 0 ? parts.join(",") : "image,pdf,doc";
}

export { fileAcceptsFromFieldOptions };
