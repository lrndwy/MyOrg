"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiErrorMessage } from "@repo/shared/types";
import { useRegister } from "@/hooks/use-auth";
import { usePublicSettings } from "@/hooks/use-public-settings";

export default function RegisterPage() {
  const router = useRouter();
  const { data: settings, isLoading: settingsLoading } = usePublicSettings();
  const { mutate: register, isPending, error } = useRegister();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  // Self-registration is gated by the organization setting. Bounce to
  // /login instead of rendering a form nobody's allowed to submit.
  useEffect(() => {
    if (!settingsLoading && settings && !settings.allow_self_register) {
      router.replace("/login");
    }
  }, [settingsLoading, settings, router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    register({ first_name: firstName, last_name: lastName, email, password });
  };

  if (settingsLoading || (settings && !settings.allow_self_register)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Join {settings?.web_name || "MyOrg System"}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-bg-secondary p-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="first_name" className="block text-sm font-medium text-foreground">
                First name
              </label>
              <input
                id="first_name"
                type="text"
                required
                minLength={2}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground placeholder-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="last_name" className="block text-sm font-medium text-foreground">
                Last name
              </label>
              <input
                id="last_name"
                type="text"
                required
                minLength={2}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground placeholder-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground placeholder-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground placeholder-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm_password" className="block text-sm font-medium text-foreground">
              Confirm password
            </label>
            <input
              id="confirm_password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground placeholder-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {mismatch && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              Passwords do not match.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {apiErrorMessage(error, "Could not create your account")}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isPending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hover font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
