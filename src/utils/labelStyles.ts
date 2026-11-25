import type { LabelColor } from '../types/planner';

export const LABEL_COLOR_META: Record<
  LabelColor,
  { dot: string; strip: string; blockBg: string; blockBorder: string; text: string }
> = {
  blue: {
    dot: 'bg-blue-600',
    strip: 'bg-blue-600',
    blockBg: 'bg-blue-50',
    blockBorder: 'border-blue-200',
    text: 'text-blue-700',
  },
  emerald: {
    dot: 'bg-emerald-600',
    strip: 'bg-emerald-600',
    blockBg: 'bg-emerald-50',
    blockBorder: 'border-emerald-200',
    text: 'text-emerald-700',
  },
  amber: {
    dot: 'bg-amber-600',
    strip: 'bg-amber-500',
    blockBg: 'bg-amber-50',
    blockBorder: 'border-amber-200',
    text: 'text-amber-700',
  },
  rose: {
    dot: 'bg-rose-600',
    strip: 'bg-rose-600',
    blockBg: 'bg-rose-50',
    blockBorder: 'border-rose-200',
    text: 'text-rose-700',
  },
  violet: {
    dot: 'bg-violet-600',
    strip: 'bg-violet-600',
    blockBg: 'bg-violet-50',
    blockBorder: 'border-violet-200',
    text: 'text-violet-700',
  },
  slate: {
    dot: 'bg-slate-600',
    strip: 'bg-slate-500',
    blockBg: 'bg-slate-100',
    blockBorder: 'border-slate-300',
    text: 'text-slate-700',
  },
};
