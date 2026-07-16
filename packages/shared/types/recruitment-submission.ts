export interface RecruitmentSubmission {
  id: string;
  recruitment_id: string;
  recruitment: unknown;
  name: string;
  nim?: string;
  division_interest_id: string;
  division_interest: { id?: string; name?: string } | null;
  contact: string;
  custom_answers: unknown;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
}
