// Script alternativo para desarrollo local
const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando backend en http://localhost:3001');
console.log('📝 Asegúrate de tener las variables de entorno en .env.local');

// Forzar uso de npm en lugar de yarn
const env = {
  ...process.env,
  VERCEL_PKG_MANAGER: 'npm',
  npm_config_package_manager: 'npm',
  VERCEL: '1'
};

const vercel = spawn('npx', ['--yes', 'vercel', 'dev', '--listen', '3001', '--yes'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  env: env
});

vercel.on('error', (err) => {
  console.error('❌ Error al iniciar:', err);
  process.exit(1);
});

vercel.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Backend terminado con código ${code}`);
  }
  process.exit(code);
});

// Manejar Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Deteniendo backend...');
  vercel.kill();
  process.exit(0);
});

