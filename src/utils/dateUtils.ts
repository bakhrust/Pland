export const HOUR_START = 8;
export const HOUR_END = 21;
export const TOTAL_HOURS = HOUR_END - HOUR_START;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Formats a Date as local 'YYYY-MM-DD' */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Formats a Date as local 'YYYY-MM-DDTHH:mm' */
export function toLocalDateTimeInput(d: Date): string {
  return `${toLocalDateKey(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Parses 'YYYY-MM-DD' or ISO dateTime string into a local Date safely */
export function parseFlexibleDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart] = value.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = timePart.split(':').map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(value);
}

/** Extracts 'YYYY-MM-DD' from an ISO date or dateTime string */
export function extractDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value) && !value.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(value)) {
    return value.slice(0, 10);
  }
  return toLocalDateKey(parseFlexibleDate(value));
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes());
  return next;
}

/** Returns Monday 00:00 of the week containing `d` */
export function getWeekStartMonday(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff, 0, 0, 0, 0);
}

/** Returns 7 Dates (Mon..Sun) for the week containing `anchor` */
export function getWeekDays(anchor: Date): Date[] {
  const monday = getWeekStartMonday(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Returns 14 Dates starting from Monday of `anchor`'s week (or custom start) for Timeline view */
export function getTimelineDays(anchor: Date, count = 14): Date[] {
  const monday = getWeekStartMonday(anchor);
  return Array.from({ length: count }, (_, i) => addDays(monday, i));
}

/** Returns 35 or 42 Dates (Mon..Sun rows) covering the month of `anchor` */
export function getMonthGridDays(anchor: Date): Date[] {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = getWeekStartMonday(firstOfMonth);
  const endWeekday = lastOfMonth.getDay() === 0 ? 7 : lastOfMonth.getDay();
  const end = addDays(lastOfMonth, 7 - endWeekday);

  const days: Date[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRussianShortDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
}

export function formatRussianWeekdayShort(d: Date): string {
  const map = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return map[d.getDay()];
}

export function formatRussianMonthYear(d: Date): string {
  const raw = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatTimeHHMM(value: string): string {
  const d = parseFlexibleDate(value);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDurationLabel(startStr: string, endStr: string): string {
  const start = parseFlexibleDate(startStr);
  const end = parseFlexibleDate(endStr);
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (mins < 60) return `${mins} м`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ч` : `${h} ч ${m} м`;
}

export interface PositionedTimeBlock<T> {
  item: T;
  startMinutes: number;
  endMinutes: number;
  topPercent: number;
  heightPercent: number;
  column: number;
  totalColumns: number;
}

/**
 * Computes non-overlapping vertical layout columns for timed items within a single day.
 * Clamps items visually to [HOUR_START, HOUR_END] while preserving minimum readable height.
 */
export function layoutDayTimeBlocks<T>(
  items: Array<{ item: T; start: string; end: string }>,
  hourStart = HOUR_START,
  hourEnd = HOUR_END
): PositionedTimeBlock<T>[] {
  const minBound = hourStart * 60;
  const maxBound = hourEnd * 60;
  const totalMinutes = maxBound - minBound;

  const parsed = items
    .map((entry) => {
      const s = parseFlexibleDate(entry.start);
      const e = parseFlexibleDate(entry.end);
      const rawStart = s.getHours() * 60 + s.getMinutes();
      const rawEnd = Math.max(rawStart + 30, e.getHours() * 60 + e.getMinutes());
      const clampedStart = Math.max(minBound, Math.min(maxBound - 30, rawStart));
      const clampedEnd = Math.min(maxBound, Math.max(clampedStart + 30, rawEnd));
      return {
        item: entry.item,
        startMinutes: clampedStart,
        endMinutes: clampedEnd,
      };
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || b.endMinutes - a.endMinutes);

  if (parsed.length === 0) return [];

  // Cluster overlapping blocks
  const clusters: typeof parsed[] = [];
  let currentCluster: typeof parsed = [];
  let clusterEnd = -1;

  for (const block of parsed) {
    if (currentCluster.length === 0 || block.startMinutes < clusterEnd) {
      currentCluster.push(block);
      clusterEnd = Math.max(clusterEnd, block.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [block];
      clusterEnd = block.endMinutes;
    }
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const result: PositionedTimeBlock<T>[] = [];

  for (const cluster of clusters) {
    const colEnds: number[] = [];
    const assigned: Array<{ block: (typeof parsed)[0]; col: number }> = [];

    for (const block of cluster) {
      let placedCol = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= block.startMinutes) {
          placedCol = c;
          colEnds[c] = block.endMinutes;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEnds.length;
        colEnds.push(block.endMinutes);
      }
      assigned.push({ block, col: placedCol });
    }

    const totalCols = colEnds.length;
    for (const { block, col } of assigned) {
      const topPercent = ((block.startMinutes - minBound) / totalMinutes) * 100;
      const heightPercent = Math.max(
        ((block.endMinutes - block.startMinutes) / totalMinutes) * 100,
        (30 / totalMinutes) * 100
      );
      result.push({
        item: block.item,
        startMinutes: block.startMinutes,
        endMinutes: block.endMinutes,
        topPercent,
        heightPercent,
        column: col,
        totalColumns: totalCols,
      });
    }
  }

  return result;
}

export interface TimelineSpan {
  startIndex: number;
  spanDays: number;
  clippedLeft: boolean;
  clippedRight: boolean;
}

/**
 * Computes day-index span for a card or event across a visible array of timeline days.
 * Returns null if completely outside the visible range.
 */
export function computeTimelineSpan(
  startStr: string,
  endStr: string | null,
  timelineDays: Date[],
  endIsExclusive = false
): TimelineSpan | null {
  if (timelineDays.length === 0) return null;

  const rangeStart = new Date(
    timelineDays[0].getFullYear(),
    timelineDays[0].getMonth(),
    timelineDays[0].getDate()
  );
  const lastDay = timelineDays[timelineDays.length - 1];
  const rangeEnd = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());

  const startKey = extractDateKey(startStr);
  const sDate = parseFlexibleDate(startKey);
  const rawEndKey = endStr ? extractDateKey(endStr) : startKey;
  let eDate = parseFlexibleDate(rawEndKey);
  if (eDate < sDate) eDate = sDate;

  // Google Calendar all-day end dates are exclusive (e.g. Nov 24 to Nov 25 means 1 day: Nov 24)
  if (endIsExclusive && endStr && /^\d{4}-\d{2}-\d{2}$/.test(endStr) && eDate > sDate) {
    eDate = addDays(eDate, -1);
  }

  if (eDate < rangeStart || sDate > rangeEnd) {
    return null;
  }

  const clippedLeft = sDate < rangeStart;
  const clippedRight = eDate > rangeEnd;

  const visibleStart = clippedLeft ? rangeStart : sDate;
  const visibleEnd = clippedRight ? rangeEnd : eDate;

  const msPerDay = 86400000;
  const startIndex = Math.round((visibleStart.getTime() - rangeStart.getTime()) / msPerDay);
  const endIndex = Math.round((visibleEnd.getTime() - rangeStart.getTime()) / msPerDay);

  return {
    startIndex,
    spanDays: Math.max(1, endIndex - startIndex + 1),
    clippedLeft,
    clippedRight,
  };
}
