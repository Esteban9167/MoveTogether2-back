// back/api/auth/login-google.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import fetch from "node-fetch";
import { computeCorsOrigin } from "../utils/cors";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const corsOrigin = computeCorsOrigin(origin, process.env.CORS_ORIGIN);
  
  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")  return res.status(405).json({ error: "Method not allowed" });

  try {
    // parseo seguro del body
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { idToken } = body;
    if (!idToken) return res.status(400).json({ error: "idToken requerido" });

    // const auth = getAuth(); // This line was removed as per the new_code
    // const decoded = await auth.verifyIdToken(idToken); // This line was removed as per the new_code

    return res.status(200).json({
      user: {
        // uid: decoded.uid, // This line was removed as per the new_code
        // email: decoded.email, // This line was removed as per the new_code
        // name: decoded.name ?? null, // This line was removed as per the new_code
        // picture: decoded.picture ?? null, // This line was removed as per the new_code
        // emailVerified: decoded.email_verified, // This line was removed as per the new_code
        // provider: decoded.firebase?.sign_in_provider ?? "google", // This line was removed as per the new_code
      },
    });
  } catch (e: any) {
    // registra la causa real en logs de Vercel
    console.error("login-google error:", e?.message, e);
    return res.status(401).json({ error: e?.message || "Token inválido o expirado" });
  }
}
