import { defineResource } from "@/lib/resource";
import { getWebAppUrl } from "@/lib/panel-access";

function publicRecruitmentUrl(slug: string): string {
  return `${getWebAppUrl()}/recruitment/${encodeURIComponent(slug)}`;
}

export const recruitmentResource = defineResource({
  name: "Recruitment",
  slug: "recruitments",
  endpoint: "/api/recruitments",
  icon: "Database",
  label: { singular: "Recruitment", plural: "Recruitments" },
  viewPermission: "recruitment.manage",
  table: {
    columns: [
      // grit:cols:auto-start
      { key: "title", label: "Title", sortable: true, searchable: true },
      { key: "description", label: "Description", searchable: true },
      { key: "slug", label: "Slug", sortable: true, searchable: true },
      {
        key: "public_link",
        label: "Link",
        cell: (row) => {
          const slug = typeof row.slug === "string" ? row.slug.trim() : "";
          if (!slug) return "—";
          const href = publicRecruitmentUrl(slug);
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-[220px] truncate text-sm text-accent hover:underline"
              title={href}
            >
              /recruitment/{slug}
            </a>
          );
        },
      },
      {
        key: "manage",
        label: "Manage",
        cell: (row) => {
          const id = typeof row.id === "string" ? row.id : "";
          if (!id) return "—";
          return (
            <a
              href={`/myorg/recruitments/${id}/submissions`}
              className="text-sm text-accent hover:underline"
            >
              Submissions
            </a>
          );
        },
      },
      { key: "open_date", label: "Open Date", sortable: true, format: "relative" },
      { key: "close_date", label: "Close Date", sortable: true, format: "relative" },
      {
        key: "status",
        label: "Status",
        sortable: true,
        format: "badge",
        badge: {
          draft: { color: "muted", label: "Draft" },
          open: { color: "success", label: "Open" },
          closed: { color: "danger", label: "Closed" },
        },
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
          { label: "Draft", value: "draft" },
          { label: "Open", value: "open" },
          { label: "Closed", value: "closed" },
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
      { key: "open_date", label: "Open Date", type: "date" },
      { key: "close_date", label: "Close Date", type: "date" },
      {
        key: "status",
        label: "Status",
        type: "select",
        required: true,
        defaultValue: "draft",
        options: [
          { label: "Draft", value: "draft" },
          { label: "Open", value: "open" },
          { label: "Closed", value: "closed" },
        ],
      },
      // grit:fields:auto-end
    ],
  },
  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Recruitments",
        endpoint: "/api/recruitments",
        icon: "Database",
        color: "accent",
      },
    ],
  },
});
