import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getAuth } from "../src/firebase";
import { computeCorsOrigin } from "../src/utils/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN;
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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authorization token required" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    if (!idToken) {
      return res.status(401).json({ error: "Invalid authorization token" });
    }

    // Verificar el token
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Obtener datos del usuario de Firestore
    const db = getDb();
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }

    const userData = userDoc.data();

    return res.status(200).json({
      uid,
      first_name: userData?.first_name || null,
      last_name: userData?.last_name || null,
      user_id: userData?.user_id || null,
      email: userData?.email || decodedToken.email || null,
      phone: userData?.phone || null,
      user_photo: userData?.user_photo || null,
    });
  } catch (error: any) {
    console.error("Error in /api/me handler:", error);
    if (error.code === "auth/id-token-expired") {
      return res.status(401).json({ error: "Token expired" });
    }
    if (error.code === "auth/argument-error") {
      return res.status(401).json({ error: "Invalid token" });
    }
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error"
    });
  }
}

