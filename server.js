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
  const pathname = parsedUrl.pathname;

  // CORS headers básicos
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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

    // Routing
    if (pathname === '/api/items') {
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
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
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

