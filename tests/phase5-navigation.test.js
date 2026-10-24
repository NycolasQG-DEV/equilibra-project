const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Fase 5.1: Formatters de domínio e badges acessíveis', async () => {
  const formatters = await import('../public/js/domain/formatters.js');
  
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

test('Fase 5.2: Classificação e mensagens amigáveis de erros (core/errors.js)', async () => {
  const { AppError, formatErrorMessage } = await import('../public/js/core/errors.js');

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

test('Fase 5.3: Ausência de app.js e zero atributos inline (onclick / style) em public/', () => {
  const appJsPath = path.join(__dirname, '..', 'public', 'js', 'app.js');
  const expJsPath = path.join(__dirname, '..', 'public', 'js', 'experience.js');
  const mgtJsPath = path.join(__dirname, '..', 'public', 'js', 'management.js');

  assert.ok(!fs.existsSync(appJsPath), 'app.js legado deve ter sido removido');
  assert.ok(!fs.existsSync(expJsPath), 'experience.js legado deve ter sido removido');
  assert.ok(!fs.existsSync(mgtJsPath), 'management.js legado deve ter sido removido');

  // Verify zero onclick and zero style in public/ (except vendor)
  function scan(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'vendor') scan(full);
      } else if (full.endsWith('.js') || full.endsWith('.html')) {
        const text = fs.readFileSync(full, 'utf8');
        const oc = text.match(/onclick=/gi);
        const st = text.match(/style=["'][^"']*["']/gi);
        assert.ok(!oc, `Nenhum onclick= permitido em ${full}`);
        assert.ok(!st, `Nenhum style= permitido em ${full}`);
      }
    }
  }

  scan(path.join(__dirname, '..', 'public'));
});

test('Fase 6.1: Conformidade dos tokens de design e fontes locais', () => {
  const tokensPath = path.join(__dirname, '..', 'public', 'css', 'tokens.css');
  const baseCssPath = path.join(__dirname, '..', 'public', 'css', 'base.css');
  const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
  const designMdPath = path.join(__dirname, '..', 'DESIGN.md');

  const tokens = fs.readFileSync(tokensPath, 'utf8');
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const designMd = fs.readFileSync(designMdPath, 'utf8');

  // Reconciled palette #581c43
  assert.ok(tokens.includes('--color-primary: #581c43;'), 'tokens.css deve usar #581c43 como primary');
  assert.ok(designMd.includes('primary: "#581c43"'), 'DESIGN.md frontmatter deve usar #581c43');

  // Semáforo tokens
  assert.ok(tokens.includes('--band-adequado:'), 'tokens.css deve definir --band-adequado');
  assert.ok(tokens.includes('--band-cuidado:'), 'tokens.css deve definir --band-cuidado');
  assert.ok(tokens.includes('--band-atencao:'), 'tokens.css deve definir --band-atencao');

  // No Google Fonts CDN in index.html (self-hosted fonts)
  assert.ok(!indexHtml.includes('fonts.googleapis.com'), 'index.html não deve depender de CDN de fontes externa');
  assert.ok(!indexHtml.includes('fonts.gstatic.com'), 'index.html não deve depender de gstatic CDN');

  // Fonts exist locally in public/vendor/fonts/
  const fontsDir = path.join(__dirname, '..', 'public', 'vendor', 'fonts');
  assert.ok(fs.existsSync(fontsDir), 'public/vendor/fonts deve existir');
  const fontFiles = fs.readdirSync(fontsDir);
  assert.ok(fontFiles.some(f => f.endsWith('.woff2')), 'Deve haver arquivos de fonte woff2 locais');
  assert.ok(fontFiles.includes('fonts.css'), 'fonts.css local deve existir');
});
