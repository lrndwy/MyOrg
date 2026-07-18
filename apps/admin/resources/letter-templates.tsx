import { defineResource } from "@/lib/resource";

export const letterTemplateResource = defineResource({
  name: "LetterTemplate",
  slug: "letter-templates",
  endpoint: "/api/letter_templates",
  icon: "LayoutTemplate",
  label: { singular: "Letter Template", plural: "Letter Templates" },
  viewPermission: "letters.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "name", label: "Name", sortable: true, searchable: true },
      { key: "category.name", label: "Category" },
      {
        key: "template_url",
        label: "Template",
        cell: (row) =>
          row.template_url ? (
            <a
              href={String(row.template_url)}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              .docx
            </a>
          ) : (
            "—"
          ),
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
      { key: "name", label: "Nama Template", type: "text", required: true },
      {
        key: "category_id",
        label: "Kategori Surat",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/letter_categories",
        displayField: "name",
      },
      {
        key: "template_url",
        label: "Template .docx",
        type: "file",
        required: true,
        accepts: ["doc"],
        storeAs: "url",
        maxSizeMB: 10,
        description:
          "File Word (.docx) dengan placeholder seperti {NOMOR_SURAT}, {NAMA_KEGIATAN}, dll.",
        colSpan: 2,
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Letter Templates",
        endpoint: "/api/letter_templates",
        icon: "LayoutTemplate",
        color: "accent",
      },
    ],
  },
});
