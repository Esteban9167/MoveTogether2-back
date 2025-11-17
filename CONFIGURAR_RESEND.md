# 🚀 Configuración Rápida de Resend

## Paso 1: Crear cuenta en Resend (2 minutos)

1. Ve a https://resend.com
2. Click en "Sign Up" (arriba derecha)
3. Ingresa tu email y crea contraseña
4. Verifica tu email (revisa tu bandeja)

## Paso 2: Crear API Key (1 minuto)

1. Una vez dentro del dashboard, ve a "API Keys" (menú lateral izquierdo)
2. Click en "Create API Key" (botón azul)
3. Dale un nombre: `MoveTogether Production`
4. Click "Add"
5. **IMPORTANTE**: Copia el API Key que aparece (solo se muestra UNA vez)
   - Se ve algo como: `re_abc123xyz789...`
   - Guárdalo en un lugar seguro

## Paso 3: Verificar dominio (opcional - 3 minutos)

### Opción A: Usar dominio de Resend (RÁPIDO para pruebas)
- Puedes usar el dominio por defecto de Resend
- No necesitas verificar nada
- Ejemplo: `onboarding@resend.dev` (solo para pruebas)

### Opción B: Verificar tu dominio (RECOMENDADO para producción)
1. Ve a "Domains" en el menú lateral
2. Click "Add Domain"
3. Ingresa tu dominio (ej: `unisabana.edu.co`)
4. Sigue las instrucciones para agregar los registros DNS
5. Espera a que se verifique (puede tomar unos minutos)

## Paso 4: Configurar en Vercel (2 minutos)

1. Ve a tu proyecto en Vercel: https://vercel.com
2. Selecciona tu proyecto `MoveTogether2-back`
3. Ve a **Settings** → **Environment Variables**
4. Agrega estas 2 variables:

   **Variable 1:**
   - Name: `RESEND_API_KEY`
   - Value: `re_abc123xyz789...` (tu API key de Resend)
   - Environment: Production, Preview, Development (marca todas)

   **Variable 2:**
   - Name: `RESEND_FROM_EMAIL`
   - Value: `noreply@unisabana.edu.co` (o el email que verificaste)
   - Environment: Production, Preview, Development (marca todas)

5. Click "Save"

## Paso 5: Redesplegar (1 minuto)

1. En Vercel, ve a "Deployments"
2. Click en los 3 puntos del último deployment
3. Click "Redeploy"
4. O simplemente haz un push a tu repositorio

## ✅ ¡Listo!

Ahora cuando un usuario solicite recuperar contraseña:
- El código OTP se enviará automáticamente a su email
- Recibirá un email profesional con el código de 4 dígitos
- El código será válido por 10 minutos

## 🧪 Probar

1. Ve a tu app en producción
2. Click "Recover password"
3. Ingresa un correo institucional
4. Revisa el correo del usuario
5. Deberías recibir el código OTP

## 🆘 Problemas comunes

**"Resend error: Unauthorized"**
→ Verifica que copiaste bien el API Key (sin espacios)

**"Domain not verified"**
→ Usa el dominio por defecto de Resend (`onboarding@resend.dev`) para pruebas

**No llegan los emails**
→ Revisa la carpeta de spam
→ Verifica que el dominio esté verificado en Resend

## 📝 Resumen de variables necesarias

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@unisabana.edu.co
```

¡Eso es todo! 🎉




