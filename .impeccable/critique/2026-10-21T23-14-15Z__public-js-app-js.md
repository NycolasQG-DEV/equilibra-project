---
target: "Equilibra: design, organização e plano de melhoria"
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\Users\\Nycolas\\Desktop\\data (2)\\public\\js\\app.js"
target_fingerprint: "sha256:461cc6e07c69f2313ac9581cd3ae04c7d220a7bd98fd1c80904fde92a2a14fd6"
target_path: "C:\\Users\\Nycolas\\Desktop\\data (2)\\public\\js\\app.js"
timestamp: 2026-10-21T23-14-15Z
slug: public-js-app-js
---
# Análise e plano de melhoria da experiência Equilibra

Data: 21/10/2026. Alvo principal: `public/js/app.js`, com as telas e estilos associados. Método: duas avaliações independentes; A revisou experiência e hierarquia sem detector, B revisou implementação e evidências técnicas. Este documento é planejamento, não registro de correções aplicadas.

## Conclusão

A navegação principal e a linguagem RH/SST já dão identidade ao produto. A fragilidade está na continuidade das tarefas e na implementação por camadas: o usuário encontra dados e ferramentas, mas ainda precisa interpretar sozinho qual decisão tomar e qual caminho seguir. A prioridade é tornar a rotina orientada a decisões, com uma base única de componentes acessíveis.

Preservar: cinco destinos principais, administração em Configurações, resultados coletivos, avaliação humana, fontes e limitações, histórico dos ciclos e vínculo das ações à origem. Preservar Chart.js, Font Awesome, regras do servidor e fronteira de persistência JSON. A migração de framework ou banco não é pré-requisito deste plano.

## Diagnóstico heurístico

Avaliação A: 27/40. Notas são julgamento especializado sobre a amostra, não métricas de usuários ou certificação.

| Heurística | Nota /4 | Evidência ou lacuna |
|---|---:|---|
| Visibilidade do estado | 3 | Estados e etapas presentes; recuperação de carregamento precisa melhorar |
| Correspondência com o trabalho real | 3 | Vocabulário específico, mas mensagem de quórum induz interpretação inadequada |
| Controle e liberdade | 3 | Voltar e cancelar existem; restauração do foco precisa correção |
| Consistência | 3 | Navegação coesa; composição e padrões de interação variam |
| Prevenção de erros | 3 | Há validação e revisão; público mínimo não equivale a suficiência estatística |
| Reconhecimento | 2 | Dez modelos exigem comparação e memória do contexto |
| Eficiência | 2 | Excel e filtros ajudam; seleção e continuidade ainda exigem percurso |
| Minimalismo | 3 | Visual calmo; indicadores duplicados e páginas móveis longas |
| Recuperação de erros | 2 | Toasts e dependências globais dificultam recuperação contextual |
| Ajuda e documentação | 3 | Fontes e limitações presentes; falta orientação de escolha |

## Auditoria técnica B

12/20: acessibilidade 2/4, performance 3/4, responsividade 3/4, preparação do tema 1/4 e integridade 3/4. São notas da amostra, sem certificação ou medição completa de performance. Ausência de modo escuro não foi tratada como defeito.

A rodada B confirmou no navegador: ArrowDown não permite operar o filtro de grupos; fechar modal devolve foco ao BODY; um erro 500 injetado em `/api/management/workspace` durante reload resulta em `#login` sem explicação, mesmo com sessão do servidor válida; sem a interceptação, outro reload retorna à área autenticada. Em 390px, abrir o dropdown expande a largura do documento para 398px. O botão Editar mediu aproximadamente 43,14 × 26px.

## Cinco prioridades

### 1. P1 — Seleção de público acessível e linguagem precisa

Em `public/js/app.js:928-933`, as caixas de seleção de grupo não têm nome acessível ligado ao texto do grupo. O contêiner clicável é uma div. Em `:942-950`, “Quórum estatístico suficiente” depende da quantidade de convidados, antes de existirem respostas.

Substituir por seleção semântica com label, descrição de quantidade e preservação de foco. Usar “Público mínimo configurado”. Mostrar separadamente convidados, respostas e condição de publicação. A regra de cinco respostas é proteção de divulgação, não garantia estatística.

Aceite: todos os grupos podem ser selecionados e identificados por teclado; leitor de acessibilidade encontra nome e descrição; nenhuma mensagem sugere representatividade pelo número de convidados.

### 2. P1 — Recuperação, teclado e legibilidade como padrões

O filtro de grupo usa opções div sem operação completa por teclado (`app.js:102-129`, `:1751-1797`). O modal contém Tab, mas a remoção não restaura foco ao acionador (`:490-503`). Textos funcionais apresentam contraste baixo nas amostras medidas por B; cabeçalhos de tabela em torno de 2,4:1. `load()` agrupa sete endpoints, e o catch inicial trata qualquer falha como saída da conta (`:47-56`, `:1897-1913`).

Criar uma base de campos, seleção, diálogo e feedback: select nativo onde suficiente; foco inicial e retorno padronizados; erros persistentes próximos ao campo; distinção entre sessão inválida, erro de servidor e falha de conexão. Carregamento por seção com repetir operação sem apagar autenticação válida.

Aceite: testes de teclado e retorno de foco; contraste aferido nos estados úteis; falha de endpoint secundário permite recuperação sem novo login; entradas preenchidas são preservadas em erros recuperáveis. Alvos de 44px são meta de conforto de toque, não afirmação automática de violação normativa quando menores.

### 3. P1 — Escolha de pesquisa orientada ao objetivo

A etapa 2 apresenta dez modelos simultâneos, sem orientar a decisão pelo objetivo. Na captura A, a página móvel alcançou aproximadamente 2.599px. Os selos têm até 9px (`app.js:980`).

Reorganizar o percurso: objetivo da escuta, opções compatíveis, detalhes e revisão. Separar modelos próprios exploratórios do HSE publicado. Mostrar um resumo persistente de público, período e modelo. Manter “Ver todos os modelos”; não recomendar instrumento por suposta validade que a plataforma não demonstrou. Não inventar duração estimada.

Transformar o catálogo e a metodologia em um espaço consultável da área Pesquisas, com links diretos, deixando modais para tarefas curtas e confirmações. Preservar a redação, ordem e pontuação dos instrumentos; mudanças de apresentação não podem alterar a metodologia silenciosamente.

Aceite: escolha comum não exige ler dez cards; o usuário distingue modelos próprios e instrumento publicado antes de confirmar; contexto da etapa anterior permanece visível.

### 4. P2 — Visão geral e resultados que encaminham decisões

`Experience.overview()` retorna vazio quando não há avaliações ou ações (`experience.js:64-66`), inclusive quando já há resultados publicados a examinar. O painel principal repete fatores no gráfico e na lista, estendendo a página (`app.js:188-200`). O gráfico passou a ser um terceiro filho em um painel originalmente com duas colunas, deixando a lista em outra linha e área vazia na captura desktop.

Criar um resumo operacional permanente, com contexto real: ciclos publicados sem avaliação registrada, coleta em andamento, ações vencidas e revisão de eficácia. Isso deve sinalizar trabalho pendente, sem supor que ciclo foi tecnicamente analisado só por ter algum registro. Dar um próximo passo principal e acesso ao contexto do ciclo.

Separar dados, interpretação e encaminhamento. Integrar gráfico e valores em composição única, com alternativa textual acessível sem repetição extensa. Na comparação, mostrar primeiro o resumo descritivo e a referência, depois os detalhes. Filtrar ciclos compatíveis antes de oferecer comparação, em vez de depender só da rejeição após o envio (`experience.js:210-219`).

Aceite: mesmo sem ações, resultado publicado tem encaminhamento explícito; instrumentação, período e público aparecem no contexto; valores numéricos continuam acessíveis sem depender do canvas.

### 5. P2 — Refatoração da base visual e da organização do frontend

O frontend reúne estado global, API, roteamento, formulários, renderização e eventos em `app.js`, com 1.924 linhas, 113 atributos style e 17 eventos inline. Outras telas ficam em `experience.js` e `management.js`, com dependências globais mútuas. As três folhas CSS somam cerca de 84KB e sobrepõem padrões. `styles.css` contém 330 literais hexadecimais distintos — evidência de dispersão, não 330 cores necessárias ao produto.

Centralizar tokens semânticos, escala tipográfica, espaçamento, estados e componentes. Definir uma fonte de verdade por comportamento. Refatorar por fatias funcionais, substituindo código antigo à medida que cada tela é migrada. Evitar criar outra camada permanente de overrides.

Aceite: novas telas não dependem da ordem implícita de três scripts globais nem de patches no final do CSS; formulários reutilizam a mesma validação visual e semântica; componentes antigos equivalentes são retirados no mesmo passo de migração.

## Carga cognitiva, pessoas e jornada

A carga principal está na comparação entre dez modelos e na necessidade de manter público, objetivo e período na memória. Oito fatores não são excesso por si: o problema é sua apresentação duplicada e o encaminhamento tardio.

- Alex, operador frequente: importação e busca existentes ajudam, mas o catálogo e a retomada de contexto dificultam tarefas recorrentes. A busca de pessoas existe em `app.js:281`; não foi classificada como ausente.
- Jordan, primeiro uso: precisa compreender primeiro a finalidade, depois o instrumento, e depois o que fazer com o resultado. “Quórum estatístico” oferece segurança inadequada.
- Sam, usuário de teclado/baixa visão: encontra grupos sem nome acessível, filtro sem operação completa e textos funcionais de baixo contraste.

A entrada é calma e coerente. O esforço cresce na seleção metodológica. Resultados recuperam confiança pelas limitações explícitas, mas exigem nova tradução entre indicador, achado, avaliação e ação. A proposta é manter contexto e orientar a decisão ao longo dessa sequência.

## Estrutura proposta

```text
public/js/
  app.js                  # inicialização e composição
  core/
    api.js                # transporte, erros e sessão
    router.js             # rotas e transições
    store.js              # estado e seletores explícitos
  ui/
    shell.js
    dialog.js
    feedback.js
    fields.js
    table.js
    chart.js
  features/
    organization/
    surveys/
    results/
    actions/
    settings/
  domain/
    labels.js
    formatters.js

public/css/
  tokens.css
  base.css
  components.css
  layouts.css
```

É uma direção de responsabilidades, não obrigação de criar um arquivo para cada função. ES Modules permitem esta separação na stack atual. A escolha de outro framework exige justificativa própria. Regras de autorização, cálculo, publicação e transição continuam no servidor; o cliente apresenta estados e possibilidades retornados por ele.

## Plano de execução e dependências

| Etapa | Entrega | Aceite para avançar |
|---|---|---|
| 0. Contexto | PRODUCT.md confirmado no init; mapa de tarefas, papéis e estados | Usuário e objetivo principal confirmados; decisões abertas identificadas |
| 1. Correções críticas | Público, quórum, teclado, contraste, foco e falhas de carregamento | Jornada crítica executável por teclado e recuperação sem perda de contexto |
| 2. Fundação | Tokens, componentes e contratos de estado/rotas | Uma tela piloto usa a base sem CSS duplicado; componente testa seus estados |
| 3. Piloto | Jornada de criação de pesquisa e seleção do modelo | Público, objetivo, modelo e revisão claros em desktop e celular |
| 4. Resultado e decisão | Visão geral, contexto do ciclo, comparação e entrada de achados | Cada estado tem próximo passo compreensível e números acessíveis |
| 5. Execução e administração | Ações/evidências/eficácia, Organização e Configurações | Fluxos longos têm páginas próprias; modais permanecem curtos; permissões preservadas |
| 6. Consolidação | Remoção de componentes e estilos substituídos; testes e documentação | Uma implementação por comportamento; regressões críticas cobertas |

A sequência corresponde a endurecimento funcional (`$impeccable harden`), adaptação (`$impeccable adapt`), extração da base (`$impeccable extract`), simplificação da escolha (`$impeccable distill` / `$impeccable clarify`), revisão dirigida (`$impeccable audit`) e acabamento (`$impeccable polish`). Os comandos podem ser executados por etapa ou em conjunto; dependências e regras de negócio permanecem os critérios para avançar.

Em cada fatia: documentar antes/depois e estados; implementar por completo; avaliar desktop e mobile numa rodada agrupada; corrigir os achados em lote e confirmar uma vez. Sem polimento indefinido.

## Validação planejada

- Manter a suíte existente de domínio e integração. Ela não comprova qualidade de UI.
- Testar teclado, nomes acessíveis, foco e mensagens persistentes.
- Testar criação, interrupção, retorno, envio inválido e falha de rede/servidor.
- Conferir 390px, tablet e desktop; zoom 200% e texto ampliado.
- Conferir primeiro uso, base vazia, ciclos publicados sem avaliações, dados protegidos, ação atrasada e revisão pendente.
- Conferir os três papéis e acesso direto por URL.
- Usar volume sintético coerente com os planos, sem alegar teste de carga que não ocorreu.
- Validar preservação dos instrumentos, respostas históricas, cálculo e regras de privacidade durante refatoração.

## Limites e triagem

O detector estático B encontrou nove avisos: cinco de transição de width e quatro de estilo. A preferência estética por outra fonte e a borda de uma nota não são defeitos comprovados. A ocorrência em Font Awesome é biblioteca gerada, não falha de uso. Não se deve alterar a marca ou bibliotecas apenas para zerar o detector. O log runtime de B forneceu evidência de contraste e texto pequeno; a contagem de mensagens não equivale ao número de problemas distintos.

A revisão usa dados sintéticos e inspeção especializada, não entrevistas ou teste de usabilidade com clientes. Não houve certificação WCAG, teste completo com leitor de tela, medição Lighthouse/INP/LCP ou validação científica. A operação completa de ações não foi exercitada por A nesta rodada. Avaliação B detalhada fica em `output/impeccable-b-report.md`; capturas A/B ficam em `output/playwright/` e não contêm os dados reais da instalação.

## Perguntas de produto que precisam de confirmação

1. A navegação e as listas devem priorizar equipe interna de RH/SST ou uma consultoria que opera várias empresas? Isso define o contexto permanente e a escala de organização.
2. Quem escolhe e interpreta o instrumento: RH com revisão técnica, responsável técnico conduzindo, ou processo ainda indefinido? Isso define orientação e encaminhamentos.
3. Para futuras telas, construir diretamente em código ou estabelecer uma imagem de referência antes? É uma preferência de fluxo de trabalho, não uma decisão visual do init.

## Pendências do init e hooks

O init foi invocado durante a análise. As perguntas foram enviadas para confirmar operador principal, participação técnica e forma de iniciar futuras telas. PRODUCT.md só deve ser escrito depois de resposta real. O modo de construção pertence à configuração do Impeccable, não ao registro do produto.

Hooks: configuração habilitada e manifests locais do Codex registrados pela instalação do Impeccable. A aprovação inicial do Codex precisa ser feita pelo usuário em `/hooks`. Não há comprovação do disparo automático nesta sessão. Nenhum ignore de regra foi criado. Configuração local, cache e estado do live ficam ignorados pelo Git. Não houve commit ou push desta revisão/configuração.
