# Mapa Completo do Código — Equilibra Web (MVP)

Documento atualizado refletindo a arquitetura definitiva do MVP do **Equilibra Web**.

---

## 1. Estrutura de Diretórios e Arquivos

```
equilibra-web/
├── data/                                 # Diretório padrão de persistência JSON (ignorado nos testes)
├── docs/                                 # Documentação técnica e operacional
│   ├── ENTREGA_MVP.md                    # Relatório executivo de entrega das Fases 0 a 7
│   ├── MAPA_DO_CODIGO.md                 # Este documento
│   ├── OPERATIONS.md                     # Runbook operacional, comandos e ciclo de vida
│   └── VALIDATION.md                     # Evidências de testes, 38 suites e teste E2E
├── public/                               # Frontend estático servido pelo Express
│   ├── css/                              # Design system unificado (Deep Mulberry #581C43)
│   │   ├── base.css                      # Reset e tipografia base
│   │   ├── components.css                # Botões, cards, badges, tabelas, modais, toasts
│   │   ├── layouts.css                   # Grid, shell da aplicação, drawer responsivo
│   │   ├── print.css                     # Estilos dedicados para impressão
│   │   └── tokens.css                    # Variáveis CSS (cores, tipografia, espaçamentos)
│   ├── js/                               # Frontend modular (Vanilla JS ES Modules nativo)
│   │   ├── main.js                       # Ponto de entrada, delegação global e inicialização
│   │   ├── core/
│   │   │   ├── api.js                    # Cliente HTTP com retry e interceptor de sessão
│   │   │   ├── errors.js                 # Dicionário de mensagens de erro amigáveis em pt-BR
│   │   │   ├── router.js                 # Roteador SPA declarativo com suporte a :id
│   │   │   └── store.js                  # Estado global observável da aplicação
│   │   ├── domain/
│   │   │   ├── formatters.js             # Funções de escape XSS, formatação de data e semáforo
│   │   │   └── labels.js                 # Rótulos textuais de status e entidades
│   │   ├── features/
│   │   │   ├── actions/actionsView.js    # Tela de planos de ação (5W2H) e evidências
│   │   │   ├── auth/authView.js          # Telas de login e registro
│   │   │   ├── organization/organizationView.js # Gestão de pessoas e departamentos
│   │   │   ├── respond/respondView.js    # Tela pública de resposta confidencial
│   │   │   ├── results/resultsView.js    # Relatórios de ciclo, matriz e aceite NR-1
│   │   │   ├── settings/settingsView.js  # Configurações, equipe, retenção e plano
│   │   │   ├── surveys/surveysView.js    # Listagem e criação de pesquisas multi-segmento
│   │   │   └── today/todayView.js        # Cockpit "Hoje", fila de triagem e gráficos
│   │   └── ui/
│   │       ├── chart.js                  # Renderização de gráficos com fallback em tabela
│   │       ├── dialog.js                 # Modal acessível com captura de foco (focus trap)
│   │       ├── empty.js                  # Componente para estados vazios instrutivos
│   │       ├── fields.js                 # Construtores de campos de formulário acessíveis
│   │       ├── shell.js                  # Cabeçalho institucional, abas e drawer móvel
│   │       └── toast.js                  # Notificações do sistema em aria-live
│   ├── vendor/
│   │   └── fonts/                        # Fontes locais Plus Jakarta Sans (zero CDNs)
│   └── index.html                        # Ponto de ancoragem da SPA
├── scripts/                              # Scripts utilitários e de verificação
│   ├── check.js                          # Verificação sintática e auditoria de atributos inline
│   ├── e2e.js                            # Suíte ponta a ponta em 10 passos do ciclo de vida
│   └── seedConsolidatedCompany.js        # Gerador de massa de teste realista da empresa Zenai
├── src/                                  # Código-fonte do backend Node.js (Express 5)
│   ├── config/
│   │   ├── equilibraStorage.js           # Adaptador de persistência atômica em arquivos JSON
│   │   ├── identityCrypto.js             # Criptografia AES-256-GCM para dados sensíveis
│   │   ├── plans.js                      # Configuração dos planos comerciais
│   │   └── referenceBands.js             # Faixas de corte semafóricas e deltas
│   ├── domain/
│   │   ├── analysis.js                   # Agregação matemática e distribuição de frequências
│   │   ├── instruments.js                # Catálogo de 10 instrumentos web e inversões HSE
│   │   └── reporting.js                  # Motor de relatórios, partição N>=5 e supressão
│   ├── repositories/
│   │   └── managementRepository.js       # Repositório de gestão com auditoria encadeada
│   ├── routes/
│   │   ├── equilibraRoutes.js            # Rotas principais de RH, pesquisas e relatórios
│   │   ├── managementRoutes.js           # Rotas de workspace, equipe, retenção e senha
│   │   ├── recoveryRoutes.js             # Recuperação assistida de senhas
│   │   └── management/                   # Sub-rotas de ações, avaliações, equipe e cobrança
│   ├── services/
│   │   ├── memberImport.js               # Importação de colaboradores por planilha
│   │   ├── passwordService.js            # Derivação segura de senhas via scrypt
│   │   ├── reportExportService.js        # Exportador em PDF, Excel 7 abas, CSV BOM e JSON
│   │   ├── surveyLifecycle.js            # Máquina de estados da pesquisa e convites
│   │   └── todayService.js               # Triagem de prioridades do cockpit operacional
│   └── server.js                         # Inicializador do Express e middlewares de segurança
├── tests/                                # Suíte completa de 38 testes automatizados
│   ├── helpers/testServer.js             # Harness de inicialização de servidor para testes
│   ├── phase1-collection.test.js         # Testes de ciclo de vida e distribuição
│   ├── phase2-reporting.test.js          # Testes do motor de sigilo e partição N>=5
│   ├── phase3-export.test.js             # Testes das 4 exportações e aceite formal
│   ├── phase4-today.test.js              # Testes do cockpit Hoje e fila de decisão
│   ├── phase5-navigation.test.js         # Testes de navegação e ausência de atributos inline
│   └── ...                               # Demais testes legados e de cobrança
├── package.json                          # Manifest com dependências estritas (zero libs extras)
└── SURVEY_METHODOLOGY.md                 # Documento metodológico e legal da NR-1
```

---

## 2. Mapa Completo de Rotas de API

### 2.1 Autenticação e Sessão (`/api/auth/*`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/auth/register` | Público | Cadastro de nova organização e administrador |
| POST | `/api/auth/login` | Público | Autenticação com limitação de taxa (rate limiting) |
| GET | `/api/auth/me` | Autenticado | Retorna dados do usuário autenticado |
| PUT | `/api/auth/me` | Autenticado | Atualiza perfil cadastral |
| POST | `/api/auth/logout` | Autenticado | Encerra sessão e invalida cookie |

### 2.2 Cockpit Hoje (`/api/today`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/today` | Autenticado | Fila de triagem prioritária em 5 condições, KPIs e gráficos |

### 2.3 Colaboradores e Grupos (`/api/members/*`, `/api/groups/*`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/members` | Owner / Editor | Lista de colaboradores cadastrados |
| POST | `/api/members` | Owner / Editor | Cadastro individual de colaborador |
| PUT | `/api/members/:id` | Owner / Editor | Atualização de colaborador |
| DELETE | `/api/members/:id` | Owner / Editor | Exclusão de colaborador |
| GET | `/api/members/template` | Autenticado | Baixa modelo CSV para importação |
| POST | `/api/members/import/preview` | Owner / Editor | Pré-visualiza planilha de colaboradores |
| POST | `/api/members/import` | Owner / Editor | Executa importação de colaboradores |
| GET | `/api/groups` | Autenticado | Lista departamentos e grupo padrão Geral |
| POST | `/api/groups` | Owner / Editor | Criação de novo departamento/área |
| PUT | `/api/groups/:id` | Owner / Editor | Atualização de grupo |
| DELETE | `/api/groups/:id` | Owner / Editor | Exclusão de grupo (se não houver pesquisa ativa) |

### 2.4 Pesquisas e Ciclos (`/api/surveys/*`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/meta` | Autenticado | Catálogo de instrumentos, referências e parâmetros |
| GET | `/api/surveys` | Autenticado | Listagem de pesquisas cadastradas |
| POST | `/api/surveys` | Owner / Editor | Criação de nova pesquisa em rascunho (`draft`) |
| GET | `/api/surveys/preflight` | Autenticado | Pré-visualização de impacto e riscos de sobreposição |
| PUT | `/api/surveys/:id` | Owner / Editor | Edição de rascunho de pesquisa |
| DELETE | `/api/surveys/:id` | Owner / Editor | Exclusão física (rascunho) ou arquivamento (fechada) |
| POST | `/api/surveys/:id/open` | Owner / Editor | Abertura do ciclo e geração de convites |
| POST | `/api/surveys/:id/close` | Owner / Editor | Encerramento antecipado com justificativa |
| POST | `/api/surveys/:id/extend` | Owner / Editor | Prorrogação de prazo com justificativa |
| POST | `/api/surveys/:id/reissue` | Owner / Editor | Reemissão de links para não-respondentes |
| GET | `/api/surveys/:id/invitations/export` | Owner / Editor | Exporta planilha de links individuais em CSV |

### 2.5 Resposta Confidencial (`/api/respond/*`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/respond/:token` | Público | Carrega formulário anônimo por convite |
| POST | `/api/respond/:token` | Público | Registra respostas e consome convite de forma atômica |

### 2.6 Relatórios e Exportações (`/api/reports/*`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/reports` | Autenticado | Lista todos os relatórios da organização |
| GET | `/api/reports/:id` | Autenticado | Retorna snapshot do relatório de ciclo específico |
| GET | `/api/reports/:id/export` | Autenticado | Download nos formatos `pdf`, `xlsx`, `csv` ou `json` |
| GET | `/api/reports/history/export` | Autenticado | Download do histórico consolidado da empresa em Excel |
| POST | `/api/reports/:id/accept` | Owner / Editor | Registra aceite técnico formal do relatório para a NR-1 |
| POST | `/api/reports/:id/reevaluate` | Owner / Editor | Reavaliação restrita a casos de falha técnica |

### 2.7 Gestão de Ações NR-1 e Evidências (`/api/management/*`)
| Método | Caminho | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/management/workspace` | Autenticado | Retorna avaliações de risco, ações e evidências |
| POST | `/api/management/assessments` | Owner / Editor | Criação de avaliação a partir de achado do ciclo |
| PUT | `/api/management/assessments/:id` | Owner / Editor | Atualização de avaliação e contexto |
| POST | `/api/management/actions` | Owner / Editor | Criação de plano de ação (5W2H) |
| PUT | `/api/management/actions/:id` | Owner / Editor | Transição de estado da ação |
| POST | `/api/management/actions/:id/evidence` | Owner / Editor | Anexação de evidência de implementação |
| POST | `/api/management/actions/:id/measurement` | Owner / Editor | Registro de eficácia da ação |
| GET | `/api/management/dossier` | Autenticado | Exportação consolidada de decisões e planos |

---

## 3. Estado das Telas Frontend (SPA Hash Routes)

| Hash da Rota | Módulo Feature | Descrição |
|---|---|---|
| `#/` ou `#/hoje` | `todayView.js` | Cockpit executivo, fila de triagem e gráficos de tendência |
| `#/pesquisas` | `surveysView.js` | Listagem de pesquisas, status e filtros de ciclo |
| `#/pesquisas/nova` | `surveysView.js` | Criação de pesquisa multi-segmentos e preflight |
| `#/resultados` | `resultsView.js` | Histórico de ciclos e exportação de planilha consolidada |
| `#/resultados/:id` | `resultsView.js` | Relatório detalhado com 7 seções âncora e aceite NR-1 |
| `#/acoes` | `actionsView.js` | Gestão de planos de ação, cronograma, evidências e eficácia |
| `#/organizacao` | `organizationView.js` | Cadastro de colaboradores e departamentos |
| `#/configuracoes` | `settingsView.js` | Gestão de equipe, convites, retenção e plano |
| `#/responder/:token` | `respondView.js` | Interface limpa e confidencial para preenchimento |
