import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA-BA2_Xa7dd6pNKHGE6VGEvS_rrT5gkmg",
  authDomain: "material-f256f.firebaseapp.com",
  databaseURL: "https://material-f256f-default-rtdb.firebaseio.com",
  projectId: "material-f256f",
  storageBucket: "material-f256f.firebasestorage.app",
  messagingSenderId: "290532772107",
  appId: "1:290532772107:web:7ee30ec7ce743ec2033a0e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
