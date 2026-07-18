export interface Event {
  id: string;
  title: string;
  description: string;
  division_id: string | null;
  division: unknown | null;
  location: string;
  banner_url: string;
  start_time: string | null;
  end_time: string | null;
  allow_permission: boolean;
  event_type: string;
  committee_description: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}
