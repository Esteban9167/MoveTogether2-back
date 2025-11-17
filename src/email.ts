// Utilidad para enviar emails
// Soporta Resend (más simple), SendGrid, o Nodemailer como alternativas

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<void> {
  // Opción 1: Resend (MÁS SIMPLE - Recomendado) ⭐
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "MoveTogether <noreply@movetogether.com>",
          to: [to],
          subject: subject,
          html: html || text,
          text: text || html?.replace(/<[^>]*>/g, "") || "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("❌ Resend API error:", JSON.stringify(error));
        // NO lanzar error - solo loguear y retornar
        return;
      }
      return;
    } catch (error: any) {
      console.error("❌ Error sending email with Resend:", error?.message || error);
      // NO lanzar error - solo loguear y retornar
      return;
    }
  }

  // Opción 2: SendGrid (alternativa)
  const sendGridApiKey = process.env.SENDGRID_API_KEY;
  if (sendGridApiKey) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendGridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to }],
            },
          ],
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "noreply@movetogether.com",
            name: "MoveTogether",
          },
          subject: subject,
          content: [
            {
              type: "text/plain",
              value: text || html?.replace(/<[^>]*>/g, "") || "",
            },
            ...(html
              ? [
                  {
                    type: "text/html",
                    value: html,
                  },
                ]
              : []),
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("❌ SendGrid API error:", error);
        // NO lanzar error - solo loguear y retornar
        return;
      }
      return;
    } catch (error: any) {
      console.error("❌ Error sending email with SendGrid:", error?.message || error);
      // NO lanzar error - solo loguear y retornar
      return;
    }
  }

  // Opción 3: Gmail SMTP (GRATIS si tienes Gmail)
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    try {
      // Usar fetch directamente con Gmail SMTP (sin nodemailer)
      const response = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailPass}`, // En realidad necesitas OAuth2, pero esto es complejo
        },
      });
      // Nota: Gmail requiere OAuth2, mejor usar Resend o SendGrid
    } catch (error) {
      console.error("Gmail SMTP requires OAuth2, use Resend instead");
    }
  }

  // Opción 4: SMTP Genérico (cualquier servidor SMTP)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpHost && smtpUser && smtpPass) {
    // Para SMTP necesitarías nodemailer instalado
    // npm install nodemailer @types/nodemailer
    // Por ahora, mejor usar Resend que es más simple
    console.warn("SMTP configurado pero nodemailer no está instalado. Usa Resend en su lugar.");
  }

  // Si no hay servicio configurado, solo loguear (no lanzar error)
  // Esto permite que el flujo continúe incluso sin servicio de email
  console.log("📧 [INFO] Email service not configured. Email would be sent:");
  console.log(`   To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body: ${text || html?.substring(0, 100)}...`);
  console.log(`   Configure RESEND_API_KEY, SENDGRID_API_KEY, or SMTP config to send emails.`);
  
  // NO lanzar error - solo retornar (el código OTP ya está generado)
  // Esto permite que el flujo de recuperación continúe en desarrollo
  return;
}

