"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import type { FileRef } from "@repo/shared/types";

export interface UploadFileInput {
  file: Blob | File;
  // Filename to record — required for Blob (e.g. canvas.toBlob() output)
  // since Blob has no .name of its own.
  filename?: string;
  // Comma-separated accept aliases (image, video, pdf, doc, ...) — see
  // apps/api/internal/handlers/upload.go. Defaults to the server's
  // global allowlist when omitted.
  accepts?: string;
  maxSize?: number;
}

// useUploadFile posts to POST /api/uploads (multipart) and returns the
// stored FileRef — used for avatars, attendance selfies/signatures, and
// permission-request proof files. Keeps every upload as an S3/MinIO
// object + URL, never as base64 in a DB column.
export function useUploadFile() {
  return useMutation({
    mutationFn: async ({ file, filename, accepts, maxSize }: UploadFileInput) => {
      const name =
        filename || (file instanceof File ? file.name : `upload-${Date.now()}.png`);
      const form = new FormData();
      form.append("file", file, name);

      const params = new URLSearchParams();
      if (accepts) params.set("accepts", accepts);
      if (maxSize) params.set("max_size", String(maxSize));
      const qs = params.toString();

      const { data } = await apiClient.post(
        `/api/uploads${qs ? `?${qs}` : ""}`,
        form,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data.data as FileRef;
    },
  });
}
