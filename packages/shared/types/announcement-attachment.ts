export interface AnnouncementAttachment {
  id: string;
  announcement_id: string;
  announcement: unknown | null;
  file_url: string;
  file_type: string;
  version: number;
  created_at: string;
  updated_at: string;
}
