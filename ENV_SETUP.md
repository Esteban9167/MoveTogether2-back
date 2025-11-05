# Configuración de Variables de Entorno - Backend

## Archivo `.env.local`

Crea un archivo `.env.local` en la carpeta `back/` con el siguiente contenido:

```bash
# ============================================
# Firebase Admin SDK (Credenciales de Servicio)
# ============================================
# Obtén estas desde: Firebase Console > Project Settings > Service Accounts
# 1. Haz clic en "Generate New Private Key"
# 2. Descarga el JSON y copia los valores

FIREBASE_PROJECT_ID=movetogether-e31d4
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@movetogether-e31d4.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCnvX1f4sD+U4ph\n...\n-----END PRIVATE KEY-----\n"

# ============================================
# Firebase Web API Key
# ============================================
# Obtén esta desde: Firebase Console > Project Settings > General > Web API Key
FIREBASE_WEB_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# ============================================
# CORS Configuration
# ============================================
# Para desarrollo local: usa "*" o deja vacío (se permite localhost automáticamente)
# Para producción: lista las URLs separadas por coma
CORS_ORIGIN=http://localhost:3000,https://tu-frontend.vercel.app
```

## Instrucciones Detalladas:

### 1. Firebase Admin SDK:

1. Ve a: https://console.firebase.google.com/
2. Selecciona tu proyecto: `movetogether-e31d4`
3. Ve a: **⚙️ Settings** > **Project settings**
4. Pestaña: **Service accounts**
5. Haz clic en: **Generate new private key**
6. Descarga el archivo JSON
7. Abre el JSON y copia:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (pégala completa, con comillas)

### 2. Firebase Web API Key:

1. En la misma página de Firebase Console
2. Pestaña: **General**
3. Sección: **Your apps** (si no hay app web, crea una)
4. Busca: **Web API Key**
5. Copia ese valor → `FIREBASE_WEB_API_KEY`

### 3. CORS Configuration:

- **Local**: `CORS_ORIGIN=http://localhost:3000` o `*`
- **Producción**: `CORS_ORIGIN=https://tu-frontend.vercel.app`

## Verificación:

```bash
# Verifica que el archivo existe
cat back/.env.local

# Ejecuta el servidor de desarrollo
cd back
npm run dev
```

El servidor debería iniciar en `http://localhost:3001`

## Para Vercel:

1. Ve a tu proyecto en Vercel Dashboard
2. Settings > Environment Variables
3. Agrega todas las variables de arriba
4. **Importante**: Para `FIREBASE_PRIVATE_KEY`, pégala tal cual (con los `\n` literales o con saltos de línea reales)

