export interface Asset {
  id: number;
  path?: string;
}

export type CreateAssetInput = {
  path: string;
};
