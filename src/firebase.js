// ---------------------------------------------------------------------------
// Firebase setup. The web app settings come from environment variables (see
// .env.example and SETUP.md). A Firebase web API key only identifies the
// project; access is controlled by sign-in and the Firestore rules.
// ---------------------------------------------------------------------------
import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "REPLACE_ME",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "REPLACE_ME",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "REPLACE_ME",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "REPLACE_ME",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "REPLACE_ME",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "REPLACE_ME",
};

export const isConfigured = firebaseConfig.apiKey !== "REPLACE_ME";

export const app = initializeApp(firebaseConfig);

// Persistent local cache = the app keeps working offline and queues writes
// until the connection comes back, then syncs automatically across devices.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export function signIn() {
  return signInWithPopup(auth, provider);
}
export function logOut() {
  return signOut(auth);
}
export function watchAuth(cb) {
  return onAuthStateChanged(auth, cb);
}
