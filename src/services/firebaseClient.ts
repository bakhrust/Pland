import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { app, auth } from './firebaseApp';

export { app, auth };
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    console.warn('Firestore connection probe note:', error instanceof Error ? error.message : error);
  }
}
