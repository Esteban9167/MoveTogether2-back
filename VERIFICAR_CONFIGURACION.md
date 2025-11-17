# ✅ Verificación de Configuración

## ✅ APIs Marcadas (Correcto)

Tienes todas las APIs necesarias:
- ✅ Identity Toolkit API (para Firebase Auth)
- ✅ Maps JavaScript API (para Google Maps)
- ✅ Geocoding API (para Google Maps)
- ✅ Places API (para Google Maps)

Esto está bien, aunque podrías restringir solo a las necesarias.

## 🔧 Lo Más Importante: Application Restrictions

El problema principal es la configuración de **"Restricciones de aplicación"** o **"Application restrictions"**.

### Verifica que esté así:

1. En la configuración de la API Key "Browser key"
2. Busca la sección **"Restricciones de aplicación"** o **"Application restrictions"**
3. Debe estar configurada como:
   - ✅ **"Ninguna"** o **"None"** ← ESTA ES LA CORRECTA
   
   ❌ NO debe estar en:
   - "URL de referencia HTTP" (HTTP referrers)
   - "Direcciones IP" (a menos que sepas las IPs exactas)

### ¿Por qué?

La API Key de Firebase se usa desde el **servidor** (backend), no desde el navegador. Cuando el servidor hace llamadas a Firebase Auth REST API, no envía un "referer" (porque es una llamada servidor-a-servidor), entonces Firebase bloquea la request si tienes restricciones de HTTP referrers.

## 📋 Checklist Final

- [ ] Application restrictions = **"None"** (Ninguna)
- [ ] API restrictions = **"Restrict key"** con las APIs necesarias marcadas ✅
- [ ] Guardaste los cambios
- [ ] Esperaste 2-3 minutos
- [ ] Reiniciaste el backend
- [ ] Probaste el login

## 🧪 Prueba Rápida

Después de configurar "None" en Application restrictions:

1. Guarda los cambios
2. Espera 2-3 minutos
3. Reinicia el backend:
   ```bash
   cd back
   npm run dev
   ```
4. Intenta hacer login con email/password
5. Debería funcionar sin el error "referer <empty> are blocked"






