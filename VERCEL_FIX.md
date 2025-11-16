# 🔧 Solución de Errores de Vercel

## Los 404 que ves son NORMALES

Los errores de `/favicon.png` y `/favicon.ico` son **normales** y no causan fallos en el deployment. Son solo peticiones del navegador buscando el icono.

## Para ver el error REAL del deployment:

1. **En Vercel Dashboard**:
   - Ve a tu proyecto en https://vercel.com
   - Click en el deployment que falló (el que tiene la X roja)
   - Ve a la pestaña **"Build Logs"** o **"Runtime Logs"**
   - Busca errores en **rojo** que digan cosas como:
     - "Cannot find module"
     - "Type error"
     - "Build failed"
     - "Compilation error"

2. **En GitHub**:
   - Click en "Details" del check que falló
   - Verás los logs de build ahí

## Posibles problemas y soluciones:

### Error: "Cannot find module '../../src/email'"

**Solución**: Vercel necesita compilar también los archivos en `src/`

1. Asegúrate de que `tsconfig.json` incluya:
   ```json
   "include": ["src", "api"]
   ```

2. Verifica que `src/email.ts` esté en el repositorio (no en `.gitignore`)

### Error: "Build command failed"

**Solución**: Agrega script de build en `package.json`:
```json
"build": "tsc"
```

### Error: Variables de entorno faltantes

**Solución**: En Vercel → Settings → Environment Variables, agrega:
- `RESEND_API_KEY` (opcional, solo si quieres emails)
- `RESEND_FROM_EMAIL` (opcional)
- Todas las variables de Firebase que ya tengas

## Checklist rápido:

- [ ] `tsconfig.json` incluye `"src"` y `"api"`
- [ ] `src/email.ts` está en el repo (no ignorado)
- [ ] `package.json` tiene script `"build": "tsc"`
- [ ] Variables de entorno configuradas en Vercel
- [ ] `vercel.json` está presente

## Si sigue fallando:

Comparte el error exacto de los **Build Logs** (no los Runtime Logs de favicon) y te ayudo a solucionarlo específicamente.




