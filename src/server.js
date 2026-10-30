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
      try { if (new URL(origin).host !== request.get('host')) return response.status(403).json({ error: 'Origem nÃ£o autorizada.' }); }
      catch { return response.status(403).json({ error: 'Origem nÃ£o autorizada.' }); }
    }
    if (!request.is('application/json') && request.get('content-type')?.split(';')[0].trim() !== 'application/json') return response.status(415).json({ error: 'Envie JSON.' });
  }
  next();
});
const management = require('./routes/managementRoutes');
// Webhook WhatsApp — público, sem autenticação de sessão (acesso por gateway externo)
app.use('/api', require('./routes/whatsappRoutes'));
app.post('/api/billing/webhook', management.webhook);
app.use('/api', require('./routes/recoveryRoutes'));
app.use('/api/management', management.createRouter(api.protectedRoute));
app.use('/api', api);
app.use('/', require('./routes/waConnectRoutes'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (_request, response) => response.json({ status: 'ok' }));
app.get('*path', (_request, response) => response.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return response.status(400).json({ error: 'JSON invÃ¡lido.' });
  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor.' });
});
const storage = require('./config/equilibraStorage');
const { runDataMigration } = require('./services/dataMigration');
initializeStorage();
// Inicialização do Supabase se configurado no ambiente
if (storage.initSupabaseIfEnabled) {
  storage.initSupabaseIfEnabled().catch((err) => {
    console.error('[Supabase] Falha ao sincronizar inicialização:', err.message);
  });
}
try { runDataMigration(storage); } catch (e) { console.error('Aviso migraÃ§Ã£o:', e.message); }
if (require.main === module) {
  process.on('uncaughtException', (error) => {
    console.error('[FATAL] uncaughtException — servidor continuando:', error.message);
  });
  process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] unhandledRejection — servidor continuando:', reason);
  });
  const scheduler = require('./services/scheduler');
  app.listen(port, () => {
    console.log(`Equilibra: http://localhost:${port}`);
    const run = () => { try { scheduler.tick(); } catch (error) { console.error('Agendador indisponÃ­vel:', error.name); } };
    run(); setInterval(run, 60000).unref();

    // Conexão nativa do WhatsApp (exibe QR Code no terminal para conectar aparelho)
    if (process.env.WA_DISABLE_DIRECT !== 'true') {
      try {
        const { initWhatsAppClient } = require('./services/whatsappLocalClient');
        initWhatsAppClient().catch((err) => {
          console.error('[WhatsApp] Falha ao iniciar cliente:', err.message);
        });
      } catch (err) {
        console.error('[WhatsApp] Cliente local indisponível:', err.message);
      }
    }
  });
}
module.exports = app;
