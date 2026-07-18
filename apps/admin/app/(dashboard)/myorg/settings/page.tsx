"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/chrome/PageHeader";
import { PermissionGate } from "@/components/auth/permission-gate";
import { Dropzone, type UploadedFile } from "@/components/ui/dropzone";
import { useToastedMutation } from "@/hooks/use-toasted-mutation";
import { apiClient, uploadFile } from "@/lib/api-client";
import { Loader2, Save, Building2 } from "@/lib/icons";
import type { OrganizationSetting } from "@repo/shared/types";
import { PUBLIC_SETTINGS_QUERY_KEY } from "@/hooks/use-public-settings";

const SETTINGS_QUERY_KEY = ["myorg", "organization-settings"];

const IMAGE_ACCEPT = {
  "image/*": [".jpeg", ".jpg", ".png", ".gif", ".webp", ".svg"],
};

interface FormState {
  web_name: string;
  theme: string;
  logo_url: string;
  icon_url: string;
  allow_self_register: boolean;
  allow_cross_division_events_view: boolean;
}

const EMPTY_FORM: FormState = {
  web_name: "",
  theme: "default",
  logo_url: "",
  icon_url: "",
  allow_self_register: false,
  allow_cross_division_events_view: false,
};

function toFormState(s: OrganizationSetting): FormState {
  return {
    web_name: s.web_name ?? "",
    theme: s.theme ?? "default",
    logo_url: s.logo_url ?? "",
    icon_url: s.icon_url ?? "",
    allow_self_register: !!s.allow_self_register,
    allow_cross_division_events_view: !!s.allow_cross_division_events_view,
  };
}

function urlToUploaded(url: string, label: string): UploadedFile[] {
  if (!url.trim()) return [];
  const name = url.split("/").pop()?.split("?")[0] || label;
  return [{ url, name: decodeURIComponent(name), size: 0, type: "image/*" }];
}

function ImageUploadField({
  label,
  description,
  value,
  onChange,
  variant = "default",
}: {
  label: string;
  description: string;
  value: string;
  onChange: (url: string) => void;
  variant?: "default" | "avatar" | "compact";
}) {
  return (
    <Dropzone
      // Remount when URL changes from server load / clear so preview stays in sync.
      key={value || `${label}-empty`}
      variant={variant}
      maxFiles={1}
      maxSize={5 * 1024 * 1024}
      accept={IMAGE_ACCEPT}
      value={urlToUploaded(value, label)}
      onFilesChange={(files) => onChange(files[0]?.url || "")}
      label={label}
      description={description}
    />
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-text-secondary">{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
          (checked ? "bg-accent" : "bg-text-muted/40")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 rounded-full bg-white transition-transform " +
            (checked ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}

export default function MyOrgSettingsPage() {
  return (
    <PermissionGate permission="settings.manage">
      <MyOrgSettingsPageContent />
    </PermissionGate>
  );
}

function MyOrgSettingsPageContent() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: settings, isLoading } = useQuery<OrganizationSetting | null>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get("/api/organization_settings?page_size=1");
      const rows = (data.data ?? []) as OrganizationSetting[];
      return rows[0] ?? null;
    },
  });

  useEffect(() => {
    if (settings) setForm(toFormState(settings));
  }, [settings]);

  const dirty = settings ? JSON.stringify(toFormState(settings)) !== JSON.stringify(form) : true;

  const save = useToastedMutation<OrganizationSetting, unknown, FormState>({
    mutationFn: async (values) => {
      if (settings) {
        const { data } = await apiClient.put(`/api/organization_settings/${settings.id}`, values);
        return data.data as OrganizationSetting;
      }
      const { data } = await apiClient.post("/api/organization_settings", values);
      return data.data as OrganizationSetting;
    },
    successMessage: "Branding saved",
    onSuccess: (data) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, data);
      // Keep sidebar (and any other public branding consumers) in sync.
      queryClient.setQueryData(PUBLIC_SETTINGS_QUERY_KEY, {
        web_name: data.web_name,
        logo_url: data.logo_url,
        icon_url: data.icon_url,
        theme: data.theme,
        allow_self_register: data.allow_self_register,
      });
      void queryClient.invalidateQueries({ queryKey: PUBLIC_SETTINGS_QUERY_KEY });
    },
  });

  const canSubmit = form.web_name.trim().length > 0 && form.theme.trim().length > 0;

  return (
    <div>
      <PageHeader
        title="Org Settings"
        subtitle="Pengaturan organisasi (satu data untuk seluruh sistem). Ubah lalu simpan — tidak ada create/delete berulang."
        refreshKeys={["myorg"]}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) save.mutate(form);
          }}
          className="space-y-6"
        >
          {!settings && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning">
              <Building2 className="h-4 w-4 shrink-0" />
              No organization settings exist yet — saving will create the singleton row.
            </div>
          )}

          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <h3 className="text-[15px] font-semibold text-foreground">Branding</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Shown on the login screen, browser tab, and sidebar of the web app.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Web Name *
                </label>
                <input
                  type="text"
                  value={form.web_name}
                  onChange={(e) => setForm((f) => ({ ...f, web_name: e.target.value }))}
                  placeholder="MyOrg System"
                  required
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Theme *
                </label>
                <input
                  type="text"
                  value={form.theme}
                  onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value }))}
                  placeholder="default"
                  required
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
                />
                <p className="mt-1 text-xs text-text-muted">e.g. default, dark, ocean</p>
              </div>

              <ImageUploadField
                label="Logo"
                description="Unggah gambar logo (PNG/JPG/WebP/SVG, maks. 5MB). Bisa diganti kapan saja."
                value={form.logo_url}
                onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))}
                variant="default"
              />

              <ImageUploadField
                label="Icon (favicon)"
                description="Ikon kecil untuk browser tab / favicon. Unggah gambar kotak, bisa diganti."
                value={form.icon_url}
                onChange={(url) => setForm((f) => ({ ...f, icon_url: url }))}
                variant="avatar"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <h3 className="text-[15px] font-semibold text-foreground">Access &amp; visibility</h3>
            <div className="mt-1 divide-y divide-border">
              <ToggleRow
                label="Allow self-registration"
                hint="Lets new users create their own account from the public sign-up page."
                checked={form.allow_self_register}
                onChange={(v) => setForm((f) => ({ ...f, allow_self_register: v }))}
              />
              <ToggleRow
                label="Allow cross-division event visibility"
                hint="Members can see events belonging to other divisions, not just their own."
                checked={form.allow_cross_division_events_view}
                onChange={(v) => setForm((f) => ({ ...f, allow_cross_division_events_view: v }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            {!dirty && settings ? <span className="text-xs text-text-muted">No changes</span> : null}
            <button
              type="submit"
              disabled={save.isPending || !dirty || !canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
