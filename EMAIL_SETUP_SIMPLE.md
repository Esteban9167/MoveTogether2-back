# 📧 Configuración Simple de Email - Resend

## 🚀 La forma MÁS FÁCIL (Resend)

**Resend** es más simple que SendGrid y solo requiere 1 variable de entorno.

### Pasos (5 minutos):

1. **Crear cuenta en Resend**:
   - Ve a https://resend.com
   - Crea cuenta gratis (100 emails/día gratis)
   - Verifica tu email

2. **Crear API Key**:
   - Ve a "API Keys" en el dashboard
   - Click "Create API Key"
   - Dale un nombre (ej: "MoveTogether")
   - Copia el API Key

3. **Verificar dominio** (opcional pero recomendado):
   - Ve a "Domains"
   - Agrega tu dominio (ej: `unisabana.edu.co`)
   - Sigue las instrucciones para verificar DNS
   - O usa el dominio por defecto de Resend para pruebas

4. **Configurar en Vercel**:
   ```
   Settings → Environment Variables
   RESEND_API_KEY = re_xxxxxxxxxxxxxxxxxxxx
   RESEND_FROM_EMAIL = noreply@unisabana.edu.co (o el que verifiques)
   ```

5. **¡Listo!** Ya funciona. Redespliega.

## 🎯 Ventajas de Resend vs SendGrid:

- ✅ **Más simple**: Solo 1 API key vs múltiples configuraciones
- ✅ **Mejor UX**: Dashboard más limpio
- ✅ **Mismo gratis**: 100 emails/día
- ✅ **API más simple**: Menos código, menos errores

## 📝 Ejemplo de variables:

```env
RESEND_API_KEY=re_abc123xyz...
RESEND_FROM_EMAIL=noreply@unisabana.edu.co
```

## ⚠️ Si no configuras nada:

- **Desarrollo**: El código aparece en consola (funciona para pruebas)
- **Producción**: Error si no hay servicio configurado

## 🆘 Problemas comunes:

**"Resend error: Unauthorized"**
→ Verifica que el API Key sea correcto

**"Domain not verified"**
→ Verifica tu dominio en Resend o usa el dominio por defecto

---

**¿No quieres configurar nada?** El código funciona en desarrollo (consola) para pruebas. Pero para producción necesitas algún servicio de email.




