import { Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
  FinanceTransactionKind,
} from '../types/planner';
import { toLocalDateKey } from '../utils/dateUtils';

interface FinanceTransactionModalProps {
  isOpen: boolean;
  transaction: FinanceTransaction | null;
  defaultKind?: FinanceTransactionKind;
  defaultMonthKey?: string;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    kind: FinanceTransactionKind;
    amount: number;
    categoryId: string | null;
    accountId: string;
    toAccountId: string | null;
    date: string;
    note: string;
    isRecurring: boolean;
  }) => void;
  onDelete?: (transactionId: string) => void;
}

export function FinanceTransactionModal({
  isOpen,
  transaction,
  defaultKind = 'expense',
  defaultMonthKey,
  accounts,
  categories,
  onClose,
  onSave,
  onDelete,
}: FinanceTransactionModalProps) {
  const [kind, setKind] = useState<FinanceTransactionKind>(defaultKind);
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [date, setDate] = useState<string>(() => toLocalDateKey(new Date()));
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (transaction) {
      setKind(transaction.kind);
      setAmountStr(String(transaction.amount));
      setCategoryId(transaction.categoryId ?? '');
      setAccountId(transaction.accountId || accounts[0]?.id || '');
      setToAccountId(
        transaction.toAccountId ||
          accounts.find((a) => a.id !== (transaction.accountId || accounts[0]?.id))?.id ||
          ''
      );
      setDate(transaction.date);
      setNote(transaction.note);
      setIsRecurring(transaction.isRecurring);
    } else {
      const nextKind = defaultKind;
      const firstAccount = accounts[0]?.id ?? '';
      const secondAccount = accounts.find((a) => a.id !== firstAccount)?.id ?? '';
      const matchingCats = categories.filter(
        (c) => c.kind === (nextKind === 'income' ? 'income' : 'expense')
      );
      const today = toLocalDateKey(new Date());
      const defaultDate =
        defaultMonthKey && !today.startsWith(defaultMonthKey)
          ? `${defaultMonthKey}-01`
          : today;

      setKind(nextKind);
      setAmountStr('');
      setCategoryId(matchingCats[0]?.id ?? '');
      setAccountId(firstAccount);
      setToAccountId(secondAccount);
      setDate(defaultDate);
      setNote('');
      setIsRecurring(false);
    }
  }, [isOpen, transaction, defaultKind, defaultMonthKey, accounts, categories]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter(
    (c) => c.kind === (kind === 'income' ? 'income' : 'expense')
  );

  const handleChangeKind = (nextKind: FinanceTransactionKind) => {
    setKind(nextKind);
    setError(null);
    if (nextKind !== 'transfer') {
      const matching = categories.filter((c) => c.kind === nextKind);
      if (!matching.some((c) => c.id === categoryId)) {
        setCategoryId(matching[0]?.id ?? '');
      }
    } else if (!toAccountId || toAccountId === accountId) {
      const alt = accounts.find((a) => a.id !== accountId)?.id ?? '';
      setToAccountId(alt);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number(amountStr.replace(/\s+/g, '').replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Введите сумму больше нуля.');
      return;
    }
    if (parsedAmount > 1_000_000_000) {
      setError('Сумма не может превышать 1 000 000 000 ₽.');
      return;
    }
    if (!accountId) {
      setError('Сначала создайте хотя бы один счёт.');
      return;
    }
    if (kind === 'transfer') {
      if (!toAccountId || toAccountId === accountId) {
        setError('Выберите другой счёт для зачисления перевода.');
        return;
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Укажите корректную дату.');
      return;
    }

    onSave({
      id: transaction?.id,
      kind,
      amount: parsedAmount,
      categoryId: kind === 'transfer' ? null : categoryId || null,
      accountId,
      toAccountId: kind === 'transfer' ? toAccountId : null,
      date,
      note: note.trim(),
      isRecurring: kind === 'transfer' ? false : isRecurring,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="finance-tx-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2
            id="finance-tx-modal-title"
            className="text-base font-bold text-slate-900 dark:text-slate-100"
          >
            {transaction ? 'Редактировать операцию' : 'Новая операция'}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Kind Switcher */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(
              [
                { id: 'expense', label: 'Расход', activeCls: 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-xs' },
                { id: 'income', label: 'Доход', activeCls: 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs' },
                { id: 'transfer', label: 'Перевод', activeCls: 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`tx-kind-${item.id}`}
                onClick={() => handleChangeKind(item.id)}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  kind === item.id
                    ? item.activeCls
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label
              htmlFor="tx-amount-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Сумма (₽)
            </label>
            <input
              id="tx-amount-input"
              data-testid="tx-amount-input"
              type="text"
              inputMode="decimal"
              autoFocus
              value={amountStr}
              onChange={(e) => {
                setAmountStr(e.target.value);
                setError(null);
              }}
              placeholder="0"
              className="w-full px-3.5 py-2.5 text-lg font-bold font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:bg-white dark:focus:bg-slate-800"
            />
          </div>

          {/* Account(s) */}
          <div className={kind === 'transfer' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
            <div>
              <label
                htmlFor="tx-account-select"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {kind === 'income' ? 'На счёт' : kind === 'transfer' ? 'Со счёта' : 'Со счёта'}
              </label>
              <select
                id="tx-account-select"
                data-testid="tx-account-select"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.title}
                  </option>
                ))}
              </select>
            </div>

            {kind === 'transfer' && (
              <div>
                <label
                  htmlFor="tx-to-account-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  На счёт
                </label>
                <select
                  id="tx-to-account-select"
                  data-testid="tx-to-account-select"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                >
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.title}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Category + Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {kind !== 'transfer' && (
              <div>
                <label
                  htmlFor="tx-category-select"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Категория
                </label>
                <select
                  id="tx-category-select"
                  data-testid="tx-category-select"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
                >
                  <option value="">Без категории</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={kind === 'transfer' ? 'sm:col-span-2' : ''}>
              <label
                htmlFor="tx-date-input"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Дата
              </label>
              <input
                id="tx-date-input"
                data-testid="tx-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-mono tabular-nums bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label
              htmlFor="tx-note-input"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Комментарий
            </label>
            <input
              id="tx-note-input"
              data-testid="tx-note-input"
              type="text"
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Например: Продукты в супермаркете"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Recurring checkbox */}
          {kind !== 'transfer' && (
            <label className="flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span>Регулярная операция (повторять каждый месяц)</span>
            </label>
          )}

          {error && (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            {transaction && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(transaction.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
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
                className="px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Отмена
              </button>
              <button
                type="submit"
                data-testid="tx-save-button"
                className="px-4 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                {transaction ? 'Сохранить' : 'Добавить'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
