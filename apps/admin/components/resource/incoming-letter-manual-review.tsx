"use client";

import { useCallback, useMemo } from "react";
import { Copy, ExternalLink } from "@/lib/icons";
import type { FileRef } from "@repo/shared/schemas";

export type IncomingPreviewKind = "pdf" | "image" | "docx" | "other";

export interface IncomingLetterManualReviewProps {
  document: FileRef;
  extractedText: string;
  letterCode: string;
  onLetterCodeChange: (value: string) => void;
}

export function incomingPreviewKind(ref: FileRef): IncomingPreviewKind {
  const mime = (ref.mime || "").toLowerCase();
  const name = (ref.name || "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/.test(name)) {
    return "image";
  }
  if (name.endsWith(".docx") || mime.includes("wordprocessingml")) return "docx";
  return "other";
}

export function IncomingLetterManualReview({
  document,
  extractedText,
  letterCode,
  onLetterCodeChange,
}: IncomingLetterManualReviewProps) {
  const kind = useMemo(() => incomingPreviewKind(document), [document]);

  const copyText = useCallback(async () => {
    if (!extractedText.trim()) return;
    try {
      await navigator.clipboard.writeText(extractedText);
    } catch {
      /* fallback: user can still select from textarea */
    }
  }, [extractedText]);

  return (
    <div className="space-y-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
      <div>
        <p className="text-sm font-medium text-foreground">
          Nomor surat tidak terdeteksi otomatis
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Pratinjau file di bawah, salin teks hasil scan jika perlu, lalu isi nomor surat secara
          manual.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Pratinjau file
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-bg-tertiary">
            {kind === "pdf" && (
              <iframe
                title="Pratinjau PDF"
                src={document.url}
                className="h-[min(420px,50vh)] w-full bg-white"
              />
            )}
            {kind === "image" && (
              <div className="flex max-h-[min(420px,50vh)] items-center justify-center overflow-auto p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={document.url}
                  alt={document.name}
                  className="max-h-[min(400px,48vh)] max-w-full object-contain"
                />
              </div>
            )}
            {(kind === "docx" || kind === "other") && (
              <div className="space-y-3 p-4 text-sm text-text-secondary">
                <p>
                  Pratinjau inline tidak tersedia untuk format ini. Buka file di tab baru untuk
                  melihat isinya.
                </p>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-accent hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Buka {document.name}
                </a>
              </div>
            )}
          </div>
          {(kind === "pdf" || kind === "image") && (
            <a
              href={document.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka di tab baru
            </a>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Teks hasil scan (bisa disalin)
            </p>
            {extractedText.trim() && (
              <button
                type="button"
                onClick={() => void copyText()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-bg-hover"
              >
                <Copy className="h-3.5 w-3.5" />
                Salin
              </button>
            )}
          </div>
          <textarea
            readOnly
            value={extractedText.trim() || "Teks belum terbaca dari file. Lihat pratinjau file di sebelah kiri."}
            rows={14}
            className="w-full resize-y select-text rounded-lg border border-border bg-bg-primary px-3 py-2 font-mono text-xs leading-relaxed text-foreground"
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
          Nomor Surat *
        </label>
        <input
          value={letterCode}
          onChange={(e) => onLetterCodeChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 font-mono text-sm"
          placeholder="Contoh: 045/HMKO/PLTI/XII/2024"
          autoComplete="off"
        />
        <p className="mt-1.5 text-xs text-text-muted">
          Salin bagian nomor dari teks scan di atas, lalu tempel atau ketik di sini.
        </p>
      </div>
    </div>
  );
}
