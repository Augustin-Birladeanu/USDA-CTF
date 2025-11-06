// Firebase Configuration
// Replace these values with your Firebase project credentials
// You can find these in Firebase Console > Project Settings > General > Your apps

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_APP_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_APP_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_APP_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_APP_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_APP_FIREBASE_MEASUREMENT_ID
};

// Validate required Firebase configuration values
const requiredFields = ['projectId', 'databaseURL'];
const missingFields = requiredFields.filter(field => !firebaseConfig[field]);

if (missingFields.length > 0) {
  const errorMessage = `Missing required Firebase configuration: ${missingFields.join(', ')}. ` +
    `Please create a .env file in the project root with the following variables:\n` +
    `- VITE_APP_FIREBASE_PROJECT_ID\n` +
    `- VITE_APP_FIREBASE_DATABASE_URL\n` +
    `- VITE_APP_FIREBASE_API_KEY\n` +
    `- VITE_APP_FIREBASE_AUTH_DOMAIN\n` +
    `- VITE_APP_FIREBASE_STORAGE_BUCKET\n` +
    `- VITE_APP_FIREBASE_MESSAGING_SENDER_ID\n` +
    `- VITE_APP_FIREBASE_APP_ID\n` +
    `\nYou can find these values in your Firebase Console under Project Settings > General > Your apps.`;
  
  console.error(errorMessage);
  throw new Error(errorMessage);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database
export const db = getDatabase(app);

export default app;
