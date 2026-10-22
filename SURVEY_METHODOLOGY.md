# Metodologia de Pesquisa, Modelos e Proteção de Sigilo — Equilibra

Revisão técnica atualizada em consonância com as exigências da NR-1 / PGR (Gerenciamento de Riscos Ocupacionais).

---

## 1. Catálogo de Modelos Disponíveis

A plataforma oferece **10 modelos de pesquisa** selecionáveis no momento da criação do ciclo:

### 1.1 Nove Modelos Exploratórios Próprios
Roteiros estruturados em escala Likert de 1 a 5 (1 = Percepção muito desfavorável a 5 = Percepção muito favorável):
1. **Organização e Condições de Trabalho (12 afirmações):** Avaliação geral do ambiente, ferramentas, demandas e relações.
2. **Demandas, Ritmo e Carga (6 afirmações):** Ritmo de trabalho, pressão temporal e equilíbrio físico/mental.
3. **Autonomia e Clareza de Papéis (5 afirmações):** Margem de decisão, clareza das metas e responsabilidades.
4. **Liderança, Apoio e Reconhecimento (6 afirmações):** Suporte da gestão imediata, escuta ativa e reconhecimento do esforço.
5. **Respeito, Assédio e Segurança Psicológica (6 afirmações):** Relações interpessoais, respeito à dignidade e liberdade para apontar falhas sem retaliação.
6. **Jornada, Pausas e Recuperação (5 afirmações):** Cumprimento da jornada, previsibilidade de pausas e desconexão fora do expediente.
7. **Mudanças e Comunicação (5 afirmações):** Transparência na transição de processos, tecnologia e comunicação interna.
8. **Pulso das Condições de Trabalho (4 afirmações):** Versão concisa de sondagem periódica rápida.
9. **Acompanhamento das Medidas (5 afirmações):** Monitoramento específico da percepção dos colaboradores sobre a eficácia de planos de ação já implantados.

*Nota:* Os modelos exploratórios próprios são roteiros técnicos de escuta interna voltados à prevenção, sem alegação de padronização psicométrica nacional.

---

### 1.2 Instrumento HSE (Health and Safety Executive — 35 Itens)
Versão integral de 35 itens traduzida e publicada pelo órgão britânico de saúde ocupacional. Utiliza duas escalas de resposta de 5 pontos:
- **Itens 1 a 23:** Escala de frequência (1 = Nunca a 5 = Sempre).
- **Itens 24 a 35:** Escala de concordância (1 = Discordo totalmente a 5 = Concordo totalmente).

#### Inversão Matemática de Itens Negativos
Para garantir que a regra interpretativa seja uniforme (**maior nota = melhor condição de trabalho**), o servidor inverte matematicamente os 12 itens formulados negativamente:

$$\text{Valor Calculado} = 6 - \text{Resposta Original}$$

Itens invertidos: **3, 5, 6, 9, 12, 14, 16, 18, 20, 21, 22 e 34**.

#### Dimensões e Subescalas HSE
A média de cada subescala é calculada individualmente por participante e, posteriormente, consolidada na média coletiva:
- **Demandas:** Itens 3, 6, 9, 12, 16, 18, 20, 22.
- **Controle:** Itens 2, 10, 15, 19, 25, 30.
- **Apoio da Gestão:** Itens 8, 23, 29, 33, 35.
- **Apoio dos Colegas:** Itens 7, 24, 27, 31.
- **Relações:** Itens 5, 14, 21, 34.
- **Papel:** Itens 1, 4, 11, 13, 17.
- **Mudanças:** Itens 26, 28, 32.

---

## 2. Faixas de Referência e Avaliação de Tendência

Para orientar a priorização das intervenções de SST de maneira objetiva e visual, o Equilibra classifica os fatores consolidados em 3 faixas semafóricas:

| Faixa | Intervalo de Média | Semáforo | Interpretação Operacional |
|---|---|:---:|---|
| **Atenção Prioritária** | Média $< 2,80$ | 🔴 Vermelho | Ponto crítico com forte percepção desfavorável. Demanda investigação imediata e planejamento de ação mitigatória no PGR. |
| **Cuidado / Monitoramento** | $2,80 \le \text{Média} < 3,60$ | 🟡 Amarelo | Condição intermediária. Requer acompanhamento periódico e fortalecimento das medidas preventivas existentes. |
| **Adequado / Protetivo** | Média $\ge 3,60$ | 🟢 Verde | Percepção predominantemente favorável. Manter as boas práticas organizacionais e reforçar a cultura de segurança. |

### Avaliação de Tendência Histórica (Deltas)
Ao comparar o ciclo atual com um ciclo anterior compatível (mesmo instrumento e público):
- **Evolução Positiva:** $\Delta > +0,15$ (aumento estatisticamente perceptível de bem-estar).
- **Declínio / Alerta:** $\Delta < -0,15$ (queda significativa na percepção das condições de trabalho).
- **Estável:** $-0,15 \le \Delta \le +0,15$ (flutuações menores dentro da margem de tolerância).

---

## 3. Diretrizes de Proteção de Sigilo e Privacidade

### 3.1 Quórum Mínimo de Divulgação ($N \ge 5$)
Nenhum resultado quantitativo é divulgado para grupos com menos de 5 respondentes. A exigência de 5 respostas é um controle de produto desenhado para evitar constrangimento e garantir a confidencialidade das opiniões expressas.

### 3.2 Partição Determinística de Segmentos
Em pesquisas corporativas com múltiplos departamentos ou áreas:
1. O sistema mapeia o número de respondentes em cada segmento.
2. Segmentos com $n < 5$ são ordenados de forma crescente e fundidos em um grupo rotulado como *"Demais áreas (agrupadas)"*.
3. O processo de mescla continua até que o grupo agrupado alcance $n \ge 5$.
4. Se todos os segmentos precisarem ser agrupados, o sistema suprime a tabela de recortes e exibe unicamente a média corporativa total.

### 3.3 Supressão por Sobreposição Residual de Públicos
Se dois ciclos fechados em períodos próximos possuírem públicos com diferença estrita menor que 5 participantes (ex.: ciclo anterior com 181 pessoas e ciclo atual com 178 pessoas), a divulgação do ciclo mais recente é bloqueada com aviso preventivo. Essa regra neutraliza tentativas de inferência residual por cálculo diferencial ($Total_A - Total_B$).

---

## 4. Integração com a NR-1 e o PGR

O questionário de percepção psicossocial é uma das ferramentas recomendadas para identificação de perigos e fatores de estresse no ambiente corporativo, conforme preconizado no Gerenciamento de Riscos Ocupacionais (GRO) da NR-1.

1. **Abordagem Complementar:** Os resultados devem ser articulados com Análise Ergonômica do Trabalho (AET), inspeções nos postos, diálogo com a CIPA e dados de absenteísmo / saúde ocupacional.
2. **Termo de Responsabilidade Técnica:** O relatório exige o registro formal de aceite pelo responsável técnico (médico do trabalho, engenheiro de segurança ou gestor de SST), reafirmando que as intervenções e o plano de ação são de responsabilidade direta da organização.
