import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const REPORTS_DIR = path.join(DATA_DIR, 'reports');
const AUDIT_DIR = path.join(DATA_DIR, 'audit');
const AUDIT_LOG_FILE = path.join(AUDIT_DIR, 'audit_log.json');
const SURVEY_LINKS_FILE = path.join(DATA_DIR, 'survey_links.json');

// Garante que os diretórios existam
export async function initStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(SESSIONS_DIR, { recursive: true });
  await fs.mkdir(REPORTS_DIR, { recursive: true });
  await fs.mkdir(AUDIT_DIR, { recursive: true });
  
  try {
    await fs.access(AUDIT_LOG_FILE);
  } catch {
    await fs.writeFile(AUDIT_LOG_FILE, JSON.stringify([]), 'utf-8');
  }

  try {
    await fs.access(SURVEY_LINKS_FILE);
  } catch {
    // Links iniciais de demonstração
    const defaultLinks = [
      {
        id: 'lnk_geral_2026',
        title: 'Pesquisa Geral da Empresa • NR-01',
        sector: 'all',
        adminName: 'Gestor SST & Ergonomia',
        adminEmail: 'sesmt@empresa.com.br',
        createdAt: new Date().toISOString(),
        active: true
      },
      {
        id: 'lnk_usinagem',
        title: 'Avaliação Psicossocial • Usinagem & Torneamento',
        sector: 'Usinagem & Torneamento',
        adminName: 'Supervisor de Produção',
        adminEmail: 'gestor.usinagem@empresa.com.br',
        createdAt: new Date().toISOString(),
        active: true
      }
    ];
    await fs.writeFile(SURVEY_LINKS_FILE, JSON.stringify(defaultLinks, null, 2), 'utf-8');
  }
}

// Salva ou atualiza uma sessão de entrevista
export async function saveSession(sessionData) {
  await initStorage();
  const filePath = path.join(SESSIONS_DIR, `${sessionData.id}.json`);
  sessionData.updatedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
  return sessionData;
}

// Obtém uma sessão por ID
export async function getSession(sessionId) {
  const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

// Exclui uma sessão por ID (Direito de Eliminação - Art. 18, VI e Art. 16 da LGPD)
export async function deleteSession(sessionId) {
  await initStorage();
  const sessionFilePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
  let deleted = false;

  try {
    const session = await getSession(sessionId);
    if (session && session.reportId) {
      const reportFilePath = path.join(REPORTS_DIR, `${session.reportId}.json`);
      try {
        await fs.unlink(reportFilePath);
      } catch (rErr) {
        console.warn('Relatório associado já excluído ou não encontrado:', rErr.message);
      }
    }

    await fs.unlink(sessionFilePath);
    deleted = true;

    // Registra na trilha de auditoria
    await logAuditAccess({
      action: 'TITULAR_DATA_DELETION',
      targetId: sessionId,
      performedBy: 'TITULAR_DO_DADO',
      legalBasis: 'LGPD Art. 18, VI (Direito de Eliminação)',
      details: 'Dados da entrevista e relatórios vinculados foram eliminados a pedido do titular.'
    });
  } catch (err) {
    console.error('Erro ao excluir sessão:', err);
  }

  return deleted;
}

// Lista todas as sessões existentes
export async function listSessions() {
  await initStorage();
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(SESSIONS_DIR, file), 'utf-8');
        sessions.push(JSON.parse(content));
      }
    }
    // Ordena do mais recente para o mais antigo
    return sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('Erro ao listar sessões:', err);
    return [];
  }
}

// Salva o relatório consolidado final
export async function saveReport(reportData) {
  await initStorage();
  const filePath = path.join(REPORTS_DIR, `${reportData.id}.json`);
  reportData.savedAt = new Date().toISOString();
  await fs.writeFile(filePath, JSON.stringify(reportData, null, 2), 'utf-8');
  return reportData;
}

// Obtém o relatório por ID
export async function getReport(reportId) {
  const filePath = path.join(REPORTS_DIR, `${reportId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

// Lista todos os relatórios finais
export async function listReports() {
  await initStorage();
  try {
    const files = await fs.readdir(REPORTS_DIR);
    const reports = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = await fs.readFile(path.join(REPORTS_DIR, file), 'utf-8');
        reports.push(JSON.parse(content));
      }
    }
    return reports.sort((a, b) => new Date(b.createdAt || b.savedAt) - new Date(a.createdAt || a.savedAt));
  } catch (err) {
    console.error('Erro ao listar relatórios:', err);
    return [];
  }
}

// --- TRILHA DE AUDITORIA & REGISTRO DE OPERAÇÕES (LGPD Art. 37 / NR-01 Item 1.6.4 e 4.7.1) ---
export async function logAuditAccess(entry) {
  await initStorage();
  try {
    let logs = [];
    try {
      const data = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
      logs = JSON.parse(data);
    } catch {
      logs = [];
    }

    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      action: entry.action || 'ACCESS_RECORD',
      targetId: entry.targetId || null,
      performedBy: entry.performedBy || 'SISTEMA_AUTONOMO',
      legalBasis: entry.legalBasis || 'LGPD Art. 7, II / NR-01 Item 1.5.3.3',
      sector: entry.sector || 'Todos',
      details: entry.details || 'Consulta realizada ao banco de dados.'
    };

    logs.unshift(logItem);
    // Limita aos últimos 500 registros para alta performance
    if (logs.length > 500) logs = logs.slice(0, 500);

    await fs.writeFile(AUDIT_LOG_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    return logItem;
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
  }
}

export async function listAuditLogs() {
  await initStorage();
  try {
    const data = await fs.readFile(AUDIT_LOG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// --- INFORMAÇÕES DO ENCARREGADO DE DADOS (DPO - LGPD Art. 41) ---
export function getDpoInfo() {
  return {
    name: 'Comitê de Privacidade e Encarregado de Dados (DPO) • Equilibra SST',
    email: 'dpo.privacidade@equilibra-sst.corp.br',
    channel: 'Canal Oficial de Atendimento ao Titular de Dados e SESMT',
    legalAddress: 'Setor de Segurança e Medicina do Trabalho & Compliance',
    responsibilities: [
      'Art. 41, § 2º, I: Aceitar reclamações e comunicações dos titulares e prestar esclarecimentos.',
      'Art. 41, § 2º, II: Receber comunicações da Autoridade Nacional de Proteção de Dados (ANPD).',
      'Art. 41, § 2º, III: Orientar funcionários e contratados sobre boas práticas e sigilo.',
      'NR-01 Item 1.4.1.1: Garantir canal de acolhimento e anonimato em situações de assédio.'
    ]
  };
}

// --- RELATÓRIO DE IMPACTO À PROTEÇÃO DE DADOS (RIPD / DPIA - LGPD Art. 38) ---
export function getRipdReport() {
  return {
    documentTitle: 'Relatório de Impacto à Proteção de Dados Pessoais (RIPD / DPIA)',
    normativeFramework: 'Lei Federal nº 13.709/2018 (LGPD) e NR-01 (Portaria MTP nº 4.219 / MTE nº 1.419/2024)',
    systemName: 'EquilibraAI / Equilibra SST — Avaliação Contínua de Riscos Psicossociais',
    scopeAndPurpose: {
      finalidade: 'Mapeamento e gestão preventiva de fatores de risco psicossocial e ergonômico no trabalho (ISTAS21-BR), subsidiando o Programa de Gerenciamento de Riscos (PGR/GRO da NR-01).',
      baseLegal: 'Art. 7º, II (Cumprimento de obrigação legal e regulatória de SST pelo empregador) e Art. 11, II, "f" (Tutela da saúde ocupacional por profissionais de SST).',
      principioMinimizacao: 'Coleta restrita às percepções de rotina de trabalho. Vedada a coleta de CPF, e-mail particular ou dados bancários.',
      kAnonimato: 'Regra ativa de corte: setores com menos de 3 participantes são agrupados/mascarados nos dashboards executivos para impedir reidentificação indireta (Art. 12 da LGPD).'
    },
    riskAnalysisAndSafeguards: [
      {
        riscoIdentificado: 'Identificação ou retaliação do colaborador pelo gestor direto.',
        medidaMitigadora: 'Opção de anonimato total (Privacy by Default), isolamento do identificador por UUID, restrição de acesso do gestor a dados agregados por setor e proibição legal expressa de uso em prejuízo (Art. 21 da LGPD).'
      },
      {
        riscoIdentificado: 'Vazamento de dados sensíveis de saúde mental.',
        medidaMitigadora: 'Criptografia em trânsito e repouso, trilha de auditoria (audit logs) registrando todos os acessos do ADM, e controle de acesso restrito ao SESMT/CIPA.'
      },
      {
        riscoIdentificado: 'Decisões automatizadas discriminatórias tomadas por IA.',
        medidaMitigadora: 'Conformidade com Art. 20 da LGPD: A IA atua exclusivamente como ferramenta de apoio diagnóstico prévio. Todas as medidas preventivas são validadas e conduzidas por equipe humana (Engenheiro de Segurança, Médico do Trabalho e CIPA).'
      }
    ],
    rightsChannel: {
      acesso: 'Disponibilizado imediatamente na interface do trabalhador (Art. 19, I).',
      eliminacao: 'Botão de exclusão com purga completa de banco de dados e arquivos (Art. 18, VI).',
      portabilidade: 'Exportação dos dados em formato digital estruturado e interoperável JSON (Art. 18, V).'
    }
  };
}

// --- GESTÃO DE LINKS / CAMPANHAS DE PESQUISA DO ADMINISTRADOR ---
export async function listSurveyLinks() {
  await initStorage();
  try {
    const data = await fs.readFile(SURVEY_LINKS_FILE, 'utf-8');
    const links = JSON.parse(data);
    return Array.isArray(links) ? links : [];
  } catch (err) {
    console.error('Erro ao ler links de pesquisa:', err);
    return [];
  }
}

export async function getSurveyLink(linkId) {
  const links = await listSurveyLinks();
  return links.find(l => l.id === linkId) || null;
}

export async function saveSurveyLink(linkData) {
  await initStorage();
  const links = await listSurveyLinks();
  const existingIdx = links.findIndex(l => l.id === linkData.id);

  if (existingIdx >= 0) {
    links[existingIdx] = { ...links[existingIdx], ...linkData, updatedAt: new Date().toISOString() };
  } else {
    links.unshift({
      id: linkData.id || `lnk_${Date.now().toString(36)}`,
      title: linkData.title || 'Nova Campanha de Pesquisa',
      sector: linkData.sector || 'all',
      adminName: linkData.adminName || 'Gestor do Setor',
      adminEmail: linkData.adminEmail || '',
      createdAt: new Date().toISOString(),
      active: true,
      ...linkData
    });
  }

  await fs.writeFile(SURVEY_LINKS_FILE, JSON.stringify(links, null, 2), 'utf-8');
  return linkData;
}

export async function toggleSurveyLinkStatus(linkId) {
  await initStorage();
  const links = await listSurveyLinks();
  const link = links.find(l => l.id === linkId);
  if (!link) return null;

  link.active = !link.active;
  link.updatedAt = new Date().toISOString();
  await fs.writeFile(SURVEY_LINKS_FILE, JSON.stringify(links, null, 2), 'utf-8');
  return link;
}

export async function closeSurveyLink(linkId, sessionId) {
  await initStorage();
  const links = await listSurveyLinks();
  const link = links.find(l => l.id === linkId);
  if (!link) return null;

  link.active = false;
  link.used = true;
  link.usedAt = new Date().toISOString();
  link.usedBySessionId = sessionId;
  link.updatedAt = new Date().toISOString();

  await fs.writeFile(SURVEY_LINKS_FILE, JSON.stringify(links, null, 2), 'utf-8');
  return link;
}

export async function deleteSurveyLink(linkId) {
  await initStorage();
  let links = await listSurveyLinks();
  links = links.filter(l => l.id !== linkId);
  await fs.writeFile(SURVEY_LINKS_FILE, JSON.stringify(links, null, 2), 'utf-8');
  return true;
}



