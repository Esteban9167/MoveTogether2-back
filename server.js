// Servidor de desarrollo simple para evitar problemas con espacios en rutas
const http = require('http');
const { parse } = require('url');
const path = require('path');
const fs = require('fs');

// Importar los handlers compilados
const itemsHandler = require('./dist/api/items.js').default;
const loginHandler = require('./dist/api/auth/login.js').default;
const registerHandler = require('./dist/api/register.js').default;
const googleHandler = require('./dist/api/auth/google.js').default;
const verifyHandler = require('./dist/api/auth/verify.js').default;
const ensureUserHandler = require('./dist/api/auth/ensure-user.js').default;
const meHandler = require('./dist/api/me.js').default;
const vehiclesHandler = require('./dist/api/vehicles.js').default;
const healthHandler = require('./dist/api/health.js').default;
const sendOtpHandler = require('./dist/api/auth/send-otp.js').default;
const verifyOtpHandler = require('./dist/api/auth/verify-otp.js').default;
const resetPasswordHandler = require('./dist/api/auth/reset-password.js').default;

// Cargar variables de entorno
require('dotenv').config({ path: '.env.local' });

const PORT = 3001;

// Simular request/response de Vercel
function createVercelRequest(req) {
  return {
    method: req.method,
    headers: req.headers,
    url: req.url,
    query: {},
    body: null,
    on: function(event, callback) {
      if (event === 'data') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            this.body = JSON.parse(body || '{}');
          } catch {
            this.body = body || {};
          }
          callback();
        });
      }
    }
  };
}

function createVercelResponse(res) {
  const headers = {};
  return {
    setHeader: (key, value) => {
      headers[key] = value;
    },
    status: (code) => {
      res.statusCode = code;
      return {
        json: (data) => {
          headers['Content-Type'] = 'application/json';
          Object.keys(headers).forEach(key => {
            res.setHeader(key, headers[key]);
          });
          res.end(JSON.stringify(data));
        },
        end: () => {
          Object.keys(headers).forEach(key => {
            res.setHeader(key, headers[key]);
          });
          res.end();
        }
      };
    },
    json: (data) => {
      headers['Content-Type'] = 'application/json';
      Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
      });
      res.end(JSON.stringify(data));
    },
    end: () => {
      Object.keys(headers).forEach(key => {
        res.setHeader(key, headers[key]);
      });
      res.end();
    }
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = parse(req.url, true);
  const rawPath = parsedUrl.pathname || '/';
  
  // Normalizar pathname: quitar barra final excepto si es solo "/"
  const pathname = rawPath.endsWith('/') && rawPath !== '/' ? rawPath.slice(0, -1) : rawPath;

  // Logging de todas las peticiones para diagnóstico
  console.log(`${req.method} ${rawPath}${parsedUrl.search || ''}`);

  // CORS headers básicos
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const vercelReq = createVercelRequest(req);
    const vercelRes = createVercelResponse(res);

    // Esperar a que el body se lea completamente
    await new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          vercelReq.body = JSON.parse(body || '{}');
        } catch {
          vercelReq.body = body || {};
        }
        resolve();
      });
    });

    // Logging detallado para rutas del API
    if (pathname.startsWith('/api/')) {
      console.log(`\n📨 API Request: [${req.method}] ${pathname}`);
      console.log(`   Full URL: ${rawPath}${parsedUrl.search || ''}`);
      console.log(`   Origin: ${req.headers.origin || 'none'}`);
      console.log(`   Auth: ${req.headers.authorization ? 'Bearer ***' : 'none'}`);
      if (req.method === 'POST' || req.method === 'PUT') {
        const bodyStr = typeof vercelReq.body === 'object' ? JSON.stringify(vercelReq.body) : String(vercelReq.body);
        console.log(`   Body:`, bodyStr.substring(0, 300));
      }
    }

    // Routing
    // Ruta raíz: mostrar información del API
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: "MoveTogether2 API",
        version: "1.0.0",
        endpoints: [
          "/api/health - Health check",
          "/api/vehicles - GET: List vehicles, POST: Create vehicle",
          "/api/me - Get current user",
          "/api/auth/login - Login",
          "/api/auth/verify - Verify token",
        ],
        status: "running"
      }));
      return;
    }
    
    // Ignorar peticiones de Chrome DevTools y otros recursos del navegador
    if (pathname.startsWith('/.well-known/') || pathname.startsWith('/favicon.ico')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end();
      return;
    }
    
    if (pathname === '/api/health') {
      await healthHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/items') {
      await itemsHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/login') {
      await loginHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/register') {
      await registerHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/google') {
      await googleHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/verify') {
      await verifyHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/ensure-user') {
      await ensureUserHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/me') {
      await meHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/vehicles') {
      await vehiclesHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/send-otp') {
      await sendOtpHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/verify-otp') {
      await verifyOtpHandler(vercelReq, vercelRes);
    } else if (pathname === '/api/auth/reset-password') {
      await resetPasswordHandler(vercelReq, vercelRes);
    } else {
      // Manejar rutas no encontradas
      if (pathname.startsWith('/api/')) {
        console.error(`❌ Ruta API no encontrada: ${pathname}`);
        console.error(`   Ruta original: ${rawPath}`);
        console.error(`   Rutas disponibles: /api/health, /api/items, /api/auth/*, /api/me, /api/vehicles`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Not found', 
          path: pathname,
          originalPath: rawPath,
          availableRoutes: [
            '/api/health',
            '/api/items',
            '/api/auth/login',
            '/api/auth/google',
            '/api/auth/verify',
            '/api/auth/ensure-user',
            '/api/auth/send-otp',
            '/api/auth/verify-otp',
            '/api/auth/reset-password',
            '/api/register',
            '/api/me',
            '/api/vehicles'
          ]
        }));
      } else {
        // Para otras rutas (como favicon, .well-known, etc.), solo 404 silencioso
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end();
      }
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', message: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});

