import type {
  BoardList,
  BoardRecord,
  BoardState,
  CardItem,
  ChecklistItem,
  FilterState,
  LabelColor,
  WorkspaceData,
} from '../types/planner';
import { addDays, pad2, parseFlexibleDate, toLocalDateKey, toLocalDateTimeInput } from './dateUtils';

export function filterCards(cards: CardItem[], filters: FilterState): CardItem[] {
  const query = filters.search.trim().toLowerCase();
  return cards.filter((card) => {
    if (query) {
      const matchesTitle = card.title.toLowerCase().includes(query);
      const matchesDesc = card.description.toLowerCase().includes(query);
      if (!matchesTitle && !matchesDesc) return false;
    }
    if (filters.labelId !== 'all' && !card.labelIds.includes(filters.labelId)) {
      return false;
    }
    return true;
  });
}

export function getChecklistProgress(checklist: ChecklistItem[]): { done: number; total: number } {
  const total = checklist.length;
  const done = checklist.filter((item) => item.done).length;
  return { done, total };
}

export function moveCardInBoard(
  cards: CardItem[],
  cardId: string,
  targetListId: string,
  targetIndex?: number
): CardItem[] {
  const moving = cards.find((c) => c.id === cardId);
  if (!moving) return cards;

  const remaining = cards.filter((c) => c.id !== cardId);
  const targetListCards = remaining
    .filter((c) => c.listId === targetListId)
    .sort((a, b) => a.order - b.order);

  const insertAt =
    targetIndex === undefined
      ? targetListCards.length
      : Math.max(0, Math.min(targetIndex, targetListCards.length));

  const updatedMoving: CardItem = {
    ...moving,
    listId: targetListId,
  };

  targetListCards.splice(insertAt, 0, updatedMoving);
  const reindexedTarget = targetListCards.map((c, idx) => ({ ...c, order: idx }));

  const otherListsCards = remaining.filter((c) => c.listId !== targetListId);
  // Also normalize source list orders if moved across lists
  const sourceListId = moving.listId;
  let finalOthers = otherListsCards;
  if (sourceListId !== targetListId) {
    const sourceCards = otherListsCards
      .filter((c) => c.listId === sourceListId)
      .sort((a, b) => a.order - b.order)
      .map((c, idx) => ({ ...c, order: idx }));
    finalOthers = [
      ...otherListsCards.filter((c) => c.listId !== sourceListId),
      ...sourceCards,
    ];
  }

  return [...finalOthers, ...reindexedTarget];
}

export function getCardDurationMinutes(card: CardItem, fallback = 60): number {
  if (!card.startDate || !card.endDate || card.allDay || !card.startDate.includes('T') || !card.endDate.includes('T')) {
    return fallback;
  }
  const s = parseFlexibleDate(card.startDate);
  const e = parseFlexibleDate(card.endDate);
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  return mins >= 30 ? mins : fallback;
}

export function scheduleCardAtSlot(
  card: CardItem,
  dateKey: string,
  hour: number,
  durationMinutes?: number,
  minute = 0
): CardItem {
  const mins = durationMinutes ?? getCardDurationMinutes(card, 60);
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(y, m - 1, d, hour, minute, 0, 0);
  const end = new Date(start.getTime() + mins * 60000);
  return {
    ...card,
    startDate: toLocalDateTimeInput(start),
    endDate: toLocalDateTimeInput(end),
    allDay: false,
    syncDirty: true,
  };
}

export function adjustCardDurationMinutes(card: CardItem, deltaMinutes: number): CardItem {
  if (!card.startDate || card.allDay || !card.startDate.includes('T')) return card;
  const start = parseFlexibleDate(card.startDate);
  const currentMins = getCardDurationMinutes(card, 60);
  const nextMins = Math.max(30, Math.min(12 * 60, currentMins + deltaMinutes));
  const nextEnd = new Date(start.getTime() + nextMins * 60000);
  return {
    ...card,
    endDate: toLocalDateTimeInput(nextEnd),
    syncDirty: true,
  };
}

export function scheduleCardForDaySpan(
  card: CardItem,
  startDateKey: string,
  spanDays = 1
): CardItem {
  const start = parseFlexibleDate(startDateKey);
  const end = addDays(start, Math.max(0, spanDays - 1));
  return {
    ...card,
    startDate: toLocalDateKey(start),
    endDate: toLocalDateKey(end),
    allDay: true,
    syncDirty: true,
  };
}

export function shiftCardDatesByDays(card: CardItem, deltaDays: number): CardItem {
  if (!card.startDate) return card;
  const s = parseFlexibleDate(card.startDate);
  const nextStart = addDays(s, deltaDays);

  let nextEnd: string | null = null;
  if (card.endDate) {
    const e = parseFlexibleDate(card.endDate);
    const shiftedEnd = addDays(e, deltaDays);
    nextEnd = card.allDay ? toLocalDateKey(shiftedEnd) : toLocalDateTimeInput(shiftedEnd);
  }

  return {
    ...card,
    startDate: card.allDay ? toLocalDateKey(nextStart) : toLocalDateTimeInput(nextStart),
    endDate: nextEnd,
    syncDirty: true,
  };
}

export function getCardsPendingGoogleSync(cards: CardItem[]): CardItem[] {
  return cards.filter((c) => Boolean(c.startDate) && (!c.googleEventId || Boolean(c.syncDirty)));
}

export function getCardDueStatus(card: CardItem, now = new Date()): 'overdue' | 'today' | 'upcoming' | 'none' {
  if (!card.dueDate) return 'none';
  const todayKey = toLocalDateKey(now);
  if (card.dueDate < todayKey) return 'overdue';
  if (card.dueDate === todayKey) return 'today';
  return 'upcoming';
}

export function isCardInListDone(card: CardItem, lists: BoardList[]): boolean {
  const list = lists.find((l) => l.id === card.listId);
  if (!list) return false;
  return /готово|done|заверш/i.test(list.title);
}

/**
 * Converts a scheduled CardItem into a Google Calendar v3 Event request body.
 */
export function buildGoogleEventPayload(card: CardItem, listTitle?: string) {
  const startStr = card.startDate || card.dueDate || toLocalDateKey(new Date());
  const isAllDay = card.allDay || /^\d{4}-\d{2}-\d{2}$/.test(startStr);

  const descriptionParts = [
    card.description?.trim(),
    listTitle ? `Колонка доски: ${listTitle}` : null,
    card.checklist.length > 0
      ? `Чек-лист: ${card.checklist.filter((i) => i.done).length}/${card.checklist.length}`
      : null,
  ].filter(Boolean);

  if (isAllDay) {
    const startKey = startStr.slice(0, 10);
    const endRaw = card.endDate ? card.endDate.slice(0, 10) : startKey;
    // Google Calendar all-day end.date is exclusive
    const endExclusive = toLocalDateKey(addDays(parseFlexibleDate(endRaw), 1));
    return {
      summary: card.title,
      description: descriptionParts.join('\n\n'),
      start: { date: startKey },
      end: { date: endExclusive },
    };
  }

  const startDateObj = parseFlexibleDate(startStr);
  const endDateObj = card.endDate
    ? parseFlexibleDate(card.endDate)
    : new Date(startDateObj.getTime() + 60 * 60000);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const formatOffsetISO = (d: Date) => {
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    const oh = pad2(Math.floor(abs / 60));
    const om = pad2(abs % 60);
    return `${toLocalDateTimeInput(d)}:00${sign}${oh}:${om}`;
  };

  return {
    summary: card.title,
    description: descriptionParts.join('\n\n'),
    start: {
      dateTime: formatOffsetISO(startDateObj),
      timeZone,
    },
    end: {
      dateTime: formatOffsetISO(endDateObj),
      timeZone,
    },
  };
}

export function addListToBoard(state: BoardState, title: string): BoardState {
  const clean = title.trim();
  if (!clean) return state;
  const maxOrder = state.lists.reduce((max, l) => Math.max(max, l.order), -1);
  const newList: BoardList = {
    id: `list-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: clean,
    order: maxOrder + 1,
  };
  return {
    ...state,
    lists: [...state.lists, newList],
  };
}

export function createNewBoardRecord(title: string, color: LabelColor = 'blue'): BoardRecord {
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id: `board-${uid}`,
    title: title.trim() || 'Новая доска',
    color,
    state: {
      labels: [
        { id: `lbl-${uid}-1`, name: 'Важно', color: 'rose' },
        { id: `lbl-${uid}-2`, name: 'Идея', color: 'blue' },
        { id: `lbl-${uid}-3`, name: 'Фокус', color: 'violet' },
        { id: `lbl-${uid}-4`, name: 'Личное', color: 'emerald' },
      ],
      lists: [
        { id: `list-${uid}-1`, title: 'Бэклог', order: 0 },
        { id: `list-${uid}-2`, title: 'В работе', order: 1 },
        { id: `list-${uid}-3`, title: 'Готово', order: 2 },
      ],
      cards: [],
    },
  };
}

export function addBoardToWorkspace(
  workspace: WorkspaceData,
  title: string,
  color: LabelColor = 'blue'
): WorkspaceData {
  const clean = title.trim();
  if (!clean) return workspace;
  const created = createNewBoardRecord(clean, color);
  return {
    activeBoardId: created.id,
    boards: [...workspace.boards, created],
  };
}

export function renameBoardInWorkspace(
  workspace: WorkspaceData,
  boardId: string,
  title: string
): WorkspaceData {
  const clean = title.trim();
  if (!clean) return workspace;
  return {
    ...workspace,
    boards: workspace.boards.map((b) => (b.id === boardId ? { ...b, title: clean } : b)),
  };
}

export function deleteBoardFromWorkspace(
  workspace: WorkspaceData,
  boardId: string
): WorkspaceData {
  if (workspace.boards.length <= 1) return workspace;
  const remaining = workspace.boards.filter((b) => b.id !== boardId);
  if (remaining.length === workspace.boards.length) return workspace;
  const nextActiveId =
    workspace.activeBoardId === boardId ? remaining[0].id : workspace.activeBoardId;
  return {
    activeBoardId: nextActiveId,
    boards: remaining,
  };
}
