// Firebase Configuration
// Replace these values with your Firebase project credentials
// You can find these in Firebase Console > Project Settings > General > Your apps

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyC4KiwyAxli-bb5LvWYM4S_2BlEISRx90E",
    authDomain: "ai-pvp-game.firebaseapp.com",
    databaseURL: "https://ai-pvp-game-default-rtdb.firebaseio.com",
    projectId: "ai-pvp-game",
    storageBucket: "ai-pvp-game.firebasestorage.app",
    messagingSenderId: "898332624357",
    appId: "1:898332624357:web:9e3ef32fb54dd24bcc5b0c",
    measurementId: "G-JN9ZRMC56P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const db = getDatabase(app);

export default app;
