import type { Project, CreateProjectInput } from '../types/project';

const BASE = '/api/project';

export interface PaginatedProject { data: Project[]; total: number; page: number; limit: number; }

export async function listProject(page = 1, limit = 20, sortBy = 'id', sortDir: 'asc' | 'desc' = 'desc', filters: Record<string, string> = {}): Promise<PaginatedProject> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort_by: sortBy, sort_dir: sortDir, ...filters });
  const res = await fetch(`${BASE}?${params}`, { headers: {  } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProject(id: number): Promise<Project> {
  const res = await fetch(`${BASE}/${id}`, { headers: {  } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createProject(data: CreateProjectInput): Promise<Project> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateProject(id: number, data: Partial<CreateProjectInput>): Promise<Project> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteProject(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text());
}

export async function batchDeleteProject(ids: number[]): Promise<void> {
  const res = await fetch(`${BASE}/batch`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error(await res.text());
}
