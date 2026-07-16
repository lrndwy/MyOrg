"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Paperclip } from "lucide-react";
import { apiErrorMessage } from "@repo/shared/types";
import { RequireAuth } from "@/components/require-auth";
import { isImageUrl } from "@/lib/datetime";
import { useGetEvent } from "@/hooks/use-events";
import { useEventCheckInGate } from "@/hooks/use-event-check-in-gate";
import { useCreateMyPermissionRequest } from "@/hooks/use-permission-requests";
import { useUploadFile } from "@/hooks/use-uploads";
import { useCan } from "@/hooks/use-permissions-gate";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CreatePermissionPage({ params }: PageProps) {
  const { id } = use(params);
  return <RequireAuth>{() => <CreatePermissionForm eventId={id} />}</RequireAuth>;
}

function CreatePermissionForm({ eventId }: { eventId: string }) {
  const { data: event, isLoading: eventLoading, isError } = useGetEvent(eventId);
  const {
    attendance: myAttendance,
    activePermission,
    canSubmitPermission,
    isLoading: gateLoading,
  } = useEventCheckInGate(eventId);
  const { "permission.submit": canSubmit, isLoading: permLoading } = useCan(
    "permission.submit"
  );
  const { mutate: createRequest, isPending, error, isSuccess } =
    useCreateMyPermissionRequest();
  const { mutateAsync: uploadFile, isPending: uploading } = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [reason, setReason] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofFileName, setProofFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const onPickProofFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const ref = await uploadFile({ file });
      setProofUrl(ref.url);
      setProofFileName(ref.name);
    } catch (err) {
      setUploadError(apiErrorMessage(err, "Upload gagal"));
    } finally {
      e.target.value = "";
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRequest({ event_id: eventId, reason, proof_url: proofUrl });
  };

  if (eventLoading || gateLoading || permLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-text-muted">
        Event tidak ditemukan.
        <Link href="/events" className="mt-4 block text-accent">
          Kembali
        </Link>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <Blocked
        title="Tidak ada akses"
        message="Anda tidak punya permission permission.submit."
        eventId={eventId}
      />
    );
  }

  if (!event.allow_permission) {
    return (
      <Blocked
        title="Izin tidak diizinkan"
        message="Event ini tidak mengizinkan pengajuan izin."
        eventId={eventId}
      />
    );
  }

  if (myAttendance) {
    return (
      <Blocked
        title="Sudah absen"
        message="Anda sudah absen untuk event ini, tidak bisa mengajukan izin."
        eventId={eventId}
      />
    );
  }

  if (activePermission) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-info" />
        <h1 className="mt-4 text-xl font-bold">Sudah ada pengajuan</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Status izin Anda untuk {event.title}: <strong>{activePermission.status}</strong>.
          Tidak bisa mengajukan ulang.
        </p>
        <Link
          href="/my-permissions"
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
        >
          Lihat izin saya
        </Link>
      </div>
    );
  }

  if (!canSubmitPermission) {
    return (
      <Blocked
        title="Pengajuan tidak tersedia"
        message="Anda sudah absen atau sudah mengajukan izin untuk event ini."
        eventId={eventId}
      />
    );
  }

  if (isSuccess) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-xl font-bold">Pengajuan terkirim</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Izin untuk {event.title} menunggu review.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/my-permissions"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Lihat izin saya
          </Link>
          <Link
            href={`/events/${eventId}`}
            className="rounded-lg border border-border bg-bg-secondary px-4 py-2.5 text-sm font-semibold"
          >
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Ajukan Izin</h1>
      <p className="mt-1 text-sm text-text-secondary">{event.title}</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Alasan</label>
          <textarea
            required
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan kenapa Anda tidak bisa hadir…"
            className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium">Bukti pendukung</label>
          <p className="text-xs text-text-muted">
            Upload file atau tempel URL bukti (surat dokter, dll).
          </p>
          {!proofFileName && (
            <input
              type="url"
              required={!proofUrl}
              value={proofUrl}
              onChange={(e) => {
                setProofUrl(e.target.value);
                setProofFileName(null);
              }}
              placeholder="https://…"
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          )}
          {proofFileName && (
            <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm">
              <p className="font-medium">{proofFileName}</p>
              {isImageUrl(proofUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={proofUrl}
                  alt="Preview bukti"
                  className="mt-2 max-h-40 rounded-md object-contain border border-border"
                />
              )}
              <button
                type="button"
                className="mt-2 text-xs text-accent"
                onClick={() => {
                  setProofUrl("");
                  setProofFileName(null);
                }}
              >
                Ganti
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={onPickProofFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-xs font-medium hover:bg-bg-hover disabled:opacity-50"
            >
              <Paperclip className="h-3.5 w-3.5" />
              {uploading ? "Mengupload…" : "Upload file"}
            </button>
          </div>
          {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {apiErrorMessage(error, "Gagal mengajukan izin")}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !proofUrl}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Mengirim…" : "Kirim pengajuan"}
        </button>
      </form>
    </div>
  );
}

function Blocked({
  title,
  message,
  eventId,
}: {
  title: string;
  message: string;
  eventId: string;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-text-secondary">{message}</p>
      <Link
        href={`/events/${eventId}`}
        className="mt-6 inline-block text-sm text-accent hover:text-accent-hover"
      >
        Kembali ke event
      </Link>
    </div>
  );
}
