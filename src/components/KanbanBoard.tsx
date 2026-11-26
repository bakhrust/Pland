import { CalendarClock, CalendarPlus, CheckSquare, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import type { BoardList, CardItem, LabelDef } from '../types/planner';
import { getCardDueStatus, getChecklistProgress, isCardInListDone } from '../utils/boardLogic';
import { formatRussianShortDate, formatTimeHHMM, parseFlexibleDate } from '../utils/dateUtils';
import { LABEL_COLOR_META } from '../utils/labelStyles';

interface KanbanBoardProps {
  lists: BoardList[];
  cards: CardItem[];
  labels: LabelDef[];
  onSelectCard: (card: CardItem) => void;
  onQuickScheduleToday?: (card: CardItem) => void;
  onAddCard: (listId: string, title: string) => void;
  onMoveCard: (cardId: string, targetListId: string, targetIndex?: number) => void;
  onAddList: (title: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
}

export function KanbanBoard({
  lists,
  cards,
  labels,
  onSelectCard,
  onQuickScheduleToday,
  onAddCard,
  onMoveCard,
  onAddList,
  onRenameList,
  onDeleteList,
}: KanbanBoardProps) {
  const [addingToListId, setAddingToListId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListTitle, setEditingListTitle] = useState('');
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [activeMobileListId, setActiveMobileListId] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const sortedLists = [...lists].sort((a, b) => a.order - b.order);

  const handleCreateCardSubmit = (listId: string) => {
    const clean = newCardTitle.trim();
    if (!clean) return;
    onAddCard(listId, clean);
    setNewCardTitle('');
    setAddingToListId(null);
  };

  const handleCreateListSubmit = () => {
    const clean = newListTitle.trim();
    if (!clean) return;
    onAddList(clean);
    setNewListTitle('');
    setAddingList(false);
  };

  const scrollToListMobile = (listId: string) => {
    setActiveMobileListId(listId);
    sectionRefs.current[listId]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Quick Column Switcher */}
      <div className="md:hidden px-3 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto shrink-0">
        {sortedLists.map((list) => {
          const count = cards.filter((c) => c.listId === list.id).length;
          const active = (activeMobileListId ?? sortedLists[0]?.id) === list.id;
          return (
            <button
              key={list.id}
              type="button"
              onClick={() => scrollToListMobile(list.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                active
                  ? 'bg-slate-900 dark:bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {list.title} ({count})
            </button>
          );
        })}
      </div>

      <div
        data-testid="kanban-board"
        className="flex-1 overflow-x-auto overflow-y-hidden px-3 md:px-5 py-4 md:py-5 flex items-start gap-3.5 snap-x snap-mandatory md:snap-none"
      >
        {sortedLists.map((list) => {
          const listCards = cards
            .filter((c) => c.listId === list.id)
            .sort((a, b) => a.order - b.order);
          const isDragTarget = dragOverListId === list.id;

          return (
            <section
              key={list.id}
              ref={(el) => {
                sectionRefs.current[list.id] = el;
              }}
              aria-label={`Колонка ${list.title}`}
              data-testid={`kanban-list-${list.id}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverListId(list.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverListId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverListId(null);
                const cardId = e.dataTransfer.getData('text/plain');
                if (cardId) {
                  onMoveCard(cardId, list.id);
                }
              }}
              className={`w-[84vw] max-w-[320px] md:w-[262px] shrink-0 max-h-full flex flex-col rounded-xl border transition-colors snap-start ${
                isDragTarget
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600'
                  : 'bg-slate-100/90 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Column Header */}
              <div className="px-3.5 py-3 flex items-center justify-between gap-2 shrink-0">
                {editingListId === list.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editingListTitle.trim()) {
                        onRenameList(list.id, editingListTitle.trim());
                      }
                      setEditingListId(null);
                    }}
                    className="flex-1"
                  >
                    <input
                      type="text"
                      value={editingListTitle}
                      onChange={(e) => setEditingListTitle(e.target.value)}
                      onBlur={() => {
                        if (editingListTitle.trim()) {
                          onRenameList(list.id, editingListTitle.trim());
                        }
                        setEditingListId(null);
                      }}
                      autoFocus
                      aria-label="Название колонки"
                      className="w-full px-2 py-1 text-sm font-semibold bg-white dark:bg-slate-800 border border-blue-600 rounded text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  </form>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingListId(list.id);
                        setEditingListTitle(list.title);
                      }}
                      className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-blue-600 dark:hover:text-blue-400 text-left cursor-pointer"
                    >
                      {list.title}
                    </button>
                    <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                      {listCards.length}
                    </span>
                  </div>
                )}

                {sortedLists.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteList(list.id)}
                    aria-label={`Удалить колонку ${list.title}`}
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Cards List */}
              <div className="px-2.5 pb-2 space-y-2 overflow-y-auto flex-1 min-h-12">
                {listCards.length === 0 ? (
                  <div className="py-6 px-3 text-center text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg bg-white/40 dark:bg-slate-850/40">
                    Перетащите карточку сюда или добавьте новую
                  </div>
                ) : (
                  listCards.map((card, index) => {
                    const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
                    const chk = getChecklistProgress(card.checklist);
                    const done = isCardInListDone(card, lists);
                    const dueStatus = done ? 'none' : getCardDueStatus(card);

                    return (
                      <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', card.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverListId(null);
                          const draggedId = e.dataTransfer.getData('text/plain');
                          if (draggedId && draggedId !== card.id) {
                            onMoveCard(draggedId, list.id, index);
                          }
                        }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 dark:hover:border-slate-600 rounded-lg hover:border-slate-300 shadow-2xs transition-colors overflow-hidden"
                      >
                        {cardLabels.length > 0 && (
                          <div className="flex h-1 w-full">
                            {cardLabels.map((lbl) => (
                              <div
                                key={lbl.id}
                                className={`flex-1 ${LABEL_COLOR_META[lbl.color].strip}`}
                                title={lbl.name}
                              />
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => onSelectCard(card)}
                          className="w-full text-left p-3 focus-visible:outline-2 focus-visible:outline-blue-600 cursor-pointer block"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                            {card.title}
                          </div>

                          {cardLabels.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                              {cardLabels.map((lbl, i) => (
                                <span key={lbl.id} className="inline-flex items-center gap-1">
                                  <span
                                    className={`w-1.5 h-1.5 rounded-xs ${LABEL_COLOR_META[lbl.color].dot}`}
                                    aria-hidden="true"
                                  />
                                  <span>{lbl.name}</span>
                                  {i < cardLabels.length - 1 && (
                                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600 ml-1">
                                      ·
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}

                          {(card.startDate || card.dueDate || chk.total > 0 || card.googleEventId) && (
                            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                              <div className="flex flex-wrap items-center gap-2 min-w-0 tabular-nums">
                                {card.startDate && (
                                  <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
                                    <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                    <span>
                                      {formatRussianShortDate(parseFlexibleDate(card.startDate))}
                                      {!card.allDay && card.startDate.includes('T')
                                        ? ` ${formatTimeHHMM(card.startDate)}`
                                        : ''}
                                    </span>
                                  </span>
                                )}

                                {!card.startDate && card.dueDate && (
                                  <span
                                    className={
                                      dueStatus === 'overdue'
                                        ? 'text-rose-600 dark:text-rose-400 font-medium'
                                        : dueStatus === 'today'
                                          ? 'text-amber-700 dark:text-amber-400 font-medium'
                                          : 'text-slate-500 dark:text-slate-400'
                                    }
                                  >
                                    До {formatRussianShortDate(parseFlexibleDate(card.dueDate))}
                                  </span>
                                )}

                                {chk.total > 0 && (
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                    <CheckSquare className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    <span>
                                      {chk.done}/{chk.total}
                                    </span>
                                  </span>
                                )}

                                {card.startDate && card.googleEventId && !card.syncDirty && (
                                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                    · Google
                                  </span>
                                )}
                                {card.startDate && (!card.googleEventId || card.syncDirty) && (
                                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                                    · Ждёт Google
                                  </span>
                                )}
                              </div>

                            </div>
                          )}
                        </button>

                        {!card.startDate && onQuickScheduleToday && (
                          <div className="px-3 py-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end">
                            <button
                              type="button"
                              data-testid={`kanban-schedule-today-${card.id}`}
                              onClick={() => onQuickScheduleToday(card)}
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
                            >
                              <CalendarPlus className="w-3 h-3" aria-hidden="true" />
                              <span>На календарь</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Card Footer */}
              <div className="p-2.5 pt-1 shrink-0">
                {addingToListId === list.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreateCardSubmit(list.id);
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 space-y-2"
                  >
                    <input
                      type="text"
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      placeholder="Название задачи..."
                      aria-label={`Название новой задачи в колонке ${list.title}`}
                      autoFocus
                      className="w-full text-sm text-slate-900 dark:text-slate-100 bg-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer"
                      >
                        Добавить
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingToListId(null);
                          setNewCardTitle('');
                        }}
                        className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingToListId(list.id);
                      setNewCardTitle('');
                    }}
                    aria-label={`Добавить карточку в колонку ${list.title}`}
                    className="w-full flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Добавить карточку</span>
                  </button>
                )}
              </div>
            </section>
          );
        })}

        {/* Add List Column */}
        <div className="w-[84vw] max-w-[300px] md:w-64 shrink-0 snap-start">
          {addingList ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateListSubmit();
              }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2.5"
            >
              <input
                type="text"
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                placeholder="Название колонки..."
                aria-label="Название новой колонки"
                autoFocus
                className="w-full px-2.5 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Создать колонку
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingList(false);
                    setNewListTitle('');
                  }}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setAddingList(true)}
              className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100/70 dark:bg-slate-900 hover:bg-slate-200/70 dark:hover:bg-slate-850 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Добавить колонку</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
