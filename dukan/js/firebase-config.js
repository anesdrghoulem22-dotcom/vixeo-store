import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyCHcYrbuHkqbaJ2cXPiaGai5i6kU-Ym0Xw",
  authDomain: "dukan-store-6a9fc.firebaseapp.com",
  projectId: "dukan-store-6a9fc",
  storageBucket: "dukan-store-6a9fc.firebasestorage.app",
  messagingSenderId: "712011894249",
  appId: "1:712011894249:web:5476846003940bd5078f78",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "europe-west1");
export const callCreateCheckoutSession = httpsCallable(functions, "createCheckoutSession");
export const callCreateChargilyCheckout = httpsCallable(functions, "createChargilyCheckout");
