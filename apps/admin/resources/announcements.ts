import { defineResource } from "@/lib/resource";
import { divisionName } from "@/lib/resource-cells";

export const announcementResource = defineResource({
  name: "Announcement",
  slug: "announcements",
  endpoint: "/api/announcements",
  icon: "Database",
  label: { singular: "Announcement", plural: "Announcements" },
  viewPermission: "announcement.create",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "title", label: "Title", sortable: true, searchable: true },
      { key: "content", label: "Content", searchable: true, format: "richtext" },
      {
        key: "target_type",
        label: "Target Type",
        sortable: true,
        format: "badge",
        badge: {
          all: { color: "accent", label: "All" },
          division: { color: "info", label: "Division" },
        },
      },
      {
        key: "target_division",
        label: "Target Division",
        cell: (row) => divisionName(row, "target_division"),
      },
      { key: "publish_date", label: "Publish Date", sortable: true, format: "relative" },
      {
        key: "attachments",
        label: "Attachments",
        cell: (row) => {
          const list = row.attachments;
          if (!Array.isArray(list) || list.length === 0) return "—";
          return `${list.length} file${list.length === 1 ? "" : "s"}`;
        },
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "target_type",
        label: "Target Type",
        type: "select",
        options: [
          { label: "All", value: "all" },
          { label: "Division", value: "division" },
        ],
      },
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
      { key: "title", label: "Title", type: "text", required: true },
      { key: "content", label: "Content", type: "richtext" },
      {
        key: "target_type",
        label: "Target Type",
        type: "select",
        required: true,
        defaultValue: "all",
        options: [
          { label: "All", value: "all" },
          { label: "Division", value: "division" },
        ],
      },
      {
        key: "target_division_id",
        label: "Target Division",
        type: "relationship-select",
        relatedEndpoint: "/api/divisions",
        displayField: "name",
        description: "Required when target type is Division",
      },
      { key: "publish_date", label: "Publish Date", type: "datetime" },
      {
        key: "attachments",
        label: "Attachments",
        type: "files",
        accepts: ["all"],
        max: 10,
        maxSizeMB: 20,
        description: "Bisa lebih dari satu — unggah gambar atau dokumen. Drag untuk urutkan.",
        dropzone: "default",
        reorderable: true,
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Announcements",
        endpoint: "/api/announcements",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
