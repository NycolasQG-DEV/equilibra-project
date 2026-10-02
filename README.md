# Equilibra — MVP de pesquisas sobre condições de trabalho

Aplicação Next.js para cada empresa pesquisar as condições de trabalho dos seus próprios funcionários, compartilhar convites individuais e examinar resultados agregados. As respostas abertas são classificadas no servidor e descartadas; o gestor recebe apenas contagens. O questionário e os resultados apoiam a avaliação técnica e **não substituem** a AEP, o inventário de riscos ou o plano de ação do PGR.

## Fluxo disponível

1. O gestor cadastra a própria empresa, uma por conta, e escolhe uma pesquisa sob demanda ou uma base de condições de trabalho.
2. A IA pode propor um rascunho. O gestor revisa, adiciona, edita ou exclui perguntas antes de salvar. Há alertas e bloqueio para perguntas que solicitam identificação.
3. O gestor abre uma rodada para um setor e gera convites de uso único. Compartilha os links por web, WhatsApp, SMS ou QR Code. O aplicativo não envia mensagens por conta própria.
4. Cada participante responde sem criar conta. O servidor guarda apenas respostas de escala e a categoria preliminar dos comentários; descarta o texto livre.
5. Após encerrar a rodada, o gestor vê agregados apenas quando houver pelo menos cinco respostas válidas. Células pequenas também são ocultadas. O painel sugere pontos para avaliação da equipe de SST e pode ser impresso ou salvo em PDF pelo navegador.

O caminho principal do gestor é `/admin/painel`, com participação, indicadores, evolução, plano de ação persistente e devolutiva para copiar ou salvar em PDF. A criação de pesquisas fica em `/admin/pesquisas/inteligencia`; a resposta pública usa `/responder/[token]`. Rotas antigas de pesquisa foram preservadas para acesso a dados anteriores, mas não aparecem na navegação principal.

A área de pesquisas separa campanhas da biblioteca. A criação usa três etapas (objetivo, perguntas e revisão), com pré-visualização, reordenação e recuperação do rascunho na mesma aba. Modelos podem ser editados, duplicados e arquivados; campanhas iniciadas preservam suas perguntas originais. Cada campanha configura setor e quantidade próprios. Convites podem ser baixados e continuam disponíveis na mesma sessão do navegador. Há busca por título/setor, filtros de status e acesso direto ao resultado da campanha selecionada.

O painel considera as 30 rodadas mais recentes. Sugestões de medidas e projeções usam perguntas intactas da base de condições de trabalho; perguntas personalizadas não herdam uma classificação de risco. As ações usam a tabela existente `management_actions`, com o identificador da rodada no campo `batch_id`, e exigem autorização do proprietário da rodada. Execução exige evidência e não significa eficácia comprovada.

A projeção experimental exige pelo menos 12 rodadas comparáveis, com intervalos regulares. Uma regressão linear das seis últimas medições é testada em janelas temporais anteriores e só aparece se reduzir o erro médio em pelo menos 10% frente a repetir o último valor. A faixa usa o maior erro histórico; não é um intervalo calibrado nem uma previsão clínica. Sem esses requisitos, o painel mostra apenas resultados observados e o motivo da indisponibilidade.

## Configuração

Requer Node.js 22+, um projeto Supabase com as tabelas de `lib/db/supabase-schema.sql` e `lib/db/product-schema.sql`, e as variáveis de `.env.example`. A chave de serviço do Supabase fica somente no servidor. O acesso por senha da aplicação usa `JWT_SECRET`.

```bash
npm install
cp .env.example .env
npm run dev
```

No Windows PowerShell, use `Copy-Item .env.example .env` no lugar de `cp` se necessário. A aplicação abre em `http://localhost:3000`.

O rascunho com IA usa `GROQ_API_KEY`; sem ela, a aplicação oferece um rascunho base editável. O pagamento de teste usa Checkout Pro do Mercado Pago e só libera o plano após a API retornar um pagamento aprovado.

## Verificação

```bash
npm run typecheck
npm test
npm run build
```

Com o servidor local ativo, `npm run test:integration` exercita o fluxo completo no projeto Supabase configurado. Esse teste cria um usuário e pesquisas temporários, testa o limiar de privacidade e remove os registros ao terminar. Não o execute simultaneamente com manutenção do banco.

## Limites atuais

- A criação de rodadas e o compartilhamento de convites são manuais. Não há provedor de WhatsApp/SMS/e-mail nem executor periódico configurado; por isso o MVP não anuncia disparos ou lembretes automáticos.
- A conta só pode cadastrar sua própria empresa no fluxo atual. A assinatura ainda está vinculada ao usuário administrador no banco; a migração para uma assinatura por empresa e os convites da equipe com permissões estão planejados em `docs/avaliacao-produto-mvp.md`.
- As categorias dos comentários são sinais por palavras-chave, não uma análise clínica ou um classificador de IA validado. O texto original não é armazenado.
- O modelo de perguntas precisa de revisão por profissional de SST antes de apoiar documentos do GRO/PGR. O [MTE esclarece](https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/manuais-e-publicacoes/2026/perguntas-e-respostas-gro-pgr-maio-2026/@@download/file) que questionários, isoladamente, não bastam para a gestão dos riscos ocupacionais.


### Navegação do espaço da empresa

- `/admin/painel`: prioridades, indicadores operacionais e campanhas recentes.
- `/admin/pesquisas/inteligencia`: biblioteca, criação, convites e encerramento das coletas.
- `/admin/resultados`: participação, resultados agregados e evolução comparável.
- `/admin/acoes`: avaliação das sugestões, responsáveis, prazos e evidências de execução.
- `/admin/devolutivas`: revisão e exportação da comunicação para os funcionários.

O painel usa a identidade roxa da página pública, Lenis com carregamento protegido e movimento reduzido conforme a preferência do dispositivo. As previsões continuam condicionadas ao histórico e à validação temporal; a navegação não altera os critérios de privacidade.
