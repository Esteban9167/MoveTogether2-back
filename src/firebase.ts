import admin from "firebase-admin";

let app: admin.app.App | null = null;
let db: admin.firestore.Firestore | null = null;

function initializeFirebase() {
  if (app) {
    return admin.firestore(app);
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    throw new Error("Missing Firebase env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
  }

  const serviceAccount = {
    projectId,
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
  } as admin.ServiceAccount;

  if (!admin.apps.length) {
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    app = admin.app();
  }

  db = admin.firestore(app);
  return db;
}

export function getDb() {
  if (!db) {
    db = initializeFirebase();
  }
  return db;
}
