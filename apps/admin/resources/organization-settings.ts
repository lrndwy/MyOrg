import { defineResource } from "@/lib/resource";

export const organizationSettingResource = defineResource({
  name: "OrganizationSetting",
  slug: "organization-settings",
  endpoint: "/api/organization_settings",
  icon: "Settings",
  label: { singular: "Organization Setting", plural: "Organization Settings" },
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "web_name", label: "Web Name", sortable: true, searchable: true },
      { key: "logo_url", label: "Logo", format: "image" },
      { key: "icon_url", label: "Icon", format: "image" },
      { key: "theme", label: "Theme", sortable: true, searchable: true },
      { key: "allow_self_register", label: "Allow Self Register", format: "boolean" },
      {
        key: "allow_cross_division_events_view",
        label: "Cross-Division Events View",
        format: "boolean",
      },
      {
        key: "letterhead_template_url",
        label: "Kop Surat",
        format: "link",
      },
      { key: "letter_place", label: "Tempat Surat", searchable: true },
      { key: "signature_id_label", label: "Label TTD" },
      { key: "created_at", label: "Created", sortable: true, format: "relative" },
      // grit:cols:auto-end
    ],
    filters: [
      { key: "allow_self_register", label: "Allow Self Register", type: "boolean" },
      {
        key: "allow_cross_division_events_view",
        label: "Cross-Division Events View",
        type: "boolean",
      },
    ],
    defaultSort: { key: "created_at", direction: "desc" },
    searchable: true,
    pageSize: 20,
  },
  form: {
    fields: [
      // grit:fields:auto-start
      { key: "web_name", label: "Web Name", type: "text", required: true },
      { key: "logo_url", label: "Logo", type: "image" },
      { key: "icon_url", label: "Icon", type: "image" },
      { key: "theme", label: "Theme", type: "text", required: true },
      { key: "allow_self_register", label: "Allow Self Register", type: "toggle" },
      {
        key: "allow_cross_division_events_view",
        label: "Allow Cross Division Events View",
        type: "toggle",
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Organization Settings",
        endpoint: "/api/organization_settings",
        icon: "Settings",
        color: "accent",
      },
    ],
  },
});
