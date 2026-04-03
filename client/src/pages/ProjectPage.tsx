import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types/project';
import { BOOK_SIZES, type BookSizeId } from '../types/project';
import { listProject, createProject, updateProject, deleteProject } from '../api/project';

export default function ProjectPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSize, setNewSize] = useState<BookSizeId>('a4-portrait');
  const [creating, setCreating] = useState(false);

  const [editItem, setEditItem] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(1); }, []);

  async function load(p: number) {
    try {
      const res = await listProject(p, limit, 'id', 'desc');
      setItems(res.data);
      setTotal(res.total);
      setPage(p);
    } catch (e) { console.error(e); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const data = JSON.stringify({ spreads: [], size: newSize });
      await createProject({ name: newName.trim(), data });
      setShowModal(false);
      setNewName('');
      setNewSize('a4-portrait');
      load(1);
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  }

  function openEdit(item: Project) {
    setEditItem(item);
    setEditName(item.name ?? '');
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem || !editName.trim()) return;
    setSaving(true);
    try {
      await updateProject(editItem.id, { name: editName.trim() });
      setEditItem(null);
      load(page);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await deleteProject(id); load(page); } catch (e) { console.error(e); }
  }

  function closeModal() {
    setShowModal(false);
    setNewName('');
    setNewSize('a4-portrait');
  }

  function formatDate(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Photo Books</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Photo Book</button>
      </div>

      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Edit Photo Book</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={saving || !editName.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn" onClick={() => setEditItem(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Photo Book</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input
                  className="form-input"
                  type="text"
                  autoFocus
                  placeholder="Enter a name..."
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginTop: 20 }}>
                <label className="form-label">Size</label>
                <div className="size-grid">
                  {BOOK_SIZES.map(s => (
                    <label key={s.id} className={`size-option${newSize === s.id ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name="size"
                        value={s.id}
                        checked={newSize === s.id}
                        onChange={() => setNewSize(s.id)}
                      />
                      <div className="size-thumb" style={{ aspectRatio: `${s.width}/${s.height}` }} />
                      <span className="size-name">{s.label}</span>
                      <span className="size-dim">{s.width}×{s.height}mm</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary" disabled={creating || !newName.trim()}>
                  {creating ? 'Creating…' : 'Create'}
                </button>
                <button type="button" className="btn" onClick={closeModal}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📖</div>
          <p>No photo books yet. Create your first one.</p>
        </div>
      ) : (
        <div className="book-grid">
          {items.map(item => (
            <div key={item.id} className="book-card">
              <div className="book-cover book-cover--clickable" onClick={() => navigate(`/project/${item.id}/edit`)}>
                {item.cover_asset_id
                  ? <CoverImage assetId={item.cover_asset_id} name={item.name} />
                  : <BookCoverPlaceholder name={item.name} id={item.id} />
                }
              </div>
              <div className="book-info">
                <div className="book-name" title={item.name}>{item.name}</div>
                <div className="book-date">{formatDate(item.created_at)}</div>
              </div>
              <div className="book-actions">
                <button className="btn btn-sm" onClick={() => openEdit(item)}>Edit</button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(item.id, item.name ?? String(item.id))}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > limit && (
        <div className="pagination">
          <button className="btn" onClick={() => load(page - 1)} disabled={page <= 1}>← Previous</button>
          <span>{page} / {Math.ceil(total / limit)} ({total})</span>
          <button className="btn" onClick={() => load(page + 1)} disabled={page * limit >= total}>Next →</button>
        </div>
      )}
    </div>
  );
}

const COVER_COLORS = [
  '#4f6ef7', '#e05c7e', '#43b89c', '#f0a040', '#7c5cbf',
  '#3a9ad9', '#d45f2c', '#2eaa6e', '#c44bb5', '#6b7280',
];

function BookCoverPlaceholder({ name, id }: { name?: string; id: number }) {
  const color = COVER_COLORS[id % COVER_COLORS.length];
  const letter = (name ?? '?')[0].toUpperCase();
  return (
    <div className="book-cover-placeholder" style={{ background: color }}>
      <span className="book-cover-letter">{letter}</span>
    </div>
  );
}

function CoverImage({ assetId, name }: { assetId: number; name?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/asset/${assetId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((a: { path?: string }) => { if (a.path) setUrl(a.path); else setFailed(true); })
      .catch(() => setFailed(true));
  }, [assetId]);

  if (failed || (!url && !assetId)) {
    return <BookCoverPlaceholder name={name} id={assetId} />;
  }
  if (!url) {
    return <div className="book-cover-placeholder book-cover-loading" />;
  }
  return <img src={url} alt={name} className="book-cover-img" />;
}
