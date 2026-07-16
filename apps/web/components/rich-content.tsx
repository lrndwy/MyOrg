"use client";

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/** Lightweight sanitizer for trusted-admin richtext (no script/handlers). */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(iframe|object|embed|link|meta)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript:/gi, "");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

interface RichContentProps {
  html: string | null | undefined;
  className?: string;
  /** Compact typography for cards / list previews. */
  compact?: boolean;
}

export function RichContent({ html, className = "", compact = false }: RichContentProps) {
  const value = html?.trim() || "";
  if (!value) return null;

  if (!looksLikeHtml(value)) {
    return (
      <p
        className={`whitespace-pre-line text-sm leading-relaxed text-text-secondary ${className}`.trim()}
      >
        {value}
      </p>
    );
  }

  return (
    <div
      className={`${compact ? "prose-announcement" : "prose-blog"} ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
    />
  );
}
