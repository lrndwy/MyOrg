import { defineResource } from "@/lib/resource";

export const eventResource = defineResource({
  name: "Event",
  slug: "events",
  endpoint: "/api/events",
  icon: "Calendar",
  label: { singular: "Event", plural: "Events" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "title", label: "Title", sortable: true, searchable: true },
      { key: "description", label: "Description", searchable: true },
      { key: "division.name", label: "Division" },
      { key: "location", label: "Location", sortable: true, searchable: true },
      { key: "banner_url", label: "Banner", format: "image" },
      { key: "start_time", label: "Start Time", sortable: true, format: "relative" },
      { key: "end_time", label: "End Time", sortable: true, format: "relative" },
      { key: "allow_permission", label: "Allow Permission", format: "boolean" },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          upcoming: { color: "info", label: "Upcoming" },
          ongoing: { color: "success", label: "Ongoing" },
          finished: { color: "muted", label: "Finished" },
          cancelled: { color: "danger", label: "Cancelled" },
        },
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      { key: "division", label: "Division" },
      // grit:cols:auto-end
    ],
    filters: [
      { key: "allow_permission", label: "Allow Permission", type: "boolean" },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Upcoming", value: "upcoming" },
          { label: "Ongoing", value: "ongoing" },
          { label: "Finished", value: "finished" },
          { label: "Cancelled", value: "cancelled" },
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
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "division_id",
        label: "Division",
        type: "relationship-select",
        relatedEndpoint: "/api/divisions",
        displayField: "name",
        description: "Kosongkan = General event",
      },
      { key: "location", label: "Location", type: "text", required: true },
      { key: "banner_url", label: "Banner", type: "image" },
      { key: "start_time", label: "Start Time", type: "datetime" },
      { key: "end_time", label: "End Time", type: "datetime" },
      { key: "allow_permission", label: "Allow Permission", type: "toggle" },
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
          { label: "Cancelled", value: "cancelled" },
        ],
      },
      { key: "division", label: "Division", type: "text" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Events",
        endpoint: "/api/events",
        icon: "Calendar",
        color: "accent",
      },
    ],
  },
});
