export interface FinanceTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  proof_url: string;
  transaction_date: string | null;
  category_id: string;
  category: unknown;
  recorded_by_id: string;
  recorded_by: unknown;
  version: number;
  created_at: string;
  updated_at: string;
}
