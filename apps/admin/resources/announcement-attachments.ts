import { defineResource } from "@/lib/resource";
import { announcementTitle } from "@/lib/resource-cells";

export const announcementAttachmentResource = defineResource({
  name: "AnnouncementAttachment",
  slug: "announcement-attachments",
  endpoint: "/api/announcement_attachments",
  icon: "Database",
  label: { singular: "Announcement Attachment", plural: "Announcement Attachments" },
  table: {
    columns: [
      // grit:cols:auto-start
      {
        key: "announcement",
        label: "Announcement",
        cell: (row) => announcementTitle(row),
      },
      { key: "file_url", label: "File", format: "link" },
      { key: "file_type", label: "File Type", sortable: true, searchable: true },
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
      {
        key: "announcement_id",
        label: "Announcement",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/announcements",
        displayField: "title",
      },
      { key: "file_url", label: "File URL", type: "text", required: true },
      { key: "file_type", label: "File Type", type: "text", required: true },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Announcement Attachments",
        endpoint: "/api/announcement_attachments",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
