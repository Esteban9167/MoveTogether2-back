# 🔧 Solución: "Requests from referer <empty> are blocked"

## ❌ Problema

El error ocurre porque la **API Key de Firebase Web API** (`FIREBASE_WEB_API_KEY`) tiene restricciones de HTTP referrers que bloquean las requests desde el servidor.

**Por qué pasa:**
- El backend hace llamadas a Firebase Auth REST API desde el servidor
- Las requests desde el servidor no tienen "referer" (header vacío)
- Firebase bloquea estas requests porque la API Key tiene restricciones de referrer

## ✅ Solución

### Opción 1: Quitar restricciones de HTTP referrers (Recomendado)

La API Key de Firebase Web API se usa desde el **servidor**, no desde el cliente, por lo que NO debe tener restricciones de HTTP referrers.

1. Ve a: https://console.cloud.google.com/apis/credentials
2. Busca la API Key que corresponde a `FIREBASE_WEB_API_KEY`
   - Esta es diferente a la API Key de Google Maps
   - Generalmente es la misma que `NEXT_PUBLIC_FIREBASE_API_KEY`
3. Click en esa API Key
4. En **"Application restrictions"**:
   - Selecciona: **"None"** (sin restricciones)
   - O selecciona: **"IP addresses"** si quieres restringir por IP del servidor
5. En **"API restrictions"**:
   - Selecciona: **"Restrict key"**
   - Marca SOLO estas APIs:
     - ✅ Identity Toolkit API
     - ✅ Firebase Admin SDK API (si existe)
6. Click en **"SAVE"**

### Opción 2: Verificar que estés usando la API Key correcta

Hay dos API Keys diferentes:
1. **Google Maps API Key** → Para Maps JavaScript API (con restricciones de referrer)
2. **Firebase Web API Key** → Para Firebase Auth REST API (sin restricciones de referrer)

Verifica que `FIREBASE_WEB_API_KEY` en el backend sea diferente o tenga restricciones diferentes.

### Opción 3: Usar IP restrictions en lugar de referrer

Si necesitas seguridad, usa restricciones por IP:

1. En **"Application restrictions"** → Selecciona **"IP addresses"**
2. Agrega la IP de tu servidor (para Vercel, consulta sus rangos de IP)
3. Para desarrollo local, agrega `0.0.0.0/0` (temporalmente)

## 🔍 Cómo identificar la API Key correcta

La `FIREBASE_WEB_API_KEY` es la misma que aparece en:
- Firebase Console > Project Settings > General > **Web API Key**

**NO es la misma que:**
- Google Maps API Key (esa es para Maps)

## 📋 Checklist

- [ ] Identificaste la API Key de Firebase Web API
- [ ] Quitaste restricciones de HTTP referrers de esa API Key
- [ ] Configuraste restricciones de API (solo Identity Toolkit)
- [ ] Guardaste los cambios
- [ ] Esperaste 2-3 minutos
- [ ] Reiniciaste el backend
- [ ] Probaste login nuevamente

## 🧪 Verificación

Después de configurar, prueba el login:
- ✅ Login con email/password debería funcionar
- ✅ Login con Google debería funcionar
- ✅ No debería haber errores 400 en la consola






