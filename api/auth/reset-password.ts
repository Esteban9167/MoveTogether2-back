import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getAuth } from "../../src/firebase";

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
    const { resetToken, newPassword } = body;

    if (!resetToken) {
      return res.status(400).json({ error: "Token de reset requerido" });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    // Decodificar token y obtener email
    const decoded = Buffer.from(resetToken, "base64").toString("utf-8");
    const [email, timestamp] = decoded.split(":");
    
    if (!email || !timestamp) {
      return res.status(400).json({ error: "Token inválido" });
    }

    // Verificar que el token no sea muy viejo (máximo 15 minutos)
    const tokenTime = parseInt(timestamp);
    const now = Date.now();
    if (now - tokenTime > 15 * 60 * 1000) {
      return res.status(400).json({ error: "Token expirado" });
    }

    // Verificar en Firestore que el reset fue verificado
    const db = getDb();
    const resetDoc = await db.collection("password_resets").doc(email.trim().toLowerCase()).get();

    if (!resetDoc.exists) {
      return res.status(404).json({ error: "Solicitud de reset no encontrada" });
    }

    const resetData = resetDoc.data();
    if (!resetData!.verified || resetData!.resetToken !== resetToken) {
      return res.status(400).json({ error: "Token inválido o no verificado" });
    }

    // Actualizar contraseña en Firebase Auth
    const auth = getAuth();
    const userRecord = await auth.getUserByEmail(email.trim().toLowerCase());
    
    await auth.updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Eliminar documento de reset
    await resetDoc.ref.delete();

    return res.status(200).json({
      message: "Contraseña actualizada correctamente",
    });
  } catch (error: any) {
    console.error("Error in reset-password handler:", error);
    
    if (error.code === "auth/weak-password") {
      return res.status(400).json({ error: "La contraseña es muy débil" });
    }

    return res.status(500).json({
      error: "Error interno del servidor",
      message: error.message || "Unknown error",
    });
  }
}

