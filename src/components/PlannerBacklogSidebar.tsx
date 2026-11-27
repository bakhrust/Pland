import { CalendarPlus, GripVertical, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { BoardRecord, CardItem, FilterState } from '../types/planner';
import { filterCards } from '../utils/boardLogic';
import { formatRussianShortDate, formatTimeHHMM, parseFlexibleDate } from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface PlannerBacklogSidebarProps {
  boards: BoardRecord[];
  selectedBoardFilter: string | 'all';
  onChangeBoardFilter: (boardId: string | 'all') => void;
  filters: FilterState;
  onSelectCard: (card: CardItem) => void;
  onQuickScheduleToday: (card: CardItem) => void;
  onDragStartCard: (cardId: string) => void;
  onDragEndCard: () => void;
  onCloseMobile: () => void;
}

export function PlannerBacklogSidebar({
  boards,
  selectedBoardFilter,
  onChangeBoardFilter,
  filters,
  onSelectCard,
  onQuickScheduleToday,
  onDragStartCard,
  onDragEndCard,
  onCloseMobile,
}: PlannerBacklogSidebarProps) {
  const [tab, setTab] = useState<'unscheduled' | 'all'>('unscheduled');
  const [selectedListFilter, setSelectedListFilter] = useState<string | 'all'>('all');

  const selectedBoard = useMemo(
    () =>
      selectedBoardFilter === 'all'
        ? null
        : boards.find((b) => b.id === selectedBoardFilter) ?? null,
    [boards, selectedBoardFilter]
  );

  const columnOptions = useMemo(() => {
    if (selectedBoard) {
      const counts = new Map<string, number>();
      for (const card of filterCards(selectedBoard.state.cards, filters)) {
        counts.set(card.listId, (counts.get(card.listId) ?? 0) + 1);
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
    for (const board of boards) {
      const listById = new Map(board.state.lists.map((l) => [l.id, l.title]));
      for (const l of [...board.state.lists].sort((a, z) => a.order - z.order)) {
        const key = l.title.trim().toLowerCase();
        if (!byTitle.has(key)) {
          byTitle.set(key, { label: l.title, count: 0 });
        }
      }
      for (const card of filterCards(board.state.cards, filters)) {
        const title = listById.get(card.listId);
        if (!title) continue;
        const key = title.trim().toLowerCase();
        const entry = byTitle.get(key);
        if (entry) entry.count += 1;
      }
    }
    return Array.from(byTitle.entries()).map(([value, info]) => ({
      value,
      label: info.label,
      count: info.count,
    }));
  }, [boards, selectedBoard, filters]);

  useEffect(() => {
    if (
      selectedListFilter !== 'all' &&
      !columnOptions.some((opt) => opt.value === selectedListFilter)
    ) {
      setSelectedListFilter('all');
    }
  }, [columnOptions, selectedListFilter]);

  const scopedEntries = useMemo(() => {
    const targetBoards = selectedBoard ? [selectedBoard] : boards;

    const rows: Array<{
      card: CardItem;
      board: BoardRecord;
      listTitle: string;
    }> = [];

    for (const board of targetBoards) {
      const listById = new Map(board.state.lists.map((l) => [l.id, l.title]));
      const filtered = filterCards(board.state.cards, filters);
      for (const card of filtered) {
        const listTitle = listById.get(card.listId) ?? '';
        if (selectedListFilter !== 'all') {
          if (selectedBoard) {
            if (card.listId !== selectedListFilter) continue;
          } else if (listTitle.trim().toLowerCase() !== selectedListFilter) {
            continue;
          }
        }
        rows.push({
          card,
          board,
          listTitle,
        });
      }
    }
    return rows;
  }, [boards, selectedBoard, selectedListFilter, filters]);

  const unscheduled = scopedEntries.filter((entry) => !entry.card.startDate);
  const visibleEntries = tab === 'unscheduled' ? unscheduled : scopedEntries;

  return (
    <aside
      aria-label="Задачи всех досок для планирования"
      data-testid="planner-backlog-sidebar"
      className="fixed inset-x-0 top-12 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 md:static md:inset-auto md:w-72 md:shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
    >
      <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-display text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {selectedBoardFilter === 'all' ? 'Задачи всех досок' : 'Задачи доски'}
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
              {unscheduled.length} без времени
            </span>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Закрыть список задач"
            className="md:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Board & Column Scope Selectors */}
        <div className="space-y-1.5">
          {boards.length > 1 && (
            <div>
              <label htmlFor="backlog-board-filter" className="sr-only">
                Доска для отображения задач
              </label>
              <select
                id="backlog-board-filter"
                data-testid="backlog-board-filter"
                value={selectedBoardFilter}
                onChange={(e) => onChangeBoardFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 min-h-[34px] text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Все доски ({boards.length})</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {columnOptions.length > 0 && (
            <div>
              <label htmlFor="backlog-list-filter" className="sr-only">
                Колонка доски
              </label>
              <select
                id="backlog-list-filter"
                data-testid="backlog-list-filter"
                value={selectedListFilter}
                onChange={(e) => setSelectedListFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 min-h-[34px] text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                <option value="all">Все колонки</option>
                {columnOptions.map((col) => (
                  <option key={col.value} value={col.value}>
                    {col.label} ({col.count})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('unscheduled')}
            className={`px-2 py-1.5 md:py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'unscheduled'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Без времени ({unscheduled.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-2 py-1.5 md:py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'all'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Все ({scopedEntries.length})
          </button>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          <span className="hidden md:inline">
            Перетащите задачу из нужной доски и колонки на сетку недели, месяца или таймлайна.
          </span>
          <span className="md:hidden">
            Нажмите «На сегодня» или выберите любой слот на сетке недели.
          </span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {visibleEntries.length === 0 ? (
          <div className="py-8 px-3 text-center text-xs text-slate-400 dark:text-slate-500">
            Нет подходящих задач для отображения.
          </div>
        ) : (
          visibleEntries.map(({ card, board, listTitle }) => {
            const firstLabel = board.state.labels.find((l) => card.labelIds.includes(l.id));
            const boardDot = LABEL_COLOR_META[board.color]?.dot ?? 'bg-blue-600';

            return (
              <div
                key={card.id}
                draggable
                data-testid={`backlog-card-${card.id}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', card.id);
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStartCard(card.id);
                }}
                onDragEnd={() => onDragEndCard()}
                className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start gap-2">
                  <GripVertical
                    className="hidden md:block w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectCard(card)}
                      className="text-left text-xs font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 leading-snug w-full cursor-pointer"
                    >
                      {card.title}
                    </button>

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                            firstLabel ? LABEL_COLOR_META[firstLabel.color].dot : boardDot
                          }`}
                          aria-hidden="true"
                        />
                        {boards.length > 1 && (
                          <>
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[90px]">
                              {board.title}
                            </span>
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span className="truncate">{listTitle}</span>
                        {card.startDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-blue-600 dark:text-blue-400 tabular-nums shrink-0">
                              {formatRussianShortDate(parseFlexibleDate(card.startDate))}
                              {!card.allDay && card.startDate.includes('T')
                                ? ` ${formatTimeHHMM(card.startDate)}`
                                : ''}
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        data-testid={`backlog-schedule-today-${card.id}`}
                        onClick={() => onQuickScheduleToday(card)}
                        aria-label={`Запланировать '${card.title}' на сегодня`}
                        title="Запланировать на сегодня"
                        className="inline-flex items-center gap-1 px-2 py-1 md:p-1 text-[11px] text-blue-700 dark:text-blue-400 md:text-slate-400 md:hover:text-blue-600 bg-blue-50 dark:bg-blue-950/50 md:bg-transparent rounded shrink-0 cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="md:hidden">На сегодня</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
