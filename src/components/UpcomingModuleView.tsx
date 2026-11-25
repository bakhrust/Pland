import { ArrowLeft, Dumbbell, Wallet } from 'lucide-react';

interface UpcomingModuleViewProps {
  section: 'finance' | 'sport';
  onGoToPlan: () => void;
}

const MODULE_META: Record<
  'finance' | 'sport',
  {
    title: string;
    subtitle: string;
    stage: string;
    points: string[];
    Icon: typeof Wallet;
    accentClass: string;
  }
> = {
  finance: {
    title: 'Учёт финансов',
    subtitle: 'Быстрая фиксация расходов, доходов и личных категорий бюджета.',
    stage: 'Этап 3',
    points: [
      'Добавление траты или дохода с телефона за пару нажатий',
      'Счета, категории, лимиты и наглядная сводка за месяц',
      'Аналитика по расходам без передачи данных сторонним сервисам',
    ],
    Icon: Wallet,
    accentClass: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  sport: {
    title: 'Спорт и тренировки',
    subtitle: 'Дневник тренировок, подходов, весов и личного прогресса.',
    stage: 'Этап 4',
    points: [
      'Готовые программы тренировок и быстрый старт занятия',
      'Запись подходов, повторов, рабочего веса и встроенный таймер отдыха',
      'История тренировок и динамика показателей по неделям',
    ],
    Icon: Dumbbell,
    accentClass: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
};

export function UpcomingModuleView({ section, onGoToPlan }: UpcomingModuleViewProps) {
  const meta = MODULE_META[section];
  const Icon = meta.Icon;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-xs space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${meta.accentClass}`}>
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
          <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {meta.stage}
          </span>
        </div>

        <div className="space-y-1.5">
          <h1 className="font-display text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100">
            {meta.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {meta.subtitle}
          </p>
        </div>

        <ul className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs text-slate-600 dark:text-slate-300">
          {meta.points.map((point) => (
            <li key={point} className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" aria-hidden="true" />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <div className="pt-2">
          <button
            type="button"
            onClick={onGoToPlan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 dark:bg-blue-600 text-white text-xs font-semibold hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Вернуться в «План»</span>
          </button>
        </div>
      </div>
    </div>
  );
}
