export interface RecruitmentCustomField {
  id: string;
  recruitment_id: string;
  recruitment: unknown;
  field_label: string;
  field_type: string;
  field_options: string[];
  is_required: boolean;
  order_index: number;
  version: number;
  created_at: string;
  updated_at: string;
}
