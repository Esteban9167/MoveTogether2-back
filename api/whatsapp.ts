import type { VercelRequest, VercelResponse } from "@vercel/node";
import { computeCorsOrigin } from "../src/utils/cors";
import { sendWhatsappText, ensureWhatsappReady } from "../src/services/whatsapp";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  const corsOrigin = computeCorsOrigin(origin, allowedOrigin);

  res.setHeader("Access-Control-Allow-Origin", corsOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if (req.method === "GET") {
      await ensureWhatsappReady();
      return res.status(200).json({ message: "WhatsApp socket inicializado" });
    }

    if (req.method === "POST") {
      const { to, message } = req.body || {};
      if (!to || !message) {
        return res.status(400).json({ error: "to y message son requeridos" });
      }
      const result = await sendWhatsappText(String(to), String(message));
      return res.status(200).json({ message: "Mensaje enviado", result });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("[WhatsApp API] Error:", error);
    return res.status(500).json({ error: error?.message || "WhatsApp error" });
  }
}

