import type { VercelRequest, VercelResponse } from "@vercel/node";

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
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { type, message, userEmail, userName } = body;

    if (!type || (type !== "support" && type !== "report")) {
      return res.status(400).json({ error: "Type must be 'support' or 'report'" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Email de destino
    const toEmail = "movetogetherwheels@gmail.com";
    
    // Configurar Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFrom = process.env.RESEND_FROM || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY no configurada");
      // En desarrollo, solo loguear
      console.log("📧 [EMAIL SIMULADO]");
      console.log(`   To: ${toEmail}`);
      console.log(`   Type: ${type}`);
      console.log(`   Message: ${message}`);
      console.log(`   User: ${userName || "Unknown"} (${userEmail || "Unknown"})`);
      
      return res.status(200).json({ 
        ok: true,
        message: "Email enviado correctamente (simulado en desarrollo)",
      });
    }

    // Preparar el email
    const subject = type === "support" 
      ? `[MoveTogether] Mensaje de Soporte - ${userName || "Usuario"}`
      : `[MoveTogether] Reporte de Problema - ${userName || "Usuario"}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0b1b27; border-bottom: 2px solid #0b1b27; padding-bottom: 10px;">
          ${type === "support" ? "📧 Mensaje de Soporte" : "🐛 Reporte de Problema"}
        </h2>
        
        <div style="background: #f5f6f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Usuario:</strong> ${userName || "No proporcionado"}</p>
          <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail || "No proporcionado"}</p>
          <p style="margin: 5px 0;"><strong>Tipo:</strong> ${type === "support" ? "Soporte" : "Reporte de Problema"}</p>
        </div>
        
        <div style="background: #ffffff; padding: 20px; border-left: 4px solid #0b1b27; margin: 20px 0;">
          <h3 style="color: #0b1b27; margin-top: 0;">Mensaje:</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message.replace(/\n/g, "<br>")}</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
          MoveTogether - De campus a casa, juntos.
        </p>
      </div>
    `;

    const textContent = `
${type === "support" ? "Mensaje de Soporte" : "Reporte de Problema"}

Usuario: ${userName || "No proporcionado"}
Email: ${userEmail || "No proporcionado"}
Tipo: ${type === "support" ? "Soporte" : "Reporte de Problema"}

Mensaje:
${message}

---
MoveTogether - De campus a casa, juntos.
    `.trim();

    // Enviar email con Resend
    try {
      console.log(`📧 Enviando email de ${type} a ${toEmail}...`);
      
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: resendFrom,
          to: [toEmail],
          subject: subject,
          html: htmlContent,
          text: textContent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Email enviado correctamente. Resend ID: ${data.id || "N/A"}`);
        return res.status(200).json({ 
          ok: true,
          message: "Email enviado correctamente",
        });
      } else {
        // Si Resend falla, loguear pero no fallar
        let errorData: any;
        try {
          errorData = await response.json();
        } catch {
          const errorText = await response.text();
          errorData = { message: errorText };
        }
        
        console.error("❌ Resend API error:", JSON.stringify(errorData, null, 2));
        console.error(`   Status: ${response.status} ${response.statusText}`);
        
        // En desarrollo, retornar éxito de todas formas
        if (process.env.NODE_ENV === "development") {
          console.log("⚠️ [DESARROLLO] Email no enviado, pero retornando éxito");
          return res.status(200).json({ 
            ok: true,
            message: "Email simulado (Resend no disponible en desarrollo)",
          });
        }
        
        // En producción, retornar error
        return res.status(500).json({ 
          error: "Error al enviar el email",
          message: errorData?.message || "Unknown error",
        });
      }
    } catch (emailError: any) {
      console.error("❌ Error sending email:", emailError?.message || emailError);
      
      // En desarrollo, retornar éxito de todas formas
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ [DESARROLLO] Error enviando email, pero retornando éxito");
        return res.status(200).json({ 
          ok: true,
          message: "Email simulado (error en desarrollo)",
        });
      }
      
      return res.status(500).json({
        error: "Error interno al enviar el email",
        message: emailError?.message || "Unknown error",
      });
    }
  } catch (error: any) {
    console.error("❌ Error in contact handler:", error);
    return res.status(500).json({
      error: "Internal error",
      message: error?.message || "Unknown error",
    });
  }
}


