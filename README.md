# Equilibra web

Aplicação local para organizar pesquisas de percepção do trabalho, avaliar achados, acompanhar ações e verificar sua eficácia.

## Rodar

Requer Node.js 20.12 ou superior.

```bash
npm install
npm start
```

Abra `http://localhost:3000`. Para recarga automática do servidor, use `npm run dev`.

## Fluxo

1. Crie uma conta administrativa ou entre em uma conta existente.
2. Cadastre pessoas com nome, telefone e e-mail.
3. Crie grupos selecionando as pessoas cadastradas.
4. Crie uma pesquisa em rascunho com título, modelo selecionável, ciclo, grupos e data de encerramento. Revise as perguntas e limitações antes de criar.
5. Inicie a coleta quando o grupo tiver pelo menos 5 pessoas. Copie o link web compartilhado e distribua por conta própria. Não há envio automático.
6. O formulário funciona no navegador. O link compartilhado limita o total de respostas e bloqueia reenvio no mesmo navegador; não autentica cada trabalhador. Ao fechar o ciclo, o resultado coletivo aparece somente com pelo menos 5 respostas.
7. Consulte **Resultados > Relatórios e histórico**. Cada ciclo encerrado gera um relatório salvo. Resultados coletivos podem ser impressos ou salvos como PDF pelo navegador.

A visão geral mostra o último ciclo publicado. Há dez modelos web: nove roteiros próprios exploratórios com perguntas distintas e a versão portuguesa de 35 itens publicada pelo HSE. Esta versão HSE não é apresentada como validada para o Brasil. Os seis nomes legados preservam o questionário anterior de oito itens. Os resultados não constituem diagnóstico, laudo ou comprovação de conformidade com NR-1. Veja [pesquisas, fontes e metodologia](SURVEY_METHODOLOGY.md), incluindo o catálogo de outros instrumentos e as condições ainda necessárias para habilitá-los.

## Dados e limites

Relatórios ficam em `data/reports.json` como cópias do resultado no fechamento. Mudanças posteriores no nome do grupo não alteram o histórico.

Os dados ficam em arquivos JSON locais na pasta `data/`. Contas têm senha derivada por `scrypt`, sessão em cookie `HttpOnly` e recursos isolados por organização. Telefones são cifrados com AES-GCM. A chave local fica em `data/.identity-key`; faça backup dela junto dos dados ou configure `EQUILIBRA_DATA_KEY` com 32 bytes em base64. Em produção, essa variável é obrigatória. Convites são gravados como hash e respostas não guardam identificador da pessoa. Ainda assim, a persistência local não oferece cofre de identidade isolado, recuperação de convites, backup remoto, MFA, auditoria externa imutável nem garantias para operação real com dados sensíveis. Use apenas dados de teste até concluir essas camadas e validar base legal, retenção e instrumento com os profissionais responsáveis.

Pode-se usar `EQUILIBRA_DATA_DIR` para escolher outro diretório de dados. Execute `npm test` para o teste integrado de isolamento, coleta e publicação.

## Gestão após os resultados

Em **Resultados**, examine o ciclo publicado e registre achados e avaliação. Depois planeje ações com responsável, prazo, evidências e revisão de eficácia. Compare ciclos compatíveis e vincule a remedição. Em **Resultados > Relatórios e histórico**, consulte o histórico e exporte o dossiê JSON com decisões e ações.

O painel Geral apresenta pendências e o último ciclo publicado, sem misturar períodos em uma média. Resultados parciais não são publicados. Ciclos encerrados são arquivados, preservando histórico. Há equipe com três papéis, convites manuais, agendamentos de rascunhos, controle de versões, histórico de alterações, retenção configurável e backups locais diários. O adaptador JSON exige um processo por pasta de dados.

Groq e Mercado Pago possuem adaptadores no servidor. Configure `.env` conforme `.env.example`. Sem credenciais, IA e checkout exibem indisponibilidade. Planos iniciais: Essencial R$149, Popular R$349 e Avançado R$799 mensais. IA começa no Popular. A prévia local não exige pagamento e é identificada na tela Assinatura.

Consulte [plano de implementação](docs/IMPLEMENTATION_PLAN.md), [operação e configuração](docs/OPERATIONS.md) e [validação](docs/VALIDATION.md).

Execute `npm run check` e `npm test`. `npm run qa` serve uma instalação sintética separada para testar a interface. Não existe etapa de build: os arquivos estáticos são servidos diretamente pelo Express.
