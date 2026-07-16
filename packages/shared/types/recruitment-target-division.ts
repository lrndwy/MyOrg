export interface RecruitmentTargetDivision {
  id: string;
  recruitment_id: string;
  recruitment: unknown;
  division_id: string;
  division: { id?: string; name?: string } | null;
  version: number;
  created_at: string;
  updated_at: string;
}
