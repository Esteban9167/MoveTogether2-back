// back/api/auth/login-google.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "../../src/firebase";

const allowList = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "";
  const allow = allowList.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (allow) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary","Origin"); }
  res.setHeader("Access-Control-Allow-Credentials","true");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")  return res.status(405).json({ error: "Method not allowed" });

  try {
    // parseo seguro del body
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { idToken } = body;
    if (!idToken) return res.status(400).json({ error: "idToken requerido" });

    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);

    return res.status(200).json({
      user: {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name ?? null,
        picture: decoded.picture ?? null,
        emailVerified: decoded.email_verified,
        provider: decoded.firebase?.sign_in_provider ?? "google",
      },
    });
  } catch (e: any) {
    // registra la causa real en logs de Vercel
    console.error("login-google error:", e?.message, e);
    return res.status(401).json({ error: e?.message || "Token inválido o expirado" });
  }
}
