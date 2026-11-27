import {
  Calendar,
  CalendarRange,
  CheckCircle2,
  Dumbbell,
  FileText,
  LogOut,
  Moon,
  Sun,
  Wallet,
} from 'lucide-react';
import type { MainSection, ViewMode } from '../types/planner';
import { PWAInstallButton } from './PWAInstallButton';

interface TopBarProps {
  viewMode: ViewMode;
  onSelectSection: (section: MainSection) => void;
  isSignedIn: boolean;
  isGoogleConnected: boolean;
  googleUserEmail: string | null;
  pendingSyncCount: number;
  onOpenGoogleDrawer: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const SECTION_ITEMS: Array<{ id: MainSection; label: string; Icon: typeof CalendarRange }> = [
  { id: 'plan', label: 'План', Icon: CalendarRange },
  { id: 'habits', label: 'Привычки', Icon: CheckCircle2 },
  { id: 'notes', label: 'Заметки', Icon: FileText },
  { id: 'finance', label: 'Финансы', Icon: Wallet },
  { id: 'sport', label: 'Здоровье', Icon: Dumbbell },
];

export function getMainSection(viewMode: ViewMode): MainSection {
  if (viewMode === 'board' || viewMode === 'week' || viewMode === 'month' || viewMode === 'timeline') {
    return 'plan';
  }
  return viewMode;
}

export function TopBar({
  viewMode,
  onSelectSection,
  isSignedIn,
  isGoogleConnected,
  googleUserEmail,
  pendingSyncCount,
  onOpenGoogleDrawer,
  onLogout,
  theme,
  onToggleTheme,
}: TopBarProps) {
  const activeSection = getMainSection(viewMode);

  return (
    <header className="h-12 md:h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 md:px-6 flex items-center justify-between gap-2 md:gap-8 shrink-0 text-slate-900 dark:text-slate-100">
      {/* Zone 1: Single-line Brand Wordmark */}
      <a
        href="#plan"
        onClick={(e) => {
          e.preventDefault();
          onSelectSection('plan');
        }}
        className="font-display text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
      >
        RST
      </a>

      {/* Zone 2: Desktop 5 main super-app modules */}
      <nav aria-label="Разделы приложения" className="hidden md:flex items-center gap-6">
        {SECTION_ITEMS.map((item) => {
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
              {active && (
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: PWA Install, Theme, Google Calendar & Account */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        <PWAInstallButton compact />

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить темную тему'}
          title={theme === 'dark' ? 'Светлая тема' : 'Темная тема'}
          className="p-1.5 md:p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenGoogleDrawer}
          aria-label={
            isGoogleConnected && googleUserEmail
              ? `Google Календарь подключён (${googleUserEmail})`
              : 'Подключить Google Календарь'
          }
          className={`inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
            isGoogleConnected
              ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>
            {isGoogleConnected
              ? pendingSyncCount > 0
                ? `Google (${pendingSyncCount})`
                : 'Google Календарь'
              : 'Подключить Google'}
          </span>
        </button>

        {isSignedIn && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Выйти из аккаунта RST"
            title={googleUserEmail ? `Выйти (${googleUserEmail})` : 'Выйти'}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}

interface MobileBottomNavProps {
  viewMode: ViewMode;
  onSelectSection: (section: MainSection) => void;
}

export function MobileBottomNav({ viewMode, onSelectSection }: MobileBottomNavProps) {
  const activeSection = getMainSection(viewMode);

  return (
    <nav
      aria-label="Мобильная навигация"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(15,23,42,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)]"
    >
      {SECTION_ITEMS.map(({ id, label, Icon }) => {
        const active = activeSection === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelectSection(id)}
            aria-current={active ? 'page' : undefined}
            className={`h-14 flex flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors cursor-pointer min-w-0 ${
              active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-full">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
