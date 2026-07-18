import { defineResource } from "@/lib/resource";
import { eventTitle, relatedName, userLabel } from "@/lib/resource-cells";

export const eventSubEventResource = defineResource({
  name: "EventSubEvent",
  slug: "event-sub-events",
  endpoint: "/api/event_sub_events",
  icon: "Calendar",
  label: { singular: "Sub Event", plural: "Sub Event" },
  viewPermission: "events.sub_events.view",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "event", label: "Event", cell: (row) => eventTitle(row) },
      { key: "sie", label: "Sie", cell: (row) => relatedName(row, "sie") },
      { key: "title", label: "Judul", sortable: true, searchable: true },
      { key: "location", label: "Lokasi", sortable: true, searchable: true },
      { key: "start_time", label: "Mulai", sortable: true, format: "relative" },
      { key: "end_time", label: "Selesai", sortable: true, format: "relative" },
      {
        key: "ketua_pelaksana",
        label: "Ketua Pelaksana",
        cell: (row) => userLabel(row, "ketua_pelaksana"),
      },
      {
        key: "attendance_mode",
        label: "Mode Absensi",
        sortable: true,
        format: "badge",
        badge: {
          selfie: { color: "info", label: "Selfie" },
          manual: { color: "warning", label: "Manual" },
        },
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          upcoming: { color: "info", label: "Upcoming" },
          ongoing: { color: "success", label: "Ongoing" },
          finished: { color: "muted", label: "Finished" },
        },
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "attendance_mode",
        label: "Mode Absensi",
        type: "select",
        options: [
          { label: "Selfie", value: "selfie" },
          { label: "Manual", value: "manual" },
        ],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Upcoming", value: "upcoming" },
          { label: "Ongoing", value: "ongoing" },
          { label: "Finished", value: "finished" },
        ],
      },
    ],
    defaultSort: { key: "start_time", direction: "desc" },
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
      },
      {
        key: "sie_id",
        label: "Sie",
        type: "relationship-select",
        relatedEndpoint: "/api/event_committee_sies",
        displayField: "name",
        description: "Kosongkan = seluruh anggota kepanitiaan event",
      },
      { key: "title", label: "Judul", type: "text", required: true },
      { key: "description", label: "Deskripsi", type: "textarea", colSpan: 2 },
      { key: "location", label: "Lokasi", type: "text", required: true },
      { key: "start_time", label: "Waktu Mulai", type: "datetime", required: true },
      { key: "end_time", label: "Waktu Selesai", type: "datetime", required: true },
      {
        key: "ketua_pelaksana_id",
        label: "Ketua Pelaksana",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/users",
        displayField: "full_name",
        description: "Harus anggota kepanitiaan event",
      },
      {
        key: "attendance_mode",
        label: "Mode Absensi",
        type: "select",
        required: true,
        defaultValue: "manual",
        options: [
          { label: "Selfie (user absen sendiri)", value: "selfie" },
          { label: "Manual (Ketua Pelaksana tandai)", value: "manual" },
        ],
      },
      {
        key: "minutes_url",
        label: "Notulensi",
        type: "file",
        accepts: ["pdf", "doc", "image"],
        storeAs: "url",
        maxSizeMB: 10,
        colSpan: 2,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        defaultValue: "upcoming",
        options: [
          { label: "Upcoming", value: "upcoming" },
          { label: "Ongoing", value: "ongoing" },
          { label: "Finished", value: "finished" },
        ],
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Sub Event",
        endpoint: "/api/event_sub_events",
        icon: "Calendar",
        color: "accent",
      },
    ],
  },
});
