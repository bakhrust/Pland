import {
  BarChart2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Minus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HabitItem, LabelColor } from '../types/planner';
import {
  addDays,
  formatRussianShortDate,
  formatRussianWeekdayShort,
  getWeekDays,
  isSameDay,
  parseFlexibleDate,
  toLocalDateKey,
} from '../utils/dateUtils';
import {
  computeHabitStats,
  computeMonthlyHabitStats,
  getHabitDayCount,
  getHabitsSummaryForDay,
  isHabitDoneOnDay,
  isHabitScheduledOnDay,
} from '../utils/habitLogic';
import { HabitModal } from './HabitModal';

type HabitFilter = 'all' | 'scheduled' | 'pending' | 'done';
type ViewMode = 'tracker' | 'monthly';

interface HabitsViewProps {
  habits: HabitItem[];
  onToggleHabitDay: (habitId: string, dateKey: string) => void;
  onAdjustHabitCount: (habitId: string, dateKey: string, delta: number) => void;
  onCreateHabit: (payload: {
    title: string;
    color: LabelColor;
    daysOfWeek: number[];
    targetCount: number;
    unit: string;
  }) => void;
  onUpdateHabit: (
    habitId: string,
    payload: {
      title: string;
      color: LabelColor;
      daysOfWeek: number[];
      targetCount: number;
      unit: string;
    }
  ) => void;
  onDeleteHabit: (habitId: string) => void;
  onSeedStarterHabits: () => void;
}

const COLOR_STYLES: Record<
  LabelColor,
  {
    solidBg: string;
    softBg: string;
    text: string;
    border: string;
    bar: string;
    dot: string;
    hex: string;
  }
> = {
  blue: {
    solidBg: 'bg-blue-600 text-white border-blue-600',
    softBg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
    bar: 'bg-blue-600',
    dot: 'bg-blue-600',
    hex: '#2563eb',
  },
  emerald: {
    solidBg: 'bg-emerald-600 text-white border-emerald-600',
    softBg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
    bar: 'bg-emerald-600',
    dot: 'bg-emerald-600',
    hex: '#059669',
  },
  violet: {
    solidBg: 'bg-violet-600 text-white border-violet-600',
    softBg: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-300 dark:border-violet-700',
    bar: 'bg-violet-600',
    dot: 'bg-violet-600',
    hex: '#7c3aed',
  },
  amber: {
    solidBg: 'bg-amber-500 text-white border-amber-500',
    softBg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
    bar: 'bg-amber-500',
    dot: 'bg-amber-500',
    hex: '#d97706',
  },
  rose: {
    solidBg: 'bg-rose-600 text-white border-rose-600',
    softBg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-700',
    bar: 'bg-rose-600',
    dot: 'bg-rose-600',
    hex: '#e11d48',
  },
  slate: {
    solidBg: 'bg-slate-700 text-white border-slate-700',
    softBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    bar: 'bg-slate-700',
    dot: 'bg-slate-700',
    hex: '#475569',
  },
};

function formatScheduleLabel(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 7) return 'Каждый день';
  if (
    daysOfWeek.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => daysOfWeek.includes(d))
  ) {
    return 'Будни';
  }
  const names: Record<number, string> = {
    1: 'Пн',
    2: 'Вт',
    3: 'Ср',
    4: 'Чт',
    5: 'Пт',
    6: 'Сб',
    7: 'Вс',
  };
  return daysOfWeek.map((d) => names[d]).filter(Boolean).join(', ');
}

export function HabitsView({
  habits,
  onToggleHabitDay,
  onAdjustHabitCount,
  onCreateHabit,
  onUpdateHabit,
  onDeleteHabit,
  onSeedStarterHabits,
}: HabitsViewProps) {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toLocalDateKey(today), [today]);

  const [viewMode, setViewMode] = useState<ViewMode>('tracker');
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => today);
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => todayKey);
  const [filter, setFilter] = useState<HabitFilter>('all');
  const [search, setSearch] = useState('');
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    habit: HabitItem | null;
  }>({ isOpen: false, habit: null });

  const weekDays = useMemo(() => getWeekDays(weekAnchor), [weekAnchor]);
  const selectedDayDate = useMemo(() => parseFlexibleDate(selectedDayKey), [selectedDayKey]);

  const summary = useMemo(
    () => getHabitsSummaryForDay(habits, selectedDayKey, today),
    [habits, selectedDayKey, today]
  );

  const monthlyStats = useMemo(
    () => computeMonthlyHabitStats(habits, today),
    [habits, today]
  );

  const visibleHabits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return habits.filter((habit) => {
      if (q && !habit.title.toLowerCase().includes(q)) return false;
      const scheduled = isHabitScheduledOnDay(habit, selectedDayKey);
      const done = isHabitDoneOnDay(habit, selectedDayKey);
      if (filter === 'scheduled') return scheduled;
      if (filter === 'pending') return scheduled && !done;
      if (filter === 'done') return done;
      return true;
    });
  }, [habits, search, filter, selectedDayKey]);

  const handleShiftWeek = (deltaWeeks: number) => {
    const nextAnchor = addDays(weekAnchor, deltaWeeks * 7);
    setWeekAnchor(nextAnchor);
    const nextDays = getWeekDays(nextAnchor);
    setSelectedDayKey(toLocalDateKey(nextDays[0]));
  };

  const handleResetToday = () => {
    setWeekAnchor(today);
    setSelectedDayKey(todayKey);
  };

  const ringRadius = 20;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset =
    ringCircumference - (summary.todayPercent / 100) * ringCircumference;

  const weekLabel = `${formatRussianShortDate(weekDays[0])} – ${formatRussianShortDate(weekDays[6])}`;
  const selectedDayHuman =
    selectedDayKey === todayKey
      ? 'Сегодня'
      : `${formatRussianWeekdayShort(selectedDayDate)}, ${formatRussianShortDate(selectedDayDate)}`;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-5xl mx-auto px-3.5 md:px-6 py-3.5 md:py-7 space-y-3.5 md:space-y-5">
        {/* Header & Primary CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Трекер привычек
            </h1>
            <p className="hidden sm:block text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Ежедневные отметки, серии без пропусков и аналитика за месяц
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('tracker')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'tracker'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Трекер</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('monthly')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'monthly'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Статистика месяц</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="add-habit-button"
              onClick={() => setModalState({ isOpen: true, habit: null })}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 md:px-4 py-2 min-h-[42px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Новая привычка</span>
            </button>
          </div>
        </div>

        {/* Summary Strip */}
        <section
          aria-label="Сводка по привычкам"
          className="grid grid-cols-3 gap-2 md:gap-3"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 md:p-4 flex items-center gap-1.5 md:gap-4 min-w-0">
            <div className="relative w-9 h-9 md:w-12 md:h-12 shrink-0 flex items-center justify-center">
              <svg className="w-9 h-9 md:w-12 md:h-12 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
                <circle
                  cx="24"
                  cy="24"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx="24"
                  cy="24"
                  r={ringRadius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="text-emerald-600 dark:text-emerald-400 transition-all duration-300"
                />
              </svg>
              <span className="absolute text-[9px] md:text-[11px] font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {summary.todayPercent}%
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 truncate">{selectedDayHuman}</div>
              <div className="text-sm md:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 leading-tight mt-0.5">
                {summary.doneToday}/{summary.scheduledToday}
              </div>
              <div className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400">выполнено по плану</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 md:p-4 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <div className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 truncate">Серия</div>
              <div className="text-sm md:text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 leading-tight mt-0.5">
                {summary.topStreak} дн
              </div>
              <div className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400">максимум среди привычек</div>
            </div>
            <div className="hidden sm:flex w-9 h-9 md:w-10 md:h-10 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Flame className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 md:p-4 flex flex-col justify-center min-w-0">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 truncate">30 дней (мес)</span>
              <span className="text-sm md:text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                {monthlyStats.overallMonthRate}%
              </span>
            </div>
            <div className="mt-1.5 md:mt-2.5 h-1.5 md:h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${monthlyStats.overallMonthRate}%` }}
              />
            </div>
            <div className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Успех: <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">{monthlyStats.totalMonthCompleted}/{monthlyStats.totalMonthScheduled}</span>
            </div>
          </div>
        </section>

        {viewMode === 'monthly' ? (
          /* MONTHLY STATISTICS WITH RECHARTS */
          <div className="space-y-4">
            {habits.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Нет данных для графиков</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Добавьте привычки и отмечайте их выполнение, чтобы увидеть статистику за месяц.
                </p>
                <button
                  type="button"
                  onClick={() => setModalState({ isOpen: true, habit: null })}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 cursor-pointer"
                >
                  Создать привычку
                </button>
              </div>
            ) : (
              <>
                {/* Area Chart: Daily Completion % over last 30 days */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                        Динамика выполнения привычек за 30 дней
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Процент успешности выполнения запланированных привычек по дням
                      </p>
                    </div>
                    <span className="text-xs font-mono tabular-nums font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-lg">
                      Среднее: {monthlyStats.overallMonthRate}%
                    </span>
                  </div>

                  <div className="h-64 md:h-72 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyStats.days} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPercent" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          className="text-slate-500 dark:text-slate-400 fill-current"
                          interval={4}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          className="text-slate-500 dark:text-slate-400 fill-current"
                          unit="%"
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white dark:bg-slate-800 text-xs rounded-lg p-2.5 shadow-lg space-y-1">
                                  <p className="font-semibold">{label}</p>
                                  <p className="font-mono tabular-nums">
                                    Выполнено: {data.completed} из {data.scheduled} ({data.percent}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="percent"
                          stroke="#2563eb"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorPercent)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bar Chart: Success Rate per Habit */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-6 space-y-3">
                  <div>
                    <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                      Успешность по каждой привычке (за 30 дней)
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Сравнение процента выполнения по каждой цели
                    </p>
                  </div>

                  <div className="h-64 md:h-72 w-full pt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyStats.habitBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis
                          dataKey="title"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          className="text-slate-500 dark:text-slate-400 fill-current"
                          interval={0}
                          angle={-20}
                          textAnchor="end"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11 }}
                          className="text-slate-500 dark:text-slate-400 fill-current"
                          unit="%"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0].payload;
                              return (
                                <div className="bg-slate-900 text-white dark:bg-slate-800 text-xs rounded-lg p-2.5 shadow-lg space-y-1">
                                  <p className="font-semibold">{item.title}</p>
                                  <p className="font-mono tabular-nums">
                                    Успех: {item.rate}% ({item.completed} / {item.scheduled} дней)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="rate"
                          fill="#059669"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* REGULAR WEEKLY TRACKER VIEW */
          <>
            {/* Controls Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 md:p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 md:gap-3">
              <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
                <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => handleShiftWeek(-1)}
                    aria-label="Предыдущая неделя"
                    className="w-8 h-8 md:w-9 md:h-9 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleResetToday}
                    className="px-2.5 md:px-3 h-8 md:h-9 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-750 transition-colors border-x border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    Сегодня
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShiftWeek(1)}
                    aria-label="Следующая неделя"
                    className="w-8 h-8 md:w-9 md:h-9 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-750 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 tabular-nums px-1">
                  {weekLabel}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'Все' },
                      { id: 'scheduled', label: 'По плану' },
                      { id: 'pending', label: 'Осталось' },
                      { id: 'done', label: 'Готово' },
                    ] as const
                  ).map((tab) => {
                    const active = filter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setFilter(tab.id)}
                        className={`flex-1 sm:flex-none px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search
                    className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск..."
                    aria-label="Поиск привычки"
                    className="w-full sm:w-44 pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-800 focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Mobile Day Selector Strip */}
            <div className="md:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 grid grid-cols-7 gap-1">
              {weekDays.map((day) => {
                const key = toLocalDateKey(day);
                const selected = key === selectedDayKey;
                const isToday = isSameDay(day, today);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDayKey(key)}
                    className={`min-h-[44px] rounded-lg flex flex-col items-center justify-center gap-0.5 text-[11px] transition-colors cursor-pointer ${
                      selected
                        ? 'bg-slate-900 dark:bg-blue-600 text-white'
                        : isToday
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{formatRussianWeekdayShort(day)}</span>
                    <span className="font-mono tabular-nums font-bold">{day.getDate()}</span>
                  </button>
                );
              })}
            </div>

            {/* Habits List / Matrix */}
            {habits.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Привычек пока нет</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Добавьте первую регулярную привычку или начните с готового набора для работы и здоровья.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setModalState({ isOpen: true, habit: null })}
                    className="px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Создать привычку
                  </button>
                  <button
                    type="button"
                    onClick={onSeedStarterHabits}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Добавить базовый набор (3)</span>
                  </button>
                </div>
              </div>
            ) : visibleHabits.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-2.5">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Нет привычек по выбранному фильтру</p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setSearch('');
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Сбросить фильтр
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {/* Desktop Table Header */}
                <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_336px_76px] items-center px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <div>Привычка и прогресс</div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {weekDays.map((day) => {
                      const key = toLocalDateKey(day);
                      const isToday = isSameDay(day, today);
                      const selected = key === selectedDayKey;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDayKey(key)}
                          className={`py-1 rounded-md flex flex-col items-center transition-colors cursor-pointer ${
                            selected
                              ? 'bg-slate-900 dark:bg-blue-600 text-white'
                              : isToday
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                              : 'hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <span>{formatRussianWeekdayShort(day)}</span>
                          <span className="font-mono tabular-nums text-[11px]">{day.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-right">Действия</div>
                </div>

                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {visibleHabits.map((habit) => {
                    const style = COLOR_STYLES[habit.color] ?? COLOR_STYLES.emerald;
                    const stats = computeHabitStats(habit, today);
                    const dayCount = getHabitDayCount(habit, selectedDayKey);
                    const dayDone = isHabitDoneOnDay(habit, selectedDayKey);
                    const scheduledSelected = isHabitScheduledOnDay(habit, selectedDayKey);
                    const dayPercent = Math.min(
                      100,
                      Math.round((dayCount / Math.max(1, habit.targetCount)) * 100)
                    );

                    return (
                      <div
                        key={habit.id}
                        data-testid={`habit-row-${habit.id}`}
                        className="px-4 md:px-5 py-3.5 hover:bg-slate-50/60 dark:hover:bg-slate-850/50 transition-colors"
                      >
                        <div className="flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_336px_76px] md:items-center gap-3">
                          {/* Column 1 */}
                          <div className="flex items-start sm:items-center gap-3 min-w-0">
                            <button
                              type="button"
                              data-testid={`habit-toggle-${habit.id}`}
                              onClick={() => onToggleHabitDay(habit.id, selectedDayKey)}
                              aria-label={
                                dayDone
                                  ? `Снять отметку: ${habit.title}`
                                  : `Отметить: ${habit.title}`
                              }
                              aria-pressed={dayDone}
                              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                                dayDone
                                  ? style.solidBg
                                  : dayCount > 0
                                  ? `${style.softBg} font-mono text-xs font-bold tabular-nums`
                                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-600 dark:hover:text-slate-300'
                              }`}
                            >
                              {dayDone ? (
                                <Check className="w-5 h-5" strokeWidth={2.5} aria-hidden="true" />
                              ) : dayCount > 0 ? (
                                <span className="text-[11px] font-mono tabular-nums">
                                  {dayCount}/{habit.targetCount}
                                </span>
                              ) : (
                                <span className={`w-2.5 h-2.5 rounded-full ${style.dot} opacity-45`} />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`text-sm font-semibold truncate ${
                                      dayDone ? 'text-slate-400 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-slate-900 dark:text-slate-100'
                                    }`}
                                  >
                                    {habit.title}
                                  </span>
                                </div>

                                {/* Mobile edit/delete */}
                                <div className="flex md:hidden items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setModalState({ isOpen: true, habit })}
                                    aria-label={`Редактировать ${habit.title}`}
                                    className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteHabit(habit.id)}
                                    aria-label={`Удалить ${habit.title}`}
                                    className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {habit.targetCount > 1 && (
                                  <>
                                    <span
                                      data-testid={`habit-count-${habit.id}`}
                                      className="font-mono font-semibold text-slate-700 dark:text-slate-300"
                                    >
                                      {dayCount}/{habit.targetCount} {habit.unit}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span>{formatScheduleLabel(habit.daysOfWeek)}</span>
                                {!scheduledSelected && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-slate-400 dark:text-slate-500">выходной</span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span>
                                  Серия:{' '}
                                  <strong className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {stats.currentStreak} дн
                                  </strong>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  7 дн:{' '}
                                  <strong className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                    {stats.weekRatePercent}%
                                  </strong>
                                </span>
                              </div>

                              {habit.targetCount > 1 && (
                                <div className="mt-2 flex items-center gap-2.5">
                                  <div className="flex-1 max-w-[180px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${style.bar} transition-all duration-200`}
                                      style={{ width: `${dayPercent}%` }}
                                    />
                                  </div>
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      data-testid={`habit-dec-${habit.id}`}
                                      onClick={() => onAdjustHabitCount(habit.id, selectedDayKey, -1)}
                                      disabled={dayCount <= 0}
                                      aria-label={`Уменьшить: ${habit.title}`}
                                      className="w-8 h-8 md:w-7 md:h-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750 disabled:opacity-35 cursor-pointer disabled:cursor-default"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      data-testid={`habit-inc-${habit.id}`}
                                      onClick={() => onAdjustHabitCount(habit.id, selectedDayKey, 1)}
                                      aria-label={`Увеличить: ${habit.title}`}
                                      className="w-8 h-8 md:w-7 md:h-7 inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Column 2: 7-day interactive grid */}
                          <div className="grid grid-cols-7 gap-1 md:w-[336px]">
                            {weekDays.map((day) => {
                              const key = toLocalDateKey(day);
                              const count = getHabitDayCount(habit, key);
                              const done = isHabitDoneOnDay(habit, key);
                              const scheduled = isHabitScheduledOnDay(habit, key);
                              const isSelected = key === selectedDayKey;

                              return (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => onToggleHabitDay(habit.id, key)}
                                  title={`${formatRussianWeekdayShort(day)} ${formatRussianShortDate(day)}: ${count}/${habit.targetCount} ${habit.unit}`}
                                  aria-label={`${habit.title}, ${formatRussianShortDate(day)}`}
                                  aria-pressed={done}
                                  className={`h-9 md:h-10 rounded-lg border flex flex-col items-center justify-center text-[11px] font-mono tabular-nums transition-all cursor-pointer ${
                                    done
                                      ? style.solidBg
                                      : count > 0
                                      ? `${style.softBg} font-semibold`
                                      : scheduled
                                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                                      : 'bg-slate-50/80 dark:bg-slate-900 border-dashed border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 hover:border-slate-300'
                                  } ${isSelected ? 'ring-2 ring-slate-900/20 dark:ring-white/20' : ''}`}
                                >
                                  {done ? (
                                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
                                  ) : count > 0 ? (
                                    <span>{count}</span>
                                  ) : scheduled ? (
                                    <span className="text-[10px] md:hidden">
                                      {formatRussianWeekdayShort(day)}
                                    </span>
                                  ) : (
                                    <span className="text-[10px]">·</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Column 3: Desktop actions */}
                          <div className="hidden md:flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setModalState({ isOpen: true, habit })}
                              aria-label={`Редактировать ${habit.title}`}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteHabit(habit.id)}
                              aria-label={`Удалить ${habit.title}`}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <HabitModal
        isOpen={modalState.isOpen}
        habit={modalState.habit}
        onClose={() => setModalState({ isOpen: false, habit: null })}
        onSave={(payload) => {
          if (payload.id) {
            onUpdateHabit(payload.id, payload);
          } else {
            onCreateHabit(payload);
          }
          setModalState({ isOpen: false, habit: null });
        }}
      />
    </div>
  );
}
