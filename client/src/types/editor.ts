export type LayoutId = '1col' | '2col' | '1+2' | 'mosaic';

export interface SlotDef {
  id: string;
  left: string;   // CSS percentage string, e.g. "0%"
  top: string;
  width: string;
  height: string;
}

export interface LayoutTemplate {
  id: LayoutId;
  label: string;
  slotDefs: SlotDef[];
}

export interface Slot {
  id: string;
  assetId?: number;
  assetPath?: string;
  offsetX?: number;  // px offset for pan, default 0
  offsetY?: number;
  scale?: number;    // zoom factor, default 1
}

export interface Spread {
  id: string;
  layoutId: LayoutId;
  slots: Slot[];
}

export interface ProjectData {
  spreads: Spread[];
  size: string; // BookSizeId
}
