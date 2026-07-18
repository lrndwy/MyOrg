"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, CheckCircle2, Eraser, RotateCcw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiErrorMessage } from "@repo/shared/types";
import type { EventSubEvent } from "@repo/shared/types";
import { RequireAuth } from "@/components/require-auth";
import {
  useMySubEventAttendance,
  useSubmitSubEventAttendance,
} from "@/hooks/use-event-committee";
import { useUploadFile } from "@/hooks/use-uploads";
import { useCan } from "@/hooks/use-permissions-gate";
import { apiClient } from "@/lib/api";

interface PageProps {
  params: Promise<{ id: string; subId: string }>;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read canvas"))), "image/png");
  });
}

export default function SubEventAttendancePage({ params }: PageProps) {
  const { id, subId } = use(params);
  return (
    <RequireAuth>
      {() => <SubEventAttendanceFlow eventId={id} subEventId={subId} />}
    </RequireAuth>
  );
}

function SubEventAttendanceFlow({
  eventId,
  subEventId,
}: {
  eventId: string;
  subEventId: string;
}) {
  const { data: subEvent } = useQuery<EventSubEvent>({
    queryKey: ["sub-events", subEventId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/event_sub_events/${subEventId}`);
      return data.data as EventSubEvent;
    },
  });
  const { data: existing } = useMySubEventAttendance(subEventId);
  const { "sub_events.attendance.submit": canAttend } = useCan("sub_events.attendance.submit");
  const { mutateAsync: submit, isPending: submitting } = useSubmitSubEventAttendance(subEventId);
  const { mutateAsync: uploadFile } = useUploadFile();

  const videoRef = useRef<HTMLVideoElement>(null);
  const selfieCanvasRef = useRef<HTMLCanvasElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawingRef = useRef(false);

  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selfieDataUrl) return;
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => undefined);
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [selfieDataUrl]);

  const captureSelfie = () => {
    const video = videoRef.current;
    const canvas = selfieCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSelfieDataUrl(canvas.toDataURL("image/png"));
    streamRef.current?.getTracks().forEach((t) => t.stop());
  };

  const onSubmit = async () => {
    setError(null);
    try {
      const selfieCanvas = selfieCanvasRef.current;
      const signatureCanvas = signatureCanvasRef.current;
      if (!selfieCanvas || !signatureCanvas) return;
      const [selfieBlob, signatureBlob] = await Promise.all([
        canvasToBlob(selfieCanvas),
        canvasToBlob(signatureCanvas),
      ]);
      const [selfieRef, signatureRef] = await Promise.all([
        uploadFile({ file: selfieBlob, filename: `sub-selfie-${subEventId}.png`, accepts: "image" }),
        uploadFile({ file: signatureBlob, filename: `sub-signature-${subEventId}.png`, accepts: "image" }),
      ]);
      await submit({ selfie_url: selfieRef.url, signature_url: signatureRef.url });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, "Gagal submit absensi"));
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-xl font-bold">Absensi tercatat</h1>
        <Link href={`/events/${eventId}/sub-events/${subEventId}`} className="mt-6 inline-block text-accent">
          Kembali
        </Link>
      </div>
    );
  }

  if (!canAttend || existing) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm text-text-muted">
        {existing ? "Anda sudah absen." : "Tidak punya akses absensi sub event."}
        <Link href={`/events/${eventId}/sub-events/${subEventId}`} className="mt-4 block text-accent">
          Kembali
        </Link>
      </div>
    );
  }

  if (subEvent && subEvent.status !== "ongoing") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center text-sm">
        Absensi hanya saat sub event ongoing (saat ini: {subEvent.status}).
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold">Absen Sub Event</h1>
      <p className="mt-1 text-sm text-text-secondary">{subEvent?.title}</p>

      <div className="mt-8">
        <h2 className="text-sm font-semibold">1. Selfie</h2>
        <div className="mt-3 aspect-[4/3] overflow-hidden rounded-xl border border-border bg-bg-tertiary">
          {selfieDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfieDataUrl} alt="Selfie" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}
        </div>
        <canvas ref={selfieCanvasRef} className="hidden" />
        <div className="mt-3 flex gap-2">
          {selfieDataUrl ? (
            <button type="button" onClick={() => setSelfieDataUrl(null)} className="rounded-lg border px-3 py-2 text-sm">
              <RotateCcw className="inline h-4 w-4" /> Ulangi
            </button>
          ) : (
            <button type="button" onClick={captureSelfie} className="rounded-lg bg-accent px-3 py-2 text-sm text-white">
              <Camera className="inline h-4 w-4" /> Ambil
            </button>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold">2. Tanda tangan</h2>
        <canvas
          ref={signatureCanvasRef}
          width={400}
          height={160}
          className="mt-3 w-full touch-none rounded-xl border border-border bg-white"
          onPointerDown={(e) => {
            const canvas = signatureCanvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;
            drawingRef.current = true;
            const rect = canvas.getBoundingClientRect();
            ctx.beginPath();
            ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
          }}
          onPointerMove={(e) => {
            if (!drawingRef.current) return;
            const canvas = signatureCanvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;
            const rect = canvas.getBoundingClientRect();
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.strokeStyle = "#0f172a";
            ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
            ctx.stroke();
            setHasSignature(true);
          }}
          onPointerUp={() => { drawingRef.current = false; }}
        />
        <button
          type="button"
          onClick={() => {
            const canvas = signatureCanvasRef.current;
            canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            setHasSignature(false);
          }}
          className="mt-2 rounded-lg border px-3 py-2 text-sm"
        >
          <Eraser className="inline h-4 w-4" /> Hapus
        </button>
      </div>

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <button
        type="button"
        disabled={!selfieDataUrl || !hasSignature || submitting}
        onClick={onSubmit}
        className="mt-8 w-full rounded-lg bg-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Mengirim…" : "Submit Absensi"}
      </button>
    </div>
  );
}
