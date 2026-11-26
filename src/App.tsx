import type { User } from 'firebase/auth';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGateScreen } from './components/AuthGateScreen';
import { KanbanBoard } from './components/KanbanBoard';
import { OfflineIndicator } from './components/PWAInstallButton';
import { TopBar, MobileBottomNav } from './components/TopBar';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';

const CardModal = lazy(() =>
  import('./components/CardModal').then((m) => ({ default: m.CardModal }))
);
const ConfirmActionModal = lazy(() =>
  import('./components/ConfirmActionModal').then((m) => ({ default: m.ConfirmActionModal }))
);
const EventDetailModal = lazy(() =>
  import('./components/EventDetailModal').then((m) => ({ default: m.EventDetailModal }))
);
const FinanceView = lazy(() =>
  import('./components/FinanceView').then((m) => ({ default: m.FinanceView }))
);
const GoogleCalendarDrawer = lazy(() =>
  import('./components/GoogleCalendarDrawer').then((m) => ({ default: m.GoogleCalendarDrawer }))
);
const HabitsView = lazy(() =>
  import('./components/HabitsView').then((m) => ({ default: m.HabitsView }))
);
const MonthPlannerView = lazy(() =>
  import('./components/MonthPlannerView').then((m) => ({ default: m.MonthPlannerView }))
);
const NotesView = lazy(() =>
  import('./components/NotesView').then((m) => ({ default: m.NotesView }))
);
const PlannerBacklogSidebar = lazy(() =>
  import('./components/PlannerBacklogSidebar').then((m) => ({ default: m.PlannerBacklogSidebar }))
);
const QuickSearchModal = lazy(() =>
  import('./components/QuickSearchModal').then((m) => ({ default: m.QuickSearchModal }))
);
const TimelinePlannerView = lazy(() =>
  import('./components/TimelinePlannerView').then((m) => ({ default: m.TimelinePlannerView }))
);
const UpcomingModuleView = lazy(() =>
  import('./components/UpcomingModuleView').then((m) => ({ default: m.UpcomingModuleView }))
);
const WeekPlannerView = lazy(() =>
  import('./components/WeekPlannerView').then((m) => ({ default: m.WeekPlannerView }))
);
import {
  createInitialFinanceAccounts,
  createInitialFinanceCategories,
  createInitialFinanceGoals,
  createInitialFinanceTransactions,
  createInitialHabits,
  createInitialNoteFolders,
  createInitialNotes,
  createInitialWorkspaceData,
} from './data/seedData';
import {
  clearCachedToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/firebaseAuth';

let firestoreWorkspacePromise: Promise<typeof import('./services/firestoreWorkspace')> | null = null;
function loadFirestoreWorkspaceModule() {
  if (!firestoreWorkspacePromise) {
    firestoreWorkspacePromise = import('./services/firestoreWorkspace');
  }
  return firestoreWorkspacePromise;
}
import {
  CalendarAuthExpiredError,
  createCalendarEvent,
  deleteCalendarEvent,
  fetchCalendarList,
  fetchEventsInRange,
  updateCalendarEvent,
} from './services/googleCalendarApi';
import type {
  BoardState,
  CardItem,
  FilterState,
  FinanceAccount,
  FinanceAccountType,
  FinanceCategory,
  FinanceCategoryKind,
  FinanceGoal,
  FinanceCurrency,
  FinanceTransaction,
  FinanceTransactionKind,
  GoogleCalendarEvent,
  GoogleCalendarMeta,
  HabitItem,
  LabelColor,
  MainSection,
  NoteFolder,
  NotePage,
  PendingGoogleMutation,
  PlanSubView,
  TimelineGroupBy,
  ViewMode,
  WorkspaceData,
} from './types/planner';
import {
  addBoardToWorkspace,
  addListToBoard,
  adjustCardDurationMinutes,
  deleteBoardFromWorkspace,
  deleteCardInWorkspace,
  filterCards,
  findCardInWorkspace,
  getAllWorkspaceCards,
  getCardBoardMetaMap,
  getCardsPendingGoogleSync,
  getWorkspaceLabels,
  moveCardInBoard,
  renameBoardInWorkspace,
  saveCardInWorkspace,
  scheduleCardAtSlot,
  scheduleCardForDaySpan,
  shiftCardDatesByDays,
  updateCardInWorkspace,
} from './utils/boardLogic';
import {
  addDays,
  getMonthGridDays,
  getTimelineDays,
  getWeekDays,
  pad2,
  toLocalDateKey,
  toLocalDateTimeInput,
} from './utils/dateUtils';
import {
  DEFAULT_FINANCE_CURRENCY,
  applyGoalContribution,
  createFinanceAccount,
  createFinanceCategory,
  createFinanceGoal,
  createFinanceTransaction,
  sanitizeFinanceCurrency,
} from './utils/financeLogic';
import {
  adjustHabitDayCount,
  createHabitItem,
  toggleOrIncrementHabitDay,
} from './utils/habitLogic';
import {
  createNoteFolder,
  createNotePage,
  removeFolderAndPromoteChildren,
} from './utils/notesLogic';

const DEV_PREVIEW_STORAGE_KEY = 'pland_dev_preview_v1';
const DEV_PREVIEW_HABITS_KEY = 'pland_dev_preview_habits_v1';
const DEV_PREVIEW_NOTE_FOLDERS_KEY = 'pland_dev_preview_note_folders_v1';
const DEV_PREVIEW_NOTES_KEY = 'pland_dev_preview_notes_v1';
const DEV_PREVIEW_FINANCE_ACCOUNTS_KEY = 'rst_dev_preview_fin_accounts_v1';
const DEV_PREVIEW_FINANCE_CATEGORIES_KEY = 'rst_dev_preview_fin_categories_v1';
const DEV_PREVIEW_FINANCE_TRANSACTIONS_KEY = 'rst_dev_preview_fin_transactions_v1';
const DEV_PREVIEW_FINANCE_GOALS_KEY = 'rst_dev_preview_fin_goals_v1';
const DEV_PREVIEW_FINANCE_CURRENCY_KEY = 'rst_dev_preview_fin_currency_v1';
const OWNER_EMAIL = 'bakhrust@gmail.com';

function isAuthorizedOwner(user: User | null): user is User {
  return Boolean(user && user.emailVerified && user.email?.toLowerCase() === OWNER_EMAIL);
}

function loadDevPreviewWorkspace(): WorkspaceData {
  try {
    const raw =
      localStorage.getItem(DEV_PREVIEW_STORAGE_KEY) ||
      localStorage.getItem('pland_workspace_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceData;
      if (Array.isArray(parsed.boards) && parsed.boards.length > 0) {
        const hasActive = parsed.boards.some((b) => b.id === parsed.activeBoardId);
        return {
          activeBoardId: hasActive ? parsed.activeBoardId : parsed.boards[0].id,
          boards: parsed.boards,
        };
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return createInitialWorkspaceData(new Date());
}

function loadDevPreviewHabits(): HabitItem[] {
  try {
    const raw = localStorage.getItem(DEV_PREVIEW_HABITS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as HabitItem[];
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return createInitialHabits(new Date());
}

function loadDevPreviewNoteFolders(): NoteFolder[] {
  try {
    const raw = localStorage.getItem(DEV_PREVIEW_NOTE_FOLDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as NoteFolder[];
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return createInitialNoteFolders();
}

function loadDevPreviewNotes(): NotePage[] {
  try {
    const raw = localStorage.getItem(DEV_PREVIEW_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as NotePage[];
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return createInitialNotes(Date.now());
}

function loadDevPreviewFinanceList<T>(key: string, fallback: () => T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed as T[];
      }
    }
  } catch {
    // ignore corrupted storage
  }
  return fallback();
}

export default function App() {
  // Dev-only headless preview bypass; permanently disabled in production builds and remote hosts.
  const isAutostart = useMemo(() => {
    if (typeof window === 'undefined' || !import.meta.env.DEV) return false;
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    return isLocalHost && new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [isGuestMode, setIsGuestMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1' || params.get('guest') === '1') return true;
    if (window.location.hash.includes('tgWebAppData=')) return true;
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (tg && typeof tg.initData === 'string' && tg.initData.length > 0) {
      return true;
    }
    return false;
  });

  const isOfflineOrGuest = isAutostart || isGuestMode;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const activateTg = () => {
      const tg = (
        window as unknown as {
          Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
        }
      ).Telegram?.WebApp;
      if (!tg) return false;
      tg.ready?.();
      tg.expand?.();
      if (typeof tg.initData === 'string' && tg.initData.length > 0) {
        setIsGuestMode(true);
      }
      return true;
    };

    if (activateTg()) return;

    const isTelegramContext =
      window.location.hash.includes('tgWebApp') ||
      'TelegramWebviewProxy' in window ||
      /Telegram/i.test(navigator.userAgent);

    if (!isTelegramContext) return;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload = () => {
      activateTg();
    };
    document.head.appendChild(script);
  }, []);

  const [workspace, setWorkspace] = useState<WorkspaceData>(() =>
    isOfflineOrGuest ? loadDevPreviewWorkspace() : createInitialWorkspaceData(new Date())
  );
  const [habits, setHabits] = useState<HabitItem[]>(() =>
    isOfflineOrGuest ? loadDevPreviewHabits() : createInitialHabits(new Date())
  );
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>(() =>
    isOfflineOrGuest ? loadDevPreviewNoteFolders() : createInitialNoteFolders()
  );
  const [notes, setNotes] = useState<NotePage[]>(() =>
    isOfflineOrGuest ? loadDevPreviewNotes() : createInitialNotes(Date.now())
  );
  const [financeAccounts, setFinanceAccounts] = useState<FinanceAccount[]>(() =>
    isOfflineOrGuest
      ? loadDevPreviewFinanceList(DEV_PREVIEW_FINANCE_ACCOUNTS_KEY, createInitialFinanceAccounts)
      : createInitialFinanceAccounts()
  );
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>(() =>
    isOfflineOrGuest
      ? loadDevPreviewFinanceList(DEV_PREVIEW_FINANCE_CATEGORIES_KEY, createInitialFinanceCategories)
      : createInitialFinanceCategories()
  );
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>(() =>
    isOfflineOrGuest
      ? loadDevPreviewFinanceList(DEV_PREVIEW_FINANCE_TRANSACTIONS_KEY, () =>
          createInitialFinanceTransactions(new Date())
        )
      : createInitialFinanceTransactions(new Date())
  );
  const [financeGoals, setFinanceGoals] = useState<FinanceGoal[]>(() =>
    isOfflineOrGuest
      ? loadDevPreviewFinanceList(DEV_PREVIEW_FINANCE_GOALS_KEY, createInitialFinanceGoals)
      : createInitialFinanceGoals()
  );
  const [financeCurrency, setFinanceCurrency] = useState<FinanceCurrency>(() => {
    if (isOfflineOrGuest) {
      try {
        return sanitizeFinanceCurrency(localStorage.getItem(DEV_PREVIEW_FINANCE_CURRENCY_KEY));
      } catch {
        return DEFAULT_FINANCE_CURRENCY;
      }
    }
    return DEFAULT_FINANCE_CURRENCY;
  });
  const activeBoard = useMemo(
    () => workspace.boards.find((b) => b.id === workspace.activeBoardId) ?? workspace.boards[0],
    [workspace]
  );
  const board = activeBoard.state;

  const setBoard = useCallback((updater: BoardState | ((prev: BoardState) => BoardState)) => {
    setWorkspace((prevWs) => ({
      ...prevWs,
      boards: prevWs.boards.map((b) => {
        if (b.id !== prevWs.activeBoardId) return b;
        const nextState = typeof updater === 'function' ? updater(b.state) : updater;
        return { ...b, state: nextState };
      }),
    }));
  }, []);

  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [lastPlanView, setLastPlanView] = useState<PlanSubView>('board');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [timelineGroupBy, setTimelineGroupBy] = useState<TimelineGroupBy>('list');
  const [timelineDaysCount, setTimelineDaysCount] = useState<7 | 14>(7);
  const [showBacklogSidebar, setShowBacklogSidebar] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(max-width: 767px)');
    const handleBreakpoint = (e: MediaQueryListEvent) => {
      setShowBacklogSidebar(!e.matches);
    };
    mql.addEventListener('change', handleBreakpoint);
    return () => mql.removeEventListener('change', handleBreakpoint);
  }, []);

  const handleChangeViewMode = (nextView: ViewMode) => {
    setViewMode(nextView);
    if (
      nextView === 'board' ||
      nextView === 'week' ||
      nextView === 'month' ||
      nextView === 'timeline'
    ) {
      setLastPlanView(nextView);
    }
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowBacklogSidebar(false);
    }
  };

  const handleSelectSection = (section: MainSection) => {
    if (section === 'plan') {
      handleChangeViewMode(lastPlanView);
    } else {
      handleChangeViewMode(section);
    }
  };

  const handleChangePlanView = (planView: PlanSubView) => {
    handleChangeViewMode(planView);
  };
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    labelId: 'all',
  });
  const [calendarBoardFilter, setCalendarBoardFilter] = useState<string | 'all'>('all');

  // Modals & Drawers
  const [cardModalState, setCardModalState] = useState<{
    isOpen: boolean;
    card: CardItem | null;
    boardId?: string;
    defaultListId: string;
    defaultStartDate?: string | null;
    defaultEndDate?: string | null;
    defaultAllDay?: boolean;
  }>({
    isOpen: false,
    card: null,
    defaultListId: board.lists[0]?.id ?? 'list-backlog',
  });
  const [isGoogleDrawerOpen, setIsGoogleDrawerOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [selectedGoogleEvent, setSelectedGoogleEvent] = useState<GoogleCalendarEvent | null>(null);

  // Google Auth, Firestore & Calendar State (OAuth token strictly kept in memory inside firebaseAuth.ts)
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(isAutostart);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isWorkspaceSyncing, setIsWorkspaceSyncing] = useState(false);
  const [fatalFirestoreError, setFatalFirestoreError] = useState<Error | null>(null);

  const loadedUidRef = useRef<string | null>(null);
  const lastSyncedWorkspaceRef = useRef<WorkspaceData | null>(null);
  const lastSyncedHabitsRef = useRef<HabitItem[] | null>(null);
  const lastSyncedNoteFoldersRef = useRef<NoteFolder[] | null>(null);
  const lastSyncedNotesRef = useRef<NotePage[] | null>(null);
  const lastSyncedFinAccountsRef = useRef<FinanceAccount[] | null>(null);
  const lastSyncedFinCategoriesRef = useRef<FinanceCategory[] | null>(null);
  const lastSyncedFinTransactionsRef = useRef<FinanceTransaction[] | null>(null);
  const lastSyncedFinGoalsRef = useRef<FinanceGoal[] | null>(null);
  const lastSyncedFinCurrencyRef = useRef<FinanceCurrency | null>(null);
  const lastSyncedPrefsRef = useRef<string>('');

  const [calendars, setCalendars] = useState<GoogleCalendarMeta[]>([]);
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<string[]>([]);
  const [targetCalendarId, setTargetCalendarId] = useState<string>('primary');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (isOfflineOrGuest) {
      try {
        return localStorage.getItem('pland_theme_v1') === 'dark' ? 'dark' : 'light';
      } catch {
        return 'light';
      }
    }
    return 'light';
  });
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  // Explicit Confirmation State for Google Calendar mutations
  const [pendingMutation, setPendingMutation] = useState<PendingGoogleMutation | null>(null);
  const [isMutatingGoogle, setIsMutatingGoogle] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  if (fatalFirestoreError) {
    throw fatalFirestoreError;
  }

  // Test Firestore connectivity once a user is authenticated
  useEffect(() => {
    if (googleUser) {
      void import('./services/firebaseClient').then((m) => m.testFirestoreConnection());
    }
  }, [googleUser]);

  // Sync workspace changes to Firestore (or local dev storage when in localhost ?autostart=1 preview or guest mode)
  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedWorkspaceRef.current) {
      const prev = lastSyncedWorkspaceRef.current;
      if (prev === workspace) return;
      lastSyncedWorkspaceRef.current = workspace;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.syncWorkspaceChangesToFirestore(googleUser.uid, prev, workspace))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_STORAGE_KEY, JSON.stringify(workspace));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [workspace, googleUser, isOfflineOrGuest]);

  // Sync habit changes to Firestore (or local dev storage when in localhost ?autostart=1 preview or guest mode)
  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedHabitsRef.current) {
      const prev = lastSyncedHabitsRef.current;
      if (prev === habits) return;
      lastSyncedHabitsRef.current = habits;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.syncHabitsChangesToFirestore(googleUser.uid, prev, habits))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_HABITS_KEY, JSON.stringify(habits));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [habits, googleUser, isOfflineOrGuest]);

  // Sync notebook folders to Firestore or local preview storage
  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedNoteFoldersRef.current) {
      const prev = lastSyncedNoteFoldersRef.current;
      if (prev === noteFolders) return;
      lastSyncedNoteFoldersRef.current = noteFolders;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.syncNoteFoldersChangesToFirestore(googleUser.uid, prev, noteFolders))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }

    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_NOTE_FOLDERS_KEY, JSON.stringify(noteFolders));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [noteFolders, googleUser, isOfflineOrGuest]);

  // Debounced sync for Notion-style notes (avoids writing to Firestore on every keystroke)
  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedNotesRef.current) {
      const timer = setTimeout(() => {
        const prev = lastSyncedNotesRef.current;
        if (!prev || prev === notes) return;
        lastSyncedNotesRef.current = notes;
        void loadFirestoreWorkspaceModule()
          .then((m) => m.syncNotesChangesToFirestore(googleUser.uid, prev, notes))
          .catch((err) => {
            setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
          });
      }, 500);
      return () => clearTimeout(timer);
    }

    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_NOTES_KEY, JSON.stringify(notes));
      } catch {
        // ignore storage quota errors
      }
    }
  }, [notes, googleUser, isOfflineOrGuest]);

  // Sync finance accounts, categories, transactions, and goals to Firestore or local preview storage
  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedFinAccountsRef.current) {
      const prev = lastSyncedFinAccountsRef.current;
      if (prev === financeAccounts) return;
      lastSyncedFinAccountsRef.current = financeAccounts;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.syncFinanceAccountsChangesToFirestore(googleUser.uid, prev, financeAccounts))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }
    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_FINANCE_ACCOUNTS_KEY, JSON.stringify(financeAccounts));
      } catch {
        // ignore
      }
    }
  }, [financeAccounts, googleUser, isOfflineOrGuest]);

  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedFinCategoriesRef.current) {
      const prev = lastSyncedFinCategoriesRef.current;
      if (prev === financeCategories) return;
      lastSyncedFinCategoriesRef.current = financeCategories;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.syncFinanceCategoriesChangesToFirestore(googleUser.uid, prev, financeCategories))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }
    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_FINANCE_CATEGORIES_KEY, JSON.stringify(financeCategories));
      } catch {
        // ignore
      }
    }
  }, [financeCategories, googleUser, isOfflineOrGuest]);

  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedFinTransactionsRef.current) {
      const prev = lastSyncedFinTransactionsRef.current;
      if (prev === financeTransactions) return;
      lastSyncedFinTransactionsRef.current = financeTransactions;
      void loadFirestoreWorkspaceModule()
        .then((m) =>
          m.syncFinanceTransactionsChangesToFirestore(googleUser.uid, prev, financeTransactions)
        )
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }
    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_FINANCE_TRANSACTIONS_KEY, JSON.stringify(financeTransactions));
      } catch {
        // ignore
      }
    }
  }, [financeTransactions, googleUser, isOfflineOrGuest]);

  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedFinGoalsRef.current) {
      const prev = lastSyncedFinGoalsRef.current;
      if (prev === financeGoals) return;
      lastSyncedFinGoalsRef.current = financeGoals;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.syncFinanceGoalsChangesToFirestore(googleUser.uid, prev, financeGoals))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }
    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_FINANCE_GOALS_KEY, JSON.stringify(financeGoals));
      } catch {
        // ignore
      }
    }
  }, [financeGoals, googleUser, isOfflineOrGuest]);

  useEffect(() => {
    if (googleUser && loadedUidRef.current === googleUser.uid && lastSyncedFinCurrencyRef.current) {
      if (lastSyncedFinCurrencyRef.current === financeCurrency) return;
      lastSyncedFinCurrencyRef.current = financeCurrency;
      void loadFirestoreWorkspaceModule()
        .then((m) => m.saveUserPrefsToFirestore(googleUser.uid, { financeCurrency }))
        .catch((err) => {
          setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
        });
      return;
    }
    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem(DEV_PREVIEW_FINANCE_CURRENCY_KEY, financeCurrency);
      } catch {
        // ignore
      }
    }
  }, [financeCurrency, googleUser, isOfflineOrGuest]);

  // Apply dark class to document.documentElement
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    if (isOfflineOrGuest && !googleUser) {
      try {
        localStorage.setItem('pland_theme_v1', theme);
      } catch {
        // ignore
      }
    }
  }, [theme, isOfflineOrGuest, googleUser]);

  // Persist Google Calendar display preferences and theme in Firestore for the signed-in user
  useEffect(() => {
    if (!googleUser || loadedUidRef.current !== googleUser.uid) return;
    const serialized = JSON.stringify({ visibleCalendarIds, targetCalendarId, theme });
    if (serialized === lastSyncedPrefsRef.current) return;
    lastSyncedPrefsRef.current = serialized;
    void loadFirestoreWorkspaceModule()
      .then((m) =>
        m.saveUserPrefsToFirestore(googleUser.uid, {
          visibleCalendarIds,
          targetCalendarId,
          theme,
        })
      )
      .catch((err) => {
        setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
      });
  }, [visibleCalendarIds, targetCalendarId, theme, googleUser]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  const loadCloudWorkspaceForUser = useCallback(async (user: User): Promise<WorkspaceData | null> => {
    if (loadedUidRef.current === user.uid && lastSyncedWorkspaceRef.current) {
      return lastSyncedWorkspaceRef.current;
    }
    setIsWorkspaceSyncing(true);
    try {
      const { loadOrInitializeUserWorkspace } = await loadFirestoreWorkspaceModule();
      const loaded = await loadOrInitializeUserWorkspace(user);
      loadedUidRef.current = user.uid;
      lastSyncedWorkspaceRef.current = loaded.workspace;
      lastSyncedHabitsRef.current = loaded.habits;
      lastSyncedNoteFoldersRef.current = loaded.noteFolders;
      lastSyncedNotesRef.current = loaded.notes;
      lastSyncedFinAccountsRef.current = loaded.financeAccounts;
      lastSyncedFinCategoriesRef.current = loaded.financeCategories;
      lastSyncedFinTransactionsRef.current = loaded.financeTransactions;
      lastSyncedFinGoalsRef.current = loaded.financeGoals;
      lastSyncedFinCurrencyRef.current = loaded.financeCurrency;
      lastSyncedPrefsRef.current = JSON.stringify({
        visibleCalendarIds: loaded.visibleCalendarIds,
        targetCalendarId: loaded.targetCalendarId,
        theme: loaded.theme,
      });
      setWorkspace(loaded.workspace);
      setHabits(loaded.habits);
      setNoteFolders(loaded.noteFolders);
      setNotes(loaded.notes);
      setFinanceAccounts(loaded.financeAccounts);
      setFinanceCategories(loaded.financeCategories);
      setFinanceTransactions(loaded.financeTransactions);
      setFinanceGoals(loaded.financeGoals);
      setFinanceCurrency(loaded.financeCurrency);
      setVisibleCalendarIds(loaded.visibleCalendarIds);
      setTargetCalendarId(loaded.targetCalendarId);
      setTheme(loaded.theme);
      return loaded.workspace;
    } catch (err) {
      setFatalFirestoreError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setIsWorkspaceSyncing(false);
    }
  }, []);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        if (!isAuthorizedOwner(user)) {
          void logout();
          setGoogleUser(null);
          setNeedsAuth(true);
          setAuthError('Доступ разрешён только владельцу приложения.');
          setIsAuthChecked(true);
          return;
        }
        setGoogleUser(user);
        setNeedsAuth(!token);
        setIsAuthChecked(true);
        void loadCloudWorkspaceForUser(user);
      },
      () => {
        const wasSignedIn = Boolean(loadedUidRef.current);
        loadedUidRef.current = null;
        lastSyncedWorkspaceRef.current = null;
        lastSyncedHabitsRef.current = null;
        lastSyncedNoteFoldersRef.current = null;
        lastSyncedNotesRef.current = null;
        lastSyncedFinAccountsRef.current = null;
        lastSyncedFinCategoriesRef.current = null;
        lastSyncedFinTransactionsRef.current = null;
        lastSyncedFinGoalsRef.current = null;
        lastSyncedPrefsRef.current = '';
        setGoogleUser(null);
        setNeedsAuth(true);
        setCalendars([]);
        setGoogleEvents([]);
        if (wasSignedIn || !isAutostart) {
          setHabits(createInitialHabits(new Date()));
          setNoteFolders(createInitialNoteFolders());
          setNotes(createInitialNotes(Date.now()));
          setFinanceAccounts(createInitialFinanceAccounts());
          setFinanceCategories(createInitialFinanceCategories());
          setFinanceTransactions(createInitialFinanceTransactions(new Date()));
          setFinanceGoals(createInitialFinanceGoals());
        }
        setIsAuthChecked(true);
      }
    );
    return unsubscribe;
  }, [loadCloudWorkspaceForUser, isAutostart]);

  const visibleRange = useMemo(() => {
    if (viewMode === 'month') {
      const days = getMonthGridDays(anchorDate);
      const start = days[0];
      const end = addDays(days[days.length - 1], 1);
      return { start, end };
    }
    if (viewMode === 'timeline') {
      const days = getTimelineDays(anchorDate, timelineDaysCount);
      return { start: days[0], end: addDays(days[days.length - 1], 1) };
    }
    const days = getWeekDays(anchorDate);
    return { start: days[0], end: addDays(days[6], 1) };
  }, [anchorDate, viewMode, timelineDaysCount]);

  const loadCalendarsAndEvents = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setIsLoadingEvents(true);
    setAuthError(null);
    try {
      let cals = calendars;
      if (cals.length === 0) {
        cals = await fetchCalendarList(token);
        setCalendars(cals);

        if (cals.length > 0) {
          setVisibleCalendarIds((prev) => {
            const valid = prev.filter((id) => cals.some((c) => c.id === id));
            if (valid.length > 0) return valid;
            const primary = cals.find((c) => c.primary) || cals[0];
            return [primary.id];
          });
          setTargetCalendarId((prev) => {
            if (cals.some((c) => c.id === prev)) return prev;
            const primary = cals.find((c) => c.primary) || cals[0];
            return primary.id;
          });
        }
      }

      const activeIds =
        visibleCalendarIds.length > 0
          ? visibleCalendarIds
          : cals.filter((c) => c.primary).map((c) => c.id);
      const selectedCalendars = cals.filter((c) => activeIds.includes(c.id));
      const events = await fetchEventsInRange(
        token,
        selectedCalendars,
        visibleRange.start,
        visibleRange.end
      );
      setGoogleEvents(events);
    } catch (err) {
      if (err instanceof CalendarAuthExpiredError) {
        clearCachedToken();
        setNeedsAuth(true);
        setAuthError(err.message);
      } else {
        setAuthError(err instanceof Error ? err.message : 'Не удалось загрузить события');
      }
    } finally {
      setIsLoadingEvents(false);
    }
  }, [calendars, visibleCalendarIds, visibleRange]);

  useEffect(() => {
    if (!needsAuth && googleUser) {
      void loadCalendarsAndEvents();
    }
  }, [needsAuth, googleUser, visibleRange, visibleCalendarIds, loadCalendarsAndEvents]);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      if (res) {
        if (!isAuthorizedOwner(res.user)) {
          await logout();
          setGoogleUser(null);
          setNeedsAuth(true);
          setIsAuthChecked(true);
          setAuthError('Доступ к этому личному приложению разрешён только владельцу (bakhrust@gmail.com).');
          return;
        }
        setGoogleUser(res.user);
        setNeedsAuth(false);
        setIsAuthChecked(true);
        const loadedWs = await loadCloudWorkspaceForUser(res.user);
        const cals = await fetchCalendarList(res.accessToken);
        setCalendars(cals);
        const primary = cals.find((c) => c.primary) || cals[0];
        if (primary) {
          setVisibleCalendarIds((prev) => (prev.length > 0 ? prev : [primary.id]));
          setTargetCalendarId(primary.id);
        }
        const allLoadedCards = loadedWs
          ? getAllWorkspaceCards(loadedWs, 'all')
          : getAllWorkspaceCards(workspace, 'all');
        const pendingCards = getCardsPendingGoogleSync(allLoadedCards);
        if (pendingCards.length > 0) {
          const calId = primary?.id || targetCalendarId || 'primary';
          const calName = primary?.summary || 'Основной календарь';
          setPendingMutation({
            type: 'batch_sync',
            title: `Синхронизировать ${pendingCards.length} задач с Google Calendar?`,
            description:
              'У вас есть задачи с назначенным временем. Отправить их в ваш Google Календарь сейчас?',
            calendarId: calId,
            calendarName: calName,
            cards: pendingCards,
          });
        } else {
          setNotice({ kind: 'success', text: 'Google Календарь успешно подключён' });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setAuthError('Окно входа Google было закрыто до завершения авторизации.');
      } else if (msg.includes('popup-blocked')) {
        setAuthError('Браузер заблокировал всплывающее окно Google. Разрешите всплывающие окна и повторите попытку.');
      } else {
        setAuthError(msg || 'Не удалось войти через Google');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    loadedUidRef.current = null;
    lastSyncedWorkspaceRef.current = null;
    lastSyncedHabitsRef.current = null;
    lastSyncedNoteFoldersRef.current = null;
    lastSyncedNotesRef.current = null;
    lastSyncedFinAccountsRef.current = null;
    lastSyncedFinCategoriesRef.current = null;
    lastSyncedFinTransactionsRef.current = null;
    lastSyncedFinGoalsRef.current = null;
    lastSyncedFinCurrencyRef.current = null;
    lastSyncedPrefsRef.current = '';
    setGoogleUser(null);
    setNeedsAuth(true);
    setCalendars([]);
    setGoogleEvents([]);
    setVisibleCalendarIds([]);
    setTargetCalendarId('primary');
    setWorkspace(createInitialWorkspaceData(new Date()));
    setHabits(createInitialHabits(new Date()));
    setNoteFolders(createInitialNoteFolders());
    setNotes(createInitialNotes(Date.now()));
    setFinanceAccounts(createInitialFinanceAccounts());
    setFinanceCategories(createInitialFinanceCategories());
    setFinanceTransactions(createInitialFinanceTransactions(new Date()));
    setFinanceGoals(createInitialFinanceGoals());
    setFinanceCurrency(DEFAULT_FINANCE_CURRENCY);
    try {
      localStorage.removeItem('pland_workspace_v1');
      localStorage.removeItem('pland_board_v1');
      localStorage.removeItem('pland_gcal_prefs_v1');
      localStorage.removeItem(DEV_PREVIEW_STORAGE_KEY);
      localStorage.removeItem(DEV_PREVIEW_HABITS_KEY);
      localStorage.removeItem(DEV_PREVIEW_NOTE_FOLDERS_KEY);
      localStorage.removeItem(DEV_PREVIEW_NOTES_KEY);
      localStorage.removeItem(DEV_PREVIEW_FINANCE_ACCOUNTS_KEY);
      localStorage.removeItem(DEV_PREVIEW_FINANCE_CATEGORIES_KEY);
      localStorage.removeItem(DEV_PREVIEW_FINANCE_TRANSACTIONS_KEY);
      localStorage.removeItem(DEV_PREVIEW_FINANCE_GOALS_KEY);
      localStorage.removeItem(DEV_PREVIEW_FINANCE_CURRENCY_KEY);
    } catch {
      // ignore
    }
    setNotice({ kind: 'success', text: 'Аккаунт Google отключён' });
  };

  // Filtered Cards & Workspace-wide Calendar Data
  const filteredCards = useMemo(() => filterCards(board.cards, filters), [board.cards, filters]);
  const allWorkspaceCards = useMemo(() => getAllWorkspaceCards(workspace, 'all'), [workspace]);
  const allWorkspaceLabels = useMemo(() => getWorkspaceLabels(workspace), [workspace]);
  const cardBoardMetaMap = useMemo(() => getCardBoardMetaMap(workspace), [workspace]);
  const calendarFilteredCards = useMemo(
    () => filterCards(getAllWorkspaceCards(workspace, calendarBoardFilter), filters),
    [workspace, calendarBoardFilter, filters]
  );
  const scheduledCards = useMemo(
    () => allWorkspaceCards.filter((c) => Boolean(c.startDate)),
    [allWorkspaceCards]
  );
  const pendingSyncCards = useMemo(
    () => getCardsPendingGoogleSync(allWorkspaceCards),
    [allWorkspaceCards]
  );
  const toolbarLabels = useMemo(() => {
    if (viewMode === 'board') return board.labels;
    if (calendarBoardFilter === 'all') return allWorkspaceLabels;
    return workspace.boards.find((b) => b.id === calendarBoardFilter)?.state.labels ?? allWorkspaceLabels;
  }, [viewMode, board.labels, calendarBoardFilter, allWorkspaceLabels, workspace.boards]);

  const openEditCardModal = (card: CardItem) => {
    const ownerBoardId = cardBoardMetaMap.get(card.id)?.boardId ?? activeBoard.id;
    setCardModalState({
      isOpen: true,
      card,
      boardId: ownerBoardId,
      defaultListId: card.listId,
    });
  };

  // Workspace Multi-Board Handlers
  const handleSelectBoard = (boardId: string) => {
    setWorkspace((prev) =>
      prev.boards.some((b) => b.id === boardId) ? { ...prev, activeBoardId: boardId } : prev
    );
    setFilters({ search: '', labelId: 'all' });
    setDraggedCardId(null);
    setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }));
  };

  const handleCreateBoard = (title: string, color: LabelColor) => {
    const clean = title.trim();
    if (!clean) return;
    setWorkspace((prev) => addBoardToWorkspace(prev, clean, color));
    setFilters({ search: '', labelId: 'all' });
    setDraggedCardId(null);
    setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }));
    setNotice({ kind: 'success', text: `Доска «${clean}» создана` });
  };

  const handleRenameBoard = (boardId: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setWorkspace((prev) => renameBoardInWorkspace(prev, boardId, clean));
    setNotice({ kind: 'success', text: `Доска переименована в «${clean}»` });
  };

  const handleDeleteBoard = (boardId: string) => {
    const target = workspace.boards.find((b) => b.id === boardId);
    if (!target || workspace.boards.length <= 1) return;
    setWorkspace((prev) => deleteBoardFromWorkspace(prev, boardId));
    if (calendarBoardFilter === boardId) {
      setCalendarBoardFilter('all');
    }
    setFilters({ search: '', labelId: 'all' });
    setDraggedCardId(null);
    setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }));
    setNotice({ kind: 'success', text: `Доска «${target.title}» удалена` });
  };

  // Habits Handlers
  const handleToggleHabitDay = (habitId: string, dateKey: string) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? toggleOrIncrementHabitDay(h, dateKey) : h))
    );
  };

  const handleAdjustHabitCount = (habitId: string, dateKey: string, delta: number) => {
    setHabits((prev) =>
      prev.map((h) => (h.id === habitId ? adjustHabitDayCount(h, dateKey, delta) : h))
    );
  };

  const handleCreateHabit = (payload: {
    title: string;
    color: LabelColor;
    daysOfWeek: number[];
    targetCount: number;
    unit: string;
  }) => {
    setHabits((prev) => [
      ...prev,
      createHabitItem({
        ...payload,
        order: prev.length,
      }),
    ]);
    setNotice({ kind: 'success', text: `Привычка «${payload.title}» добавлена` });
  };

  const handleUpdateHabit = (
    habitId: string,
    payload: {
      title: string;
      color: LabelColor;
      daysOfWeek: number[];
      targetCount: number;
      unit: string;
    }
  ) => {
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? {
              ...h,
              title: payload.title.trim().slice(0, 120) || h.title,
              color: payload.color,
              daysOfWeek: payload.daysOfWeek.length > 0 ? payload.daysOfWeek : h.daysOfWeek,
              targetCount: Math.max(1, Math.min(100, Math.round(payload.targetCount || 1))),
              unit: payload.unit.trim().slice(0, 24) || 'раз',
            }
          : h
      )
    );
    setNotice({ kind: 'success', text: `Привычка «${payload.title}» обновлена` });
  };

  const handleDeleteHabit = (habitId: string) => {
    const target = habits.find((h) => h.id === habitId);
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    if (target) {
      setNotice({ kind: 'success', text: `Привычка «${target.title}» удалена` });
    }
  };

  const handleSeedStarterHabits = () => {
    setHabits(createInitialHabits(new Date()));
    setNotice({ kind: 'success', text: 'Базовый набор привычек добавлен' });
  };

  // Notebook Handlers
  const handleCreateNoteFolder = (payload: {
    title: string;
    parentId: string | null;
    color: LabelColor;
  }): NoteFolder => {
    const created = createNoteFolder({
      title: payload.title,
      parentId: payload.parentId,
      color: payload.color,
      order: noteFolders.length,
    });
    setNoteFolders((prev) => [...prev, created]);
    setNotice({ kind: 'success', text: `Папка «${created.title}» создана` });
    return created;
  };

  const handleRenameNoteFolder = (folderId: string, title: string, color?: LabelColor) => {
    const clean = title.trim().slice(0, 100);
    if (!clean) return;
    setNoteFolders((prev) =>
      prev.map((f) =>
        f.id === folderId ? { ...f, title: clean, color: color ?? f.color } : f
      )
    );
    setNotice({ kind: 'success', text: `Папка «${clean}» обновлена` });
  };

  const handleDeleteNoteFolder = (folderId: string) => {
    const target = noteFolders.find((f) => f.id === folderId);
    const promoted = removeFolderAndPromoteChildren(noteFolders, notes, folderId);
    setNoteFolders(promoted.folders);
    setNotes(promoted.notes);
    if (target) {
      setNotice({ kind: 'success', text: `Папка «${target.title}» удалена, заметки сохранены` });
    }
  };

  const handleCreateNote = (payload?: { folderId?: string | null; title?: string }): NotePage => {
    const created = createNotePage({
      folderId: payload?.folderId ?? null,
      title: payload?.title ?? 'Новая заметка',
      order: notes.length,
    });
    setNotes((prev) => [created, ...prev]);
    return created;
  };

  const handleUpdateNote = useCallback(
    (noteId: string, updater: (prev: NotePage) => NotePage) => {
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updater(n) : n)));
    },
    []
  );

  const handleDeleteNote = (noteId: string) => {
    const target = notes.find((n) => n.id === noteId);
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (target) {
      setNotice({ kind: 'success', text: `Заметка «${target.title}» удалена` });
    }
  };

  const handleSeedStarterNotes = () => {
    setNoteFolders(createInitialNoteFolders());
    setNotes(createInitialNotes(Date.now()));
    setNotice({ kind: 'success', text: 'Стартовый блокнот добавлен' });
  };

  // Finance Handlers
  const handleSaveFinanceTransaction = (payload: {
    id?: string;
    kind: FinanceTransactionKind;
    amount: number;
    categoryId: string | null;
    accountId: string;
    toAccountId: string | null;
    date: string;
    note: string;
    isRecurring: boolean;
  }) => {
    if (payload.id) {
      setFinanceTransactions((prev) =>
        prev.map((tx) =>
          tx.id === payload.id
            ? createFinanceTransaction({
                ...payload,
                id: tx.id,
                createdAtMs: tx.createdAtMs,
              })
            : tx
        )
      );
      setNotice({ kind: 'success', text: 'Операция обновлена' });
    } else {
      const created = createFinanceTransaction(payload);
      setFinanceTransactions((prev) => [created, ...prev]);
      setNotice({ kind: 'success', text: 'Операция добавлена' });
    }
  };

  const handleDeleteFinanceTransaction = (transactionId: string) => {
    setFinanceTransactions((prev) => prev.filter((t) => t.id !== transactionId));
    setNotice({ kind: 'success', text: 'Операция удалена' });
  };

  const handleSaveFinanceCategory = (payload: {
    id?: string;
    name: string;
    kind: FinanceCategoryKind;
    monthlyLimit: number | null;
    color: LabelColor;
  }) => {
    if (payload.id) {
      setFinanceCategories((prev) =>
        prev.map((cat, idx) =>
          cat.id === payload.id
            ? createFinanceCategory({ ...payload, id: cat.id, order: idx })
            : cat
        )
      );
      setNotice({ kind: 'success', text: `Категория «${payload.name}» обновлена` });
    } else {
      setFinanceCategories((prev) => [
        ...prev,
        createFinanceCategory({ ...payload, order: prev.length }),
      ]);
      setNotice({ kind: 'success', text: `Категория «${payload.name}» создана` });
    }
  };

  const handleDeleteFinanceCategory = (categoryId: string) => {
    const target = financeCategories.find((c) => c.id === categoryId);
    setFinanceCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setFinanceTransactions((prev) =>
      prev.map((t) => (t.categoryId === categoryId ? { ...t, categoryId: null } : t))
    );
    if (target) {
      setNotice({ kind: 'success', text: `Категория «${target.name}» удалена` });
    }
  };

  const handleSaveFinanceAccount = (payload: {
    id?: string;
    title: string;
    type: FinanceAccountType;
    initialBalance: number;
    color: LabelColor;
  }) => {
    if (payload.id) {
      setFinanceAccounts((prev) =>
        prev.map((acc, idx) =>
          acc.id === payload.id
            ? createFinanceAccount({ ...payload, id: acc.id, order: idx })
            : acc
        )
      );
      setNotice({ kind: 'success', text: `Счёт «${payload.title}» обновлён` });
    } else {
      setFinanceAccounts((prev) => [
        ...prev,
        createFinanceAccount({ ...payload, order: prev.length }),
      ]);
      setNotice({ kind: 'success', text: `Счёт «${payload.title}» добавлен` });
    }
  };

  const handleDeleteFinanceAccount = (accountId: string) => {
    if (financeAccounts.length <= 1) return;
    const target = financeAccounts.find((a) => a.id === accountId);
    const remaining = financeAccounts.filter((a) => a.id !== accountId);
    const fallbackAccountId = remaining[0].id;
    setFinanceAccounts(remaining);
    setFinanceTransactions((prev) =>
      prev
        .filter((t) => !(t.kind === 'transfer' && (t.accountId === accountId || t.toAccountId === accountId)))
        .map((t) => (t.accountId === accountId ? { ...t, accountId: fallbackAccountId } : t))
    );
    if (target) {
      setNotice({ kind: 'success', text: `Счёт «${target.title}» удалён` });
    }
  };

  const handleSaveFinanceGoal = (payload: {
    id?: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string | null;
    color: LabelColor;
  }) => {
    if (payload.id) {
      setFinanceGoals((prev) =>
        prev.map((g, idx) =>
          g.id === payload.id ? createFinanceGoal({ ...payload, id: g.id, order: idx }) : g
        )
      );
      setNotice({ kind: 'success', text: `Цель «${payload.title}» обновлена` });
    } else {
      setFinanceGoals((prev) => [
        ...prev,
        createFinanceGoal({ ...payload, order: prev.length }),
      ]);
      setNotice({ kind: 'success', text: `Цель «${payload.title}» создана` });
    }
  };

  const handleDeleteFinanceGoal = (goalId: string) => {
    const target = financeGoals.find((g) => g.id === goalId);
    setFinanceGoals((prev) => prev.filter((g) => g.id !== goalId));
    if (target) {
      setNotice({ kind: 'success', text: `Цель «${target.title}» удалена` });
    }
  };

  const handleContributeFinanceGoal = (goalId: string, deltaAmount: number) => {
    setFinanceGoals((prev) =>
      prev.map((g) => (g.id === goalId ? applyGoalContribution(g, deltaAmount) : g))
    );
  };

  const handleSeedStarterFinance = () => {
    setFinanceAccounts(createInitialFinanceAccounts());
    setFinanceCategories(createInitialFinanceCategories());
    setFinanceTransactions(createInitialFinanceTransactions(new Date()));
    setFinanceGoals(createInitialFinanceGoals());
    setNotice({ kind: 'success', text: 'Шаблон личного бюджета добавлен' });
  };

  // Board Handlers
  const handleAddCardInline = (listId: string, title: string) => {
    setBoard((prev) => {
      const listCards = prev.cards.filter((c) => c.listId === listId);
      const maxOrder = listCards.reduce((m, c) => Math.max(m, c.order), -1);
      const newCard: CardItem = {
        id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        listId,
        order: maxOrder + 1,
        title,
        description: '',
        labelIds: [],
        checklist: [],
        startDate: null,
        endDate: null,
        dueDate: null,
      };
      return { ...prev, cards: [...prev.cards, newCard] };
    });
  };

  const handleMoveCard = (cardId: string, targetListId: string, targetIndex?: number) => {
    setBoard((prev) => ({
      ...prev,
      cards: moveCardInBoard(prev.cards, cardId, targetListId, targetIndex),
    }));
  };

  const handleAddList = (title: string) => {
    setBoard((prev) => addListToBoard(prev, title));
  };

  const handleRenameList = (listId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => (l.id === listId ? { ...l, title } : l)),
    }));
  };

  const handleDeleteList = (listId: string) => {
    setBoard((prev) => {
      const remainingLists = prev.lists.filter((l) => l.id !== listId);
      if (remainingLists.length === 0) return prev;
      const fallbackListId = remainingLists[0].id;
      const updatedCards = prev.cards.map((c) =>
        c.listId === listId ? { ...c, listId: fallbackListId } : c
      );
      return {
        ...prev,
        lists: remainingLists,
        cards: updatedCards,
      };
    });
  };

  const handleSaveCard = (saved: CardItem, isNew: boolean, targetBoardId: string) => {
    const previous = findCardInWorkspace(workspace, saved.id)?.card;
    setWorkspace((prev) => saveCardInWorkspace(prev, saved, isNew, targetBoardId));
    setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }));

    const isConnected = Boolean(googleUser) && !needsAuth;
    if (saved.startDate && saved.syncDirty) {
      if (isConnected) {
        promptGoogleSyncForCard(saved);
      } else {
        setNotice({
          kind: 'success',
          text: 'Время сохранено. Подключите Google для синхронизации.',
        });
      }
    } else if (!saved.startDate && previous?.googleEventId && isConnected) {
      handleRequestGoogleDelete(previous);
    }
  };

  const handleDeleteCard = (cardId: string) => {
    setWorkspace((prev) => deleteCardInWorkspace(prev, cardId));
    setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }));
  };

  const maybePromptGoogleSyncAfterSchedule = (updatedCard: CardItem, fallbackNotice?: string) => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setShowBacklogSidebar(false);
    }
    const isConnected = Boolean(googleUser) && !needsAuth;
    if (isConnected) {
      promptGoogleSyncForCard(updatedCard);
    } else if (fallbackNotice) {
      setNotice({ kind: 'success', text: fallbackNotice });
    }
  };

  // Planyway Scheduling Handlers (across all boards)
  const handleScheduleCardAtSlot = (cardId: string, dateKey: string, hour: number) => {
    const found = findCardInWorkspace(workspace, cardId);
    if (!found) return;
    const updated = scheduleCardAtSlot(found.card, dateKey, hour);
    setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
    setDraggedCardId(null);
    maybePromptGoogleSyncAfterSchedule(
      updated,
      `Задача «${updated.title}» перенесена на ${pad2(hour)}:00`
    );
  };

  const handleScheduleCardAllDay = (cardId: string, dateKey: string) => {
    const found = findCardInWorkspace(workspace, cardId);
    if (!found) return;
    const updated = scheduleCardForDaySpan(found.card, dateKey, 1);
    setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
    setDraggedCardId(null);
    maybePromptGoogleSyncAfterSchedule(
      updated,
      `Задача «${updated.title}» запланирована на весь день`
    );
  };

  const handleAdjustCardDuration = (cardId: string, deltaMinutes: number) => {
    const found = findCardInWorkspace(workspace, cardId);
    if (!found) return;
    const updated = adjustCardDurationMinutes(found.card, deltaMinutes);
    setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
    maybePromptGoogleSyncAfterSchedule(updated);
  };

  const handleScheduleCardOnDay = (cardId: string, dateKey: string) => {
    const found = findCardInWorkspace(workspace, cardId);
    if (!found) return;
    const updated = scheduleCardForDaySpan(found.card, dateKey, 1);
    setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
    setDraggedCardId(null);
    maybePromptGoogleSyncAfterSchedule(
      updated,
      `Задача «${updated.title}» запланирована на ${dateKey}`
    );
  };

  const handleScheduleCardOnTimeline = (
    cardId: string,
    dateKey: string,
    laneId: string,
    groupBy: TimelineGroupBy
  ) => {
    const found = findCardInWorkspace(workspace, cardId);
    if (!found) return;
    let updated = found.card.startDate
      ? scheduleCardForDaySpan(found.card, dateKey, 1)
      : scheduleCardForDaySpan(found.card, dateKey, 2);

    if (groupBy === 'board') {
      setWorkspace((prev) => saveCardInWorkspace(prev, updated, false, laneId));
    } else if (groupBy === 'label') {
      updated = {
        ...updated,
        labelIds: laneId === 'unlabeled' ? [] : [laneId],
      };
      setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
    } else {
      const targetBoard = workspace.boards.find((b) => b.state.lists.some((l) => l.id === laneId));
      updated = {
        ...updated,
        listId: laneId,
      };
      if (targetBoard && targetBoard.id !== found.board.id) {
        setWorkspace((prev) => saveCardInWorkspace(prev, updated, false, targetBoard.id));
      } else {
        setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
      }
    }

    setDraggedCardId(null);
    maybePromptGoogleSyncAfterSchedule(
      updated,
      `Задача «${updated.title}» обновлена на таймлайне`
    );
  };

  const handleShiftCardDays = (cardId: string, deltaDays: number) => {
    const found = findCardInWorkspace(workspace, cardId);
    if (!found) return;
    const updated = shiftCardDatesByDays(found.card, deltaDays);
    setWorkspace((prev) => updateCardInWorkspace(prev, cardId, () => updated));
    maybePromptGoogleSyncAfterSchedule(updated);
  };

  const handleQuickScheduleToday = (card: CardItem) => {
    const todayKey = toLocalDateKey(new Date());
    const updated = scheduleCardAtSlot(card, todayKey, 10, 60);
    setWorkspace((prev) => updateCardInWorkspace(prev, card.id, () => updated));
    maybePromptGoogleSyncAfterSchedule(
      updated,
      `Задача «${card.title}» запланирована на сегодня (10:00)`
    );
  };

  // Date Navigation
  const handleNavigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setAnchorDate(new Date());
      return;
    }
    const delta = direction === 'next' ? 1 : -1;
    setAnchorDate((prev) => {
      if (viewMode === 'month') {
        return new Date(prev.getFullYear(), prev.getMonth() + delta, 1);
      }
      if (viewMode === 'timeline') {
        return addDays(prev, delta * 7);
      }
      return addDays(prev, delta * 7);
    });
  };

  // Google Calendar Mutations (ALWAYS gated by ConfirmActionModal)
  const targetCalendar = useMemo(
    () => calendars.find((c) => c.id === targetCalendarId) ?? calendars[0] ?? null,
    [calendars, targetCalendarId]
  );

  const promptGoogleSyncForCard = (card: CardItem) => {
    const calId = card.googleCalendarId || targetCalendarId || 'primary';
    const calName =
      calendars.find((c) => c.id === calId)?.summary || targetCalendar?.summary || 'Основной календарь';
    const isUpdate = Boolean(card.googleEventId);

    setPendingMutation({
      type: isUpdate ? 'update' : 'create',
      title: isUpdate
        ? 'Обновить событие в Google Calendar?'
        : 'Создать событие в Google Calendar?',
      description: isUpdate
        ? 'Время или детали задачи изменились. Обновить связанное событие в Google Calendar?'
        : 'Для этой задачи указано время. Создать событие в вашем Google Calendar?',
      calendarId: calId,
      calendarName: calName,
      card,
    });
  };

  const handleRequestGoogleCreateOrUpdate = (card: CardItem) => {
    // Save local edits first across whichever board owns this card
    setWorkspace((prev) => updateCardInWorkspace(prev, card.id, () => card));

    promptGoogleSyncForCard(card);
  };

  const handleRequestGoogleDelete = (card: CardItem) => {
    if (!card.googleEventId) return;
    const calId = card.googleCalendarId || targetCalendarId || 'primary';
    const calName =
      calendars.find((c) => c.id === calId)?.summary || targetCalendar?.summary || 'Основной календарь';

    setPendingMutation({
      type: 'delete',
      title: 'Удалить событие из Google Calendar?',
      description:
        'Событие будет удалено из вашего Google Календаря. Карточка на доске RST сохранится.',
      calendarId: calId,
      calendarName: calName,
      card,
    });
  };

  const handleRequestBatchSync = (onlyPending = false) => {
    const listToSync = onlyPending && pendingSyncCards.length > 0 ? pendingSyncCards : scheduledCards;
    if (listToSync.length === 0) return;
    const calId = targetCalendarId || 'primary';
    const calName =
      calendars.find((c) => c.id === calId)?.summary || targetCalendar?.summary || 'Основной календарь';

    setPendingMutation({
      type: 'batch_sync',
      title: 'Синхронизировать задачи с Google Calendar?',
      description:
        'Запланированные задачи доски будут созданы или обновлены в выбранном Google Календаре.',
      calendarId: calId,
      calendarName: calName,
      cards: listToSync,
    });
  };

  const executePendingGoogleMutation = async () => {
    if (!pendingMutation) return;
    const token = await getAccessToken();
    if (!token) {
      setPendingMutation(null);
      setNeedsAuth(true);
      setIsGoogleDrawerOpen(true);
      setAuthError('Необходимо снова войти в Google для выполнения действия.');
      return;
    }

    const findListTitleAcrossWorkspace = (listId: string) => {
      for (const b of workspace.boards) {
        const found = b.state.lists.find((l) => l.id === listId);
        if (found) return found.title;
      }
      return undefined;
    };

    const updateCardsAcrossWorkspace = (updater: (cards: CardItem[]) => CardItem[]) => {
      setWorkspace((prevWs) => ({
        ...prevWs,
        boards: prevWs.boards.map((b) => ({
          ...b,
          state: {
            ...b.state,
            cards: updater(b.state.cards),
          },
        })),
      }));
    };

    setIsMutatingGoogle(true);
    try {
      if (pendingMutation.type === 'create' && pendingMutation.card) {
        const card = pendingMutation.card;
        const listTitle = findListTitleAcrossWorkspace(card.listId);
        const created = await createCalendarEvent(token, pendingMutation.calendarId, card, listTitle);
        const nowIso = new Date().toISOString();
        updateCardsAcrossWorkspace((cards) =>
          cards.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  googleEventId: created.id,
                  googleCalendarId: pendingMutation.calendarId,
                  lastSyncedAt: nowIso,
                  syncDirty: false,
                }
              : c
          )
        );
        setNotice({ kind: 'success', text: `Событие «${card.title}» добавлено в Google Calendar` });
      } else if (pendingMutation.type === 'update' && pendingMutation.card) {
        const card = pendingMutation.card;
        const listTitle = findListTitleAcrossWorkspace(card.listId);
        await updateCalendarEvent(
          token,
          pendingMutation.calendarId,
          card.googleEventId!,
          card,
          listTitle
        );
        updateCardsAcrossWorkspace((cards) =>
          cards.map((c) =>
            c.id === card.id
              ? { ...c, lastSyncedAt: new Date().toISOString(), syncDirty: false }
              : c
          )
        );
        setNotice({ kind: 'success', text: `Событие «${card.title}» обновлено в Google Calendar` });
      } else if (pendingMutation.type === 'delete' && pendingMutation.card) {
        const card = pendingMutation.card;
        await deleteCalendarEvent(token, pendingMutation.calendarId, card.googleEventId!);
        updateCardsAcrossWorkspace((cards) =>
          cards.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  googleEventId: null,
                  googleCalendarId: null,
                  lastSyncedAt: null,
                  syncDirty: false,
                }
              : c
          )
        );
        setNotice({ kind: 'success', text: `Событие «${card.title}» удалено из Google Calendar` });
      } else if (pendingMutation.type === 'batch_sync' && pendingMutation.cards) {
        const nowIso = new Date().toISOString();
        const updates = new Map<string, { eventId: string; calendarId: string }>();

        for (const card of pendingMutation.cards) {
          const listTitle = findListTitleAcrossWorkspace(card.listId);
          if (card.googleEventId && card.googleCalendarId) {
            await updateCalendarEvent(
              token,
              card.googleCalendarId,
              card.googleEventId,
              card,
              listTitle
            );
            updates.set(card.id, {
              eventId: card.googleEventId,
              calendarId: card.googleCalendarId,
            });
          } else {
            const created = await createCalendarEvent(
              token,
              pendingMutation.calendarId,
              card,
              listTitle
            );
            updates.set(card.id, {
              eventId: created.id,
              calendarId: pendingMutation.calendarId,
            });
          }
        }

        updateCardsAcrossWorkspace((cards) =>
          cards.map((c) => {
            const info = updates.get(c.id);
            return info
              ? {
                  ...c,
                  googleEventId: info.eventId,
                  googleCalendarId: info.calendarId,
                  lastSyncedAt: nowIso,
                  syncDirty: false,
                }
              : c;
          })
        );
        setNotice({
          kind: 'success',
          text: `Синхронизировано задач с Google Calendar: ${updates.size}`,
        });
      }

      setPendingMutation(null);
      setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }));
      await loadCalendarsAndEvents();
    } catch (err) {
      if (err instanceof CalendarAuthExpiredError) {
        clearCachedToken();
        setNeedsAuth(true);
        setAuthError(err.message);
      }
      setNotice({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Ошибка синхронизации с Google Calendar',
      });
      setPendingMutation(null);
    } finally {
      setIsMutatingGoogle(false);
    }
  };

  // Import Google Event as Board Card
  const handleImportGoogleEventAsCard = (
    ev: GoogleCalendarEvent,
    listId: string,
    targetBoardId?: string
  ) => {
    const resolvedBoardId = targetBoardId ?? activeBoard.id;
    const startVal = ev.allDay
      ? ev.start.slice(0, 10)
      : toLocalDateTimeInput(new Date(ev.start));
    const endVal = ev.allDay
      ? ev.start.slice(0, 10)
      : toLocalDateTimeInput(new Date(ev.end));

    const newCard: CardItem = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      listId,
      order: 0,
      title: ev.summary,
      description: ev.description || '',
      labelIds: ['lbl-meeting'],
      checklist: [],
      startDate: startVal,
      endDate: endVal,
      allDay: ev.allDay,
      dueDate: startVal.slice(0, 10),
      googleEventId: ev.id,
      googleCalendarId: ev.calendarId,
      lastSyncedAt: new Date().toISOString(),
    };

    setWorkspace((prev) => saveCardInWorkspace(prev, newCard, true, resolvedBoardId));
    setSelectedGoogleEvent(null);
    const boardTitle = workspace.boards.find((b) => b.id === resolvedBoardId)?.title;
    setNotice({
      kind: 'success',
      text: boardTitle
        ? `Карточка «${ev.summary}» создана на доске «${boardTitle}»`
        : `Карточка «${ev.summary}» создана на доске`,
    });
  };

  const isGoogleConnected = Boolean(googleUser) && !needsAuth;

  if ((!isAuthChecked || (googleUser && isWorkspaceSyncing && loadedUidRef.current !== googleUser.uid)) && !isOfflineOrGuest) {
    return (
      <div className="h-dvh w-full bg-slate-50 flex items-center justify-center text-slate-500 text-xs font-medium">
        Загрузка RST...
      </div>
    );
  }

  if (!googleUser && !isOfflineOrGuest) {
    return (
      <AuthGateScreen
        isLoggingIn={isLoggingIn}
        authError={authError}
        onLogin={() => void handleGoogleLogin()}
      />
    );
  }

  const isPlanView =
    viewMode === 'board' ||
    viewMode === 'week' ||
    viewMode === 'month' ||
    viewMode === 'timeline';

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
      <TopBar
        viewMode={viewMode}
        onSelectSection={handleSelectSection}
        isSignedIn={Boolean(googleUser) || isGuestMode}
        isGoogleConnected={isGoogleConnected}
        googleUserEmail={googleUser?.email ?? (isGuestMode ? 'Демо-режим' : null)}
        pendingSyncCount={pendingSyncCards.length}
        onOpenGoogleDrawer={() => setIsGoogleDrawerOpen(true)}
        onLogout={() => {
          if (googleUser) {
            void handleGoogleLogout();
          } else {
            setIsGuestMode(false);
          }
        }}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
      />

      {isPlanView && (
        <WorkspaceToolbar
          viewMode={viewMode}
          onChangePlanView={handleChangePlanView}
          boards={workspace.boards}
          activeBoardId={activeBoard.id}
          onSelectBoard={handleSelectBoard}
          onCreateBoard={handleCreateBoard}
          onRenameBoard={handleRenameBoard}
          onDeleteBoard={handleDeleteBoard}
          anchorDate={anchorDate}
          onNavigateDate={handleNavigateDate}
          filters={filters}
          onChangeFilters={setFilters}
          labels={toolbarLabels}
          timelineGroupBy={timelineGroupBy}
          onChangeTimelineGroupBy={setTimelineGroupBy}
          timelineDaysCount={timelineDaysCount}
          onChangeTimelineDaysCount={setTimelineDaysCount}
          showBacklogSidebar={showBacklogSidebar}
          onToggleBacklogSidebar={() => setShowBacklogSidebar((v) => !v)}
          pendingSyncCount={pendingSyncCards.length}
          isGoogleConnected={isGoogleConnected}
          onSyncPendingToGoogle={() => {
            if (isGoogleConnected) {
              handleRequestBatchSync(true);
            } else {
              setIsGoogleDrawerOpen(true);
            }
          }}
          onOpenNewCardModal={() => {
            const preferredBoard =
              viewMode !== 'board' && calendarBoardFilter !== 'all'
                ? workspace.boards.find((b) => b.id === calendarBoardFilter) ?? activeBoard
                : activeBoard;
            setCardModalState({
              isOpen: true,
              card: null,
              boardId: preferredBoard.id,
              defaultListId: preferredBoard.state.lists[0]?.id ?? 'list-backlog',
            });
          }}
          onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500">
              Загрузка раздела...
            </div>
          }
        >
          {viewMode === 'sport' ? (
            <UpcomingModuleView
              section={viewMode}
              onGoToPlan={() => handleSelectSection('plan')}
            />
          ) : viewMode === 'finance' ? (
            <FinanceView
              accounts={financeAccounts}
              categories={financeCategories}
              transactions={financeTransactions}
              goals={financeGoals}
              currency={financeCurrency}
              onChangeCurrency={setFinanceCurrency}
              onSaveTransaction={handleSaveFinanceTransaction}
              onDeleteTransaction={handleDeleteFinanceTransaction}
              onSaveCategory={handleSaveFinanceCategory}
              onDeleteCategory={handleDeleteFinanceCategory}
              onSaveAccount={handleSaveFinanceAccount}
              onDeleteAccount={handleDeleteFinanceAccount}
              onSaveGoal={handleSaveFinanceGoal}
              onDeleteGoal={handleDeleteFinanceGoal}
              onContributeGoal={handleContributeFinanceGoal}
              onSeedStarterFinance={handleSeedStarterFinance}
            />
          ) : viewMode === 'notes' ? (
            <NotesView
              folders={noteFolders}
              notes={notes}
              onCreateFolder={handleCreateNoteFolder}
              onRenameFolder={handleRenameNoteFolder}
              onDeleteFolder={handleDeleteNoteFolder}
              onCreateNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onSeedStarterNotes={handleSeedStarterNotes}
            />
          ) : viewMode === 'habits' ? (
            <HabitsView
              habits={habits}
              onToggleHabitDay={handleToggleHabitDay}
              onAdjustHabitCount={handleAdjustHabitCount}
              onCreateHabit={handleCreateHabit}
              onUpdateHabit={handleUpdateHabit}
              onDeleteHabit={handleDeleteHabit}
              onSeedStarterHabits={handleSeedStarterHabits}
            />
          ) : viewMode === 'board' ? (
            <KanbanBoard
              lists={board.lists}
              cards={filteredCards}
              labels={board.labels}
              onSelectCard={openEditCardModal}
              onQuickScheduleToday={handleQuickScheduleToday}
              onAddCard={handleAddCardInline}
              onMoveCard={handleMoveCard}
              onAddList={handleAddList}
              onRenameList={handleRenameList}
              onDeleteList={handleDeleteList}
            />
          ) : (
            <>
              {showBacklogSidebar && (
                <PlannerBacklogSidebar
                  boards={workspace.boards}
                  selectedBoardFilter={calendarBoardFilter}
                  onChangeBoardFilter={setCalendarBoardFilter}
                  filters={filters}
                  onSelectCard={openEditCardModal}
                  onQuickScheduleToday={handleQuickScheduleToday}
                  onDragStartCard={setDraggedCardId}
                  onDragEndCard={() => setDraggedCardId(null)}
                  onCloseMobile={() => setShowBacklogSidebar(false)}
                />
              )}

              {viewMode === 'week' && (
                <WeekPlannerView
                  anchorDate={anchorDate}
                  cards={calendarFilteredCards}
                  labels={allWorkspaceLabels}
                  boardMetaByCardId={cardBoardMetaMap}
                  showBoardBadge={workspace.boards.length > 1}
                  googleEvents={googleEvents}
                  draggedCardId={draggedCardId}
                  onDragStartCard={setDraggedCardId}
                  onDragEndCard={() => setDraggedCardId(null)}
                  onSelectCard={openEditCardModal}
                  onSelectGoogleEvent={setSelectedGoogleEvent}
                  onScheduleCardAtSlot={handleScheduleCardAtSlot}
                  onScheduleCardAllDay={handleScheduleCardAllDay}
                  onAdjustCardDuration={handleAdjustCardDuration}
                  onCreateCardAtSlot={(dateKey, hour) => {
                    const preferredBoard =
                      calendarBoardFilter !== 'all'
                        ? workspace.boards.find((b) => b.id === calendarBoardFilter) ?? activeBoard
                        : activeBoard;
                    setCardModalState({
                      isOpen: true,
                      card: null,
                      boardId: preferredBoard.id,
                      defaultListId: preferredBoard.state.lists[0]?.id ?? 'list-planned',
                      defaultStartDate: `${dateKey}T${pad2(hour)}:00`,
                      defaultEndDate: `${dateKey}T${pad2(hour + 1)}:00`,
                      defaultAllDay: false,
                    });
                  }}
                />
              )}

              {viewMode === 'month' && (
                <MonthPlannerView
                  anchorDate={anchorDate}
                  cards={calendarFilteredCards}
                  labels={allWorkspaceLabels}
                  boardMetaByCardId={cardBoardMetaMap}
                  showBoardBadge={workspace.boards.length > 1}
                  googleEvents={googleEvents}
                  draggedCardId={draggedCardId}
                  onDragStartCard={setDraggedCardId}
                  onDragEndCard={() => setDraggedCardId(null)}
                  onSelectCard={openEditCardModal}
                  onSelectGoogleEvent={setSelectedGoogleEvent}
                  onScheduleCardOnDay={handleScheduleCardOnDay}
                  onCreateCardOnDay={(dateKey) => {
                    const preferredBoard =
                      calendarBoardFilter !== 'all'
                        ? workspace.boards.find((b) => b.id === calendarBoardFilter) ?? activeBoard
                        : activeBoard;
                    setCardModalState({
                      isOpen: true,
                      card: null,
                      boardId: preferredBoard.id,
                      defaultListId: preferredBoard.state.lists[0]?.id ?? 'list-planned',
                      defaultStartDate: dateKey,
                      defaultEndDate: dateKey,
                      defaultAllDay: true,
                    });
                  }}
                />
              )}

              {viewMode === 'timeline' && (
                <TimelinePlannerView
                  anchorDate={anchorDate}
                  daysCount={timelineDaysCount}
                  groupBy={timelineGroupBy}
                  cards={calendarFilteredCards}
                  lists={
                    calendarBoardFilter === 'all'
                      ? board.lists
                      : (workspace.boards.find((b) => b.id === calendarBoardFilter)?.state.lists ??
                          board.lists)
                  }
                  labels={allWorkspaceLabels}
                  boards={workspace.boards}
                  boardMetaByCardId={cardBoardMetaMap}
                  showBoardBadge={workspace.boards.length > 1}
                  googleEvents={googleEvents}
                  draggedCardId={draggedCardId}
                  onDragStartCard={setDraggedCardId}
                  onDragEndCard={() => setDraggedCardId(null)}
                  onSelectCard={openEditCardModal}
                  onSelectGoogleEvent={setSelectedGoogleEvent}
                  onScheduleCardOnTimeline={handleScheduleCardOnTimeline}
                  onShiftCardDays={handleShiftCardDays}
                  onCreateCardInLane={(dateKey, laneId, groupBy) => {
                    if (groupBy === 'board') {
                      const laneBoard =
                        workspace.boards.find((b) => b.id === laneId) ?? activeBoard;
                      setCardModalState({
                        isOpen: true,
                        card: null,
                        boardId: laneBoard.id,
                        defaultListId: laneBoard.state.lists[0]?.id ?? 'list-planned',
                        defaultStartDate: dateKey,
                        defaultEndDate: dateKey,
                        defaultAllDay: true,
                      });
                      return;
                    }
                    const preferredBoard =
                      calendarBoardFilter !== 'all'
                        ? workspace.boards.find((b) => b.id === calendarBoardFilter) ?? activeBoard
                        : activeBoard;
                    setCardModalState({
                      isOpen: true,
                      card: null,
                      boardId: preferredBoard.id,
                      defaultListId:
                        groupBy === 'list' ? laneId : preferredBoard.state.lists[0]?.id ?? 'list-planned',
                      defaultStartDate: dateKey,
                      defaultEndDate: dateKey,
                      defaultAllDay: true,
                    });
                  }}
                />
              )}
            </>
          )}
        </Suspense>

        {/* Transient Action Notice */}
        {notice && (
          <div
            role="status"
            className={`fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-5 right-3 md:right-5 left-3 md:left-auto z-50 px-4 py-2.5 rounded-lg border shadow-md text-xs font-medium flex items-center justify-center md:justify-start gap-2 ${
              notice.kind === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-slate-900 text-white border-slate-800'
            }`}
          >
            <span>{notice.text}</span>
          </div>
        )}
      </main>

      <MobileBottomNav viewMode={viewMode} onSelectSection={handleSelectSection} />
      <OfflineIndicator />

      <Suspense fallback={null}>
        {cardModalState.isOpen && (
          <CardModal
            isOpen={cardModalState.isOpen}
            card={cardModalState.card}
            boards={workspace.boards}
            initialBoardId={cardModalState.boardId ?? activeBoard.id}
            defaultListId={cardModalState.defaultListId}
            defaultStartDate={cardModalState.defaultStartDate}
            defaultEndDate={cardModalState.defaultEndDate}
            defaultAllDay={cardModalState.defaultAllDay}
            isGoogleConnected={isGoogleConnected}
            targetCalendar={targetCalendar}
            onSave={handleSaveCard}
            onDelete={handleDeleteCard}
            onClose={() => setCardModalState((prev) => ({ ...prev, isOpen: false, card: null }))}
            onRequestGoogleCreateOrUpdate={handleRequestGoogleCreateOrUpdate}
            onRequestGoogleDelete={handleRequestGoogleDelete}
            onOpenGoogleDrawer={() => {
              setCardModalState((prev) => ({ ...prev, isOpen: false }));
              setIsGoogleDrawerOpen(true);
            }}
          />
        )}

        {isGoogleDrawerOpen && (
          <GoogleCalendarDrawer
            isOpen={isGoogleDrawerOpen}
            onClose={() => setIsGoogleDrawerOpen(false)}
            user={googleUser}
            needsAuth={needsAuth}
            isLoggingIn={isLoggingIn}
            authError={authError}
            onLogin={handleGoogleLogin}
            onLogout={handleGoogleLogout}
            calendars={calendars}
            visibleCalendarIds={visibleCalendarIds}
            onToggleCalendarVisibility={(id) =>
              setVisibleCalendarIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            targetCalendarId={targetCalendarId}
            onChangeTargetCalendar={setTargetCalendarId}
            isLoadingEvents={isLoadingEvents}
            eventsCount={googleEvents.length}
            onRefreshEvents={() => void loadCalendarsAndEvents()}
            scheduledCards={scheduledCards}
            pendingSyncCount={pendingSyncCards.length}
            onRequestBatchSync={() => handleRequestBatchSync(false)}
          />
        )}

        {isQuickSearchOpen && (
          <QuickSearchModal
            isOpen={isQuickSearchOpen}
            onClose={() => setIsQuickSearchOpen(false)}
            cards={allWorkspaceCards}
            labels={allWorkspaceLabels}
            boardMetaByCardId={cardBoardMetaMap}
            onSelectCard={openEditCardModal}
          />
        )}

        {selectedGoogleEvent && (
          <EventDetailModal
            event={selectedGoogleEvent}
            lists={board.lists}
            boards={workspace.boards}
            initialBoardId={activeBoard.id}
            onClose={() => setSelectedGoogleEvent(null)}
            onImportAsCard={handleImportGoogleEventAsCard}
          />
        )}

        {pendingMutation && (
          <ConfirmActionModal
            pending={pendingMutation}
            isSubmitting={isMutatingGoogle}
            onConfirm={() => void executePendingGoogleMutation()}
            onCancel={() => setPendingMutation(null)}
          />
        )}
      </Suspense>
    </div>
  );
}
