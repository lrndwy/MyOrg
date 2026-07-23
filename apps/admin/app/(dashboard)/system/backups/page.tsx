"use client";

import { useEffect, useRef, useState } from "react";
import {
  useBackups,
  useGenerateBackup,
  useDownloadBackup,
  useExportBackup,
  useRestoreBackupUpload,
  useRestoreBackupById,
  useBackupSchedule,
  useUpdateBackupSchedule,
  type Backup,
  type BackupFrequency,
} from "@/hooks/use-backups";
import {
  Database,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Save,
  Upload,
  RefreshCw as RestoreIcon,
} from "@/lib/icons";

const FREQUENCIES: { key: BackupFrequency; label: string; hint: string }[] = [
  { key: "daily", label: "Daily", hint: "every day" },
  { key: "weekly", label: "Weekly", hint: "every Sunday" },
  { key: "monthly", label: "Monthly", hint: "1st of month" },
  { key: "yearly", label: "Yearly", hint: "Jan 1" },
];

function ScheduleCard() {
  const { data: schedule, isLoading } = useBackupSchedule();
  const update = useUpdateBackupSchedule();
  const [freq, setFreq] = useState<BackupFrequency>("weekly");
  const [time, setTime] = useState("02:00");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (schedule) {
      setFreq(schedule.frequency);
      setTime(schedule.time);
      setEnabled(schedule.enabled);
    }
  }, [schedule]);

  const dirty =
    schedule &&
    (schedule.frequency !== freq || schedule.time !== time || schedule.enabled !== enabled);

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Clock className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-foreground">Backup otomatis</h3>
            <p className="text-sm text-text-secondary">
              Snapshot database penuh sesuai jadwal. Default: mingguan.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          role="switch"
          aria-checked={enabled}
          className={
            "relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
            (enabled ? "bg-accent" : "bg-text-muted/40")
          }
        >
          <span
            className={
              "inline-block h-4 w-4 rounded-full bg-white transition-transform " +
              (enabled ? "translate-x-6" : "translate-x-1")
            }
          />
        </button>
      </div>

      <div className={"mt-4 transition-opacity " + (enabled ? "" : "pointer-events-none opacity-50")}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Frekuensi</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <button
              key={f.key}
              onClick={() => setFreq(f.key)}
              className={
                "rounded-lg border px-3 py-2.5 text-center transition-colors " +
                (freq === f.key
                  ? "border-accent bg-accent/5 text-accent"
                  : "border-border text-text-secondary hover:bg-bg-hover")
              }
            >
              <div className="text-sm font-medium text-foreground">{f.label}</div>
              <div className="text-xs text-text-muted">{f.hint}</div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Waktu
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
            />
          </div>
          <span className="pb-2 text-xs text-text-muted">waktu server</span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {update.isSuccess && !dirty ? <span className="text-xs text-success">Tersimpan</span> : null}
        <button
          onClick={() => update.mutate({ frequency: freq, time, enabled })}
          disabled={isLoading || update.isPending || !dirty}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{" "}
          Simpan jadwal
        </button>
      </div>
    </div>
  );
}

function RestoreCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const restoreUpload = useRestoreBackupUpload();
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 text-danger">
          <RestoreIcon className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-foreground">Restore dari file ZIP</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Unggah arsip backup (.zip). Semua data saat ini akan diganti isi backup, termasuk
            file upload (foto, dokumen, dll.) bila ada di arsip. Jalankan migrate otomatis sebelum restore.
          </p>
          <label className="mt-4 flex items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="mt-1"
            />
            <span>Saya paham — restore akan menghapus dan mengganti seluruh data database.</span>
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm) {
                  alert("Centang konfirmasi restore terlebih dahulu.");
                  e.target.value = "";
                  return;
                }
                if (!window.confirm(`Restore dari "${file.name}"? Data saat ini akan diganti.`)) {
                  e.target.value = "";
                  return;
                }
                restoreUpload.mutate(file, { onSettled: () => (e.target.value = "") });
              }}
            />
            <button
              type="button"
              disabled={!confirm || restoreUpload.isPending}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-danger/40 bg-bg-secondary px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {restoreUpload.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Pilih file &amp; restore
            </button>
          </div>
          {restoreUpload.isError ? (
            <p className="mt-3 text-sm text-danger">
              {(restoreUpload.error as any)?.response?.data?.error?.message ?? "Restore gagal"}
            </p>
          ) : null}
          {restoreUpload.isSuccess ? (
            <p className="mt-3 text-sm text-success">Restore selesai. Muat ulang halaman jika perlu.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function formatBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function StatusBadge({ status }: { status: Backup["status"] }) {
  const styles: Record<Backup["status"], string> = {
    RUNNING: "bg-info/15 text-info",
    READY: "bg-success/15 text-success",
    FAILED: "bg-danger/15 text-danger",
    PURGED: "bg-text-muted/15 text-text-muted",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " + styles[status]
      }
    >
      {status === "RUNNING" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {status}
    </span>
  );
}

export default function BackupsPage() {
  const { data: backups, isLoading } = useBackups();
  const generate = useGenerateBackup();
  const exportBackup = useExportBackup();
  const download = useDownloadBackup();
  const restoreById = useRestoreBackupById();

  const running = (backups ?? []).some((b) => b.status === "RUNNING");

  const handleRestoreBackup = (b: Backup) => {
    if (
      !window.confirm(
        `Restore backup ${new Date(b.created_at).toLocaleString()}?\n\nSemua data saat ini akan diganti.`
      )
    ) {
      return;
    }
    restoreById.mutate(b.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data &amp; Backup</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Backup database format ZIP (CSV per tabel + dump.sql + metadata.json). Restore dari daftar
            atau unggah file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportBackup.mutate()}
            disabled={exportBackup.isPending || running}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-bg-hover disabled:opacity-50"
          >
            {exportBackup.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download ZIP sekarang
          </button>
          <button
            onClick={() => generate.mutate()}
            disabled={generate.isPending || running}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {generate.isPending || running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Backup ke storage
          </button>
        </div>
      </div>

      <ScheduleCard />
      <RestoreCard />

      {generate.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(generate.error as any)?.response?.data?.error?.message ?? "Gagal memulai backup"}
        </div>
      ) : null}

      {restoreById.isError ? (
        <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {(restoreById.error as any)?.response?.data?.error?.message ?? "Restore gagal"}
        </div>
      ) : null}

      {restoreById.isSuccess ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
          Restore dari backup selesai.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : !backups?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Database className="h-8 w-8 text-text-muted" />
            <p className="mt-3 text-sm text-text-secondary">Belum ada backup tersimpan</p>
            <p className="mt-1 text-xs text-text-muted">
              Jadwal otomatis atau &quot;Backup ke storage&quot; / &quot;Download ZIP sekarang&quot;.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-text-secondary">
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Jenis</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Tabel</th>
                <th className="px-4 py-3">Baris</th>
                <th className="px-4 py-3">Ukuran</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-foreground">{new Date(b.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-text-secondary">{b.kind}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                    {b.status === "FAILED" && b.error ? (
                      <p className="mt-1 max-w-md truncate text-xs text-danger" title={b.error}>
                        {b.error}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{b.table_count || "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {b.row_count ? b.row_count.toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{formatBytes(b.size_bytes)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {b.status === "READY" ? (
                        <>
                          <button
                            onClick={() => download.mutate(b.id)}
                            disabled={download.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-bg-hover disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                          <button
                            onClick={() => handleRestoreBackup(b)}
                            disabled={restoreById.isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                          >
                            {restoreById.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RestoreIcon className="h-3.5 w-3.5" />
                            )}
                            Restore
                          </button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-text-muted">
        Isi arsip ZIP: <code>tables/&lt;nama&gt;.csv</code>, <code>dump.sql</code> (INSERT), dan{" "}
        <code>metadata.json</code>. CLI:{" "}
        <code>go run ./cmd/backup --output backup.zip</code> ·{" "}
        <code>go run ./cmd/restore backup.zip</code>
      </p>
    </div>
  );
}
