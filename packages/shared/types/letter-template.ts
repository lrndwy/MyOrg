export interface LetterTemplate {
  id: string;
  name: string;
  category_id: string;
  category?: { id?: string; name?: string; code?: string } | null;
  template_url: string;
  version: number;
  created_at: string;
  updated_at: string;
}
