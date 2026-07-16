export interface PermissionRequest {
  id: string;
  event_id: string;
  event: { id?: string; title?: string } | null;
  user_id: string;
  user: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
  } | null;
  reason: string;
  proof_url: string;
  status: string;
  reviewed_by_id: string | null;
  reviewed_by: {
    id?: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    email?: string;
  } | null;
  review_note: string;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
