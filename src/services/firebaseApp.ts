import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  type AppCheck,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
} from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

let appCheckInstance: AppCheck | null = null;

function resolveAppCheckSiteKey(): string {
  const envKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? String(import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY ?? '').trim()
      : '';
  if (envKey) return envKey;
  const configKey = String(
    (firebaseConfig as { recaptchaSiteKey?: string }).recaptchaSiteKey ?? ''
  ).trim();
  return configKey;
}

function initFirebaseAppCheck(): AppCheck | null {
  if (typeof window === 'undefined') return null;
  if (appCheckInstance) return appCheckInstance;

  const siteKey = resolveAppCheckSiteKey();
  if (!siteKey) return null;

  try {
    if (import.meta.env?.DEV) {
      const debugToken = String(
        import.meta.env.VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN ?? ''
      ).trim();
      if (debugToken) {
        (
          window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
        ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken;
      }
    }

    const providerType = String(
      import.meta.env?.VITE_FIREBASE_APP_CHECK_PROVIDER ?? 'enterprise'
    )
      .trim()
      .toLowerCase();

    const provider =
      providerType === 'v3'
        ? new ReCaptchaV3Provider(siteKey)
        : new ReCaptchaEnterpriseProvider(siteKey);

    appCheckInstance = initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('Firebase App Check initialization skipped:', err);
    appCheckInstance = null;
  }

  return appCheckInstance;
}

export const appCheck = initFirebaseAppCheck();
export function isAppCheckConfigured(): boolean {
  return appCheck !== null;
}
