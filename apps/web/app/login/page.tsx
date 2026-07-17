"use client";

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { LoginSchema, type LoginInput } from "@repo/shared/schemas";
import { apiErrorMessage } from "@repo/shared/types";
import {
  useLogin,
  useMe,
  useVerifyBackupCode,
  useVerifyTotp,
} from "@/hooks/use-auth";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { clearTokens } from "@/lib/auth";
import { navigateAfterLogin } from "@/lib/post-login";
import { getConfiguredAdminAppUrl } from "@/lib/app-urls";
import { TotpCodeInput } from "@/components/auth/totp-code-input";
import { isAdminAppOrigin } from "@repo/shared/constants";

type Step = "credentials" | "totp";

const inputClass =
  "block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-text-muted outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";
const inputErrClass = "border-danger focus:border-danger focus:ring-danger/20";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginSessionGate />
    </Suspense>
  );
}

/** Clear mirrored tokens before probing session (avoids admin↔login loop). */
function LoginSessionGate() {
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    clearTokens();
    setReady(true);
  }, []);

  if (!ready) return <LoginSkeleton />;
  return <LoginInner />;
}

function LoginInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const queryError = searchParams.get("error");

  const { data: settings } = usePublicSettings();
  const { data: existingUser, isLoading: meLoading } = useMe();
  const {
    mutate: login,
    isPending: loginPending,
    error: loginError,
    data: loginResult,
    reset: resetLogin,
  } = useLogin();
  const {
    mutate: verifyTotp,
    isPending: totpPending,
    error: totpError,
    reset: resetTotp,
  } = useVerifyTotp();
  const {
    mutate: verifyBackup,
    isPending: backupPending,
    error: backupError,
    reset: resetBackup,
  } = useVerifyBackupCode();

  const [step, setStep] = useState<Step>("credentials");
  const [pendingToken, setPendingToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  useEffect(() => {
    if (meLoading || !existingUser) return;
    if (searchParams.get("logged_out") === "1") return;
    navigateAfterLogin(existingUser, next);
  }, [meLoading, existingUser, next, searchParams]);

  useEffect(() => {
    if (loginResult?.totp_required && loginResult.pending_token) {
      setPendingToken(loginResult.pending_token);
      setStep("totp");
      setTotpCode("");
    }
  }, [loginResult]);

  const brandName = settings?.web_name || "MyOrg";
  const logo = settings?.logo_url || settings?.icon_url;
  const headingToAdmin =
    !!next &&
    (() => {
      try {
        return isAdminAppOrigin(
          new URL(next).origin,
          getConfiguredAdminAppUrl()
        );
      } catch {
        return false;
      }
    })();

  const verifying = totpPending || backupPending;

  const onCredentials = (data: LoginInput) => {
    resetTotp();
    resetBackup();
    login({
      identifier: data.identifier || data.username || data.email,
      password: data.password,
    });
  };

  const onTotpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      pending_token: pendingToken,
      code: totpCode.replace(/\s/g, ""),
      trust_device: trustDevice,
    };
    if (useBackup) {
      if (payload.code.length < 8) return;
      verifyBackup(payload);
    } else {
      const digits = payload.code.replace(/\D/g, "");
      if (digits.length < 6) return;
      verifyTotp({ ...payload, code: digits });
    }
  };

  const backToCredentials = () => {
    setStep("credentials");
    setPendingToken("");
    setTotpCode("");
    setUseBackup(false);
    resetLogin();
    resetTotp();
    resetBackup();
  };

  const challengeError = useBackup ? backupError : totpError;
  const serverError =
    step === "totp"
      ? challengeError
        ? apiErrorMessage(challengeError, "Kode verifikasi tidak valid")
        : null
      : loginError
        ? apiErrorMessage(loginError, "Username/email atau password salah")
        : queryError;

  if (meLoading || existingUser) {
    return <LoginSkeleton />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={brandName}
              className="mx-auto mb-4 h-12 w-auto"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/15">
              <span className="text-lg font-bold text-accent">
                {brandName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{brandName}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {step === "credentials"
              ? headingToAdmin
                ? "Masuk untuk melanjutkan ke Admin Panel"
                : "Masuk ke akun Anda"
              : useBackup
                ? "Masukkan backup code"
                : "Masukkan kode autentikator"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-bg-elevated p-6 shadow-sm">
          {step === "credentials" ? (
            <form
              onSubmit={handleSubmit(onCredentials)}
              className="space-y-4"
              noValidate
            >
              {serverError && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {serverError}
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="identifier"
                  className="block text-sm font-medium"
                >
                  Username atau email
                </label>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  {...register("identifier")}
                  placeholder="nama.pengguna atau you@org.id"
                  className={`${inputClass} ${errors.identifier ? inputErrClass : ""}`}
                />
                {errors.identifier && (
                  <p className="text-sm text-danger">
                    {errors.identifier.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    {...register("password")}
                    placeholder="••••••••"
                    className={`${inputClass} pr-10 ${errors.password ? inputErrClass : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-foreground"
                    aria-label={
                      showPassword ? "Sembunyikan password" : "Tampilkan password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-danger">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loginPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {loginPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memverifikasi…
                  </>
                ) : (
                  "Masuk"
                )}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={backToCredentials}
                className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Kembali
              </button>

              {serverError && (
                <div
                  role="alert"
                  className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {serverError}
                </div>
              )}

              <form onSubmit={onTotpSubmit} className="space-y-4">
                {useBackup ? (
                  <input
                    type="text"
                    autoFocus
                    value={totpCode}
                    onChange={(e) =>
                      setTotpCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))
                    }
                    placeholder="XXXXXXXX"
                    autoComplete="one-time-code"
                    className={`${inputClass} font-mono tracking-widest`}
                  />
                ) : (
                  <TotpCodeInput
                    value={totpCode}
                    onChange={setTotpCode}
                    disabled={verifying}
                    autoFocus
                  />
                )}

                <label className="flex cursor-pointer items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Percayai perangkat ini
                </label>

                <button
                  type="submit"
                  disabled={
                    verifying ||
                    (useBackup
                      ? totpCode.length < 8
                      : totpCode.replace(/\D/g, "").length < 6)
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memverifikasi…
                    </>
                  ) : (
                    "Verifikasi"
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  setUseBackup((v) => !v);
                  setTotpCode("");
                  resetTotp();
                  resetBackup();
                }}
                className="w-full text-center text-sm text-accent hover:underline"
              >
                {useBackup
                  ? "Gunakan kode autentikator"
                  : "Gunakan backup code"}
              </button>
            </div>
          )}
        </div>

        {settings?.allow_self_register && step === "credentials" && (
          <p className="mt-6 text-center text-sm text-text-secondary">
            Belum punya akun?{" "}
            <Link
              href="/register"
              className="font-medium text-accent hover:text-accent-hover"
            >
              Daftar
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function LoginSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-secondary">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  );
}
