import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth, getDb } from "../../src/firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  const corsOrigin = allowedOrigin === "*" ? (origin || "*") : allowedOrigin;
  
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
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

    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);

    // Verificar si el usuario existe en Firestore
    const db = getDb();
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();

    if (userDoc.exists) {
      return res.status(200).json({ created: false });
    }

    // Usuario nuevo
    return res.status(200).json({ created: true });
  } catch (error: any) {
    console.error("Error in ensure-user handler:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error"
    });
  }
}

