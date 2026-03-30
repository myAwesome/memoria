import { useReducer, useCallback } from 'react';
import type { ProjectData, Spread, LayoutId } from '../types/editor';
import { LAYOUTS } from './layouts';

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function makeSpread(layoutId: LayoutId = '1col'): Spread {
  const layout = LAYOUTS.find(l => l.id === layoutId) ?? LAYOUTS[0];
  return {
    id: makeId(),
    layoutId,
    slots: layout.slotDefs.map(sd => ({ id: sd.id })),
  };
}

type Action =
  | { type: 'ADD_SPREAD' }
  | { type: 'DELETE_SPREAD'; idx: number }
  | { type: 'REORDER_SPREADS'; from: number; to: number }
  | { type: 'SET_LAYOUT'; spreadId: string; layoutId: LayoutId }
  | { type: 'ASSIGN_ASSET'; spreadId: string; slotId: string; assetId: number; assetPath: string }
  | { type: 'CLEAR_SLOT'; spreadId: string; slotId: string }
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
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const newSlots = layout.slotDefs.map(sd => {
          const existing = s.slots.find(sl => sl.id === sd.id);
          return existing ?? { id: sd.id };
        });
        return { ...s, layoutId: action.layoutId, slots: newSlots };
      });
      return { ...present, spreads };
    }

    case 'ASSIGN_ASSET': {
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const slots = s.slots.map(sl =>
          sl.id === action.slotId
            ? { ...sl, assetId: action.assetId, assetPath: action.assetPath }
            : sl
        );
        return { ...s, slots };
      });
      return { ...present, spreads };
    }

    case 'CLEAR_SLOT': {
      const spreads = present.spreads.map(s => {
        if (s.id !== action.spreadId) return s;
        const slots = s.slots.map(sl =>
          sl.id === action.slotId ? { id: sl.id } : sl
        );
        return { ...s, slots };
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
    setLayout:    useCallback((spreadId: string, layoutId: LayoutId) => dispatch({ type: 'SET_LAYOUT', spreadId, layoutId }), []),
    assignAsset:  useCallback((spreadId: string, slotId: string, assetId: number, assetPath: string) =>
      dispatch({ type: 'ASSIGN_ASSET', spreadId, slotId, assetId, assetPath }), []),
    clearSlot:    useCallback((spreadId: string, slotId: string) => dispatch({ type: 'CLEAR_SLOT', spreadId, slotId }), []),
    undo: useCallback(() => dispatch({ type: 'UNDO' }), []),
    redo: useCallback(() => dispatch({ type: 'REDO' }), []),
  };
}
