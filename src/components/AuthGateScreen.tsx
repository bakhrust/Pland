import { useState } from 'react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthGateScreenProps {
  isLoggingIn: boolean;
  authError: string | null;
  onLogin: () => void;
  onGuestLogin?: () => void;
}

type PreviewTab = 'board' | 'week' | 'timeline';
type PreviewBoardKey = 'work' | 'personal';

const PREVIEW_BOARDS: Record<
  PreviewBoardKey,
  {
    name: string;
    columns: Array<{
      title: string;
      count: number;
      cards: Array<{ title: string; meta: string; accent: string }>;
    }>;
  }
> = {
  work: {
    name: 'Работа',
    columns: [
      {
        title: 'Бэклог',
        count: 2,
        cards: [
          { title: 'Собрать заметки по итогам недели', meta: 'До 30 нояб · 1/3', accent: 'bg-blue-600' },
          { title: 'Настроить шаблоны задач', meta: 'Разработка', accent: 'bg-emerald-600' },
        ],
      },
      {
        title: 'В работе',
        count: 2,
        cards: [
          { title: 'Синхронизация с Google Calendar', meta: '24 нояб · 09:30–12:00', accent: 'bg-rose-600' },
          { title: 'Дорожная карта квартала', meta: '24–26 нояб · Весь день', accent: 'bg-violet-600' },
        ],
      },
      {
        title: 'Готово',
        count: 1,
        cards: [
          { title: 'Обновить дизайн сетки недели', meta: '23 нояб · 14:00', accent: 'bg-emerald-600' },
        ],
      },
    ],
  },
  personal: {
    name: 'Личные дела',
    columns: [
      {
        title: 'Идеи и планы',
        count: 1,
        cards: [
          { title: 'Разобрать архив документов', meta: 'Суббота · Быт', accent: 'bg-emerald-600' },
        ],
      },
      {
        title: 'На этой неделе',
        count: 2,
        cards: [
          { title: 'Пробежка в парке', meta: 'Ср · 18:30–19:30', accent: 'bg-blue-600' },
          { title: 'Выбрать подарок близким', meta: 'Пт · 19:00 · 1/2', accent: 'bg-amber-600' },
        ],
      },
      {
        title: 'Сделано',
        count: 1,
        cards: [
          { title: 'Запись к стоматологу', meta: 'Выполнено', accent: 'bg-slate-400' },
        ],
      },
    ],
  },
};

export function AuthGateScreen({ isLoggingIn, authError, onLogin, onGuestLogin }: AuthGateScreenProps) {
  const [previewTab, setPreviewTab] = useState<PreviewTab>('board');
  const [previewBoard, setPreviewBoard] = useState<PreviewBoardKey>('work');

  const boardData = PREVIEW_BOARDS[previewBoard];

  return (
    <div
      data-testid="auth-gate-screen"
      className="min-h-screen w-full bg-slate-50 text-slate-900 flex flex-col"
    >
      {/* Top Bar: 3 zones */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            PLAND
          </a>

          <nav
            aria-label="Возможности"
            className="hidden md:flex items-center gap-7 text-xs font-medium text-slate-600"
          >
            <a
              href="#boards"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Доски
            </a>
            <a
              href="#planner"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Расписание
            </a>
            <a
              href="#privacy"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Календарь
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />
            <button
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn}
              className="px-4 py-2 min-h-10 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {isLoggingIn ? 'Вход...' : 'Войти через Google'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Hero */}
      <main id="top" className="flex-1 flex flex-col justify-center">
        <section className="max-w-6xl w-full mx-auto px-5 sm:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left: Editorial Value Proposition & Single Primary CTA */}
            <div className="lg:col-span-5 space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-medium text-slate-500">
                  Личный планировщик · Задачи и календарь
                </p>
                <h1
                  className="font-display font-bold tracking-tight text-slate-900 leading-[1.08] [text-wrap:balance]"
                  style={{ fontSize: 'clamp(2.125rem, 3.6vw, 3.125rem)' }}
                >
                  Доска задач и план дня в одном окне
                </h1>
                <p className="text-[15px] sm:text-base text-slate-600 leading-relaxed max-w-md">
                  Создавайте отдельные доски для работы и личных дел, перетаскивайте карточки прямо на сетку недели и синхронизируйте время с Google Календарём.
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg"
                >
                  {authError}
                </div>
              )}

              <div className="space-y-3 pt-1">
                <GoogleSignInButton
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  label={isLoggingIn ? 'Выполняется вход...' : 'Sign in with Google'}
                />
                <p className="text-xs text-slate-500">
                  Персональное пространство · Синхронизация Google Календаря
                </p>

                {onGuestLogin && (
                  <div className="pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={onGuestLogin}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-300"
                    >
                      Протестировать в демо-режиме (без входа Google)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Minimalist Interactive Workspace Preview */}
            <div className="lg:col-span-7">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {/* Preview Toolbar */}
                <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
                  <div
                    role="group"
                    aria-label="Пример досок"
                    className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewBoard('work')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewBoard === 'work'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Работа
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewBoard('personal')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewBoard === 'personal'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Личные дела
                    </button>
                  </div>

                  <div
                    role="group"
                    aria-label="Пример режимов"
                    className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewTab('board')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewTab === 'board'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Доска
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('week')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewTab === 'week'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Неделя
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('timeline')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        previewTab === 'timeline'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Таймлайн
                    </button>
                  </div>
                </div>

                {/* Preview Canvas */}
                <div className="p-4 sm:p-5 bg-white min-h-[260px]">
                  {previewTab === 'board' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {boardData.columns.map((col) => (
                        <div
                          key={col.title}
                          className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 space-y-2"
                        >
                          <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-semibold text-slate-800 truncate">
                              {col.title}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-slate-400">
                              {col.count}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {col.cards.map((card) => (
                              <div
                                key={card.title}
                                className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                              >
                                <div className={`h-0.5 w-full ${card.accent}`} />
                                <div className="p-2.5 space-y-1">
                                  <div className="text-xs font-medium text-slate-900 leading-snug">
                                    {card.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 tabular-nums">
                                    {card.meta}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {previewTab === 'week' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:gap-2 pb-2 border-b border-slate-100 text-[11px] font-medium text-slate-500 tabular-nums">
                        <span className="pl-1">Время</span>
                        <span>Пн 23</span>
                        <span>Вт 24</span>
                        <span>Ср 25</span>
                      </div>
                      <div className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-1.5 sm:gap-2 items-start pt-1 text-xs">
                        <div className="space-y-6 font-mono text-[11px] text-slate-400 tabular-nums pl-1 pt-1">
                          <div>09:00</div>
                          <div>11:00</div>
                          <div>14:00</div>
                        </div>
                        <div className="space-y-2 min-w-0">
                          <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 overflow-hidden">
                            <div className="text-[11px] font-semibold leading-snug truncate">
                              Синхронизация
                            </div>
                            <div className="font-mono text-[10px] text-blue-700 tabular-nums mt-0.5 truncate">
                              09:30–11:30
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 overflow-hidden">
                            <div className="text-[11px] font-medium leading-snug truncate">
                              Google Meet
                            </div>
                            <div className="font-mono text-[10px] text-slate-500 tabular-nums mt-0.5 truncate">
                              14:00–15:00
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 min-w-0">
                          <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 overflow-hidden">
                            <div className="text-[11px] font-semibold leading-snug truncate">
                              Обзор недели
                            </div>
                            <div className="font-mono text-[10px] text-amber-700 tabular-nums mt-0.5 truncate">
                              11:00–12:30
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2 min-w-0">
                          <div className="p-2 rounded-lg bg-violet-50 border border-violet-200 text-violet-950 overflow-hidden">
                            <div className="text-[11px] font-semibold leading-snug truncate">
                              Фокус · Дизайн
                            </div>
                            <div className="font-mono text-[10px] text-violet-700 tabular-nums mt-0.5 truncate">
                              10:00–12:00
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {previewTab === 'timeline' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-6 gap-2 pb-2 border-b border-slate-100 text-[11px] font-medium text-slate-500 tabular-nums">
                        <span className="col-span-1">Этап</span>
                        <span>Пн</span>
                        <span>Вт</span>
                        <span>Ср</span>
                        <span>Чт</span>
                        <span>Пт</span>
                      </div>
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-6 gap-2 items-center">
                          <span className="text-xs font-medium text-slate-700 truncate">В работе</span>
                          <div className="col-span-3 bg-blue-600 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md truncate">
                            Дорожная карта недели
                          </div>
                        </div>
                        <div className="grid grid-cols-6 gap-2 items-center">
                          <span className="text-xs font-medium text-slate-700 truncate">Планы</span>
                          <div className="col-start-3 col-span-2 bg-violet-600 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md truncate">
                            Сетка и календарь
                          </div>
                        </div>
                        <div className="grid grid-cols-6 gap-2 items-center">
                          <span className="text-xs font-medium text-slate-700 truncate">Личное</span>
                          <div className="col-start-4 col-span-2 bg-emerald-600 text-white text-[11px] font-medium px-2.5 py-1.5 rounded-md truncate">
                            Тренировки и дела
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Minimalist Editorial Highlights */}
        <section className="border-t border-slate-200/80 bg-white">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div id="boards" className="space-y-1.5">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                01. Несколько досок
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Разделяйте «Работа», «Личные дела» и любые проекты — у каждой доски свои колонки и метки.
              </p>
            </div>

            <div id="planner" className="space-y-1.5">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                02. Перетаскивание в календарь
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Переносите карточки прямо в слоты недели, на месяц или таймлайн и меняйте длительность в один клик.
              </p>
            </div>

            <div id="privacy" className="space-y-1.5">
              <h2 className="font-display text-sm font-semibold text-slate-900">
                03. Приватная синхронизация
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Задачи со временем отправляются в ваш Google Календарь только после подтверждения, а доски изолированы под вашим аккаунтом.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 bg-slate-50">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span className="font-display font-semibold text-slate-700">PLAND</span>
          <span>Персональный планировщик для одного пользователя</span>
        </div>
      </footer>
    </div>
  );
}
