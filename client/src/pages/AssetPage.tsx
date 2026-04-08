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
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);

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

  function selectAllOnPage() {
    setSelectedIds(new Set(items.map(item => item.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function getNextPageAfterDelete(deletedCount: number) {
    const nextTotal = Math.max(0, total - deletedCount);
    const maxPage = Math.max(1, Math.ceil(nextTotal / limit));
    return Math.min(page, maxPage);
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete photo?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await deleteAsset(id);
      load(getNextPageAfterDelete(1));
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingIds(prev => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} photo(s)?`)) return;
    const ids = Array.from(selectedIds);
    setBatchDeleting(true);
    try {
      await batchDeleteAsset(ids);
      load(getNextPageAfterDelete(ids.length));
    } catch (e) {
      console.error(e);
    } finally {
      setBatchDeleting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Assets</h1>
        <div className="header-actions">
          {selectedIds.size > 0 && (
            <>
              <button className="btn" onClick={clearSelection} disabled={batchDeleting}>
                Clear selection
              </button>
              <button className="btn btn-danger" onClick={handleBatchDelete} disabled={batchDeleting}>
                {batchDeleting ? `Deleting ${selectedIds.size}…` : `Delete ${selectedIds.size}`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="filter-bar">
        <input
          className="form-input"
          type="search"
          placeholder="Search..."
          value={q}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <p>No assets found.</p>
        </div>
      ) : (
        <>
          <div className="asset-page-toolbar">
            <button className="btn btn-sm" onClick={selectAllOnPage} disabled={batchDeleting || selectedIds.size === items.length}>
              Select page ({items.length})
            </button>
          </div>
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
                    title="Delete"
                    disabled={deletingIds.has(item.id) || batchDeleting}
                  >
                    {deletingIds.has(item.id) ? '…' : '×'}
                  </button>
                  {selectedIds.has(item.id) && <div className="asset-page-check">✓</div>}
                </div>
                <div className="asset-page-name" title={item.original_name ?? item.filename}>
                  {item.original_name ?? item.filename}
                </div>
              </div>
            ))}
          </div>
        </>
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
