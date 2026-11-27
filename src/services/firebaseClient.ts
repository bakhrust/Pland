import {
  doc,
  type Firestore,
  type FirestoreSettings,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { app, auth } from './firebaseApp';

export { app, auth };

function createFirestoreClient(): Firestore {
  const canUseIndexedDb = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
  const baseSettings: FirestoreSettings = {
    experimentalForceLongPolling: true,
    localCache: canUseIndexedDb
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache(),
  };

  try {
    return initializeFirestore(app, baseSettings, firebaseConfig.firestoreDatabaseId);
  } catch {
    try {
      return initializeFirestore(
        app,
        {
          experimentalForceLongPolling: true,
          localCache: memoryLocalCache(),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
}

export const db = createFirestoreClient();

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('the client is offline') || message.toLowerCase().includes('unavailable')) {
      console.warn('Firestore connection probe note: backend temporarily unreachable, operating with local cache.', message);
    }
  }
}
