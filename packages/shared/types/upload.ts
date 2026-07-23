export interface Upload {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  path: string;
  url: string;
  thumbnail_url: string;
  user_id: string;
  folder_id: string | null;
  version: number;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorageFolder {
  id: string;
  name: string;
  parent_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface StorageBreadcrumb {
  id: string;
  name: string;
}
