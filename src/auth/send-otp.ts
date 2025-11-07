import type { VercelRequest, VercelResponse } from "@vercel/node";

const allowList = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);

function allowOrigin(origin = "") {
  return allowList.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

// Almacenamiento en memoria para OTP (mock para desarrollo)
declare global {
  // eslint-disable-next-line no-var
  var __OTP_STORE__: Map<string, { code: string; exp: number; uid?: string }> | undefined;
}

if (!globalThis.__OTP_STORE__) {
  globalThis.__OTP_STORE__ = new Map();
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
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parse body
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { email } = body;

    // Validar email
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Validar que sea correo institucional
    if (!trimmedEmail.endsWith("@unisabana.edu.co")) {
      return res.status(400).json({ error: "Solo se permiten correos institucionales" });
    }

    // Intentar verificar usuario en Firebase Auth (opcional, no crítico)
    let userRecord = null;
    let uid: string | undefined = undefined;
    
    try {
      const { getAuth } = await import("../../src/firebase");
      const auth = getAuth();
      userRecord = await auth.getUserByEmail(trimmedEmail);
      uid = userRecord.uid;
    } catch (authError: any) {
      // Si el usuario no existe, aún así generamos el código (puede ser que no esté en Firebase Auth)
      if (authError.code === "auth/user-not-found") {
        console.log(`⚠️ Usuario no encontrado en Firebase Auth: ${trimmedEmail}`);
        // Continuar de todas formas para no revelar si el email existe o no
      } else {
        console.warn("⚠️ Error verificando usuario en Firebase Auth:", authError.message);
        // Continuar de todas formas
      }
    }

    // Generar código OTP de 4 dígitos (como espera el frontend)
    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutos

    // Guardar código en memoria (mock) o Firestore
    if (globalThis.__OTP_STORE__) {
      const otpData: { code: string; exp: number; uid?: string } = { 
        code: otpCode, 
        exp: expiresAt 
      };
      if (uid) {
        otpData.uid = uid;
      }
      globalThis.__OTP_STORE__.set(trimmedEmail, otpData);
    }

    // Intentar guardar en Firestore si está disponible
    try {
      const { getDb } = await import("../../src/firebase");
      const db = getDb();
      await db.collection("password_resets").doc(trimmedEmail).set({
        code: otpCode,
        email: trimmedEmail,
        uid: uid || null,
        expiresAt: new Date(expiresAt).toISOString(),
        createdAt: new Date().toISOString(),
        attempts: 0,
      });
    } catch (firestoreError: any) {
      console.warn("⚠️ Error guardando en Firestore:", firestoreError.message);
      // Continuar de todas formas, el código está en memoria
    }

    // Intentar enviar email usando Resend (para producción)
    let emailSent = false;
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    
    if (resendApiKey) {
      try {
        console.log(`📧 Intentando enviar email con Resend a ${trimmedEmail}...`);
        console.log(`   From: ${resendFrom}`);
        
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: resendFrom,
            to: [trimmedEmail],
            subject: "Código de recuperación de contraseña - MoveTogether",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0b1b27;">Recuperación de contraseña</h2>
                <p>Hola,</p>
                <p>Has solicitado recuperar tu contraseña. Tu código de verificación es:</p>
                <div style="background: #f5f6f8; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                  <h1 style="color: #0b1b27; font-size: 32px; letter-spacing: 8px; margin: 0;">${otpCode}</h1>
                </div>
                <p>Este código es válido por <strong>5 minutos</strong>.</p>
                <p>Si no solicitaste este código, puedes ignorar este correo.</p>
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                <p style="color: #6b7280; font-size: 12px;">MoveTogether - De campus a casa, juntos.</p>
              </div>
            `,
            text: `Tu código de recuperación de contraseña es: ${otpCode}. Válido por 5 minutos.`,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Email enviado correctamente con Resend a ${trimmedEmail}`);
          console.log(`   Resend ID: ${data.id || "N/A"}`);
          emailSent = true;
        } else {
          // Si Resend falla, mostrar el error y el código en consola
          let errorData: any;
          try {
            errorData = await response.json();
          } catch {
            const errorText = await response.text();
            errorData = { message: errorText };
          }
          
          if (response.status === 403 && errorData?.message?.includes("testing emails")) {
            console.warn("⚠️ [RESEND LIMIT] Solo puedes enviar a tu email registrado en Resend.");
            console.warn("   Para enviar a cualquier email, verifica un dominio en resend.com/domains");
          } else {
            console.error("❌ Resend API error:", JSON.stringify(errorData, null, 2));
            console.error(`   Status: ${response.status} ${response.statusText}`);
          }
          emailSent = false;
        }
      } catch (emailError: any) {
        console.error("❌ Error sending email with Resend:", emailError?.message || emailError);
        emailSent = false;
      }
    }
    
    // Mostrar siempre el código OTP en la consola (útil para desarrollo y si falla el email)
    console.log("");
    console.log("═══════════════════════════════════════════════════════════");
    console.log("📧 [CÓDIGO OTP GENERADO]");
    console.log(`   Email: ${trimmedEmail}`);
    console.log(`   Código: ${otpCode}`);
    console.log(`   Válido por: 5 minutos`);
    if (!emailSent) {
      console.log(`   ⚠️ Email no enviado - usa este código para desarrollo`);
    }
    console.log("═══════════════════════════════════════════════════════════");
    console.log("");

    // Retornar éxito siempre (el código está generado y guardado)
    return res.status(200).json({ 
      ok: true,
      message: emailSent 
        ? "Código enviado al correo electrónico" 
        : "Código generado correctamente",
      // En desarrollo, retornar el código para pruebas
      ...((process.env.NODE_ENV === "development" || !process.env.RESEND_API_KEY) && { 
        code: otpCode,
        expiresIn: "5 minutos"
      }),
    });
  } catch (error: any) {
    console.error("❌ Error in send-otp handler:", error);
    console.error("   Error message:", error?.message);
    console.error("   Error stack:", error?.stack);
    return res.status(500).json({
      error: "Internal error",
      message: error?.message || "Unknown error",
    });
  }
}

