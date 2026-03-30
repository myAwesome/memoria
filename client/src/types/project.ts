export const BOOK_SIZES = [
  { id: 'a4-portrait',  label: 'A4 Portrait',  width: 210, height: 297 },
  { id: 'a4-landscape', label: 'A4 Landscape', width: 297, height: 210 },
  { id: 'square-20',    label: 'Square 20×20', width: 200, height: 200 },
  { id: 'a5-portrait',  label: 'A5 Portrait',  width: 148, height: 210 },
] as const;

export type BookSizeId = typeof BOOK_SIZES[number]['id'];

export interface Project {
  id: number;
  name?: string;
  data?: string;
  cover_asset_id?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type CreateProjectInput = {
  name: string;
  data: string;
  cover_asset_id?: number | null;
};
