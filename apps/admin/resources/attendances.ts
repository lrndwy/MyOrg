import { defineResource } from "@/lib/resource";
import { eventTitle, userLabel } from "@/lib/resource-cells";

export const attendanceResource = defineResource({
  name: "Attendance",
  slug: "attendances",
  endpoint: "/api/attendances",
  icon: "Database",
  label: { singular: "Attendance", plural: "Attendances" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "event", label: "Event", cell: (row) => eventTitle(row) },
      { key: "user", label: "User", cell: (row) => userLabel(row) },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          present: { color: "success", label: "Present" },
          absent: { color: "danger", label: "Absent" },
          permitted: { color: "info", label: "Permitted" },
          late: { color: "warning", label: "Late" },
        },
      },
      { key: "selfie_url", label: "Selfie", format: "image" },
      { key: "signature_url", label: "Signature", format: "image" },
      { key: "checked_in_at", label: "Checked In At", sortable: true, format: "relative" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Present", value: "present" },
          { label: "Absent", value: "absent" },
          { label: "Permitted", value: "permitted" },
          { label: "Late", value: "late" },
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
      {
        key: "event_id",
        label: "Event",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/events",
        displayField: "title",
      },
      {
        key: "user_id",
        label: "User",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/users",
        displayField: "full_name",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        defaultValue: "present",
        options: [
          { label: "Present", value: "present" },
          { label: "Absent", value: "absent" },
          { label: "Permitted", value: "permitted" },
          { label: "Late", value: "late" },
        ],
      },
      { key: "selfie_url", label: "Selfie", type: "image" },
      { key: "signature_url", label: "Signature", type: "image" },
      { key: "checked_in_at", label: "Checked In At", type: "datetime" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Attendances",
        endpoint: "/api/attendances",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
