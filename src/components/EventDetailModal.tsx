import { Calendar, ExternalLink, MapPin, PlusCircle, Video, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BoardList, BoardRecord, GoogleCalendarEvent } from '../types/planner';
import { formatRussianShortDate, formatTimeHHMM, parseFlexibleDate } from '../utils/dateUtils';
import { safeExternalUrl } from '../utils/urlSafety';

interface EventDetailModalProps {
  event: GoogleCalendarEvent | null;
  lists: BoardList[];
  boards?: BoardRecord[];
  initialBoardId?: string;
  onClose: () => void;
  onImportAsCard: (event: GoogleCalendarEvent, listId: string, boardId?: string) => void;
}

export function EventDetailModal({
  event,
  lists,
  boards = [],
  initialBoardId,
  onClose,
  onImportAsCard,
}: EventDetailModalProps) {
  const [targetBoardId, setTargetBoardId] = useState(initialBoardId ?? boards[0]?.id ?? '');

  useEffect(() => {
    setTargetBoardId(initialBoardId ?? boards[0]?.id ?? '');
  }, [initialBoardId, boards, event]);

  if (!event) return null;

  const selectedBoard = boards.find((b) => b.id === targetBoardId);
  const activeLists = selectedBoard ? selectedBoard.state.lists : lists;
  const sortedLists = [...activeLists].sort((a, b) => a.order - b.order);
  const defaultListId = sortedLists[0]?.id || '';
  const startDate = parseFlexibleDate(event.start);
  const safeHangoutUrl = safeExternalUrl(event.hangoutLink);
  const safeHtmlUrl = safeExternalUrl(event.htmlLink);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: event.calendarColor || '#2563eb' }}
                aria-hidden="true"
              />
              <span className="truncate">{event.calendarSummary || 'Google Календарь'}</span>
            </div>
            <h2 id="event-detail-title" className="font-display text-base font-semibold text-slate-900">
              {event.summary}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть детали события"
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-slate-600">
          <div className="flex items-center gap-2 text-slate-800 font-medium tabular-nums">
            <Calendar className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
            <span>
              {formatRussianShortDate(startDate)}
              {event.allDay
                ? ' · Весь день'
                : ` · ${formatTimeHHMM(event.start)}–${formatTimeHHMM(event.end)}`}
            </span>
          </div>

          {event.location && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{event.location}</span>
            </div>
          )}

          {safeHangoutUrl && (
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <a
                href={safeHangoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-medium"
              >
                Открыть встречу Google Meet
              </a>
            </div>
          )}

          {event.description && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg whitespace-pre-wrap text-slate-700 leading-relaxed max-h-40 overflow-y-auto">
              {event.description}
            </div>
          )}

          {safeHtmlUrl && (
            <div>
              <a
                href={safeHtmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:underline font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Открыть в Google Calendar</span>
              </a>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            Закрыть
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {boards.length > 1 && (
              <select
                aria-label="Доска для импорта"
                value={targetBoardId}
                onChange={(e) => setTargetBoardId(e.target.value)}
                className="px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-600 cursor-pointer"
              >
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}

            {defaultListId && (
              <button
                type="button"
                onClick={() => onImportAsCard(event, defaultListId, selectedBoard?.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Создать карточку на доске</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
