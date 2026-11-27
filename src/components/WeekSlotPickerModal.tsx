import { CalendarPlus, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { BoardRecord, CardItem } from '../types/planner';
import { formatRussianShortDate, formatTimeHHMM, pad2, parseFlexibleDate } from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface WeekSlotPickerModalProps {
  isOpen: boolean;
  slot: { dateKey: string; hour: number } | null;
  boards: BoardRecord[];
  initialBoardId: string | 'all';
  activeBoardId: string;
  onClose: () => void;
  onPickExistingCard: (cardId: string, dateKey: string, hour: number) => void;
  onCreateNewCard: (payload: {
    boardId: string;
    listId: string;
    dateKey: string;
    hour: number;
  }) => void;
}

export function WeekSlotPickerModal({
  isOpen,
  slot,
  boards,
  initialBoardId,
  activeBoardId,
  onClose,
  onPickExistingCard,
  onCreateNewCard,
}: WeekSlotPickerModalProps) {
  const [boardFilter, setBoardFilter] = useState<string | 'all'>(initialBoardId);
  const [listFilter, setListFilter] = useState<string | 'all'>('all');
  const [scope, setScope] = useState<'unscheduled' | 'all'>('unscheduled');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setBoardFilter(initialBoardId);
    setListFilter('all');
    setScope('unscheduled');
    setQuery('');
  }, [isOpen, initialBoardId, slot?.dateKey, slot?.hour]);

  const selectedBoard = useMemo(
    () => (boardFilter === 'all' ? null : boards.find((b) => b.id === boardFilter) ?? null),
    [boards, boardFilter]
  );

  const columnOptions = useMemo(() => {
    if (selectedBoard) {
      const counts = new Map<string, number>();
      for (const c of selectedBoard.state.cards) {
        counts.set(c.listId, (counts.get(c.listId) ?? 0) + 1);
      }
      return [...selectedBoard.state.lists]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({
          value: l.id,
          label: l.title,
          count: counts.get(l.id) ?? 0,
        }));
    }

    const byTitle = new Map<string, { label: string; count: number }>();
    for (const b of boards) {
      const listById = new Map(b.state.lists.map((l) => [l.id, l.title]));
      for (const l of [...b.state.lists].sort((a, z) => a.order - z.order)) {
        const key = l.title.trim().toLowerCase();
        if (!byTitle.has(key)) {
          byTitle.set(key, { label: l.title, count: 0 });
        }
      }
      for (const c of b.state.cards) {
        const title = listById.get(c.listId);
        if (!title) continue;
        const key = title.trim().toLowerCase();
        const entry = byTitle.get(key);
        if (entry) entry.count += 1;
      }
    }
    return Array.from(byTitle.entries()).map(([key, info]) => ({
      value: key,
      label: info.label,
      count: info.count,
    }));
  }, [boards, selectedBoard]);

  useEffect(() => {
    if (listFilter !== 'all' && !columnOptions.some((opt) => opt.value === listFilter)) {
      setListFilter('all');
    }
  }, [columnOptions, listFilter]);

  const entries = useMemo(() => {
    const targetBoards = selectedBoard ? [selectedBoard] : boards;
    const rows: Array<{
      card: CardItem;
      board: BoardRecord;
      listTitle: string;
    }> = [];
    const q = query.trim().toLowerCase();

    for (const board of targetBoards) {
      const listById = new Map(board.state.lists.map((l) => [l.id, l.title]));
      for (const card of board.state.cards) {
        const listTitle = listById.get(card.listId) ?? '';
        if (listFilter !== 'all') {
          if (selectedBoard) {
            if (card.listId !== listFilter) continue;
          } else if (listTitle.trim().toLowerCase() !== listFilter) {
            continue;
          }
        }
        if (scope === 'unscheduled' && card.startDate) continue;
        if (q) {
          const hay = `${card.title} ${card.description} ${listTitle} ${board.title}`.toLowerCase();
          if (!hay.includes(q)) continue;
        }
        rows.push({ card, board, listTitle });
      }
    }
    return rows;
  }, [boards, selectedBoard, listFilter, scope, query]);

  if (!isOpen || !slot) return null;

  const targetCreateBoard =
    selectedBoard ?? boards.find((b) => b.id === activeBoardId) ?? boards[0];
  const targetCreateListId =
    selectedBoard && listFilter !== 'all'
      ? listFilter
      : listFilter !== 'all'
      ? targetCreateBoard?.state.lists.find((l) => l.title.trim().toLowerCase() === listFilter)?.id ??
        targetCreateBoard?.state.lists[0]?.id ??
        'list-planned'
      : targetCreateBoard?.state.lists[0]?.id ?? 'list-planned';

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="week-slot-picker-title"
      onClick={onClose}
    >
      <div
        data-testid="week-slot-picker-modal"
        className="w-full sm:max-w-lg max-h-[88vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div>
            <h2 id="week-slot-picker-title" className="text-sm sm:text-base font-bold">
              Запланировать на {formatRussianShortDate(parseFlexibleDate(slot.dateKey))} ·{' '}
              <span className="font-mono tabular-nums">{pad2(slot.hour)}:00</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Выберите задачу с любой доски и колонки или создайте новую
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-3.5 sm:px-5 border-b border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="slot-picker-board"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Доска
              </label>
              <select
                id="slot-picker-board"
                data-testid="slot-picker-board-select"
                value={boardFilter}
                onChange={(e) => setBoardFilter(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Все доски ({boards.length})</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="slot-picker-list"
                className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1"
              >
                Колонка
              </label>
              <select
                id="slot-picker-list"
                data-testid="slot-picker-list-select"
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                className="w-full px-2.5 py-2 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Все колонки</option>
                {columnOptions.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label} ({col.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search
                className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                data-testid="slot-picker-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск задачи..."
                aria-label="Поиск задачи"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setScope('unscheduled')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  scope === 'unscheduled'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Без времени
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 rounded-md font-medium cursor-pointer ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                Все
              </button>
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1.5 min-h-[180px]">
          {entries.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {scope === 'unscheduled'
                  ? 'В выбранной доске и колонке нет незапланированных задач.'
                  : 'Подходящих задач не найдено.'}
              </p>
              {scope === 'unscheduled' && (
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Показать также запланированные задачи
                </button>
              )}
            </div>
          ) : (
            entries.map(({ card, board, listTitle }) => {
              const firstLabel = board.state.labels.find((l) => card.labelIds.includes(l.id));
              const dotCls = firstLabel
                ? LABEL_COLOR_META[firstLabel.color].dot
                : LABEL_COLOR_META[board.color]?.dot ?? 'bg-blue-600';

              return (
                <button
                  key={card.id}
                  type="button"
                  data-testid={`slot-picker-card-${card.id}`}
                  onClick={() => onPickExistingCard(card.id, slot.dateKey, slot.hour)}
                  className="w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/30 transition-colors cursor-pointer group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                      {card.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className={`w-1.5 h-1.5 rounded-xs shrink-0 ${dotCls}`} aria-hidden="true" />
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                        {board.title}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate max-w-[140px]">{listTitle}</span>
                      {card.startDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                            {formatRussianShortDate(parseFlexibleDate(card.startDate))}
                            {!card.allDay && card.startDate.includes('T')
                              ? ` ${formatTimeHHMM(card.startDate)}`
                              : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 rounded-lg shrink-0">
                    <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>На {pad2(slot.hour)}:00</span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer with New Task button */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            Отмена
          </button>
          <button
            type="button"
            data-testid="slot-picker-new-task-button"
            onClick={() => {
              if (!targetCreateBoard) return;
              onCreateNewCard({
                boardId: targetCreateBoard.id,
                listId: targetCreateListId,
                dateKey: slot.dateKey,
                hour: slot.hour,
              });
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-lg cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Создать новую задачу</span>
          </button>
        </div>
      </div>
    </div>
  );
}
