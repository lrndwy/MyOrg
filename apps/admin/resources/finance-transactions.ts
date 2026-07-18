import { defineResource } from "@/lib/resource";
import { userLabel } from "@/lib/resource-cells";

function formatIDR(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}

export const financeTransactionResource = defineResource({
  name: "FinanceTransaction",
  slug: "finance-transactions",
  endpoint: "/api/finance_transactions",
  icon: "CreditCard",
  label: { singular: "Transaksi Keuangan", plural: "Transaksi Keuangan" },
  viewPermission: "finance.view",
  table: {
    columns: [
      {
        key: "type",
        label: "Jenis",
        sortable: true,
        format: "badge",
        badge: {
          income: { color: "success", label: "Pemasukan" },
          expense: { color: "danger", label: "Pengeluaran" },
        },
      },
      {
        key: "amount",
        label: "Nominal",
        sortable: true,
        cell: (row) => formatIDR(row.amount),
      },
      { key: "description", label: "Keterangan", searchable: true },
      { key: "proof_url", label: "Bukti", format: "link" },
      { key: "transaction_date", label: "Tanggal", sortable: true, format: "date" },
      {
        key: "category",
        label: "Kategori",
        cell: (row) => {
          const cat = row.category as { name?: string } | null | undefined;
          return cat?.name ?? "—";
        },
      },
      {
        key: "recorded_by",
        label: "Dicatat Oleh",
        cell: (row) => userLabel(row, "recorded_by"),
      },
      { key: "created_at", label: "Dibuat", sortable: true, format: "relative" },
    ],
    filters: [
      {
        key: "type",
        label: "Jenis",
        type: "select",
        options: [
          { label: "Pemasukan", value: "income" },
          { label: "Pengeluaran", value: "expense" },
        ],
      },
    ],
    defaultSort: { key: "transaction_date", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      {
        key: "type",
        label: "Jenis",
        type: "select",
        required: true,
        options: [
          { label: "Pemasukan", value: "income" },
          { label: "Pengeluaran", value: "expense" },
        ],
      },
      { key: "amount", label: "Nominal (Rp)", type: "number", numberKind: "float", required: true },
      { key: "description", label: "Keterangan", type: "textarea", required: true },
      {
        key: "proof_url",
        label: "Bukti Transaksi",
        type: "file",
        accept: "image/*,application/pdf",
        description: "Upload foto/PDF bukti (struk, invoice, dll.)",
      },
      {
        key: "transaction_date",
        label: "Tanggal",
        type: "date",
        required: true,
        defaultValue: new Date().toISOString().slice(0, 10),
      },
      {
        key: "category_id",
        label: "Kategori",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/finance_categories",
        displayField: "name",
        placeholder: "Pilih kategori…",
      },
    ],
  },
});
