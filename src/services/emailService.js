const path = require('node:path');
const fs = require('node:fs');
const nodemailer = require('nodemailer');

// ─── Gmail API (OAuth2) ──────────────────────────────────────────────────────
// Usado quando GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN
// estão configurados (modo recomendado em produção — usa HTTPS, sem portas SMTP).
let gmailApiTransporter = null;

function getGmailApiTransporter() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : undefined;

  if (!clientId || !clientSecret || !refreshToken || !user) return null;
  if (gmailApiTransporter) return gmailApiTransporter;

  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, 'https://developers.google.com/oauthplayground');
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  gmailApiTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user,
      clientId,
      clientSecret,
      refreshToken
    }
  });

  console.log(`[GMAIL-API] Transporter OAuth2 criado para ${user}`);
  return gmailApiTransporter;
}

// ─── SMTP Fallback ───────────────────────────────────────────────────────────
// Usado somente quando as credenciais OAuth2 não estão disponíveis.
// Pode falhar em ambientes cloud que bloqueiam portas SMTP.
let cachedSmtpTransporter = null;
let cachedSmtpKey = '';

function getSmtpTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    const envPath = path.join(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
      try { process.loadEnvFile(envPath); } catch {}
    }
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : undefined;
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '') : undefined;

  if (!user || !pass) return null;

  const key = `${host}:${port}:${user}:${pass}`;
  if (cachedSmtpTransporter && cachedSmtpKey === key) return cachedSmtpTransporter;

  console.log(`[SMTP-CONFIG] Criando transporter SMTP: ${host}:${port} user=${user}`);
  cachedSmtpTransporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000
  });
  cachedSmtpKey = key;
  return cachedSmtpTransporter;
}

/**
 * Retorna o melhor transporter disponível:
 * 1. Gmail API (OAuth2) — usa HTTPS, funciona em qualquer cloud hosting
 * 2. SMTP — fallback, pode falhar se a porta estiver bloqueada
 */
function getTransporter() {
  return getGmailApiTransporter() || getSmtpTransporter();
}

/**
 * Verifica se um endereço ou ambiente é reservado para testes.
 * Evita disparos reais para domínios inexistentes que geram bounces (NXDOMAIN).
 */
function isTestEmailOrEnv(email) {
  if (process.execArgv.includes('--test') || process.env.NODE_ENV === 'test') {
    return true;
  }

  if (!email || typeof email !== 'string') return true;
  const lower = email.trim().toLowerCase();
  const domain = lower.split('@')[1];
  if (!domain) return true;

  const reservedTlds = ['.test', '.example', '.invalid', '.localhost'];
  if (reservedTlds.some((tld) => domain.endsWith(tld))) return true;

  const reservedDomains = [
    'example.com',
    'example.org',
    'example.net'
  ];
  if (reservedDomains.includes(domain)) return true;

  return false;
}

/**
 * Dispara e-mail com link individual de pesquisa para um colaborador via Google SMTP.
 * 
 * @param {Object} params
 * @param {string} params.to E-mail de destino
 * @param {string} params.name Nome do colaborador
 * @param {string} params.surveyTitle Título da pesquisa
 * @param {string} params.link Link único de resposta
 * @param {string} [params.cycle] Ciclo ou período
 * @returns {Promise<{ ok: boolean, dryRun?: boolean, error?: string }>}
 */
async function sendInviteEmail({ to, name, surveyTitle, link, cycle }) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return { ok: false, error: 'E-mail inválido ou ausente' };
  }

  const from = process.env.SMTP_FROM || (process.env.SMTP_USER ? `Equilibra <${process.env.SMTP_USER}>` : 'Equilibra <nao-responder@equilibra.app>');
  const subject = `Convite para Pesquisa: ${surveyTitle || 'Condições de Trabalho'}`;

  // Se o e-mail for de teste/fictício ou se estivermos executando suíte de testes, não envia ao SMTP real
  if (isTestEmailOrEnv(to)) {
    console.log(`[EMAIL-TEST-SIMULATED] Destinatário de teste simulado: ${to} | Assunto: ${subject}`);
    return { ok: true, dryRun: true, simulated: true };
  }

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
        .card { background-color: #ffffff; max-width: 560px; margin: 0 auto; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .logo { font-size: 20px; font-weight: 700; color: #4f46e5; margin-bottom: 24px; }
        h1 { font-size: 18px; color: #0f172a; margin-top: 0; margin-bottom: 16px; }
        p { font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
        .btn-wrap { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 15px; text-decoration: none; padding: 14px 28px; border-radius: 8px; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px; }
        .link-alt { word-break: break-all; font-size: 13px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">Equilibra</div>
        <h1>Olá, ${name || 'colaborador(a)'}!</h1>
        <p>Você foi convidado(a) a participar da pesquisa <strong>${surveyTitle}</strong>${cycle ? ` (${cycle})` : ''}.</p>
        <p>Suas respostas são analisadas de forma coletiva e apoiam melhorias concretas nas condições do ambiente de trabalho.</p>
        
        <div class="btn-wrap">
          <a href="${link}" class="btn" target="_blank" rel="noopener noreferrer">Responder Pesquisa</a>
        </div>

        <p class="link-alt">Se o botão acima não funcionar, copie e cole este endereço no seu navegador:<br><a href="${link}">${link}</a></p>

        <div class="footer">
          Mensagem automática da plataforma Equilibra.<br>Cada convite é individual e de uso único.
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Olá, ${name || 'colaborador(a)'}!\n\nVocê foi convidado(a) a participar da pesquisa: ${surveyTitle}.\n\nPara responder, acesse o link abaixo:\n${link}\n\nSuas respostas são analisadas de forma coletiva.`;

  // Envio via SMTP (Google Workspace / Gmail com senha de app)
  const transporter = getTransporter();
  if (!transporter) {
    const msg = 'Servidor SMTP não configurado. Verifique SMTP_USER e SMTP_PASS no .env e reinicie o servidor.';
    console.error(`[SMTP-ERROR] ${msg}`);
    return { ok: false, error: msg };
  }

  try {
    const info = await Promise.race([
      transporter.sendMail({
        from,
        to,
        subject,
        text,
        html
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de envio excedido (15s)')), 15000)
      )
    ]);
    console.log(`[SMTP-SUCCESS] E-mail enviado para ${to} (ID: ${info.messageId})`);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[SMTP-ERROR] Falha ao enviar para ${to}:`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Dispara e-mails em lote para uma lista de links de pesquisa
 * 
 * @param {Object} survey Dados da pesquisa
 * @param {Array<{ email: string, name: string, link: string }>} links
 * @returns {Promise<{ dispatched: number, skipped: number, errors: number }>}
 */
async function dispatchSurveyViaEmail(survey, links = []) {
  let dispatched = 0;
  let skipped = 0;
  let errors = 0;
  let lastError = null;

  const validLinks = [];
  for (const item of links) {
    if (!item.email || !item.email.trim()) {
      skipped++;
    } else {
      validLinks.push(item);
    }
  }

  const results = await Promise.allSettled(
    validLinks.map((item) =>
      sendInviteEmail({
        to: item.email.trim(),
        name: item.name,
        surveyTitle: survey.title,
        link: item.link,
        cycle: survey.cycle
      })
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) {
      dispatched++;
    } else {
      errors++;
      const err = r.status === 'fulfilled' ? r.value.error : r.reason?.message;
      if (err) lastError = err;
    }
  }

  return { dispatched, skipped, errors, error: lastError };
}

module.exports = {
  sendInviteEmail,
  dispatchSurveyViaEmail
};

