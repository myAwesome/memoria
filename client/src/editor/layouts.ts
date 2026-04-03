import type { LayoutTemplate } from '../types/editor';

export const LAYOUTS: LayoutTemplate[] = [
  {
    id: '1col',
    label: '1 photo',
    slotDefs: [
      { id: 's1', left: '0%', top: '0%', width: '100%', height: '100%' },
    ],
  },
  {
    id: '2col',
    label: '2 columns',
    slotDefs: [
      { id: 's1', left: '0%',  top: '0%', width: '50%', height: '100%' },
      { id: 's2', left: '50%', top: '0%', width: '50%', height: '100%' },
    ],
  },
  {
    id: '1+2',
    label: '1 + 2',
    slotDefs: [
      { id: 's1', left: '0%',  top: '0%',  width: '50%', height: '100%' },
      { id: 's2', left: '50%', top: '0%',  width: '50%', height: '50%' },
      { id: 's3', left: '50%', top: '50%', width: '50%', height: '50%' },
    ],
  },
  {
    id: 'mosaic',
    label: 'Mosaic',
    slotDefs: [
      { id: 's1', left: '0%',  top: '0%',  width: '60%', height: '60%' },
      { id: 's2', left: '60%', top: '0%',  width: '40%', height: '40%' },
      { id: 's3', left: '0%',  top: '60%', width: '40%', height: '40%' },
      { id: 's4', left: '40%', top: '60%', width: '60%', height: '40%' },
    ],
  },
];

export function getLayout(id: string): LayoutTemplate {
  return LAYOUTS.find(l => l.id === id) ?? LAYOUTS[0];
}
