"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { CustomSelect } from "@/components/ui/custom-select";
import { Search, Save, Loader2, Check, RefreshCw, AlertTriangle, Shield, X } from "@/lib/icons";

interface RoleOption {
  id: string;
  name: string;
  is_system?: boolean;
}

interface PermissionRow {
  id: string;
  code: string;
  module: string;
  description?: string;
}

interface MatrixData {
  role: RoleOption;
  permissions: PermissionRow[];
  assigned_ids: string[] | null;
}

// RolePermissionMatrix lets an admin grant/revoke many permissions for a
// single role in one screen — check as many boxes as needed, then Save
// once, instead of creating one RolePermission record at a time.
export function RolePermissionMatrix() {
  const queryClient = useQueryClient();
  const [roleId, setRoleId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const { data: rolesRes, isLoading: rolesLoading } = useQuery({
    queryKey: ["/api/roles", "matrix-role-options"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: RoleOption[] }>(
        "/api/roles?page_size=100&sort_by=name&sort_order=asc"
      );
      return data;
    },
  });
  const roles = rolesRes?.data ?? [];

  useEffect(() => {
    if (!roleId && roles.length > 0) setRoleId(roles[0].id);
  }, [roles, roleId]);

  const matrixEndpoint = roleId ? `/api/roles/${roleId}/permissions` : null;
  const {
    data: matrixRes,
    isLoading: matrixLoading,
    isFetching: matrixFetching,
  } = useQuery({
    queryKey: [matrixEndpoint],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MatrixData }>(matrixEndpoint!);
      return data;
    },
    enabled: !!matrixEndpoint,
  });

  useEffect(() => {
    const ids = new Set(matrixRes?.data.assigned_ids ?? []);
    setChecked(ids);
    setSavedIds(ids);
  }, [matrixRes]);

  const permissions = matrixRes?.data.permissions ?? [];

  const roleOptions = useMemo(
    () =>
      roles.map((role) => ({
        value: role.id,
        label: `${role.name}${role.is_system ? " (system)" : ""}`,
      })),
    [roles]
  );

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = term
      ? permissions.filter(
          (p) =>
            p.code.toLowerCase().includes(term) ||
            p.module.toLowerCase().includes(term) ||
            (p.description ?? "").toLowerCase().includes(term)
        )
      : permissions;

    const byModule = new Map<string, PermissionRow[]>();
    for (const p of filtered) {
      const list = byModule.get(p.module) ?? [];
      list.push(p);
      byModule.set(p.module, list);
    }
    return Array.from(byModule.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [permissions, search]);

  const isDirty = useMemo(() => {
    if (checked.size !== savedIds.size) return true;
    for (const id of checked) {
      if (!savedIds.has(id)) return true;
    }
    return false;
  }, [checked, savedIds]);

  const { mutate: save, isPending: isSaving } = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put(matrixEndpoint!, {
        permission_ids: Array.from(checked),
      });
      return data;
    },
    onSuccess: () => {
      setSavedIds(new Set(checked));
      queryClient.invalidateQueries({ queryKey: ["/api/role_permissions"] });
      if (matrixEndpoint) queryClient.invalidateQueries({ queryKey: [matrixEndpoint] });
      toast.success("Permission role berhasil disimpan");
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      toast.error(axiosErr?.response?.data?.error?.message || "Gagal menyimpan permission");
    },
  });

  const toggleOne = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (rows: PermissionRow[], nextChecked: boolean) => {
    setChecked((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (nextChecked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };

  const toggleAllVisible = (nextChecked: boolean) => {
    const visibleIds = groups.flatMap(([, rows]) => rows.map((r) => r.id));
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (nextChecked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const resetChanges = () => setChecked(new Set(savedIds));

  const allVisibleIds = groups.flatMap(([, rows]) => rows.map((r) => r.id));
  const allVisibleChecked = allVisibleIds.length > 0 && allVisibleIds.every((id) => checked.has(id));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-bg-secondary p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-64 shrink-0">
              <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
              <CustomSelect
                value={roleId}
                onChange={setRoleId}
                options={roleOptions}
                placeholder="Pilih role..."
                loading={rolesLoading}
                disabled={rolesLoading || roles.length === 0}
                emptyLabel="Belum ada role"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Cari permission</label>
              <div className="flex h-[42px] items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3">
                <Search className="h-4 w-4 shrink-0 text-text-muted" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Code, module, atau deskripsi..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-text-muted focus:outline-none"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                    className="shrink-0 rounded p-0.5 text-text-muted hover:bg-bg-hover hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isDirty && (
              <span className="flex items-center gap-1.5 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning">
                <AlertTriangle className="h-3.5 w-3.5" />
                Belum disimpan
              </span>
            )}
            <button
              type="button"
              onClick={resetChanges}
              disabled={!isDirty || isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => save()}
              disabled={!roleId || !isDirty || isSaving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan Perubahan
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={allVisibleChecked}
              onChange={(e) => toggleAllVisible(e.target.checked)}
              disabled={allVisibleIds.length === 0}
              className="h-4 w-4 rounded border-border bg-bg-tertiary accent-accent"
            />
            Pilih semua yang tampil
          </label>
          <span>
            <strong className="text-foreground">{checked.size}</strong> dari{" "}
            <strong className="text-foreground">{permissions.length}</strong> permission dipilih
            {matrixFetching && !matrixLoading && " · memuat ulang..."}
          </span>
        </div>
      </div>

      {matrixLoading ? (
        <div className="rounded-xl border border-border bg-bg-secondary p-10 text-center text-sm text-text-secondary">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Memuat permission...
        </div>
      ) : !roleId ? (
        <div className="rounded-xl border border-border bg-bg-secondary p-10 text-center text-sm text-text-secondary">
          Pilih role terlebih dahulu untuk mengatur permission.
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl border border-border bg-bg-secondary p-10 text-center text-sm text-text-secondary">
          Tidak ada permission yang cocok dengan pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groups.map(([module, rows]) => {
            const moduleChecked = rows.every((r) => checked.has(r.id));
            const moduleIndeterminate = !moduleChecked && rows.some((r) => checked.has(r.id));
            return (
              <div key={module} className="rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={moduleChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = moduleIndeterminate;
                      }}
                      onChange={(e) => toggleGroup(rows, e.target.checked)}
                      className="h-4 w-4 rounded border-border bg-bg-tertiary accent-accent"
                    />
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <Shield className="h-3.5 w-3.5 text-accent" />
                      {module}
                    </span>
                  </label>
                  <span className="text-xs text-text-muted">
                    {rows.filter((r) => checked.has(r.id)).length}/{rows.length}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {rows.map((permission) => {
                    const isChecked = checked.has(permission.id);
                    return (
                      <label
                        key={permission.id}
                        className="flex items-start gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-bg-hover"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(permission.id)}
                          className="mt-0.5 h-4 w-4 rounded border-border bg-bg-tertiary accent-accent"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground font-mono">
                            {permission.code}
                          </span>
                          {permission.description && (
                            <span className="block text-xs text-text-muted line-clamp-1">
                              {permission.description}
                            </span>
                          )}
                        </span>
                        {isChecked && <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
