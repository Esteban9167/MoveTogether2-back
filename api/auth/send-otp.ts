import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDb, getAuth } from "../../src/firebase";
import { sendEmail } from "../../src/email";

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
    const { email } = body;

    if (!email || !email.trim()) {
      return res.status(400).json({ error: "Email es requerido" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validar que sea correo institucional
    if (!trimmedEmail.endsWith("@unisabana.edu.co")) {
      return res.status(400).json({ error: "Solo se permiten correos institucionales" });
    }

    // Verificar que el usuario existe en Firebase Auth
    const auth = getAuth();
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(trimmedEmail);
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        return res.status(404).json({ error: "Este correo no está registrado" });
      }
      throw error;
    }

    // Generar código OTP de 4 dígitos
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expira en 10 minutos

    // Guardar código en Firestore
    const db = getDb();
    await db.collection("password_resets").doc(trimmedEmail).set({
      code: otpCode,
      email: trimmedEmail,
      uid: userRecord.uid,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      attempts: 0,
    });

    // Enviar email con el código
    try {
      await sendEmail({
        to: trimmedEmail,
        subject: "Código de recuperación de contraseña - MoveTogether",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0b1b27;">Recuperación de contraseña</h2>
            <p>Hola,</p>
            <p>Has solicitado recuperar tu contraseña. Tu código de verificación es:</p>
            <div style="background: #f5f6f8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="color: #0b1b27; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
            </div>
            <p>Este código es válido por <strong>10 minutos</strong>.</p>
            <p>Si no solicitaste este código, puedes ignorar este correo.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">MoveTogether - De campus a casa, juntos.</p>
          </div>
        `,
        text: `Tu código de recuperación de contraseña es: ${otpCode}. Válido por 10 minutos.`,
      });
    } catch (emailError: any) {
      // Si falla el envío de email pero estamos en desarrollo, continuar
      if (process.env.NODE_ENV === "development") {
        console.log(`⚠️ [DEV] Email no enviado, pero código generado: ${otpCode}`);
        console.log(`   Para ${trimmedEmail}`);
      } else {
        // En producción, si falla el email, es un error crítico
        console.error("Error sending email:", emailError);
        throw new Error("No se pudo enviar el código por correo. Intenta más tarde.");
      }
    }

    return res.status(200).json({
      message: "Código enviado al correo electrónico",
      // En desarrollo, retornar el código para pruebas
      ...(process.env.NODE_ENV === "development" && { code: otpCode }),
    });
  } catch (error: any) {
    console.error("Error in send-otp handler:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error.message || "Unknown error",
    });
  }
}

