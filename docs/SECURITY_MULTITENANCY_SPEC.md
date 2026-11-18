# Arquitetura de Segurança, Multitenancy e Isolamento — SaaS Equilibra

**Documento:** Especificação Técnica de Isolamento Multi-Tenant e RBAC  
**Status:** Oficial / Vigente  
**Versão:** 1.0 — Novembro de 2026

---

## 1. Princípios de Isolamento e Fronteira de Tenants

Como plataforma SaaS B2B multicliente, o Equilibra adota o princípio de **defesa em profundidade** contra acessos indevidos entre empresas (cross-tenant access) e vulnerabilidades do tipo IDOR (Insecure Direct Object Reference).

### 1.1 Derivação Autoritativa da Identidade no Servidor
- **Nenhum parâmetro de tenant enviado pelo cliente é considerado confiável:** O `accountId` ou `tenantId` jamais é lido a partir do corpo da requisição (`req.body`), parâmetros de rota (`req.params`) ou cabeçalhos customizáveis pelo navegador para determinar a autorização.
- O contexto do tenant é extraído exclusivamente da sessão criptográfica autenticada (`req.account.id` ou token de sessão assinado), verificado no middleware de autenticação (`protectedRoute`).
- Toda operação de leitura, escrita, exportação ou exclusão nos repositórios aplica o filtro de tenant de forma imperativa:
  ```javascript
  const target = collection.find(item => item.id === resourceId && item.accountId === req.account.id);
  if (!target) throw new DomainError('Recurso não encontrado.', 404);
  ```

---

## 2. Matriz de Controle de Acesso Baseada em Papéis (RBAC)

| Recurso / Operação | Owner (Proprietário) | Admin (Gestor RH/SST) | Technical Responsible | Viewer (Visualizador) |
|---|:---:|:---:|:---:|:---:|
| **Configuração da Empresa & Faturamento** | Total | Apenas leitura | Sem acesso | Sem acesso |
| **Política de Retenção e Purga LGPD** | Total | Sem acesso | Sem acesso | Sem acesso |
| **Gestão de Usuários da Equipe** | Total | Total | Sem acesso | Sem acesso |
| **Cadastro de Estabelecimentos e Pessoas** | Total | Total | Apenas leitura | Apenas leitura |
| **Criação e Gestão de Ciclos de Pesquisa** | Total | Total | Apenas leitura | Apenas leitura |
| **Abertura e Fechamento de Coletas** | Total | Total | Apenas leitura | Apenas leitura |
| **Visualização de Relatórios Publicados** | Total | Total | Total | Total |
| **Exportação de Relatórios (PDF, XLSX, CSV)** | Total | Total | Total | Total |
| **Validação Técnica de Avaliações (NR-1)** | Total | Total | Total | Apenas leitura |
| **Aprovação e Gestão de Planos de Ação** | Total | Total | Total | Apenas leitura |
| **Inserção de Evidências de Implantação** | Total | Total | Total | Sem acesso |

---

## 3. Estratégia de Testes Negativos de Isolamento

A suíte automatizada de testes multi-tenant (`tests/phase2-multitenant.test.js`) simula simultaneamente dois clientes corporativos distintos (Empresa A e Empresa B) e valida as seguintes tentativas de violação:

1. **Tentativa de leitura de membros/colaboradores da Empresa A pela Empresa B:** Deve retornar lista vazia ou 404.
2. **Tentativa de leitura ou alteração de grupos da Empresa A pela Empresa B:** Deve retornar 404.
3. **Tentativa de acesso direto ou abertura de pesquisa da Empresa A pela Empresa B:** Deve retornar 404.
4. **Tentativa de obter links e tokens de pesquisa da Empresa A pela Empresa B:** Deve retornar 404.
5. **Tentativa de visualização ou download de relatórios da Empresa A pela Empresa B:** Deve retornar 404.
6. **Tentativa de exportação de dados (PDF, XLSX, CSV, JSON) da Empresa A pela Empresa B:** Deve retornar 404.
7. **Tentativa de alteração de avaliações de risco ou planos de ação da Empresa A pela Empresa B:** Deve retornar 400 ou 404.
8. **Tentativa de vincular plano de ação da Empresa B a uma avaliação pertencente à Empresa A:** Deve ser sumariamente rejeitada com erro 400.
9. **Tentativa de purga de retenção da Empresa A pela Empresa B:** Não afeta os dados da Empresa A.
