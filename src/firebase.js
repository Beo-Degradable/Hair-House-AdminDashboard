
// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
	apiKey: "AIzaSyC0q-pZMdSAbxz85-IpxIcomiWYdy961b4",
	authDomain: "hair-house-salon-ef695.firebaseapp.com",
	projectId: "hair-house-salon-ef695",
	storageBucket: "hair-house-salon-ef695.firebasestorage.app",
	messagingSenderId: "729539648621",
	appId: "1:729539648621:web:639a626f4c674c750bf364"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
