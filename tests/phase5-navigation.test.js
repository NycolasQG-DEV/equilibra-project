const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Fase 5.1: Formatters de domínio e badges acessíveis', async () => {
  const formatters = await import('../client/src/domain/formatters.ts');
  
  // Escaping
  assert.equal(formatters.esc('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  assert.equal(formatters.attr('" onfocus="alert(1)'), '&quot; onfocus=&quot;alert(1)');
  
  // Numbers & Percentages
  assert.equal(formatters.fmt(3.456, 1), '3,5');
  assert.equal(formatters.fmt(null), '—');
  assert.equal(formatters.fmtPercent(0.724), '72%');
  assert.equal(formatters.fmtPercent(null), '0%');
  
  // Participation Bands
  assert.equal(formatters.getBand(0.75).band, 'adequada');
  assert.equal(formatters.getBand(0.60).band, 'media');
  assert.equal(formatters.getBand(0.40).band, 'baixa');
  
  // Reference Bands (Semáforo)
  assert.equal(formatters.bandForMean(4.0, true), 'adequado');
  assert.equal(formatters.bandForMean(3.6, true), 'adequado');
  assert.equal(formatters.bandForMean(3.5, true), 'cuidado');
  assert.equal(formatters.bandForMean(2.8, true), 'cuidado');
  assert.equal(formatters.bandForMean(2.79, true), 'atencao');
  assert.equal(formatters.bandForMean(1.5, true), 'atencao');
  assert.equal(formatters.bandForMean(4.0, false), 'unclassified');
  
  // Badge HTML output
  const badgeHtml = formatters.factorBadge(3.8, true);
  assert.ok(badgeHtml.includes('band-adequado'));
  assert.ok(badgeHtml.includes('Adequado (≥ 3,6)'));
});

test('Fase 5.2: Classificação e mensagens amigáveis de erros (core/errors.ts)', async () => {
  const { AppError, formatErrorMessage } = await import('../client/src/core/errors.ts');

  const err401 = new AppError('Unauthorized', { status: 401 });
  assert.equal(formatErrorMessage(err401), 'Sua sessão expirou. Por favor, autentique-se novamente.');

  const err403 = new AppError('Forbidden', { status: 403 });
  assert.equal(formatErrorMessage(err403), 'Seu perfil de acesso não tem permissão para realizar esta operação.');

  const err404 = new AppError('Not Found', { status: 404 });
  assert.equal(formatErrorMessage(err404), 'O recurso solicitado não foi encontrado ou não está disponível.');

  const err500 = new AppError('Internal Error', { status: 500, recoverable: true });
  assert.ok(formatErrorMessage(err500).includes('instabilidade temporária'));

  const netErr = new AppError('Network Error', { status: 0, recoverable: true });
  assert.ok(formatErrorMessage(netErr).includes('Falha de conexão com o servidor'));
});

test('Fase 5.3: Ausência de app.js legado e consolidação no Vite + React', () => {
  const publicDir = path.join(__dirname, '..', 'public');
  const appJsPath = path.join(publicDir, 'js', 'app.js');
  const expJsPath = path.join(publicDir, 'js', 'experience.js');
  const mgtJsPath = path.join(publicDir, 'js', 'management.js');

  assert.ok(!fs.existsSync(appJsPath), 'app.js legado deve ter sido removido');
  assert.ok(!fs.existsSync(expJsPath), 'experience.js legado deve ter sido removido');
  assert.ok(!fs.existsSync(mgtJsPath), 'management.js legado deve ter sido removido');
  assert.ok(!fs.existsSync(path.join(publicDir, 'js')), 'diretório public/js legado deve ter sido completamente removido');

  // Verify compiled HTML in dist/client/index.html has zero raw onclick=
  const distIndex = path.join(__dirname, '..', 'dist', 'client', 'index.html');
  if (fs.existsSync(distIndex)) {
    const text = fs.readFileSync(distIndex, 'utf8');
    const oc = text.match(/onclick=/gi);
    assert.ok(!oc, 'Nenhum onclick= inline permitido em dist/client/index.html');
  }
});

test('Fase 6.1: Conformidade dos tokens de design em client/src/styles', () => {
  const tokensPath = path.join(__dirname, '..', 'client', 'src', 'styles', 'tokens.css');
  const baseCssPath = path.join(__dirname, '..', 'client', 'src', 'styles', 'base.css');
  const designMdPath = path.join(__dirname, '..', 'DESIGN.md');

  assert.ok(fs.existsSync(tokensPath), 'tokens.css deve existir em client/src/styles');
  assert.ok(fs.existsSync(baseCssPath), 'base.css deve existir em client/src/styles');
  assert.ok(fs.existsSync(designMdPath), 'DESIGN.md deve existir');

  const tokens = fs.readFileSync(tokensPath, 'utf8');
  const designMd = fs.readFileSync(designMdPath, 'utf8');

  // Palette token check
  assert.ok(tokens.includes('--color-primary:'), 'tokens.css deve usar primary válido');
  assert.ok(designMd.includes('primary:'), 'DESIGN.md frontmatter deve definir primary');

  // Semáforo tokens
  assert.ok(tokens.includes('--band-adequado:'), 'tokens.css deve definir --band-adequado');
  assert.ok(tokens.includes('--band-cuidado:'), 'tokens.css deve definir --band-cuidado');
  assert.ok(tokens.includes('--band-atencao:'), 'tokens.css deve definir --band-atencao');
});
