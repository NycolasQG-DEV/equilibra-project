# LOG DE IMPLEMENTAÇÃO E EVOLUÇÃO — EQUILIBRA SaaS
**Branch de Trabalho:** `feat/saas-evolution`  
**Data Inicial:** 18 de Novembro de 2026  
**Responsável:** Time Sênior Multidisciplinar (Engenharia Full-Stack, Arquitetura, Segurança e Produto)

---

## 1. DIAGNÓSTICO E INSPEÇÃO INICIAL

### 1.1. Problemas Identificados
1. **Frontend Duplicado e Servidor Incorreto:**
   - O servidor Express (`src/server.js`) entrega `public/index.html` (aplicação antiga legada) em vez de entregar o bundle compilado do Vite (`dist/client/index.html`).
   - O arquivo `render.yaml` executa apenas `npm install` sem rodar `npm run build`, impedindo que a aplicação React seja gerada e servida em produção no Render.
2. **Navegação SPA Frágil:**
   - `client/src/main.tsx` controla telas apenas por estado local (`useState<Route>`), fazendo com que qualquer reload (F5) ou link direto recupere o estado inicial 'hoje' e perca identificadores de contexto.
   - Rotas públicas de resposta de pesquisas (`/responder/:token`) não estavam integradas de forma reativa e acessível na SPA.
3. **Contratos Frontend x Backend:**
   - `OnboardingView.tsx` chamava método incorreto e não garantia a persistência definitiva do contexto empresarial.
   - `SurveysView.tsx` simulava exclusão apenas no estado local sem persistência segura na API.
   - `ResultsView.tsx` continha divergência de nomenclatura de campos (`mean` vs `average`, `hypotheses` vs `insights`) e dados fictícios de fallback.
4. **Avaliação de Riscos (NR-1):**
   - Vários campos da matriz 5x5 eram descartados no backend na validação de `validateAssessment`.
   - Menções indevidas a um pretenso "Anexo III oficial" da NR-1 precisam ser corrigidas para refletir rigorosamente a metodologia técnica interna documentada.
5. **Segurança e Criptografia:**
   - `src/config/identityCrypto.js` permitia fallback de chave derivado de chaves alheias (Supabase/Groq) e retornava telefone em texto puro quando a criptografia falhava (`return phone`).
6. **Persistência Relacional:**
   - O adaptador de banco utilizava sincronização com coleções JSON e `TABLES` sem incluir `evidences`, exigindo consolidação com o schema relacional PostgreSQL.

---

## 2. DECISÕES TÉCNICAS TOMADAS
1. **Branch Dedicada:** Todo o trabalho de evolução, correção e finalização é executado na branch `feat/saas-evolution`, preservando `main`.
2. **Entrega Oficial React:** Configurar `render.yaml` com `npm ci && npm run build` e `src/server.js` apontando estáticos e fallback SPA para `dist/client`.
3. **Roteamento SPA Completo:** Implementar histórico do navegador (`history.pushState` / `popstate` ou mini router robusto com URLs reais `/hoje`, `/pesquisas`, `/resultados/:id`, `/acoes`, `/organizacao`, `/riscos`, `/evidencias`, `/configuracoes`, `/responder/:token`).
4. **Validação e Persistência Integral da Matriz NR-1:** Persistir severidade, probabilidade, grupo exposto, perigo, consequência e justificativa nas 4 camadas sem perda de dados.
5. **Criptografia Rígida:** Exigir `EQUILIBRA_DATA_KEY` dedicada de 32 bytes, falhar de forma segura sem vazar texto puro e sem reaproveitar credenciais externas.
6. **Zero Dados Fictícios:** Eliminar qualquer mock que simule dados da empresa quando a informação real ainda não foi coletada.

---

## 3. REGISTRO DE EXECUÇÃO POR ETAPAS

*(Em atualização contínua conforme o avanço das etapas)*
