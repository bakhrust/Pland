import { CalendarPlus, GripVertical, X } from 'lucide-react';
import { useState } from 'react';
import type { BoardList, CardItem, LabelDef } from '../types/planner';
import { formatRussianShortDate, formatTimeHHMM, parseFlexibleDate } from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface PlannerBacklogSidebarProps {
  cards: CardItem[];
  lists: BoardList[];
  labels: LabelDef[];
  onSelectCard: (card: CardItem) => void;
  onQuickScheduleToday: (card: CardItem) => void;
  onDragStartCard: (cardId: string) => void;
  onDragEndCard: () => void;
  onCloseMobile: () => void;
}

export function PlannerBacklogSidebar({
  cards,
  lists,
  labels,
  onSelectCard,
  onQuickScheduleToday,
  onDragStartCard,
  onDragEndCard,
  onCloseMobile,
}: PlannerBacklogSidebarProps) {
  const [tab, setTab] = useState<'unscheduled' | 'all'>('unscheduled');

  const unscheduled = cards.filter((c) => !c.startDate);
  const visibleCards = tab === 'unscheduled' ? unscheduled : cards;

  return (
    <aside
      aria-label="Задачи доски для планирования"
      className="fixed inset-x-0 top-12 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 md:static md:inset-auto md:w-72 md:shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden"
    >
      <div className="p-3 border-b border-slate-200 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xs font-semibold text-slate-900">
              Задачи доски
            </h2>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              {unscheduled.length} без времени
            </span>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Закрыть список задач"
            className="md:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('unscheduled')}
            className={`px-2 py-1.5 md:py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'unscheduled'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Без времени ({unscheduled.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-2 py-1.5 md:py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              tab === 'all'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Все ({cards.length})
          </button>
        </div>

        <p className="text-[11px] text-slate-500 leading-snug">
          <span className="hidden md:inline">
            Перетащите любую карточку прямо на сетку недели, месяца или таймлайна.
          </span>
          <span className="md:hidden">
            Нажмите «На сегодня» или откройте карточку, чтобы задать время.
          </span>
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {visibleCards.length === 0 ? (
          <div className="py-8 px-3 text-center text-xs text-slate-400">
            Все задачи уже распределены по календарю.
          </div>
        ) : (
          visibleCards.map((card) => {
            const list = lists.find((l) => l.id === card.listId);
            const firstLabel = labels.find((l) => card.labelIds.includes(l.id));

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
                className="group bg-white border border-slate-200 rounded-lg p-2.5 hover:border-blue-400 transition-colors cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start gap-2">
                  <GripVertical
                    className="hidden md:block w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 mt-0.5 shrink-0"
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onSelectCard(card)}
                      className="text-left text-xs font-medium text-slate-900 hover:text-blue-600 leading-snug w-full cursor-pointer"
                    >
                      {card.title}
                    </button>

                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        {firstLabel && (
                          <span
                            className={`w-1.5 h-1.5 rounded-xs shrink-0 ${LABEL_COLOR_META[firstLabel.color].dot}`}
                            aria-hidden="true"
                          />
                        )}
                        <span className="truncate">{list?.title}</span>
                        {card.startDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-blue-600 tabular-nums shrink-0">
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
                        onClick={() => onQuickScheduleToday(card)}
                        aria-label={`Запланировать '${card.title}' на сегодня`}
                        title="Запланировать на сегодня"
                        className="inline-flex items-center gap-1 px-2 py-1 md:p-1 text-[11px] text-blue-700 md:text-slate-400 md:hover:text-blue-600 bg-blue-50 md:bg-transparent rounded shrink-0 cursor-pointer"
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
