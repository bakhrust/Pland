import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HabitItem, LabelColor } from '../types/planner';

interface HabitModalProps {
  isOpen: boolean;
  habit: HabitItem | null;
  onSave: (payload: {
    id?: string;
    title: string;
    color: LabelColor;
    daysOfWeek: number[];
    targetCount: number;
    unit: string;
  }) => void;
  onClose: () => void;
}

const COLOR_OPTIONS: Array<{ id: LabelColor; label: string; dotClass: string; ringClass: string }> = [
  { id: 'emerald', label: 'Изумрудный', dotClass: 'bg-emerald-500', ringClass: 'ring-emerald-600' },
  { id: 'blue', label: 'Синий', dotClass: 'bg-blue-600', ringClass: 'ring-blue-600' },
  { id: 'violet', label: 'Фиолетовый', dotClass: 'bg-violet-600', ringClass: 'ring-violet-600' },
  { id: 'amber', label: 'Янтарный', dotClass: 'bg-amber-500', ringClass: 'ring-amber-500' },
  { id: 'rose', label: 'Коралловый', dotClass: 'bg-rose-500', ringClass: 'ring-rose-500' },
];

const WEEKDAY_OPTIONS: Array<{ day: number; label: string }> = [
  { day: 1, label: 'Пн' },
  { day: 2, label: 'Вт' },
  { day: 3, label: 'Ср' },
  { day: 4, label: 'Чт' },
  { day: 5, label: 'Пт' },
  { day: 6, label: 'Сб' },
  { day: 7, label: 'Вс' },
];

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

export function HabitModal({ isOpen, habit, onSave, onClose }: HabitModalProps) {
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<LabelColor>('emerald');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(ALL_DAYS);
  const [targetCount, setTargetCount] = useState<number>(1);
  const [unit, setUnit] = useState('раз');

  useEffect(() => {
    if (!isOpen) return;
    if (habit) {
      setTitle(habit.title);
      setColor(habit.color === 'slate' ? 'blue' : habit.color);
      setDaysOfWeek(habit.daysOfWeek.length > 0 ? habit.daysOfWeek : ALL_DAYS);
      setTargetCount(habit.targetCount);
      setUnit(habit.unit || 'раз');
    } else {
      setTitle('');
      setColor('emerald');
      setDaysOfWeek(ALL_DAYS);
      setTargetCount(1);
      setUnit('раз');
    }
  }, [isOpen, habit]);

  if (!isOpen) return null;

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev; // Keep at least 1 scheduled day
        return prev.filter((d) => d !== day);
      }
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onSave({
      id: habit?.id,
      title: cleanTitle,
      color,
      daysOfWeek,
      targetCount: Math.max(1, Math.min(100, Math.round(Number(targetCount) || 1))),
      unit: unit.trim() || 'раз',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="habit-modal-title"
    >
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 id="habit-modal-title" className="text-base font-bold text-slate-900">
            {habit ? 'Редактировать привычку' : 'Новая привычка'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="habit-title-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Название
            </label>
            <input
              id="habit-title-input"
              data-testid="habit-title-input"
              type="text"
              autoFocus
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Прогулка 30 минут"
              className="w-full px-3 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="habit-target-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Цель в день
              </label>
              <input
                id="habit-target-input"
                data-testid="habit-target-input"
                type="number"
                min={1}
                max={100}
                value={targetCount}
                onChange={(e) => setTargetCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                className="w-full px-3 py-2 text-sm tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>

            <div>
              <label htmlFor="habit-unit-input" className="block text-xs font-medium text-slate-700 mb-1.5">
                Единица
              </label>
              <input
                id="habit-unit-input"
                data-testid="habit-unit-input"
                type="text"
                maxLength={24}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="раз, мин, стак."
                className="w-full px-3 py-2 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Дни недели</span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setDaysOfWeek(ALL_DAYS)}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Каждый день
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setDaysOfWeek(WEEKDAYS_ONLY)}
                  className="text-slate-600 hover:text-slate-900 hover:underline font-medium cursor-pointer"
                >
                  По будням
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_OPTIONS.map(({ day, label }) => {
                const selected = daysOfWeek.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={selected}
                    className={`h-10 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 mb-2">Цвет</span>
            <div className="flex items-center gap-2.5">
              {COLOR_OPTIONS.map((item) => {
                const active = color === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setColor(item.id)}
                    aria-label={item.label}
                    aria-pressed={active}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${
                      active
                        ? `border-slate-900 ring-2 ${item.ringClass} ring-offset-1`
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-sm ${item.dotClass}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              data-testid="save-habit-button"
              className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
            >
              {habit ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
