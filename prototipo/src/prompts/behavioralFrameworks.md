# 🧠 Fundamentação Teórica, Clínica & Pericial dos Prompts (Equilibra NR-1)

Este documento detalha as bases científicas, clínicas e regulatórias que estruturam a coleta conversacional com o trabalhador e a emissão do laudo pericial oficial para o RH e PGR.

---

## 1. ⚖️ Enquadramento Regulatório & Legal
* **NR-1 / Portaria MTE nº 1.419/2024:** Obrigatoriedade de inclusão dos riscos psicossociais no inventário de riscos do GRO/PGR.
* **NR-17 (Ergonomia):** Investigação de sobrecarga biomecânica, repetitividade e supressão de pausas reais de recuperação fisiológica.
* **ISO 45003:2021:** Gestão da saúde psicológica no trabalho, cobrindo demandas de trabalho, controle/autonomia, suporte social e clareza de papéis.
* **CLT Art. 157 & OIT Convenção 155:** Garantia do dever geral de cautela e ambiente de trabalho livre de retaliações.

---

## 2. 🛡️ Segurança Psicológica & Silenciamento Organizacional (Amy Edmondson)
* **Objetivo:** Remover o viés de autodefesa, a culpa individual e o medo de punição.
* **Aplicação Prática:**
  * O trabalhador nunca é questionado sobre falhas pessoais diretas ("Você usou o EPI?"), mas sobre o posto e a rotina coletiva ("Como é o uso e o conforto dos equipamentos na sua área durante os dias de maior calor?").
  * A IA calcula dinamicamente o `fear_of_retaliation` (1 a 5) e rastreia o silenciamento organizacional decorrente de bônus por "zero acidentes" ou intimidação de liderança.

---

## 3. 🗣️ Escuta Reflexiva OARS & Investigação Clínica por Laddering
* **Escuta Reflexiva (Miller & Rollnick):** O `bot_statement` parafraseia com exatidão a fala do operário, validando a dor ou desafio relatado antes de lançar o próximo estímulo.
* **Laddering & 5 Porquês Adaptados:**
  * *Fato Concreto:* Identificação do evento operacional (ex.: emperramento na linha de montagem).
  * *Consequência Operacional:* Como a equipe se organiza e compensa o atraso (ex.: aceleração do ritmo, pular pausas).
  * *Impacto Psicossocial/Físico:* Esgotamento muscular, estresse mental e atrito com a supervisão.

---

## 4. 📉 Degradação Graciosa de Fricção Cognitiva (Nudge Theory / Daniel Kahneman)
* **Padrão:** Campo dissertativo livre (`text_input`) com suporte a reconhecimento de voz.
* **Gatilho de Degradação:** Respostas monossilábicas ("sim", "não", "normal", "tanto faz") ativam widgets adaptativos (`slider_0_10`, `stars_rating`, `emoji_scale`, `choice_chips`, `binary_cards`).
* **Recuperação:** Após resposta ao widget facilitador, a IA reengaja o diálogo com pergunta aberta.

---

## 5. 📋 Metodologia 5W2H & Hierarquia de Controles de Riscos
* O laudo pericial traduz os achados em intervenções práticas estruturadas:
  * **What (O quê):** Medida de intervenção específica.
  * **Why (Por quê):** Justificativa técnica e legal (NR-1, NR-17, ISO 45003).
  * **Where (Onde) & Who (Quem):** Setor e responsável técnico.
  * **When (Quando):** Prazo determinado (Imediato, 15d, 30d, 45d).
  * **How (Como):** Procedimento operacional.
  * **Hierarquia:** Eliminação $\rightarrow$ Substituição $\rightarrow$ Engenharia $\rightarrow$ Administrativo $\rightarrow$ EPI.
