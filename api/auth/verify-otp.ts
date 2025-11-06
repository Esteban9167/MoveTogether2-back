import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb } from "../../src/firebase";

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
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { email, code } = body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email es requerido" });
    }

    if (!code || code.length !== 4) {
      return res.status(400).json({ error: "Código inválido. Debe tener 4 dígitos" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Obtener código de Firestore
    const db = getDb();
    const resetDoc = await db.collection("password_resets").doc(trimmedEmail).get();

    if (!resetDoc.exists) {
      return res.status(404).json({ error: "Código no encontrado o expirado" });
    }

    const resetData = resetDoc.data();
    const now = new Date();
    const expiresAt = new Date(resetData!.expiresAt);

    // Verificar si el código expiró
    if (now > expiresAt) {
      await resetDoc.ref.delete();
      return res.status(400).json({ error: "Código expirado. Solicita uno nuevo" });
    }

    // Verificar intentos (máximo 5 intentos)
    if (resetData!.attempts >= 5) {
      await resetDoc.ref.delete();
      return res.status(429).json({ error: "Demasiados intentos fallidos. Solicita un nuevo código" });
    }

    // Verificar código
    if (resetData!.code !== code) {
      await resetDoc.ref.update({
        attempts: (resetData!.attempts || 0) + 1,
      });
      return res.status(400).json({ error: "Código incorrecto" });
    }

    // Código válido - generar token temporal para resetear contraseña
    const resetToken = Buffer.from(`${trimmedEmail}:${Date.now()}`).toString("base64");

    // Guardar token de reset (válido por 15 minutos)
    await db.collection("password_resets").doc(trimmedEmail).update({
      verified: true,
      resetToken: resetToken,
      verifiedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      message: "Código verificado correctamente",
      resetToken: resetToken,
    });
  } catch (error: any) {
    console.error("Error in verify-otp handler:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error.message || "Unknown error",
    });
  }
}

