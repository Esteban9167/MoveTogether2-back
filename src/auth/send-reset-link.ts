import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "../firebase";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

export default async function sendResetLinkHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { email } = (req.body || {}) as { email?: string };
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email is required" });
    }

    const auth = getAuth();
    const firebaseLink = await auth.generatePasswordResetLink(email);
    // Extraer query (?mode=...&oobCode=...&apiKey=...)
    const url = new URL(firebaseLink);
    const query = url.search; // incluye '?' al inicio

    const appLink = `${FRONTEND_URL}/reset-password${query}`;

    // TODO: enviar email real con appLink. Por ahora devolvemos el link para pruebas.
    return res.status(200).json({ ok: true, link: appLink });
  } catch (err: any) {
    console.error("Error generating reset link:", err);
    return res.status(500).json({ error: "Failed to generate reset link" });
  }
}


