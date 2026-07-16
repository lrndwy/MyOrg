"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, RotateCcw, Eraser, CheckCircle2 } from "lucide-react";
import { apiErrorMessage } from "@repo/shared/types";
import { RequireAuth } from "@/components/require-auth";
import { useGetEvent } from "@/hooks/use-events";
import { useSubmitAttendance } from "@/hooks/use-attendances";
import { useEventCheckInGate } from "@/hooks/use-event-check-in-gate";
import { useUploadFile } from "@/hooks/use-uploads";
import { useCan } from "@/hooks/use-permissions-gate";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AttendancePage({ params }: PageProps) {
  const { id } = use(params);
  return <RequireAuth>{() => <AttendanceFlow eventId={id} />}</RequireAuth>;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not read canvas"));
    }, "image/png");
  });
}

function AttendanceFlow({ eventId }: { eventId: string }) {
  const { data: event } = useGetEvent(eventId);
  const {
    attendance: existingAttendance,
    activePermission,
    canSubmitAttendance,
    isLoading: gateLoading,
  } = useEventCheckInGate(eventId);
  const { "attendance.submit": canAttend, isLoading: permLoading } = useCan(
    "attendance.submit"
  );

  // --- Camera / selfie ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const selfieCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        setCameraError("Couldn't access your camera. Check browser permissions, or upload a photo below.");
      }
    }
    if (!selfieDataUrl) startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfieDataUrl === null]);

  const captureSelfie = () => {
    const video = videoRef.current;
    const canvas = selfieCanvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSelfieDataUrl(canvas.toDataURL("image/png"));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const retakeSelfie = () => {
    setSelfieDataUrl(null);
  };

  const onSelfieFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = selfieCanvasRef.current;
        if (!canvas) return;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        setSelfieDataUrl(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- Signature pad ---
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  const getSignatureCtx = () => signatureCanvasRef.current?.getContext("2d") || null;

  const pointerPos = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    const ctx = getSignatureCtx();
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    const { x, y } = pointerPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    const ctx = getSignatureCtx();
    if (!canvas || !ctx) return;
    const { x, y } = pointerPos(canvas, e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const onPointerUp = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    const ctx = getSignatureCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // --- Submit ---
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: submitAttendance, isPending: submitting } = useSubmitAttendance();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = !!selfieDataUrl && hasSignature && !submitting;

  const onSubmit = async () => {
    setSubmitError(null);
    try {
      const selfieCanvas = selfieCanvasRef.current;
      const signatureCanvas = signatureCanvasRef.current;
      if (!selfieCanvas || !signatureCanvas) return;

      const [selfieBlob, signatureBlob] = await Promise.all([
        canvasToBlob(selfieCanvas),
        canvasToBlob(signatureCanvas),
      ]);

      const [selfieRef, signatureRef] = await Promise.all([
        uploadFile({ file: selfieBlob, filename: `selfie-${eventId}.png`, accepts: "image" }),
        uploadFile({ file: signatureBlob, filename: `signature-${eventId}.png`, accepts: "image" }),
      ]);

      await submitAttendance({
        eventId,
        selfieUrl: selfieRef.url,
        signatureUrl: signatureRef.url,
      });

      setDone(true);
    } catch (err) {
      setSubmitError(apiErrorMessage(err, "Could not submit attendance"));
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-xl font-bold">Attendance recorded</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your check-in for {event?.title || "this event"} was submitted.
        </p>
        <Link
          href={`/events/${eventId}`}
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          Back to event
        </Link>
      </div>
    );
  }

  if (permLoading || gateLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  if (!canAttend) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm text-text-muted">
          Anda tidak punya permission <code className="text-accent">attendance.submit</code>.
        </p>
        <Link
          href={`/events/${eventId}`}
          className="mt-4 inline-block text-sm text-accent hover:text-accent-hover"
        >
          Kembali ke event
        </Link>
      </div>
    );
  }

  if (existingAttendance) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-xl font-bold">Sudah absen</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Anda sudah submit attendance untuk {event?.title || "event ini"}. Tidak bisa absen
          ulang.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {existingAttendance.selfie_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existingAttendance.selfie_url}
              alt="Selfie absensi"
              className="h-28 w-28 rounded-xl object-cover border border-border"
            />
          )}
          {existingAttendance.signature_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={existingAttendance.signature_url}
              alt="Tanda tangan"
              className="h-28 max-w-[10rem] rounded-xl object-contain border border-border bg-white p-1"
            />
          )}
        </div>
        <Link
          href={`/events/${eventId}`}
          className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          Kembali ke event
        </Link>
      </div>
    );
  }

  if (activePermission) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Tidak bisa absen</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Anda sudah mengajukan izin ({activePermission.status}) untuk{" "}
          {event?.title || "event ini"}. Absensi tidak tersedia.
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
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"
          >
            Kembali
          </Link>
        </div>
      </div>
    );
  }

  if (!canSubmitAttendance) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Absensi tidak tersedia</h1>
        <Link
          href={`/events/${eventId}`}
          className="mt-6 inline-block text-sm text-accent"
        >
          Kembali ke event
        </Link>
      </div>
    );
  }

  if (event && event.status !== "ongoing") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-xl font-bold">Absensi belum tersedia</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Absensi hanya bisa dilakukan saat status event <strong>ongoing</strong>. Status
          saat ini: <strong>{event.status}</strong>.
        </p>
        <Link
          href={`/events/${eventId}`}
          className="mt-6 inline-block text-sm text-accent hover:text-accent-hover"
        >
          Kembali ke event
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Submit attendance</h1>
      <p className="mt-1 text-sm text-text-secondary">{event?.title}</p>

      {/* Selfie */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">1. Take a selfie</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-bg-tertiary aspect-[4/3] flex items-center justify-center">
          {selfieDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selfieDataUrl} alt="Captured selfie" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
          )}
        </div>
        <canvas ref={selfieCanvasRef} className="hidden" />

        {cameraError && (
          <div className="mt-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            {cameraError}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3">
          {selfieDataUrl ? (
            <button
              type="button"
              onClick={retakeSelfie}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-bg-hover transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Retake
            </button>
          ) : (
            <button
              type="button"
              onClick={captureSelfie}
              disabled={!!cameraError}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
              Capture
            </button>
          )}
          {!selfieDataUrl && (
            <label className="cursor-pointer text-xs text-text-muted hover:text-foreground underline">
              or upload a photo
              <input type="file" accept="image/*" className="hidden" onChange={onSelfieFileFallback} />
            </label>
          )}
        </div>
      </div>

      {/* Signature */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-foreground">2. Sign below</h2>
        <canvas
          ref={signatureCanvasRef}
          width={400}
          height={160}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          className="mt-3 w-full touch-none rounded-xl border border-border bg-white"
        />
        <button
          type="button"
          onClick={clearSignature}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-bg-hover transition-colors"
        >
          <Eraser className="h-4 w-4" />
          Clear
        </button>
      </div>

      {submitError && (
        <div className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {submitError}
        </div>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="mt-8 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit attendance"}
      </button>
    </div>
  );
}
