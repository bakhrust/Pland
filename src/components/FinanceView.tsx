import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
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
import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceCurrency,
  FinanceGoal,
  FinanceTransaction,
  FinanceTransactionKind,
  LabelColor,
} from '../types/planner';
import { formatRussianShortDate, parseFlexibleDate, toLocalDateKey } from '../utils/dateUtils';
import {
  FINANCE_CURRENCIES,
  computeAccountBalances,
  computeCategoryBudgetProgress,
  computeDailyExpenseSeries,
  computeMonthlyFinanceSummary,
  computeMonthlyTrendSeries,
  filterFinanceTransactions,
  financeTransactionsToCsv,
  formatMoney,
  formatRussianMonthYear,
  getMonthKeyFromDate,
  getRecurringSuggestionsForMonth,
  shiftMonthKey,
} from '../utils/financeLogic';
import {
  FinanceAccountModal,
  FinanceCategoryModal,
  FinanceGoalModal,
} from './FinanceManageModals';
import { FinanceTransactionModal } from './FinanceTransactionModal';

type FinanceTab = 'overview' | 'budgets' | 'accounts';
type ChartMode = 'trend' | 'daily';

interface FinanceViewProps {
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  transactions: FinanceTransaction[];
  goals: FinanceGoal[];
  currency: FinanceCurrency;
  onChangeCurrency: (currency: FinanceCurrency) => void;
  onSaveTransaction: (payload: {
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
  onDeleteTransaction: (transactionId: string) => void;
  onSaveCategory: (payload: {
    id?: string;
    name: string;
    kind: FinanceCategoryKind;
    monthlyLimit: number | null;
    color: LabelColor;
  }) => void;
  onDeleteCategory: (categoryId: string) => void;
  onSaveAccount: (payload: {
    id?: string;
    title: string;
    type: FinanceAccountType;
    initialBalance: number;
    color: LabelColor;
  }) => void;
  onDeleteAccount: (accountId: string) => void;
  onSaveGoal: (payload: {
    id?: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string | null;
    color: LabelColor;
  }) => void;
  onDeleteGoal: (goalId: string) => void;
  onContributeGoal: (goalId: string, deltaAmount: number) => void;
  onSeedStarterFinance: () => void;
}

const COLOR_DOT: Record<LabelColor, string> = {
  blue: 'bg-blue-600',
  emerald: 'bg-emerald-600',
  violet: 'bg-violet-600',
  amber: 'bg-amber-500',
  rose: 'bg-rose-600',
  slate: 'bg-slate-600',
};

const COLOR_BAR: Record<LabelColor, string> = {
  blue: 'bg-blue-600 dark:bg-blue-500',
  emerald: 'bg-emerald-600 dark:bg-emerald-500',
  violet: 'bg-violet-600 dark:bg-violet-500',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-600 dark:bg-rose-500',
  slate: 'bg-slate-600 dark:bg-slate-400',
};

const ACCOUNT_TYPE_LABELS: Record<FinanceAccountType, string> = {
  card: 'Карта',
  cash: 'Наличные',
  savings: 'Накопления',
  other: 'Счёт',
};

function AccountTypeIcon({ type }: { type: FinanceAccountType }) {
  if (type === 'cash') return <Banknote className="w-4 h-4" aria-hidden="true" />;
  if (type === 'savings') return <PiggyBank className="w-4 h-4" aria-hidden="true" />;
  if (type === 'other') return <Landmark className="w-4 h-4" aria-hidden="true" />;
  return <CreditCard className="w-4 h-4" aria-hidden="true" />;
}

export function FinanceView({
  accounts,
  categories,
  transactions,
  goals,
  currency,
  onChangeCurrency,
  onSaveTransaction,
  onDeleteTransaction,
  onSaveCategory,
  onDeleteCategory,
  onSaveAccount,
  onDeleteAccount,
  onSaveGoal,
  onDeleteGoal,
  onContributeGoal,
  onSeedStarterFinance,
}: FinanceViewProps) {
  const fmt = (amount: number, opts?: { signed?: boolean; hideFraction?: boolean }) =>
    formatMoney(amount, { ...opts, currency });
  const currentMonthKey = useMemo(() => getMonthKeyFromDate(new Date()), []);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview');
  const [chartMode, setChartMode] = useState<ChartMode>('trend');

  // Transaction filters
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | FinanceTransactionKind>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [scopeAllMonths, setScopeAllMonths] = useState(false);

  // Modals state
  const [txModal, setTxModal] = useState<{
    isOpen: boolean;
    transaction: FinanceTransaction | null;
    defaultKind: FinanceTransactionKind;
  }>({ isOpen: false, transaction: null, defaultKind: 'expense' });

  const [catModal, setCatModal] = useState<{
    isOpen: boolean;
    category: FinanceCategory | null;
    defaultKind: FinanceCategoryKind;
  }>({ isOpen: false, category: null, defaultKind: 'expense' });

  const [accModal, setAccModal] = useState<{
    isOpen: boolean;
    account: FinanceAccount | null;
  }>({ isOpen: false, account: null });

  const [goalModal, setGoalModal] = useState<{
    isOpen: boolean;
    goal: FinanceGoal | null;
  }>({ isOpen: false, goal: null });

  const accountBalances = useMemo(
    () => computeAccountBalances(accounts, transactions),
    [accounts, transactions]
  );

  const monthlySummary = useMemo(
    () => computeMonthlyFinanceSummary(transactions, categories, selectedMonth),
    [transactions, categories, selectedMonth]
  );

  const categoryProgress = useMemo(
    () => computeCategoryBudgetProgress(categories, transactions, selectedMonth),
    [categories, transactions, selectedMonth]
  );

  const incomeCategoriesSummary = useMemo(() => {
    const monthIncomes = transactions.filter(
      (t) => t.kind === 'income' && getMonthKeyFromDate(t.date) === selectedMonth
    );
    return categories
      .filter((c) => c.kind === 'income')
      .map((cat) => {
        const received = monthIncomes
          .filter((t) => t.categoryId === cat.id)
          .reduce((sum, t) => sum + t.amount, 0);
        return { category: cat, received };
      });
  }, [categories, transactions, selectedMonth]);

  const trendSeries = useMemo(
    () => computeMonthlyTrendSeries(transactions, selectedMonth, 6),
    [transactions, selectedMonth]
  );

  const dailySeries = useMemo(
    () => computeDailyExpenseSeries(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const recurringSuggestions = useMemo(
    () => getRecurringSuggestionsForMonth(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const filteredTransactions = useMemo(
    () =>
      filterFinanceTransactions(
        transactions,
        {
          monthKey: scopeAllMonths ? 'all' : selectedMonth,
          kind: kindFilter,
          categoryId: categoryFilter,
          accountId: accountFilter,
          search,
        },
        categories,
        accounts
      ),
    [
      transactions,
      scopeAllMonths,
      selectedMonth,
      kindFilter,
      categoryFilter,
      accountFilter,
      search,
      categories,
      accounts,
    ]
  );

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const accountById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const handleExportCsv = () => {
    const csv = financeTransactionsToCsv(filteredTransactions, categories, accounts, currency);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rst-finance-${scopeAllMonths ? 'all' : selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleApplyRecurring = (template: FinanceTransaction) => {
    const targetDay = template.date.slice(8, 10) || '05';
    const [yStr, mStr] = selectedMonth.split('-');
    const maxDay = new Date(Number(yStr), Number(mStr), 0).getDate();
    const clampedDay = String(Math.min(maxDay, Math.max(1, Number(targetDay)))).padStart(2, '0');
    const dateKey =
      selectedMonth === currentMonthKey
        ? toLocalDateKey(new Date())
        : `${selectedMonth}-${clampedDay}`;

    onSaveTransaction({
      kind: template.kind,
      amount: template.amount,
      categoryId: template.categoryId,
      accountId: template.accountId,
      toAccountId: template.toAccountId,
      date: dateKey,
      note: template.note,
      isRecurring: true,
    });
  };

  const isEmptyState =
    accounts.length === 0 && categories.length === 0 && transactions.length === 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="max-w-6xl mx-auto px-3.5 md:px-6 pt-4 md:pt-7 pb-24 md:pb-24 space-y-4 md:space-y-5">
        {/* Header & Month Controls */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-lg md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Финансы и бюджет
            </h1>
            <p className="hidden sm:block text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Контроль доходов, расходов, месячных лимитов по категориям и личных целей
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Month Switcher */}
            <div className="inline-flex items-center border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden">
              <button
                type="button"
                data-testid="finance-prev-month"
                onClick={() => setSelectedMonth((m) => shiftMonthKey(m, -1))}
                aria-label="Предыдущий месяц"
                className="w-9 h-9 md:h-10 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth(currentMonthKey)}
                title="Перейти к текущему месяцу"
                className="px-3 h-9 md:h-10 text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-x border-slate-200 dark:border-slate-800 whitespace-nowrap cursor-pointer"
              >
                {formatRussianMonthYear(selectedMonth)}
              </button>
              <button
                type="button"
                data-testid="finance-next-month"
                onClick={() => setSelectedMonth((m) => shiftMonthKey(m, 1))}
                aria-label="Следующий месяц"
                className="w-9 h-9 md:h-10 inline-flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Sub-tabs */}
            <nav
              aria-label="Подразделы финансов"
              className="inline-flex items-center bg-slate-200/70 dark:bg-slate-800 p-0.5 rounded-xl"
            >
              {(
                [
                  { id: 'overview', label: 'Обзор и операции' },
                  { id: 'budgets', label: 'Лимиты бюджета' },
                  { id: 'accounts', label: 'Счета и цели' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`finance-tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Currency Switcher */}
            <select
              data-testid="finance-currency-select"
              aria-label="Валюта учёта"
              value={currency}
              onChange={(e) => onChangeCurrency(e.target.value as FinanceCurrency)}
              className="h-9 md:h-10 px-2.5 text-xs font-semibold font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-600 cursor-pointer"
            >
              {FINANCE_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} · {c.code}
                </option>
              ))}
            </select>
          </div>
        </header>

        {isEmptyState ? (
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center space-y-3">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Начните вести личный бюджет
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Создайте свой первый счёт и категории расходов или загрузите готовый шаблон бюджета
              с основными счетами, категориями и лимитами.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAccModal({ isOpen: true, account: null })}
                className="px-4 py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Создать счёт
              </button>
              <button
                type="button"
                onClick={onSeedStarterFinance}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded-lg cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Добавить шаблон бюджета</span>
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* KPI Summary Strip */}
            <section
              aria-label="Финансовая сводка"
              className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-3.5"
            >
              {/* KPI 1: Total Balance */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 md:p-4 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">Общий баланс</span>
                  <Wallet className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                </div>
                <div
                  data-testid="kpi-total-balance"
                  className="mt-1.5 text-base md:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 truncate"
                >
                  {fmt(accountBalances.totalBalance)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                  На {accounts.length} {accounts.length === 1 ? 'счёте' : 'счетах'}
                </div>
              </div>

              {/* KPI 2: Month Income */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 md:p-4 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">Доходы за месяц</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                </div>
                <div
                  data-testid="kpi-month-income"
                  className="mt-1.5 text-base md:text-xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 truncate"
                >
                  {fmt(monthlySummary.totalIncome, { signed: monthlySummary.totalIncome > 0 })}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                  Поступлений: {monthlySummary.incomeCount}
                </div>
              </div>

              {/* KPI 3: Month Expense */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 md:p-4 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">Расходы за месяц</span>
                  <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
                </div>
                <div
                  data-testid="kpi-month-expense"
                  className="mt-1.5 text-base md:text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 truncate"
                >
                  {fmt(monthlySummary.totalExpense)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                  {monthlySummary.totalBudgetLimit > 0
                    ? `Лимит: ${monthlySummary.budgetUtilizationPercent}% от ${fmt(monthlySummary.totalBudgetLimit)}`
                    : `Трат: ${monthlySummary.expenseCount}`}
                </div>
              </div>

              {/* KPI 4: Net Cashflow & Savings Rate */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 md:p-4 min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">Свободный остаток</span>
                  <ArrowUpRight
                    className={`w-4 h-4 shrink-0 ${
                      monthlySummary.netCashflow >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <div
                  data-testid="kpi-net-cashflow"
                  className={`mt-1.5 text-base md:text-xl font-bold font-mono tabular-nums truncate ${
                    monthlySummary.netCashflow >= 0
                      ? 'text-slate-900 dark:text-slate-100'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {fmt(monthlySummary.netCashflow, { signed: true })}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                  {monthlySummary.totalIncome > 0
                    ? `Норма сбережений: ${monthlySummary.savingsRatePercent}%`
                    : 'Добавьте доход для расчёта'}
                </div>
              </div>
            </section>

            {/* TAB 1: OVERVIEW & TRANSACTIONS */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Recurring Reminders */}
                {recurringSuggestions.length > 0 && (
                  <section
                    aria-label="Регулярные платежи к проведению"
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 md:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200 min-w-0">
                      <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" aria-hidden="true" />
                      <span className="font-semibold">
                        Регулярные операции в {formatRussianMonthYear(selectedMonth)}:
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 hidden md:inline">
                        ещё не проведены в этом месяце
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {recurringSuggestions.slice(0, 3).map((tpl) => {
                        const cat = tpl.categoryId ? categoryById.get(tpl.categoryId) : null;
                        const label = tpl.note || cat?.name || 'Регулярный платёж';
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => handleApplyRecurring(tpl)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-300 dark:hover:border-blue-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            <span className="truncate max-w-[140px]">{label}</span>
                            <span className="font-mono tabular-nums font-semibold">
                              {fmt(tpl.amount)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Charts + Category Budget Snapshot */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Chart Card */}
                  <section className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div>
                        <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                          {chartMode === 'trend'
                            ? 'Доходы и расходы по месяцам'
                            : `Траты по дням · ${formatRussianMonthYear(selectedMonth)}`}
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {chartMode === 'trend'
                            ? 'Сравнение денежного потока за последние 6 месяцев'
                            : 'Накопительный расход за выбранный месяц'}
                        </p>
                      </div>

                      <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setChartMode('trend')}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                            chartMode === 'trend'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          6 месяцев
                        </button>
                        <button
                          type="button"
                          onClick={() => setChartMode('daily')}
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                            chartMode === 'daily'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          По дням
                        </button>
                      </div>
                    </div>

                    <div className="h-60 md:h-64 w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartMode === 'trend' ? (
                          <BarChart
                            data={trendSeries}
                            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              className="stroke-slate-200 dark:stroke-slate-800"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                              className="text-slate-500 dark:text-slate-400 fill-current"
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(val: number) =>
                                val >= 1000 ? `${Math.round(val / 1000)}к` : String(val)
                              }
                              className="text-slate-500 dark:text-slate-400 fill-current"
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const pt = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 text-xs rounded-lg p-2.5 shadow-lg space-y-1">
                                      <p className="font-semibold">
                                        {formatRussianMonthYear(pt.monthKey)}
                                      </p>
                                      <p className="font-mono tabular-nums text-emerald-400">
                                        Доходы: {fmt(pt.income)}
                                      </p>
                                      <p className="font-mono tabular-nums text-rose-400">
                                        Расходы: {fmt(pt.expense)}
                                      </p>
                                      <p className="font-mono tabular-nums text-slate-300 border-t border-slate-700 pt-1">
                                        Итог: {fmt(pt.net, { signed: true })}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="income" name="Доходы" fill="#16a34a" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Расходы" fill="#e11d48" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        ) : (
                          <AreaChart
                            data={dailySeries}
                            margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                          >
                            <defs>
                              <linearGradient id="finDailyExpense" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              className="stroke-slate-200 dark:stroke-slate-800"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                              interval={4}
                              className="text-slate-500 dark:text-slate-400 fill-current"
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11 }}
                              tickFormatter={(val: number) =>
                                val >= 1000 ? `${Math.round(val / 1000)}к` : String(val)
                              }
                              className="text-slate-500 dark:text-slate-400 fill-current"
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const pt = payload[0].payload;
                                  return (
                                    <div className="bg-slate-900 text-white dark:bg-slate-800 border border-slate-700 text-xs rounded-lg p-2.5 shadow-lg space-y-1">
                                      <p className="font-semibold font-mono tabular-nums">{pt.dateKey}</p>
                                      <p className="font-mono tabular-nums">
                                        За день: {fmt(pt.expense)}
                                      </p>
                                      <p className="font-mono tabular-nums text-blue-300">
                                        Накопительно: {fmt(pt.cumulativeExpense)}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="cumulativeExpense"
                              stroke="#2563eb"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#finDailyExpense)"
                            />
                          </AreaChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </section>

                  {/* Category Budget Snapshot */}
                  <section className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                          Расходы по категориям
                        </h2>
                        <button
                          type="button"
                          onClick={() => setActiveTab('budgets')}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Лимиты →
                        </button>
                      </div>

                      {categoryProgress.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                          Нет категорий расходов. Добавьте категорию во вкладке «Лимиты бюджета».
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {categoryProgress.slice(0, 5).map((item) => {
                            const barWidth =
                              item.limit !== null
                                ? Math.min(100, item.percent)
                                : Math.min(100, item.shareOfTotalExpense);
                            const barCls =
                              item.status === 'over'
                                ? 'bg-rose-600'
                                : item.status === 'warning'
                                ? 'bg-amber-500'
                                : COLOR_BAR[item.category.color] ?? 'bg-blue-600';

                            return (
                              <div key={item.category.id} className="space-y-1">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span
                                      className={`w-2 h-2 rounded-full shrink-0 ${
                                        COLOR_DOT[item.category.color] ?? 'bg-blue-600'
                                      }`}
                                    />
                                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                      {item.category.name}
                                    </span>
                                  </div>
                                  <div className="font-mono tabular-nums shrink-0 text-right">
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                                      {fmt(item.spent)}
                                    </span>
                                    {item.limit !== null && (
                                      <span className="text-slate-400 dark:text-slate-500">
                                        {' '}
                                        / {fmt(item.limit)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${barCls}`}
                                    style={{ width: `${barWidth}%` }}
                                  />
                                </div>

                                {item.status === 'over' && item.remaining !== null && (
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 tabular-nums">
                                    <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    <span>
                                      Превышение на {fmt(Math.abs(item.remaining))}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Быстрое добавление</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setTxModal({ isOpen: true, transaction: null, defaultKind: 'income' })
                          }
                          className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          + Доход
                        </button>
                        <span aria-hidden="true">·</span>
                        <button
                          type="button"
                          onClick={() =>
                            setTxModal({ isOpen: true, transaction: null, defaultKind: 'transfer' })
                          }
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Перевод
                        </button>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Transactions Ledger */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-3.5 md:p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                          История операций
                        </h2>
                        <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          ({filteredTransactions.length})
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setScopeAllMonths((v) => !v)}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                            scopeAllMonths
                              ? 'bg-slate-900 dark:bg-blue-600 text-white border-slate-900 dark:border-blue-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {scopeAllMonths ? 'За всё время' : formatRussianMonthYear(selectedMonth)}
                        </button>
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          disabled={filteredTransactions.length === 0}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                      <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg overflow-x-auto">
                        {(
                          [
                            { id: 'all', label: 'Все' },
                            { id: 'expense', label: 'Расходы' },
                            { id: 'income', label: 'Доходы' },
                            { id: 'transfer', label: 'Переводы' },
                          ] as const
                        ).map((k) => (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => setKindFilter(k.id)}
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
                              kindFilter === k.id
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 flex-1">
                        <select
                          aria-label="Фильтр по категории"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                        >
                          <option value="all">Все категории</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label="Фильтр по счёту"
                          value={accountFilter}
                          onChange={(e) => setAccountFilter(e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600"
                        >
                          <option value="all">Все счета</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title}
                            </option>
                          ))}
                        </select>

                        <div className="col-span-2 sm:flex-1 relative">
                          <Search
                            className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                            aria-hidden="true"
                          />
                          <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Поиск по комментарию, категории или сумме..."
                            aria-label="Поиск операций"
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {filteredTransactions.length === 0 ? (
                    <div className="p-8 text-center space-y-2.5">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Операций за выбранный период нет
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setTxModal({ isOpen: true, transaction: null, defaultKind: 'expense' })
                          }
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          + Добавить операцию
                        </button>
                        {(kindFilter !== 'all' ||
                          categoryFilter !== 'all' ||
                          accountFilter !== 'all' ||
                          search) && (
                          <button
                            type="button"
                            onClick={() => {
                              setKindFilter('all');
                              setCategoryFilter('all');
                              setAccountFilter('all');
                              setSearch('');
                            }}
                            className="text-xs font-medium text-slate-500 hover:underline cursor-pointer"
                          >
                            Сбросить фильтры
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTransactions.map((tx) => {
                        const cat = tx.categoryId ? categoryById.get(tx.categoryId) : null;
                        const acc = accountById.get(tx.accountId);
                        const toAcc = tx.toAccountId ? accountById.get(tx.toAccountId) : null;

                        const titleText =
                          tx.kind === 'transfer'
                            ? `Перевод: ${acc?.title ?? 'Счёт'} → ${toAcc?.title ?? 'Счёт'}`
                            : cat?.name ?? 'Без категории';

                        const amountCls =
                          tx.kind === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : tx.kind === 'transfer'
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-900 dark:text-slate-100';

                        const formattedAmount =
                          tx.kind === 'income'
                            ? fmt(tx.amount, { signed: true })
                            : tx.kind === 'expense'
                            ? fmt(-tx.amount)
                            : fmt(tx.amount);

                        const parsedDate = parseFlexibleDate(tx.date);

                        return (
                          <div
                            key={tx.id}
                            data-testid={`tx-row-${tx.id}`}
                            className="px-3.5 md:px-5 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                {tx.kind === 'transfer' ? (
                                  <ArrowLeftRight
                                    className="w-4 h-4 text-blue-600 dark:text-blue-400"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full ${
                                      cat ? COLOR_DOT[cat.color] : 'bg-slate-400'
                                    }`}
                                  />
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-xs md:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {titleText}
                                  </span>
                                  {tx.note && (
                                    <>
                                      <span className="text-slate-300 dark:text-slate-600 shrink-0">
                                        ·
                                      </span>
                                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                        {tx.note}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                  <span className="font-mono">
                                    {formatRussianShortDate(parsedDate)}
                                  </span>
                                  {tx.kind !== 'transfer' && acc && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{acc.title}</span>
                                    </>
                                  )}
                                  {tx.isRecurring && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                                        Регулярная
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-xs md:text-sm font-bold font-mono tabular-nums text-right ${amountCls}`}
                              >
                                {formattedAmount}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setTxModal({
                                    isOpen: true,
                                    transaction: tx,
                                    defaultKind: tx.kind,
                                  })
                                }
                                aria-label="Редактировать операцию"
                                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteTransaction(tx.id)}
                                aria-label="Удалить операцию"
                                className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* TAB 2: CATEGORY BUDGET LIMITS */}
            {activeTab === 'budgets' && (
              <div className="space-y-4">
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                        Месячные лимиты расходов · {formatRussianMonthYear(selectedMonth)}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Запланировано лимитов:{' '}
                        <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          {fmt(monthlySummary.totalBudgetLimit)}
                        </span>{' '}
                        · Потрачено по ним:{' '}
                        <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                          {fmt(monthlySummary.budgetedExpenseSpent)}
                        </span>{' '}
                        ·{' '}
                        {monthlySummary.budgetRemaining >= 0 ? (
                          <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                            Осталось {fmt(monthlySummary.budgetRemaining)}
                          </span>
                        ) : (
                          <span className="font-mono tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                            Перерасход {fmt(Math.abs(monthlySummary.budgetRemaining))}
                          </span>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-testid="add-category-button"
                      onClick={() =>
                        setCatModal({ isOpen: true, category: null, defaultKind: 'expense' })
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Категория</span>
                    </button>
                  </div>

                  {monthlySummary.totalBudgetLimit > 0 && (
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          monthlySummary.budgetUtilizationPercent > 100
                            ? 'bg-rose-600'
                            : monthlySummary.budgetUtilizationPercent >= 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-600'
                        }`}
                        style={{
                          width: `${Math.min(100, monthlySummary.budgetUtilizationPercent)}%`,
                        }}
                      />
                    </div>
                  )}
                </section>

                {/* Expense Categories Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categoryProgress.map((item) => {
                    const barWidth =
                      item.limit !== null
                        ? Math.min(100, item.percent)
                        : Math.min(100, item.shareOfTotalExpense);
                    const barCls =
                      item.status === 'over'
                        ? 'bg-rose-600'
                        : item.status === 'warning'
                        ? 'bg-amber-500'
                        : COLOR_BAR[item.category.color] ?? 'bg-emerald-600';

                    return (
                      <div
                        key={item.category.id}
                        data-testid={`budget-card-${item.category.id}`}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-3 h-3 rounded-full shrink-0 ${
                                COLOR_DOT[item.category.color] ?? 'bg-blue-600'
                              }`}
                            />
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {item.category.name}
                              </h3>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                Операций за месяц: {item.transactionsCount}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-testid={`edit-category-${item.category.id}`}
                              onClick={() =>
                                setCatModal({
                                  isOpen: true,
                                  category: item.category,
                                  defaultKind: 'expense',
                                })
                              }
                              aria-label={`Настроить ${item.category.name}`}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCategory(item.category.id)}
                              aria-label={`Удалить ${item.category.name}`}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-baseline justify-between gap-2 font-mono tabular-nums">
                          <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                            {fmt(item.spent)}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {item.limit !== null
                              ? `лимит ${fmt(item.limit)} (${item.percent}%)`
                              : `без лимита · ${item.shareOfTotalExpense}% трат`}
                          </span>
                        </div>

                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${barCls}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>

                        {item.limit !== null && item.remaining !== null && (
                          <div className="text-[11px] font-medium tabular-nums">
                            {item.status === 'over' ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
                                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                Превышение лимита на {fmt(Math.abs(item.remaining))}
                              </span>
                            ) : item.status === 'warning' ? (
                              <span className="text-amber-600 dark:text-amber-400">
                                Близко к лимиту · осталось {fmt(item.remaining)}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                В пределах бюджета · свободно {fmt(item.remaining)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Income Categories */}
                <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 md:p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Категории доходов
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setCatModal({ isOpen: true, category: null, defaultKind: 'income' })
                      }
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      + Добавить источник дохода
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {incomeCategoriesSummary.map(({ category, received }) => (
                      <div
                        key={category.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              COLOR_DOT[category.color] ?? 'bg-emerald-600'
                            }`}
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {category.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                            {fmt(received, { signed: received > 0 })}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setCatModal({
                                isOpen: true,
                                category,
                                defaultKind: 'income',
                              })
                            }
                            aria-label={`Редактировать ${category.name}`}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-white cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {/* TAB 3: ACCOUNTS & SAVINGS GOALS */}
            {activeTab === 'accounts' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Accounts Column */}
                <section className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                      Счета и кошельки
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setTxModal({ isOpen: true, transaction: null, defaultKind: 'transfer' })
                        }
                        className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                      >
                        Перевод
                      </button>
                      <button
                        type="button"
                        data-testid="add-account-button"
                        onClick={() => setAccModal({ isOpen: true, account: null })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Счёт</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {accounts.map((acc) => {
                      const currentBalance = accountBalances.balancesById.get(acc.id) ?? acc.initialBalance;
                      return (
                        <div
                          key={acc.id}
                          data-testid={`account-card-${acc.id}`}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0">
                              <AccountTypeIcon type={acc.type} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    COLOR_DOT[acc.color] ?? 'bg-blue-600'
                                  }`}
                                />
                                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {acc.title}
                                </h3>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {ACCOUNT_TYPE_LABELS[acc.type]} · Нач. остаток:{' '}
                                {fmt(acc.initialBalance)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-sm md:text-base font-bold font-mono tabular-nums ${
                                currentBalance < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-900 dark:text-slate-100'
                              }`}
                            >
                              {fmt(currentBalance)}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAccModal({ isOpen: true, account: acc })}
                              aria-label={`Редактировать ${acc.title}`}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Savings Goals Column */}
                <section className="lg:col-span-6 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm md:text-base font-bold text-slate-900 dark:text-slate-100">
                      Финансовые цели
                    </h2>
                    <button
                      type="button"
                      data-testid="add-goal-button"
                      onClick={() => setGoalModal({ isOpen: true, goal: null })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Цель</span>
                    </button>
                  </div>

                  {goals.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center space-y-2">
                      <Target className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Добавьте финансовую цель: финансовая подушка, отпуск или крупная покупка.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {goals.map((goal) => {
                        const pct = Math.min(
                          100,
                          Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100)
                        );
                        const left = Math.max(0, goal.targetAmount - goal.currentAmount);

                        return (
                          <div
                            key={goal.id}
                            data-testid={`goal-card-${goal.id}`}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                      COLOR_DOT[goal.color] ?? 'bg-emerald-600'
                                    }`}
                                  />
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                    {goal.title}
                                  </h3>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                  {left === 0
                                    ? 'Цель достигнута'
                                    : `Осталось накопить ${fmt(left)}`}
                                  {goal.deadline ? ` · до ${goal.deadline}` : ''}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setGoalModal({ isOpen: true, goal })}
                                  aria-label={`Редактировать ${goal.title}`}
                                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteGoal(goal.id)}
                                  aria-label={`Удалить ${goal.title}`}
                                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {fmt(goal.currentAmount)} /{' '}
                                  {fmt(goal.targetAmount)}
                                </span>
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    COLOR_BAR[goal.color] ?? 'bg-emerald-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              {[1000, 5000, 10000].map((step) => (
                                <button
                                  key={step}
                                  type="button"
                                  data-testid={`goal-topup-${goal.id}-${step}`}
                                  onClick={() => onContributeGoal(goal.id, step)}
                                  className="px-2.5 py-1.5 text-[11px] font-mono tabular-nums font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer"
                                >
                                  +{fmt(step)}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating standalone Операция button */}
      <button
        type="button"
        data-testid="add-transaction-button"
        onClick={() =>
          setTxModal({ isOpen: true, transaction: null, defaultKind: 'expense' })
        }
        aria-label="Добавить операцию"
        className="fixed right-4 md:right-7 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-7 z-40 inline-flex items-center justify-center gap-2 h-12 px-4 md:px-5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs md:text-sm font-semibold rounded-2xl shadow-lg shadow-blue-600/25 dark:shadow-blue-950/60 ring-1 ring-white/20 transition-all whitespace-nowrap cursor-pointer"
      >
        <Plus className="w-4 h-4 md:w-4.5 md:h-4.5" aria-hidden="true" />
        <span>Операция</span>
      </button>

      {/* Modals */}
      <FinanceTransactionModal
        isOpen={txModal.isOpen}
        transaction={txModal.transaction}
        currency={currency}
        defaultKind={txModal.defaultKind}
        defaultMonthKey={selectedMonth}
        accounts={accounts}
        categories={categories}
        onClose={() => setTxModal((prev) => ({ ...prev, isOpen: false, transaction: null }))}
        onSave={(payload) => {
          onSaveTransaction(payload);
          setTxModal((prev) => ({ ...prev, isOpen: false, transaction: null }));
        }}
        onDelete={(txId) => {
          onDeleteTransaction(txId);
          setTxModal((prev) => ({ ...prev, isOpen: false, transaction: null }));
        }}
      />

      <FinanceCategoryModal
        isOpen={catModal.isOpen}
        category={catModal.category}
        currency={currency}
        defaultKind={catModal.defaultKind}
        onClose={() => setCatModal((prev) => ({ ...prev, isOpen: false, category: null }))}
        onSave={(payload) => {
          onSaveCategory(payload);
          setCatModal((prev) => ({ ...prev, isOpen: false, category: null }));
        }}
        onDelete={(catId) => {
          onDeleteCategory(catId);
          setCatModal((prev) => ({ ...prev, isOpen: false, category: null }));
        }}
      />

      <FinanceAccountModal
        isOpen={accModal.isOpen}
        account={accModal.account}
        currency={currency}
        canDelete={accounts.length > 1}
        onClose={() => setAccModal({ isOpen: false, account: null })}
        onSave={(payload) => {
          onSaveAccount(payload);
          setAccModal({ isOpen: false, account: null });
        }}
        onDelete={(accId) => {
          onDeleteAccount(accId);
          setAccModal({ isOpen: false, account: null });
        }}
      />

      <FinanceGoalModal
        isOpen={goalModal.isOpen}
        goal={goalModal.goal}
        currency={currency}
        onClose={() => setGoalModal({ isOpen: false, goal: null })}
        onSave={(payload) => {
          onSaveGoal(payload);
          setGoalModal({ isOpen: false, goal: null });
        }}
        onDelete={(goalId) => {
          onDeleteGoal(goalId);
          setGoalModal({ isOpen: false, goal: null });
        }}
      />
    </div>
  );
}
