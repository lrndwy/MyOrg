"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { useMe } from "@/hooks/use-auth";
import {
  isPushSupported,
  registerServiceWorker,
  subscribeToPush,
} from "@/lib/push";

const DISMISS_KEY = "myorg_push_banner_dismissed";

/**
 * Registers the PWA service worker and prompts logged-in users to enable
 * push notifications for new announcements.
 */
export function PwaPushPrompt() {
  const { data: user } = useMe();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default"
  );
  const [dismissed, setDismissed] = useState(true);
  const [busy, setBusy] = useState(false);
  const triedAuto = useRef(false);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    void registerServiceWorker();
  }, []);

  // If already granted, silently (re)sync the subscription after login.
  useEffect(() => {
    if (!user || !supported || triedAuto.current) return;
    if (Notification.permission !== "granted") return;
    triedAuto.current = true;
    void subscribeToPush().catch(() => undefined);
  }, [user, supported]);

  if (!user || !supported) return null;
  if (permission === "granted" || permission === "denied") return null;
  if (dismissed) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const sub = await subscribeToPush();
      setPermission(Notification.permission);
      if (sub) setDismissed(true);
    } finally {
      setBusy(false);
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div
      role="status"
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 mx-auto max-w-md rounded-xl border border-border bg-bg-elevated p-3 shadow-lg md:bottom-6 md:left-auto md:right-6"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            Aktifkan notifikasi pengumuman
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Dapatkan pemberitahuan saat ada pengumuman baru, termasuk saat
            aplikasi ditutup.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void enable()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              <Bell className="h-3.5 w-3.5" />
              {busy ? "Mengaktifkan…" : "Aktifkan"}
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-muted hover:bg-bg-hover hover:text-foreground"
            >
              <BellOff className="h-3.5 w-3.5" />
              Nanti
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          onClick={dismiss}
          className="rounded-md p-1 text-text-muted hover:bg-bg-hover hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
