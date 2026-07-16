export interface Announcement {
  id: string;
  title: string;
  content: string;
  target_type: string;
  target_division_id: string | null;
  target_division: unknown | null;
  publish_date: string | null;
  attachments: unknown[];
  version: number;
  created_at: string;
  updated_at: string;
}
