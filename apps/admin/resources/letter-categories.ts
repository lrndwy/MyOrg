import { defineResource } from "@/lib/resource";

export const letterCategoryResource = defineResource({
  name: "LetterCategory",
  slug: "letter-categories",
  endpoint: "/api/letter_categories",
  icon: "FolderTree",
  label: { singular: "Letter Category", plural: "Letter Categories" },
  viewPermission: "letters.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true },
      { key: "code", label: "Code", sortable: true, searchable: true },
      { key: "start_number", label: "Start Number", sortable: true },
      { key: "current_number", label: "Current Number", sortable: true },
      { key: "number_format_template", label: "Number Format Template", sortable: true, searchable: true },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
    { key: "name", label: "Name", type: "text", required: true },
    { key: "code", label: "Code", type: "text", required: true },
    { key: "start_number", label: "Start Number", type: "number", numberKind: "int" },
    { key: "current_number", label: "Current Number", type: "number", numberKind: "int" },
    {
      key: "number_format_template",
      label: "Number Format Template",
      type: "text",
      required: true,
      placeholder: "{number_padded}/{code}/{month_roman}/{year}",
      description: `Template nomor surat otomatis (berdasarkan tanggal surat).

Nomor & kategori:
• {number} / {nomor} — nomor urut
• {number_padded} / {nomor_padded} — nomor 3 digit (007)
• {number_padded_2} — nomor 2 digit (07)
• {number_padded_4} — nomor 4 digit (0007)
• {code} / {kategori} — kode kategori (UND)
• {name} / {nama_kategori} — nama kategori

Tanggal:
• {year} / {tahun} — tahun 4 digit
• {year_short} / {tahun_pendek} — tahun 2 digit (26)
• {month} / {bulan_angka} — bulan angka (7)
• {month_padded} / {bulan} — bulan 2 digit (07)
• {month_roman} / {bulan_romawi} — bulan Romawi (VII)
• {month_name} / {bulan_nama} — nama bulan (Juli)
• {day} / {hari_angka} — tanggal (16)
• {day_padded} / {hari} — tanggal 2 digit (16)
• {date} — YYYY-MM-DD
• {date_id} / {tanggal} — DD/MM/YYYY
• {weekday} / {hari_nama} — nama hari (Kamis)
• {weekday_short} — nama hari singkat (Kam)

Contoh: {number_padded}/{code}/{month_roman}/{year} → 007/UND/VII/2026`,
      colSpan: 2,
    },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Letter Categories",
        endpoint: "/api/letter_categories",
        icon: "FolderTree",
        color: "accent",
      },
    ],
  },
});
