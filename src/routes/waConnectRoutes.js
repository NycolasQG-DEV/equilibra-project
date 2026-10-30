/**
 * Rota de conexão WhatsApp via QR Code no navegador.
 * Acessível em: GET /wa/connect
 *
 * Exibe uma página HTML com o QR Code atualizado automaticamente,
 * status de conexão e instruções — especialmente útil em hospedagens
 * em nuvem como Render, onde o terminal não é interativo.
 */

const express = require('express');
const QRCode = require('qrcode');
const router = express.Router();

// Importa o cliente local (Baileys) — armazena o último QR recebido
let localClient = null;
try {
  localClient = require('../services/whatsappLocalClient');
} catch {}

router.get('/wa/connect', async (req, res) => {
  const status = localClient ? localClient.getStatus() : { connected: false };

  if (status.connected) {
    const phone = status.user?.id ? status.user.id.split(':')[0] : '';
    return res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="10">
  <title>WhatsApp — Equilibra</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #f0fdf4; }
    .card { background: white; border-radius: 16px; padding: 48px; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 400px; }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #166534; font-size: 22px; margin: 0 0 8px; }
    p { color: #6b7280; margin: 0 0 4px; font-size: 15px; }
    .phone { font-size: 20px; font-weight: bold; color: #111; margin-top: 12px; }
    .badge { display: inline-block; background: #dcfce7; color: #15803d; padding: 6px 16px;
             border-radius: 99px; font-size: 13px; font-weight: 600; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✅</div>
    <h1>WhatsApp Conectado!</h1>
    <p>O Equilibra está pronto para enviar e receber pesquisas.</p>
    ${phone ? `<div class="phone">+${phone}</div>` : ''}
    <div class="badge">Sessão ativa</div>
    <p style="margin-top:24px;font-size:13px;color:#9ca3af;">Esta página atualiza automaticamente a cada 10 segundos.</p>
  </div>
</body>
</html>`);
  }

  // Ainda não conectado — gera QR Code se disponível
  const rawQr = status.lastQr;
  let qrImageUrl = null;

  if (rawQr) {
    try {
      qrImageUrl = await QRCode.toDataURL(rawQr, {
        width: 280,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' }
      });
    } catch {}
  }

  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="8">
  <title>Conectar WhatsApp — Equilibra</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #fafafa; }
    .card { background: white; border-radius: 16px; padding: 40px 48px; text-align: center;
            box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 420px; width: 100%; }
    .logo { font-size: 32px; font-weight: 800; color: #581c43; margin-bottom: 8px; }
    h1 { font-size: 20px; color: #111; margin: 0 0 6px; }
    p { color: #6b7280; font-size: 14px; margin: 0 0 24px; line-height: 1.5; }
    .qr-box { border: 2px dashed #e5e7eb; border-radius: 12px; padding: 20px;
              display: inline-block; margin: 0 0 24px; }
    .qr-box img { display: block; border-radius: 8px; }
    .waiting { color: #9ca3af; font-size: 36px; margin: 24px 0; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
    .steps { text-align: left; background: #f9fafb; border-radius: 10px; padding: 16px 20px; }
    .steps li { font-size: 14px; color: #374151; margin-bottom: 8px; }
    .steps li:last-child { margin-bottom: 0; }
    .refresh-note { font-size: 12px; color: #d1d5db; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Equilibra</div>
    <h1>Conectar WhatsApp</h1>
    <p>Escaneie o QR Code abaixo com o WhatsApp do seu celular para ativar o envio de pesquisas.</p>

    ${qrImageUrl
      ? `<div class="qr-box"><img src="${qrImageUrl}" width="240" height="240" alt="QR Code WhatsApp"></div>`
      : `<div class="waiting">⏳</div><p style="color:#9ca3af">Gerando QR Code... aguarde alguns segundos.<br>A página atualiza sozinha.</p>`
    }

    <ul class="steps">
      <li>📱 Abra o <strong>WhatsApp</strong> no celular</li>
      <li>⚙️ Vá em <strong>Configurações → Aparelhos Conectados</strong></li>
      <li>➕ Toque em <strong>Conectar um Aparelho</strong></li>
      <li>📷 Aponte a câmera para o QR Code acima</li>
    </ul>

    <p class="refresh-note">Página atualiza automaticamente a cada 8 segundos · QR Code expira em ~60s</p>
  </div>
</body>
</html>`);
});

module.exports = router;
