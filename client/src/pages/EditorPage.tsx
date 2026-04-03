import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { ProjectData, Spread, LayoutId, Slot, SlotDef, PageData } from '../types/editor';
import type { Asset } from '../types/asset';
import { BOOK_SIZES } from '../types/project';
import { getProject, updateProject } from '../api/project';
import { listAsset } from '../api/asset';
import { useEditorStore } from '../editor/useEditorStore';
import { LAYOUTS, getLayout } from '../editor/layouts';

const DEFAULT_DATA: ProjectData = { spreads: [], size: 'a4-portrait' };

// Migrate old spread format ({ id, layoutId, slots }) to new ({ id, left, right })
function migrateData(raw: unknown): ProjectData {
  const data = raw as any;
  if (!data?.spreads) return DEFAULT_DATA;
  return {
    ...data,
    spreads: (data.spreads as any[]).map(s => {
      if (s.left && s.right) return s; // already new format
      // Old format: { id, layoutId, slots }
      const oldLayoutId: LayoutId = s.layoutId ?? '1col';
      const oldSlots: Slot[] = (s.slots ?? []).map((sl: any) => ({
        ...sl,
        id: `l:${sl.id}`,
      }));
      const defaultLayout = getLayout('1col');
      return {
        id: s.id,
        left:  { layoutId: oldLayoutId, slots: oldSlots },
        right: { layoutId: '1col', slots: defaultLayout.slotDefs.map(sd => ({ id: `r:${sd.id}` })) },
      };
    }),
  };
}

// ─── EditorPage (loader) ──────────────────────────────────────────────────

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [projectName, setProjectName] = useState('');
  const [initialData, setInitialData] = useState<ProjectData | null>(null);
  const [initialCoverAssetPath, setInitialCoverAssetPath] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getProject(Number(id))
      .then(async p => {
        setProjectName(p.name ?? '');
        let parsed: ProjectData = DEFAULT_DATA;
        try { if (p.data) parsed = migrateData(JSON.parse(p.data)); } catch { /* use default */ }
        setInitialData(parsed);
        if (p.cover_asset_id) {
          try {
            const res = await fetch(`/asset/${p.cover_asset_id}`);
            if (res.ok) {
              const a = await res.json();
              setInitialCoverAssetPath(a.path ?? null);
            }
          } catch { /* ignore */ }
        }
      })
      .catch(() => setLoadError('Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="editor-loading"><div className="editor-loading-text">Loading…</div></div>;
  }
  if (loadError || !initialData || !id) {
    return <div className="editor-loading"><div className="editor-loading-text">{loadError || 'Error'}</div></div>;
  }

  return (
    <EditorInner
      projectId={Number(id)}
      projectName={projectName}
      initialData={initialData}
      initialCoverAssetPath={initialCoverAssetPath}
      onBack={() => navigate('/project')}
    />
  );
}

// ─── EditorInner ─────────────────────────────────────────────────────────

interface EditorInnerProps {
  projectId: number;
  projectName: string;
  initialData: ProjectData;
  initialCoverAssetPath: string | null;
  onBack: () => void;
}

type SaveStatus = 'saved' | 'saving' | 'pending' | 'error';
const SAVE_LABELS: Record<SaveStatus, string> = {
  saved:   'Saved',
  saving:  'Saving…',
  pending: 'Unsaved changes…',
  error:   'Save error',
};

function getPageBackgroundStyle(page: PageData) {
  if (page.bgAssetPath) {
    return {
      backgroundColor: page.bgColor ?? '#ffffff',
      backgroundImage: `url(${page.bgAssetPath})`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    } as const;
  }
  return { backgroundColor: page.bgColor ?? '#ffffff' } as const;
}

function EditorInner({ projectId, projectName, initialData, initialCoverAssetPath, onBack }: EditorInnerProps) {
  const store = useEditorStore(initialData);
  const [currentSpreadIdx, setCurrentSpreadIdx] = useState(0);
  const [zoom, setZoom] = useState(0.75);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [coverAssetPath, setCoverAssetPath] = useState<string | null>(initialCoverAssetPath);
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const [isDeleteMenuOpen, setIsDeleteMenuOpen] = useState(false);
  const isFirstRender = useRef(true);
  const deleteMenuRef = useRef<HTMLDivElement>(null);

  const safeIdx = store.data.spreads.length > 0
    ? Math.max(0, Math.min(currentSpreadIdx, store.data.spreads.length - 1))
    : -1;
  const currentSpread = safeIdx >= 0 ? store.data.spreads[safeIdx] : null;
  const bookSize = BOOK_SIZES.find(s => s.id === store.data.size) ?? BOOK_SIZES[0];
  const currentPageStart = safeIdx >= 0 ? (safeIdx * 2) + 1 : 0;
  const currentPageEnd = safeIdx >= 0 ? currentPageStart + 1 : 0;

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
      if (e.key === 'Escape') setIsDeleteMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store.undo, store.redo]);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (!deleteMenuRef.current?.contains(e.target as Node)) {
        setIsDeleteMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, []);

  function handleDeleteSpread() {
    if (safeIdx < 0) return;
    store.deleteSpread(safeIdx);
    setCurrentSpreadIdx(idx => Math.max(0, idx - (idx >= store.data.spreads.length - 1 ? 1 : 0)));
    setIsDeleteMenuOpen(false);
  }

  async function handleSetCover(assetId: number, assetPath: string) {
    setCoverAssetPath(assetPath);
    try {
      await updateProject(projectId, { cover_asset_id: assetId });
    } catch { /* ignore */ }
  }

  async function handleClearCover() {
    setCoverAssetPath(null);
    try {
      await updateProject(projectId, { cover_asset_id: null });
    } catch { /* ignore */ }
  }

  return (
    <div className="editor-layout">
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <button className="btn btn-sm" onClick={onBack}>← Back</button>
          <span className="editor-project-name">{projectName}</span>
          <span className={`save-status save-status--${saveStatus}`}>{SAVE_LABELS[saveStatus]}</span>
        </div>

        <div className="toolbar-center">
          <div className="editor-action-menu" ref={deleteMenuRef}>
            <div className="editor-action-split">
              <button
                className="editor-action-btn editor-action-btn--danger"
                onClick={handleDeleteSpread}
                disabled={safeIdx < 0}
                title="Delete current spread"
              >
                🗑
              </button>
              <button
                className="editor-action-btn editor-action-btn--caret"
                onClick={() => setIsDeleteMenuOpen(v => !v)}
                disabled={safeIdx < 0}
                aria-expanded={isDeleteMenuOpen}
                title="Delete actions"
              >
                ▾
              </button>
            </div>
            {isDeleteMenuOpen && (
              <div className="editor-action-dropdown">
                <button className="editor-action-dropdown-item" onClick={handleDeleteSpread}>
                  Delete spread
                </button>
              </div>
            )}
          </div>
          <div className="editor-action-group">
            <button className="editor-action-btn" onClick={store.undo} disabled={!store.canUndo} title="Undo (Ctrl+Z)">↩</button>
            <button className="editor-action-btn" onClick={store.redo} disabled={!store.canRedo} title="Redo (Ctrl+Y)">↪</button>
          </div>
        </div>

        <div className="toolbar-right">
          <button
            className={`btn btn-sm editor-toggle-btn${isLeftPanelCollapsed ? ' is-collapsed' : ''}`}
            onClick={() => setIsLeftPanelCollapsed(value => !value)}
            title={isLeftPanelCollapsed ? 'Show left sidebar' : 'Collapse left sidebar'}
            aria-pressed={isLeftPanelCollapsed}
          >
            {isLeftPanelCollapsed ? '▸ Left sidebar' : '◂ Left sidebar'}
          </button>
          <button
            className={`btn btn-sm editor-toggle-btn${isRightPanelCollapsed ? ' is-collapsed' : ''}`}
            onClick={() => setIsRightPanelCollapsed(value => !value)}
            title={isRightPanelCollapsed ? 'Show right sidebar' : 'Collapse right sidebar'}
            aria-pressed={isRightPanelCollapsed}
          >
            {isRightPanelCollapsed ? 'Right panel ◂' : 'Right panel ▸'}
          </button>
          <div className="toolbar-divider" />
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="btn btn-sm"
            onClick={() => setZoom(z => Math.min(2, +(z + 0.25).toFixed(2)))}
            title="Zoom in"
            disabled={zoom >= 2}
          >
            +
          </button>
        </div>
      </div>

      <div
        className={`editor-body${isLeftPanelCollapsed ? ' editor-body--left-collapsed' : ''}${isRightPanelCollapsed ? ' editor-body--right-collapsed' : ''}`}
      >
        {!isLeftPanelCollapsed && (
          <LeftPanel
            spreads={store.data.spreads}
            currentIdx={safeIdx}
            bookSize={bookSize}
            onSelect={setCurrentSpreadIdx}
            onAdd={store.addSpread}
            onReorder={store.reorderSpreads}
            coverAssetPath={coverAssetPath}
            onSetCover={handleSetCover}
            onClearCover={handleClearCover}
          />
        )}
        <CanvasArea
          spread={currentSpread}
          bookSize={bookSize}
          zoom={zoom}
          currentPageStart={currentPageStart}
          currentPageEnd={currentPageEnd}
          canGoPrev={safeIdx > 0}
          canGoNext={safeIdx >= 0 && safeIdx < store.data.spreads.length - 1}
          onPrevSpread={() => setCurrentSpreadIdx(idx => Math.max(0, idx - 1))}
          onNextSpread={() => setCurrentSpreadIdx(idx => Math.min(store.data.spreads.length - 1, idx + 1))}
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
          onUpdateGeometry={(slotId, left, top, width, height) =>
            currentSpread && store.updateSlotGeometry(currentSpread.id, slotId, left, top, width, height)
          }
        />
        {!isRightPanelCollapsed && (
          <RightPanel
            spread={currentSpread}
            selectedSlotId={selectedSlotId}
            onSetLayout={(side, layoutId) =>
              currentSpread && store.setLayout(currentSpread.id, side, layoutId)
            }
            onSetPageBackgroundColor={(side, color) =>
              currentSpread && store.setPageBackgroundColor(currentSpread.id, side, color)
            }
            onSetPageBackgroundImage={(side, assetId, assetPath) =>
              currentSpread && store.setPageBackgroundImage(currentSpread.id, side, assetId, assetPath)
            }
            onClearPageBackgroundImage={(side) =>
              currentSpread && store.clearPageBackgroundImage(currentSpread.id, side)
            }
            onAssignToSelected={(assetId, assetPath) => {
              if (selectedSlotId && currentSpread) {
                store.assignAsset(currentSpread.id, selectedSlotId, assetId, assetPath);
              }
            }}
          />
        )}
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
  coverAssetPath: string | null;
  onSetCover: (assetId: number, assetPath: string) => void;
  onClearCover: () => void;
}

function LeftPanel({ spreads, currentIdx, bookSize, onSelect, onAdd, onReorder, coverAssetPath, onSetCover, onClearCover }: LeftPanelProps) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [coverDragOver, setCoverDragOver] = useState(false);

  function handleCoverDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setCoverDragOver(false);
    const assetId = Number(e.dataTransfer.getData('assetId'));
    const assetPath = e.dataTransfer.getData('assetPath');
    if (assetId && assetPath) onSetCover(assetId, assetPath);
  }

  return (
    <div className="editor-left-panel">
      <div className="cover-section">
        <div className="cover-section-label">Cover</div>
        <div
          className={`cover-slot${coverDragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); setCoverDragOver(true); }}
          onDragLeave={() => setCoverDragOver(false)}
          onDrop={handleCoverDrop}
        >
          {coverAssetPath ? (
            <>
              <img src={coverAssetPath} alt="Cover" />
              <button className="cover-clear-btn" onClick={e => { e.stopPropagation(); onClearCover(); }} title="Remove cover">×</button>
            </>
          ) : (
            <span className="cover-slot-empty-icon">+</span>
          )}
        </div>
      </div>
      <div className="left-panel-header">
        <span className="panel-title">Spreads</span>
        <button className="btn btn-sm btn-primary" onClick={onAdd} title="Add spread">+</button>
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
          <div className="spread-list-empty">No spreads yet.<br />Click + to add one.</div>
        )}
      </div>
    </div>
  );
}

function SpreadMiniature({ spread, aspectRatio }: { spread: Spread; aspectRatio: number }) {
  const leftLayout = getLayout(spread.left.layoutId);
  const rightLayout = getLayout(spread.right.layoutId);
  return (
    <div className="spread-mini" style={{ aspectRatio: String(aspectRatio * 2) }}>
      <div className="spread-mini-page-bg spread-mini-page-bg--left" style={getPageBackgroundStyle(spread.left)} />
      <div className="spread-mini-page-bg spread-mini-page-bg--right" style={getPageBackgroundStyle(spread.right)} />
      {/* Left page slots – positions are halved to fit left side of spread */}
      {leftLayout.slotDefs.map(sd => {
        const slotId = `l:${sd.id}`;
        const slot = spread.left.slots.find(s => s.id === slotId);
        const rawLeft   = slot?.customLeft   ?? parseFloat(sd.left);
        const rawTop    = slot?.customTop    ?? parseFloat(sd.top);
        const rawWidth  = slot?.customWidth  ?? parseFloat(sd.width);
        const rawHeight = slot?.customHeight ?? parseFloat(sd.height);
        return (
          <div
            key={slotId}
            className="spread-mini-slot"
            style={{ left: `${rawLeft / 2}%`, top: `${rawTop}%`, width: `${rawWidth / 2}%`, height: `${rawHeight}%` }}
          >
            {slot?.assetPath && <img src={slot.assetPath} alt="" draggable={false} />}
          </div>
        );
      })}
      {/* Right page slots – offset by 50% */}
      {rightLayout.slotDefs.map(sd => {
        const slotId = `r:${sd.id}`;
        const slot = spread.right.slots.find(s => s.id === slotId);
        const rawLeft   = slot?.customLeft   ?? parseFloat(sd.left);
        const rawTop    = slot?.customTop    ?? parseFloat(sd.top);
        const rawWidth  = slot?.customWidth  ?? parseFloat(sd.width);
        const rawHeight = slot?.customHeight ?? parseFloat(sd.height);
        return (
          <div
            key={slotId}
            className="spread-mini-slot"
            style={{ left: `${50 + rawLeft / 2}%`, top: `${rawTop}%`, width: `${rawWidth / 2}%`, height: `${rawHeight}%` }}
          >
            {slot?.assetPath && <img src={slot.assetPath} alt="" draggable={false} />}
          </div>
        );
      })}
      <div className="spread-mini-divider" />
    </div>
  );
}

// ─── Canvas ───────────────────────────────────────────────────────────────

interface CanvasAreaProps {
  spread: Spread | null;
  bookSize: BookSize;
  zoom: number;
  currentPageStart: number;
  currentPageEnd: number;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrevSpread: () => void;
  onNextSpread: () => void;
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string | null) => void;
  onAssignAsset: (slotId: string, assetId: number, assetPath: string) => void;
  onClearSlot: (slotId: string) => void;
  onUpdateTransform: (slotId: string, offsetX: number, offsetY: number, scale: number) => void;
  onUpdateGeometry: (slotId: string, left: number, top: number, width: number, height: number) => void;
}

function CanvasArea({
  spread,
  bookSize,
  zoom,
  currentPageStart,
  currentPageEnd,
  canGoPrev,
  canGoNext,
  onPrevSpread,
  onNextSpread,
  selectedSlotId,
  onSelectSlot,
  onAssignAsset,
  onClearSlot,
  onUpdateTransform,
  onUpdateGeometry,
}: CanvasAreaProps) {
  if (!spread) {
    return (
      <div className="canvas-area">
        <div className="canvas-empty">
          <div className="canvas-empty-icon">📄</div>
          <p>No spreads yet.<br />Click + in the left panel.</p>
        </div>
      </div>
    );
  }

  const leftLayout  = getLayout(spread.left.layoutId);
  const rightLayout = getLayout(spread.right.layoutId);
  const baseSpreadWidth = 1200;
  const spreadAspectRatio = (bookSize.width * 2) / bookSize.height;
  const baseSpreadHeight = baseSpreadWidth / spreadAspectRatio;
  const scaledSpreadWidth = baseSpreadWidth * zoom;
  const scaledSpreadHeight = baseSpreadHeight * zoom;

  return (
    <div className="canvas-area-shell">
      <div className="canvas-area" onClick={() => onSelectSlot(null)}>
        <div className="canvas-scroll-inner">
        <div
          className="canvas-page-zoom-wrap"
          style={{ width: `${scaledSpreadWidth}px`, height: `${scaledSpreadHeight}px` }}
        >
          <div
            className="canvas-page"
            style={{
              width: `${baseSpreadWidth}px`,
              aspectRatio: `${bookSize.width * 2} / ${bookSize.height}`,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
            {/* Left page */}
            <div className="canvas-page-half canvas-page-left" style={getPageBackgroundStyle(spread.left)}>
              {leftLayout.slotDefs.map(sd => {
                const slotId = `l:${sd.id}`;
                const slot = spread.left.slots.find(s => s.id === slotId) ?? { id: slotId };
                return (
                  <CanvasSlot
                    key={slotId}
                    def={sd}
                    slot={slot}
                    zoom={zoom}
                    isSelected={selectedSlotId === slotId}
                    onAssign={(assetId, assetPath) => onAssignAsset(slotId, assetId, assetPath)}
                    onClear={() => onClearSlot(slotId)}
                    onSelect={() => onSelectSlot(slotId)}
                    onUpdateTransform={(offsetX, offsetY, scale) => onUpdateTransform(slotId, offsetX, offsetY, scale)}
                    onUpdateGeometry={(left, top, width, height) => onUpdateGeometry(slotId, left, top, width, height)}
                  />
                );
              })}
            </div>

            <div className="canvas-spread-divider" />

            {/* Right page */}
            <div className="canvas-page-half canvas-page-right" style={getPageBackgroundStyle(spread.right)}>
              {rightLayout.slotDefs.map(sd => {
                const slotId = `r:${sd.id}`;
                const slot = spread.right.slots.find(s => s.id === slotId) ?? { id: slotId };
                return (
                  <CanvasSlot
                    key={slotId}
                    def={sd}
                    slot={slot}
                    zoom={zoom}
                    isSelected={selectedSlotId === slotId}
                    onAssign={(assetId, assetPath) => onAssignAsset(slotId, assetId, assetPath)}
                    onClear={() => onClearSlot(slotId)}
                    onSelect={() => onSelectSlot(slotId)}
                    onUpdateTransform={(offsetX, offsetY, scale) => onUpdateTransform(slotId, offsetX, offsetY, scale)}
                    onUpdateGeometry={(left, top, width, height) => onUpdateGeometry(slotId, left, top, width, height)}
                  />
                );
              })}
            </div>
          </div>
        </div>
        </div>
      </div>
      <div className="canvas-spread-pager">
        <button className="canvas-spread-pager-btn" onClick={onPrevSpread} disabled={!canGoPrev} aria-label="Previous spread">
          ←
        </button>
        <div className="canvas-spread-pager-label">{currentPageStart} - {currentPageEnd}</div>
        <button className="canvas-spread-pager-btn" onClick={onNextSpread} disabled={!canGoNext} aria-label="Next spread">
          →
        </button>
      </div>
    </div>
  );
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface CanvasSlotProps {
  def: SlotDef;
  slot: Slot;
  zoom: number;
  isSelected: boolean;
  onAssign: (assetId: number, assetPath: string) => void;
  onClear: () => void;
  onSelect: () => void;
  onUpdateTransform: (offsetX: number, offsetY: number, scale: number) => void;
  onUpdateGeometry: (left: number, top: number, width: number, height: number) => void;
}

function CanvasSlot({ def, slot, zoom, isSelected, onAssign, onClear, onSelect, onUpdateTransform, onUpdateGeometry }: CanvasSlotProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [liveOffset, setLiveOffset] = useState<{ x: number; y: number } | null>(null);
  const [liveGeometry, setLiveGeometry] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const panRef    = useRef<{ startMx: number; startMy: number; startOx: number; startOy: number } | null>(null);
  const moveRef   = useRef<{ startMx: number; startMy: number; startLeft: number; startTop: number; startWidth: number; startHeight: number; parentW: number; parentH: number } | null>(null);
  const resizeRef = useRef<{ handle: ResizeHandle; startMx: number; startMy: number; startLeft: number; startTop: number; startWidth: number; startHeight: number; parentW: number; parentH: number } | null>(null);

  const containerRef          = useRef<HTMLDivElement>(null);
  const imgRef                = useRef<HTMLImageElement>(null);
  const slotRef               = useRef<HTMLDivElement>(null);
  const contextMenuRef        = useRef<HTMLDivElement>(null);
  const geometryInitialized   = useRef(false);

  const currentOffsetX = liveOffset?.x ?? (slot.offsetX ?? 0);
  const currentOffsetY = liveOffset?.y ?? (slot.offsetY ?? 0);
  const currentScale   = slot.scale ?? 1;

  // Effective geometry: slot custom override, else layout def
  const effectiveLeft   = slot.customLeft   ?? parseFloat(def.left);
  const effectiveTop    = slot.customTop    ?? parseFloat(def.top);
  const effectiveWidth  = slot.customWidth  ?? parseFloat(def.width);
  const effectiveHeight = slot.customHeight ?? parseFloat(def.height);

  const currentLeft   = liveGeometry?.left   ?? effectiveLeft;
  const currentTop    = liveGeometry?.top    ?? effectiveTop;
  const currentWidth  = liveGeometry?.width  ?? effectiveWidth;
  const currentHeight = liveGeometry?.height ?? effectiveHeight;

  function clampOffset(ox: number, oy: number, scale: number): { x: number; y: number } {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return { x: ox, y: oy };
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.offsetWidth;
    const ih = img.offsetHeight;
    const maxX = Math.max(0, (iw * scale - cw) / 2);
    const maxY = Math.max(0, (ih * scale - ch) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }

  function computeCoverScale(img: HTMLImageElement) {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih || !cw || !ch) return;
    onUpdateTransform(0, 0, Math.max(cw / iw, ch / ih));
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (slot.scale != null) return;
    computeCoverScale(e.currentTarget);
  }

  useEffect(() => {
    if (slot.scale != null || !slot.assetPath || !imgRef.current) return;
    const img = imgRef.current;
    if (img.complete && img.naturalWidth > 0) computeCoverScale(img);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.assetPath]);

  // Recompute cover scale when placeholder is resized (skip initial mount)
  useEffect(() => {
    if (!geometryInitialized.current) {
      geometryInitialized.current = true;
      return;
    }
    if (!slot.assetPath || !imgRef.current) return;
    const img = imgRef.current;
    if (img.complete && img.naturalWidth > 0) computeCoverScale(img);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveWidth, effectiveHeight]);

  // Cleanup all window listeners on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handlePanMove);
      window.removeEventListener('mouseup', handlePanEnd);
      window.removeEventListener('mousemove', handleMoveMove);
      window.removeEventListener('mouseup', handleMoveEnd);
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isContextMenuOpen) return;
    const handleWindowMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (contextMenuRef.current?.contains(target)) return;
      if (slotRef.current?.contains(target)) return;
      setIsContextMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsContextMenuOpen(false);
    };
    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleWindowMouseDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isContextMenuOpen]);

  // ── Pan ───────────────────────────────────────────────────────────────

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
    const raw = { x: startOx + (e.clientX - startMx) / zoom, y: startOy + (e.clientY - startMy) / zoom };
    setLiveOffset(clampOffset(raw.x, raw.y, currentScale));
  }

  function handlePanEnd(e: MouseEvent) {
    if (!panRef.current) return;
    const { startMx, startMy, startOx, startOy } = panRef.current;
    const rawX = startOx + (e.clientX - startMx) / zoom;
    const rawY = startOy + (e.clientY - startMy) / zoom;
    const { x: finalX, y: finalY } = clampOffset(rawX, rawY, currentScale);
    panRef.current = null;
    setLiveOffset(null);
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanEnd);
    onUpdateTransform(finalX, finalY, currentScale);
  }

  // ── Move ──────────────────────────────────────────────────────────────

  function handleMoveStart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const parent = slotRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    moveRef.current = {
      startMx: e.clientX,
      startMy: e.clientY,
      startLeft: effectiveLeft,
      startTop: effectiveTop,
      startWidth: effectiveWidth,
      startHeight: effectiveHeight,
      parentW: rect.width,
      parentH: rect.height,
    };
    window.addEventListener('mousemove', handleMoveMove);
    window.addEventListener('mouseup', handleMoveEnd);
  }

  function handleMoveMove(e: MouseEvent) {
    if (!moveRef.current) return;
    const { startMx, startMy, startLeft, startTop, startWidth, startHeight, parentW, parentH } = moveRef.current;
    const newLeft = Math.max(0, Math.min(100 - startWidth, startLeft + (e.clientX - startMx) / parentW * 100));
    const newTop  = Math.max(0, Math.min(100 - startHeight, startTop  + (e.clientY - startMy) / parentH * 100));
    setLiveGeometry({ left: newLeft, top: newTop, width: startWidth, height: startHeight });
  }

  function handleMoveEnd(e: MouseEvent) {
    if (!moveRef.current) return;
    const { startMx, startMy, startLeft, startTop, startWidth, startHeight, parentW, parentH } = moveRef.current;
    const newLeft = Math.max(0, Math.min(100 - startWidth, startLeft + (e.clientX - startMx) / parentW * 100));
    const newTop  = Math.max(0, Math.min(100 - startHeight, startTop  + (e.clientY - startMy) / parentH * 100));
    moveRef.current = null;
    setLiveGeometry(null);
    window.removeEventListener('mousemove', handleMoveMove);
    window.removeEventListener('mouseup', handleMoveEnd);
    onUpdateGeometry(newLeft, newTop, startWidth, startHeight);
  }

  // ── Resize ────────────────────────────────────────────────────────────

  function getResizeGeometry(e: { clientX: number; clientY: number }) {
    if (!resizeRef.current) return null;
    const { handle, startMx, startMy, startLeft, startTop, startWidth, startHeight, parentW, parentH } = resizeRef.current;
    const dx = (e.clientX - startMx) / parentW * 100;
    const dy = (e.clientY - startMy) / parentH * 100;
    const MIN = 5;

    let left = startLeft, top = startTop, width = startWidth, height = startHeight;

    if (handle === 'e' || handle === 'ne' || handle === 'se') {
      width = Math.max(MIN, startWidth + dx);
    }
    if (handle === 'w' || handle === 'nw' || handle === 'sw') {
      const newW = Math.max(MIN, startWidth - dx);
      left = startLeft + (startWidth - newW);
      width = newW;
    }
    if (handle === 's' || handle === 'se' || handle === 'sw') {
      height = Math.max(MIN, startHeight + dy);
    }
    if (handle === 'n' || handle === 'nw' || handle === 'ne') {
      const newH = Math.max(MIN, startHeight - dy);
      top = startTop + (startHeight - newH);
      height = newH;
    }

    left   = Math.max(0, left);
    top    = Math.max(0, top);
    width  = Math.min(width,  100 - left);
    height = Math.min(height, 100 - top);

    return { left, top, width, height };
  }

  function handleResizeStart(e: React.MouseEvent, handle: ResizeHandle) {
    e.preventDefault();
    e.stopPropagation();
    const parent = slotRef.current?.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    resizeRef.current = {
      handle,
      startMx: e.clientX,
      startMy: e.clientY,
      startLeft: effectiveLeft,
      startTop: effectiveTop,
      startWidth: effectiveWidth,
      startHeight: effectiveHeight,
      parentW: rect.width,
      parentH: rect.height,
    };
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  }

  function handleResizeMove(e: MouseEvent) {
    const geom = getResizeGeometry(e);
    if (geom) setLiveGeometry(geom);
  }

  function handleResizeEnd(e: MouseEvent) {
    const geom = getResizeGeometry(e);
    resizeRef.current = null;
    setLiveGeometry(null);
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
    if (geom) onUpdateGeometry(geom.left, geom.top, geom.width, geom.height);
  }

  const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const canDelete = Boolean(slot.assetPath);

  return (
    <div
      ref={slotRef}
      className={`canvas-slot${isDragOver ? ' drag-over' : ''}${isSelected ? ' selected' : ''}`}
      style={{ left: `${currentLeft}%`, top: `${currentTop}%`, width: `${currentWidth}%`, height: `${currentHeight}%` }}
      onClick={e => {
        e.stopPropagation();
        onSelect();
        setIsContextMenuOpen(true);
      }}
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        setIsContextMenuOpen(true);
      }}
      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setIsContextMenuOpen(false);
        const assetId = Number(e.dataTransfer.getData('assetId'));
        const assetPath = e.dataTransfer.getData('assetPath');
        if (assetId && assetPath) onAssign(assetId, assetPath);
      }}
    >
      {isSelected && (
        <div className="slot-move-handle" onMouseDown={handleMoveStart} title="Move" />
      )}
      {isSelected && RESIZE_HANDLES.map(h => (
        <div
          key={h}
          className={`slot-resize-handle slot-resize-handle--${h}`}
          onMouseDown={e => handleResizeStart(e, h)}
        />
      ))}
      <div className="canvas-slot-inner" ref={containerRef}>
        {slot.assetPath ? (
          <>
            <img
              ref={imgRef}
              src={slot.assetPath}
              alt=""
              className="slot-image"
              draggable={false}
              style={{
                transform: `translate(calc(-50% + ${currentOffsetX}px), calc(-50% + ${currentOffsetY}px)) scale(${currentScale})`,
              }}
              onLoad={handleImageLoad}
              onMouseDown={handlePanStart}
            />
          </>
        ) : (
          <div className="slot-empty">
            <span className="slot-empty-icon">+</span>
          </div>
        )}
      </div>
      {isContextMenuOpen && (
        <div
          ref={contextMenuRef}
          className="slot-context-menu slot-context-menu--dock"
          onClick={e => e.stopPropagation()}
        >
          <button
            className="slot-context-menu-item slot-context-menu-item--danger"
            disabled={!canDelete}
            onClick={() => {
              onClear();
              setIsContextMenuOpen(false);
            }}
          >
            <span className="slot-context-menu-icon">🗑</span>
            <span className="slot-context-menu-label">Delete</span>
          </button>
          <button className="slot-context-menu-item" disabled>
            <span className="slot-context-menu-icon">🔍</span>
            <span className="slot-context-menu-label">Scale</span>
          </button>
          <button className="slot-context-menu-item" disabled>
            <span className="slot-context-menu-icon">⬜</span>
            <span className="slot-context-menu-label">Fit to page</span>
          </button>
          <button className="slot-context-menu-item" disabled>
            <span className="slot-context-menu-icon">⧉</span>
            <span className="slot-context-menu-label">Copy</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────

interface RightPanelProps {
  spread: Spread | null;
  selectedSlotId: string | null;
  onSetLayout: (side: 'left' | 'right', layoutId: LayoutId) => void;
  onSetPageBackgroundColor: (side: 'left' | 'right', color: string) => void;
  onSetPageBackgroundImage: (side: 'left' | 'right', assetId: number, assetPath: string) => void;
  onClearPageBackgroundImage: (side: 'left' | 'right') => void;
  onAssignToSelected: (assetId: number, assetPath: string) => void;
}

function RightPanel({
  spread,
  selectedSlotId,
  onSetLayout,
  onSetPageBackgroundColor,
  onSetPageBackgroundImage,
  onClearPageBackgroundImage,
  onAssignToSelected,
}: RightPanelProps) {
  const [tab, setTab] = useState<'photos' | 'layout' | 'background'>('photos');

  return (
    <div className="editor-right-panel">
      <div className="right-panel-content">
        {tab === 'photos' ? (
          <PhotosTab selectedSlotId={selectedSlotId} onAssignToSelected={onAssignToSelected} />
        ) : tab === 'layout' ? (
          <LayoutTab spread={spread} onSetLayout={onSetLayout} />
        ) : (
          <PageBackgroundTab
            spread={spread}
            onSetPageBackgroundColor={onSetPageBackgroundColor}
            onSetPageBackgroundImage={onSetPageBackgroundImage}
            onClearPageBackgroundImage={onClearPageBackgroundImage}
          />
        )}
      </div>
      <div className="right-panel-tabs">
        <button className={`tab-btn${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')}>
          Photos
        </button>
        <button className={`tab-btn${tab === 'layout' ? ' active' : ''}`} onClick={() => setTab('layout')}>
          Layout
        </button>
        <button className={`tab-btn${tab === 'background' ? ' active' : ''}`} onClick={() => setTab('background')}>
          Page background
        </button>
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

  async function handleUpload(files: FileList | File[]) {
    const filesToUpload = Array.from(files);
    if (!filesToUpload.length) return;
    setUploading(true);
    setUploadProgress(0);
    for (let i = 0; i < filesToUpload.length; i++) {
      const formData = new FormData();
      formData.append('file', filesToUpload[i]);
      await new Promise<void>(resolve => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) {
            const fileProgress = e.loaded / e.total;
            setUploadProgress(Math.round(((i + fileProgress) / filesToUpload.length) * 100));
          }
        };
        xhr.onloadend = () => resolve();
        xhr.open('POST', '/api/asset/upload');
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
          <span className="upload-zone-text">Drag photos here or click to upload</span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length) handleUpload(files);
          e.target.value = '';
        }}
      />
      <div className="photos-search-row">
        <input
          className="form-input"
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      {selectedSlotId && (
        <div className="slot-assign-hint">Click a photo to insert into the slot</div>
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
          <div className="assets-empty">No photos</div>
        )}
      </div>
    </div>
  );
}

// ─── Page Background Tab ────────────────────────────────────────────────

interface PageBackgroundTabProps {
  spread: Spread | null;
  onSetPageBackgroundColor: (side: 'left' | 'right', color: string) => void;
  onSetPageBackgroundImage: (side: 'left' | 'right', assetId: number, assetPath: string) => void;
  onClearPageBackgroundImage: (side: 'left' | 'right') => void;
}

function PageBackgroundTab({
  spread,
  onSetPageBackgroundColor,
  onSetPageBackgroundImage,
  onClearPageBackgroundImage,
}: PageBackgroundTabProps) {
  const [targetSide, setTargetSide] = useState<'left' | 'right' | 'both'>('both');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState('');

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

  function applyToSelectedSides(fn: (side: 'left' | 'right') => void) {
    if (targetSide === 'both') {
      fn('left');
      fn('right');
      return;
    }
    fn(targetSide);
  }

  const colorPreviewSide = targetSide === 'right' ? 'right' : 'left';
  const currentColor = spread?.[colorPreviewSide].bgColor ?? '#ffffff';

  return (
    <div className="background-tab">
      <p className="panel-section-label">Page</p>
      <div className="background-target-row">
        <button
          className={`background-target-btn${targetSide === 'left' ? ' active' : ''}`}
          onClick={() => setTargetSide('left')}
        >
          Left
        </button>
        <button
          className={`background-target-btn${targetSide === 'right' ? ' active' : ''}`}
          onClick={() => setTargetSide('right')}
        >
          Right
        </button>
        <button
          className={`background-target-btn${targetSide === 'both' ? ' active' : ''}`}
          onClick={() => setTargetSide('both')}
        >
          Both
        </button>
      </div>

      <p className="panel-section-label" style={{ marginTop: '14px' }}>Color</p>
      <div className="background-color-row">
        <input
          className="background-color-input"
          type="color"
          value={currentColor}
          disabled={!spread}
          onChange={e => applyToSelectedSides(side => onSetPageBackgroundColor(side, e.target.value))}
        />
      </div>

      <p className="panel-section-label" style={{ marginTop: '14px' }}>Background photos</p>
      <div className="photos-search-row">
        <input
          className="form-input"
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="asset-thumb-grid background-assets-grid">
        {assets.map(asset => (
          <button
            key={asset.id}
            className="asset-thumb background-thumb-btn"
            disabled={!spread || !asset.path}
            onClick={() => {
              if (asset.path) applyToSelectedSides(side => onSetPageBackgroundImage(side, asset.id, asset.path!));
            }}
            title={asset.original_name ?? asset.path}
          >
            <img src={asset.path} alt={asset.original_name} draggable={false} />
          </button>
        ))}
        {assets.length === 0 && (
          <div className="assets-empty">No photos</div>
        )}
      </div>

      <button
        className="btn btn-sm"
        style={{ margin: '8px 10px 10px' }}
        onClick={() => applyToSelectedSides(side => onClearPageBackgroundImage(side))}
        disabled={!spread}
      >
        Clear background photo
      </button>
    </div>
  );
}

// ─── Layout Tab ───────────────────────────────────────────────────────────

interface LayoutTabProps {
  spread: Spread | null;
  onSetLayout: (side: 'left' | 'right', layoutId: LayoutId) => void;
}

function LayoutTab({ spread, onSetLayout }: LayoutTabProps) {
  return (
    <div className="layout-tab">
      <p className="panel-section-label">Left page</p>
      <div className="layout-grid">
        {LAYOUTS.map(layout => (
          <button
            key={layout.id}
            className={`layout-option${spread?.left.layoutId === layout.id ? ' active' : ''}`}
            onClick={() => onSetLayout('left', layout.id)}
            title={layout.label}
          >
            <LayoutPreview slotDefs={layout.slotDefs} />
            <span>{layout.label}</span>
          </button>
        ))}
      </div>

      <p className="panel-section-label" style={{ marginTop: '16px' }}>Right page</p>
      <div className="layout-grid">
        {LAYOUTS.map(layout => (
          <button
            key={layout.id}
            className={`layout-option${spread?.right.layoutId === layout.id ? ' active' : ''}`}
            onClick={() => onSetLayout('right', layout.id)}
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
