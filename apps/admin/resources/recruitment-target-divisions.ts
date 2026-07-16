import { defineResource } from "@/lib/resource";
import { divisionName, recruitmentTitle } from "@/lib/resource-cells";

export const recruitmentTargetDivisionResource = defineResource({
  name: "RecruitmentTargetDivision",
  slug: "recruitment-target-divisions",
  endpoint: "/api/recruitment_target_divisions",
  icon: "Database",
  label: { singular: "Recruitment Target Division", plural: "Recruitment Target Divisions" },
  table: {
    columns: [
      // grit:cols:auto-start
      {
        key: "recruitment",
        label: "Recruitment",
        cell: (row) => recruitmentTitle(row),
      },
      {
        key: "division",
        label: "Division",
        cell: (row) => divisionName(row),
      },
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
        key: "recruitment_id",
        label: "Recruitment",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/recruitments",
        displayField: "title",
      },
      {
        key: "division_id",
        label: "Division",
        type: "relationship-select",
        required: true,
        relatedEndpoint: "/api/divisions",
        displayField: "name",
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Recruitment Target Divisions",
        endpoint: "/api/recruitment_target_divisions",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
