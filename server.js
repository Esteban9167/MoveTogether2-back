// Servidor de desarrollo simple para simular Vercel
const http = require('http');
const { parse } = require('url');
require('dotenv').config({ path: '.env.local' });

// Handlers compilados (dist)
const itemsHandler = require('./dist/api/items.js').default;
const authRouter = require('./dist/api/auth/index.js').default;
const meHandler = require('./dist/api/me.js').default;
const vehiclesHandler = require('./dist/api/vehicles.js').default;
const healthHandler = require('./dist/api/health.js').default;
const contactHandler = require('./dist/api/contact.js').default;

const PORT = process.env.PORT || 3001;

function createVercelRequest(req) {
  return {
    method: req.method,
    headers: req.headers,
    url: req.url,
    query: {},
    body: null,
  };
}

function createVercelResponse(res) {
  const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    status: (code) => ({
      json: (data) => {
        headers['Content-Type'] = 'application/json';
        Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
        res.statusCode = code;
        res.end(JSON.stringify(data));
      },
      end: () => {
        Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
        res.statusCode = code;
        res.end();
      }
    }),
    json: (data) => {
      headers['Content-Type'] = 'application/json';
      Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
      res.end(JSON.stringify(data));
    },
    end: () => {
      Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
      res.end();
    }
  };
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse/normalize path
  const parsedUrl = parse(req.url, true);
  const rawPath = parsedUrl.pathname || '/';
  const pathname =
    rawPath.endsWith('/') && rawPath !== '/' ? rawPath.slice(0, -1) : rawPath;

  // Logging de todas las peticiones para diagnóstico
  console.log(`${req.method} ${rawPath}${parsedUrl.search || ''}`);

  try {
    const vercelReq = createVercelRequest(req);
    const vercelRes = createVercelResponse(res);

    // Query
    vercelReq.query = parsedUrl.query || {};

    // Leer body UNA vez
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', chunk => { data += chunk.toString(); });
      req.on('end', () => resolve(data));
    });
    try {
      vercelReq.body = body ? JSON.parse(body) : {};
    } catch {
      vercelReq.body = body || {};
    }

    // Logging detallado para rutas del API
    if (pathname.startsWith('/api/')) {
      console.log(`\n📨 API Request: [${req.method}] ${pathname}`);
      console.log(`   Full URL: ${rawPath}${parsedUrl.search || ''}`);
      console.log(`   Origin: ${req.headers.origin || 'none'}`);
      console.log(`   Auth: ${req.headers.authorization ? 'Bearer ***' : 'none'}`);
      if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
        const bodyStr = typeof vercelReq.body === 'object' ? JSON.stringify(vercelReq.body) : String(vercelReq.body);
        console.log(`   Body:`, bodyStr.substring(0, 300));
      }
    }

    // --- Routing ---

    // Health simple (útil)
    if (pathname === '/api/health') {
      return await healthHandler(vercelReq, vercelRes);
    }

    // Ignorar peticiones de Chrome DevTools y otros recursos del navegador
    if (pathname.startsWith('/.well-known/') || pathname.startsWith('/favicon.ico')) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end();
      return;
    }

    // Ruta raíz: mostrar información del API
    if (pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        message: "MoveTogether2 API",
        version: "1.0.0",
        endpoints: [
          "/api/health - Health check",
          "/api/vehicles - GET: List vehicles, POST: Create vehicle, DELETE: Delete vehicle (via /api/vehicles/:id)",
          "/api/me - Get current user",
          "/api/auth/login - Login",
          "/api/auth/verify - Verify token",
        ],
        status: "running"
      }));
      return;
    }

    // /api/vehicles/:id  (DELETE/GET por id si lo manejas)
    const vehiclesMatch = pathname.match(/^\/api\/vehicles\/([^\/?#]+)$/);
    if (vehiclesMatch) {
      vercelReq.query = { ...vercelReq.query, id: decodeURIComponent(vehiclesMatch[1]) };
      return await vehiclesHandler(vercelReq, vercelRes);
    }

    if (pathname === '/api/vehicles') {
      return await vehiclesHandler(vercelReq, vercelRes);
    }

    if (pathname === '/api/items') {
      return await itemsHandler(vercelReq, vercelRes);
    }

    if (pathname === '/api/me') {
      return await meHandler(vercelReq, vercelRes);
    }

    if (pathname === '/api/contact') {
      console.log('✅ Ruta /api/contact encontrada, llamando contactHandler...');
      return await contactHandler(vercelReq, vercelRes);
    }

    if (pathname.startsWith('/api/auth') || pathname === '/api/register') {
      // Todas las rutas de auth ahora van al router consolidado
      // También mantenemos compatibilidad con /api/register (redirige a /api/auth/register)
      if (pathname === '/api/register') {
        vercelReq.url = '/api/auth/register';
        vercelReq.query = {};
      }
      return await authRouter(vercelReq, vercelRes);
    }

    // 404 por defecto
    if (pathname.startsWith('/api/')) {
      console.error(`❌ Ruta API no encontrada: ${pathname}`);
      console.error(`   Ruta original: ${rawPath}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Not found', 
        path: pathname,
        originalPath: rawPath,
      }));
    } else {
      // Para otras rutas (como favicon, .well-known, etc.), solo 404 silencioso
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end();
    }
  } catch (error) {
    console.error('Server error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Internal server error',
      message: error && error.message ? error.message : String(error)
    }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en http://localhost:${PORT}`);
});
