import { Calendar, Minus, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CardItem, GoogleCalendarEvent, LabelDef } from '../types/planner';
import {
  extractDateKey,
  formatRussianShortDate,
  formatRussianWeekdayShort,
  formatTimeHHMM,
  getWeekDays,
  HOUR_END,
  HOUR_START,
  isSameDay,
  layoutDayTimeBlocks,
  pad2,
  toLocalDateKey,
  TOTAL_HOURS,
} from '../utils/dateUtils';
import { getCardDurationMinutes } from '../utils/boardLogic';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface WeekPlannerViewProps {
  anchorDate: Date;
  cards: CardItem[];
  labels: LabelDef[];
  googleEvents: GoogleCalendarEvent[];
  draggedCardId: string | null;
  onDragStartCard: (cardId: string) => void;
  onDragEndCard: () => void;
  onSelectCard: (card: CardItem) => void;
  onSelectGoogleEvent: (event: GoogleCalendarEvent) => void;
  onScheduleCardAtSlot: (cardId: string, dateKey: string, hour: number) => void;
  onScheduleCardAllDay: (cardId: string, dateKey: string) => void;
  onAdjustCardDuration: (cardId: string, deltaMinutes: number) => void;
  onCreateCardAtSlot: (dateKey: string, hour: number) => void;
}

type WeekBlockPayload =
  | { kind: 'card'; card: CardItem }
  | { kind: 'google'; event: GoogleCalendarEvent };

export function WeekPlannerView({
  anchorDate,
  cards,
  labels,
  googleEvents,
  draggedCardId,
  onDragStartCard,
  onDragEndCard,
  onSelectCard,
  onSelectGoogleEvent,
  onScheduleCardAtSlot,
  onScheduleCardAllDay,
  onAdjustCardDuration,
  onCreateCardAtSlot,
}: WeekPlannerViewProps) {
  const [hoverSlot, setHoverSlot] = useState<{ dateKey: string; hour: number } | null>(null);
  const [hoverAllDayKey, setHoverAllDayKey] = useState<string | null>(null);

  const days = getWeekDays(anchorDate);
  const today = new Date();
  const hours = Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i);

  // Mobile single-day selector state
  const [mobileDayKey, setMobileDayKey] = useState<string>(() => {
    const todayMatch = days.find((d) => isSameDay(d, today));
    return toLocalDateKey(todayMatch ?? days[0]);
  });

  useEffect(() => {
    const dayKeys = days.map(toLocalDateKey);
    if (!dayKeys.includes(mobileDayKey)) {
      const todayMatch = days.find((d) => isSameDay(d, today));
      setMobileDayKey(toLocalDateKey(todayMatch ?? days[0]));
    }
  }, [anchorDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const draggedCard = draggedCardId ? cards.find((c) => c.id === draggedCardId) ?? null : null;
  const draggedMins = draggedCard ? getCardDurationMinutes(draggedCard, 60) : 60;

  const renderDayColumn = (day: Date, isMobileSingle = false) => {
    const key = toLocalDateKey(day);
    const isToday = isSameDay(day, today);

    const timedCards = cards.filter(
      (c) =>
        c.startDate &&
        !c.allDay &&
        c.startDate.includes('T') &&
        extractDateKey(c.startDate) === key
    );
    const timedEvents = googleEvents.filter(
      (ev) => !ev.allDay && extractDateKey(ev.start) === key
    );

    const blockInputs: Array<{ item: WeekBlockPayload; start: string; end: string }> = [
      ...timedCards.map((c) => ({
        item: { kind: 'card', card: c } as WeekBlockPayload,
        start: c.startDate!,
        end: c.endDate || c.startDate!,
      })),
      ...timedEvents.map((ev) => ({
        item: { kind: 'google', event: ev } as WeekBlockPayload,
        start: ev.start,
        end: ev.end,
      })),
    ];

    const positioned = layoutDayTimeBlocks(blockInputs, HOUR_START, HOUR_END);

    return (
      <div
        key={`${isMobileSingle ? 'm-' : ''}${key}`}
        data-testid={isMobileSingle ? `mobile-week-day-${key}` : `week-day-${key}`}
        className={`relative border-r border-slate-200 last:border-r-0 ${
          isToday ? 'bg-blue-50/20' : ''
        }`}
      >
        {/* Drop & Click Hour Cells */}
        {hours.map((h) => {
          const slotId = `${key}-${h}`;
          const isHovered = hoverSlot?.dateKey === key && hoverSlot?.hour === h;
          return (
            <div
              key={slotId}
              data-testid={isMobileSingle ? undefined : `week-slot-${key}-${h}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (hoverSlot?.dateKey !== key || hoverSlot?.hour !== h) {
                  setHoverSlot({ dateKey: key, hour: h });
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (hoverSlot?.dateKey === key && hoverSlot?.hour === h) {
                    setHoverSlot(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setHoverSlot(null);
                const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
                if (cardId) {
                  onScheduleCardAtSlot(cardId, key, h);
                }
              }}
              className={`group h-15 border-b border-slate-100 relative transition-colors ${
                isHovered ? 'bg-blue-100/80' : 'hover:bg-slate-50/80'
              }`}
            >
              {isHovered && (
                <div className="pointer-events-none absolute inset-x-1 top-1 z-20 rounded-md border border-dashed border-blue-500 bg-blue-50/95 px-2 py-1 text-[11px] font-medium text-blue-800 shadow-xs">
                  <span className="font-mono tabular-nums mr-1.5">
                    {pad2(h)}:00–{pad2(Math.min(23, h + Math.floor(draggedMins / 60)))}:
                    {pad2(draggedMins % 60)}
                  </span>
                  <span className="truncate">{draggedCard?.title ?? 'Запланировать'}</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => onCreateCardAtSlot(key, h)}
                aria-label={`Создать задачу ${key} в ${pad2(h)}:00`}
                className={`focus-visible:opacity-100 absolute right-1.5 top-1.5 p-1 rounded bg-white border border-slate-200 text-slate-500 hover:text-blue-600 transition-opacity cursor-pointer ${
                  isMobileSingle ? 'opacity-75' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          );
        })}

        {/* Positioned Timed Cards & Google Events */}
        {positioned.map((pos, idx) => {
          const widthPct = 100 / pos.totalColumns;
          const leftPct = pos.column * widthPct;
          const style: React.CSSProperties = {
            top: `${pos.topPercent}%`,
            height: `${pos.heightPercent}%`,
            left: `calc(${leftPct}% + 2px)`,
            width: `calc(${widthPct}% - 4px)`,
          };

          if (pos.item.kind === 'card') {
            const c = pos.item.card;
            const firstLbl = labels.find((l) => c.labelIds.includes(l.id));
            const meta = firstLbl ? LABEL_COLOR_META[firstLbl.color] : LABEL_COLOR_META.blue;
            const isBeingDragged = draggedCardId === c.id;

            return (
              <div
                key={`card-${c.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', c.id);
                  e.dataTransfer.effectAllowed = 'move';
                  onDragStartCard(c.id);
                }}
                onDragEnd={() => {
                  setHoverSlot(null);
                  onDragEndCard();
                }}
                style={style}
                className={`group/block absolute z-10 ${
                  draggedCardId && !isBeingDragged ? 'pointer-events-none' : ''
                } ${isBeingDragged ? 'opacity-40' : ''}`}
              >
                <div
                  className={`w-full h-full rounded-md border shadow-2xs overflow-hidden flex flex-col justify-between transition-colors ${meta.blockBg} ${meta.blockBorder}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectCard(c)}
                    className="w-full flex-1 min-h-0 text-left px-2 py-1 cursor-pointer hover:brightness-98 focus-visible:outline-2 focus-visible:outline-blue-600 flex flex-col justify-between"
                  >
                    <div className="min-w-0">
                      <div className={`text-[11px] font-semibold leading-tight truncate ${meta.text}`}>
                        {c.title}
                      </div>
                      <div className="font-mono text-[10px] tabular-nums text-slate-600 mt-0.5 flex items-center gap-1">
                        <span>
                          {formatTimeHHMM(c.startDate!)}
                          {c.endDate ? `–${formatTimeHHMM(c.endDate)}` : ''}
                        </span>
                        {c.googleEventId && !c.syncDirty && (
                          <span className="text-emerald-700 font-sans font-medium">· G</span>
                        )}
                      </div>
                    </div>

                  </button>

                  {/* Quick duration resize bar */}
                  <div
                    className={`${
                      isMobileSingle
                        ? 'flex'
                        : 'hidden group-hover/block:flex group-focus-within/block:flex'
                    } items-center justify-end gap-0.5 px-1 pb-0.5 bg-white/75 border-t border-slate-200/70 shrink-0`}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdjustCardDuration(c.id, -30);
                      }}
                      aria-label={`Сократить длительность '${c.title}' на 30 минут`}
                      className="p-0.5 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                    >
                      <Minus className="w-2.5 h-2.5" />
                    </button>
                    <span className="font-mono text-[9px] tabular-nums text-slate-500 px-0.5">
                      30м
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdjustCardDuration(c.id, 30);
                      }}
                      aria-label={`Увеличить длительность '${c.title}' на 30 минут`}
                      className="p-0.5 text-slate-600 hover:text-slate-900 rounded cursor-pointer"
                    >
                      <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          const ev = pos.item.event;
          return (
            <div
              key={`gcal-${ev.calendarId}-${ev.id}-${idx}`}
              style={style}
              className={`absolute z-10 ${draggedCardId ? 'pointer-events-none' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelectGoogleEvent(ev)}
                className="w-full h-full text-left px-2 py-1 rounded-md border border-slate-200 bg-white/95 shadow-2xs overflow-hidden flex flex-col justify-start cursor-pointer hover:border-blue-400 focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                <div className="flex items-center gap-1 min-w-0">
                  <Calendar
                    className="w-3 h-3 shrink-0"
                    style={{ color: ev.calendarColor || '#2563eb' }}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] font-medium text-slate-900 truncate">
                    {ev.summary}
                  </span>
                </div>
                <div className="font-mono text-[10px] tabular-nums text-slate-500 mt-0.5">
                  {formatTimeHHMM(ev.start)}–{formatTimeHHMM(ev.end)}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const selectedMobileDay = days.find((d) => toLocalDateKey(d) === mobileDayKey) ?? days[0];

  const renderAllDayRow = (targetDays: Date[]) => (
    <div
      className={`grid ${
        targetDays.length === 1
          ? 'grid-cols-[52px_1fr]'
          : 'grid-cols-[64px_repeat(7,minmax(0,1fr))]'
      }`}
    >
      <div className="border-r border-slate-200 bg-slate-50 p-1.5 md:p-2 text-[10px] md:text-[11px] font-mono text-slate-400 flex items-end justify-end">
        День
      </div>
      {targetDays.map((day) => {
        const key = toLocalDateKey(day);
        const isToday = isSameDay(day, today);
        const isAllDayHover = hoverAllDayKey === key;

        const dayAllDayCards = cards.filter(
          (c) =>
            c.startDate &&
            (c.allDay || /^\d{4}-\d{2}-\d{2}$/.test(c.startDate)) &&
            extractDateKey(c.startDate) <= key &&
            (c.endDate ? extractDateKey(c.endDate) : extractDateKey(c.startDate)) >= key
        );
        const dayAllDayEvents = googleEvents.filter(
          (ev) => ev.allDay && extractDateKey(ev.start) === key
        );

        return (
          <div
            key={key}
            onDragOver={(e) => {
              e.preventDefault();
              if (hoverAllDayKey !== key) setHoverAllDayKey(key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setHoverAllDayKey(null);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setHoverAllDayKey(null);
              const cardId = e.dataTransfer.getData('text/plain') || draggedCardId;
              if (cardId) onScheduleCardAllDay(cardId, key);
            }}
            className={`border-r border-slate-200 last:border-r-0 p-2 min-h-14 md:min-h-18 transition-colors ${
              isAllDayHover ? 'bg-blue-100/70' : isToday ? 'bg-blue-50/40' : 'bg-white'
            }`}
          >
            {targetDays.length > 1 ? (
              <div className="flex items-center justify-between gap-1 mb-1.5">
                <span className="text-[11px] font-medium text-slate-500">
                  {formatRussianWeekdayShort(day)}
                </span>
                <span
                  className={`font-mono text-xs tabular-nums font-semibold px-1.5 py-0.5 rounded ${
                    isToday ? 'bg-blue-600 text-white' : 'text-slate-900'
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-slate-900">
                  {formatRussianWeekdayShort(day)}, {formatRussianShortDate(day)}
                </span>
                <button
                  type="button"
                  onClick={() => onCreateCardAtSlot(key, 10)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-blue-700 bg-blue-50 rounded-md cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Задача</span>
                </button>
              </div>
            )}

            <div className="space-y-1">
              {dayAllDayCards.map((card) => {
                const firstLbl = labels.find((l) => card.labelIds.includes(l.id));
                const meta = firstLbl ? LABEL_COLOR_META[firstLbl.color] : LABEL_COLOR_META.blue;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => onSelectCard(card)}
                    className={`w-full text-left px-1.5 py-0.5 text-[11px] font-medium rounded border truncate cursor-pointer ${meta.blockBg} ${meta.blockBorder} ${meta.text}`}
                  >
                    {card.title}
                  </button>
                );
              })}
              {dayAllDayEvents.map((ev) => (
                <button
                  key={`${ev.calendarId}-${ev.id}`}
                  type="button"
                  onClick={() => onSelectGoogleEvent(ev)}
                  className="w-full text-left px-1.5 py-0.5 text-[11px] rounded border border-slate-200 bg-slate-100 text-slate-700 truncate cursor-pointer flex items-center gap-1"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-xs shrink-0"
                    style={{ backgroundColor: ev.calendarColor || '#2563eb' }}
                  />
                  <span className="truncate">{ev.summary}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      data-testid="week-planner-view"
      className="flex-1 flex flex-col overflow-hidden bg-white"
    >
      {/* Mobile Day Strip Selector */}
      <div className="md:hidden grid grid-cols-7 border-b border-slate-200 bg-slate-50 px-1 py-1.5 gap-1 shrink-0">
        {days.map((day) => {
          const key = toLocalDateKey(day);
          const selected = key === mobileDayKey;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setMobileDayKey(key)}
              className={`py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors cursor-pointer ${
                selected
                  ? 'bg-blue-600 text-white font-semibold'
                  : isToday
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{formatRussianWeekdayShort(day)}</span>
              <span className="font-mono tabular-nums">{day.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Desktop 7-Day Header */}
      <div className="hidden md:block border-b border-slate-200 shrink-0 overflow-y-hidden [scrollbar-gutter:stable]">
        {renderAllDayRow(days)}
      </div>

      {/* Mobile 1-Day Header */}
      <div className="md:hidden border-b border-slate-200 shrink-0">
        {renderAllDayRow([selectedMobileDay])}
      </div>

      {/* Scrollable Hourly Grid */}
      <div className="flex-1 overflow-y-auto">
        {/* Desktop 7-Day Grid */}
        <div className="hidden md:grid grid-cols-[64px_repeat(7,minmax(0,1fr))] relative min-h-[780px]">
          <div className="border-r border-slate-200 bg-slate-50/70">
            {hours.map((h) => (
              <div
                key={h}
                className="h-15 border-b border-slate-100 pr-2 pt-1 text-right font-mono text-[11px] tabular-nums text-slate-400"
              >
                {pad2(h)}:00
              </div>
            ))}
          </div>
          {days.map((day) => renderDayColumn(day, false))}
        </div>

        {/* Mobile 1-Day Readable Grid */}
        <div className="md:hidden grid grid-cols-[52px_1fr] relative min-h-[780px]">
          <div className="border-r border-slate-200 bg-slate-50/70">
            {hours.map((h) => (
              <div
                key={h}
                className="h-15 border-b border-slate-100 pr-1.5 pt-1 text-right font-mono text-[10px] tabular-nums text-slate-400"
              >
                {pad2(h)}:00
              </div>
            ))}
          </div>
          {renderDayColumn(selectedMobileDay, true)}
        </div>
      </div>
    </div>
  );
}
