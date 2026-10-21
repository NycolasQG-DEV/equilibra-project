# Validação da evolução da plataforma

Revisão de experiência: consulte [organização da experiência](UX_REDESIGN.md) para a navegação atual. Assinatura passou para Configurações; relatórios passaram para Resultados. A jornada de ação foi repetida no navegador após essa reorganização.

Data de referência do trabalho: 20/10/2026, America/Sao_Paulo.

## Verificado

- `npm run check`: verificação de sintaxe de todo JavaScript em fontes, interface, scripts e testes.
- `npm test`: dez testes aprovados. Cobrem cadastro e isolamento, importação, publicação, jornada de avaliação e ações, transições, evidências, eficácia, comparação, remedição, versões concorrentes, equipe, revogação de acesso, limites comerciais, contexto da IA, propostas estruturadas, recuperação, assinatura de webhook, cobrança idempotente e retenção.
- A cobrança usa provedor HTTP simulado nos testes: preço vem do servidor, checkout pendente é reutilizado, contrato autorizado não comprova pagamento, fatura divergente não libera período, repetição não duplica período e cancelamento preserva acesso já pago.
- O adaptador sintético de IA verifica a lista de contexto, revisão humana e rejeição de proposta inválida. Nenhuma chamada a um provedor real foi necessária nos testes.
- A recuperação do diário JSON após interrupção foi verificada. Retenção preserva relatórios e dados de outra organização.
- Proteção de públicos sobrepostos foi verificada, incluindo ausência de distribuições no relatório suprimido.

## Navegador real

Playwright em instalação sintética isolada na porta 3107, com dados temporários e integrações externas desabilitadas:

1. Login administrativo.
2. Registro de achado com avaliação, contexto e decisão.
3. Criação de ação com responsável, prazo e critério de eficácia.
4. Inclusão de evidência.
5. Transições de planejada para execução, implementação e eficácia registrada.
6. Comparação descritiva entre dois ciclos compatíveis.
7. Navegação por menu móvel.
8. Exibição de planos e estados de indisponibilidade das integrações.
9. Geração de convite de equipe, consulta de retenção e abertura da alteração de senha.
10. Ausência de rolagem horizontal nas telas de resultados, ações, assinatura e retenção verificadas em 390 px.

Console da conferência final: zero erros e zero avisos. Fluxo repetido após as correções e reorganização das rotas. Foram corrigidos durante a validação: navegação que renderizava duas vezes e reinicializava seleções, reabertura de ação antes da atualização de estado e visualização transitória da navegação móvel fechada.

Evidências locais estão em `output/playwright/`, incluindo capturas de ações em desktop, resultados e assinatura no celular. Essa pasta contém apenas dados sintéticos e é ignorada no controle de versão. As capturas foram examinadas e o layout ajustado.

O servidor local da porta 3000 foi identificado pela igualdade dos arquivos públicos com este checkout. Os dados receberam nova cópia privada de recuperação antes do reinício. O servidor foi reiniciado para carregar o novo backend.

## Não verificado ou pendente

- Groq real: falta chave privada. Modelo inicial e configuração estão preparados.
- Mercado Pago real: faltam credenciais de teste, segredo de webhook e URL HTTPS pública. Não houve compra, cobrança, envio de cartão ou notificação externa real.
- Coleta por WhatsApp e atribuição segura de respostas a grupos: etapa futura, fora do escopo.
- Questionário validado por especialistas: o instrumento atual continua exploratório.
- Operação com múltiplas réplicas, banco de dados transacional, cofre de identidade separado, MFA e auditoria externa imutável: não foram adicionados.
- Recuperação automática por e-mail e envio de convites/lembretes externos: não há serviço de mensagens configurado; convites são manuais e pendências aparecem na plataforma.
- Restauração integral com chave externa e dados reais: procedimento documentado, ainda exige ensaio operacional. Backup local não protege contra perda do computador.

O projeto não possui compilação TypeScript, lint ou build configurados; não foram apresentados como verificações executadas. Os arquivos web são servidos diretamente pelo Express. Nenhum commit, publicação ou migração destrutiva foi realizado.

## Pesquisas web e catálogo — 20/10/2026

- Dez modelos web com perguntas e instruções distintas: nove exploratórios próprios e HSE português publicado de 35 itens. Outros treze instrumentos/famílias aparecem como referências, sem aplicação habilitada.
- `npm run check` passou. `npm test`: 12 testes passaram, incluindo todos os modelos, snapshots, validação de respostas, HSE com itens invertidos, relatórios preservados e capacidade sob concorrência.
- HSE: agrupamentos conferidos na planilha oficial `analysistool.xls`; inversões conferidas no PDF português. Não houve certificação da implementação pelo HSE nem validação psicométrica no Brasil.
- Playwright em dados sintéticos: catálogo; seleção HSE e prévia dos 35 itens; criação/abertura; preenchimento web no celular; bloqueio de formulário incompleto; envio; fechamento e sete subescalas no resultado. Pulso de quatro itens também selecionado, aberto e respondido, com bloqueio de reenvio após recarga. Sem erros ou avisos no console; sem overflow nos modelos/formulário a 390px.
- A automação foi ajustada para o botão que inclui o sinal +, espera do modal após abertura e expectativa de reenvio. Esta última revelou um marcador local não gravado; corrigido e conferido em novo ciclo sintético. O servidor já impedia reenvio por cookie.
- Sem compra, mensagens externas ou alteração de respostas reais nos testes. Serviço local reiniciado após cópia privada dos arquivos de dados. Fontes, limites de uso e pendências em `SURVEY_METHODOLOGY.md`.
