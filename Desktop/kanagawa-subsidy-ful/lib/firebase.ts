// This file STRICTLY uses the client SDKs as required by the prompt.
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
// V10 SDK (Modular) を使用します
import { getAuth, connectAuthEmulator, Auth, signInAnonymously } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, Firestore } from "firebase/firestore";

// Configuration from docs/backend.json -> deployment.firebaseConfig
// 設計書（docs/backend.json）からコピーした、本番用の設定です。
const firebaseConfig = {
  projectId: "studio-3197296924-f3365",
  appId: "1:673276537947:web:63c582fdbf7e957dd0e37e",
  apiKey: "AIzaSyC37AKOLivEKLF94HM53861lLk2dBk2cVg",
  authDomain: "studio-3197296924-f3365.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "673276537947"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

// Firebaseを初期化
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

auth = getAuth(app);
db = getFirestore(app);

// フロントエンド（app/page.tsx）がFirestoreにアクセスできるように、
// クライアントSDKで匿名認証を試みます。
// これはベストプラクティスです。
signInAnonymously(auth).catch((error) => {
  console.error("Anonymous sign-in failed:", error);
});

// 開発環境（ローカル実行）の場合はエミュレータに接続
if (typeof window !== 'undefined' && window.location.hostname === "localhost") {
  try {
    console.log("Connecting to Firebase Emulators...");
    // 既に接続試行済みかどうかのチェック（単純化）
    // @ts-ignore
    if (!db._settings.host) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectAuthEmulator(auth, 'http://localhost:9099');
      console.log("Successfully connected to Firebase Emulators.");
    }
  } catch (e) {
    console.warn("Emulator connection failed (might be already connected or not running):", e);
  }
}

export { app, auth, db };