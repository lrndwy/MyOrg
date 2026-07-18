import { defineResource } from "@/lib/resource";

export const financeCategoryResource = defineResource({
  name: "FinanceCategory",
  slug: "finance-categories",
  endpoint: "/api/finance_categories",
  icon: "FolderTree",
  label: { singular: "Kategori Keuangan", plural: "Kategori Keuangan" },
  viewPermission: "finance.categories",
  viewPermissions: ["finance.manage"],
  table: {
    columns: [
      { key: "name", label: "Nama", sortable: true, searchable: true },
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
      { key: "description", label: "Keterangan", searchable: true },
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
    defaultSort: { key: "name", direction: "asc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      { key: "name", label: "Nama Kategori", type: "text", required: true },
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
      { key: "description", label: "Keterangan", type: "textarea" },
    ],
  },
});
