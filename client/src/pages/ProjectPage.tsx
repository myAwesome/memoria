import { useState, useEffect } from 'react';
import type { Project, CreateProjectInput } from '../types/project';
import { listProject, createProject, updateProject, deleteProject, batchDeleteProject } from '../api/project';

const EMPTY_FORM: CreateProjectInput = {
  name: '',
  data: '',
};

export default function ProjectPage() {
  const [items, setItems] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<CreateProjectInput>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const [sortBy, setSortBy] = useState('id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  useEffect(() => { load(1); }, []);

  async function load(p: number, sb = sortBy, sd = sortDir, f = filters, search = q) {
    try {
      const params: Record<string, string> = { ...f };
      if (search) params['q'] = search;
      const res = await listProject(p, limit, sb, sd, params);
      setItems(res.data);
      setTotal(res.total);
      setPage(p);
      setSelectedIds(new Set());
    } catch (e) { console.error(e); }
  }

  function handleSort(col: string) {
    const newDir = col === sortBy ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc';
    setSortBy(col);
    setSortDir(newDir);
    load(1, col, newDir);
  }

  function handleFilterChange(key: string, value: string) {
    const newFilters = value
      ? { ...filters, [key]: value }
      : Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key));
    setFilters(newFilters);
    load(1, sortBy, sortDir, newFilters, q);
  }

  function handleSearch(newQ: string) {
    setQ(newQ);
    load(1, sortBy, sortDir, filters, newQ);
  }

  function openCreate() {
    setEditing(null); setForm(EMPTY_FORM); setShowForm(true);
  }

  function openEdit(item: Project) {
    setEditing(item);
    setForm({
      name: item.name ?? '',
      data: item.data ?? '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editing) await updateProject(editing.id, form);
      else await createProject(form);
      setShowForm(false); load(page);
    } catch (e) { console.error(e); }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete?')) return;
    try { await deleteProject(id); load(page); } catch (e) { console.error(e); }
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} item(s)?`)) return;
    try { await batchDeleteProject(Array.from(selectedIds)); load(page); } catch (e) { console.error(e); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>project</h1>
        <div className="header-actions">
          {selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={handleBatchDelete}>Delete {selectedIds.size} selected</button>
          )}
          <button className="btn btn-primary" onClick={openCreate}>+ New</button>
        </div>
      </div>

      <div className="filter-bar">
        <input className="form-input" type="search" placeholder="Search..." value={q} onChange={e => handleSearch(e.target.value)} />
      </div>

      {showForm && (
        <div className="form-card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">name</label>
              <input className="form-input" type="text" value={form.name as string} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">data</label>
              <input className="form-input" type="text" value={form.data as string} onChange={e => setForm({...form, data: e.target.value})} />
            </div>
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">{editing ? 'Save' : 'Create'}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <table className="data-table">
        <thead><tr>
          <th><input type="checkbox" checked={items.length > 0 && items.every(i => selectedIds.has(i.id))} onChange={e => { if (e.target.checked) setSelectedIds(new Set(items.map(i => i.id))); else setSelectedIds(new Set()); }} /></th>
          <th className={`sortable${sortBy === 'id' ? ' sorted' : ''}`} onClick={() => handleSort('id')}>id {sortBy === 'id' && (sortDir === 'asc' ? '▲' : '▼')}</th>
          <th className={`sortable${sortBy === 'name' ? ' sorted' : ''}`} onClick={() => handleSort('name')}>name {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}</th>
          <th className={`sortable${sortBy === 'data' ? ' sorted' : ''}`} onClick={() => handleSort('data')}>data {sortBy === 'data' && (sortDir === 'asc' ? '▲' : '▼')}</th>
          <th></th>
        </tr></thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td><input type="checkbox" checked={selectedIds.has(item.id)} onChange={e => { const s = new Set(selectedIds); if (e.target.checked) s.add(item.id); else s.delete(item.id); setSelectedIds(s); }} /></td>
              <td>{item.id}</td>
              <td>{item.name}</td>
              <td>{item.data}</td>
              <td>
                <div className="row-actions">
                  <button className="btn btn-sm" onClick={() => openEdit(item)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Del</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button className="btn" onClick={() => load(page - 1)} disabled={page <= 1}>Prev</button>
        <span>{page} / {Math.ceil(total / limit) || 1} ({total} total)</span>
        <button className="btn" onClick={() => load(page + 1)} disabled={page * limit >= total}>Next</button>
      </div>
    </div>
  );
}
