import { RotateCcw, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceCurrency,
  FinanceGoal,
  LabelColor,
} from '../types/planner';
import {
  DEFAULT_FINANCE_CURRENCY,
  DEFAULT_FINANCE_RATES,
  FINANCE_CURRENCIES,
  convertMoney,
  getCurrencyMeta,
  sanitizeFinanceCurrency,
  sanitizeFinanceRates,
} from '../utils/financeLogic';

const COLOR_OPTIONS: { id: LabelColor; label: string; dotCls: string }[] = [
  { id: 'blue', label: 'Синий', dotCls: 'bg-blue-600' },
  { id: 'emerald', label: 'Зелёный', dotCls: 'bg-emerald-600' },
  { id: 'violet', label: 'Фиолетовый', dotCls: 'bg-violet-600' },
  { id: 'amber', label: 'Янтарный', dotCls: 'bg-amber-500' },
  { id: 'rose', label: 'Коралловый', dotCls: 'bg-rose-600' },
];

/* ----------------- Category Modal ----------------- */
interface FinanceCategoryModalProps {
  isOpen: boolean;
  category: FinanceCategory | null;
  currency?: FinanceCurrency;
  defaultKind?: FinanceCategoryKind;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    name: string;
    kind: FinanceCategoryKind;
    monthlyLimit: number | null;
    color: LabelColor;
  }) => void;
  onDelete?: (categoryId: string) => void;
}

export function FinanceCategoryModal({
  isOpen,
  category,
  currency = DEFAULT_FINANCE_CURRENCY,
  defaultKind = 'expense',
  onClose,
  onSave,
  onDelete,
}: FinanceCategoryModalProps) {
  const currencySymbol = getCurrencyMeta(currency).symbol;
  const [name, setName] = useState('');
  const [kind, setKind] = useState<FinanceCategoryKind>(defaultKind);
  const [limitStr, setLimitStr] = useState('');
  const [color, setColor] = useState<LabelColor>('emerald');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (category) {
      setName(category.name);
      setKind(category.kind);
      setLimitStr(category.monthlyLimit ? String(category.monthlyLimit) : '');
      setColor(category.color === 'slate' ? 'blue' : category.color);
    } else {
      setName('');
      setKind(defaultKind);
      setLimitStr('');
      setColor(defaultKind === 'income' ? 'emerald' : 'blue');
    }
  }, [isOpen, category, defaultKind]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Введите название категории.');
      return;
    }
    let monthlyLimit: number | null = null;
    if (kind === 'expense' && limitStr.trim()) {
      const num = Number(limitStr.replace(/\s+/g, '').replace(',', '.'));
      if (!Number.isFinite(num) || num <= 0) {
        setError('Лимит должен быть положительным числом.');
        return;
      }
      monthlyLimit = Math.min(1_000_000_000, Math.round(num * 100) / 100);
    }

    onSave({
      id: category?.id,
      name: cleanName,
      kind,
      monthlyLimit,
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-cat-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="finance-cat-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            {category ? 'Настроить категорию' : 'Новая категория'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setKind('expense')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                kind === 'expense'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Расход
            </button>
            <button
              type="button"
              onClick={() => setKind('income')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                kind === 'income'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Доход
            </button>
          </div>

          <div>
            <label htmlFor="fcat-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Название
            </label>
            <input
              id="fcat-name"
              data-testid="fcat-name-input"
              type="text"
              maxLength={80}
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="Например: Продукты"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          {kind === 'expense' && (
            <div>
              <label htmlFor="fcat-limit" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Месячный лимит ({currencySymbol}, необязательно)
              </label>
              <input
                id="fcat-limit"
                data-testid="fcat-limit-input"
                type="text"
                inputMode="decimal"
                value={limitStr}
                onChange={(e) => {
                  setLimitStr(e.target.value);
                  setError(null);
                }}
                placeholder="Без лимита"
                className="w-full px-3.5 py-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
          )}

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Цвет
            </span>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setColor(opt.id)}
                  aria-label={opt.label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 cursor-pointer transition-transform ${
                    color === opt.id ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${opt.dotCls}`} />
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {category && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(category.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                data-testid="fcat-save-button"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ----------------- Account Modal ----------------- */
interface FinanceAccountModalProps {
  isOpen: boolean;
  account: FinanceAccount | null;
  currency?: FinanceCurrency;
  canDelete: boolean;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    title: string;
    type: FinanceAccountType;
    currency: FinanceCurrency;
    initialBalance: number;
    color: LabelColor;
  }) => void;
  onDelete?: (accountId: string) => void;
}

export function FinanceAccountModal({
  isOpen,
  account,
  currency = DEFAULT_FINANCE_CURRENCY,
  canDelete,
  onClose,
  onSave,
  onDelete,
}: FinanceAccountModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<FinanceAccountType>('card');
  const [accCurrency, setAccCurrency] = useState<FinanceCurrency>(currency);
  const [initialBalanceStr, setInitialBalanceStr] = useState('0');
  const [color, setColor] = useState<LabelColor>('blue');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (account) {
      setTitle(account.title);
      setType(account.type);
      setAccCurrency(sanitizeFinanceCurrency(account.currency));
      setInitialBalanceStr(String(account.initialBalance));
      setColor(account.color === 'slate' ? 'blue' : account.color);
    } else {
      setTitle('');
      setType('card');
      setAccCurrency(sanitizeFinanceCurrency(currency));
      setInitialBalanceStr('0');
      setColor('blue');
    }
  }, [isOpen, account, currency]);

  if (!isOpen) return null;

  const accCurrencySymbol = getCurrencyMeta(accCurrency).symbol;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Введите название счёта.');
      return;
    }
    const num = Number((initialBalanceStr || '0').replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(num) || Math.abs(num) > 1_000_000_000) {
      setError('Укажите корректный начальный баланс.');
      return;
    }

    onSave({
      id: account?.id,
      title: cleanTitle,
      type,
      currency: accCurrency,
      initialBalance: num,
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-acc-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="finance-acc-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            {account ? 'Редактировать счёт' : 'Новый счёт'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="facc-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Название счёта
            </label>
            <input
              id="facc-title"
              data-testid="facc-title-input"
              type="text"
              maxLength={80}
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="Например: Наличные USD или Сбер"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="facc-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Тип счёта
              </label>
              <select
                id="facc-type"
                value={type}
                onChange={(e) => setType(e.target.value as FinanceAccountType)}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              >
                <option value="card">Банковская карта</option>
                <option value="cash">Наличные</option>
                <option value="savings">Накопительный / вклад</option>
                <option value="other">Другое</option>
              </select>
            </div>

            <div>
              <label htmlFor="facc-currency" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Валюта счёта
              </label>
              <select
                id="facc-currency"
                data-testid="facc-currency-select"
                value={accCurrency}
                onChange={(e) => setAccCurrency(e.target.value as FinanceCurrency)}
                className="w-full px-3 py-2.5 text-xs font-mono font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              >
                {FINANCE_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} · {c.code} — {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="facc-balance" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Начальный остаток ({accCurrencySymbol})
            </label>
            <input
              id="facc-balance"
              data-testid="facc-balance-input"
              type="text"
              inputMode="decimal"
              value={initialBalanceStr}
              onChange={(e) => {
                setInitialBalanceStr(e.target.value);
                setError(null);
              }}
              className="w-full px-3.5 py-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Цвет
            </span>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setColor(opt.id)}
                  aria-label={opt.label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 cursor-pointer transition-transform ${
                    color === opt.id ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${opt.dotCls}`} />
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {account && canDelete && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(account.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                data-testid="facc-save-button"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ----------------- Goal Modal ----------------- */
interface FinanceGoalModalProps {
  isOpen: boolean;
  goal: FinanceGoal | null;
  currency?: FinanceCurrency;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string | null;
    color: LabelColor;
  }) => void;
  onDelete?: (goalId: string) => void;
}

export function FinanceGoalModal({
  isOpen,
  goal,
  currency = DEFAULT_FINANCE_CURRENCY,
  onClose,
  onSave,
  onDelete,
}: FinanceGoalModalProps) {
  const currencySymbol = getCurrencyMeta(currency).symbol;
  const [title, setTitle] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [currentStr, setCurrentStr] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState<LabelColor>('emerald');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (goal) {
      setTitle(goal.title);
      setTargetStr(String(goal.targetAmount));
      setCurrentStr(String(goal.currentAmount));
      setDeadline(goal.deadline ?? '');
      setColor(goal.color === 'slate' ? 'emerald' : goal.color);
    } else {
      setTitle('');
      setTargetStr('');
      setCurrentStr('0');
      setDeadline('');
      setColor('emerald');
    }
  }, [isOpen, goal]);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Введите название цели.');
      return;
    }
    const targetNum = Number(targetStr.replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(targetNum) || targetNum <= 0) {
      setError('Целевая сумма должна быть больше нуля.');
      return;
    }
    const currentNum = Number((currentStr || '0').replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(currentNum) || currentNum < 0) {
      setError('Накопленная сумма не может быть отрицательной.');
      return;
    }

    onSave({
      id: goal?.id,
      title: cleanTitle,
      targetAmount: targetNum,
      currentAmount: currentNum,
      deadline: deadline && /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? deadline : null,
      color,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-goal-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 id="finance-goal-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
            {goal ? 'Редактировать цель' : 'Новая финансовая цель'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="fgoal-title" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Название цели
            </label>
            <input
              id="fgoal-title"
              data-testid="fgoal-title-input"
              type="text"
              maxLength={120}
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="Например: Ноутбук или Подушка безопасности"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="fgoal-target" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Цель ({currencySymbol})
              </label>
              <input
                id="fgoal-target"
                data-testid="fgoal-target-input"
                type="text"
                inputMode="decimal"
                value={targetStr}
                onChange={(e) => {
                  setTargetStr(e.target.value);
                  setError(null);
                }}
                placeholder="100000"
                className="w-full px-3.5 py-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="fgoal-current" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Уже отложено ({currencySymbol})
              </label>
              <input
                id="fgoal-current"
                data-testid="fgoal-current-input"
                type="text"
                inputMode="decimal"
                value={currentStr}
                onChange={(e) => {
                  setCurrentStr(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="fgoal-deadline" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Срок (необязательно)
            </label>
            <input
              id="fgoal-deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Цвет
            </span>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setColor(opt.id)}
                  aria-label={opt.label}
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 cursor-pointer transition-transform ${
                    color === opt.id ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full ${opt.dotCls}`} />
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {goal && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(goal.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить</span>
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                data-testid="fgoal-save-button"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ----------------- Exchange Rates Modal ----------------- */
interface FinanceRatesModalProps {
  isOpen: boolean;
  rates: Record<FinanceCurrency, number>;
  baseCurrency: FinanceCurrency;
  onClose: () => void;
  onSave: (rates: Record<FinanceCurrency, number>) => void;
}

export function FinanceRatesModal({
  isOpen,
  rates,
  baseCurrency,
  onClose,
  onSave,
}: FinanceRatesModalProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const next: Record<string, string> = {};
    for (const meta of FINANCE_CURRENCIES) {
      if (meta.code === 'RUB') continue;
      next[meta.code] = String(rates[meta.code] ?? DEFAULT_FINANCE_RATES[meta.code]);
    }
    setDraft(next);
  }, [isOpen, rates]);

  if (!isOpen) return null;

  const baseMeta = getCurrencyMeta(baseCurrency);

  const handleReset = () => {
    setError(null);
    const next: Record<string, string> = {};
    for (const meta of FINANCE_CURRENCIES) {
      if (meta.code === 'RUB') continue;
      next[meta.code] = String(DEFAULT_FINANCE_RATES[meta.code]);
    }
    setDraft(next);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const numeric: Partial<Record<FinanceCurrency, number>> = { RUB: 1 };
    for (const meta of FINANCE_CURRENCIES) {
      if (meta.code === 'RUB') continue;
      const val = Number((draft[meta.code] ?? '').replace(/\s+/g, '').replace(',', '.'));
      if (!Number.isFinite(val) || val <= 0 || val > 1_000_000) {
        setError(`Укажите корректный положительный курс для ${meta.code}.`);
        return;
      }
      numeric[meta.code] = val;
    }
    onSave(sanitizeFinanceRates(numeric));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-rates-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[90dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="finance-rates-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              Курсы валют
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Используются для пересчёта счетов и операций в {baseMeta.code} ({baseMeta.symbol})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {FINANCE_CURRENCIES.filter((m) => m.code !== 'RUB').map((meta) => {
              const rawVal = Number((draft[meta.code] ?? '').replace(/\s+/g, '').replace(',', '.'));
              const previewCross =
                baseCurrency !== 'RUB' &&
                baseCurrency !== meta.code &&
                Number.isFinite(rawVal) &&
                rawVal > 0
                  ? convertMoney(1, meta.code, baseCurrency, {
                      ...rates,
                      [meta.code]: rawVal,
                    })
                  : null;

              return (
                <div
                  key={meta.code}
                  className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label
                      htmlFor={`frate-${meta.code}`}
                      className="text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      1 {meta.code} ({meta.symbol})
                    </label>
                    <span className="text-[11px] text-slate-400 truncate">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      id={`frate-${meta.code}`}
                      data-testid={`frate-input-${meta.code}`}
                      type="text"
                      inputMode="decimal"
                      value={draft[meta.code] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDraft((prev) => ({ ...prev, [meta.code]: val }));
                        setError(null);
                      }}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                    />
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      ₽
                    </span>
                  </div>
                  {previewCross !== null && (
                    <p className="mt-1 text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      ≈ {previewCross} {baseMeta.symbol}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                data-testid="frates-save-button"
                className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
              >
                Сохранить
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
