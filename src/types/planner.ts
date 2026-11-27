export type PlanSubView = 'board' | 'week' | 'month' | 'timeline';
export type MainSection = 'plan' | 'habits' | 'notes' | 'finance' | 'sport';
export type ViewMode = PlanSubView | 'habits' | 'notes' | 'finance' | 'sport';

export type TimelineGroupBy = 'list' | 'label' | 'board';

export type LabelColor = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate';

export interface CardBoardMeta {
  boardId: string;
  boardTitle: string;
  boardColor: LabelColor;
  listTitle?: string;
}

export interface LabelDef {
  id: string;
  name: string;
  color: LabelColor;
}

export interface Member {
  id: string;
  name: string;
  role: string;
  initials: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CardItem {
  id: string;
  listId: string;
  order: number;
  title: string;
  description: string;
  labelIds: string[];
  memberIds?: string[];
  checklist: ChecklistItem[];
  /** ISO date-time string for Planyway scheduled start, e.g. '2026-11-24T10:00' or '2026-11-24' */
  startDate: string | null;
  /** ISO date-time string for Planyway scheduled end, e.g. '2026-11-24T12:00' or '2026-11-26' */
  endDate: string | null;
  /** Optional all-day flag for timeline/month spans */
  allDay?: boolean;
  /** Optional due date string 'YYYY-MM-DD' */
  dueDate: string | null;
  /** Linked Google Calendar event ID if synced */
  googleEventId?: string | null;
  /** Target Google Calendar ID where event was synced */
  googleCalendarId?: string | null;
  /** Timestamp of last Google sync */
  lastSyncedAt?: string | null;
  /** True when card schedule or details changed since last Google Calendar sync */
  syncDirty?: boolean;
}

export interface BoardList {
  id: string;
  title: string;
  order: number;
}

export interface BoardState {
  lists: BoardList[];
  cards: CardItem[];
  labels: LabelDef[];
  members?: Member[];
}

export interface BoardRecord {
  id: string;
  title: string;
  color: LabelColor;
  state: BoardState;
}

export interface WorkspaceData {
  activeBoardId: string;
  boards: BoardRecord[];
}

export interface FilterState {
  search: string;
  labelId: string | 'all';
}

export interface GoogleCalendarMeta {
  id: string;
  summary: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  calendarId: string;
  calendarSummary?: string;
  calendarColor?: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  hangoutLink?: string;
  start: string; // ISO date or dateTime
  end: string;   // ISO date or dateTime
  allDay: boolean;
  status?: string;
}

export interface PendingGoogleMutation {
  type: 'create' | 'update' | 'delete' | 'batch_sync';
  title: string;
  description: string;
  calendarId: string;
  calendarName: string;
  card?: CardItem;
  cards?: CardItem[];
}

export interface HabitItem {
  id: string;
  title: string;
  color: LabelColor;
  /** ISO weekdays 1 (Mon) .. 7 (Sun) */
  daysOfWeek: number[];
  /** Daily goal count (1 for simple check-off, >1 for quantitative habits like water/minutes) */
  targetCount: number;
  /** Short unit label, e.g. 'раз', 'мин', 'стак.' */
  unit: string;
  order: number;
  /** Map of YYYY-MM-DD -> completed count */
  completions: Record<string, number>;
}

export type NoteBlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider';

export interface NoteBlock {
  id: string;
  type: NoteBlockType;
  content: string;
  checked: boolean;
  indent: number;
}

export interface NoteFolder {
  id: string;
  parentId: string | null;
  title: string;
  color: LabelColor;
  order: number;
}

export interface NotePage {
  id: string;
  folderId: string | null;
  title: string;
  icon: string;
  pinned: boolean;
  order: number;
  blocks: NoteBlock[];
  updatedAtMs: number;
}

export type FinanceCurrency =
  | 'RUB'
  | 'USD'
  | 'EUR'
  | 'KZT'
  | 'BYN'
  | 'GEL'
  | 'TRY'
  | 'AED'
  | 'GBP'
  | 'CNY';

export type FinanceExchangeRates = Partial<Record<FinanceCurrency, number>>;

export type FinanceAccountType = 'card' | 'cash' | 'savings' | 'other';

export interface FinanceAccount {
  id: string;
  title: string;
  type: FinanceAccountType;
  currency: FinanceCurrency;
  initialBalance: number;
  color: LabelColor;
  order: number;
}

export type FinanceCategoryKind = 'expense' | 'income';

export interface FinanceCategory {
  id: string;
  name: string;
  kind: FinanceCategoryKind;
  /** Monthly spending limit in active base currency for expense categories (null = unlimited) */
  monthlyLimit: number | null;
  color: LabelColor;
  order: number;
}

export type FinanceTransactionKind = 'expense' | 'income' | 'transfer';

export interface FinanceTransaction {
  id: string;
  kind: FinanceTransactionKind;
  amount: number;
  /** Credited amount in target account currency for cross-currency transfers (null otherwise) */
  toAmount?: number | null;
  categoryId: string | null;
  accountId: string;
  /** Target account ID when kind === 'transfer', null otherwise */
  toAccountId: string | null;
  /** Date string in YYYY-MM-DD format */
  date: string;
  note: string;
  /** Marks recurring monthly bills/income/subscriptions for quick repeat */
  isRecurring: boolean;
  createdAtMs: number;
}

export interface FinanceGoal {
  id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  /** Optional target date in YYYY-MM-DD format */
  deadline: string | null;
  color: LabelColor;
  order: number;
}


