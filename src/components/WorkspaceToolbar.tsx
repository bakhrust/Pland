import { ChevronLeft, ChevronRight, ListTodo, Plus, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import type { BoardRecord, FilterState, LabelColor, LabelDef, TimelineGroupBy, ViewMode } from '../types/planner';
import { formatRussianMonthYear, formatRussianShortDate, getWeekDays } from '../utils/dateUtils';
import { BoardSwitcher } from './BoardSwitcher';

interface WorkspaceToolbarProps {
  viewMode: ViewMode;
  boards: BoardRecord[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (title: string, color: LabelColor) => void;
  onRenameBoard: (boardId: string, title: string) => void;
  onDeleteBoard: (boardId: string) => void;
  anchorDate: Date;
  onNavigateDate: (direction: 'prev' | 'next' | 'today') => void;
  filters: FilterState;
  onChangeFilters: (next: FilterState) => void;
  labels: LabelDef[];
  timelineGroupBy: TimelineGroupBy;
  onChangeTimelineGroupBy: (groupBy: TimelineGroupBy) => void;
  timelineDaysCount: 7 | 14;
  onChangeTimelineDaysCount: (days: 7 | 14) => void;
  onOpenNewCardModal: () => void;
  onOpenQuickSearch: () => void;
  showBacklogSidebar: boolean;
  onToggleBacklogSidebar: () => void;
  pendingSyncCount: number;
  isGoogleConnected: boolean;
  onSyncPendingToGoogle: () => void;
}

export function WorkspaceToolbar({
  viewMode,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
  anchorDate,
  onNavigateDate,
  filters,
  onChangeFilters,
  labels,
  timelineGroupBy,
  onChangeTimelineGroupBy,
  timelineDaysCount,
  onChangeTimelineDaysCount,
  onOpenNewCardModal,
  onOpenQuickSearch,
  showBacklogSidebar,
  onToggleBacklogSidebar,
  pendingSyncCount,
  isGoogleConnected,
  onSyncPendingToGoogle,
}: WorkspaceToolbarProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isPlannerView = viewMode !== 'board';
  const hasFilters = filters.search.trim() !== '' || filters.labelId !== 'all';

  let periodLabel = '';
  if (viewMode === 'week') {
    const days = getWeekDays(anchorDate);
    periodLabel = `${formatRussianShortDate(days[0])} — ${formatRussianShortDate(days[6])}`;
  } else if (viewMode === 'month') {
    periodLabel = formatRussianMonthYear(anchorDate);
  } else if (viewMode === 'timeline') {
    const days = getWeekDays(anchorDate);
    periodLabel =
      timelineDaysCount === 7
        ? `${formatRussianShortDate(days[0])} — ${formatRussianShortDate(days[6])}`
        : `2 недели от ${formatRussianShortDate(days[0])}`;
  }

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 py-2 md:py-2.5 space-y-2 shrink-0 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Board Switcher + Context & Date Controls */}
        <div className="flex flex-wrap items-center gap-2 md:gap-3 min-w-0">
          <BoardSwitcher
            boards={boards}
            activeBoardId={activeBoardId}
            onSelectBoard={onSelectBoard}
            onCreateBoard={onCreateBoard}
            onRenameBoard={onRenameBoard}
            onDeleteBoard={onDeleteBoard}
          />

          {isPlannerView ? (
            <>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" aria-hidden="true" />
              <button
                type="button"
                onClick={onToggleBacklogSidebar}
                aria-expanded={showBacklogSidebar}
                className={`inline-flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showBacklogSidebar
                    ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                }`}
              >
                <ListTodo className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">
                  {showBacklogSidebar ? 'Скрыть задачи доски' : 'Задачи доски'}
                </span>
                <span className="sm:hidden">Задачи</span>
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" aria-hidden="true" />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onNavigateDate('prev')}
                  aria-label="Предыдущий период"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateDate('today')}
                  className="px-2.5 md:px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateDate('next')}
                  aria-label="Следующий период"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="font-display text-xs md:text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                {periodLabel}
              </span>

              {viewMode === 'timeline' && (
                <div className="hidden lg:flex items-center gap-2">
                  <div
                    role="group"
                    aria-label="Группировка таймлайна"
                    className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg ml-1"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeTimelineGroupBy('list')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        timelineGroupBy === 'list'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      По колонкам
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTimelineGroupBy('label')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        timelineGroupBy === 'label'
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      По меткам
                    </button>
                  </div>

                  <div
                    role="group"
                    aria-label="Масштаб таймлайна"
                    className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => onChangeTimelineDaysCount(7)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        timelineDaysCount === 7
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      7 дн
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTimelineDaysCount(14)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        timelineDaysCount === 14
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      14 дн
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <span className="hidden xl:inline text-xs text-slate-500 dark:text-slate-400">
              Перетаскивайте карточки между колонками или в планировщик
            </span>
          )}
        </div>

        {/* Right: Sync button + Desktop Filters + Mobile Filter Toggle + New Task CTA */}
        <div className="flex items-center gap-2 shrink-0">
          {pendingSyncCount > 0 && (
            <button
              type="button"
              onClick={onSyncPendingToGoogle}
              title={
                isGoogleConnected
                  ? 'Синхронизировать задачи со временем в Google Calendar'
                  : 'Подключить Google Calendar для синхронизации'
              }
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Синхр. ({pendingSyncCount})</span>
            </button>
          )}

          {/* Desktop Inline Filters */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenQuickSearch}
              aria-label="Быстрый поиск задач"
              title="Быстрый поиск (название или описание)"
              className="p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>

            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => onChangeFilters({ ...filters, search: e.target.value })}
                placeholder="Поиск задач..."
                aria-label="Поиск задач"
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800 w-40 lg:w-44"
              />
            </div>

            <select
              aria-label="Фильтр по метке"
              value={filters.labelId}
              onChange={(e) => onChangeFilters({ ...filters, labelId: e.target.value })}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              <option value="all">Все метки</option>
              {labels.map((lbl) => (
                <option key={lbl.id} value={lbl.id}>
                  {lbl.name}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={() => onChangeFilters({ search: '', labelId: 'all' })}
                aria-label="Сбросить фильтры"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Сброс</span>
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            aria-expanded={mobileFiltersOpen}
            aria-label="Фильтры и настройки"
            className={`md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border cursor-pointer ${
              hasFilters || mobileFiltersOpen
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Фильтр</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewCardModal}
            className="inline-flex items-center gap-1.5 px-3 md:px-3.5 py-1.5 text-xs font-medium bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Новая задача</span>
            <span className="sm:hidden">Задача</span>
          </button>
        </div>
      </div>

      {/* Collapsible Mobile Filter & Timeline Controls */}
      {mobileFiltersOpen && (
        <div className="md:hidden pt-2 border-t border-slate-100 space-y-2">
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={filters.search}
              onChange={(e) => onChangeFilters({ ...filters, search: e.target.value })}
              placeholder="Поиск задач..."
              aria-label="Поиск задач на мобильном"
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
            />
          </div>

          <div>
            <select
              aria-label="Метка на мобильном"
              value={filters.labelId}
              onChange={(e) => onChangeFilters({ ...filters, labelId: e.target.value })}
              className="w-full px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-700"
            >
              <option value="all">Все метки</option>
              {labels.map((lbl) => (
                <option key={lbl.id} value={lbl.id}>
                  {lbl.name}
                </option>
              ))}
            </select>
          </div>

          {viewMode === 'timeline' && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChangeTimelineGroupBy('list')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                    timelineGroupBy === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  По колонкам
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTimelineGroupBy('label')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                    timelineGroupBy === 'label' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  По меткам
                </button>
              </div>

              <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChangeTimelineDaysCount(7)}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    timelineDaysCount === 7 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  7 дн
                </button>
                <button
                  type="button"
                  onClick={() => onChangeTimelineDaysCount(14)}
                  className={`px-2 py-1 text-xs font-medium rounded-md ${
                    timelineDaysCount === 14 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  14 дн
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {pendingSyncCount > 0 && (
              <button
                type="button"
                onClick={onSyncPendingToGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Синхронизировать с Google ({pendingSyncCount})</span>
              </button>
            )}
            {hasFilters && (
              <button
                type="button"
                onClick={() => onChangeFilters({ search: '', labelId: 'all' })}
                className="text-xs text-slate-600 underline ml-auto"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
