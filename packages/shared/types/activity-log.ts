export interface ActivityLog {
  id: string;
  user_id: string;
  method: string;
  path: string;
  status: number;
  payload_digest: string;
  ip_address: string;
  user_agent: string;
  duration_ms: number;
  prev_hash: string;
  hash: string;
  created_at: string;
}
