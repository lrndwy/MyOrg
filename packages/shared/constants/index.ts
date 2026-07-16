export const ROLES = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  USER: "USER",
  // grit:role-constants
} as const;

/** Grit Panel Access roles that may open the admin app (port 3001). */
export const ADMIN_PANEL_ROLES: readonly string[] = [ROLES.ADMIN, ROLES.EDITOR];

export function canAccessAdminPanel(role: string | null | undefined): boolean {
  return role != null && ADMIN_PANEL_ROLES.includes(role);
}

export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    REGISTER: "/api/auth/register",
    REFRESH: "/api/auth/refresh",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
    FORGOT_PASSWORD: "/api/auth/forgot-password",
    RESET_PASSWORD: "/api/auth/reset-password",
    OAUTH: {
      GOOGLE: "/api/auth/oauth/google",
      GITHUB: "/api/auth/oauth/github",
    },
  },
  USERS: {
    LIST: "/api/users",
    GET: (id: string) => `/api/users/${id}`,
    UPDATE: (id: string) => `/api/users/${id}`,
    DELETE: (id: string) => `/api/users/${id}`,
  },
  UPLOADS: {
    CREATE: "/api/uploads",
    LIST: "/api/uploads",
    GET: (id: string) => `/api/uploads/${id}`,
    DELETE: (id: string) => `/api/uploads/${id}`,
  },
  AI: {
    COMPLETE: "/api/ai/complete",
    CHAT: "/api/ai/chat",
    STREAM: "/api/ai/stream",
  },
  ADMIN: {
    JOBS_STATS: "/api/admin/jobs/stats",
    JOBS_LIST: (status: string) => `/api/admin/jobs/${status}`,
    JOBS_RETRY: (id: string) => `/api/admin/jobs/${id}/retry`,
    JOBS_CLEAR: (queue: string) => `/api/admin/jobs/queue/${queue}`,
    CRON_TASKS: "/api/admin/cron/tasks",
  },
  PROFILE: {
    GET: "/api/profile",
    UPDATE: "/api/profile",
    DELETE: "/api/profile",
  },
  HEALTH: "/api/health",
  DIVISIONS: {
    LIST: "/api/divisions",
    GET: (id: number) => `/api/divisions/${id}`,
    CREATE: "/api/divisions",
    UPDATE: (id: number) => `/api/divisions/${id}`,
    DELETE: (id: number) => `/api/divisions/${id}`,
  },
  ROLES: {
    LIST: "/api/roles",
    GET: (id: number) => `/api/roles/${id}`,
    CREATE: "/api/roles",
    UPDATE: (id: number) => `/api/roles/${id}`,
    DELETE: (id: number) => `/api/roles/${id}`,
  },
  PERMISSIONS: {
    LIST: "/api/permissions",
    GET: (id: number) => `/api/permissions/${id}`,
    CREATE: "/api/permissions",
    UPDATE: (id: number) => `/api/permissions/${id}`,
    DELETE: (id: number) => `/api/permissions/${id}`,
  },
  ROLE_PERMISSIONS: {
    LIST: "/api/role_permissions",
    GET: (id: number) => `/api/role_permissions/${id}`,
    CREATE: "/api/role_permissions",
    UPDATE: (id: number) => `/api/role_permissions/${id}`,
    DELETE: (id: number) => `/api/role_permissions/${id}`,
  },
  ORGANIZATION_SETTINGS: {
    LIST: "/api/organization_settings",
    GET: (id: number) => `/api/organization_settings/${id}`,
    CREATE: "/api/organization_settings",
    UPDATE: (id: number) => `/api/organization_settings/${id}`,
    DELETE: (id: number) => `/api/organization_settings/${id}`,
  },
  EVENTS: {
    LIST: "/api/events",
    GET: (id: number) => `/api/events/${id}`,
    CREATE: "/api/events",
    UPDATE: (id: number) => `/api/events/${id}`,
    DELETE: (id: number) => `/api/events/${id}`,
  },
  ATTENDANCES: {
    LIST: "/api/attendances",
    GET: (id: number) => `/api/attendances/${id}`,
    CREATE: "/api/attendances",
    UPDATE: (id: number) => `/api/attendances/${id}`,
    DELETE: (id: number) => `/api/attendances/${id}`,
  },
  PERMISSION_REQUESTS: {
    LIST: "/api/permission_requests",
    GET: (id: number) => `/api/permission_requests/${id}`,
    CREATE: "/api/permission_requests",
    UPDATE: (id: number) => `/api/permission_requests/${id}`,
    DELETE: (id: number) => `/api/permission_requests/${id}`,
  },
  VIOLATIONS: {
    LIST: "/api/violations",
    GET: (id: number) => `/api/violations/${id}`,
    CREATE: "/api/violations",
    UPDATE: (id: number) => `/api/violations/${id}`,
    DELETE: (id: number) => `/api/violations/${id}`,
  },
  RECRUITMENTS: {
    LIST: "/api/recruitments",
    GET: (id: number) => `/api/recruitments/${id}`,
    CREATE: "/api/recruitments",
    UPDATE: (id: number) => `/api/recruitments/${id}`,
    DELETE: (id: number) => `/api/recruitments/${id}`,
  },
  RECRUITMENT_TARGET_DIVISIONS: {
    LIST: "/api/recruitment_target_divisions",
    GET: (id: number) => `/api/recruitment_target_divisions/${id}`,
    CREATE: "/api/recruitment_target_divisions",
    UPDATE: (id: number) => `/api/recruitment_target_divisions/${id}`,
    DELETE: (id: number) => `/api/recruitment_target_divisions/${id}`,
  },
  RECRUITMENT_CUSTOM_FIELDS: {
    LIST: "/api/recruitment_custom_fields",
    GET: (id: number) => `/api/recruitment_custom_fields/${id}`,
    CREATE: "/api/recruitment_custom_fields",
    UPDATE: (id: number) => `/api/recruitment_custom_fields/${id}`,
    DELETE: (id: number) => `/api/recruitment_custom_fields/${id}`,
  },
  RECRUITMENT_SUBMISSIONS: {
    LIST: "/api/recruitment_submissions",
    GET: (id: number) => `/api/recruitment_submissions/${id}`,
    CREATE: "/api/recruitment_submissions",
    UPDATE: (id: number) => `/api/recruitment_submissions/${id}`,
    DELETE: (id: number) => `/api/recruitment_submissions/${id}`,
  },
  LETTER_CATEGORIES: {
    LIST: "/api/letter_categories",
    GET: (id: number) => `/api/letter_categories/${id}`,
    CREATE: "/api/letter_categories",
    UPDATE: (id: number) => `/api/letter_categories/${id}`,
    DELETE: (id: number) => `/api/letter_categories/${id}`,
  },
  LETTERS: {
    LIST: "/api/letters",
    GET: (id: number) => `/api/letters/${id}`,
    CREATE: "/api/letters",
    UPDATE: (id: number) => `/api/letters/${id}`,
    DELETE: (id: number) => `/api/letters/${id}`,
  },
  ANNOUNCEMENTS: {
    LIST: "/api/announcements",
    GET: (id: number) => `/api/announcements/${id}`,
    CREATE: "/api/announcements",
    UPDATE: (id: number) => `/api/announcements/${id}`,
    DELETE: (id: number) => `/api/announcements/${id}`,
  },
  ANNOUNCEMENT_ATTACHMENTS: {
    LIST: "/api/announcement_attachments",
    GET: (id: number) => `/api/announcement_attachments/${id}`,
    CREATE: "/api/announcement_attachments",
    UPDATE: (id: number) => `/api/announcement_attachments/${id}`,
    DELETE: (id: number) => `/api/announcement_attachments/${id}`,
  },
  LETTER_TEMPLATES: {
    LIST: "/api/letter_templates",
    GET: (id: number) => `/api/letter_templates/${id}`,
    CREATE: "/api/letter_templates",
    UPDATE: (id: number) => `/api/letter_templates/${id}`,
    DELETE: (id: number) => `/api/letter_templates/${id}`,
  },
  // grit:api-routes
} as const;
