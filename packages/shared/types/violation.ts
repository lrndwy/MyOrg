export interface Violation {
  id: string;
  user_id: string;
  user: unknown;
  violation_type: string;
  description: string;
  sp_level: string;
  document_url: string;
  issued_by_id: string;
  issued_by: unknown;
  issued_date: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}
