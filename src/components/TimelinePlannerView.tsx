import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import type {
  BoardList,
  BoardRecord,
  CardBoardMeta,
  CardItem,
  GoogleCalendarEvent,
  LabelDef,
  TimelineGroupBy,
} from '../types/planner';
import {
  computeTimelineSpan,
  formatRussianShortDate,
  formatRussianWeekdayShort,
  getTimelineDays,
  isSameDay,
  toLocalDateKey,
} from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface TimelinePlannerViewProps {
  anchorDate: Date;
  daysCount: 7 | 14;
  groupBy: TimelineGroupBy;
  cards: CardItem[];
  lists: BoardList[];
  labels: LabelDef[];
  boards?: BoardRecord[];
  boardMetaByCardId?: Map<string, CardBoardMeta>;
  showBoardBadge?: boolean;
  googleEvents: GoogleCalendarEvent[];
  draggedCardId: string | null;
  onDragStartCard: (cardId: string) => void;
  onDragEndCard: () => void;
  onSelectCard: (card: CardItem) => void;
  onSelectGoogleEvent: (event: GoogleCalendarEvent) => void;
  onScheduleCardOnTimeline: (cardId: string, dateKey: string, laneId: string, groupBy: TimelineGroupBy) => void;
  onShiftCardDays: (cardId: string, deltaDays: number) => void;
  onCreateCardInLane: (dateKey: string, laneId: string, groupBy: TimelineGroupBy) => void;
}

export function TimelinePlannerView({
  anchorDate,
  daysCount,
  groupBy,
  cards,
  lists,
  labels,
  boards = [],
  boardMetaByCardId,
  showBoardBadge = false,
  googleEvents,
  draggedCardId,
  onDragStartCard,
  onDragEndCard,
  onSelectCard,
  onSelectGoogleEvent,
  onScheduleCardOnTimeline,
  onShiftCardDays,
  onCreateCardInLane,
}: TimelinePlannerViewProps) {
  const [hoverCell, setHoverCell] = useState<string | null>(null);
  const days = getTimelineDays(anchorDate, daysCount);
  const today = new Date();

  const lanes: Array<{ id: string; title: string; subtitle: string; dotClass?: string }> =
    groupBy === 'board'
      ? boards.map((b) => ({
          id: b.id,
          title: b.title,
          subtitle: `${cards.filter((c) => boardMetaByCardId?.get(c.id)?.boardId === b.id).length} задач`,
          dotClass: LABEL_COLOR_META[b.color]?.dot ?? 'bg-blue-600',
        }))
      : groupBy === 'label'
        ? [
            ...labels.map((lbl) => ({
              id: lbl.id,
              title: lbl.name,
              subtitle: `${cards.filter((c) => c.labelIds.includes(lbl.id)).length} задач`,
              dotClass: LABEL_COLOR_META[lbl.color].dot,
            })),
            {
              id: 'unlabeled',
              title: 'Без метки',
              subtitle: `${cards.filter((c) => c.labelIds.length === 0).length} задач`,
            },
          ]
        : [...lists]
            .sort((a, b) => a.order - b.order)
            .map((l) => ({
              id: l.id,
              title: l.title,
              subtitle: `${cards.filter((c) => c.listId === l.id).length} задач`,
            }));

  const getLaneCards = (laneId: string): CardItem[] => {
    return cards.filter((c) => {
      if (!c.startDate) return false;
      if (groupBy === 'board') {
        return boardMetaByCardId?.get(c.id)?.boardId === laneId;
      }
      if (groupBy === 'label') {
        if (laneId === 'unlabeled') return c.labelIds.length === 0;
        return c.labelIds.includes(laneId);
      }
      return c.listId === laneId;
    });
  };

  const colMinWidth = daysCount === 7 ? '96px' : '90px';
  const dayColTemplate = `var(--lane-w, 210px) repeat(${days.length}, minmax(${colMinWidth}, 1fr))`;

  return (
    <div
      data-testid="timeline-planner-view"
      className="flex-1 overflow-auto bg-white [--lane-w:128px] md:[--lane-w:210px]"
    >
      <div className={daysCount === 7 ? 'min-w-[820px]' : 'min-w-[1440px]'}>
        {/* Timeline Header */}
        <div
          className="grid sticky top-0 z-20 bg-slate-50 border-b border-slate-200"
          style={{ gridTemplateColumns: dayColTemplate }}
        >
          <div className="px-3 md:px-4 py-2.5 border-r border-slate-200 text-xs font-semibold text-slate-700 sticky left-0 bg-slate-50 z-30 truncate">
            {groupBy === 'board' ? 'Доски' : groupBy === 'label' ? 'Метки' : 'Колонки'}
          </div>
          {days.map((day) => {
            const key = toLocalDateKey(day);
            const isToday = isSameDay(day, today);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={key}
                className={`px-2 py-2 border-r border-slate-200 last:border-r-0 text-center ${
                  isToday
                    ? 'bg-blue-50 text-blue-700'
                    : isWeekend
                      ? 'bg-slate-100/70 text-slate-500'
                      : 'text-slate-700'
                }`}
              >
                <div className="text-[11px] font-medium">{formatRussianWeekdayShort(day)}</div>
                <div className="font-mono text-xs tabular-nums font-semibold">
                  {formatRussianShortDate(day)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Swimlane Rows */}
        {lanes.map((lane) => {
          const laneCards = getLaneCards(lane.id).filter((c) =>
            Boolean(computeTimelineSpan(c.startDate!, c.endDate, days, false))
          );

          return (
            <div
              key={lane.id}
              data-testid={`timeline-lane-${lane.id}`}
              className="border-b border-slate-200"
            >
              <div
                className="grid relative"
                style={{ gridTemplateColumns: dayColTemplate }}
              >
                {/* Sticky Left Lane Label */}
                <div className="px-2.5 md:px-4 py-3 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-start gap-2">
                  {lane.dotClass && (
                    <span
                      className={`w-2.5 h-2.5 rounded-xs shrink-0 mt-1 ${lane.dotClass}`}
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {lane.title}
                    </div>
                    <div className="hidden md:block text-[11px] text-slate-500 truncate">
                      {lane.subtitle}
                    </div>
                  </div>
                </div>

                {/* Day Grid Cells + Stacked Bars */}
                <div
                  className="relative grid"
                  style={{
                    gridColumn: `2 / span ${days.length}`,
                    gridTemplateColumns: `repeat(${days.length}, minmax(${colMinWidth}, 1fr))`,
                    minHeight: `${Math.max(84, laneCards.length * 36 + 24)}px`,
                  }}
                >
                  {/* Background Day Drop Targets */}
                  {days.map((day) => {
                    const key = toLocalDateKey(day);
                    const cellKey = `${lane.id}-${key}`;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const isToday = isSameDay(day, today);
                    const isHover = hoverCell === cellKey;

                    return (
                      <div
                        key={cellKey}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (hoverCell !== cellKey) setHoverCell(cellKey);
                        }}
                        onDragLeave={() => {
                          if (hoverCell === cellKey) setHoverCell(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setHoverCell(null);
                          const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
                          if (cardId) {
                            onScheduleCardOnTimeline(cardId, key, lane.id, groupBy);
                          }
                          onDragEndCard();
                        }}
                        className={`group border-r border-slate-100 last:border-r-0 relative transition-colors ${
                          isHover
                            ? 'bg-blue-100/70'
                            : isToday
                              ? 'bg-blue-50/25'
                              : isWeekend
                                ? 'bg-slate-50/70'
                                : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onCreateCardInLane(key, lane.id, groupBy)}
                          aria-label={`Добавить задачу для ${lane.title} на ${key}`}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 absolute right-1 bottom-1 p-1 rounded bg-white border border-slate-200 text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Overlay Horizontal Task Span Bars */}
                  <div className="absolute inset-0 py-2 pointer-events-none space-y-1.5">
                    {laneCards.map((card) => {
                      const span = computeTimelineSpan(card.startDate!, card.endDate, days, false);
                      if (!span) return null;
                      const firstLbl = labels.find((l) => card.labelIds.includes(l.id));
                      const meta = firstLbl ? LABEL_COLOR_META[firstLbl.color] : LABEL_COLOR_META.blue;
                      const boardMeta = boardMetaByCardId?.get(card.id);

                      const leftPct = (span.startIndex / days.length) * 100;
                      const widthPct = (span.spanDays / days.length) * 100;

                      const isDraggingAnother = Boolean(draggedCardId && draggedCardId !== card.id);

                      return (
                        <div
                          key={card.id}
                          className={`relative h-7 ${isDraggingAnother ? 'pointer-events-none opacity-65' : 'pointer-events-auto'}`}
                        >
                          <div
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', card.id);
                              e.dataTransfer.effectAllowed = 'move';
                              onDragStartCard(card.id);
                            }}
                            onDragEnd={() => onDragEndCard()}
                            style={{
                              left: `calc(${leftPct}% + 3px)`,
                              width: `calc(${widthPct}% - 6px)`,
                            }}
                            className={`group/bar absolute top-0 bottom-0 rounded-md border px-2 flex items-center justify-between gap-1 shadow-2xs ${meta.blockBg} ${meta.blockBorder}`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectCard(card)}
                              title={boardMeta ? `${boardMeta.boardTitle} · ${card.title}` : card.title}
                              className={`text-xs font-medium text-left flex-1 min-w-0 cursor-pointer flex items-center gap-1.5 ${meta.text}`}
                            >
                              {showBoardBadge && groupBy !== 'board' && boardMeta && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-xs shrink-0 ${
                                    LABEL_COLOR_META[boardMeta.boardColor]?.dot ?? 'bg-blue-600'
                                  }`}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="truncate">{card.title}</span>
                            </button>

                            <div className="hidden group-hover/bar:flex group-focus-within/bar:flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => onShiftCardDays(card.id, -1)}
                                aria-label={`Сдвинуть '${card.title}' на день назад`}
                                className="p-0.5 rounded bg-white/90 text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                <ChevronLeft className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onShiftCardDays(card.id, 1)}
                                aria-label={`Сдвинуть '${card.title}' на день вперёд`}
                                className="p-0.5 rounded bg-white/90 text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Google Calendar Events Swimlane */}
        {googleEvents.length > 0 && (
          <div className="border-b border-slate-200 bg-slate-50/40">
            <div className="grid relative" style={{ gridTemplateColumns: dayColTemplate }}>
              <div className="px-2.5 md:px-4 py-3 border-r border-slate-200 bg-white sticky left-0 z-10 flex items-start gap-2">
                <Calendar className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">Google Календарь</div>
                  <div className="hidden md:block text-[11px] text-slate-500">Внешние события</div>
                </div>
              </div>

              <div
                className="relative grid"
                style={{
                  gridColumn: `2 / span ${days.length}`,
                  gridTemplateColumns: `repeat(${days.length}, minmax(${colMinWidth}, 1fr))`,
                  minHeight: `${Math.max(72, googleEvents.length * 32 + 16)}px`,
                }}
              >
                {days.map((day) => (
                  <div
                    key={toLocalDateKey(day)}
                    className="border-r border-slate-100 last:border-r-0"
                  />
                ))}

                <div className="absolute inset-0 py-2 space-y-1.5 pointer-events-none">
                  {googleEvents.map((ev) => {
                    const span = computeTimelineSpan(ev.start, ev.end, days, ev.allDay);
                    if (!span) return null;
                    const leftPct = (span.startIndex / days.length) * 100;
                    const widthPct = (span.spanDays / days.length) * 100;

                    return (
                      <div key={`${ev.calendarId}-${ev.id}`} className="relative h-6 pointer-events-auto">
                        <button
                          type="button"
                          onClick={() => onSelectGoogleEvent(ev)}
                          style={{
                            left: `calc(${leftPct}% + 3px)`,
                            width: `calc(${widthPct}% - 6px)`,
                          }}
                          className="absolute top-0 bottom-0 rounded-md border border-slate-200 bg-white px-2 flex items-center gap-1.5 text-xs text-slate-800 hover:border-blue-400 shadow-2xs truncate cursor-pointer"
                        >
                          <span
                            className="w-2 h-2 rounded-xs shrink-0"
                            style={{ backgroundColor: ev.calendarColor || '#2563eb' }}
                          />
                          <span className="truncate font-medium">{ev.summary}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
