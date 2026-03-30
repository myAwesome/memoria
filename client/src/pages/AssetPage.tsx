import { useState, useEffect } from 'react';
import type { Asset } from '../types/asset';
import { listAsset, deleteAsset, batchDeleteAsset } from '../api/asset';

export default function AssetPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 40;
  const [sortBy] = useState('id');
  const [sortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [q, setQ] = useState('');

  useEffect(() => { load(1); }, []);

  async function load(p: number, search = q) {
    try {
      const params: Record<string, string> = {};
      if (search) params['q'] = search;
      const res = await listAsset(p, limit, sortBy, sortDir, params);
      setItems(res.data);
      setTotal(res.total);
      setPage(p);
      setSelectedIds(new Set());
    } catch (e) { console.error(e); }
  }

  function handleSearch(newQ: string) {
    setQ(newQ);
    load(1, newQ);
  }

  function toggleSelect(id: number) {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  }

  async function handleDelete(id: number) {
    if (!confirm('Видалити фото?')) return;
    try { await deleteAsset(id); load(page); } catch (e) { console.error(e); }
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Видалити ${selectedIds.size} фото?`)) return;
    try { await batchDeleteAsset(Array.from(selectedIds)); load(page); } catch (e) { console.error(e); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Асети</h1>
        <div className="header-actions">
          {selectedIds.size > 0 && (
            <button className="btn btn-danger" onClick={handleBatchDelete}>
              Видалити {selectedIds.size}
            </button>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          type="search"
          placeholder="Пошук..."
          value={q}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <p>Немає асетів.</p>
        </div>
      ) : (
        <div className="asset-page-grid">
          {items.map(item => (
            <div
              key={item.id}
              className={`asset-page-item${selectedIds.has(item.id) ? ' selected' : ''}`}
              onClick={() => toggleSelect(item.id)}
            >
              <div className="asset-page-thumb">
                <img src={item.path} alt={item.original_name ?? item.filename} loading="lazy" />
                <button
                  className="asset-page-del"
                  onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                  title="Видалити"
                >×</button>
                {selectedIds.has(item.id) && <div className="asset-page-check">✓</div>}
              </div>
              <div className="asset-page-name" title={item.original_name ?? item.filename}>
                {item.original_name ?? item.filename}
              </div>
            </div>
          ))}
        </div>
      )}

      {total > limit && (
        <div className="pagination">
          <button className="btn" onClick={() => load(page - 1)} disabled={page <= 1}>← Назад</button>
          <span>{page} / {Math.ceil(total / limit)} ({total})</span>
          <button className="btn" onClick={() => load(page + 1)} disabled={page * limit >= total}>Далі →</button>
        </div>
      )}
    </div>
  );
}
