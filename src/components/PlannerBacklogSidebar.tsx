import { CalendarPlus, GripVertical, X } from 'lucide-react';
import { useMemo, useState } from 'react';
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

  const scopedEntries = useMemo(() => {
    const targetBoards =
      selectedBoardFilter === 'all'
        ? boards
        : boards.filter((b) => b.id === selectedBoardFilter);

    const rows: Array<{
      card: CardItem;
      board: BoardRecord;
      listTitle: string;
    }> = [];

    for (const board of targetBoards) {
      const listById = new Map(board.state.lists.map((l) => [l.id, l.title]));
      const filtered = filterCards(board.state.cards, filters);
      for (const card of filtered) {
        rows.push({
          card,
          board,
          listTitle: listById.get(card.listId) ?? '',
        });
      }
    }
    return rows;
  }, [boards, selectedBoardFilter, filters]);

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

        {/* Board Scope Selector */}
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
              className="w-full px-2.5 py-1.5 min-h-[36px] text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
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
            Перетащите задачу с любой доски на сетку недели, месяца или таймлайна.
          </span>
          <span className="md:hidden">
            Нажмите «На сегодня» или откройте задачу, чтобы задать дату и время.
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
