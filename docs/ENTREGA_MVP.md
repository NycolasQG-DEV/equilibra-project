# Relatório de Entrega — Equilibra Web MVP

**Data de entrega:** 22/10/2026  
**Versão do schema:** 2  
**Cobertura de testes:** 38 testes automatizados + suíte E2E de 10 passos  

---

## Sumário Executivo

O Equilibra partiu de um protótipo semi-funcional e chegou ao MVP auditável e operacional descrito neste documento. O produto está pronto para uso interno de equipes de RH e SST que precisam:

1. Realizar ciclos de escuta confidencial com proteção de identidade por desenho.
2. Gerar relatórios coletivos em conformidade com os requisitos de documentação do PGR (NR-1).
3. Gerir planos de ação com evidências, prazos e revisão de eficácia.
4. Exportar dossiês técnicos em quatro formatos auditáveis para o Engenheiro ou Médico do Trabalho responsável.

---

## 1. Fases Entregues

### Fase 0 — Preparação e Rede de Segurança
- **Mapa do código** (`docs/MAPA_DO_CODIGO.md`): inventário completo de rotas, arquivos, estrutura de dados e fluxos de estado antes de qualquer alteração.
- **Seed realista** (`scripts/seedConsolidatedCompany.js`): empresa fictícia "Zenai Soluções Tecnológicas" com 181 colaboradores, 7 áreas/departamentos, 4 ciclos fechados compatíveis para análise de tendência temporal, 1 ciclo HSE de 35 itens, 1 ciclo suprimido por sobreposição estatística, 1 ciclo aberto com 58% de quórum e 4 planos de ação em estágios distintos de maturidade, com trilha de auditoria encadeada por SHA-256.

### Fase 1 — Coleta Confiável por Segmento
- Migração de `groupId` para `segments[]` (idempotente e retrocompatível).
- Faixas de participação (`getBand`): Alta ≥70%, Moderada ≥40%, Baixa <40%.
- Máquina de estados da pesquisa (`surveyLifecycle.js`): `draft → open → closed → archived`.
- Distribuição pseudonimizada de links por convite (token SHA-256 individual de uso único).
- Controle de quórum máximo por pesquisa contra envios concorrentes (race-safe).
- Testes: Fases 1.1 a 1.4 (migração, getBand, ciclo de vida HTTP, privacidade por convite).

### Fase 2 — Motor de Resultados e Privacidade
- Faixas de referência configuráveis (`referenceBands.js`): Atenção (< 2,80), Cuidado (< 3,60) e Adequado (≥ 3,60) com deltas de tendência histórica.
- Partição determinística de segmentos: agrupamento guloso de buckets com $N < 5$ (algoritmo auditável sem randomização).
- Regra de supressão completa: $N < 5$ geral → `published: false`, sem vazamento de distribuições ou médias.
- Supressão por sobreposição residual: bloqueia publicação quando dois ciclos diferem por menos de 5 participantes.
- Inversões HSE de 12 itens ($6 - r$) aplicadas na agregação do servidor (não no cliente).
- Resumo determinístico por regras textuais (sem IA).
- Testes: Fases 2.1 a 2.9, incluindo a propriedade de segurança rigorosa ($\forall$ bucket: $n \ge 5$).

### Fase 3 — Relatórios e Exportações Regulatórias
- **PDF vetorial** (`generatePdf`): PDFKit nativo com hash SHA-256, tabela de fatores, disclaimers NR-1 e rodapé institucional.
- **Excel (.xlsx)** 7 abas: Resumo, Fatores, Distribuição, Segmento x Fator, Participação, Comparação, Metodologia.
- **Histórico Consolidado em Excel**: evolução temporal de todos os ciclos da organização.
- **CSV UTF-8 BOM + `;`**: compatibilidade imediata com Microsoft Excel em português.
- **JSON sanitizado**: exportação de auditoria com remoção automática de campos de infraestrutura.
- **Aceite Formal NR-1**: `POST /reports/:id/accept` com `acceptedBy`, `notes`, declaração de responsabilidade e trilha de auditoria. Resposta inclui `formalAcceptance` para consumo programático.
- Testes: Fase 3 (4 formatos, proteção contra vazamento em relatório suprimido, isolamento de contas, aceite formal).

### Fase 4 — Cockpit Hoje e Gráficos de Decisão
- `todayService.js`: Saudação temporal em português, data em formato longo localizado (pt-BR), fila de triagem com 5 condições operacionais, 3 KPIs operacionais (ciclo ativo, planos de ação, média geral) e 3 gráficos de decisão (tendência histórica por fator, participação por ciclo, status de ações).
- `charts.js` refatorado com lifecycle de destruição de instâncias e fallback em tabelas semânticas acessíveis.
- Testes: Fases 4.1 (7 cenários unitários do todayService + integração HTTP).

### Fase 5 — Arquitetura Frontend Modular
- **Novo SPA modular** em `public/js/`:
  - `core/`: `api.js` (retry + auth failure), `router.js` (declarativo + params `:id`), `store.js` (observável), `errors.js` (mensagens amigáveis em pt-BR).
  - `domain/`: `labels.js`, `formatters.js` (XSS escape, `fmt`, `attr`, `getBand`, `factorBadge`).
  - `ui/`: `shell.js`, `dialog.js` (focus trap acessível), `toast.js`, `fields.js`, `chart.js`, `empty.js`.
  - `features/`: 8 módulos de tela completamente desacoplados.
- **Eliminação de todos os arquivos legados**: `app.js`, `experience.js`, `management.js`, `styles.css`, `experience.css`, `management.css`.
- **Zero atributos inline**: auditoria estrita de `onclick=` e `style=` em todo `public/`.
- Testes: Fase 5.1 (formatters), 5.2 (errors), 5.3 (ausência de app.js e zero inline attrs).

### Fase 6 — Design System e Fontes Locais
- Família tipográfica **Plus Jakarta Sans** auto-hospedada em `public/vendor/fonts/`.
- Sistema CSS unificado: `tokens.css`, `base.css`, `components.css`, `layouts.css`, `print.css`.
- Paleta reconciliada com Deep Mulberry (`#581c43`) como cor primária institucional.
- `DESIGN.md` atualizado com tokens e frontmatter correto.
- Teste: Fase 6.1 (conformidade de tokens e fontes locais).

### Fase 7 — Consolidação e Verificação Final
- **Suíte E2E** (`scripts/e2e.js`): 10 passos do ciclo de vida completo em ambiente isolado temporário.
- **Documentação atualizada**: README.md, OPERATIONS.md, VALIDATION.md, SURVEY_METHODOLOGY.md, MAPA_DO_CODIGO.md.
- **Campos adicionados ao relatório**: `generalAverage`, `overallAverage`, `responsesCount` (calculados deterministicamente em `reporting.js`).
- **Endpoint de aceite aprimorado**: suporte a `acceptedBy`, `notes` e retorno de `formalAcceptance` no corpo da resposta.

---

## 2. Evidências de Qualidade

### Testes Automatizados (38/38 aprovados)
```
npm test  →  38 pass / 0 fail / 0 skipped
npm run check  →  Zero atributos inline (onclick/style) em public/
npm run e2e  →  10/10 passos concluídos com sucesso
```

### E2E — Jornada Completa
1. ✔ Autenticação com sessão e cookie `HttpOnly`
2. ✔ Cockpit Hoje com fila de 11 itens pendentes e saudação temporizada
3. ✔ Criação de pesquisa multi-segmento (3 áreas, 126 pessoas)
4. ✔ Abertura e geração de 127 convites pseudonimizados
5. ✔ Exportação CSV de convites individuais com tokens de uso único
6. ✔ 8 respostas confidenciais por tokens distintos
7. ✔ Encerramento antecipado com justificativa obrigatória
8. ✔ Relatório publicado com `generalAverage: 4.13` e 8 respondentes
9. ✔ Exportação em PDF (4471B), Excel (13380B), CSV (BOM+`;`) e JSON sanitizado
10. ✔ Aceite formal da NR-1 registrado por engenheira de segurança do trabalho

---

## 3. Decisões de Projeto e Premissas Registradas

| Decisão | Racional |
|---|---|
| Zero novas dependências além do `pdfkit` | Mantém auditabilidade e controle total do supply chain |
| Zero atributos inline `onclick`/`style` | Permite Content-Security-Policy estrita em produção futura |
| Algoritmo de partição gulosa por menor n | Determinístico, reprodutível e auditável sem aleatoriedade |
| Supressão residual com margem < 5 | Proteção conservadora proporcional ao risco de re-identificação |
| Fontes auto-hospedadas sem CDN | Compatibilidade offline e conformidade com LGPD (sem coleta de IP por terceiros) |
| Snapshot imutável no fechamento do ciclo | Integridade histórica: alterações cadastrais futuras não afetam relatórios passados |
| Aceite formal com declaração explícita | Alinhamento com prática recomendada pelo MTE para documentação de responsabilidade técnica |

---

## 4. Instruções para Uso Imediato

```bash
# Clonar e instalar
npm install

# Verificar conformidade
npm run check && npm test

# Iniciar servidor local
npm run dev          # Com recarga automática
npm start            # Produção

# Testar ciclo de vida completo (opcional)
npm run e2e

# Seed de demonstração
node scripts/seedConsolidatedCompany.js
```

Acesse em `http://localhost:3000`. Crie uma conta administrativa e siga o fluxo:

1. **Organização** → Cadastre colaboradores e crie departamentos.
2. **Pesquisas** → Crie uma pesquisa, escolha o modelo, defina o ciclo e abra a coleta.
3. **Distribua os convites** → Exporte a planilha CSV com links individuais pseudonimizados.
4. **Aguarde o quórum** → Acompanhe a adesão no cockpit **Hoje**.
5. **Encerre o ciclo** → O relatório é gerado automaticamente.
6. **Resultados** → Examine os fatores, a matriz por área e exporte o relatório para o Responsável Técnico.
7. **Aceite Formal** → O Engenheiro ou Médico do Trabalho assina o relatório pelo sistema.
8. **Planos de Ação** → Cadastre ações corretivas com prazo, responsável e critério de eficácia.

---

## 5. Pendências Conhecidas (Backlog Pós-MVP)

| Item | Prioridade |
|---|---|
| Envio automático de convites por e-mail ou WhatsApp | Alta |
| Instrumentos validados adicionais (COPSOQ, JCQ, PROART) | Alta |
| Multi-réplica com banco de dados transacional | Média |
| MFA e auditoria externa imutável | Média |
| Exportação de dossiê completo do PGR em PDF único | Média |
| Validação psicométrica dos instrumentos exploratórios próprios | Longo prazo |
