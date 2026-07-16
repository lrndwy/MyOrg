import { defineResource } from "@/lib/resource";
import { divisionName, jsonPreview, recruitmentTitle } from "@/lib/resource-cells";

export const recruitmentSubmissionResource = defineResource({
  name: "RecruitmentSubmission",
  slug: "recruitment-submissions",
  endpoint: "/api/recruitment_submissions",
  icon: "Database",
  label: { singular: "Recruitment Submission", plural: "Recruitment Submissions" },
  table: {
    columns: [
      // grit:cols:auto-start
      {
        key: "recruitment",
        label: "Recruitment",
        cell: (row) => recruitmentTitle(row),
      },
      { key: "name", label: "Name", sortable: true, searchable: true },
      {
        key: "division_interest",
        label: "Division Interest",
        cell: (row) => divisionName(row, "division_interest"),
      },
      { key: "contact", label: "Contact", sortable: true, searchable: true },
      {
        key: "custom_answers",
        label: "Custom Answers",
        cell: (row) => jsonPreview(row.custom_answers),
      },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          submitted: { color: "info", label: "Submitted" },
          interview: { color: "warning", label: "Interview" },
          accepted: { color: "success", label: "Accepted" },
          rejected: { color: "danger", label: "Rejected" },
        },
      },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      { key: "nim", label: "Nim", sortable: true, searchable: true },
      // grit:cols:auto-end
    ],
    filters: [
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Submitted", value: "submitted" },
          { label: "Interview", value: "interview" },
          { label: "Accepted", value: "accepted" },
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
        key: "recruitment_id",
        label: "Recruitment",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/recruitments",
        displayField: "title",
      },
      { key: "name", label: "Name", type: "text", required: true },
      {
        key: "division_interest_id",
        label: "Division Interest",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/divisions",
        displayField: "name",
      },
      { key: "contact", label: "Contact", type: "text", required: true },
      {
        key: "custom_answers",
        label: "Custom Answers",
        type: "textarea",
        description: "JSON object of custom field answers",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        defaultValue: "submitted",
        options: [
          { label: "Submitted", value: "submitted" },
          { label: "Interview", value: "interview" },
          { label: "Accepted", value: "accepted" },
          { label: "Rejected", value: "rejected" },
        ],
      },
      { key: "nim", label: "Nim", type: "text" },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Recruitment Submissions",
        endpoint: "/api/recruitment_submissions",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
