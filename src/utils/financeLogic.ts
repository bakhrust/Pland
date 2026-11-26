import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceGoal,
  FinanceTransaction,
  FinanceTransactionKind,
  LabelColor,
} from '../types/planner';
import { pad2, toLocalDateKey } from './dateUtils';
import { clampText } from './urlSafety';

export const FINANCE_ACCOUNT_TYPES: FinanceAccountType[] = ['card', 'cash', 'savings', 'other'];
export const FINANCE_CATEGORY_KINDS: FinanceCategoryKind[] = ['expense', 'income'];
export const FINANCE_TRANSACTION_KINDS: FinanceTransactionKind[] = ['expense', 'income', 'transfer'];

const RUSSIAN_MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const RUSSIAN_MONTHS_SHORT = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

export function getMonthKeyFromDate(date: Date | string = new Date()): string {
  if (typeof date === 'string') {
    const match = /^(\d{4}-\d{2})/.exec(date.trim());
    if (match) return match[1];
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  const now = new Date();
  const baseYear = match ? Number(match[1]) : now.getFullYear();
  const baseMonthIdx = match ? Number(match[2]) - 1 : now.getMonth();
  const shifted = new Date(baseYear, baseMonthIdx + deltaMonths, 1);
  return `${shifted.getFullYear()}-${pad2(shifted.getMonth() + 1)}`;
}

export function formatRussianMonthYear(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const year = Number(match[1]);
  const monthIdx = Math.max(0, Math.min(11, Number(match[2]) - 1));
  return `${RUSSIAN_MONTHS_NOMINATIVE[monthIdx]} ${year}`;
}

export function formatRussianMonthShort(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return monthKey;
  const monthIdx = Math.max(0, Math.min(11, Number(match[2]) - 1));
  return RUSSIAN_MONTHS_SHORT[monthIdx];
}

export function roundMoney(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(val * 100) / 100;
}

export function formatMoneyRUB(
  amount: number,
  options?: { signed?: boolean; hideFraction?: boolean }
): string {
  const safe = roundMoney(amount);
  const abs = Math.abs(safe);
  const hasFraction = !options?.hideFraction && Math.abs(abs - Math.round(abs)) > 0.001;
  const formatted = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(abs);

  if (safe < 0) {
    return `−${formatted} ₽`;
  }
  if (options?.signed && safe > 0) {
    return `+${formatted} ₽`;
  }
  return `${formatted} ₽`;
}

export function computeAccountBalances(
  accounts: FinanceAccount[],
  transactions: FinanceTransaction[]
): {
  balancesById: Map<string, number>;
  totalBalance: number;
} {
  const balancesById = new Map<string, number>();
  for (const acc of accounts) {
    balancesById.set(acc.id, roundMoney(acc.initialBalance));
  }

  for (const tx of transactions) {
    const amt = roundMoney(Math.max(0, tx.amount));
    if (amt <= 0) continue;

    if (tx.kind === 'income') {
      if (balancesById.has(tx.accountId)) {
        balancesById.set(tx.accountId, roundMoney((balancesById.get(tx.accountId) ?? 0) + amt));
      }
    } else if (tx.kind === 'expense') {
      if (balancesById.has(tx.accountId)) {
        balancesById.set(tx.accountId, roundMoney((balancesById.get(tx.accountId) ?? 0) - amt));
      }
    } else if (tx.kind === 'transfer') {
      if (balancesById.has(tx.accountId)) {
        balancesById.set(tx.accountId, roundMoney((balancesById.get(tx.accountId) ?? 0) - amt));
      }
      if (tx.toAccountId && balancesById.has(tx.toAccountId)) {
        balancesById.set(tx.toAccountId, roundMoney((balancesById.get(tx.toAccountId) ?? 0) + amt));
      }
    }
  }

  let totalBalance = 0;
  for (const acc of accounts) {
    totalBalance = roundMoney(totalBalance + (balancesById.get(acc.id) ?? 0));
  }

  return { balancesById, totalBalance };
}

export interface MonthlyFinanceSummary {
  monthKey: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  savingsRatePercent: number;
  totalBudgetLimit: number;
  budgetedExpenseSpent: number;
  budgetRemaining: number;
  budgetUtilizationPercent: number;
  expenseCount: number;
  incomeCount: number;
  overBudgetCategoriesCount: number;
}

export interface CategoryBudgetProgress {
  category: FinanceCategory;
  spent: number;
  limit: number | null;
  remaining: number | null;
  percent: number;
  shareOfTotalExpense: number;
  status: 'ok' | 'warning' | 'over' | 'no-limit';
  transactionsCount: number;
}

export function computeCategoryBudgetProgress(
  categories: FinanceCategory[],
  transactions: FinanceTransaction[],
  monthKey: string
): CategoryBudgetProgress[] {
  const monthExpenses = transactions.filter(
    (tx) => tx.kind === 'expense' && getMonthKeyFromDate(tx.date) === monthKey
  );
  const totalMonthExpense = monthExpenses.reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);

  const spentByCategory = new Map<string, { spent: number; count: number }>();
  for (const tx of monthExpenses) {
    if (!tx.categoryId) continue;
    const prev = spentByCategory.get(tx.categoryId) ?? { spent: 0, count: 0 };
    spentByCategory.set(tx.categoryId, {
      spent: roundMoney(prev.spent + Math.max(0, tx.amount)),
      count: prev.count + 1,
    });
  }

  const expenseCategories = categories
    .filter((cat) => cat.kind === 'expense')
    .sort((a, b) => a.order - b.order);

  return expenseCategories
    .map((category) => {
      const stat = spentByCategory.get(category.id) ?? { spent: 0, count: 0 };
      const limit =
        typeof category.monthlyLimit === 'number' && category.monthlyLimit > 0
          ? roundMoney(category.monthlyLimit)
          : null;
      const remaining = limit !== null ? roundMoney(limit - stat.spent) : null;
      const percent = limit !== null && limit > 0 ? Math.round((stat.spent / limit) * 100) : 0;
      const shareOfTotalExpense =
        totalMonthExpense > 0 ? Math.round((stat.spent / totalMonthExpense) * 100) : 0;

      let status: CategoryBudgetProgress['status'] = 'no-limit';
      if (limit !== null) {
        if (stat.spent > limit) status = 'over';
        else if (percent >= 80) status = 'warning';
        else status = 'ok';
      }

      return {
        category,
        spent: stat.spent,
        limit,
        remaining,
        percent,
        shareOfTotalExpense,
        status,
        transactionsCount: stat.count,
      };
    })
    .sort((a, b) => {
      if (b.spent !== a.spent) return b.spent - a.spent;
      return a.category.order - b.category.order;
    });
}

export function computeMonthlyFinanceSummary(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  monthKey: string
): MonthlyFinanceSummary {
  let totalIncome = 0;
  let totalExpense = 0;
  let expenseCount = 0;
  let incomeCount = 0;

  for (const tx of transactions) {
    if (getMonthKeyFromDate(tx.date) !== monthKey) continue;
    const amt = Math.max(0, tx.amount);
    if (tx.kind === 'income') {
      totalIncome = roundMoney(totalIncome + amt);
      incomeCount += 1;
    } else if (tx.kind === 'expense') {
      totalExpense = roundMoney(totalExpense + amt);
      expenseCount += 1;
    }
  }

  const netCashflow = roundMoney(totalIncome - totalExpense);
  const savingsRatePercent =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  const categoryProgress = computeCategoryBudgetProgress(categories, transactions, monthKey);
  let totalBudgetLimit = 0;
  let budgetedExpenseSpent = 0;
  let overBudgetCategoriesCount = 0;

  for (const item of categoryProgress) {
    if (item.limit !== null) {
      totalBudgetLimit = roundMoney(totalBudgetLimit + item.limit);
      budgetedExpenseSpent = roundMoney(budgetedExpenseSpent + item.spent);
    }
    if (item.status === 'over') {
      overBudgetCategoriesCount += 1;
    }
  }

  const budgetRemaining = roundMoney(totalBudgetLimit - budgetedExpenseSpent);
  const budgetUtilizationPercent =
    totalBudgetLimit > 0 ? Math.round((budgetedExpenseSpent / totalBudgetLimit) * 100) : 0;

  return {
    monthKey,
    totalIncome,
    totalExpense,
    netCashflow,
    savingsRatePercent,
    totalBudgetLimit,
    budgetedExpenseSpent,
    budgetRemaining,
    budgetUtilizationPercent,
    expenseCount,
    incomeCount,
    overBudgetCategoriesCount,
  };
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export function computeMonthlyTrendSeries(
  transactions: FinanceTransaction[],
  referenceMonthKey: string,
  monthsCount = 6
): MonthlyTrendPoint[] {
  const count = Math.max(1, Math.min(24, monthsCount));
  const points: MonthlyTrendPoint[] = [];

  for (let offset = -(count - 1); offset <= 0; offset += 1) {
    const mKey = shiftMonthKey(referenceMonthKey, offset);
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (getMonthKeyFromDate(tx.date) !== mKey) continue;
      if (tx.kind === 'income') income = roundMoney(income + Math.max(0, tx.amount));
      else if (tx.kind === 'expense') expense = roundMoney(expense + Math.max(0, tx.amount));
    }
    points.push({
      monthKey: mKey,
      label: formatRussianMonthShort(mKey),
      income,
      expense,
      net: roundMoney(income - expense),
    });
  }

  return points;
}

export interface DailyExpensePoint {
  day: number;
  dateKey: string;
  label: string;
  expense: number;
  cumulativeExpense: number;
}

export function computeDailyExpenseSeries(
  transactions: FinanceTransaction[],
  monthKey: string
): DailyExpensePoint[] {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return [];
  const year = Number(match[1]);
  const month = Number(match[2]);
  const daysInMonth = new Date(year, month, 0).getDate();

  const dailyTotals = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== 'expense') continue;
    if (getMonthKeyFromDate(tx.date) !== monthKey) continue;
    dailyTotals.set(tx.date, roundMoney((dailyTotals.get(tx.date) ?? 0) + Math.max(0, tx.amount)));
  }

  const points: DailyExpensePoint[] = [];
  let cumulative = 0;
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateKey = `${year}-${pad2(month)}-${pad2(d)}`;
    const expense = dailyTotals.get(dateKey) ?? 0;
    cumulative = roundMoney(cumulative + expense);
    points.push({
      day: d,
      dateKey,
      label: `${pad2(d)}`,
      expense,
      cumulativeExpense: cumulative,
    });
  }
  return points;
}

export interface FinanceTransactionFilters {
  monthKey: string | 'all';
  kind: 'all' | FinanceTransactionKind;
  categoryId: 'all' | string;
  accountId: 'all' | string;
  search: string;
}

export function filterFinanceTransactions(
  transactions: FinanceTransaction[],
  filters: FinanceTransactionFilters,
  categories: FinanceCategory[] = [],
  accounts: FinanceAccount[] = []
): FinanceTransaction[] {
  const q = filters.search.trim().toLowerCase();
  const catById = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
  const accById = new Map(accounts.map((a) => [a.id, a.title.toLowerCase()]));

  return transactions
    .filter((tx) => {
      if (filters.monthKey !== 'all' && getMonthKeyFromDate(tx.date) !== filters.monthKey) {
        return false;
      }
      if (filters.kind !== 'all' && tx.kind !== filters.kind) {
        return false;
      }
      if (filters.categoryId !== 'all' && tx.categoryId !== filters.categoryId) {
        return false;
      }
      if (
        filters.accountId !== 'all' &&
        tx.accountId !== filters.accountId &&
        tx.toAccountId !== filters.accountId
      ) {
        return false;
      }
      if (q) {
        const noteMatch = tx.note.toLowerCase().includes(q);
        const catMatch = tx.categoryId ? (catById.get(tx.categoryId) ?? '').includes(q) : false;
        const accMatch = (accById.get(tx.accountId) ?? '').includes(q);
        const toAccMatch = tx.toAccountId ? (accById.get(tx.toAccountId) ?? '').includes(q) : false;
        const amtMatch = String(tx.amount).includes(q);
        if (!noteMatch && !catMatch && !accMatch && !toAccMatch && !amtMatch) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAtMs - a.createdAtMs;
    });
}

export function getRecurringSuggestionsForMonth(
  transactions: FinanceTransaction[],
  targetMonthKey: string
): FinanceTransaction[] {
  const signature = (tx: FinanceTransaction) =>
    `${tx.kind}::${tx.categoryId ?? ''}::${tx.accountId}::${tx.note.trim().toLowerCase()}`;

  const existingInTarget = new Set<string>();
  for (const tx of transactions) {
    if (getMonthKeyFromDate(tx.date) === targetMonthKey) {
      existingInTarget.add(signature(tx));
    }
  }

  const seenSuggestions = new Set<string>();
  const suggestions: FinanceTransaction[] = [];

  const sorted = [...transactions]
    .filter((tx) => tx.isRecurring && getMonthKeyFromDate(tx.date) !== targetMonthKey)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const tx of sorted) {
    const sig = signature(tx);
    if (existingInTarget.has(sig) || seenSuggestions.has(sig)) continue;
    seenSuggestions.add(sig);
    suggestions.push(tx);
  }

  return suggestions;
}

function escapeCsvCell(raw: string | number): string {
  const str = String(raw);
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[;"\n\r,]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function financeTransactionsToCsv(
  transactions: FinanceTransaction[],
  categories: FinanceCategory[],
  accounts: FinanceAccount[]
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const accMap = new Map(accounts.map((a) => [a.id, a.title]));

  const kindLabel: Record<FinanceTransactionKind, string> = {
    expense: 'Расход',
    income: 'Доход',
    transfer: 'Перевод',
  };

  const rows: string[] = [
    ['Дата', 'Тип', 'Категория', 'Счёт', 'Счёт зачисления', 'Сумма (₽)', 'Комментарий', 'Регулярная']
      .map(escapeCsvCell)
      .join(';'),
  ];

  for (const tx of transactions) {
    const catName =
      tx.kind === 'transfer'
        ? 'Перевод между счетами'
        : tx.categoryId
        ? catMap.get(tx.categoryId) ?? 'Без категории'
        : 'Без категории';
    const accName = accMap.get(tx.accountId) ?? 'Счёт';
    const toAccName = tx.toAccountId ? accMap.get(tx.toAccountId) ?? '' : '';

    rows.push(
      [
        tx.date,
        kindLabel[tx.kind],
        catName,
        accName,
        toAccName,
        tx.kind === 'expense' ? -Math.abs(tx.amount) : tx.amount,
        tx.note,
        tx.isRecurring ? 'Да' : 'Нет',
      ]
        .map(escapeCsvCell)
        .join(';')
    );
  }

  return `\uFEFF${rows.join('\n')}`;
}

export function createFinanceAccount(payload: {
  id?: string;
  title: string;
  type: FinanceAccountType;
  initialBalance: number;
  color: LabelColor;
  order: number;
}): FinanceAccount {
  return {
    id: payload.id || `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: clampText(payload.title.trim() || 'Новый счёт', 80),
    type: FINANCE_ACCOUNT_TYPES.includes(payload.type) ? payload.type : 'card',
    initialBalance: Math.max(-1_000_000_000, Math.min(1_000_000_000, roundMoney(payload.initialBalance))),
    color: payload.color === 'slate' ? 'blue' : payload.color,
    order: Math.max(0, Math.min(1000, Math.round(payload.order))),
  };
}

export function createFinanceCategory(payload: {
  id?: string;
  name: string;
  kind: FinanceCategoryKind;
  monthlyLimit: number | null;
  color: LabelColor;
  order: number;
}): FinanceCategory {
  const validLimit =
    payload.kind === 'expense' &&
    typeof payload.monthlyLimit === 'number' &&
    Number.isFinite(payload.monthlyLimit) &&
    payload.monthlyLimit > 0
      ? Math.min(1_000_000_000, roundMoney(payload.monthlyLimit))
      : null;

  return {
    id: payload.id || `fcat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: clampText(payload.name.trim() || 'Категория', 80),
    kind: payload.kind === 'income' ? 'income' : 'expense',
    monthlyLimit: validLimit,
    color: payload.color === 'slate' ? 'blue' : payload.color,
    order: Math.max(0, Math.min(1000, Math.round(payload.order))),
  };
}

export function createFinanceTransaction(payload: {
  id?: string;
  kind: FinanceTransactionKind;
  amount: number;
  categoryId: string | null;
  accountId: string;
  toAccountId?: string | null;
  date?: string;
  note?: string;
  isRecurring?: boolean;
  createdAtMs?: number;
}): FinanceTransaction {
  const safeKind: FinanceTransactionKind = FINANCE_TRANSACTION_KINDS.includes(payload.kind)
    ? payload.kind
    : 'expense';
  const safeDate =
    payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : toLocalDateKey(new Date());

  return {
    id: payload.id || `ftx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: safeKind,
    amount: Math.max(0.01, Math.min(1_000_000_000, roundMoney(Math.abs(payload.amount) || 0))),
    categoryId: safeKind === 'transfer' ? null : payload.categoryId || null,
    accountId: payload.accountId,
    toAccountId: safeKind === 'transfer' ? payload.toAccountId || null : null,
    date: safeDate,
    note: clampText((payload.note ?? '').trim(), 300),
    isRecurring: Boolean(payload.isRecurring),
    createdAtMs:
      typeof payload.createdAtMs === 'number' && Number.isFinite(payload.createdAtMs)
        ? Math.round(payload.createdAtMs)
        : Date.now(),
  };
}

export function createFinanceGoal(payload: {
  id?: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: LabelColor;
  order: number;
}): FinanceGoal {
  const targetAmount = Math.max(1, Math.min(1_000_000_000, roundMoney(payload.targetAmount || 1)));
  const currentAmount = Math.max(0, Math.min(1_000_000_000, roundMoney(payload.currentAmount || 0)));
  const deadline =
    payload.deadline && /^\d{4}-\d{2}-\d{2}$/.test(payload.deadline) ? payload.deadline : null;

  return {
    id: payload.id || `fgoal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: clampText(payload.title.trim() || 'Финансовая цель', 120),
    targetAmount,
    currentAmount,
    deadline,
    color: payload.color === 'slate' ? 'emerald' : payload.color,
    order: Math.max(0, Math.min(1000, Math.round(payload.order))),
  };
}

export function applyGoalContribution(goal: FinanceGoal, deltaAmount: number): FinanceGoal {
  const next = Math.max(0, Math.min(1_000_000_000, roundMoney(goal.currentAmount + deltaAmount)));
  return {
    ...goal,
    currentAmount: next,
  };
}
