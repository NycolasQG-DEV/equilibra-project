// scripts/update-server-dist.js
const fs = require('fs');
const path = require('path');

const serverFile = path.join(__dirname, '..', 'src', 'server.js');
let code = fs.readFileSync(serverFile, 'utf8');

const target1 = "app.use(express.static(path.join(__dirname, '..', 'public')));";
const replacement1 = `// Servir a aplicação React oficial (dist/client) como prioridade
const clientDist = path.join(__dirname, '..', 'dist', 'client');
const publicDir = path.join(__dirname, '..', 'public');
const hasDist = fs.existsSync(clientDist);

app.use(express.static(hasDist ? clientDist : publicDir));
if (hasDist) {
  app.use(express.static(publicDir));
}`;

const target2 = "app.get('*path', (_request, response) => response.sendFile(path.join(__dirname, '..', 'public', 'index.html')));";
const replacement2 = `app.get('*path', (_request, response) => {
  const distIndex = path.join(__dirname, '..', 'dist', 'client', 'index.html');
  const fileToSend = fs.existsSync(distIndex) ? distIndex : path.join(__dirname, '..', 'public', 'index.html');
  response.sendFile(fileToSend);
});`;

if (code.includes(target1) && code.includes(target2)) {
  code = code.replace(target1, replacement1);
  code = code.replace(target2, replacement2);
  fs.writeFileSync(serverFile, code, 'utf8');
  console.log('src/server.js atualizado com sucesso para servir dist/client!');
} else {
  console.log('Targets não encontrados ou já atualizados.');
}
