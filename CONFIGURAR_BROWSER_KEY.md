# 🔧 Configurar "Browser key (auto created by Firebase)"

## 📍 API Key a Configurar

**Nombre:** "Browser key (auto created by Firebase)"
**Restricciones actuales:** "URL de referencia HTTP, 27 API..."

## ✅ Solución

### Paso 1: Abrir la configuración

1. En la lista de "Claves de API", haz click en **"Browser key (auto created by Firebase)"**
2. O haz click en el menú de 3 puntos (⋮) y selecciona **"Editar"** o **"Restringir clave"**

### Paso 2: Configurar Application Restrictions

En **"Restricciones de aplicación"** o **"Application restrictions"**:

**Opción A (Recomendada para desarrollo):**
- Selecciona: **"Ninguna"** o **"None"**
- Esto permite que el backend use la API Key sin restricciones de referrer

**Opción B (Si quieres seguridad):**
- Selecciona: **"Direcciones IP"** o **"IP addresses"**
- Agrega las IPs de tus servidores
- Para desarrollo local, puedes agregar `0.0.0.0/0` temporalmente

⚠️ **NO uses "URL de referencia HTTP"** porque esta API Key se usa desde el servidor, no desde el navegador.

### Paso 3: Configurar API Restrictions

En **"Restricciones de API"** o **"API restrictions"**:

- Selecciona: **"Restringir clave"** o **"Restrict key"**
- Marca SOLO estas APIs:
  - ✅ **Identity Toolkit API** (necesaria para Firebase Auth REST API)
  - ✅ **Firebase Management API** (si existe)
  - ✅ **Cloud Firestore API** (si la usas)
  - ✅ **Cloud Storage for Firebase API** (si la usas)

### Paso 4: Guardar

1. Click en **"GUARDAR"** o **"SAVE"**
2. Espera 2-3 minutos para que los cambios se propaguen

## 🔍 Verificar

Después de configurar:
1. Reinicia el backend
2. Intenta hacer login
3. Debería funcionar sin el error "referer <empty> are blocked"

## ⚠️ Importante

Esta API Key (`FIREBASE_WEB_API_KEY`) es diferente a:
- La API Key de Google Maps (esa SÍ debe tener restricciones de HTTP referrers)
- Las API Keys del cliente (esas SÍ deben tener restricciones)

La "Browser key" se llama así porque Firebase la creó automáticamente, pero en realidad se usa desde el servidor para Firebase Auth REST API.






