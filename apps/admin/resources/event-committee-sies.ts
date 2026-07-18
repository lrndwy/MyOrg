import { defineResource } from "@/lib/resource";
import { eventTitle } from "@/lib/resource-cells";

export const eventCommitteeSieResource = defineResource({
  name: "EventCommitteeSie",
  slug: "event-committee-sies",
  endpoint: "/api/event_committee_sies",
  icon: "Layers",
  label: { singular: "Sie Kepanitiaan", plural: "Sie Kepanitiaan" },
  viewPermission: "events.committee.manage",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "event", label: "Event", cell: (row) => eventTitle(row) },
      { key: "name", label: "Nama Sie", sortable: true, searchable: true },
      { key: "description", label: "Deskripsi", searchable: true },
      { key: "order_index", label: "Urutan", sortable: true },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [],
    defaultSort: { key: "order_index", direction: "asc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    layout: "two-column",
    fields: [
      // grit:fields:auto-start
      {
        key: "event_id",
        label: "Event",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/events",
        displayField: "title",
        description: "Hanya event tipe kepanitiaan",
      },
      { key: "name", label: "Nama Sie", type: "text", required: true },
      { key: "description", label: "Deskripsi", type: "textarea", colSpan: 2 },
      {
        key: "order_index",
        label: "Urutan",
        type: "number",
        numberKind: "int",
        defaultValue: 0,
        description: "Angka lebih kecil tampil lebih dulu",
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Sie",
        endpoint: "/api/event_committee_sies",
        icon: "Layers",
        color: "accent",
      },
    ],
  },
});
