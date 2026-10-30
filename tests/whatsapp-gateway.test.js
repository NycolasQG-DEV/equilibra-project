/**
 * Testes do WhatsApp Gateway
 * Cobre: normalização de telefone e parsing de webhook
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { normalizePhone, parseWebhook } = require('../src/services/whatsappGateway');

describe('normalizePhone — formatação E.164', () => {
  it('número com 11 dígitos sem DDI → adiciona 55', () => {
    assert.strictEqual(normalizePhone('11987654321'), '5511987654321');
  });

  it('número com 10 dígitos sem DDI → adiciona 55', () => {
    assert.strictEqual(normalizePhone('1134567890'), '551134567890');
  });

  it('número já com DDI 55 → mantém', () => {
    assert.strictEqual(normalizePhone('5511987654321'), '5511987654321');
  });

  it('número formatado "(11) 98765-4321" → limpa e adiciona 55', () => {
    assert.strictEqual(normalizePhone('(11) 98765-4321'), '5511987654321');
  });

  it('número com +55 → remove + e mantém', () => {
    assert.strictEqual(normalizePhone('+5511987654321'), '5511987654321');
  });

  it('phone vazio → string vazia', () => {
    assert.strictEqual(normalizePhone(''), '');
  });

  it('null → string vazia', () => {
    assert.strictEqual(normalizePhone(null), '');
  });
});

describe('parseWebhook — parsing de mensagens entrantes', () => {
  it('retorna null para body nulo', () => {
    assert.strictEqual(parseWebhook(null), null);
  });

  it('retorna null para mensagem de saída (fromMe: true)', () => {
    const body = {
      event: 'messages.upsert',
      data: {
        key: { fromMe: true, remoteJid: '5511999@s.whatsapp.net' },
        message: { conversation: 'Olá' }
      }
    };
    assert.strictEqual(parseWebhook(body), null);
  });

  it('retorna null para evento irrelevante', () => {
    const body = { event: 'connection.update', data: {} };
    assert.strictEqual(parseWebhook(body), null);
  });

  it('parseia mensagem válida da Evolution API', () => {
    const body = {
      event: 'messages.upsert',
      data: {
        key: {
          fromMe: false,
          remoteJid: '5511987654321@s.whatsapp.net'
        },
        message: { conversation: '4' }
      }
    };
    const result = parseWebhook(body);
    assert.ok(result !== null);
    assert.strictEqual(result.waId, '5511987654321@s.whatsapp.net');
    assert.strictEqual(result.text, '4');
    assert.strictEqual(result.phone, '5511987654321');
  });

  it('retorna null para mensagem sem texto', () => {
    const body = {
      event: 'messages.upsert',
      data: {
        key: { fromMe: false, remoteJid: '5511999@s.whatsapp.net' },
        message: { imageMessage: { caption: '' } }
      }
    };
    assert.strictEqual(parseWebhook(body), null);
  });
});

