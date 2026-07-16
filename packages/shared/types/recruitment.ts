export interface Recruitment {
  id: string;
  title: string;
  description: string;
  slug: string;
  open_date: string | null;
  close_date: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}
