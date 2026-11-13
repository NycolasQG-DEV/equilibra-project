# Manual de Operações e Runbook — Equilibra

Documento técnico de suporte, manutenção e governança operacional para a plataforma **Equilibra Web** no âmbito de SST e RH.

---

## 1. Comandos Operacionais

### 1.1 Verificações e Testes

Todos os testes rodam em diretórios temporários isolados definidos dinamicamente pela variável `EQUILIBRA_DATA_DIR`. A pasta `data/` de produção **nunca é modificada** pelos testes.

```bash
# Validação de sintaxe JS e conformidade rígida de design (zero inline style/onclick)
npm run check

# Bateria de 38 testes automatizados (unitários, integração, domínio e segurança)
npm test

# Suíte de testes ponta a ponta (E2E) simulando o ciclo de vida completo de 10 etapas
npm run e2e
```

### 1.2 Inicialização e Demonstração

```bash
# Ambiente de produção local (porta 3000)
npm start

# Ambiente de desenvolvimento local com recarga a quente
npm run dev

# Ambiente de teste/QA sintético isolado (porta 3107)
npm run qa

# Geração de base de dados realista para homologação e demonstração técnica
node scripts/seedConsolidatedCompany.js
```

A base gerada por `seedConsolidatedCompany.js` popula 181 colaboradores distribuídos em 7 departamentos reais, 4 ciclos fechados compatíveis para análise de tendência temporal, 1 ciclo HSE de 35 itens, 1 ciclo suprimido por sobreposição estatística, 1 ciclo aberto com 58% de quórum e 4 planos de ação em estágios distintos de maturidade.

---

## 2. Ciclo de Vida da Pesquisa e Agendamento

O ciclo de vida das pesquisas segue a máquina de estados rigorosa implementada em `src/services/surveyLifecycle.js`:

```
   ┌─────────┐   openSurvey()    ┌─────────┐  closeSurvey()   ┌──────────┐
   │  draft  │ ────────────────> │  open   │ ───────────────> │  closed  │
   └─────────┘                   └─────────┘                  └──────────┘
        │                             │                            │
        │ DELETE                      │ scheduler                  │ DELETE
        v                             v                            v
   [Removido]                    closeExpired()                [archived]
```

### 2.1 Abertura e Emissão de Convites
- Uma pesquisa só pode ser aberta se o total de membros vinculados for $\ge 5$.
- A abertura congela o snapshot imutável do instrumento (`instrument`) e dos nomes dos grupos/segmentos (`groupNamesSnapshot`).
- O sistema gera convites pseudonimizados com tokens únicos de uso único (SHA-256) armazenados na coleção `invitations`.
- O administrador pode exportar a lista de convites em CSV (`GET /surveys/:id/invitations/export`) para envio via e-mail ou comunicação interna.

### 2.2 Encerramento e Publicação
- **Encerramento Automático:** A função `closeExpiredSurveys` verifica se `endsAt <= Date.now()`. Chamada automaticamente em requisições de consulta às pesquisas e relatórios.
- **Encerramento Antecipado:** Administradores podem encerrar uma pesquisa antes da data limite informando uma justificativa obrigatória e confirmando a ação (`POST /surveys/:id/close` com `{ confirmEarlyClose: true, reason: '...' }`).
- **Prorrogação de Prazo:** Pesquisas abertas com baixa adesão podem ter seu prazo estendido com justificativa (`POST /surveys/:id/extend` com `{ newEndsAt: '...', reason: '...' }`), renotificando os não-respondentes.
- **Geração Imediata do Snapshot:** No exato momento do encerramento, `buildCycleReport` calcula a agregação e salva o relatório na coleção `reports`. Alterações cadastrais futuras (ex.: exclusão de membros ou grupos) não afetam relatórios históricos já publicados.

---

## 3. Motor de Resultados e Regras de Sigilo

O motor `src/domain/reporting.js` é um módulo determinístico puro (sem dependência de I/O ou banco). Ele aplica três barreiras de proteção aos dados dos trabalhadores:

### 3.1 Regra do Quórum Mínimo ($N \ge 5$)
Se o número total de respostas coletadas for inferior a 5, o relatório é categorizado como `suppressed` (`published: false`). Nenhum cálculo de média, desvio ou frequência é exposto. A interface e a exportação exibem claramente o motivo da supressão e as orientações corretivas para o RH.

### 3.2 Partição Determinística de Segmentos
Para pesquisas com múltiplos grupos/segmentos:
1. As respostas são particionadas por `segmentId`.
2. Áreas com $n < 5$ são progressivamente mescladas pelo algoritmo guloso até atingirem quórum seguro sob a denominação *"Demais áreas (agrupadas)"*.
3. Se restar apenas um agrupamento válido após as fusões, a matriz de segmentos é omitida e o sistema publica unicamente o resultado global consolidado da empresa.

### 3.3 Supressão por Sobreposição Residual
Se um ciclo fechado tiver um conjunto de colaboradores quase idêntico a um ciclo anterior da mesma empresa (diferença estrita $< 5$ membros), a divulgação é suprimida para evitar ataques de inferência estatística por subtração ($Total_B - Total_A = Resposta_{individual}$). O sistema orienta o administrador a aguardar uma alteração de quadro ou a agrupar áreas antes da abertura.

---

## 4. Exportação Regulatória e Aceite Formal NR-1

O serviço `src/services/reportExportService.js` disponibiliza o relatório técnico nos seguintes formatos:

1. **PDF Vetorial (`GET /reports/:id/export?format=pdf`):**
   - Construído com `pdfkit` nativo.
   - Contém cabeçalho formal, sumário executivo, tabela de fatores com classificação de semáforo, matriz de segmentos e notas metodológicas.
   - Inclui rodapé com hash SHA-256 de integridade e disclaimers regulamentares da NR-1 / PGR.
2. **Excel com 7 Abas (`GET /reports/:id/export?format=xlsx`):**
   - Gerado via `exceljs`.
   - Abas: `Resumo`, `Fatores`, `Distribuição`, `Segmento x Fator`, `Participação`, `Comparação` e `Metodologia`.
   - Estilizado com paleta institucional Deep Mulberry (`#581C43`), congelamento de cabeçalho e largura proporcional.
3. **Histórico Consolidado em Excel (`GET /reports/history/export`):**
   - Pasta de trabalho com evolução temporal de todos os ciclos realizados pela organização, facilitando o monitoramento contínuo exigido pelo GRO.
4. **CSV Regulamentar (`GET /reports/:id/export?format=csv`):**
   - Codificação UTF-8 com BOM (`\uFEFF`) e delimitador `;`. Abre diretamente no Microsoft Excel brasileiro sem desformatação de acentos ou números decimais.
5. **JSON Sanitizado (`GET /reports/:id/export?format=json`):**
   - Estrutura completa do relatório com exclusão automática de dados de infraestrutura interna (`memberIds`, hashes de senhas e tokens).

### 4.1 Registro de Aceite Formal
- O aceite formal pelo Engenheiro de Segurança ou Responsável Técnico é registrado via `POST /reports/:id/accept`.
- O registro armazena: `userId`, `userName` / `acceptedBy`, `acceptedAt`, versão do instrumento e declaração explícita de ciência das responsabilidades legais da NR-1.
- O evento é persistido na coleção `reports` e inserido na trilha de auditoria encadeada (`management.json`).

---

## 5. Armazenamento, Segurança e Retenção

### 5.1 Persistência Atômica
- O armazenamento utiliza arquivos JSON em `data/` com escrita atômica via arquivo temporário (`.tmp`) seguido de `fs.renameSync`.
- Diário de transações (`journal.json`): operações atômicas entre coleções utilizam `writeMany`, garantindo recuperação e integridade em caso de falha de energia.
- O processo obtém bloqueio exclusivo de escrita por diretório para prevenir concorrência de múltiplos nós.

### 5.2 Criptografia de Dados Pessoais
- Telefones de colaboradores são criptografados com **AES-256-GCM** antes de serem gravados em disco.
- A chave mestra é derivada de `data/.identity-key` ou injetada em produção via variável de ambiente `EQUILIBRA_DATA_KEY` (32 bytes em base64).
- As respostas dos colaboradores não contêm nenhuma referência a `memberId` ou dados identificadores (coleta anônima e desvinculada).

### 5.3 Política de Retenção e Purga
- Configurável entre 1 e 60 meses pelo painel de Configurações (`/management/retention`).
- A purga remove dados brutos de respostas e convites de pesquisas encerradas cujo período de retenção tenha expirado, **preservando integralmente** os relatórios consolidados, avaliações de risco e planos de ação.



