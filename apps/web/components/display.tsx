"use client";

import type { ReactNode } from "react";

const EVENT_STATUS: Record<string, string> = {
  upcoming: "bg-info/10 text-info border-info/30",
  ongoing: "bg-success/10 text-success border-success/30",
  finished: "bg-text-muted/10 text-text-muted border-border",
  cancelled: "bg-danger/10 text-danger border-danger/30",
};

const PERMISSION_STATUS: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  approved: "bg-success/10 text-success border-success/30",
  rejected: "bg-danger/10 text-danger border-danger/30",
};

const TARGET_TYPE: Record<string, string> = {
  all: "bg-accent/10 text-accent border-accent/30",
  division: "bg-info/10 text-info border-info/30",
};

function Badge({
  status,
  styles,
  label,
}: {
  status: string;
  styles: Record<string, string>;
  label?: string;
}) {
  const style = styles[status] || "bg-bg-tertiary text-text-secondary border-border";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {label || status || "unknown"}
    </span>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  return <Badge status={status} styles={EVENT_STATUS} />;
}

export function PermissionStatusBadge({ status }: { status: string }) {
  return <Badge status={status} styles={PERMISSION_STATUS} />;
}

export function TargetTypeBadge({ targetType }: { targetType: string }) {
  const label = targetType === "all" ? "Semua" : targetType === "division" ? "Divisi" : targetType;
  return <Badge status={targetType} styles={TARGET_TYPE} label={label} />;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-bg-elevated/60 p-10 text-center text-sm text-text-muted">
      {children}
    </div>
  );
}

export function ErrorState({
  message = "Gagal memuat data.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-8 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium hover:bg-bg-hover"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

export const EVENT_STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "ongoing", label: "Ongoing" },
  { value: "finished", label: "Finished" },
  { value: "cancelled", label: "Cancelled" },
] as const;
