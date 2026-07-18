export interface EventSubEvent {
  id: string;
  event_id: string;
  event: unknown;
  sie_id: string;
  sie: unknown;
  title: string;
  description: string;
  location: string;
  start_time: string | null;
  end_time: string | null;
  ketua_pelaksana_id: string;
  ketua_pelaksana: unknown;
  attendance_mode: string;
  minutes_url: string;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}
