// Script temporário: adicionar rota /api/evidence ao server.js
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'src', 'server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// 1. Adicionar require de evidence após require de management
if (!content.includes("require('./routes/evidenceRoutes')")) {
  content = content.replace(
    "const management = require('./routes/managementRoutes');",
    "const management = require('./routes/managementRoutes');\nconst evidence = require('./routes/evidenceRoutes');"
  );
  console.log('[patch] require evidenceRoutes adicionado');
} else {
  console.log('[patch] require evidenceRoutes já existe, pulando');
}

// 2. Adicionar mount após management router
if (!content.includes("'/api/evidence'")) {
  const target = "app.use('/api/management', management.createRouter(api.protectedRoute));";
  const replacement = target + "\napp.use('/api/evidence', evidence.createRouter(api.protectedRoute));";
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    console.log('[patch] rota /api/evidence montada');
  } else {
    console.error('[patch] ERRO: target de management não encontrado no server.js');
    process.exit(1);
  }
} else {
  console.log('[patch] rota /api/evidence já existe, pulando');
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log('[patch] server.js salvo com sucesso');
