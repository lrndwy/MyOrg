import { defineResource } from "@/lib/resource";
import { relatedName, userLabel } from "@/lib/resource-cells";

export const eventCommitteeMemberResource = defineResource({
  name: "EventCommitteeMember",
  slug: "event-committee-members",
  endpoint: "/api/event_committee_members",
  icon: "Users",
  label: { singular: "Anggota Sie", plural: "Anggota Sie" },
  viewPermission: "events.committee.manage",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "sie", label: "Sie", cell: (row) => relatedName(row, "sie") },
      { key: "user", label: "User", cell: (row) => userLabel(row) },
      {
        key: "role",
        label: "Peran",
        sortable: true,
        format: "badge",
        badge: {
          ketua_sie: { color: "accent", label: "Ketua Sie" },
          anggota: { color: "muted", label: "Anggota" },
        },
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "role",
        label: "Peran",
        type: "select",
        options: [
          { label: "Ketua Sie", value: "ketua_sie" },
          { label: "Anggota", value: "anggota" },
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
        key: "sie_id",
        label: "Sie",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/event_committee_sies",
        displayField: "name",
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
        key: "role",
        label: "Peran",
        type: "select",
        required: true,
        defaultValue: "anggota",
        options: [
          { label: "Ketua Sie", value: "ketua_sie" },
          { label: "Anggota", value: "anggota" },
        ],
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Anggota",
        endpoint: "/api/event_committee_members",
        icon: "Users",
        color: "accent",
      },
    ],
  },
});
