// back/src/firebase.ts
import * as admin from "firebase-admin";

let app: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

function initializeFirebase() {
  if (app) return admin.firestore(app);

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    throw new Error("Missing Firebase env vars");
  }

  const privateKey = FIREBASE_PRIVATE_KEY.includes("\\n")
    ? FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : FIREBASE_PRIVATE_KEY;

  const cred = admin.credential.cert({
    projectId: FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: privateKey.trim(),
  });

  app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: cred });
  db = admin.firestore(app);
  return db;
}

export function getDb() {
  if (!db) initializeFirebase();
  return db!;
}

export function getAuth() {
  if (!app) initializeFirebase();
  return admin.auth(app!);
}
