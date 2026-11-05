# Equilibra Web — Plataforma de Escuta e Gestão NR-1 / SST

Plataforma web SaaS para a equipe interna de RH e Segurança e Saúde no Trabalho (SST) organizar a escuta confidencial sobre condições de trabalho e fatores psicossociais, transformar dados coletivos em relatórios técnicos auditáveis e gerir planos de ação contínuos no âmbito da NR-1 / PGR.

---

## 1. Visão Geral e Pilares

1. **Privacidade e Sigilo Estatístico por Desenho ($N \ge 5$):**
   - Nenhuma média, percentual ou distribuição é divulgada para amostras com menos de 5 respondentes.
   - Partição determinística de segmentos: áreas com $n < 5$ são agrupadas automaticamente em *"Demais áreas (agrupadas)"* para impedir identificação de indivíduos por exclusão.
   - Supressão preventiva por sobreposição residual: previne inferência quando ciclos sucessivos têm públicos quase idênticos (diferença $< 5$).
2. **Conformidade Técnica com a NR-1 / PGR:**
   - Termo formal de aceite técnico por Engenheiro(a) de Segurança ou Médico(a) do Trabalho com hash de integridade e registro auditado.
   - Instrumentos psicossociais estruturados (incluindo modelo oficial HSE de 35 itens com inversões de escala calculadas no servidor).
   - Trilha de auditoria encadeada por hash SHA-256 para eventos de gestão, exportação e aceite.
3. **Decisão Operacional Ágil:**
   - Cockpit *"Hoje"* com fila de triagem prioritária baseada em 5 condições operacionais e gráficos de tendência.
   - Gestão integrada de planos de ação (5W2H) com acompanhamento de prazos, anexação de evidências e revisão de eficácia.
4. **Exportação Regulatória em 4 Formatos:**
   - **PDF:** Relatório vetorial diagramado com hash SHA-256, cabeçalho institucional e disclaimers regulamentares.
   - **Excel (.xlsx):** Pasta de trabalho com 7 abas detalhadas (Resumo, Fatores, Distribuição, Segmento x Fator, Participação, Comparação, Metodologia) e exportação consolidada do histórico da empresa.
   - **CSV:** Codificado em UTF-8 com BOM e separador `;` para compatibilidade imediata com Microsoft Excel em português.
   - **JSON:** Exportação sanitizada de auditoria estruturada para integração com sistemas internos.

---

## 2. Requisitos e Inicialização

Requer **Node.js 20.12 ou superior** (Express 5, Vanilla JS ES Modules, sem dependências de build).

### Instalação e Execução

```bash
# 1. Instalar dependências (apenas express, exceljs, pdfkit e dev tools)
npm install

# 2. Executar verificações de código e conformidade (sintaxe e zero inline handlers)
npm run check

# 3. Executar suíte completa de testes unitários e de integração (38 testes)
npm test

# 4. Executar bateria de testes ponta a ponta (E2E)
npm run e2e

# 5. Iniciar servidor em desenvolvimento com recarga automática
npm run dev

# 6. Iniciar servidor em produção
npm start
```

Acesse no navegador: `http://localhost:3000`.

---

## 3. Scripts Disponíveis

| Comando | Descrição |
|---|---|
| `npm start` | Inicia o servidor Express em `http://localhost:3000`. |
| `npm run dev` | Inicia o servidor com flag `--watch` do Node.js. |
| `npm test` | Executa todos os 38 testes automatizados em `tests/` com isolamento completo em diretório temporário. |
| `npm run check` | Valida sintaxe JavaScript de todos os arquivos e audita estritamente a ausência de atributos inline (`onclick`, `style`) em `public/`. |
| `npm run e2e` | Roda a jornada ponta a ponta em 10 passos: autenticação, cockpit, criação de pesquisa, abertura, distribuição pseudonimizada, coleta confidencial, encerramento antecipado, geração de relatório, 4 exportações e aceite formal NR-1. |
| `npm run qa` | Inicia ambiente isolado de demonstração na porta 3107 com dados fictícios temporários. |
| `node scripts/seedConsolidatedCompany.js` | Gera base de teste completa e realista da empresa fictícia "Zenai Soluções Tecnológicas" (181 colaboradores, 7 áreas, 4 ciclos fechados, 1 HSE, 1 suprimido por sobreposição, ações e auditoria). |

---

## 4. Arquitetura do Sistema

### Backend (Node.js 20+ / Express 5)
- **Armazenamento:** Adaptador em arquivo JSON local com escrita atômica (rename), recuperação de diário de transações e chave criptográfica AES-256-GCM para dados sensíveis.
- **Isolamento:** Múltiplas organizações isoladas por `accountId` / `organizationId`. A variável `EQUILIBRA_DATA_DIR` permite isolamento em tempo de execução/testes.
- **Serviços Principais:**
  - `src/domain/reporting.js`: Motor puro de agregação, classificação semafórica e regras de supressão estatística.
  - `src/domain/instruments.js`: Catálogo de 10 modelos web com snapshot congelado por ciclo e inversões HSE.
  - `src/services/surveyLifecycle.js`: Máquina de estados da pesquisa (draft → open → closed → archived), distribuição e controle de quórum.
  - `src/services/todayService.js`: Motor do cockpit operacional com fila de triagem e cálculo de KPIs.
  - `src/services/reportExportService.js`: Gerador dos 4 formatos de exportação (PDF vetorial, Excel 7 abas, CSV BOM, JSON).

### Frontend (Vanilla JS ES Modules + Design System CSS)
- **Zero build step:** Servido diretamente pelo Express usando módulos ES nativos.
- **Tipografia Local:** Família *Plus Jakarta Sans* auto-hospedada em `public/vendor/fonts/` (zero dependências de CDN externa).
- **Paleta Reconciliada:** Baseada em Deep Mulberry (`#581c43`), cores semânticas de acessibilidade e tema claro/escuro nativo.
- **Organização Modular:**
  - `public/js/main.js`: Inicializador, roteador global e delegação de eventos via `data-action`.
  - `public/js/core/`: `api.js` (com retry e tratamento de erro HTTP), `router.js` (roteamento declarativo SPA com `:id`), `store.js` (estado observável), `errors.js` (mensagens amigáveis em português).
  - `public/js/domain/`: `labels.js`, `formatters.js` (escapes XSS, formatação percentual, semáforo de fatores).
  - `public/js/ui/`: `shell.js` (layout base, drawer responsivo, skip-link), `dialog.js` (modal acessível com foco preso e retorno), `toast.js`, `fields.js`, `chart.js` (canvas com fallback em tabela semântica).
  - `public/js/features/`: Módulos de tela (`todayView`, `surveysView`, `resultsView`, `actionsView`, `organizationView`, `settingsView`, `respondView`).
- **Acessibilidade e Segurança:**
  - Zero atributos inline (`onclick` e `style` banidos).
  - Suporte completo a navegação por teclado (`Tab`, `Escape`), leitor de tela (`aria-describedby`, `aria-live`, `aria-modal`) e contraste WCAG AA.

---

## 5. Instrumentos de Escuta e Metodologia

O Equilibra disponibiliza 10 modelos de pesquisa no catálogo:
- **9 Roteiros Próprios Exploratórios:** Perguntas em escala Likert de 1 a 5 cobrindo Demandas, Autonomia, Apoio, Relações, Reconhecimento, Jornada, Mudanças e Segurança Psicológica.
- **1 Instrumento HSE (Health and Safety Executive):** Versão oficial de 35 itens com cálculo automático das 7 subescalas e inversão matemática dos 12 itens formulados negativamente ($6 - resposta$).

### Faixas de Referência Normativas
- **Atenção Prioritária (Vermelho):** Média $< 2,80$
- **Cuidado / Monitoramento (Amarelo):** Média entre $2,80$ e $3,59$
- **Adequado / Protetivo (Verde):** Média $\ge 3,60$

*Nota Metodológica:* O questionário de percepção é uma das fontes de informação do processo de gerenciamento de riscos ocupacionais (GRO). Deve ser conjugado com análise ergonômica do trabalho (AET), observação direta e diálogo com trabalhadores e CIPA. O relatório gerado não constitui laudo psicológico ou diagnóstico clínico individual.

Consulte [Metodologia de Pesquisa](SURVEY_METHODOLOGY.md), [Operação e Runbook](docs/OPERATIONS.md) e [Relatório de Validação](docs/VALIDATION.md) para documentação detalhada.
