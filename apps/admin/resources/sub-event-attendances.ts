import { defineResource } from "@/lib/resource";
import { subEventTitle, userLabel } from "@/lib/resource-cells";

export const subEventAttendanceResource = defineResource({
  name: "SubEventAttendance",
  slug: "sub-event-attendances",
  endpoint: "/api/sub_event_attendances",
  icon: "CheckSquare",
  label: { singular: "Absensi Sub Event", plural: "Absensi Sub Event" },
  viewPermission: "events.sub_events.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "sub_event", label: "Sub Event", cell: (row) => subEventTitle(row) },
      { key: "user", label: "User", cell: (row) => userLabel(row) },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          present: { color: "success", label: "Hadir" },
          absent: { color: "danger", label: "Tidak Hadir" },
        },
      },
      { key: "selfie_url", label: "Selfie", format: "image" },
      { key: "signature_url", label: "Tanda Tangan", format: "image" },
      { key: "checked_in_at", label: "Waktu Absen", sortable: true, format: "relative" },
      {
        key: "marked_by",
        label: "Ditandai Oleh",
        cell: (row) => userLabel(row, "marked_by"),
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Hadir", value: "present" },
          { label: "Tidak Hadir", value: "absent" },
        ],
      },
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    layout: "two-column",
    fields: [
      // grit:fields:auto-start
      {
        key: "sub_event_id",
        label: "Sub Event",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/event_sub_events",
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
          { label: "Hadir", value: "present" },
          { label: "Tidak Hadir", value: "absent" },
        ],
      },
      { key: "selfie_url", label: "Selfie", type: "image" },
      { key: "signature_url", label: "Tanda Tangan", type: "image" },
      { key: "checked_in_at", label: "Waktu Absen", type: "datetime" },
      {
        key: "marked_by_id",
        label: "Ditandai Oleh",
        type: "relationship-select",
        relatedEndpoint: "/api/users",
        displayField: "full_name",
        description: "Diisi saat absensi mode manual",
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Absensi Sub Event",
        endpoint: "/api/sub_event_attendances",
        icon: "CheckSquare",
        color: "accent",
      },
    ],
  },
});
