# Especificação Metodológica e Regulatória NR-1 (GRO/PGR) & NR-17 (AEP/AET)

**Plataforma:** Equilibra — Gestão Integrada de Riscos Psicossociais no Trabalho  
**Versão:** 1.0  
**Data:** Novembro de 2026  
**Enquadramento Legal:** Capítulo 1.5 da NR-1 (em vigor desde 26/05/2026), NR-17 e Guia de Fatores de Riscos Psicossociais do MTE (2025/2026).

---

## 1. Princípios Fundamentais e Enquadramento

### 1.1 Posicionamento da Plataforma
O Equilibra atua como uma ferramenta tecnológica de apoio operacional ao Serviço Especializado em Segurança e Medicina do Trabalho (SESMT), ao setor de Recursos Humanos e à equipe técnica da organização. O sistema executa o trabalho pesado de organizar dados, apontar sinais, estruturar investigações, sugerir hipóteses de intervenção organizacional e monitorar prazos e eficácia.

> [!IMPORTANT]
> **Regra de Ouro Regulamentar:** O Equilibra não emite laudos periciais automáticos, certificados de conformidade nem substitui o julgamento de profissionais tecnicamente competentes (médicos do trabalho, engenheiros de segurança, ergonomistas ou psicólogos organizacionais) designados pela organização.

### 1.2 Papel dos Questionários de Percepção
Conforme expressamente consignado no documento de Perguntas e Respostas sobre o Capítulo 1.5 da NR-1 do Ministério do Trabalho e Emprego (MTE):
- O questionário **não é obrigatório** nem é o instrumento oficial único preconizado pela legislação.
- Um questionário isolado **não constitui diagnóstico conclusivo** e é insuficiente, por si só, para comprovar a gestão dos riscos psicossociais.
- O questionário é uma ferramenta de triagem e escuta inicial para captação de sinais e percepções subjetivas, devendo ser articulado com a análise das condições concretas da atividade real.

---

## 2. A Separação em Quatro Camadas da Gestão

Para garantir transparência, defensabilidade jurídica e auditoria técnica no inventário do PGR, toda informação processada na plataforma pertence estritamente a uma das quatro camadas:

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. DADO OBSERVADO (Evidência Coletada)                         │
│    Respostas de escuta, observações de posto, dados de jornada  │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. INTERPRETAÇÃO DESCRITIVA ("Leitura do Equilibra")            │
│    Médias de fatores, desvios e deltas descritivos transparentes│
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. HIPÓTESE DE INVESTIGAÇÃO                                     │
│    Possíveis causas organizacionais a apurar in loco (sem nexo) │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. DECISÃO TÉCNICA / ORGANIZACIONAL                             │
│    Classificação de risco e medida validada por responsável SST │
└─────────────────────────────────────────────────────────────────┘
```

1. **Dado Observado:** Fatos e registros empíricos brutos coletados sob garantias éticas e de privacidade (amostras de questionários, atas de oficinas, registros de jornada e indicadores operacionais agregados).
2. **Interpretação Descritiva:** Padrões matemáticos descritivos calculados pelo motor determinístico da plataforma (médias por dimensão, distribuição de frequências, taxas de adesão por grupo).
3. **Hipótese de Investigação:** Perguntas e pistas operacionais propostas pelo sistema para direcionar a investigação da liderança e do SESMT na atividade real. Jamais declarada como causa comprovada, culpa individual ou nexo causal unilateral.
4. **Decisão Técnica e Organizacional:** Julgamento valorativo e aprovação de medidas de controle registrados formalmente por responsável técnico competente devidamente identificado (com atribuição legal, registro profissional e justificativa técnica).

---

## 3. Matriz de Requisitos Regulamentares no Sistema

A plataforma estrutura os registros do inventário de riscos psicossociais alinhados aos requisitos do subitem 1.5.7.3.2 da NR-1:

| Campo Exigido (NR-1) | Implementação no Equilibra | Descrição e Validação Técnica |
|---|---|---|
| **Processo, ambiente e atividade** | Cadastro Organizacional | Estabelecimentos, unidades, processos produtivos, turnos, jornadas e descrição do trabalho real. |
| **Perigo ou fator de risco** | Fator Psicossocial (Catálogo) | Dimensão psicossocial (ex.: sobrecarga quantitativa, pressão de prazos, baixa clareza de papéis, conflitos). |
| **Fonte ou circunstância geradora** | Achado de Investigação | Elemento da organização do trabalho gerador da exposição (ex.: subdimensionamento de quadro, ausência de pausas). |
| **Grupo de trabalhadores expostos** | Segmento / Área de Trabalho | População trabalhadora exposta ao perigo com agregação protegida ($N \ge 5$). |
| **Possíveis agravos à saúde** | Mapeamento no Catálogo | Possíveis danos físicos ou psíquicos decorrentes da exposição crônica (ex.: estresse ocupacional, fadiga, esgotamento). |
| **Medidas de prevenção existentes** | Levantamento Preliminar | Controles e práticas organizacionais já vigentes no posto ou setor avaliado. |
| **Caracterização da exposição** | Investigação Contextual | Intensidade, frequência, duração e previsibilidade da exposição na rotina de trabalho. |
| **Critérios e classificação de risco** | Matriz Severidade $\times$ Probabilidade | Classificação de risco em matriz formal aprovada pelo responsável técnico (Inerente e Residual). |
| **Plano de ação e acompanhamento** | Kanban de Ações (5W2H) | Ações preventivas com responsáveis, prazos, recursos, evidências de implantação e aferição de eficácia. |

---

## 4. Articulação com a NR-17: AEP e AET

A gestão ergonômica e psicossocial das condições de trabalho obedece à hierarquia estabelecida pela NR-17:

1. **Avaliação Ergonômica Preliminar (AEP):**
   - Aplicável a todas as organizações, servindo como etapa inicial de triagem dos perigos ergonômicos e psicossociais.
   - O Equilibra apoia a AEP fornecendo o levantamento sistemático de sinais, percepções e mapeamento das jornadas.
2. **Análise Ergonômica do Trabalho (AET):**
   - Indicada nas situações em que a AEP apontar complexidade, inconsistências nas causas geradoras, necessidade de estudo aprofundado dos postos ou reavaliação pós-intervenção inconclusiva.
   - O sistema gera o dossiê de evidências e histórico para subsidiar o ergonomista responsável pela condução da AET.

---

## 5. Matriz de Classificação de Risco (Severidade $\times$ Probabilidade)

A determinação do nível de risco ocupacional não decorre de médias de questionário, mas da ponderação explícita entre a severidade potencial do agravo e a probabilidade de ocorrência:

### 5.1 Critérios de Severidade
- **Leve (1):** Incômodo transitório, desconforto passageiro ou tensão temporária sem afastamento ou impacto na saúde funcional.
- **Moderada (2):** Estresse contínuo, fadiga prolongada, queixas recorrentes de sobrecarga com impacto perceptível no clima e na eficiência operacional.
- **Grave (3):** Esgotamento crônico, sintomas incapacitantes, episódios de assédio, necessidade de acompanhamento em saúde ocupacional ou risco de afastamento temporário.
- **Crítica (4):** Agravo grave ou incapacitante à integridade física/psíquica do trabalhador ou comprometimento crônico e sistêmico do coletivo de trabalho.

### 5.2 Critérios de Probabilidade
- **Baixa (1):** Exposição eventual ou esporádica; controles organizacionais consolidados e eficazes.
- **Média (2):** Exposição habitual com controles parciais; oscilações sazonais de pressão ou apoio inconsistente.
- **Alta (3):** Exposição frequente ou prolongada; ausência de controles formais ou sobrecarga operacional constante.
- **Muito Alta (4):** Exposição contínua ou diária; ritmo acelerado sem pausas, ausência total de suporte e conflitos crônicos.

### 5.3 Nível de Risco Resultante
| Severidade \ Probabilidade | Baixa (1) | Média (2) | Alta (3) | Muito Alta (4) |
|:---|:---:|:---:|:---:|:---:|
| **Leve (1)** | Trivial (1) | Baixo (2) | Baixo (3) | Médio (4) |
| **Moderada (2)** | Baixo (2) | Médio (4) | Médio (6) | Alto (8) |
| **Grave (3)** | Médio (3) | Médio (6) | Alto (9) | Crítico (12) |
| **Crítica (4)** | Médio (4) | Alto (8) | Crítico (12) | Crítico (16) |

---

## 6. Governança e Ciclo de Eficácia Contínua

1. **Revisão Bienal Obrigatória:** O inventário de riscos e a avaliação de eficácia das medidas preventivas devem ser revisados no mínimo a cada dois anos, conforme preconizado pela NR-1.
2. **Gatilhos de Reavaliação Imediata:** A revisão do processo deve ser antecipada quando ocorrerem:
   - Implementação de novas tecnologias, processos produtivos ou reestruturações organizacionais relevantes.
   - Constatação de ineficácia nas medidas preventivas implementadas.
   - Mudanças significativas na legislação trabalhista ou sanitária aplicável.
   - Registros de acidentes, agravos à saúde psíquica ou denúncias fundamentadas de assédio.
3. **Distinção entre Implantação e Eficácia:**
   - **Ação Implementada:** Evidência documental de que a medida de controle foi executada no prazo pactuado (ex.: treinamento ministrado, revisão de escala publicada).
   - **Ação Eficaz:** Comprovação técnica e coletiva de que a intervenção efetivamente reduziu ou controlou a exposição ao perigo e melhorou as condições de trabalho na aferição seguinte.

---

## 7. Glossário Unificado de Termos do Produto

- **Sinal:** Indicador quantitativo ou qualitativo que sugere a presença de uma condição desfavorável no trabalho.
- **Fator Psicossocial:** Aspecto da concepção, organização e gestão do trabalho, e de seus contextos sociais e ambientais, com potencial de causar dano.
- **Perigo:** Fonte com o potencial de causar lesões ou agravos à saúde do trabalhador.
- **Exposição:** Contato ou submissão do trabalhador ao perigo no tempo e no espaço da atividade real.
- **Risco Ocupacional:** Combinação da probabilidade de ocorrência de lesão ou agravo à saúde decorrente da exposição ao perigo com a severidade dessa lesão ou agravo.
- **Hipótese:** Possível explicação para a gênese do sinal que demanda verificação in loco.
- **Medida de Prevenção:** Intervenção prioritariamente organizacional e coletiva voltada a eliminar ou controlar a fonte do risco.
- **Plano de Ação:** Instrumento estruturado com responsáveis, prazos, recursos e critérios para execução das medidas.
- **Eficácia:** Demonstração verificável de que a intervenção adotada controlou a exposição ao perigo.
- **Conformidade:** Processo rastreável e documentado da organização em observância contínua aos ditames das Normas Regulamentadoras.
