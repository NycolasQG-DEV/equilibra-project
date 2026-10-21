# Operação e configuração

## Iniciar

Node.js 20.12 ou superior. Execute `npm install`, `npm run check`, `npm test` e `npm start`. A aplicação lê `.env` na raiz. Reinicie o servidor após alterar configurações. Arquivos estáticos não exigem uma etapa de build.

`npm run qa` abre uma instalação separada em `http://127.0.0.1:3107`, com dados fictícios em uma pasta temporária. Credenciais exclusivas dessa demonstração: `qa@example.test` / `senha-teste-123`. Esse comando desabilita integrações pagas e não usa a pasta `data/` existente.

## Jornada e estados

Em **Resultados**, selecione um relatório publicado e registre um achado. A avaliação precisa de contexto e decisão antes de ser concluída. Uma avaliação concluída pode originar ações.

A ação começa planejada, passa para execução e depois implementação. A implementação exige evidência. O responsável registra a eficácia depois da data de revisão, com justificativa. Resultado favorável em outra pesquisa é evidência complementar, não prova automática de causalidade. Transições inválidas são rejeitadas pelo servidor. Cada edição exige a versão atual do registro.

Evidências são descrições e referências HTTPS; upload e armazenamento de documentos não foram adicionados. Não insira nomes de trabalhadores ou relatos individuais nesses campos. Dossiês exportados contêm decisões e responsáveis administrativos e precisam de revisão antes de compartilhamento.

## Instrumento e resultados

Os seis nomes de formatos usam o mesmo instrumento exploratório de oito afirmações, versão 1. Não são seis instrumentos validados. O catálogo fica em `src/domain/instruments.js`. Qualquer instrumento futuro precisa de identificação, versão, regras de cálculo e revisão metodológica próprias.

Médias só são disponibilizadas após encerramento e com pelo menos cinco respostas. Esse é um controle do produto. Distribuições com células pequenas são omitidas. Públicos parcialmente sobrepostos com diferenças inferiores a cinco participantes têm nova publicação suprimida. Essa proteção é conservadora e não constitui garantia formal contra toda reidentificação.

Relatórios são snapshots. Registros anteriores sem versão ou composição verificável não recebem comparações automáticas. Dados históricos não são convertidos em dados confiáveis por migração: simulações antigas não podem ser distinguidas retrospectivamente de respostas reais. Não use bases antigas de demonstração em decisões reais.

Esta versão não oferece resultados separados por grupo quando a pesquisa reúne vários grupos: respostas antigas não possuem essa atribuição. Esse ponto depende do desenho futuro da coleta e de sua proteção de identidade. O sistema apresenta honestamente o resultado do conjunto, sem inventar recortes.

## Groq e troca de provedor

1. Gere uma chave na sua conta Groq e preencha `GROQ_API_KEY` no `.env` local.
2. `AI_MODEL=openai/gpt-oss-120b` é a escolha inicial configurável. Confira disponibilidade e limites na sua conta.
3. Mantenha `AI_PROVIDER=groq`. Reinicie o servidor.
4. No plano Popular ou Avançado, selecione um resultado publicado e autorize o envio dos indicadores e da pergunta ao provedor.

O contexto é montado por lista explícita de campos em `assistantService.js`. Não inclui cadastros, contatos, respostas individuais ou textos das avaliações. A pergunta digitada pelo usuário também é transmitida; não inclua dados pessoais. Há limite de tamanho, timeout, uma solicitação simultânea por organização e intervalo mínimo entre consultas. O histórico contém resposta, modelo, provedor e origem. Não existe aprovação automática de decisões.

Novos provedores implementam `generate(messages)` e são registrados em `src/integrations/ai/index.js`; regras de gestão permanecem fora do adaptador. Testes usam um adaptador sintético, sem chamadas externas.

Referências verificadas: [API Groq](https://console.groq.com/docs/api-reference) e [modelos disponíveis](https://console.groq.com/docs/models).

## Planos comerciais iniciais

| Plano | Mensalidade | Pessoas | Grupos personalizados | Usuários | Consultas de IA/mês |
|---|---:|---:|---:|---:|---:|
| Essencial | R$149 | 50 | 3 | 2 | 0 |
| Popular | R$349 | 200 | 12 | 5 | 50 |
| Avançado | R$799 | 600 | 40 | 12 | 200 |

Proposta inicial autorizada pelo usuário, sem validação comercial de margem ou disposição de compra. Todos os planos incluem avaliação, ações, evidências, histórico, comparação e proteção de dados. O grupo automático Geral não consome a cota de grupos personalizados. Uma assinatura corresponde a uma empresa. Consultorias multiempresa exigem evolução posterior da associação entre usuários e organizações; não são anunciadas como disponíveis.

Para substituir o catálogo, configure `BILLING_PLANS_JSON` com um array de objetos contendo `id`, `name`, `amountCents`, `members`, `groups`, `users`, `organizations: 1` e `aiMonthly`. Preços são inteiros em centavos. O checkout ignora preços enviados pelo navegador. A assinatura guarda o contrato de preço e cotas da contratação; alterar o catálogo não altera contratos anteriores.

`BILLING_ENFORCE=false` habilita a prévia local, usando `LOCAL_PLAN=avancado`, e não significa pagamento. Para operar comercialmente, configure `BILLING_ENFORCE=true`: somente período pago confirmado libera alterações. Consulta, exportação, retenção e gerenciamento da assinatura continuam disponíveis. Usuários convidados não podem alterar assinatura. Limites de pessoas, grupos e usuários são verificados no servidor, inclusive na importação.

## Mercado Pago em teste

1. Crie sua aplicação e prepare contas/credenciais de teste conforme as regras de Assinaturas no Mercado Pago. Não use cartões reais nos testes.
2. Preencha `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` e `APP_URL` HTTPS pública, mantendo `MERCADOPAGO_MODE=test`.
3. Configure notificações de assinatura e pagamentos recorrentes para `APP_URL/api/billing/webhook`. A criação de assinatura também envia `notification_url`. Confirme o comportamento de notificações na conta de teste: as opções disponíveis diferem por produto.
4. Escolha um plano na tela Assinatura. O checkout é hospedado pelo Mercado Pago; a plataforma não recebe dados do cartão.
5. Valide criação, retorno, notificação assinada, pagamento aprovado, repetição da notificação e cancelamento. “Sincronizar” consulta o contrato; autorização do contrato sozinha não confirma pagamento.

O webhook confere HMAC SHA-256 com comparação em tempo constante, identificador da URL e janela de cinco minutos. Depois consulta o recurso no provedor. A associação, moeda, preço e recorrência precisam corresponder ao contrato local. O período é liberado apenas para fatura com pagamento aprovado e valor correto. Faturas repetidas não prorrogam acesso novamente. Cancelamento preserva o período já confirmado.

`MERCADOPAGO_MODE` identifica o ambiente esperado, mas não transforma credenciais de produção em credenciais de teste. A escolha das contas e credenciais corretas é indispensável. Não foi realizada compra real, webhook externo ou teste com cartão do provedor nesta entrega.

Referências verificadas: [criar assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/create-preapproval/post) e [webhooks](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks).

## Equipe e recuperação

Administrador: cadastros, equipe e assinatura. RH/SST: pesquisas, avaliações e ações. Consulta: resultados, histórico e ações, sem mutações de gestão. Contas existentes são interpretadas como administradoras de sua própria organização, sem reescrita automática de dados antigos.

Convites possuem e-mail, papel, validade de sete dias e token armazenado como hash. O token é exibido uma vez para compartilhamento manual por canal seguro. O convidado cria conta com o e-mail convidado e o código. Não existe envio automático de e-mail nesta etapa.

Alteração de senha invalida sessões. Para recuperação assistida, pare o servidor e execute `npm run recover -- email@empresa.com.br`. O operador recebe um código de uso único válido por 30 minutos. Entregue-o pelo canal seguro acordado e use “Recuperar acesso com código” na tela de entrada. Não há recuperação automática por e-mail sem integração de envio.

## JSON, backups e retenção

O adaptador JSON suporta **um processo escritor por pasta de dados**. O servidor usa bloqueio por processo para impedir outra instância na mesma pasta. Não execute múltiplos workers, réplicas ou operadores de recuperação simultaneamente. Para isso, substitua o adaptador por banco transacional.

Gravações usam arquivos temporários, renomeação e um diário de transação. Uma transação registrada e interrompida é completada na próxima inicialização/leitura. Operações com várias coleções devem usar `writeMany`. Essa estratégia não substitui garantias de banco transacional, redundância de disco ou backup externo.

A primeira gravação do dia cria snapshot local completo em `data/backups/AAAA-MM-DD/`, com marcador `.complete`. O snapshot inclui a chave `.identity-key` se existente; quando `EQUILIBRA_DATA_KEY` vem do ambiente, preserve essa chave separadamente. Backups locais e `.local-backups/` são privados e não devem ser enviados como arquivos de código. Não há expurgo automático dessas cópias nem backup remoto.

Para restaurar: pare o servidor, preserve uma cópia da instalação atual, escolha um snapshot completo, confira chave e arquivos, e restaure em **outra pasta**. Inicie com `EQUILIBRA_DATA_DIR` apontando para essa pasta e valide o login e os dados antes de substituir qualquer instalação. A recuperação do diário foi testada; restauração integral com dados reais e chave externa ainda precisa de ensaio operacional.

Em Configurações > Dados e retenção, o administrador define entre 1 e 60 meses ou desativa com 0. Uma prévia informa respostas e convites elegíveis de ciclos encerrados com relatório salvo. A purga exige confirmação explícita e preserva relatórios, avaliações e ações. Backups anteriores mantêm política própria e podem conter dados removidos da base operacional.

Histórico de gestão inclui autor, horário, estado anterior e posterior de avaliações/ações e encadeamento de hashes. É um histórico local rastreável, **não um registro imutável** contra administradores com acesso ao disco. MFA, verificação de e-mail, cofre de identidade separado e auditoria externa resistente a adulteração permanecem fora desta versão.
