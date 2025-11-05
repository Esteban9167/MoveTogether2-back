# Desarrollo Local del Backend

## Opción 1: Usar npx (Recomendado)

```bash
cd back
npx vercel dev --listen=3001
```

## Opción 2: Usar el script npm

```bash
cd back
npm run serve
```

## Opción 3: Instalar Vercel CLI globalmente

```bash
npm install -g vercel
```

Luego ejecuta:
```bash
cd back
vercel dev --listen=3001
```

## Variables de Entorno

Asegúrate de tener un archivo `.env.local` en la carpeta `back/` con:

```bash
FIREBASE_PROJECT_ID=tu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tu-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_WEB_API_KEY=tu-web-api-key
CORS_ORIGIN=http://localhost:3000
```

## Solución al Error de Recursión

Si ves el error "vercel dev must not recursively invoke itself", significa que Vercel está detectando que el script `dev` llama a `vercel dev`. 

**Solución**: Usa directamente `npx vercel dev --listen=3001` en lugar de `npm run dev`.

