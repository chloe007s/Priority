import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const rawFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://priority-41b20-default-rtdb.firebaseio.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'priority-41b20',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseConfig = Object.fromEntries(
  Object.entries(rawFirebaseConfig).filter(([, value]) => Boolean(value)),
);

export const isFirebaseReady = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.databaseURL &&
    firebaseConfig.projectId,
);

const app = isFirebaseReady ? initializeApp(firebaseConfig) : null;
const googleProvider = new GoogleAuthProvider();

export const auth = app ? getAuth(app) : null;
export const database = app ? getDatabase(app) : null;

export function signInWithGoogle() {
  if (!auth) {
    return Promise.reject(new Error('Firebase Auth 설정이 필요합니다.'));
  }

  return signInWithPopup(auth, googleProvider);
}

export function logout() {
  if (!auth) {
    return Promise.resolve();
  }

  return signOut(auth);
}
