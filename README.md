# Backend - MoveTogether2

## Variables de Entorno

Crea un archivo `.env.local` en la raíz del proyecto `back/` con las siguientes variables:

```bash
# Firebase Admin SDK - Credenciales de servicio
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_CLAVE_PRIVADA_AQUI\n-----END PRIVATE KEY-----\n"

# Firebase Web API Key (para autenticación REST API)
FIREBASE_WEB_API_KEY=tu-web-api-key

# CORS - Orígenes permitidos (separados por coma)
# Para desarrollo local, puedes usar "*" o dejar vacío para permitir localhost automáticamente
# Para producción, especifica la URL exacta de tu frontend
CORS_ORIGIN=http://localhost:3000,https://tu-frontend.vercel.app
```

## Cómo obtener las credenciales:

### 1. Firebase Admin SDK:
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Project Settings** > **Service Accounts**
4. Haz clic en **Generate New Private Key**
5. Descarga el archivo JSON
6. Copia los valores:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (pégala tal cual, con los saltos de línea)

### 2. Firebase Web API Key:
1. En Firebase Console, ve a **Project Settings** > **General**
2. En la sección "Your apps", busca **Web API Key**
3. Copia ese valor → `FIREBASE_WEB_API_KEY`

## Comandos:

```bash
# Desarrollo local
npm run dev

# Compilar TypeScript
npm run build
```

## Endpoints disponibles:

- `POST /api/auth/login` - Login con email/password
- `POST /api/auth/google` - Verificar token de Google
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/verify` - Verificar token JWT
- `POST /api/auth/ensure-user` - Verificar si usuario existe en Firestore
- `GET /api/items` - Obtener items
- `POST /api/items` - Crear item

## Despliegue en Vercel:

1. Configura las variables de entorno en Vercel Dashboard
2. Asegúrate de que `CORS_ORIGIN` apunte a la URL de tu frontend en producción
3. El backend se despliega automáticamente al hacer push a la rama `main`






