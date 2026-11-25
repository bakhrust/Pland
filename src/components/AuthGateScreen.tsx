import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';

interface AuthGateScreenProps {
  isLoggingIn: boolean;
  authError: string | null;
  onLogin: () => void;
}

export function AuthGateScreen({ isLoggingIn, authError, onLogin }: AuthGateScreenProps) {
  return (
    <div
      data-testid="auth-gate-screen"
      className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 relative"
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <PWAInstallButton compact />
      </div>

      <div className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-8 text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            RST
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Персональный супер-апп (заметки, планировщик, привычки, финансы, спорт)
          </p>
        </div>

        {authError && (
          <div
            role="alert"
            className="px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-left"
          >
            {authError}
          </div>
        )}

        <div className="space-y-3">
          <GoogleSignInButton
            onClick={onLogin}
            disabled={isLoggingIn}
            label={isLoggingIn ? 'Выполняется вход...' : 'Войти через Google'}
          />
        </div>
      </div>
    </div>
  );
}
