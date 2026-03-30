import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProjectData, Spread, LayoutId, Slot, SlotDef } from '../types/editor';
import type { Asset } from '../types/asset';
import { BOOK_SIZES } from '../types/project';
import { getProject, updateProject } from '../api/project';
import { listAsset } from '../api/asset';
import { useEditorStore } from '../editor/useEditorStore';
import { LAYOUTS, getLayout } from '../editor/layouts';

const DEFAULT_DATA: ProjectData = { spreads: [], size: 'a4-portrait' };

// ─── EditorPage (loader) ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [projectName, setProjectName] = useState('');
  const [initialData, setInitialData] = useState<ProjectData | null>(null);

  useEffect(() => {
    if (!id) return;
    getProject(Number(id))
      .then(p => {
        setProjectName(p.name ?? '');
        let parsed: ProjectData = DEFAULT_DATA;
        try { if (p.data) parsed = JSON.parse(p.data); } catch { /* use default */ }
        setInitialData(parsed);
      })
      .catch(() => setLoadError('Не вдалося завантажити проєкт'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="editor-loading"><div className="editor-loading-text">Завантаження…</div></div>;
  }
  if (loadError || !initialData || !id) {
    return <div className="editor-loading"><div className="editor-loading-text">{loadError || 'Помилка'}</div></div>;
  }

  return (
    <EditorInner
      projectId={Number(id)}
      projectName={projectName}
      initialData={initialData}
      onBack={() => navigate('/project')}
    />
  );
}

// ─── EditorInner ─────────────────────────────────────────────────────────

interface EditorInnerProps {
  projectId: number;
  projectName: string;
  initialData: ProjectData;
  onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'pending' | 'error';
const SAVE_LABELS: Record<SaveStatus, string> = {
  saved:   'Збережено',
  saving:  'Зберігання…',
  pending: 'Є зміни…',
  error:   'Помилка збереження',
};

function EditorInner({ projectId, projectName, initialData, onBack }: EditorInnerProps) {
  const store = useEditorStore(initialData);
  const [currentSpreadIdx, setCurrentSpreadIdx] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  const safeIdx = store.data.spreads.length > 0
    ? Math.max(0, Math.min(currentSpreadIdx, store.data.spreads.length - 1))
    : -1;
  const currentSpread = safeIdx >= 0 ? store.data.spreads[safeIdx] : null;
  const bookSize = BOOK_SIZES.find(s => s.id === store.data.size) ?? BOOK_SIZES[0];

  // Auto-save with 2-second debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSaveStatus('pending');
    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateProject(projectId, { data: JSON.stringify(store.data) });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [store.data, projectId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store.undo, store.redo]);

  function handleDeleteSpread() {
    if (safeIdx < 0) return;
    store.deleteSpread(safeIdx);
    setCurrentSpreadIdx(idx => Math.max(0, idx - (idx >= store.data.spreads.length - 1 ? 1 : 0)));
  }

  return (
    <div className="editor-layout">
      <div className="editor-toolbar">
        <button className="btn btn-sm" onClick={onBack}>← Назад</button>
        <span className="editor-project-name">{projectName}</span>
        <span className={`save-status save-status--${saveStatus}`}>{SAVE_LABELS[saveStatus]}</span>
        <div className="toolbar-spacer" />
        <button className="btn btn-sm" onClick={store.undo} disabled={!store.canUndo} title="Відмінити (Ctrl+Z)">↩</button>
        <button className="btn btn-sm" onClick={store.redo} disabled={!store.canRedo} title="Повторити (Ctrl+Y)">↪</button>
        <div className="toolbar-divider" />
        <button className="btn btn-sm btn-danger" onClick={handleDeleteSpread} disabled={safeIdx < 0} title="Видалити поточну сторінку">
          ⌫ Сторінку
        </button>
        <div className="toolbar-divider" />
        <button className="btn btn-sm" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} title="Зменшити">−</button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-sm" onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} title="Збільшити">+</button>
        <button className="btn btn-sm" onClick={() => setZoom(1)} title="Скинути масштаб">1:1</button>
      </div>

      <div className="editor-body">
        <LeftPanel
          spreads={store.data.spreads}
          currentIdx={safeIdx}
          bookSize={bookSize}
          onSelect={setCurrentSpreadIdx}
          onAdd={store.addSpread}
          onReorder={store.reorderSpreads}
        />
        <CanvasArea
          spread={currentSpread}
          bookSize={bookSize}
          zoom={zoom}
          selectedSlotId={selectedSlotId}
          onSelectSlot={setSelectedSlotId}
          onAssignAsset={(slotId, assetId, assetPath) =>
            currentSpread && store.assignAsset(currentSpread.id, slotId, assetId, assetPath)
          }
          onClearSlot={(slotId) =>
            currentSpread && store.clearSlot(currentSpread.id, slotId)
          }
          onUpdateTransform={(slotId, offsetX, offsetY, scale) =>
            currentSpread && store.updateSlotTransform(currentSpread.id, slotId, offsetX, offsetY, scale)
          }
        />
        <RightPanel
          spread={currentSpread}
          selectedSlotId={selectedSlotId}
          onSetLayout={(layoutId) =>
            currentSpread && store.setLayout(currentSpread.id, layoutId)
          }
          onAssignToSelected={(assetId, assetPath) => {
            if (selectedSlotId && currentSpread) {
              store.assignAsset(currentSpread.id, selectedSlotId, assetId, assetPath);
            }
          }}
        />
      </div>
    </div>
  );
}

// ─── Left Panel ───────────────────────────────────────────────────────────

interface BookSize { width: number; height: number; label?: string; id?: string; }

interface LeftPanelProps {
  spreads: Spread[];
  currentIdx: number;
  bookSize: BookSize;
  onSelect: (idx: number) => void;
  onAdd: () => void;
  onReorder: (from: number, to: number) => void;
}

function LeftPanel({ spreads, currentIdx, bookSize, onSelect, onAdd, onReorder }: LeftPanelProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  return (
    <div className="editor-left-panel">
      <div className="left-panel-header">
        <span className="panel-title">Сторінки</span>
        <button className="btn btn-sm btn-primary" onClick={onAdd} title="Додати сторінку">+</button>
      </div>
      <div className="spread-list">
        {spreads.map((spread, idx) => (
          <div
            key={spread.id}
            className={`spread-thumb${idx === currentIdx ? ' active' : ''}${dragOver === idx ? ' drag-target' : ''}`}
            onClick={() => onSelect(idx)}
            draggable
            onDragStart={e => { e.stopPropagation(); setDragFrom(idx); }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOver(idx); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => {
              e.preventDefault();
              e.stopPropagation();
              if (dragFrom !== null && dragFrom !== idx) onReorder(dragFrom, idx);
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
          >
            <SpreadMiniature spread={spread} aspectRatio={bookSize.width / bookSize.height} />
            <span className="spread-num">{idx + 1}</span>
          </div>
        ))}
        {spreads.length === 0 && (
          <div className="spread-list-empty">Немає сторінок.<br />Натисніть + щоб додати.</div>
        )}
      </div>
    </div>
  );
}

function SpreadMiniature({ spread, aspectRatio }: { spread: Spread; aspectRatio: number }) {
  const layout = getLayout(spread.layoutId);
  return (
    <div className="spread-mini" style={{ aspectRatio: String(aspectRatio) }}>
      {layout.slotDefs.map(sd => {
        const slot = spread.slots.find(s => s.id === sd.id);
        return (
          <div
            key={sd.id}
            className="spread-mini-slot"
            style={{ left: sd.left, top: sd.top, width: sd.width, height: sd.height }}
          >
            {slot?.assetPath && <img src={slot.assetPath} alt="" draggable={false} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────

interface CanvasAreaProps {
  spread: Spread | null;
  bookSize: BookSize;
  zoom: number;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  onAssignAsset: (slotId: string, assetId: number, assetPath: string) => void;
  onClearSlot: (slotId: string) => void;
  onUpdateTransform: (slotId: string, offsetX: number, offsetY: number, scale: number) => void;
}

function CanvasArea({ spread, bookSize, zoom, selectedSlotId, onSelectSlot, onAssignAsset, onClearSlot, onUpdateTransform }: CanvasAreaProps) {
  if (!spread) {
    return (
      <div className="canvas-area">
        <div className="canvas-empty">
          <div className="canvas-empty-icon">📄</div>
          <p>Немає сторінок.<br />Натисніть + у лівій панелі.</p>
        </div>
      </div>
    );
  }

  const layout = getLayout(spread.layoutId);

  return (
    <div className="canvas-area" onClick={() => onSelectSlot(null)}>
      <div className="canvas-scroll-inner">
        <div
          className="canvas-page"
          style={{
            width: `${600 * zoom}px`,
            aspectRatio: `${bookSize.width} / ${bookSize.height}`,
          }}
        >
          {layout.slotDefs.map(sd => {
            const slot = spread.slots.find(s => s.id === sd.id) ?? { id: sd.id };
            return (
              <CanvasSlot
                key={sd.id}
                def={sd}
                slot={slot}
                isSelected={selectedSlotId === sd.id}
                onAssign={(assetId, assetPath) => onAssignAsset(sd.id, assetId, assetPath)}
                onClear={() => onClearSlot(sd.id)}
                onSelect={() => onSelectSlot(sd.id)}
                onUpdateTransform={(offsetX, offsetY, scale) => onUpdateTransform(sd.id, offsetX, offsetY, scale)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface CanvasSlotProps {
  def: SlotDef;
  slot: Slot;
  isSelected: boolean;
  onAssign: (assetId: number, assetPath: string) => void;
  onClear: () => void;
  onSelect: () => void;
  onUpdateTransform: (offsetX: number, offsetY: number, scale: number) => void;
}

function CanvasSlot({ def, slot, isSelected, onAssign, onClear, onSelect, onUpdateTransform }: CanvasSlotProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  // Live pan state during drag (not yet committed to store)
  const [liveOffset, setLiveOffset] = useState<{ x: number; y: number } | null>(null);
  const panRef = useRef<{ startMx: number; startMy: number; startOx: number; startOy: number } | null>(null);

  const currentOffsetX = liveOffset?.x ?? (slot.offsetX ?? 0);
  const currentOffsetY = liveOffset?.y ?? (slot.offsetY ?? 0);
  const currentScale = slot.scale ?? 1;

  // Cleanup pan listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePanStart(e: React.MouseEvent) {
    if (!slot.assetPath) return;
    e.preventDefault();
    e.stopPropagation();
    panRef.current = {
      startMx: e.clientX,
      startMy: e.clientY,
      startOx: slot.offsetX ?? 0,
      startOy: slot.offsetY ?? 0,
    };
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
  }

  function handlePanMove(e: MouseEvent) {
    if (!panRef.current) return;
    const { startMx, startMy, startOx, startOy } = panRef.current;
    setLiveOffset({ x: startOx + (e.clientX - startMx), y: startOy + (e.clientY - startMy) });
  }

  function handlePanEnd(e: MouseEvent) {
    if (!panRef.current) return;
    const { startMx, startMy, startOx, startOy } = panRef.current;
    const finalX = startOx + (e.clientX - startMx);
    const finalY = startOy + (e.clientY - startMy);
    panRef.current = null;
    setLiveOffset(null);
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanEnd);
    onUpdateTransform(finalX, finalY, currentScale);
  }

  function handleWheel(e: React.WheelEvent) {
    if (!slot.assetPath) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.5, Math.min(4, currentScale + delta));
    onUpdateTransform(currentOffsetX, currentOffsetY, newScale);
  }

  return (
    <div
      className={`canvas-slot${isDragOver ? ' drag-over' : ''}${isSelected ? ' selected' : ''}`}
      style={{ left: def.left, top: def.top, width: def.width, height: def.height }}
      onClick={e => { e.stopPropagation(); onSelect(); }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const assetId = Number(e.dataTransfer.getData('assetId'));
        const assetPath = e.dataTransfer.getData('assetPath');
        if (assetId && assetPath) onAssign(assetId, assetPath);
      }}
      onWheel={handleWheel}
    >
      <div className="canvas-slot-inner">
        {slot.assetPath ? (
          <>
            <img
              src={slot.assetPath}
              alt=""
              className="slot-image"
              draggable={false}
              style={{ transform: `translate(${currentOffsetX}px, ${currentOffsetY}px) scale(${currentScale})` }}
              onMouseDown={handlePanStart}
            />
            <button className="slot-clear-btn" onClick={e => { e.stopPropagation(); onClear(); }} title="Очистити слот">×</button>
          </>
        ) : (
          <div className="slot-empty">
            <span className="slot-empty-icon">+</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────

interface RightPanelProps {
  spread: Spread | null;
  selectedSlotId: string | null;
  onSetLayout: (layoutId: LayoutId) => void;
  onAssignToSelected: (assetId: number, assetPath: string) => void;
}

function RightPanel({ spread, selectedSlotId, onSetLayout, onAssignToSelected }: RightPanelProps) {
  const [tab, setTab] = useState<'photos' | 'layout'>('photos');

  return (
    <div className="editor-right-panel">
      <div className="right-panel-tabs">
        <button className={`tab-btn${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')}>
          Фото
        </button>
        <button className={`tab-btn${tab === 'layout' ? ' active' : ''}`} onClick={() => setTab('layout')}>
          Макет
        </button>
      </div>
      <div className="right-panel-content">
        {tab === 'photos' ? (
          <PhotosTab selectedSlotId={selectedSlotId} onAssignToSelected={onAssignToSelected} />
        ) : (
          <LayoutTab spread={spread} onSetLayout={onSetLayout} />
        )}
      </div>
    </div>
  );
}

// ─── Photos Tab ───────────────────────────────────────────────────────────

interface PhotosTabProps {
  selectedSlotId: string | null;
  onAssignToSelected: (assetId: number, assetPath: string) => void;
}

function PhotosTab({ selectedSlotId, onAssignToSelected }: PhotosTabProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragOverZone, setIsDragOverZone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = useCallback(async (q: string) => {
    try {
      const filters: Record<string, string> = q ? { original_name: q } : {};
      const res = await listAsset(1, 100, 'id', 'desc', filters);
      setAssets(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadAssets(search), 300);
    return () => clearTimeout(t);
  }, [search, loadAssets]);

  async function handleUpload(files: FileList) {
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const fileProgress = e.loaded / e.total;
            setUploadProgress(Math.round(((i + fileProgress) / files.length) * 100));
          }
        };
        xhr.onloadend = () => resolve();
        xhr.open('POST', '/asset/upload');
        xhr.send(formData);
      });
    }
    setUploading(false);
    setUploadProgress(0);
    loadAssets(search);
  }

  return (
    <div className="photos-tab">
      <div
        className={`upload-zone${isDragOverZone ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setIsDragOverZone(true); }}
        onDragLeave={() => setIsDragOverZone(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragOverZone(false);
          if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="upload-progress-wrap">
            <div className="upload-progress-bar">
              <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span className="upload-progress-label">{uploadProgress}%</span>
          </div>
        ) : (
          <span className="upload-zone-text">Перетягніть фото або натисніть для завантаження</span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files) handleUpload(e.target.files); e.target.value = ''; }}
      />
      <div className="photos-search-row">
        <input
          className="form-input"
          type="text"
          placeholder="Пошук…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {selectedSlotId && (
        <div className="slot-assign-hint">Клікніть фото, щоб вставити у слот</div>
      )}
      <div className="asset-thumb-grid">
        {assets.map(asset => (
          <div
            key={asset.id}
            className={`asset-thumb${selectedSlotId ? ' assignable' : ''}`}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData('assetId', String(asset.id));
              e.dataTransfer.setData('assetPath', asset.path ?? '');
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              if (selectedSlotId && asset.path) {
                onAssignToSelected(asset.id, asset.path);
              }
            }}
            title={asset.original_name ?? asset.path}
          >
            <img src={asset.path} alt={asset.original_name} draggable={false} />
          </div>
        ))}
        {assets.length === 0 && !uploading && (
          <div className="assets-empty">Немає фото</div>
        )}
      </div>
    </div>
  );
}

// ─── Layout Tab ───────────────────────────────────────────────────────────

interface LayoutTabProps {
  spread: Spread | null;
  onSetLayout: (layoutId: LayoutId) => void;
}

function LayoutTab({ spread, onSetLayout }: LayoutTabProps) {
  return (
    <div className="layout-tab">
      <p className="panel-section-label">Макет сторінки</p>
      <div className="layout-grid">
        {LAYOUTS.map(layout => (
          <button
            key={layout.id}
            className={`layout-option${spread?.layoutId === layout.id ? ' active' : ''}`}
            onClick={() => onSetLayout(layout.id)}
            title={layout.label}
          >
            <LayoutPreview slotDefs={layout.slotDefs} />
            <span>{layout.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LayoutPreview({ slotDefs }: { slotDefs: SlotDef[] }) {
  return (
    <div className="layout-preview">
      {slotDefs.map(sd => (
        <div
          key={sd.id}
          className="layout-preview-slot"
          style={{ left: sd.left, top: sd.top, width: sd.width, height: sd.height }}
        />
      ))}
    </div>
  );
}
