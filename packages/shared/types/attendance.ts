export interface Attendance {
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
  status: string;
  selfie_url: string;
  signature_url: string;
  checked_in_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
