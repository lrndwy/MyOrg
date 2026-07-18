"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "@/lib/icons";
import type { FinanceTransaction } from "@repo/shared/types";

export interface FinancePeriodStats {
  income: number;
  expense: number;
  net: number;
}

export interface FinanceSummary {
  total_income: number;
  total_expense: number;
  balance: number;
}

export interface FinanceCashflowPoint {
  date: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
}

export interface FinanceCategoryTotal {
  category_id: string;
  category_name: string;
  type: string;
  total: number;
}

export interface FinanceDashboard {
  all_time: FinanceSummary;
  this_week: FinancePeriodStats;
  this_month: FinancePeriodStats;
  cashflow: FinanceCashflowPoint[];
  income_by_category: FinanceCategoryTotal[];
  expense_by_category: FinanceCategoryTotal[];
  recent_updates: FinanceTransaction[];
}

const CHART_COLORS = {
  income: "var(--success)",
  expense: "var(--danger)",
  net: "var(--accent)",
  balance: "var(--info)",
};

const PIE_PALETTE = [
  "#22c55e",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#64748b",
];

function formatIDR(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const tooltipStyle = {
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function CashflowTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label ? formatShortDate(String(label)) : ""}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatIDR(Number(p.value))}
        </p>
      ))}
    </div>
  );
}

interface FinanceAnalyticsProps {
  data?: FinanceDashboard;
  isLoading: boolean;
  chartDays: number;
  onChartDaysChange: (days: number) => void;
}

export function FinanceAnalytics({ data, isLoading, chartDays, onChartDaysChange }: FinanceAnalyticsProps) {
  const cashflowChart = useMemo(
    () =>
      (data?.cashflow ?? []).map((row) => ({
        ...row,
        label: formatShortDate(row.date),
      })),
    [data?.cashflow],
  );

  const expensePie = useMemo(
    () =>
      (data?.expense_by_category ?? []).map((c) => ({
        name: c.category_name,
        value: c.total,
      })),
    [data?.expense_by_category],
  );

  const incomePie = useMemo(
    () =>
      (data?.income_by_category ?? []).map((c) => ({
        name: c.category_name,
        value: c.total,
      })),
    [data?.income_by_category],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-border bg-bg-secondary">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Grafik & Arus Kas</h2>
        <div className="flex rounded-lg border border-border bg-bg-secondary p-0.5 text-xs">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChartDaysChange(d)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                chartDays === d
                  ? "bg-accent text-white"
                  : "text-text-secondary hover:bg-bg-hover"
              }`}
            >
              {d === 7 ? "7 hari" : d === 30 ? "30 hari" : "90 hari"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-bg-secondary p-4 lg:col-span-2">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Arus kas harian
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="financeIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.income} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS.income} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="financeExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.expense} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS.expense} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--text-muted)" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip content={<CashflowTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Pemasukan"
                  stroke={CHART_COLORS.income}
                  fill="url(#financeIncome)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Pengeluaran"
                  stroke={CHART_COLORS.expense}
                  fill="url(#financeExpense)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg-secondary p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Saldo kumulatif
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="var(--text-muted)" interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatIDR(v)} />
                <Bar dataKey="balance" name="Saldo" fill={CHART_COLORS.balance} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CategoryPie title="Pemasukan per kategori" data={incomePie} emptyLabel="Belum ada pemasukan pada periode ini." />
        <CategoryPie title="Pengeluaran per kategori" data={expensePie} emptyLabel="Belum ada pengeluaran pada periode ini." />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Detail arus kas</h3>
          <p className="text-xs text-text-muted">Pemasukan, pengeluaran, netto, dan saldo berjalan per hari.</p>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-bg-tertiary text-left text-xs uppercase tracking-wider text-text-muted">
              <tr>
                <th className="px-4 py-2">Tanggal</th>
                <th className="px-4 py-2 text-right">Pemasukan</th>
                <th className="px-4 py-2 text-right">Pengeluaran</th>
                <th className="px-4 py-2 text-right">Netto</th>
                <th className="px-4 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cashflowChart.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-text-muted">
                    Tidak ada data arus kas.
                  </td>
                </tr>
              )}
              {[...cashflowChart].reverse().map((row) => (
                <tr key={row.date} className="border-b border-border/60 hover:bg-bg-hover/40">
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(row.date + "T00:00:00").toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-success">
                    {row.income > 0 ? formatIDR(row.income) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-danger">
                    {row.expense > 0 ? formatIDR(row.expense) : "—"}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono ${
                      row.net >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    {formatIDR(row.net)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{formatIDR(row.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-bg-secondary">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Diperbarui terbaru</h3>
          <p className="text-xs text-text-muted">Transaksi yang terakhir dibuat atau diedit.</p>
        </div>
        <div className="divide-y divide-border/60">
          {(data?.recent_updates ?? []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-muted">Belum ada transaksi.</p>
          )}
          {(data?.recent_updates ?? []).map((tx) => {
            const cat = tx.category as { name?: string } | null | undefined;
            return (
              <div key={tx.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-bg-hover/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tx.description || "—"}</p>
                  <p className="text-xs text-text-muted">
                    {cat?.name ?? "—"} · {formatDateTime(tx.updated_at)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      tx.type === "income" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {tx.type === "income" ? "Masuk" : "Keluar"}
                  </span>
                  <p className="mt-1 font-mono text-sm">{formatIDR(Number(tx.amount))}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CategoryPie({
  title,
  data,
  emptyLabel,
}: {
  title: string;
  data: { name: string; value: number }[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</p>
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">{emptyLabel}</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => formatIDR(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
