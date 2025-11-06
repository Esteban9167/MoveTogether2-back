# Configuración de Email para Recuperación de Contraseña

## 📧 Estado Actual

El sistema de recuperación de contraseña está implementado y **funciona** de la siguiente manera:

- **Desarrollo**: El código OTP se muestra en la consola del backend
- **Producción**: Se enviará por email cuando configures un servicio de email

## 🚀 Configuración para Producción

Para que los correos se envíen automáticamente en producción, necesitas configurar uno de estos servicios:

### Opción 1: SendGrid (Recomendado) ⭐

SendGrid ofrece 100 emails gratis por día, perfecto para empezar.

#### Pasos:

1. **Crear cuenta en SendGrid**:
   - Ve a https://sendgrid.com
   - Crea una cuenta gratuita
   - Verifica tu email

2. **Crear API Key**:
   - Ve a Settings → API Keys
   - Click en "Create API Key"
   - Dale un nombre (ej: "MoveTogether Production")
   - Selecciona "Full Access" o "Restricted Access" con permisos de Mail Send
   - Copia el API Key (solo se muestra una vez)

3. **Verificar dominio o usar Single Sender**:
   - **Opción A (Recomendada)**: Verifica tu dominio (ej: `unisabana.edu.co`)
   - **Opción B**: Usa "Single Sender Verification" (más rápido, pero menos profesional)

4. **Configurar variables de entorno**:
   - En Vercel (o tu plataforma de hosting):
     - `SENDGRID_API_KEY`: Tu API Key de SendGrid
     - `SENDGRID_FROM_EMAIL`: El email verificado (ej: `noreply@unisabana.edu.co`)

5. **En Vercel**:
   ```
   Settings → Environment Variables
   SENDGRID_API_KEY = tu_api_key_aqui
   SENDGRID_FROM_EMAIL = noreply@unisabana.edu.co
   ```

### Opción 2: AWS SES (Amazon Simple Email Service)

Si ya usas AWS, puedes usar SES.

1. **Configurar SES**:
   - Verifica tu dominio en AWS SES
   - Crea credenciales IAM con permisos de SES

2. **Variables de entorno**:
   - Necesitarías modificar `src/email.ts` para usar AWS SDK
   - Configurar `AWS_ACCESS_KEY_ID` y `AWS_SECRET_ACCESS_KEY`

### Opción 3: SMTP (Nodemailer)

Si tienes un servidor SMTP propio (Gmail, Outlook, etc.)

1. **Instalar Nodemailer**:
   ```bash
   npm install nodemailer
   npm install --save-dev @types/nodemailer
   ```

2. **Variables de entorno**:
   ```
   SMTP_HOST = smtp.gmail.com
   SMTP_PORT = 587
   SMTP_USER = tu_email@gmail.com
   SMTP_PASS = tu_app_password
   SMTP_FROM = tu_email@gmail.com
   ```

3. **Descomentar código Nodemailer** en `src/email.ts`

## 🔍 Verificación

### En Desarrollo:
- El código se muestra en la consola del backend
- No se envía email real (a menos que configures SendGrid)

### En Producción:
- Si `SENDGRID_API_KEY` está configurado → Se envía email real
- Si no está configurado → Error en producción

## 📝 Ejemplo de Email Enviado

El email que recibirán los usuarios incluye:
- Asunto: "Código de recuperación de contraseña - MoveTogether"
- Código OTP de 4 dígitos destacado
- Instrucciones de validez (10 minutos)
- Diseño HTML profesional

## ⚠️ Importante

- **Desarrollo**: Puedes probar sin configurar email (código en consola)
- **Producción**: **DEBES** configurar SendGrid o otro servicio
- El código OTP expira en 10 minutos
- Máximo 5 intentos de verificación

## 🆘 Solución de Problemas

### "Email service not configured"
- Configura `SENDGRID_API_KEY` en variables de entorno

### "SendGrid error: Unauthorized"
- Verifica que el API Key sea correcto
- Asegúrate de que el API Key tenga permisos de "Mail Send"

### "Email no enviado"
- Verifica que el dominio/email esté verificado en SendGrid
- Revisa los logs del backend para más detalles

