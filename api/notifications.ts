import type { VercelRequest, VercelResponse } from "@vercel/node";
import * as admin from "firebase-admin";
import { getDb, getAuth } from "../src/firebase";
import { computeCorsOrigin } from "../src/utils/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  const corsOrigin = computeCorsOrigin(origin, allowedOrigin);

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = getDb();
    const auth = getAuth();

    // Verificar autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    if (req.method === "GET") {
      // Obtener todas las notificaciones del usuario
      const notificationsSnapshot = await db
        .collection("users")
        .doc(uid)
        .collection("notifications")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const notifications = notificationsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return res.status(200).json({ notifications });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Error in notifications handler:", error);
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.code === "auth/argument-error") {
      return res.status(401).json({ error: "Invalid token" });
    }

    return res.status(500).json({
      error: "Internal server error",
      message: error.message || "Unknown error",
    });
  }
}

