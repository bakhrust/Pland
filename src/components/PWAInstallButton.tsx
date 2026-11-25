import { Download, Share, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Установить приложение на устройство"
        title="Установить приложение"
        className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
          compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className={compact ? 'hidden sm:inline' : ''}>Установить</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Как установить на iPhone или iPad"
          title="Установить на iPhone"
          className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
          }`}
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className={compact ? 'hidden sm:inline' : ''}>На экран</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-pwa-title"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h2 id="ios-pwa-title" className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Установка на iPhone / iPad
                </h2>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Закрыть подсказку"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-decimal list-inside">
                <li>
                  Нажмите кнопку <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white"><Share className="w-3.5 h-3.5" /> Поделиться</strong> в нижней панели Safari.
                </li>
                <li>
                  Пролистайте вниз и выберите <strong className="text-slate-900 dark:text-white">«На экран Домой»</strong>.
                </li>
                <li>
                  Нажмите <strong className="text-slate-900 dark:text-white">«Добавить»</strong> — приложение откроется без рамок браузера.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-lg bg-slate-900 dark:bg-blue-600 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-700 cursor-pointer"
              >
                Понятно
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-4 left-3 md:left-4 z-40 inline-flex items-center gap-2 rounded-lg bg-amber-600 text-white px-3 py-1.5 text-xs font-medium shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>Нет сети — работа с локальным кэшем</span>
    </div>
  );
}
