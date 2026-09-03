# 🌟 Equilibra SaaS — Gestão Inteligente de Riscos Psicossociais & NR-01

> **Plataforma corporativa full-stack para diagnóstico psicossocial contínuo (ISTAS21-BR), inteligência artificial pericial em tempo real e conformidade regulatória com a NR-01 do Ministério do Trabalho / eSocial.**

---

## 📸 Demonstração Visual & Telas do Sistema

### 1. Landing Page Institucional
Apresentação profissional com design responsivo, alto contraste e acesso unificado com autenticação instantânea por JWT e persistência via Cookies seguros.

![Landing Page](public/docs/01_landing_page.png)

---

### 2. Painel Administrativo (Gestão de Riscos & Indicadores em Tempo Real)
Dashboard para o RH e Engenharia de Segurança com visão panorâmica de risco por setor, taxa de adesão, conformidade NR-01 e cartões de navegação rápida.

![Admin Dashboard](public/docs/02_admin_dashboard.png)

---

### 3. Gestão de Pesquisas & Gerador de Links Descentralizados
Criação simplificada de lotes de pesquisa por setor e cargo, com geração automática de links únicos, anônimos e com monitoramento de status (*Disponível* / *Concluído*).

![Gestão de Pesquisas](public/docs/03_admin_surveys.png)

---

### 4. Experiência do Colaborador (Onboarding com Sigilo LGPD)
Interface de acolhimento sem atritos, termos claros de anonimato e consentimento em conformidade estrita com a Lei Geral de Proteção de Dados (LGPD).

![Onboarding do Colaborador](public/docs/04_survey_onboarding.png)

---

### 5. Entrevista Conversacional Investigativa com Voz Neural
Interface de diálogo dinâmico da IA com digitação em tempo real sincronizada à voz neural brasileira (Microsoft Edge Neural TTS), transições ágeis, acolhimento empático e protocolo de aprofundamento investigativo (convite prévio para justificativa).

![Entrevista Conversacional com IA](public/docs/05_survey_completed.png)

---

### 6. Laudo Pericial Oficial & Plano de Ação 5W2H (GRO/PGR NR-01)
Relatório técnico estruturado gerado pela IA com deduções clínicas por dimensão do ISTAS21-BR, matriz de probabilidade x severidade, planos de ação 5W2H (O que, Por que, Quem, Quando, Prioridade) e parecer formatado para auditoria fiscal do MTE.

![Laudo Pericial NR-01](public/docs/06_admin_protocol.png)

---

## 🚀 Principais Diferenciais e Funcionalidades

- **🗣️ Voz Neural Nativa sem Custos:** Síntese de áudio em tempo real com vozes neurais brasileiras em qualquer navegador (`pt-BR-FranciscaNeural` via Microsoft Edge Neural TTS).
- **🧠 Inteligência Artificial Groq de Baixo Custo:** Motor pericial rápido e econômico (`qwen/qwen3.8-27b`) com controle estrito de tokens e relatórios de alto valor agregado.
- **🔒 Segurança & LGPD Nativa:** Criptografia de senhas (bcrypt), tokens JWT, sanitização de inputs e anonimização total dos dados sensíveis dos trabalhadores.
- **📊 Diagnóstico Completo ISTAS21-BR / NR-01:** Mapeamento automático das 7 dimensões críticas: Demandas Psicológicas, Autonomia, Apoio Social, Reconhecimento, Dupla Presença (família) e Prevenção de Assédio.
- **⚡ Next.js 16 + MySQL:** Arquitetura full-stack moderna com Turbopack, Tailwind CSS e banco de dados relacional MySQL local.

---

## 🛠️ Como Executar o Projeto Localmente

### 1. Pré-requisitos
- Node.js 18+ instalado
- MySQL Server rodando localmente (porta padrão `3306`)

### 2. Clonar e Instalar Dependências
```bash
git clone <url-do-repositorio>
cd equilibra
npm install
```

### 3. Configurar as Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e ajuste as credenciais:
```bash
cp .env.example .env
```

Configuração recomendada para o `.env`:
```env
# Banco de Dados MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=equilibradb

# Segurança JWT
JWT_SECRET=seu_jwt_secret_super_seguro_2026

# IA Groq (Ativo e Oficial)
GROQ_API_KEY=sua_chave_groq_aqui
GROQ_MODEL=qwen/qwen3.8-27b
```

### 4. Inicializar o Banco de Dados
Execute o script automático para criar o banco, tabelas e índices:
```bash
node setup-db.mjs
```

### 5. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```

Acesse a aplicação no navegador em [http://localhost:3000](http://localhost:3000).

---

## 👥 Credenciais para Teste e Demonstração

- **E-mail:** `teste.teste@teste.teste`
- **Senha:** `testeteste`
- **Perfil:** Administrador / Gestor de RH (Plano Professional Ativo)

---

## 📄 Licença & Conformidade
Desenvolvido em conformidade com as diretrizes do Ministério do Trabalho e Emprego (MTE) do Brasil (Portaria MTE nº 1.419/2024 / NR-01) e a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
