import { Calendar, Plus } from 'lucide-react';
import { useState } from 'react';
import type { CardBoardMeta, CardItem, GoogleCalendarEvent, LabelDef } from '../types/planner';
import {
  extractDateKey,
  formatRussianShortDate,
  formatTimeHHMM,
  getMonthGridDays,
  isSameDay,
  parseFlexibleDate,
  toLocalDateKey,
} from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface MonthPlannerViewProps {
  anchorDate: Date;
  cards: CardItem[];
  labels: LabelDef[];
  boardMetaByCardId?: Map<string, CardBoardMeta>;
  showBoardBadge?: boolean;
  googleEvents: GoogleCalendarEvent[];
  draggedCardId: string | null;
  onDragStartCard: (cardId: string) => void;
  onDragEndCard: () => void;
  onSelectCard: (card: CardItem) => void;
  onSelectGoogleEvent: (event: GoogleCalendarEvent) => void;
  onScheduleCardOnDay: (cardId: string, dateKey: string) => void;
  onCreateCardOnDay: (dateKey: string) => void;
}

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function MonthPlannerView({
  anchorDate,
  cards,
  labels,
  boardMetaByCardId,
  showBoardBadge = false,
  googleEvents,
  draggedCardId,
  onDragStartCard,
  onDragEndCard,
  onSelectCard,
  onSelectGoogleEvent,
  onScheduleCardOnDay,
  onCreateCardOnDay,
}: MonthPlannerViewProps) {
  const [dragDayKey, setDragDayKey] = useState<string | null>(null);
  const days = getMonthGridDays(anchorDate);
  const today = new Date();
  const currentMonth = anchorDate.getMonth();
  const weeksCount = Math.ceil(days.length / 7);
  const [selectedMobileDayKey, setSelectedMobileDayKey] = useState<string>(() => toLocalDateKey(today));

  const getDayItems = (key: string) => {
    const dayCards = cards.filter((c) => {
      if (!c.startDate) return c.dueDate === key;
      const sKey = extractDateKey(c.startDate);
      const eKey = c.endDate ? extractDateKey(c.endDate) : sKey;
      return sKey <= key && eKey >= key;
    });
    const dayEvents = googleEvents.filter((ev) => extractDateKey(ev.start) === key);
    return { dayCards, dayEvents };
  };

  const selectedAgenda = getDayItems(selectedMobileDayKey);

  return (
    <div
      data-testid="month-planner-view"
      className="flex-1 flex flex-col overflow-hidden bg-white"
    >
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 shrink-0">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="px-2 md:px-3 py-2 text-center md:text-left text-xs font-medium text-slate-500 border-r border-slate-200 last:border-r-0"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Desktop Rich Month Grid */}
      <div
        className="hidden md:grid flex-1 grid-cols-7 overflow-y-auto"
        style={{ gridTemplateRows: `repeat(${weeksCount}, minmax(120px, 1fr))` }}
      >
        {days.map((day) => {
          const key = toLocalDateKey(day);
          const isCurrentMonth = day.getMonth() === currentMonth;
          const isToday = isSameDay(day, today);
          const isDropHover = dragDayKey === key;
          const { dayCards, dayEvents } = getDayItems(key);

          return (
            <div
              key={key}
              data-testid={`month-day-${key}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragDayKey !== key) setDragDayKey(key);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragDayKey(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragDayKey(null);
                const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
                if (cardId) onScheduleCardOnDay(cardId, key);
              }}
              className={`group border-r border-b border-slate-200 p-2 flex flex-col gap-1 transition-colors ${
                isDropHover
                  ? 'bg-blue-50 ring-1 ring-inset ring-blue-400'
                  : isCurrentMonth
                    ? 'bg-white'
                    : 'bg-slate-50/70'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={`font-mono text-xs tabular-nums font-medium px-1.5 py-0.5 rounded ${
                    isToday
                      ? 'bg-blue-600 text-white font-semibold'
                      : isCurrentMonth
                        ? 'text-slate-900'
                        : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </span>

                <button
                  type="button"
                  onClick={() => onCreateCardOnDay(key)}
                  aria-label={`Добавить задачу на ${key}`}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded transition-opacity cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-1 overflow-y-auto max-h-24">
                {dayCards.map((card) => {
                  const firstLbl = labels.find((l) => card.labelIds.includes(l.id));
                  const meta = firstLbl ? LABEL_COLOR_META[firstLbl.color] : LABEL_COLOR_META.blue;
                  const boardMeta = boardMetaByCardId?.get(card.id);
                  const hasTime = card.startDate && !card.allDay && card.startDate.includes('T');

                  return (
                    <button
                      key={card.id}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', card.id);
                        e.dataTransfer.effectAllowed = 'move';
                        onDragStartCard(card.id);
                      }}
                      onDragEnd={() => {
                        setDragDayKey(null);
                        onDragEndCard();
                      }}
                      onClick={() => onSelectCard(card)}
                      title={boardMeta ? `${boardMeta.boardTitle} · ${card.title}` : card.title}
                      className={`w-full text-left px-1.5 py-0.5 text-[11px] rounded border cursor-pointer flex items-center gap-1 min-w-0 ${meta.blockBg} ${meta.blockBorder} ${meta.text}`}
                    >
                      {showBoardBadge && boardMeta && (
                        <span
                          className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                            LABEL_COLOR_META[boardMeta.boardColor]?.dot ?? 'bg-blue-600'
                          }`}
                          aria-hidden="true"
                        />
                      )}
                      {hasTime && (
                        <span className="font-mono tabular-nums shrink-0 opacity-80">
                          {formatTimeHHMM(card.startDate!)}
                        </span>
                      )}
                      <span className="font-medium truncate">{card.title}</span>
                    </button>
                  );
                })}

                {dayEvents.map((ev) => (
                  <button
                    key={`${ev.calendarId}-${ev.id}`}
                    type="button"
                    onClick={() => onSelectGoogleEvent(ev)}
                    className="w-full text-left px-1.5 py-0.5 text-[11px] rounded border border-slate-200 bg-slate-50 text-slate-700 truncate cursor-pointer flex items-center gap-1"
                  >
                    <Calendar
                      className="w-2.5 h-2.5 shrink-0"
                      style={{ color: ev.calendarColor || '#2563eb' }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{ev.summary}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Compact Month Grid + Selected Day Agenda */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 shrink-0">
          {days.map((day) => {
            const key = toLocalDateKey(day);
            const isCurrentMonth = day.getMonth() === currentMonth;
            const isToday = isSameDay(day, today);
            const isSelected = selectedMobileDayKey === key;
            const { dayCards, dayEvents } = getDayItems(key);
            const totalItems = dayCards.length + dayEvents.length;

            return (
              <button
                key={`m-${key}`}
                type="button"
                onClick={() => setSelectedMobileDayKey(key)}
                className={`h-12 border-r border-b border-slate-100 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50'
                    : isCurrentMonth
                      ? 'bg-white'
                      : 'bg-slate-50/70'
                }`}
              >
                <span
                  className={`font-mono text-xs tabular-nums w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-blue-600 text-white font-semibold'
                      : isSelected
                        ? 'bg-slate-900 text-white font-semibold'
                        : isCurrentMonth
                          ? 'text-slate-900'
                          : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </span>

                <div className="h-1.5 flex items-center gap-0.5">
                  {totalItems > 0 && (
                    <>
                      {dayCards.slice(0, 2).map((c) => {
                        const lbl = labels.find((l) => c.labelIds.includes(l.id));
                        const dot = lbl ? LABEL_COLOR_META[lbl.color].dot : 'bg-blue-600';
                        return <span key={c.id} className={`w-1.5 h-1.5 rounded-full ${dot}`} />;
                      })}
                      {dayEvents.length > 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                      )}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xs font-semibold text-slate-900">
              {formatRussianShortDate(parseFlexibleDate(selectedMobileDayKey))}
            </h3>
            <button
              type="button"
              onClick={() => onCreateCardOnDay(selectedMobileDayKey)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Добавить задачу</span>
            </button>
          </div>

          {selectedAgenda.dayCards.length === 0 && selectedAgenda.dayEvents.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400 bg-white border border-slate-200 rounded-lg">
              На этот день пока нет задач и событий
            </div>
          ) : (
            <div className="space-y-2">
              {selectedAgenda.dayCards.map((card) => {
                const firstLbl = labels.find((l) => card.labelIds.includes(l.id));
                const meta = firstLbl ? LABEL_COLOR_META[firstLbl.color] : LABEL_COLOR_META.blue;
                const boardMeta = boardMetaByCardId?.get(card.id);
                const hasTime = card.startDate && !card.allDay && card.startDate.includes('T');

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectCard(card)}
                    className={`w-full text-left p-3 rounded-lg border bg-white flex items-center justify-between gap-2 cursor-pointer ${meta.blockBorder}`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {card.title}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5 flex items-center gap-1.5">
                        <span>
                          {hasTime
                            ? `${formatTimeHHMM(card.startDate!)}${card.endDate ? `–${formatTimeHHMM(card.endDate)}` : ''}`
                            : 'Весь день'}
                        </span>
                        {showBoardBadge && boardMeta && (
                          <span className="inline-flex items-center gap-1 font-sans text-slate-500">
                            <span
                              className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                                LABEL_COLOR_META[boardMeta.boardColor]?.dot ?? 'bg-blue-600'
                              }`}
                              aria-hidden="true"
                            />
                            <span>{boardMeta.boardTitle}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {card.googleEventId && !card.syncDirty && (
                      <span className="text-[11px] text-emerald-700 font-medium shrink-0">
                        Google
                      </span>
                    )}
                  </button>
                );
              })}

              {selectedAgenda.dayEvents.map((ev) => (
                <button
                  key={`${ev.calendarId}-${ev.id}`}
                  type="button"
                  onClick={() => onSelectGoogleEvent(ev)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 bg-white flex items-center gap-2.5 cursor-pointer"
                >
                  <Calendar
                    className="w-4 h-4 shrink-0"
                    style={{ color: ev.calendarColor || '#2563eb' }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">{ev.summary}</div>
                    <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                      {ev.allDay ? 'Весь день' : `${formatTimeHHMM(ev.start)}–${formatTimeHHMM(ev.end)}`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
