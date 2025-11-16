import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "../firebase";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export default async function sendUnisabanaResetLink(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { email } = (req.body || {}) as { email?: string };
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    if (!email.toLowerCase().endsWith("@unisabana.edu.co")) {
      return res
        .status(400)
        .json({ error: "Solo se permite recuperar contraseña para correos @unisabana.edu.co" });
    }

    const auth = getAuth();
    const firebaseLink = await auth.generatePasswordResetLink(email);
    const url = new URL(firebaseLink);
    const query = url.search;
    const appLink = `${FRONTEND_URL}/reset-password${query}`;
    return res.status(200).json({ ok: true, link: appLink });
  } catch (err: any) {
    console.error("Error generating reset link:", err);
    return res.status(500).json({ error: "No se pudo generar el enlace de recuperación" });
  }
}


