# ESPECIFICAÇÃO DE PRIVACIDADE, LGPD E SEGURANÇA OPERACIONAL
## Plataforma Equilibra SaaS — Gestão de Riscos Psicossociais (NR-1 / NR-17)
**Versão:** 1.0.0 — Fase 10  
**Data de Emissão:** Novembro/2026  
**Enquadramento Legal:** Lei Geral de Proteção de Dados (Lei Federal nº 13.709/2018), NR-1 (GRO/PGR) e NR-17 (Ergonomia)

---

### 1. Papéis de Tratamento de Dados (Art. 5º da LGPD)
* **Controlador dos Dados:** A empresa contratante (empregadora/cliente), responsável pela gestão ocupacional e pela tomada de decisão técnica.
* **Operador dos Dados:** A plataforma **Equilibra**, que atua estritamente segundo as instruções do Controlador e as finalidades estabelecidas neste instrumento.
* **Titulares dos Dados:** Os trabalhadores e colaboradores que participam das pesquisas de escuta e das avaliações ergonômicas.

---

### 2. Bases Legais de Tratamento (Art. 7º da LGPD)
1. **Cumprimento de Obrigação Legal e Regulatória (Art. 7º, II):**
   * NR-1 (Portaria MTP 4.219/2022) — Levantamento e gerenciamento obrigatório de riscos ocupacionais, incluindo fatores psicossociais.
   * NR-17 (Portaria MTP 423/2021) — Avaliação ergonômica da organização do trabalho.
   * Lei Federal nº 14.457/2022 — Obrigatoriedade de canal de denúncia e acolhimento sobre assédio.
2. **Execução de Contrato e Procedimentos Preliminares (Art. 7º, V):**
   * Prestação dos serviços SaaS de coleta e consolidação analítica contratados pelo empregador.

---

### 3. Princípios Operacionais de Privacidade

| Princípio LGPD | Implementação Técnica no Equilibra |
| :--- | :--- |
| **Finalidade** | Coleta restrita a indicadores ergonômicos e psicossociais coletivos; proibido uso para avaliação de desempenho individual ou punição. |
| **Necessidade (Minimização)** | Nenhuma resposta individual é vinculada a dados de identificação pessoal (PII) nos relatórios publicados. |
| **Segurança e Sigilo** | **Regra do Quórum Mínimo (K-Anonimato):** Subgrupos com menos de 5 respondentes têm suas notas suprimidas automaticamente dos relatórios. |
| **Transparência** | O colaborador é informado antes de iniciar o questionário sobre a confidencialidade e o tratamento estritamente agregado dos dados. |
| **Prevenção e Expurgo** | Política de retenção configurável (1 a 60 meses) com expurgo irreversível de dados brutos de respostas e convites após publicação dos relatórios. |

---

### 4. Ciclo de Vida dos Dados e Retenção
1. **Fase de Coleta:** Tokens efêmeros e descartáveis de acesso à pesquisa. Uma vez enviada a resposta, o vínculo entre o participante e a resposta é desassociado.
2. **Fase de Publicação:** Geração de snapshot estatístico versionado (médias, distribuições, faixas de risco).
3. **Fase de Expurgo:** O gestor pode acionar o expurgo de dados brutos (`/api/management/retention/purge`), mantendo apenas os agregados necessários para a rastreabilidade do PGR.

---

### 5. Resiliência, Backup e Restauração
* **Criptografia em Trânsito:** TLS 1.3 / HTTPS obrigatório em todas as comunicações.
* **Criptografia em Repouso:** Hashes com salting seguro (PBKDF2/SHA-256) para credenciais e dados persistidos.
* **Integridade dos Snapshots:** Cada dossiê e relatório possui hash SHA-256 único, garantindo rastreabilidade perante auditorias fiscais sem expor o sigilo dos trabalhadores.
