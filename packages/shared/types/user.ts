export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "ADMIN" | "EDITOR" | "USER"; // grit:role-union
  avatar: string;
  job_title: string;
  bio: string;
  active: boolean;
  provider: string;
  email_verified_at: string | null;
  ip_address: string;
  mac_address: string;
  // MyOrg fields
  username?: string;
  full_name?: string;
  birth_date?: string | null;
  hometown?: string;
  phone?: string;
  division_id?: string | null;
  app_role_id?: string | null;
  status?: string;
  division?: { id: string; name: string } | null;
  app_role?: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  identifier?: string;
  username?: string;
  email?: string;
  password: string;
}

export interface RegisterRequest {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  mac_address?: string; // optional — provided by client if obtainable
}

export interface AuthResponse {
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}
