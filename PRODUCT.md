# Equilibra

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O público principal é a equipe interna de RH/SST de uma empresa. O RH opera a plataforma no cotidiano: organiza pessoas e grupos, configura pesquisas, acompanha respostas, examina resultados e conduz o acompanhamento das medidas. Trabalhadores participam por formulários web. Acessos administrativos, de edição e de consulta existem na implementação atual.

Confirmado pelo usuário em 21/10/2026: a experiência deve priorizar a equipe interna, não uma consultoria operando várias empresas.

## Product Purpose

Organizar a escuta das condições de trabalho e transformar dados coletivos em investigação, decisões, medidas de prevenção e acompanhamento. O produto deve tornar o trabalho do RH compreensível e executável, mantendo contexto entre pesquisa, resultado, avaliação e ação.

## Positioning

Direção confirmada pelo usuário: o RH será o operador, e a IA assumirá o apoio especializado restante, baseada em métodos e algoritmos validados por um responsável. A capacidade desejada combina operação pelo RH e assistência especializada da IA ao longo do processo.

Essa direção é um objetivo do produto, não uma afirmação de que já existe modelo treinado, método integralmente validado ou autonomia técnica comprovada na implementação atual. O escopo exato das decisões automáticas e da confirmação pelo RH permanece aberto.

## Operating Context

- Aplicação web administrativa, utilizada em desktop e também acessível no celular.
- Participação dos trabalhadores pelo navegador, por link de pesquisa. Coleta por WhatsApp ficou fora desta etapa.
- Pessoas podem pertencer a grupos; os ciclos têm público, período, instrumento e encerramento.
- Resultados coletivos orientam o registro de achados e as avaliações. Ações têm responsável, prazo, critério, evidências e revisão de eficácia.
- Histórico, documentos e metodologia precisam acompanhar o processo. A experiência deve explicar o próximo passo e preservar o contexto do ciclo.
- O cenário atual de execução é local. Hospedagem pública, credenciais e confirmação de integrações externas são questões distintas de uma interface funcional.

## Capabilities and Constraints

### Implementado

- Backend Express, frontend HTML/CSS/JavaScript, persistência JSON com fronteiras de repositório e serviços. A manutenção em JSON foi uma decisão explícita desta etapa.
- Pessoas, importação de planilha, grupos, pesquisas web, resultados, comparação compatível, avaliações, planos de ação, evidências, revisão e histórico.
- Catálogo com nove modelos próprios exploratórios e uma versão portuguesa publicada do HSE, além de referências de instrumentos ainda não habilitados.
- Chart.js para gráficos e Font Awesome para ícones, conforme solicitação do usuário.
- Adaptador de IA com Groq configurável e estrutura para substituição futura do provedor. Assistência atual baseada em dados agregados e revisão humana nos fluxos implementados.
- Integração de cobrança Mercado Pago preparada para teste; resultados reais dependem de credenciais e confirmação externa.

### Compromissos que devem ser preservados

- Não chamar roteiros próprios de instrumentos validados. Não apresentar português publicado pelo HSE como prova de validação no Brasil.
- Não apresentar relatório, pesquisa ou IA como comprovação automática de conformidade, laudo ou diagnóstico individual.
- Preservar perguntas, versões, regras de cálculo e resultados históricos durante refatoração visual.
- Distinguir público convidado, respostas recebidas e proteção de publicação. Cinco respostas não demonstram representatividade estatística.
- Não criar depoimentos, comprovações de treinamento, certificações, benchmarks ou resultados comerciais sem evidência.
- Não publicar dados locais, credenciais ou backups no repositório.

### Decisões abertas

- Responsável e protocolo específico de validação dos métodos e algoritmos da futura IA especializada.
- Abrangência da autonomia da IA, decisões que exigem confirmação e responsabilidades de cada participante do processo.
- Métricas de sucesso operacional e resultados de pilotos com equipes reais.
- Habilitação dos demais instrumentos: versão, direitos, pontuação e adequação ao contexto.

## Brand Commitments

Equilibra é o nome do produto. A comunicação do produto é em português brasileiro. O usuário exige clareza, localização coerente das funcionalidades, ausência de redundâncias e funcionamento integrado. A orientação estética futura será definida em etapa própria; o init não fixa uma nova paleta, tipografia ou composição.

## Evidence on Hand

- Código do produto em `src/` e `public/`.
- Suíte de domínio e integração em `tests/`; verificações de interface sintéticas em `output/playwright/`.
- Fontes e limites dos instrumentos em `SURVEY_METHODOLOGY.md`.
- Organização dos fluxos em `docs/UX_REDESIGN.md`; diagnóstico e plano em `docs/UX_AUDIT_PLAN.md`.
- Não foi apresentada evidência de treinamento especializado de IA, certificação do produto ou validade científica dos nove modelos próprios. Testes de software não substituem essas evidências.

## Product Principles

1. Orientar o RH pela tarefa e pelo próximo passo, preservando o contexto do ciclo.
2. Explicar o que é dado, interpretação e decisão; distinguir resultado atual de capacidade planejada.
3. Tratar a IA como parte explícita do processo, com métodos, limites e responsabilidades documentados antes de afirmar validação.
4. Preservar privacidade coletiva, rastreabilidade e integridade dos instrumentos e do histórico.
5. Entregar funcionalidades completas e integradas, com linguagem e comportamentos consistentes.
