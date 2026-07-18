export interface Letter {
  id: string;
  type: string;
  category_id: string;
  category: unknown;
  template_id: string | null;
  template: unknown | null;
  letter_code: string;
  subject: string;
  letter_date: string | null;
  sender: string;
  recipient: string;
  content: string;
  variable_values: unknown;
  document_url: string;
  attachment_url: string;
  version: number;
  created_at: string;
  updated_at: string;
}
