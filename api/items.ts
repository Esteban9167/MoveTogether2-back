import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../src/firebase";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  
  // Permitir múltiples orígenes (separados por coma) o localhost para desarrollo
  let corsOrigin = "*";
  if (allowedOrigin !== "*") {
    const allowedOrigins = allowedOrigin.split(",").map(o => o.trim());
    if (origin && allowedOrigins.includes(origin)) {
      corsOrigin = origin;
    } else if (origin && (origin.includes("localhost") || origin.includes("127.0.0.1"))) {
      // Permitir localhost automáticamente para desarrollo
      corsOrigin = origin;
    } else if (allowedOrigins.length === 1 && allowedOrigins[0]) {
      corsOrigin = allowedOrigins[0];
    }
  } else if (origin) {
    corsOrigin = origin;
  }
  
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const db = getDb();
    const col = db.collection("items");

    // GET: obtener los últimos 50 items
    if (req.method === "GET") {
      const snap = await col.orderBy("createdAt", "desc").limit(50).get();
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      return res.status(200).json(items);
    }

    // POST: crear un nuevo item
    if (req.method === "POST") {
      const { text } = req.body || {};
      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text required" });
      }

      const doc = await col.add({ text, createdAt: new Date().toISOString() });
      return res.status(201).json({ id: doc.id });
    }

    // Método no permitido
    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("Error in items handler:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "Unknown error"
    });
  }
}
