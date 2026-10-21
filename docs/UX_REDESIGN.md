# Organização da experiência

A navegação principal representa o trabalho diário. Configurações administrativas não competem com análise e acompanhamento.

| Local | Responsabilidade |
|---|---|
| Visão geral | Pendências com acesso direto à investigação, prazos e revisão de eficácia. Ciclos recentes abrem o resultado correspondente. |
| Organização | Pessoas e grupos em abas do mesmo contexto. Acessos da equipe administrativa ficam separados dos participantes. |
| Pesquisas | Configuração e acompanhamento da aplicação. Recorrência fica como função secundária da própria área. Pesquisas encerradas abrem seus resultados. |
| Resultados | Lista de ciclos. Cada ciclo tem Indicadores, Avaliações e Assistente, sem juntar todas as ferramentas em uma página longa. |
| Resultados / Relatórios e histórico | Documentos preservados, impressão, exportação de dossiê e histórico com descrições compreensíveis. |
| Planos de ação | Lista com busca e filtros. Cada ação tem página própria com medida, critério, evidências, origem, histórico e próximo passo. |
| Configurações / Minha conta | Perfil, senha e encerramento da sessão. |
| Configurações / Equipe e acessos | Permissões, convites pendentes, revogação e gestão dos acessos administrativos. |
| Configurações / Plano e cobrança | Plano atual, limites, contratação e histórico da cobrança. |
| Configurações / Privacidade e dados | Política de retenção e remoção explícita dos dados elegíveis. |

## Continuidade das tarefas

- Criar uma ação abre a página da ação criada.
- Iniciar execução e registrar implementação são passos explícitos.
- A verificação de eficácia usa um formulário curto, com resultado e justificativa.
- A origem liga a ação à avaliação e ao ciclo que a fundamenta.
- Comparações e IA permanecem no contexto do ciclo selecionado.
- Os vínculos internos usam rotas por hash; atualizar a página e usar voltar/avançar preserva o destino.
- `#relatorios` redireciona para `#resultados/documentos`; `#assinatura` redireciona para `#configuracoes/plano`.
- Telas não exibem controles administrativos para papéis sem essa permissão. A autorização continua no servidor.
- Consultas assíncronas de configurações e comparação não substituem uma tela diferente após mudança de destino.

## Linguagem e aparência

Identidade verde preservada, com ícones consistentes, painéis, abas, listas e hierarquia de títulos compartilhados. A interface evita nomes internos de eventos, identificadores de conta e instruções de implementação no fluxo normal. Estados vazios explicam como continuar. Controles indisponíveis não simulam IA ou pagamentos configurados.

## Verificação

Syntax check e os dez testes integrados passaram. A revogação de convites tem verificação de isolamento e rejeição do código revogado. Navegador real validou avaliação, criação e abertura da ação, execução, evidência, implementação e eficácia, navegação administrativa, pesquisa por responsável, recorrência com criação/desativação, exportação de dossiê e prévia de relatório. Links antigos e largura de 390 px também foram verificados. Capturas sintéticas estão em `output/playwright/ux-*.png`.

Groq e Mercado Pago reais continuam dependentes das credenciais já documentadas. A reorganização não apresenta essas integrações como ativas.
