"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "@repo/shared/types";
import { apiErrorMessage } from "@repo/shared/types";
import { RequireAuth } from "@/components/require-auth";
import { useChangePassword, useUpdateMe } from "@/hooks/use-auth";
import { useUploadFile } from "@/hooks/use-uploads";

export default function ProfilePage() {
  return <RequireAuth>{(user) => <ProfileContent user={user} />}</RequireAuth>;
}

function ProfileContent({ user }: { user: User }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
        <p className="text-sm text-text-secondary">
          Perbarui data diri dan password Anda.
        </p>
      </div>

      <div className="mt-0 grid gap-3 rounded-xl border border-border bg-bg-elevated p-4 text-sm shadow-sm sm:grid-cols-2">
        <div>
          <p className="text-xs text-text-muted">Username</p>
          <p className="font-medium">{user.username || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Email</p>
          <p className="font-medium">{user.email}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Divisi</p>
          <p className="font-medium">
            {(user as User & { division?: { name?: string } }).division?.name || "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-muted">App Role</p>
          <p className="font-medium">
            {(user as User & { app_role?: { name?: string } }).app_role?.name || "—"}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-8">
        <ProfileForm user={user} />
        <PasswordForm />
      </div>
    </div>
  );
}

function ProfileForm({ user }: { user: User }) {
  const { mutate: updateMe, isPending, error, isSuccess } = useUpdateMe();
  const { mutate: uploadFile, isPending: uploading } = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user.full_name || "");
  const [hometown, setHometown] = useState(user.hometown || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [avatar, setAvatar] = useState(user.avatar || "");
  const [birthDate, setBirthDate] = useState(
    user.birth_date ? String(user.birth_date).slice(0, 10) : ""
  );
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setFullName(user.full_name || "");
    setHometown(user.hometown || "");
    setPhone(user.phone || "");
    setAvatar(user.avatar || "");
    setBirthDate(user.birth_date ? String(user.birth_date).slice(0, 10) : "");
  }, [user]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMe({
      full_name: fullName,
      hometown,
      phone,
      avatar,
      birth_date: birthDate || null,
    });
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    uploadFile(
      { file, accepts: "image" },
      {
        onSuccess: (ref) => setAvatar(ref.url),
        onError: (err) => setUploadError(apiErrorMessage(err, "Avatar upload failed")),
      }
    );
    e.target.value = "";
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-bg-secondary p-6">
      <h2 className="text-sm font-semibold text-foreground">Personal details</h2>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border border-border bg-bg-elevated">
          {avatar ? (
            <img src={avatar} alt={fullName || "Avatar"} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-text-muted">
              {(fullName || user.first_name || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickAvatar}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-border bg-bg-elevated px-3 py-1.5 text-sm font-medium text-foreground hover:bg-bg-hover transition-colors disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Change photo"}
          </button>
          {uploadError && <p className="mt-1 text-xs text-danger">{uploadError}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Hometown</label>
        <input
          type="text"
          value={hometown}
          onChange={(e) => setHometown(e.target.value)}
          className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Tanggal lahir</label>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Email</label>
        <input
          type="email"
          value={user.email}
          disabled
          className="block w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-muted"
        />
        <p className="text-xs text-text-muted">Email can&apos;t be changed here.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(error, "Could not update your profile")}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Profile updated.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const { mutate: changePassword, isPending, error, isSuccess, reset } = useChangePassword();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [isSuccess]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    reset();
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    changePassword({ old_password: oldPassword, new_password: newPassword });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-bg-secondary p-6">
      <h2 className="text-sm font-semibold text-foreground">Change password</h2>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">Current password</label>
        <input
          type="password"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">New password</label>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Confirm new password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      {mismatch && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          New passwords do not match.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(error, "Could not change your password")}
        </div>
      )}
      {isSuccess && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          Password updated.
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-bg-hover transition-colors disabled:opacity-50"
      >
        {isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
