import { Calendar, Check, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { BoardRecord, CardItem, ChecklistItem, GoogleCalendarMeta } from '../types/planner';
import { getChecklistProgress } from '../utils/boardLogic';
import { extractDateKey, toLocalDateKey } from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface CardModalProps {
  isOpen: boolean;
  card: CardItem | null; // null when creating a new card
  boards: BoardRecord[];
  initialBoardId: string;
  defaultListId: string;
  defaultStartDate?: string | null;
  defaultEndDate?: string | null;
  defaultAllDay?: boolean;
  isGoogleConnected: boolean;
  targetCalendar: GoogleCalendarMeta | null;
  onSave: (saved: CardItem, isNew: boolean, targetBoardId: string) => void;
  onDelete: (cardId: string, boardId: string) => void;
  onClose: () => void;
  onRequestGoogleCreateOrUpdate: (card: CardItem) => void;
  onRequestGoogleDelete: (card: CardItem) => void;
  onOpenGoogleDrawer: () => void;
}

export function CardModal({
  isOpen,
  card,
  boards,
  initialBoardId,
  defaultListId,
  defaultStartDate = null,
  defaultEndDate = null,
  defaultAllDay = false,
  isGoogleConnected,
  targetCalendar,
  onSave,
  onDelete,
  onClose,
  onRequestGoogleCreateOrUpdate,
  onRequestGoogleDelete,
  onOpenGoogleDrawer,
}: CardModalProps) {
  const isNew = !card;

  const [boardId, setBoardId] = useState(initialBoardId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState(defaultListId);
  const [labelIds, setLabelIds] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newCheckText, setNewCheckText] = useState('');

  const [isScheduled, setIsScheduled] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [startDay, setStartDay] = useState('');
  const [endDay, setEndDay] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const selectedBoard = boards.find((b) => b.id === boardId) ?? boards[0];
  const lists = selectedBoard?.state.lists ?? [];
  const labels = selectedBoard?.state.labels ?? [];

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    setNewCheckText('');
    setBoardId(initialBoardId);

    const todayKey = toLocalDateKey(new Date());

    if (card) {
      setTitle(card.title);
      setDescription(card.description);
      setListId(card.listId);
      setLabelIds(card.labelIds);
      setChecklist(card.checklist);
      setDueDate(card.dueDate || '');

      const hasSchedule = Boolean(card.startDate);
      setIsScheduled(hasSchedule);
      const isAllDayCard = Boolean(card.allDay || (card.startDate && /^\d{4}-\d{2}-\d{2}$/.test(card.startDate)));
      setAllDay(isAllDayCard);

      if (card.startDate) {
        const dayKey = extractDateKey(card.startDate);
        setStartDay(dayKey);
        setEndDay(card.endDate ? extractDateKey(card.endDate) : dayKey);
        setStartDateTime(card.startDate.includes('T') ? card.startDate.slice(0, 16) : `${dayKey}T10:00`);
        setEndDateTime(
          card.endDate && card.endDate.includes('T')
            ? card.endDate.slice(0, 16)
            : `${dayKey}T11:00`
        );
      } else {
        setStartDay(todayKey);
        setEndDay(todayKey);
        setStartDateTime(`${todayKey}T10:00`);
        setEndDateTime(`${todayKey}T11:00`);
      }
    } else {
      setTitle('');
      setDescription('');
      setListId(defaultListId);
      setLabelIds([]);
      setChecklist([]);
      setDueDate('');

      if (defaultStartDate) {
        setIsScheduled(true);
        setAllDay(defaultAllDay);
        const dayKey = extractDateKey(defaultStartDate);
        setStartDay(dayKey);
        setEndDay(defaultEndDate ? extractDateKey(defaultEndDate) : dayKey);
        setStartDateTime(
          defaultStartDate.includes('T') ? defaultStartDate.slice(0, 16) : `${dayKey}T10:00`
        );
        setEndDateTime(
          defaultEndDate && defaultEndDate.includes('T')
            ? defaultEndDate.slice(0, 16)
            : `${dayKey}T11:00`
        );
      } else {
        setIsScheduled(false);
        setAllDay(false);
        setStartDay(todayKey);
        setEndDay(todayKey);
        setStartDateTime(`${todayKey}T10:00`);
        setEndDateTime(`${todayKey}T11:00`);
      }
    }
  }, [isOpen, card, initialBoardId, defaultListId, defaultStartDate, defaultEndDate, defaultAllDay]);

  if (!isOpen) return null;

  const handleBoardChange = (nextBoardId: string) => {
    setBoardId(nextBoardId);
    const nextBoard = boards.find((b) => b.id === nextBoardId);
    if (!nextBoard) return;
    const nextLists = [...nextBoard.state.lists].sort((a, b) => a.order - b.order);
    if (!nextLists.some((l) => l.id === listId)) {
      setListId(nextLists[0]?.id ?? '');
    }
    const validLabelIds = new Set(nextBoard.state.labels.map((l) => l.id));
    setLabelIds((prev) => prev.filter((id) => validLabelIds.has(id)));
  };

  const toggleLabel = (id: string) => {
    setLabelIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleAddChecklistItem = () => {
    const clean = newCheckText.trim();
    if (!clean) return;
    setChecklist((prev) => [
      ...prev,
      { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, text: clean, done: false },
    ]);
    setNewCheckText('');
  };

  const buildDraftCard = (): CardItem | null => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Введите название задачи');
      return null;
    }

    let finalStart: string | null = null;
    let finalEnd: string | null = null;

    if (isScheduled) {
      if (allDay) {
        if (!startDay) {
          setErrorMsg('Выберите дату начала');
          return null;
        }
        finalStart = startDay;
        finalEnd = endDay && endDay >= startDay ? endDay : startDay;
      } else {
        if (!startDateTime || !endDateTime) {
          setErrorMsg('Укажите время начала и окончания');
          return null;
        }
        if (endDateTime <= startDateTime) {
          setErrorMsg('Время окончания должно быть позже времени начала');
          return null;
        }
        finalStart = startDateTime;
        finalEnd = endDateTime;
      }
    }

    const scheduleOrContentChanged =
      !card ||
      card.title !== cleanTitle ||
      card.description !== description.trim() ||
      card.startDate !== finalStart ||
      card.endDate !== finalEnd ||
      Boolean(card.allDay) !== (isScheduled ? allDay : false);

    return {
      id: card?.id ?? `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      listId,
      order: card?.order ?? 9999,
      title: cleanTitle,
      description: description.trim(),
      labelIds,
      checklist,
      startDate: finalStart,
      endDate: finalEnd,
      allDay: isScheduled ? allDay : false,
      dueDate: dueDate || null,
      googleEventId: card?.googleEventId ?? null,
      googleCalendarId: card?.googleCalendarId ?? null,
      lastSyncedAt: card?.lastSyncedAt ?? null,
      syncDirty: finalStart ? (scheduleOrContentChanged ? true : Boolean(card?.syncDirty)) : false,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const draft = buildDraftCard();
    if (!draft) return;
    onSave(draft, isNew, boardId);
  };

  const chkProgress = getChecklistProgress(checklist);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-2.5 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-modal-heading"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden my-auto">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <h2 id="card-modal-heading" className="font-display text-base font-semibold text-slate-900">
              {isNew ? 'Новая задача' : 'Карточка задачи'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть окно карточки"
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div
                role="alert"
                className="px-3.5 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
              >
                {errorMsg}
              </div>
            )}

            {/* Title, Board & List */}
            <div className="space-y-3">
              <div>
                <label htmlFor="card-title-input" className="block text-xs font-medium text-slate-700 mb-1">
                  Название
                </label>
                <input
                  id="card-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Например: Подготовить презентацию спринта"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {boards.length > 0 && (
                  <div>
                    <label htmlFor="card-board-select" className="block text-xs font-medium text-slate-700 mb-1">
                      Доска
                    </label>
                    <select
                      id="card-board-select"
                      data-testid="card-board-select"
                      value={boardId}
                      onChange={(e) => handleBoardChange(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                    >
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="card-list-select" className="block text-xs font-medium text-slate-700 mb-1">
                    Колонка
                  </label>
                  <select
                    id="card-list-select"
                    value={listId}
                    onChange={(e) => setListId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    {[...lists]
                      .sort((a, b) => a.order - b.order)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="card-desc-input" className="block text-xs font-medium text-slate-700 mb-1">
                Описание
              </label>
              <textarea
                id="card-desc-input"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Подробности задачи, ссылки или заметки..."
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-y"
              />
            </div>

            {/* Planyway Schedule Section */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  <span className="font-display text-xs font-semibold text-slate-900">
                    Планирование в календаре и таймлайне
                  </span>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                  />
                  <span>Запланировать время</span>
                </label>
              </div>

              {isScheduled && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allDay}
                        onChange={(e) => setAllDay(e.target.checked)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span>Весь день / многодневный интервал на таймлайне</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsScheduled(false)}
                      className="text-xs font-medium text-slate-500 hover:text-rose-600 cursor-pointer"
                    >
                      Очистить время
                    </button>
                  </div>

                  {allDay ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="card-start-day" className="block text-xs text-slate-600 mb-1">
                          Дата начала
                        </label>
                        <input
                          id="card-start-day"
                          type="date"
                          value={startDay}
                          onChange={(e) => setStartDay(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label htmlFor="card-end-day" className="block text-xs text-slate-600 mb-1">
                          Дата окончания
                        </label>
                        <input
                          id="card-end-day"
                          type="date"
                          value={endDay}
                          onChange={(e) => setEndDay(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="card-start-dt" className="block text-xs text-slate-600 mb-1">
                          Начало
                        </label>
                        <input
                          id="card-start-dt"
                          type="datetime-local"
                          value={startDateTime}
                          onChange={(e) => setStartDateTime(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div>
                        <label htmlFor="card-end-dt" className="block text-xs text-slate-600 mb-1">
                          Окончание
                        </label>
                        <input
                          id="card-end-dt"
                          type="datetime-local"
                          value={endDateTime}
                          onChange={(e) => setEndDateTime(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-1">
                <label htmlFor="card-due-date" className="block text-xs text-slate-600 mb-1">
                  Крайний срок (дедлайн)
                </label>
                <input
                  id="card-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="px-3 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Labels */}
            <div>
              <span className="block text-xs font-medium text-slate-700 mb-2">Метки</span>
              <div className="flex flex-wrap gap-3">
                {labels.map((lbl) => {
                  const checked = labelIds.includes(lbl.id);
                  return (
                    <label
                      key={lbl.id}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLabel(lbl.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span
                        className={`w-2.5 h-2.5 rounded-xs ${LABEL_COLOR_META[lbl.color].dot}`}
                        aria-hidden="true"
                      />
                      <span>{lbl.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Чек-лист</span>
                {chkProgress.total > 0 && (
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {chkProgress.done} / {chkProgress.total}
                  </span>
                )}
              </div>

              {chkProgress.total > 0 && (
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all"
                    style={{ width: `${Math.round((chkProgress.done / chkProgress.total) * 100)}%` }}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 rounded-lg"
                  >
                    <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={item.done}
                        onChange={() =>
                          setChecklist((prev) =>
                            prev.map((x) => (x.id === item.id ? { ...x, done: !x.done } : x))
                          )
                        }
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                      />
                      <span className={item.done ? 'line-through text-slate-400' : ''}>
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setChecklist((prev) => prev.filter((x) => x.id !== item.id))}
                      aria-label={`Удалить пункт ${item.text}`}
                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCheckText}
                  onChange={(e) => setNewCheckText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  placeholder="Добавить пункт чек-листа..."
                  aria-label="Новый пункт чек-листа"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={handleAddChecklistItem}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Добавить</span>
                </button>
              </div>
            </div>

            {/* Google Calendar Sync Box (only for existing cards) */}
            {!isNew && (
              <div className="p-4 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900">
                    Синхронизация с Google Calendar
                  </div>
                  {card?.googleEventId ? (
                    <div className="text-xs text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Связано с событием в Google Calendar</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      {isGoogleConnected
                        ? `Целевой календарь: ${targetCalendar?.summary ?? 'Основной'}`
                        : 'Подключите аккаунт Google, чтобы выгружать задачу в календарь'}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isGoogleConnected ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const draft = buildDraftCard();
                          if (draft) onRequestGoogleCreateOrUpdate(draft);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {card?.googleEventId ? 'Обновить в Google' : 'Добавить в Google'}
                        </span>
                      </button>

                      {card?.googleEventId && (
                        <button
                          type="button"
                          onClick={() => onRequestGoogleDelete(card)}
                          className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer"
                        >
                          Удалить из Google
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenGoogleDrawer}
                      className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                    >
                      Подключить Google
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2.5">
            {!isNew && card ? (
              <button
                type="button"
                onClick={() => onDelete(card.id, boardId)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Удалить карточку</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 cursor-pointer"
              >
                {isNew ? 'Создать задачу' : 'Сохранить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
