"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Megaphone } from "lucide-react";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  source: string;
  severity: string;
  title: string;
  body: string;
  link: string;
  count: number;
  read_at: string | null;
  created_at: string;
}

interface ListResponse {
  data: Notification[];
  unread: number;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam`;
  return `${Math.floor(h / 24)} hr`;
}

/** In-app notification bell for member web app (announcements, etc.). */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery<ListResponse>({
    queryKey: ["notifications", "web"],
    queryFn: async () => {
      try {
        const { data } = await api.get<ListResponse>("/api/notifications");
        return data;
      } catch {
        return { data: [], unread: 0 };
      }
    },
    refetchInterval: 60_000,
    retry: false,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.post(`/api/notifications/${id}/read`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", "web"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post("/api/notifications/read-all"),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications", "web"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unread = data?.unread || 0;
  const items = data?.data || [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          "Notifikasi" + (unread > 0 ? ` (${unread} belum dibaca)` : "")
        }
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-hover hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-foreground">
              Notifikasi
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
              >
                <Check className="h-3 w-3" />
                Tandai semua
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-text-muted">
                Belum ada notifikasi
              </li>
            )}
            {items.map((n) => {
              const href =
                n.link?.startsWith("http") || n.link?.startsWith("/")
                  ? n.link.startsWith("http")
                    ? n.link
                    : n.link
                  : "/announcements";
              const isAbs = href.startsWith("http");
              const inner = (
                <>
                  <span className="mt-0.5 text-accent">
                    <Megaphone className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        "block truncate text-sm " +
                        (n.read_at
                          ? "text-text-secondary"
                          : "font-medium text-foreground")
                      }
                    >
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-text-muted">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] text-text-muted">
                      {relativeTime(n.created_at)}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={n.id} className="border-b border-border last:border-0">
                  {isAbs ? (
                    <a
                      href={href}
                      role="menuitem"
                      onClick={() => {
                        if (!n.read_at) markRead.mutate(n.id);
                        setOpen(false);
                      }}
                      className="flex gap-2 px-3 py-2.5 hover:bg-bg-hover"
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link
                      href={href}
                      role="menuitem"
                      onClick={() => {
                        if (!n.read_at) markRead.mutate(n.id);
                        setOpen(false);
                      }}
                      className="flex gap-2 px-3 py-2.5 hover:bg-bg-hover"
                    >
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
