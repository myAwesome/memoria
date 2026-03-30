import { useReducer, useCallback } from 'react';
import type { ProjectData, Spread, LayoutId } from '../types/editor';
import { LAYOUTS } from './layouts';

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function getSide(slotId: string): 'left' | 'right' {
  return slotId.startsWith('r:') ? 'right' : 'left';
}

export function makeSpread(): Spread {
  const layout = LAYOUTS[0]; // '1col'
  return {
    id: makeId(),
    left:  { layoutId: '1col', slots: layout.slotDefs.map(sd => ({ id: `l:${sd.id}` })) },
    right: { layoutId: '1col', slots: layout.slotDefs.map(sd => ({ id: `r:${sd.id}` })) },
  };
}

type Action =
  | { type: 'ADD_SPREAD' }
  | { type: 'DELETE_SPREAD'; idx: number }
  | { type: 'REORDER_SPREADS'; from: number; to: number }
  | { type: 'SET_LAYOUT'; spreadId: string; side: 'left' | 'right'; layoutId: LayoutId }
  | { type: 'ASSIGN_ASSET'; spreadId: string; slotId: string; assetId: number; assetPath: string }
  | { type: 'CLEAR_SLOT'; spreadId: string; slotId: string }
  | { type: 'UPDATE_SLOT_TRANSFORM'; spreadId: string; slotId: string; offsetX: number; offsetY: number; scale: number }
  | { type: 'UNDO' }
  | { type: 'REDO' };

interface HistoryState {
  past: ProjectData[];
  present: ProjectData;
  future: ProjectData[];
}

function applyAction(present: ProjectData, action: Action): ProjectData {
  switch (action.type) {
    case 'ADD_SPREAD':
      return { ...present, spreads: [...present.spreads, makeSpread()] };

    case 'DELETE_SPREAD': {
      const spreads = present.spreads.filter((_, i) => i !== action.idx);
      return { ...present, spreads };
    }

    case 'REORDER_SPREADS': {
      const spreads = [...present.spreads];
      const [moved] = spreads.splice(action.from, 1);
      spreads.splice(action.to, 0, moved);
      return { ...present, spreads };
    }

    case 'SET_LAYOUT': {
      const layout = LAYOUTS.find(l => l.id === action.layoutId) ?? LAYOUTS[0];
      const prefix = action.side === 'left' ? 'l:' : 'r:';
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const page = s[action.side];
        const newSlots = layout.slotDefs.map(sd => {
          const slotId = `${prefix}${sd.id}`;
          const existing = page.slots.find(sl => sl.id === slotId);
          return existing ?? { id: slotId };
        });
        return { ...s, [action.side]: { layoutId: action.layoutId, slots: newSlots } };
      });
      return { ...present, spreads };
    }

    case 'ASSIGN_ASSET': {
      const side = getSide(action.slotId);
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const page = s[side];
        const slots = page.slots.map(sl =>
          sl.id === action.slotId
            ? { ...sl, assetId: action.assetId, assetPath: action.assetPath }
            : sl
        );
        return { ...s, [side]: { ...page, slots } };
      });
      return { ...present, spreads };
    }

    case 'CLEAR_SLOT': {
      const side = getSide(action.slotId);
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const page = s[side];
        const slots = page.slots.map(sl =>
          sl.id === action.slotId ? { id: sl.id } : sl
        );
        return { ...s, [side]: { ...page, slots } };
      });
      return { ...present, spreads };
    }

    case 'UPDATE_SLOT_TRANSFORM': {
      const side = getSide(action.slotId);
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const page = s[side];
        const slots = page.slots.map(sl =>
          sl.id === action.slotId
            ? { ...sl, offsetX: action.offsetX, offsetY: action.offsetY, scale: action.scale }
            : sl
        );
        return { ...s, [side]: { ...page, slots } };
      });
      return { ...present, spreads };
    }

    default:
      return present;
  }
}

function reducer(state: HistoryState, action: Action): HistoryState {
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state;
    const [newPresent, ...newPast] = state.past;
    return { past: newPast, present: newPresent, future: [state.present, ...state.future] };
  }

  if (action.type === 'REDO') {
    if (state.future.length === 0) return state;
    const [newPresent, ...newFuture] = state.future;
    return { past: [state.present, ...state.past], present: newPresent, future: newFuture };
  }

  const newPresent = applyAction(state.present, action);
  if (newPresent === state.present) return state;

  return {
    past: [state.present, ...state.past].slice(0, 50),
    present: newPresent,
    future: [],
  };
}

export function useEditorStore(initial: ProjectData) {
  const [history, dispatch] = useReducer(reducer, {
    past: [],
    present: initial,
    future: [],
  });

  return {
    data: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    addSpread:    useCallback(() => dispatch({ type: 'ADD_SPREAD' }), []),
    deleteSpread: useCallback((idx: number) => dispatch({ type: 'DELETE_SPREAD', idx }), []),
    reorderSpreads: useCallback((from: number, to: number) => dispatch({ type: 'REORDER_SPREADS', from, to }), []),
    setLayout:    useCallback((spreadId: string, side: 'left' | 'right', layoutId: LayoutId) =>
      dispatch({ type: 'SET_LAYOUT', spreadId, side, layoutId }), []),
    assignAsset:  useCallback((spreadId: string, slotId: string, assetId: number, assetPath: string) =>
      dispatch({ type: 'ASSIGN_ASSET', spreadId, slotId, assetId, assetPath }), []),
    clearSlot:    useCallback((spreadId: string, slotId: string) =>
      dispatch({ type: 'CLEAR_SLOT', spreadId, slotId }), []),
    updateSlotTransform: useCallback((spreadId: string, slotId: string, offsetX: number, offsetY: number, scale: number) =>
      dispatch({ type: 'UPDATE_SLOT_TRANSFORM', spreadId, slotId, offsetX, offsetY, scale }), []),
    undo: useCallback(() => dispatch({ type: 'UNDO' }), []),
    redo: useCallback(() => dispatch({ type: 'REDO' }), []),
  };
}
