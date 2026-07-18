import { defineResource } from "@/lib/resource";
import { eventTitle, userLabel } from "@/lib/resource-cells";

export const permissionRequestResource = defineResource({
  name: "PermissionRequest",
  slug: "permission-requests",
  endpoint: "/api/permission_requests",
  icon: "Lock",
  label: { singular: "Permission Request", plural: "Permission Requests" },
  viewPermission: "attendance.approve",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "event", label: "Event", cell: (row) => eventTitle(row) },
      { key: "user", label: "User", cell: (row) => userLabel(row) },
      { key: "reason", label: "Reason", searchable: true },
      { key: "proof_url", label: "Proof", format: "image" },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          pending: { color: "warning", label: "Pending" },
          approved: { color: "success", label: "Approved" },
          rejected: { color: "danger", label: "Rejected" },
        },
      },
      {
        key: "reviewed_by",
        label: "Reviewed By",
        cell: (row) => userLabel(row, "reviewed_by"),
      },
      { key: "review_note", label: "Review Note", searchable: true },
      { key: "reviewed_at", label: "Reviewed At", sortable: true, format: "relative" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Approved", value: "approved" },
          { label: "Rejected", value: "rejected" },
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
      { key: "reason", label: "Reason", type: "textarea" },
      { key: "proof_url", label: "Proof", type: "image", required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        defaultValue: "pending",
        options: [
          { label: "Pending", value: "pending" },
          { label: "Approved", value: "approved" },
          { label: "Rejected", value: "rejected" },
        ],
      },
      {
        key: "reviewed_by_id",
        label: "Reviewed By",
        type: "relationship-select",
        relatedEndpoint: "/api/users",
        displayField: "full_name",
      },
      { key: "review_note", label: "Review Note", type: "textarea" },
      { key: "reviewed_at", label: "Reviewed At", type: "datetime" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Permission Requests",
        endpoint: "/api/permission_requests",
        icon: "Lock",
        color: "accent",
      },
    ],
  },
});
