// src/firebase/config.ts
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCN8Zp4gIDLkf2Zy9kJU8rPF2Mg3J36oWQ",
  authDomain: "encuesta-docente-config.firebaseapp.com",
  databaseURL: "https://encuesta-docente-config-default-rtdb.firebaseio.com",
  projectId: "encuesta-docente-config",
  storageBucket: "encuesta-docente-config.firebasestorage.app",
  messagingSenderId: "1028802083229",
  appId: "1:1028802083229:web:c8af0714716adf6b3a1774"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

console.log('✅ Firebase conectado');