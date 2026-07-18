export interface SubEventAttendance {
  id: string;
  sub_event_id: string;
  sub_event: unknown;
  user_id: string;
  user: unknown;
  status: string;
  selfie_url: string;
  signature_url: string;
  checked_in_at: string | null;
  marked_by_id: string | null;
  marked_by: unknown | null;
  version: number;
  created_at: string;
  updated_at: string;
}
