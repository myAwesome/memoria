import type { Asset, CreateAssetInput } from '../types/asset';

const BASE = '/api/asset';

export interface PaginatedAsset { data: Asset[]; total: number; page: number; limit: number; }

export async function listAsset(page = 1, limit = 20, sortBy = 'id', sortDir: 'asc' | 'desc' = 'desc', filters: Record<string, string> = {}): Promise<PaginatedAsset> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort_by: sortBy, sort_dir: sortDir, ...filters });
  const res = await fetch(`${BASE}?${params}`, { headers: {  } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getAsset(id: number): Promise<Asset> {
  const res = await fetch(`${BASE}/${id}`, { headers: {  } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createAsset(data: CreateAssetInput): Promise<Asset> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateAsset(id: number, data: Partial<CreateAssetInput>): Promise<Asset> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function batchDeleteAsset(ids: number[]): Promise<void> {
  const res = await fetch(`${BASE}/batch`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(await res.text());
}
