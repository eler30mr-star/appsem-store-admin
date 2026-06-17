import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDOqThC4Cvtm_7WFBlFpkPppWN7xfqgVIc',
  authDomain: 'webs-8b1bf.firebaseapp.com',
  projectId: 'webs-8b1bf',
  storageBucket: 'webs-8b1bf.firebasestorage.app',
  messagingSenderId: '459642066534',
  appId: '1:459642066534:web:8833cee25d4c2ee4cfffa7',
  measurementId: 'G-HSFHP78TM0',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account',
});

isSupported()
  .then((supported) => {
    if (supported) getAnalytics(app);
  })
  .catch(() => {});

export default app;
