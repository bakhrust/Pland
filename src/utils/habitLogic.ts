import type { HabitItem, LabelColor } from '../types/planner';
import { addDays, parseFlexibleDate, toLocalDateKey } from './dateUtils';

/** Returns ISO weekday 1 (Monday) .. 7 (Sunday) for a Date or YYYY-MM-DD key */
export function getIsoWeekday(input: Date | string): number {
  const d = typeof input === 'string' ? parseFlexibleDate(input) : input;
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function isHabitScheduledOnDay(habit: HabitItem, dateKey: string): boolean {
  if (!habit.daysOfWeek || habit.daysOfWeek.length === 0) return true;
  return habit.daysOfWeek.includes(getIsoWeekday(dateKey));
}

export function getHabitDayCount(habit: HabitItem, dateKey: string): number {
  const val = habit.completions?.[dateKey];
  return typeof val === 'number' && val > 0 ? val : 0;
}

export function isHabitDoneOnDay(habit: HabitItem, dateKey: string): boolean {
  return getHabitDayCount(habit, dateKey) >= Math.max(1, habit.targetCount);
}

export function setHabitDayCount(habit: HabitItem, dateKey: string, count: number): HabitItem {
  const nextCount = Math.max(0, Math.min(1000, Math.round(count)));
  const nextCompletions = { ...(habit.completions || {}) };
  if (nextCount === 0) {
    delete nextCompletions[dateKey];
  } else {
    nextCompletions[dateKey] = nextCount;
  }
  return {
    ...habit,
    completions: nextCompletions,
  };
}

export function toggleOrIncrementHabitDay(habit: HabitItem, dateKey: string): HabitItem {
  const target = Math.max(1, habit.targetCount);
  const current = getHabitDayCount(habit, dateKey);
  if (target === 1) {
    return setHabitDayCount(habit, dateKey, current >= 1 ? 0 : 1);
  }
  if (current >= target) {
    return setHabitDayCount(habit, dateKey, 0);
  }
  return setHabitDayCount(habit, dateKey, current + 1);
}

export function adjustHabitDayCount(habit: HabitItem, dateKey: string, delta: number): HabitItem {
  const current = getHabitDayCount(habit, dateKey);
  return setHabitDayCount(habit, dateKey, current + delta);
}

export function computeHabitStats(
  habit: HabitItem,
  referenceDate = new Date()
): {
  currentStreak: number;
  bestStreak: number;
  last7Done: number;
  last7Scheduled: number;
  weekRatePercent: number;
} {
  const todayKey = toLocalDateKey(referenceDate);

  // Current streak walking backwards over scheduled days (up to 365 days).
  // If today is scheduled but not yet completed, don't break yesterday's active streak.
  let currentStreak = 0;
  const startOffset = isHabitScheduledOnDay(habit, todayKey) && !isHabitDoneOnDay(habit, todayKey) ? -1 : 0;
  for (let i = startOffset; i >= -365; i--) {
    const key = toLocalDateKey(addDays(referenceDate, i));
    if (!isHabitScheduledOnDay(habit, key)) continue;
    if (isHabitDoneOnDay(habit, key)) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  // Best streak over the last 365 days
  let bestStreak = currentStreak;
  let running = 0;
  for (let i = -365; i <= 0; i++) {
    const key = toLocalDateKey(addDays(referenceDate, i));
    if (!isHabitScheduledOnDay(habit, key)) continue;
    if (isHabitDoneOnDay(habit, key)) {
      running += 1;
      if (running > bestStreak) bestStreak = running;
    } else {
      running = 0;
    }
  }

  // Last 7 days completion rate
  let last7Scheduled = 0;
  let last7Done = 0;
  for (let i = -6; i <= 0; i++) {
    const key = toLocalDateKey(addDays(referenceDate, i));
    if (!isHabitScheduledOnDay(habit, key)) continue;
    last7Scheduled += 1;
    if (isHabitDoneOnDay(habit, key)) {
      last7Done += 1;
    }
  }

  const weekRatePercent =
    last7Scheduled > 0 ? Math.round((last7Done / last7Scheduled) * 100) : 0;

  return {
    currentStreak,
    bestStreak,
    last7Done,
    last7Scheduled,
    weekRatePercent,
  };
}

export function getHabitsSummaryForDay(
  habits: HabitItem[],
  dayKey: string,
  referenceDate = new Date()
): {
  scheduledToday: number;
  doneToday: number;
  todayPercent: number;
  weekPercent: number;
  topStreak: number;
} {
  let scheduledToday = 0;
  let doneToday = 0;
  let total7Scheduled = 0;
  let total7Done = 0;
  let topStreak = 0;

  for (const habit of habits) {
    if (isHabitScheduledOnDay(habit, dayKey)) {
      scheduledToday += 1;
      if (isHabitDoneOnDay(habit, dayKey)) {
        doneToday += 1;
      }
    }
    const stats = computeHabitStats(habit, referenceDate);
    total7Scheduled += stats.last7Scheduled;
    total7Done += stats.last7Done;
    if (stats.currentStreak > topStreak) {
      topStreak = stats.currentStreak;
    }
  }

  return {
    scheduledToday,
    doneToday,
    todayPercent: scheduledToday > 0 ? Math.round((doneToday / scheduledToday) * 100) : 0,
    weekPercent: total7Scheduled > 0 ? Math.round((total7Done / total7Scheduled) * 100) : 0,
    topStreak,
  };
}

export function createHabitItem(input: {
  title: string;
  color: LabelColor;
  daysOfWeek: number[];
  targetCount: number;
  unit: string;
  order: number;
}): HabitItem {
  const cleanDays = Array.from(new Set(input.daysOfWeek.filter((d) => d >= 1 && d <= 7))).sort(
    (a, b) => a - b
  );
  return {
    id: `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim().slice(0, 120) || 'Новая привычка',
    color: input.color,
    daysOfWeek: cleanDays.length > 0 ? cleanDays : [1, 2, 3, 4, 5, 6, 7],
    targetCount: Math.max(1, Math.min(100, Math.round(input.targetCount || 1))),
    unit: input.unit.trim().slice(0, 24) || 'раз',
    order: input.order,
    completions: {},
  };
}

export function computeMonthlyHabitStats(habits: HabitItem[], referenceDate = new Date()) {
  const days: Array<{ dateKey: string; label: string; completed: number; scheduled: number; percent: number }> = [];
  for (let i = -29; i <= 0; i++) {
    const d = addDays(referenceDate, i);
    const dateKey = toLocalDateKey(d);
    let scheduled = 0;
    let completed = 0;
    for (const habit of habits) {
      if (isHabitScheduledOnDay(habit, dateKey)) {
        scheduled += 1;
        if (isHabitDoneOnDay(habit, dateKey)) {
          completed += 1;
        }
      }
    }
    const percent = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
    const monthsRu = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const label = `${d.getDate()} ${monthsRu[d.getMonth()]}`;
    days.push({ dateKey, label, completed, scheduled, percent });
  }

  const habitBreakdown = habits.map(habit => {
    let scheduled = 0;
    let completed = 0;
    for (let i = -29; i <= 0; i++) {
      const d = addDays(referenceDate, i);
      const dateKey = toLocalDateKey(d);
      if (isHabitScheduledOnDay(habit, dateKey)) {
        scheduled += 1;
        if (isHabitDoneOnDay(habit, dateKey)) {
          completed += 1;
        }
      }
    }
    const rate = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0;
    return {
      id: habit.id,
      title: habit.title,
      color: habit.color,
      completed,
      scheduled,
      rate,
    };
  });

  const totalMonthScheduled = days.reduce((acc, d) => acc + d.scheduled, 0);
  const totalMonthCompleted = days.reduce((acc, d) => acc + d.completed, 0);
  const overallMonthRate = totalMonthScheduled > 0 ? Math.round((totalMonthCompleted / totalMonthScheduled) * 100) : 0;

  return {
    days,
    habitBreakdown,
    totalMonthScheduled,
    totalMonthCompleted,
    overallMonthRate,
  };
}

