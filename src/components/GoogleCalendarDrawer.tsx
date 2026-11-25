import { Check, LogOut, RefreshCw, UploadCloud, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { CardItem, GoogleCalendarMeta } from '../types/planner';
import { GoogleSignInButton } from './GoogleSignInButton';

interface GoogleCalendarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  onLogin: () => void;
  onLogout: () => void;
  calendars: GoogleCalendarMeta[];
  visibleCalendarIds: string[];
  onToggleCalendarVisibility: (calendarId: string) => void;
  targetCalendarId: string;
  onChangeTargetCalendar: (calendarId: string) => void;
  isLoadingEvents: boolean;
  eventsCount: number;
  onRefreshEvents: () => void;
  scheduledCards: CardItem[];
  pendingSyncCount: number;
  onRequestBatchSync: () => void;
}

export function GoogleCalendarDrawer({
  isOpen,
  onClose,
  user,
  needsAuth,
  isLoggingIn,
  authError,
  onLogin,
  onLogout,
  calendars,
  visibleCalendarIds,
  onToggleCalendarVisibility,
  targetCalendarId,
  onChangeTargetCalendar,
  isLoadingEvents,
  eventsCount,
  onRefreshEvents,
  scheduledCards,
  pendingSyncCount,
  onRequestBatchSync,
}: GoogleCalendarDrawerProps) {
  if (!isOpen) return null;

  const isConnected = Boolean(user) && !needsAuth;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/30"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gcal-drawer-title"
    >
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h2 id="gcal-drawer-title" className="font-display text-base font-semibold text-slate-900">
              Google Календарь
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Просмотр событий и выгрузка запланированных задач
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть панель Google Календаря"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {authError && (
            <div
              role="alert"
              className="px-3.5 py-2.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
            >
              {authError}
            </div>
          )}

          {!isConnected ? (
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="space-y-1.5">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Подключите аккаунт Google
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  После входа вы сможете видеть события ваших календарей прямо на сетке недели, месяца и таймлайне, импортировать встречи на доску и отправлять задачи в Google Calendar.
                </p>
              </div>

              <div className="pt-1">
                <GoogleSignInButton
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  label={isLoggingIn ? 'Подключение...' : 'Sign in with Google'}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Connected Account */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {user?.displayName || 'Аккаунт Google'}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{user?.email}</div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Выйти</span>
                </button>
              </div>

              {/* Calendars Visibility List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xs font-semibold text-slate-900">
                    Ваши календари ({calendars.length})
                  </h3>
                  <button
                    type="button"
                    onClick={onRefreshEvents}
                    disabled={isLoadingEvents}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400 cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`}
                      aria-hidden="true"
                    />
                    <span>{isLoadingEvents ? 'Загрузка...' : 'Обновить'}</span>
                  </button>
                </div>

                {calendars.length === 0 ? (
                  <div className="text-xs text-slate-500 py-3">
                    {isLoadingEvents ? 'Загружаем список календарей...' : 'Календари не найдены.'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {calendars.map((cal) => {
                      const checked = visibleCalendarIds.includes(cal.id);
                      return (
                        <label
                          key={cal.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => onToggleCalendarVisibility(cal.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: cal.backgroundColor || '#2563eb' }}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-medium text-slate-800 truncate">
                              {cal.summary}
                            </span>
                          </div>
                          {cal.primary && (
                            <span className="text-[11px] text-slate-400 shrink-0">Основной</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}

                <div className="text-[11px] text-slate-500 tabular-nums">
                  Загружено событий за выбранный период: {eventsCount}
                </div>
              </div>

              {/* Export / Sync Section */}
              <div className="pt-4 border-t border-slate-200 space-y-3">
                <h3 className="font-display text-xs font-semibold text-slate-900">
                  Выгрузка задач в Google Calendar
                </h3>

                <div>
                  <label
                    htmlFor="target-gcal-select"
                    className="block text-xs text-slate-600 mb-1"
                  >
                    Целевой календарь для новых событий
                  </label>
                  <select
                    id="target-gcal-select"
                    value={targetCalendarId}
                    onChange={(e) => onChangeTargetCalendar(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-blue-600"
                  >
                    {calendars
                      .filter((c) => c.accessRole !== 'reader' && c.accessRole !== 'freeBusyReader')
                      .map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.summary}
                        </option>
                      ))}
                    {calendars.length === 0 && <option value="primary">Основной календарь</option>}
                  </select>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Запланированных карточек</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">
                      {scheduledCards.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Ожидают синхронизации</span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        pendingSyncCount > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {pendingSyncCount}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onRequestBatchSync}
                    disabled={scheduledCards.length === 0}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {pendingSyncCount > 0
                        ? `Синхронизировать изменения (${pendingSyncCount})`
                        : 'Синхронизировать все задачи с календарём'}
                    </span>
                  </button>

                  <p className="text-[11px] text-slate-500 leading-snug">
                    Любые задачи, для которых указано время, можно выгрузить в Google Calendar после вашего подтверждения.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Capabilities Summary */}
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <div className="text-xs font-semibold text-slate-900">Как работает интеграция</div>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                <span>События Google Календаря отображаются на сетке недели, месяца и таймлайна.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                <span>Любую встречу можно превратить в карточку доски одним нажатием.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" aria-hidden="true" />
                <span>Запланированные карточки можно выгрузить и обновлять в выбранном календаре.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
