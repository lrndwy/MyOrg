"use client";

import Link from "next/link";
import { PageHeader } from "@/components/chrome/PageHeader";
import {
  Activity, Bell, Calendar, Database, FileText, Mail,
  Shield, TrendingUp, Upload, Link as LinkIcon,
} from "@/lib/icons";

interface SystemTile {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const TILES: SystemTile[] = [
  { href: "/system/health",        title: "System Health",    description: "Real-time infrastructure status — Postgres, Redis, API, jobs, email.",      icon: <Activity className="h-5 w-5" /> },
  { href: "/system/performance",   title: "Performance",      description: "Four Google SRE golden signals — latency, traffic, errors, saturation.",   icon: <TrendingUp className="h-5 w-5" /> },
  { href: "/system/security",      title: "Security",         description: "Sentinel summary — banned IPs, rate-limit pressure, recent threats.",      icon: <Shield className="h-5 w-5" /> },
  { href: "/system/jobs",          title: "Background Jobs",  description: "Queue depth, in-flight workers, dead-letter queue.",                       icon: <Database className="h-5 w-5" /> },
  { href: "/system/backups",       title: "Data & Backup",    description: "Backup & restore database (ZIP). Jadwal otomatis, download, upload restore.", icon: <Database className="h-5 w-5" /> },
  { href: "/system/files",         title: "File Storage",     description: "Browse uploads, manage retention, audit usage.",                            icon: <Upload className="h-5 w-5" /> },
  { href: "/system/cron",          title: "Cron Schedules",   description: "Recurring jobs, next-run times, run history.",                              icon: <Calendar className="h-5 w-5" /> },
  { href: "/system/mail",          title: "Mail Preview",     description: "Email template gallery + recent send log.",                                 icon: <Mail className="h-5 w-5" /> },
  { href: "/system/observability", title: "Observability",    description: "Pulse summary — latency, SLOs, top N+1, runtime.",                          icon: <TrendingUp className="h-5 w-5" /> },
  { href: "/system/activity",      title: "User Activity",    description: "Auth events, writes, operator actions with IP + severity.",                 icon: <Activity className="h-5 w-5" /> },
  { href: "/system/notifications", title: "Notifications",    description: "Recent system + Sentinel + Pulse notifications.",                           icon: <Bell className="h-5 w-5" /> },
  // v3.31.41 — public form sharing (FormShare table). Page existed
  // since v3.31.20 but wasn't linked from the Hub.
  { href: "/system/form-shares",   title: "Public form sharing", description: "Token-gated public submission links. Generate, enable/disable, view submissions.", icon: <LinkIcon className="h-5 w-5" /> },
];

export default function SystemHubPage() {
  return (
    <div>
      <PageHeader
        title="System"
        subtitle="Every operational surface for this app. Pick a tile to dive in."
      />

      <p className="mb-4 rounded-lg border border-border bg-bg-elevated px-4 py-3 text-sm text-text-secondary">
        Master data + observability span these surfaces. Each tile opens its dedicated screen.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TILES.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="group rounded-xl border border-border bg-bg-elevated p-5 transition-colors hover:bg-bg-hover hover:border-accent/30"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              {t.icon}
            </div>
            <p className="text-base font-semibold text-foreground group-hover:text-accent">{t.title}</p>
            <p className="mt-1 text-sm text-text-secondary">{t.description}</p>
          </Link>
        ))}
      </div>

      <FileText className="hidden" />
    </div>
  );
}
