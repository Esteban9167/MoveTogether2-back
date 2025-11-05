// Ruta: back/api/register.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "../../src/firebase";

const allowList = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function allowOrigin(origin = "") {
  return allowList.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || "";
  if (allowOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")  return res.status(405).json({ error: "Method not allowed" });

  try {
    // Vercel puede entregar el body como string
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    let { email, password } = body;

    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
    email = String(email).trim().toLowerCase();
    password = String(password);

    if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Firebase Web API key not configured" });

    // Alta en Firebase Auth vía REST (mismo proyecto que Admin SDK)
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      const code = data?.error?.message;
      if (code === "EMAIL_EXISTS")   return res.status(409).json({ error: "El correo ya está registrado" });
      if (code === "INVALID_EMAIL")  return res.status(400).json({ error: "Correo electrónico inválido" });
      if (code === "WEAK_PASSWORD")  return res.status(400).json({ error: "La contraseña es muy débil" });
      return res.status(400).json({ error: code || "Error al crear la cuenta" });
    }

    // Verificación del ID token con Admin SDK
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(data.idToken);

    // Opcional: session cookie en vez de exponer idToken al cliente
    // const sessionCookie = await auth.createSessionCookie(data.idToken, { expiresIn: 5 * 24 * 60 * 60 * 1000 });
    // res.setHeader("Set-Cookie", `session=${sessionCookie}; HttpOnly; Secure; SameSite=None; Path=/`);

    return res.status(201).json({
      idToken: data.idToken,            // quita esto si usas cookie de sesión
      refreshToken: data.refreshToken,  // idem
      user: {
        uid: decoded.uid,
        email: decoded.email,
        emailVerified: decoded.email_verified,
      },
    });
  } catch (e: any) {
    console.error("Error in register handler:", e?.message, e);
    return res.status(500).json({ error: "Internal server error", message: e?.message || "Unknown error" });
  }
}
