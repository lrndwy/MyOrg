import { defineResource } from "@/lib/resource";

export const usersResource = defineResource({
  name: "User",
  slug: "users",
  endpoint: "/api/users",
  icon: "Users",
  label: { singular: "User", plural: "Users" },

  table: {
    columns: [
      { key: "first_name", label: "Name", sortable: true, searchable: true, format: "user" },
      { key: "username", label: "Username", sortable: true, searchable: true },
      { key: "full_name", label: "Full Name", searchable: true },
      {
        key: "app_role.name",
        label: "App Role",
      },
      {
        key: "division.name",
        label: "Division",
      },
      {
        key: "role",
        label: "Panel Access",
        sortable: true,
        format: "badge",
        badge: {
          ADMIN: { color: "accent", label: "Admin" },
          EDITOR: { color: "info", label: "Editor" },
          USER: { color: "muted", label: "User" },
          // grit:role-badges
        },
      },
      {
        key: "status",
        label: "Status",
        format: "badge",
        badge: {
          active: { color: "success", label: "Active" },
          inactive: { color: "muted", label: "Inactive" },
          deleted: { color: "danger", label: "Deleted" },
        },
      },
      { key: "created_at", label: "Created", format: "relative", sortable: true },
    ],
    filters: [
      {
        key: "role",
        label: "Panel Access",
        type: "select",
        options: [
          { label: "Admin", value: "ADMIN" },
          { label: "Editor", value: "EDITOR" },
          { label: "User", value: "USER" },
          // grit:role-filters
        ],
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
      },
      { key: "active", label: "Can Login", type: "boolean" },
    ],
    searchable: true,
    searchPlaceholder: "Search by name, username, or email...",
    actions: ["create", "view", "edit", "delete"],
    bulkActions: ["delete"],
    defaultSort: { key: "created_at", direction: "desc" },
    pageSize: 20,
  },

  form: {
    layout: "two-column",
    fields: [
      {
        key: "username",
        label: "Username",
        type: "text",
        required: true,
        placeholder: "dimas.surya",
        description: "Dipakai untuk login (unik)",
        colSpan: 1,
      },
      {
        key: "email",
        label: "Email",
        type: "text",
        required: true,
        placeholder: "user@example.com",
        colSpan: 1,
      },
      {
        key: "password",
        label: "Password",
        type: "text",
        placeholder: "Enter password",
        description: "Wajib saat membuat user baru",
        colSpan: 1,
      },
      {
        key: "full_name",
        label: "Full Name",
        type: "text",
        placeholder: "Nama lengkap",
        colSpan: 1,
      },
      {
        key: "first_name",
        label: "First Name",
        type: "text",
        required: true,
        placeholder: "Nama depan",
        colSpan: 1,
      },
      {
        key: "last_name",
        label: "Last Name",
        type: "text",
        required: true,
        placeholder: "Nama belakang",
        colSpan: 1,
      },
      {
        key: "app_role_id",
        label: "App Role",
        type: "relationship-select",
        relatedEndpoint: "/api/roles",
        displayField: "name",
        description: "Role bisnis MyOrg (permission granular)",
        colSpan: 1,
      },
      {
        key: "division_id",
        label: "Division",
        type: "relationship-select",
        relatedEndpoint: "/api/divisions",
        displayField: "name",
        colSpan: 1,
      },
      {
        key: "role",
        label: "Panel Access",
        type: "select",
        required: true,
        options: [
          { label: "Admin", value: "ADMIN" },
          { label: "Editor", value: "EDITOR" },
          { label: "User", value: "USER" },
          // grit:role-options
        ],
        defaultValue: "USER",
        description: "Akses ke admin panel / tooling Grit",
        colSpan: 1,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ],
        defaultValue: "active",
        colSpan: 1,
      },
      {
        key: "phone",
        label: "Phone",
        type: "text",
        placeholder: "08xxxxxxxxxx",
        colSpan: 1,
      },
      {
        key: "hometown",
        label: "Hometown",
        type: "text",
        placeholder: "Kota asal",
        colSpan: 1,
      },
      {
        key: "birth_date",
        label: "Birth Date",
        type: "date",
        colSpan: 1,
      },
      {
        key: "job_title",
        label: "Job Title",
        type: "text",
        placeholder: "e.g. Ketua Himpunan",
        colSpan: 1,
      },
      {
        key: "avatar",
        label: "Avatar",
        type: "image",
        description: "Foto profil",
        colSpan: 2,
      },
      {
        key: "active",
        label: "Can Login",
        type: "toggle",
        defaultValue: true,
        description: "Nonaktifkan untuk memblokir login",
        colSpan: 1,
      },
    ],
  },

  dashboard: {
    widgets: [
      {
        type: "stat",
        label: "Total Users",
        icon: "Users",
        color: "accent",
        endpoint: "/api/users?page_size=1",
        format: "number",
        colSpan: 1,
      },
      {
        type: "stat",
        label: "Active Users",
        icon: "UserCheck",
        color: "success",
        endpoint: "/api/users?active=true&page_size=1",
        format: "number",
        colSpan: 1,
      },
    ],
  },
});
