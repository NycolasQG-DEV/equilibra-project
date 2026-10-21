const path = require('node:path');
const fs = require('node:fs');
if (fs.existsSync(path.join(__dirname, '..', '.env'))) process.loadEnvFile(path.join(__dirname, '..', '.env'));
if (require.main === module) require('./config/writerLock').acquire();
const express = require('express');
const api = require('./routes/equilibraRoutes');
const { initializeStorage } = require('./config/equilibraStorage');

const app = express();
const port = Number(process.env.PORT) || 3000;
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((request, response, next) => {
  response.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.get('origin');
    if (origin) {
      try { if (new URL(origin).host !== request.get('host')) return response.status(403).json({ error: 'Origem não autorizada.' }); }
      catch { return response.status(403).json({ error: 'Origem não autorizada.' }); }
    }
    if (!request.is('application/json') && request.get('content-type')?.split(';')[0].trim() !== 'application/json') return response.status(415).json({ error: 'Envie JSON.' });
  }
  next();
});
const management = require('./routes/managementRoutes');
app.post('/api/billing/webhook', management.webhook);
app.use('/api', require('./routes/recoveryRoutes'));
app.use('/api/management', management.createRouter(api.protectedRoute));
app.use('/api', api);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('*path', (_request, response) => response.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return response.status(400).json({ error: 'JSON inválido.' });
  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor.' });
});
initializeStorage();
if (require.main === module) {
  const scheduler = require('./services/scheduler');
  app.listen(port, () => {
    console.log(`Equilibra: http://localhost:${port}`);
    const run = () => { try { scheduler.tick(); } catch (error) { console.error('Agendador indisponível:', error.name); } };
    run(); setInterval(run, 60000).unref();
  });
}
module.exports = app;
