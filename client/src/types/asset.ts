export interface Asset {
  id: number;
  path?: string;
  filename?: string;
  original_name?: string;
  size?: number;
  mime_type?: string;
  created_at?: string;
}

export type CreateAssetInput = {
  path: string;
};
