export interface PermissionRequest {
  id: string;
  event_id: string;
  event: unknown;
  user_id: string;
  user: unknown;
  reason: string;
  proof_url: string;
  status: string;
  reviewed_by_id: string | null;
  reviewed_by: unknown | null;
  review_note: string;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
