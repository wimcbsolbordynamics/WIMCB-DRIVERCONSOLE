import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: 'wimcb-b3270',
  authDomain: 'wimcb-b3270.firebaseapp.com',
  // Note: These values are derived from the project ID provided.
  // Real apps would need the full config, but for this scaffolding we use the provided ID.
  storageBucket: 'wimcb-b3270.firebasestorage.app',
  messagingSenderId: '765432109876',
  appId: '1:765432109876:web:abcd1234efgh5678',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);