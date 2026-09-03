import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { 
  initStorage, 
  saveSession, 
  getSession, 
  listSessions, 
  deleteSession,
  saveReport, 
  getReport, 
  listReports,
  logAuditAccess,
  listAuditLogs,
  getDpoInfo,
  getRipdReport,
  listSurveyLinks,
  getSurveyLink,
  saveSurveyLink,
  deleteSurveyLink,
  toggleSurveyLinkStatus,
  closeSurveyLink
} from './src/storage.js';
import { 
  getNextInterviewStep, 
  generateComprehensiveReport 
} from './src/groqService.js';
import { NR1_DIMENSIONS, NR1_PREVENTION_HIERARCHY } from './src/riskMatrix.js';
import { SafetyGuard } from './src/safetyGuard.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper de Sigilo Técnico e Pseudonimização para visualização do Empregador (LGPD Art. 13 / NR-01 Item 1.4.1.1)
function maskProfileForEmployer(profile, sessionId) {
  if (!profile) return profile;
  const cleanId = (sessionId || '').replace('ses_', '').substring(0, 5).toUpperCase();
  return {
    ...profile,
    workerName: `Colaborador #${cleanId || 'ANON'}`,
    realNameHidden: true,
    privacyNotice: 'Identificação protegida por sigilo técnico de SST (LGPD Art. 13 / NR-01)'
  };
}

// Inicializa pastas de persistência e auditoria
await initStorage();

// Rota de Health Check e status da IA
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'sua_chave_aqui');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    aiEngine: hasKey ? 'Groq Cloud LLM (Online)' : 'Heuristic Engine + Groq Ready (Simulação Ativa)',
    groqConfigured: hasKey,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    dimensions: Object.keys(NR1_DIMENSIONS),
    lgpdCompliant: true,
    nr01Compliant: true
  });
});

// Metadados das Dimensões NR-1 e Hierarquia de Prevenção
app.get('/api/dimensions', (req, res) => {
  res.json({
    dimensions: NR1_DIMENSIONS,
    preventionHierarchy: NR1_PREVENTION_HIERARCHY
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS DO USUÁRIO / EMPREGADO (ENTREVISTA COM A IA & DIREITOS DO TITULAR LGPD)
// ══════════════════════════════════════════════════════════════════════════════

// 1. Iniciar nova sessão de entrevista (Registro de Dados Básicos no Sistema + Sigilo perante o Empregador + Link Único)
app.post('/api/sessions/start', async (req, res) => {
  try {
    const { workerName, workerRole, sector, shift, companyTime, consentGiven, linkId } = req.body;
    
    // VERIFICAÇÃO ESTRITA NO BACKEND: O link deve obrigatoriamente existir, estar ativo e NÃO ter sido usado ainda
    if (!linkId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Link de pesquisa obrigatório. É necessário um link oficial gerado pelo administrador para iniciar a coleta.',
        code: 'LINK_REQUIRED'
      });
    }

    const surveyLink = await getSurveyLink(linkId);
    if (!surveyLink || surveyLink.active === false || surveyLink.used === true) {
      return res.status(403).json({ 
        success: false, 
        error: surveyLink?.used 
          ? 'Este link de pesquisa já foi utilizado e concluído. Cada link gerado pelo gestor é de uso único.'
          : 'Link de pesquisa inválido, expirado ou inativo. Apenas links oficiais ativos cadastrados no sistema pelo gestor podem ser respondidos.',
        code: surveyLink?.used ? 'LINK_ALREADY_USED' : 'INVALID_SURVEY_LINK'
      });
    }

    const sessionId = `ses_${randomUUID().substring(0, 8)}`;

    const session = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      profile: {
        workerName: workerName?.trim() || 'Colaborador',
        workerRole: workerRole?.trim() || 'Operacional',
        sector: (surveyLink.sector && surveyLink.sector !== 'all') ? surveyLink.sector : (sector || 'Produção Geral'),
        shift: shift || '1º Turno (Manhã)',
        companyTime: companyTime || '6 meses a 2 anos',
        anonymous: true,
        linkId: surveyLink.id
      },
      lgpdConsent: {
        consentGiven: consentGiven !== false,
        consentTimestamp: new Date().toISOString(),
        legalBasis: 'LGPD Art. 7º, II (Obrigação Legal SST) e Art. 11, II, "f" (Tutela da Saúde) c/c Art. 13 (Pseudonimização)',
        purpose: 'Avaliação preventiva de riscos psicossociais para o PGR/GRO (NR-01 item 1.5.3.3)',
        rightsChannel: 'Art. 18 da LGPD disponível no menu de direitos do titular'
      },
      history: [],
      currentStepData: null
    };

    // Gera a 1ª pergunta
    const firstStep = await getNextInterviewStep(session);
    session.currentStepData = firstStep;
    
    await saveSession(session);

    // Registra início de coleta na trilha de auditoria
    await logAuditAccess({
      action: 'SESSION_INITIATED',
      targetId: sessionId,
      performedBy: 'EMPREGADO_CADASTRADO',
      sector: session.profile.sector,
      legalBasis: session.lgpdConsent.legalBasis,
      details: `Coleta de dados iniciada e validada via link de uso único: "${surveyLink.title}" (ID: ${surveyLink.id}).`
    });

    res.json({
      success: true,
      sessionId,
      session
    });
  } catch (err) {
    console.error('Erro ao iniciar sessão:', err);
    res.status(500).json({ error: 'Erro ao iniciar sessão de entrevista.' });
  }
});

// 2. Responder pergunta e obter próximo passo adaptativo
app.post('/api/sessions/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { userAnswer, widgetType, responseDurationMs } = req.body;

    const session = await getSession(id);
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Esta sessão já foi concluída.' });
    }

    const currentStep = session.currentStepData;

    // Verificação de Segurança e Moderação Ético-Legal (Lei 14.457/22 e LGPD)
    const safetyCheck = SafetyGuard.validateUserInput(userAnswer);
    if (!safetyCheck.isSafe) {
      const warningStep = {
        bot_statement: safetyCheck.warningStatement || 'Identificamos conteúdos que necessitam de direcionamento específico aos canais formais da empresa.',
        next_question: safetyCheck.warningQuestion || 'Este canal é dedicado exclusivamente ao diálogo sobre saúde, ergonomia e segurança no trabalho (NR-01) protegido pela LGPD. Gostaria de focar nas condições do seu posto?',
        ui_widget: 'text_input',
        widget_options: {
          placeholder: 'Descreva como é o seu dia a dia no setor...'
        },
        dimension_target: 'psicossocial_organizacional',
        psychological_assessment: {
          openness_score: 2,
          fear_of_retaliation: 3,
          fatigue_level: 3,
          subtext_detected: `Alerta de moderação/segurança acionado: ${safetyCheck.reason}`,
          hidden_risk_flags: ['Alerta de Conteúdo Sensível / Diretriz de Proteção']
        },
        ai_realtime_observation: `Aviso de conformidade emitido devido ao acionamento de filtro de segurança (${safetyCheck.reason}).`,
        is_interview_complete: false
      };

      session.currentStepData = warningStep;
      await saveSession(session);

      return res.json({
        success: true,
        isCompleted: false,
        nextStep: warningStep,
        session
      });
    }

    // Registra a interação no histórico
    const historyItem = {
      stepNumber: session.history.length + 1,
      question: currentStep.next_question,
      botStatement: currentStep.bot_statement,
      userAnswer: userAnswer,
      widgetType: widgetType || currentStep.ui_widget,
      dimensionTarget: currentStep.dimension_target,
      psychologicalAssessment: currentStep.psychological_assessment || null,
      aiObservation: currentStep.ai_realtime_observation,
      timestamp: new Date().toISOString(),
      durationMs: responseDurationMs || null
    };

    session.history.push(historyItem);

    // Se já passou do número ideal ou a IA sinalizou término
    if (currentStep.is_interview_complete || session.history.length >= 8) {
      session.status = 'ready_for_report';
      await saveSession(session);

      return res.json({
        success: true,
        isCompleted: true,
        session
      });
    }

    // Chama a IA para formular o próximo passo
    const rawNextStep = await getNextInterviewStep(session);
    const nextStep = SafetyGuard.validateAiOutput(rawNextStep);
    session.currentStepData = nextStep;

    await saveSession(session);

    res.json({
      success: true,
      isCompleted: false,
      nextStep,
      session
    });
  } catch (err) {
    console.error('Erro ao processar resposta:', err);
    res.status(500).json({ error: 'Erro ao processar resposta da entrevista.' });
  }
});

// 3. Finalizar sessão e compilar Relatório PGR/NR-01
app.post('/api/sessions/:id/finish', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await getSession(id);

    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    const report = await generateComprehensiveReport(session);
    
    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    session.reportId = report.id;

    await saveSession(session);
    await saveReport(report);

    // Fecha automaticamente o link de pesquisa de uso único
    if (session.profile?.linkId) {
      await closeSurveyLink(session.profile.linkId, session.id);
    }

    // Registra na trilha de auditoria
    await logAuditAccess({
      action: 'REPORT_COMPILED',
      targetId: report.id,
      performedBy: 'MOTOR_IA_NR01',
      sector: session.profile.sector,
      legalBasis: 'NR-01 Item 1.5.7.3.2 / Portaria MTE nº 1.419/2024',
      details: `Relatório diagnóstico PGR compilado com sucesso para o setor ${session.profile.sector}. Link ${session.profile.linkId} concluído e encerrado.`
    });

    res.json({
      success: true,
      report: {
        ...report,
        profile: maskProfileForEmployer(report.profile, session.id)
      }
    });
  } catch (err) {
    console.error('Erro ao gerar relatório final:', err);
    res.status(500).json({ error: 'Erro ao compilar o relatório final NR-1.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PORTAL DE DIREITOS DO TITULAR (LGPD - ART. 18 E ART. 19)
// ══════════════════════════════════════════════════════════════════════════════

// Direito de Acesso e Confirmação de Tratamento (LGPD Art. 18, I e II c/c Art. 19, I)
app.get('/api/lgpd/my-data/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Nenhum registro localizado para o identificador fornecido.' });
    }

    res.json({
      success: true,
      titularMessage: 'Declaração de dados tratados conforme Art. 19, I da LGPD.',
      sessionInfo: {
        sessionId: session.id,
        status: session.status,
        createdAt: session.createdAt,
        anonymous: session.profile.anonymous,
        sector: session.profile.sector,
        shift: session.profile.shift,
        totalAnswers: session.history.length,
        legalBasis: session.lgpdConsent?.legalBasis || 'LGPD Art. 7º, II',
        answers: session.history.map(h => ({
          pergunta: h.question,
          respostaFornecida: h.userAnswer,
          dataHora: h.timestamp
        }))
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao recuperar dados do titular.' });
  }
});

// Direito de Portabilidade dos Dados (LGPD Art. 18, V)
app.get('/api/lgpd/export/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada para exportação.' });
    }

    const exportPayload = {
      exportMetadata: {
        document: 'Portabilidade de Dados Pessoais do Titular (LGPD Art. 18, V)',
        generatedAt: new Date().toISOString(),
        format: 'JSON Interoperável Estruturado'
      },
      session
    };

    res.setHeader('Content-Disposition', `attachment; filename="meus_dados_equilibra_${session.id}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(exportPayload, null, 2));
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gerar arquivo de portabilidade.' });
  }
});

// Direito de Eliminação de Dados (LGPD Art. 18, VI e Art. 16)
app.delete('/api/lgpd/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteSession(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Registro não encontrado ou já eliminado.' });
    }

    res.json({
      success: true,
      message: 'Todos os seus dados de entrevista e diagnósticos foram eliminados em definitivo dos nossos registros, em conformidade com o Art. 18, VI da LGPD.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar eliminação de dados.' });
  }
});

// Revogação de Consentimento (LGPD Art. 8º, § 5º)
app.post('/api/lgpd/revoke-consent/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Sessão não encontrada.' });
    }

    session.lgpdConsent.consentRevoked = true;
    session.lgpdConsent.revokedAt = new Date().toISOString();
    session.status = 'consent_revoked';

    await saveSession(session);

    await logAuditAccess({
      action: 'CONSENT_REVOCATION',
      targetId: session.id,
      performedBy: 'TITULAR_DO_DADO',
      legalBasis: 'LGPD Art. 8º, § 5º',
      details: 'Consentimento revogado pelo titular. Dados isolados de novas consultas estatísticas.'
    });

    res.json({
      success: true,
      message: 'Seu consentimento foi revogado com sucesso. Seus dados não serão utilizados em novas análises.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao revogar consentimento.' });
  }
});

// Informações do Encarregado de Dados (DPO - LGPD Art. 41)
app.get('/api/lgpd/dpo-info', (req, res) => {
  res.json(getDpoInfo());
});

// Relatório de Impacto à Proteção de Dados (RIPD / DPIA - LGPD Art. 38)
app.get('/api/lgpd/ripd', (req, res) => {
  res.json(getRipdReport());
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS DO ADMINISTRADOR / SESMT / CIPA (DASHBOARDS, AUDITORIA & PGR DA NR-01)
// ══════════════════════════════════════════════════════════════════════════════

// 4. Listar todas as sessões para o Administrador (com Anonimização & Sigilo Técnico)
app.get('/api/sessions', async (req, res) => {
  try {
    const { sector, requester } = req.query;
    let sessions = await listSessions();

    if (sector && sector !== 'all') {
      sessions = sessions.filter(s => s.profile && s.profile.sector === sector);
    }

    // Aplica a regra de sigilo técnico perante o empregador (LGPD Art. 13)
    const protectedSessions = sessions.map(session => ({
      ...session,
      profile: maskProfileForEmployer(session.profile, session.id)
    }));

    res.json(protectedSessions);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar sessões para o gestor.' });
  }
});

// 5. Obter detalhes de uma sessão individual (com Sigilo Técnico perante o Gestor)
app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Sessão não encontrada.' });

    // Registra visualização detalhada de prontuário na auditoria
    await logAuditAccess({
      action: 'ADMIN_VIEW_SESSION_DETAIL',
      targetId: session.id,
      performedBy: req.query.requester || 'GESTOR_SESMT_CIPA',
      sector: session.profile.sector,
      legalBasis: 'NR-01 Item 1.5.7.3.2 (Inventário de Riscos)',
      details: `Visualização individual de sessão detalhada (ID: ${session.id}).`
    });

    res.json({
      ...session,
      profile: maskProfileForEmployer(session.profile, session.id)
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar sessão.' });
  }
});

// 6. Listar todos os relatórios finais do PGR (com Sigilo Técnico)
app.get('/api/reports', async (req, res) => {
  try {
    const reports = await listReports();

    await logAuditAccess({
      action: 'ADMIN_LIST_REPORTS',
      performedBy: req.query.requester || 'GESTOR_SESMT_CIPA',
      legalBasis: 'NR-01 Item 1.5.7.1 (Documentação do PGR)',
      details: `Listagem consolidada de ${reports.length} relatórios técnicos acessada.`
    });

    const maskedReports = reports.map(r => ({
      ...r,
      profile: maskProfileForEmployer(r.profile, r.sessionId || r.id)
    }));

    res.json(maskedReports);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar relatórios.' });
  }
});

// 7. Obter relatório específico do PGR
app.get('/api/reports/:id', async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ error: 'Relatório não encontrado.' });

    await logAuditAccess({
      action: 'ADMIN_VIEW_REPORT_DETAIL',
      targetId: report.id,
      performedBy: req.query.requester || 'GESTOR_SESMT_CIPA',
      sector: report.profile?.sector || 'Geral',
      legalBasis: 'NR-01 Item 1.5.5.2 (Plano de Ação do PGR)',
      details: `Visualização de relatório técnico do PGR (ID: ${report.id}).`
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar relatório.' });
  }
});

// 8. Trilha de Auditoria e Logs de Acesso (LGPD Art. 37 / NR-01 Item 1.6.4 e 4.7.1)
app.get('/api/lgpd/audit-logs', async (req, res) => {
  try {
    const logs = await listAuditLogs();
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar logs de auditoria.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS DE GESTÃO DE LINKS DE PESQUISA DO ADMINISTRADOR (CAMPANHAS NR-01)
// ══════════════════════════════════════════════════════════════════════════════

// 9. Listar todos os links de pesquisa com contagem de respostas associadas
app.get('/api/survey-links', async (req, res) => {
  try {
    const [links, sessions, reports] = await Promise.all([
      listSurveyLinks(),
      listSessions(),
      listReports()
    ]);

    const linksWithStats = links.map(link => {
      const linkSessions = sessions.filter(s => s.profile?.linkId === link.id);
      const linkReports = reports.filter(r => r.profile?.linkId === link.id || r.linkId === link.id);
      return {
        ...link,
        totalSessions: linkSessions.length,
        completedReports: linkReports.length,
        lastResponseAt: linkSessions[0]?.createdAt || link.createdAt
      };
    });

    res.json(linksWithStats);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar links de pesquisa.' });
  }
});

// 10. Criar novo link de pesquisa
app.post('/api/survey-links', async (req, res) => {
  try {
    const { title, sector, adminName, adminEmail } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Título do link / campanha é obrigatório.' });
    }

    const linkId = `lnk_${randomUUID().substring(0, 8)}`;
    const newLink = {
      id: linkId,
      title: title.trim(),
      sector: sector || 'all',
      adminName: adminName?.trim() || 'Gestor do Setor',
      adminEmail: adminEmail?.trim() || '',
      createdAt: new Date().toISOString(),
      active: true
    };

    await saveSurveyLink(newLink);

    await logAuditAccess({
      action: 'SURVEY_LINK_CREATED',
      targetId: linkId,
      performedBy: newLink.adminName,
      sector: newLink.sector,
      details: `Novo link de pesquisa gerado: "${newLink.title}" (ID: ${linkId}).`
    });

    res.json({ success: true, link: newLink });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar link de pesquisa.' });
  }
});

// 11. Obter link específico com estatísticas
app.get('/api/survey-links/:id', async (req, res) => {
  try {
    const link = await getSurveyLink(req.params.id);
    if (!link) return res.status(404).json({ error: 'Link não encontrado.' });
    res.json(link);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar link.' });
  }
});

// 12. ROTA DE VERIFICAÇÃO NO BACKEND (Checa se o link existe, está ativo e NÃO foi usado)
app.get('/api/survey-links/verify/:id', async (req, res) => {
  try {
    const link = await getSurveyLink(req.params.id);
    if (!link) {
      return res.status(404).json({
        valid: false,
        error: 'Link de pesquisa inexistente ou incorreto. Solicite o link oficial ao gestor da empresa.'
      });
    }

    if (link.used === true) {
      return res.status(403).json({
        valid: false,
        error: 'Este link de pesquisa já foi utilizado e concluído. Cada link gerado pelo gestor é de uso único.'
      });
    }

    if (link.active === false) {
      return res.status(403).json({
        valid: false,
        error: 'Este link de pesquisa foi pausado ou desativado pelo administrador do sistema.'
      });
    }

    res.json({
      valid: true,
      link: {
        id: link.id,
        title: link.title,
        sector: link.sector,
        adminName: link.adminName,
        createdAt: link.createdAt,
        active: link.active,
        used: Boolean(link.used)
      }
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: 'Erro ao verificar link no servidor.' });
  }
});

// 13. Pausar / Reativar link
app.patch('/api/survey-links/:id/toggle', async (req, res) => {
  try {
    const updated = await toggleSurveyLinkStatus(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Link não encontrado.' });
    
    await logAuditAccess({
      action: updated.active ? 'SURVEY_LINK_ACTIVATED' : 'SURVEY_LINK_PAUSED',
      targetId: updated.id,
      details: `Status do link "${updated.title}" alterado para ${updated.active ? 'ATIVO' : 'PAUSADO'}.`
    });

    res.json({ success: true, link: updated });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao alterar status do link.' });
  }
});

// 14. Excluir link
app.delete('/api/survey-links/:id', async (req, res) => {
  try {
    await deleteSurveyLink(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir link.' });
  }
});

// Inicia o servidor com tratamento de porta ocupada
const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Equilibra SST & IA iniciada com sucesso!`);
  console.log(`⚖️  Conformidade Legal: NR-01 (MTP 4.219/2022) & LGPD (Lei 13.709/2018)`);
  console.log(`🌐 Interface do Empregado (Titular): http://localhost:${PORT}`);
  console.log(`📊 Painel do Administrador (SESMT / CIPA): http://localhost:${PORT}/dashboard.html`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ A porta ${PORT} já está em uso por outro processo.`);
    console.error(`Para liberar a porta, feche o outro terminal ou altere a porta no arquivo .env.`);
  } else {
    console.error('Erro no servidor:', err);
  }
});
