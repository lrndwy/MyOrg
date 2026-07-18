"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PermissionGate } from "@/components/auth/permission-gate";
import {
  canFinanceCategories,
  canFinanceCreate,
  useMyPermissions,
} from "@/hooks/use-permissions-gate";
import {
  FinanceAnalytics,
  type FinanceDashboard,
} from "@/components/finance/finance-analytics";
import { PageHeader } from "@/components/chrome/PageHeader";
import { StatsGrid, type StatCard } from "@/components/layout/page-header";
import { CustomSelect } from "@/components/ui/custom-select";
import { useToastedMutation } from "@/hooks/use-toasted-mutation";
import { apiClient, uploadFile } from "@/lib/api-client";
import { Loader2, Plus, ExternalLink } from "@/lib/icons";
import type { FinanceCategory, FinanceTransaction } from "@repo/shared/types";

type TxType = "income" | "expense";

interface TxForm {
  type: TxType;
  amount: string;
  description: string;
  proof_url: string;
  transaction_date: string;
  category_id: string;
}

const EMPTY_FORM = (type: TxType): TxForm => ({
  type,
  amount: "",
  description: "",
  proof_url: "",
  transaction_date: new Date().toISOString().slice(0, 10),
  category_id: "",
});

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function typeLabel(type: string): string {
  return type === "income" ? "Pemasukan" : "Pengeluaran";
}

export default function FinancePage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [chartDays, setChartDays] = useState(30);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TxForm>(EMPTY_FORM("expense"));
  const [uploadingProof, setUploadingProof] = useState(false);
  const { data: permissionsData } = useMyPermissions();
  const canCreate = canFinanceCreate(permissionsData);
  const canManageCategories = canFinanceCategories(permissionsData);

  const dashboardQuery = useQuery({
    queryKey: ["finance-dashboard", chartDays],
    queryFn: async () => {
      const { data } = await apiClient.get(`/api/finance_transactions/dashboard?days=${chartDays}`);
      return (data.data ?? data) as FinanceDashboard;
    },
  });

  const txQuery = useQuery({
    queryKey: ["finance-transactions", typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page_size: "50", sort_by: "transaction_date", sort_order: "desc" });
      if (typeFilter) params.set("type", typeFilter);
      const { data } = await apiClient.get(`/api/finance_transactions?${params}`);
      return (data.data ?? []) as FinanceTransaction[];
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ["finance-categories-all"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/finance_categories?page_size=100&sort_by=name&sort_order=asc");
      return (data.data ?? []) as FinanceCategory[];
    },
  });

  const categoryOptions = useMemo(() => {
    return (categoriesQuery.data ?? [])
      .filter((c) => c.type === form.type)
      .map((c) => ({ label: c.name, value: c.id }));
  }, [categoriesQuery.data, form.type]);

  const openModal = useCallback((type: TxType) => {
    setForm(EMPTY_FORM(type));
    setModalOpen(true);
  }, []);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "income" || action === "expense") {
      openModal(action);
    }
  }, [searchParams, openModal]);

  const invalidateFinance = () => {
    queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["finance-summary"] });
    queryClient.invalidateQueries({ queryKey: ["finance-transactions"] });
  };

  const createTx = useToastedMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Nominal harus lebih dari 0");
      }
      if (!form.description.trim()) throw new Error("Keterangan wajib diisi");
      if (!form.category_id) throw new Error("Kategori wajib dipilih");
      if (!form.transaction_date) throw new Error("Tanggal wajib diisi");

      const payload = {
        type: form.type,
        amount,
        description: form.description.trim(),
        proof_url: form.proof_url || undefined,
        transaction_date: form.transaction_date,
        category_id: form.category_id,
      };
      const { data } = await apiClient.post("/api/finance_transactions", payload);
      return data.data as FinanceTransaction;
    },
    successMessage: "Transaksi tersimpan",
    onSuccess: () => {
      invalidateFinance();
      setModalOpen(false);
    },
  });

  const stats: StatCard[] = useMemo(() => {
    const d = dashboardQuery.data;
    const all = d?.all_time;
    const week = d?.this_week;
    const month = d?.this_month;
    const recentCount = d?.recent_updates?.length ?? 0;

    return [
      {
        label: "Total Pemasukan",
        value: formatIDR(all?.total_income ?? 0),
        icon: "TrendingUp",
        color: "success",
      },
      {
        label: "Total Pengeluaran",
        value: formatIDR(all?.total_expense ?? 0),
        icon: "TrendingDown",
        color: "danger",
      },
      {
        label: "Saldo",
        value: formatIDR(all?.balance ?? 0),
        icon: "CreditCard",
        color: "info",
      },
      {
        label: "Minggu Ini (Netto)",
        value: formatIDR(week?.net ?? 0),
        icon: "Calendar",
        color: (week?.net ?? 0) >= 0 ? "success" : "danger",
      },
      {
        label: "Bulan Ini (Netto)",
        value: formatIDR(month?.net ?? 0),
        icon: "Calendar",
        color: (month?.net ?? 0) >= 0 ? "success" : "danger",
      },
      {
        label: "Pemasukan Bulan Ini",
        value: formatIDR(month?.income ?? 0),
        icon: "ArrowUpRight",
        color: "success",
      },
      {
        label: "Pengeluaran Bulan Ini",
        value: formatIDR(month?.expense ?? 0),
        icon: "ArrowDownRight",
        color: "danger",
      },
      {
        label: "Update Terbaru",
        value: recentCount > 0 ? `${recentCount} transaksi` : "—",
        icon: "Clock",
        color: "default",
      },
    ];
  }, [dashboardQuery.data]);

  return (
    <PermissionGate permission="finance.view">
      <div className="space-y-6">
        <PageHeader
          title="Keuangan Organisasi"
          subtitle="Catat pemasukan dan pengeluaran, analisis arus kas, dan pantau saldo organisasi."
          actions={
            canCreate ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openModal("income")}
                  className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Pemasukan
                </button>
                <button
                  type="button"
                  onClick={() => openModal("expense")}
                  className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Pengeluaran
                </button>
              </div>
            ) : undefined
          }
        />

        <StatsGrid stats={stats} className="mb-2" />

        <FinanceAnalytics
          data={dashboardQuery.data}
          isLoading={dashboardQuery.isLoading}
          chartDays={chartDays}
          onChartDaysChange={setChartDays}
        />

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-foreground">Semua Transaksi</h2>
            <div className="flex flex-wrap items-center gap-3">
              <CustomSelect
                value={typeFilter}
                onChange={setTypeFilter}
                placeholder="Semua jenis"
                options={[
                  { label: "Semua jenis", value: "" },
                  { label: "Pemasukan", value: "income" },
                  { label: "Pengeluaran", value: "expense" },
                ]}
                className="min-w-[180px]"
              />
              {canManageCategories && (
                <Link
                  href="/resources/finance-categories"
                  className="text-sm text-accent hover:underline"
                >
                  Kelola kategori
                </Link>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-bg-tertiary text-left text-xs uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3">Bukti</th>
                </tr>
              </thead>
              <tbody>
                {txQuery.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                )}
                {!txQuery.isLoading && (txQuery.data?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                      Belum ada transaksi.
                    </td>
                  </tr>
                )}
                {(txQuery.data ?? []).map((tx) => {
                  const cat = tx.category as { name?: string } | null | undefined;
                  return (
                    <tr key={tx.id} className="border-b border-border/60 hover:bg-bg-hover/40">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {tx.transaction_date
                          ? new Date(tx.transaction_date).toLocaleDateString("id-ID")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.type === "income"
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger"
                          }`}
                        >
                          {typeLabel(tx.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{cat?.name ?? "—"}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{tx.description || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        {formatIDR(Number(tx.amount))}
                      </td>
                      <td className="px-4 py-3">
                        {tx.proof_url ? (
                          <a
                            href={tx.proof_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Lihat
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12">
          <div className="w-full max-w-lg rounded-xl border border-border bg-bg-secondary shadow-xl">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">
                Catat {form.type === "income" ? "Pemasukan" : "Pengeluaran"}
              </h2>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Nominal (Rp) *
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm font-mono"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Kategori *
                </label>
                <CustomSelect
                  value={form.category_id}
                  onChange={(v) => setForm((f) => ({ ...f, category_id: v }))}
                  placeholder="Pilih kategori…"
                  options={categoryOptions}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Keterangan *
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                  placeholder="Untuk kegiatan apa transaksi ini?"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Tanggal *
                </label>
                <input
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => setForm((f) => ({ ...f, transaction_date: e.target.value }))}
                  className="w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Bukti Transaksi
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-bg-tertiary px-4 py-3 text-sm text-text-secondary hover:border-accent">
                  {uploadingProof ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {form.proof_url ? "Ganti file bukti" : "Upload bukti (foto/PDF)"}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingProof(true);
                      try {
                        const res = await uploadFile(file);
                        const d = (res.data ?? res) as Record<string, unknown>;
                        setForm((f) => ({ ...f, proof_url: String(d.url || "") }));
                      } finally {
                        setUploadingProof(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                {form.proof_url && (
                  <a
                    href={form.proof_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Pratinjau bukti
                  </a>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg-hover"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={createTx.isPending || uploadingProof}
                onClick={() => createTx.mutate()}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {createTx.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </PermissionGate>
  );
}
