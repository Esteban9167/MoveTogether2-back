# /Users/estebansequeda/Documents/Esteban/Info sem4/WEB/MoveTogether2/back/src/firebase.ts
cat > src/firebase.ts <<'EOF'
import admin from "firebase-admin";

let app: admin.app.App;

if (!admin.apps.length) {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
    })
  });
} else {
  app = admin.app();
}

export const db = admin.firestore(app);
EOF
