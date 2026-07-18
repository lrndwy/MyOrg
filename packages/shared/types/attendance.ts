export interface Attendance {
  id: string;
  event_id: string;
  event: unknown;
  user_id: string;
  user: unknown;
  status: string;
  selfie_url: string;
  signature_url: string;
  checked_in_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
