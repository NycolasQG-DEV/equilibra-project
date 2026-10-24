# Relatório de Validação e Evidências Técnicas — Equilibra MVP

Este documento consolida a bateria de verificações técnicas, cobertura de testes e evidências de validação do **Equilibra Web** após a conclusão das Fases 0 a 7 do plano de evolução para MVP.

---

## 1. Cobertura de Testes Automatizados

O sistema conta com **38 testes unitários e de integração** executados via `npm test`, além de uma **suíte ponta a ponta (E2E)** de 10 passos executada via `npm run e2e`.

Todos os testes rodam em diretórios temporários dinâmicos com isolamento estrito via `EQUILIBRA_DATA_DIR`.

```
> node --test tests/*.test.js

✔ cadastro, isolamento, ciclos, supressão e convite único
✔ template, importação validada e grupo Geral automático
✔ jornada de avaliação, ação, evidência, eficácia, equipe e isolamento
✔ assinatura de webhook: HMAC, divergência e replay expirado
✔ proposta de IA estruturada, sem aprovação ou efeitos automáticos
✔ limites de pessoas, grupos, usuários e IA são aplicados no servidor
✔ públicos quase iguais não publicam médias nem distribuições do recorte
✔ recuperação consome token e invalida todas as sessões
✔ checkout, confirmação autoritativa, idempotência e cancelamento com provedor simulado
✔ retenção preserva relatórios e transação interrompida é recuperada
✔ Fase 1.1: Migração pura e idempotente para o modelo de segmentos
✔ Fase 1.2: Faixas de participação getBand
✔ Fase 1.3: Ciclo de vida da pesquisa (surveyLifecycle) e acompanhamento por segmento
✔ Fase 1.4: Integração HTTP — abertura, distribuição, resposta por convite, prorrogação e privacidade
✔ Fase 2.1: Classificação de faixas de referência e tendências
✔ Fase 2.2: Partição de segmentos e proteção contra inferência residual
✔ Fase 2.3: Partição quando sobra apenas um único bucket (não há matriz)
✔ Fase 2.4: Supressão por respostas abaixo do mínimo com razão clara e acionável
✔ Fase 2.5: Supressão por sobreposição de públicos com outro ciclo fechado
✔ Fase 2.6: Instrumento HSE com subescalas e itens invertidos
✔ Fase 2.7: Comparação de ciclo e cálculo de deltas
✔ Fase 2.8: Pré-visualização de impacto (preflight)
✔ Fase 2.9 (Propriedade de Segurança): Nenhum número de bucket com n < minResults em relatórios publicados
✔ Fase 3: Exportação e Aceite do Relatório
✔ Fase 4.1: todayService - saudação temporal e data em português
✔ Fase 4.1: todayService - fila vazia e estado tudo em dia
✔ Fase 4.1: todayService - detecta relatório pendente de aceite com prioridade alta
✔ Fase 4.1: todayService - detecta relatório publicado sem nenhuma avaliação
✔ Fase 4.1: todayService - detecta pesquisa próxima do encerramento com baixa adesão (< 70%)
✔ Fase 4.1: todayService - detecta ações atrasadas e ações aguardando revisão de eficácia
✔ Fase 4.1: todayService - ordenação estrita por criticidade (high > medium_high > medium)
✔ Fase 4.1: Integração HTTP - GET /api/today autenticado retorna fila e kpis
✔ Fase 5.1: Formatters de domínio e badges acessíveis
✔ Fase 5.2: Classificação e mensagens amigáveis de erros (core/errors.js)
✔ Fase 5.3: Ausência de app.js e zero atributos inline (onclick / style) em public/
✔ Fase 6.1: Conformidade dos tokens de design e fontes locais
✔ HSE: subescalas, itens invertidos, extremos e dados incompletos
✔ modelos web: escolha, snapshot, respostas, publicação e proteção de capacidade concorrente

Total: 38 aprovados / 0 falhas / 0 cancelados
```

---

## 2. Validação da Suíte Ponta a Ponta (E2E)

O script `scripts/e2e.js` valida no mundo real o fluxo completo de uma organização no sistema:

```
> npm run e2e

====================================================
   EQUILIBRA MVP — SUÍTE DE TESTES PONTA A PONTA    
====================================================
Ambiente isolado criado em: Temp/equilibra-e2e-...
[1/10] Autenticando usuária RH / SST...
  ✔ Sessão iniciada para: Nycolas (Gestor RH) (owner)
[2/10] Consultando cockpit Hoje (GET /api/today)...
  ✔ Saudação: "Bom dia, Nycolas.", Fila de decisão: 11 itens pendentes
[3/10] Criando nova pesquisa multi-segmentos...
  ✔ Pesquisa criada com 126 pessoas em 3 áreas
[4/10] Abrindo pesquisa para início da escuta...
  ✔ Status alterado para: open
[5/10] Obtendo links individuais pseudonimizados...
  ✔ Planilha de convites gerada (127 linhas)
[6/10] Respondendo questionários confidenciais por token...
  ✔ 8 questionários respondidos confidencialmente
[7/10] Encerrando pesquisa antecipadamente com justificativa...
  ✔ Pesquisa encerrada: status closed
[8/10] Acessando relatório do ciclo...
  ✔ Relatório publicado: média geral 4.13, 8 respostas
[9/10] Testando exportação nos 4 formatos regulamentares...
  ✔ PDF vetorial gerado: 4471 bytes
  ✔ Planilha Excel (7 abas) gerada: 13380 bytes
  ✔ CSV formatado (UTF-8 BOM + ';') gerado: 946 caracteres
  ✔ JSON sanitizado de auditoria gerado
[10/10] Registrando aceite formal técnico da NR-1...
  ✔ Aceite formal registrado por: Ana Silva - Eng. de Segurança do Trabalho (CREA 12345/SP)

====================================================
   TODOS OS PASSOS E2E FORAM CONCLUÍDOS COM SUCESSO!  
====================================================
```

---

## 3. Conformidade Técnica e de Design

### 3.1 Auditoria Estrita de Frontend (`scripts/check.js`)
- **Zero atributos inline:** Todos os atributos `onclick=`, `style=`, `onload=`, etc., foram rigorosamente erradicados de `public/index.html` e de todos os componentes em `public/js/`.
- O script de verificação analisa arquivos HTML e JS e bloqueia compilações com atributos inline.
- **Fontes Locais Self-Hosted:** Família tipográfica *Plus Jakarta Sans* alocada em `public/vendor/fonts/` com declarações `@font-face` nativas no CSS. Zero dependências de CDNs externas (Google Fonts, etc.), garantindo funcionamento offline e conformidade com privacidade.
- **Paleta Deep Mulberry:** Tokenizada em `--color-primary: #581c43` com suporte integral a temas claro e escuro e razão de contraste WCAG AA validada.

### 3.2 Acessibilidade e Componentes UI
- Navegação declarativa por teclado: modais com captura e retenção de foco (*focus trap*), retorno automático do foco ao botão de disparo no fechamento e fechamento por tecla `Escape`.
- Gráficos em canvas dinâmicos acompanhados de tabelas de dados semânticas acessíveis a leitores de tela.
- Avisos de sistema (*toast*) operando em região acessível `aria-live="polite"`.

---

## 4. Disclaimers Metodológicos e Legais (NR-1 / PGR)

1. **Natureza da Ferramenta:** A plataforma Equilibra é uma ferramenta tecnológica de apoio para estruturação, coleta de percepção e gestão de planos de ação no âmbito do Gerenciamento de Riscos Ocupacionais (GRO) previsto na NR-1.
2. **Não Substituição Profissional:** Os relatórios e pontuações calculados não constituem, sob nenhuma hipótese, laudo técnico pericial, diagnóstico clínico ou psicológico individual, nem atestado isolado de conformidade com normas regulamentadoras.
3. **Responsabilidade Técnica:** A classificação de riscos, a elaboração do inventário do PGR e a definição das medidas de controle permanecem de responsabilidade exclusiva da empresa e de seus profissionais legalmente habilitados (médicos do trabalho, engenheiros de segurança e ergonomistas).
