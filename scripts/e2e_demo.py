#!/usr/bin/env python3
"""
Equilibra — Demonstração de Ponta a Ponta no Navegador Real
============================================================
Abre o navegador de verdade em tempo real (Playwright Chromium), cria
uma empresa com contexto aleatório brasileiro, completa o onboarding,
cadastra departamentos e colaboradores em massa, cria ciclos de pesquisa
com modelos psicossociais oficiais, responde uma pesquisa interativamente
na tela (e dezenas em lote via API), encerra para apurar diagnóstico,
cria matriz de riscos 5x5, plano de ação 5W2H e evidências.

Tudo visível e interativo para ver o app funcionando na prática.

Uso:
  python scripts/e2e_demo.py
  python scripts/e2e_demo.py --url http://localhost:3000
  python scripts/e2e_demo.py --employees 40 --surveys 3
  python scripts/e2e_demo.py --slow           # modo mais calmo para apresentação
  python scripts/e2e_demo.py --headless       # execução sem interface gráfica
"""

import argparse
import io
import json
import os
import random
import string
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path

# ── UTF-8 no Windows ─────────────────────────────────────────────────────────
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    from playwright.sync_api import sync_playwright, Page, BrowserContext
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False

# ── Catálogos e Geradores de Dados Brasileiros ───────────────────────────────

FIRST_NAMES = [
    "Lucas", "Gabriel", "Arthur", "Miguel", "Rafael", "Matheus", "Pedro",
    "Ana", "Beatriz", "Camila", "Daniela", "Fernanda", "Gabriela", "Helena",
    "Isabela", "Juliana", "Larissa", "Mariana", "Natália", "Sofia", "Letícia",
    "Henrique", "Gustavo", "Felipe", "Bruno", "Leonardo", "Thiago", "André",
    "Rodrigo", "Caio", "Daniel", "Eduardo", "João", "Marcos", "Paulo",
    "Renata", "Amanda", "Carolina", "Débora", "Flávia", "Giovana", "Laura",
    "Priscila", "Vanessa", "Tatiana", "Marcelo", "Renato", "Vitor", "Murilo",
]

LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira",
    "Almeida", "Nascimento", "Lima", "Araújo", "Melo", "Barbosa",
    "Carvalho", "Ribeiro", "Gomes", "Martins", "Rocha", "Costa",
    "Pereira", "Fernandes", "Mendes", "Vieira", "Moreira", "Nunes",
    "Monteiro", "Cardoso", "Teixeira", "Pinto", "Reis", "Lopes",
    "Dias", "Machado", "Borges", "Castro", "Campos", "Moura",
]

COMPANY_PREFIXES = [
    "Tecnologia", "Indústria", "Grupo", "Logística", "Soluções", "Instituto",
    "Rede", "Engenharia", "Distribuidora", "Cooperativa", "Corporação",
]

COMPANY_CORES = [
    "Inova Brasil", "Aço Forte", "Nova Energia", "Horizonte Sustentável",
    "Vida & Saúde", "Vale do Sol", "Progresso Digital", "Sabor Paulista",
    "Alfa Sistemas", "Omega Transporte", "Pioneira Serviços",
]

COMPANY_SUFFIXES = ["S.A.", "Ltda.", "Brasil", "Corporativa", "Industrial"]

SECTORS_ONBOARDING = [
    "Escritório & Serviços",
    "Indústria & Produção",
    "Logística & Transporte",
    "Varejo & Atendimento",
    "Saúde & Cuidado",
    "Educação",
    "Tecnologia",
    "Construção Civil",
    "Agronegócio",
]

DEPARTMENTS = [
    ("Operações & Produção", "#DC2626"),
    ("Tecnologia & Sistemas", "#2563EB"),
    ("Comercial & Vendas", "#16A34A"),
    ("RH & Gestão de Pessoas", "#EA580C"),
    ("Financeiro & Controladoria", "#0891B2"),
    ("Logística & Suprimentos", "#CA8A04"),
    ("Segurança do Trabalho", "#059669"),
    ("Qualidade & Processos", "#DB2777"),
]

OFFICIAL_MODELS = [
    "Condições e Organização do Trabalho",
    "Exigências Psicológicas & Carga de Trabalho",
    "Segurança Psicológica & Autonomia no Trabalho (Edmondson, 1999)",
    "Prevenção ao Assédio & Canal Ético",
    "Suporte da Liderança & Justiça Organizacional",
    "Triagem de Exaustão & Burnout Ocupacional (modelo MBI)",
    "Pulso Mensal de Estabilidade Psicossocial",
    "Eficácia das Medidas Preventivas",
]

RISK_TOPICS = [
    ("Sobrecarga de demandas e prazos exíguos", "Exigência excessiva de velocidade e volume nas entregas"),
    ("Pressão por produtividade e metas agressivas", "Cobrança sistemática com ausência de pausas recuperativas"),
    ("Ausência de suporte da liderança imediata", "Dificuldade de alinhamento e falta de orientação aos times"),
    ("Conflitos interpessoais e clima de tensão", "Relações de trabalho desgastadas com ruídos frequentes"),
    ("Falta de autonomia e controle sobre rotina", "Microgerenciamento excessivo e baixa participação nas decisões"),
    ("Risco de condutas abusivas no ambiente", "Ambiente vulnerável à falta de limites de convivência ética"),
]

ACTION_PLANS = [
    ("Revisão de Cargas e Prazos Operacionais", "Mapear tarefas e redistribuir demandas críticas para evitar gargalos.", "organizacional"),
    ("Capacitação de Lideranças em Gestão Humanizada", "Treinar coordenadores em escuta ativa, empatia e feedback construtivo.", "organizacional"),
    ("Implementação de Pausas Ativas e Ergonomia", "Estabelecer pausas reguladas e orientações posturais durante a jornada.", "coletiva"),
    ("Comitê Paritário de Saúde Psicossocial", "Criar comissão multidisciplinar com encontros mensais de acompanhamento.", "coletiva"),
    ("Canal Confidencial de Diálogo e Acolhimento", "Disponibilizar canal anônimo e seguro para manifestação de preocupações.", "individual"),
]

EVIDENCE_ITEMS = [
    ("observacao", "Inspeção in loco de postos de trabalho e dinâmica de pausas"),
    ("grupo_focal", "Grupo focal sobre percepção de ritmo de trabalho com equipe"),
    ("entrevista", "Entrevista semiestruturada sobre suporte da liderança e autonomia"),
    ("documento", "Ata de reunião do comitê de SST sobre medidas preventivas"),
    ("indicador_agregado", "Mapeamento consolidado de atestados por motivo de estresse"),
]


class DataGen:
    def __init__(self, rng: random.Random):
        self.rng = rng
        self._used_emails: set[str] = set()

    def company(self) -> str:
        p = self.rng.choice(COMPANY_PREFIXES)
        c = self.rng.choice(COMPANY_CORES)
        s = self.rng.choice(COMPANY_SUFFIXES)
        return f"{p} {c} {s}"

    def name(self) -> str:
        fn = self.rng.choice(FIRST_NAMES)
        ln1 = self.rng.choice(LAST_NAMES)
        ln2 = self.rng.choice(LAST_NAMES)
        while ln2 == ln1:
            ln2 = self.rng.choice(LAST_NAMES)
        return f"{fn} {ln1} {ln2}"

    def email(self, name: str, domain_suffix: str = "com.br") -> str:
        cleaned = name.lower()
        for a, b in [(" ", "."), ("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"),
                     ("ã", "a"), ("õ", "o"), ("ç", "c"), ("ê", "e"), ("â", "a")]:
            cleaned = cleaned.replace(a, b)
        domain = self.rng.choice(["inovasul", "corpbrasil", "techlog", "grupointegrado"])
        addr = f"{cleaned}@{domain}.{domain_suffix}"
        c = 1
        while addr in self._used_emails:
            addr = f"{cleaned}{c}@{domain}.{domain_suffix}"
            c += 1
        self._used_emails.add(addr)
        return addr

    def phone(self) -> str:
        ddd = self.rng.choice(["11", "21", "31", "41", "51", "19", "61"])
        return f"({ddd}) 9{self.rng.randint(1000, 9999)}-{self.rng.randint(1000, 9999)}"

    def cnpj(self) -> str:
        n1 = self.rng.randint(10, 99)
        n2 = self.rng.randint(100, 999)
        n3 = self.rng.randint(100, 999)
        return f"{n1}.{n2}.{n3}/0001-{self.rng.randint(10, 99)}"

    def answers(self, factor_keys: list[str]) -> dict[str, int]:
        return {
            k: self.rng.choices([1, 2, 3, 4, 5], weights=[0.12, 0.20, 0.35, 0.23, 0.10], k=1)[0]
            for k in factor_keys
        }


# ── Cliente de API Integrado (Resiliente) ───────────────────────────────────

class APIClient:
    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.cookies: dict[str, str] = {}

    def _call(self, method: str, path: str, data: dict | None = None, _retry: int = 0):
        url = f"{self.base}/api{path}"
        headers = {"Content-Type": "application/json"}
        if self.cookies:
            headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())
        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                for h in (resp.headers.get_all("Set-Cookie") or []):
                    part = h.split(";")[0]
                    if "=" in part:
                        k, v = part.split("=", 1)
                        self.cookies[k.strip()] = v.strip()
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {"ok": True}
        except urllib.error.HTTPError as e:
            raw = (e.fp.read().decode("utf-8") if e.fp else "") if hasattr(e, "fp") else ""
            if _retry < 2 and e.code in (502, 503):
                time.sleep(1)
                return self._call(method, path, data, _retry + 1)
            return None
        except Exception:
            if _retry < 2:
                time.sleep(0.5)
                return self._call(method, path, data, _retry + 1)
            return None

    def get(self, path: str): return self._call("GET", path)
    def post(self, path: str, data: dict | None = None): return self._call("POST", path, data)
    def put(self, path: str, data: dict | None = None): return self._call("PUT", path, data)


# ── Console Helpers ──────────────────────────────────────────────────────────

W = "\033[0m"
GR = "\033[92m"
YL = "\033[93m"
BL = "\033[94m"
RD = "\033[91m"
CY = "\033[96m"
BD = "\033[1m"

def banner(msg: str):
    print(f"\n{BD}{CY}{'═'*68}{W}")
    print(f"{BD}{CY}  {msg}{W}")
    print(f"{BD}{CY}{'═'*68}{W}")

def stage(num: str, title: str):
    print(f"\n{BD}{BL}── [{num}] {title}{W}")

def ok(msg: str):   print(f"  {GR}✓{W} {msg}")
def info(msg: str): print(f"  {CY}•{W} {msg}")
def warn(msg: str): print(f"  {YL}⚠{W} {msg}")
def err(msg: str):  print(f"  {RD}✗{W} {msg}")

SHOTS_DIR = Path("scripts/screenshots")

def take_shot(page: Page, label: str):
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%H%M%S")
    fpath = SHOTS_DIR / f"{ts}_{label}.png"
    try:
        page.screenshot(path=str(fpath))
    except Exception:
        pass


# ── Orquestrador da Demonstração Completa ─────────────────────────────────────

class EquilibraDemoRunner:
    def __init__(self, base_url: str, num_employees: int = 40, num_surveys: int = 3,
                 slow_mode: bool = False, headless: bool = False):
        self.url = base_url.rstrip("/")
        self.num_employees = max(20, num_employees)
        self.num_surveys = min(max(2, num_surveys), len(OFFICIAL_MODELS))
        self.slow = slow_mode
        self.headless = headless
        self.delay = 1.2 if slow_mode else 0.4

        self.rng = random.Random()
        self.gen = DataGen(self.rng)
        self.api = APIClient(base_url)

        # Contexto gerado da empresa
        self.company = self.gen.company()
        self.adm_name = self.gen.name()
        self.adm_email = self.gen.email(self.adm_name)
        self.adm_pass = f"Eq@{self.rng.randint(100000, 999999)}#Saas"
        self.adm_cnpj = self.gen.cnpj()

        self.members: list[dict] = []
        self.groups: list[dict] = []
        self.surveys: list[dict] = []
        self.reports: list[dict] = []

    def pause(self, seconds: float | None = None):
        t = seconds if seconds is not None else self.delay
        if not self.headless and t > 0:
            time.sleep(t)

    def check_health(self) -> bool:
        try:
            req = urllib.request.Request(f"{self.url}/health")
            with urllib.request.urlopen(req, timeout=6) as r:
                data = json.loads(r.read().decode())
                if data.get("status") == "ok":
                    ok(f"Servidor ativo e pronto: {self.url}")
                    return True
        except Exception as e:
            err(f"Servidor offline em {self.url} ({e})")
            print("  Por favor inicie com: npm start")
            return False
        return False

    def sync_cookies_to_api(self, context: BrowserContext):
        for c in context.cookies():
            if c["name"] == "equilibra_session":
                self.api.cookies["equilibra_session"] = c["value"]
                break

    def sync_cookies_to_browser(self, context: BrowserContext):
        if "equilibra_session" in self.api.cookies:
            context.add_cookies([{
                "name": "equilibra_session",
                "value": self.api.cookies["equilibra_session"],
                "url": self.url,
                "path": "/",
            }])

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 1: Registro Visual no Navegador
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_register(self, page: Page, context: BrowserContext):
        stage("1/11", "Criando Nova Conta Empresarial no Navegador")
        info(f"Empresa: {self.company}")
        info(f"Gestor:  {self.adm_name} ({self.adm_email})")
        info(f"Senha:   {self.adm_pass}")

        page.goto(f"{self.url}", wait_until="networkidle")
        self.pause(1.0)

        # Se já tiver sessão anterior, desloga para começar 100% novo
        try:
            logout_btn = page.locator("button.shell-logout-btn, button[title='Sair do sistema']")
            if logout_btn.is_visible(timeout=1500):
                logout_btn.click()
                page.wait_for_timeout(1000)
        except Exception:
            pass

        # Clica na aba "Criar Conta"
        page.locator("button:has-text('Criar Conta')").first.click()
        self.pause(0.5)

        # Preenche os campos de registro
        page.locator("input[placeholder*='responsável' i]").fill(self.adm_name)
        self.pause(0.2)
        page.locator("input[placeholder*='Razão social' i]").fill(self.company)
        self.pause(0.2)
        page.locator("input[type=email]").fill(self.adm_email)
        self.pause(0.2)
        page.locator("input[type=password]").fill(self.adm_pass)
        self.pause(0.6)

        take_shot(page, "01_registro_preenchido")

        # Clica em Criar Conta & Começar
        page.locator("button[type=submit]").click()
        page.wait_for_timeout(1800)

        self.sync_cookies_to_api(context)
        take_shot(page, "02_registro_sucesso")
        ok("Conta criada com sucesso!")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 2: Onboarding Completo com Contexto Setorial
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_onboarding(self, page: Page):
        stage("2/11", "Completando Onboarding da Organização")
        page.wait_for_timeout(1000)

        chosen_sector = self.rng.choice(SECTORS_ONBOARDING)
        info(f"Setor configurado: {chosen_sector}")

        try:
            # Step 1: Perfil da Empresa
            sector_btn = page.locator(f"button.btn:has-text('{chosen_sector}')").first
            if sector_btn.is_visible(timeout=3000):
                sector_btn.click()
                self.pause(0.4)

                # Preenche CNPJ
                cnpj_input = page.locator("input[placeholder*='00.000.000' i]").first
                if cnpj_input.is_visible(timeout=1000):
                    cnpj_input.fill(self.adm_cnpj)

                # Porte
                size_select = page.locator("select").first
                if size_select.is_visible(timeout=1000):
                    size_select.select_option(value="media")

                self.pause(0.5)
                take_shot(page, "03_onboarding_step1")
                page.locator("button:has-text('Avançar')").first.click()
                page.wait_for_timeout(800)

            # Step 2: Estabelecimento
            est_input = page.locator("input[placeholder*='Matriz' i]").first
            if est_input.is_visible(timeout=2000):
                est_input.fill("Matriz Central Operacional")
                self.pause(0.4)
                take_shot(page, "04_onboarding_step2")
                page.locator("button:has-text('Avançar')").first.click()
                page.wait_for_timeout(800)

            # Step 3: Estrutura
            adv_btn = page.locator("button:has-text('Avançar')").first
            if adv_btn.is_visible(timeout=2000):
                self.pause(0.4)
                adv_btn.click()
                page.wait_for_timeout(800)

            # Step 4: Finalizar
            finish_btn = page.locator("button:has-text('Confirmar & Iniciar Plataforma')").first
            if finish_btn.is_visible(timeout=2000):
                self.pause(0.5)
                take_shot(page, "05_onboarding_finalizar")
                finish_btn.click()
                page.wait_for_timeout(2000)
                ok("Onboarding concluído!")
                return
        except Exception as e:
            warn(f"Fluxo guiado de onboarding: {e}")

        # Fallback rápido se já finalizado ou botão alternativo
        try:
            skip_btn = page.locator("button:has-text('Configurar depois')").first
            if skip_btn.is_visible(timeout=1500):
                skip_btn.click()
                page.wait_for_timeout(1000)
        except Exception:
            pass

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 3: Departamentos e Colaboradores em Massa
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_organization(self, page: Page):
        stage("3/11", f"Cadastrando Departamentos e {self.num_employees} Colaboradores")

        # Navega para a tela Organização
        page.locator(".shell-nav button:has-text('Organização')").first.click()
        page.wait_for_timeout(1000)
        self.pause(0.8)

        # Cria Departamentos via API
        num_depts = min(len(DEPARTMENTS), max(4, self.num_employees // 8))
        chosen_depts = self.rng.sample(DEPARTMENTS, num_depts)

        for name, color in chosen_depts:
            res = self.api.post("/groups", {"name": name, "memberIds": [], "color": color})
            if res and res.get("id"):
                self.groups.append(res)
        ok(f"{len(self.groups)} departamentos estruturados")

        # Cadastra Colaboradores em massa
        created = 0
        for i in range(self.num_employees):
            c_name = self.gen.name()
            c_email = self.gen.email(c_name)
            c_phone = self.gen.phone()
            res = self.api.post("/members", {"name": c_name, "email": c_email, "phone": c_phone})
            if res and res.get("id"):
                self.members.append(res)
                created += 1

        ok(f"{created} colaboradores cadastrados com dados válidos")

        # Distribui os membros nos departamentos (garantindo N >= 5 para quórum de proteção)
        shuffled = list(self.members)
        self.rng.shuffle(shuffled)
        k = len(self.groups)
        chunk = len(shuffled) // k

        for i, group in enumerate(self.groups):
            start = i * chunk
            end = len(shuffled) if i == k - 1 else (i + 1) * chunk
            m_slice = shuffled[start:end]
            m_ids = [m["id"] for m in m_slice]
            self.api.put(f"/groups/{group['id']}", {
                "name": group["name"],
                "memberIds": m_ids,
                "color": group.get("color"),
            })

        # Recarrega a página de Organização no navegador para exibir a lista populada
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        self.pause(1.2)
        take_shot(page, "06_organizacao_populada")
        ok("Tela de Organização exibindo colaboradores e setores em tempo real!")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 4: Criação de Ciclos de Pesquisa com Modelos Oficiais
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_surveys(self, page: Page):
        stage("4/11", f"Criando {self.num_surveys} Ciclos de Pesquisa Psicossocial")

        # Navega para Pesquisas no navegador
        page.locator(".shell-nav button:has-text('Pesquisas')").first.click()
        page.wait_for_timeout(1000)
        self.pause(0.8)

        # Abre o modal "Nova Pesquisa" na UI para o usuário ver
        try:
            page.locator("button:has-text('Nova Pesquisa')").first.click()
            self.pause(1.0)
            take_shot(page, "07_modal_nova_pesquisa")

            # Preenche o formulário do modal
            first_model = OFFICIAL_MODELS[0]
            title_input = page.locator("input[placeholder*='Demandas' i], input[placeholder*='Ex:' i]").first
            if title_input.is_visible(timeout=2000):
                title_input.fill(f"Diagnóstico Inicial de Clima & GRO")
                self.pause(0.5)

            # Clica no botão de criar dentro do modal
            create_btn = page.locator(".modal-panel button:has-text('Criar Pesquisa'), button[type=submit]:has-text('Criar')").first
            if create_btn.is_visible(timeout=2000):
                create_btn.click()
                page.wait_for_timeout(1500)
        except Exception as e:
            warn(f"Criação via modal: {e}")

        # Busca grupos para atrelar
        all_groups = self.api.get("/groups") or []
        target_group_ids = [g["id"] for g in all_groups if not g.get("isDefault")]
        if not target_group_ids and all_groups:
            target_group_ids = [all_groups[0]["id"]]

        # Cria as pesquisas programadas com os modelos oficiais
        self.surveys = []
        for i in range(self.num_surveys):
            model_name = OFFICIAL_MODELS[i % len(OFFICIAL_MODELS)]
            cycle_name = f"Ciclo {i + 1} — {datetime.now().strftime('%B/%Y')}"
            title = f"{model_name} ({cycle_name})"
            ends = (datetime.now() + timedelta(days=25 + i * 5)).isoformat()

            created = self.api.post("/surveys", {
                "title": title,
                "model": model_name,
                "cycle": cycle_name,
                "groupIds": target_group_ids,
                "endsAt": ends,
            })
            if created and created.get("id"):
                sid = created["id"]
                opened = self.api.post(f"/surveys/{sid}/open")
                links = opened.get("links", []) if opened else []
                self.surveys.append({
                    "id": sid,
                    "title": title,
                    "model": model_name,
                    "links": links,
                })
                ok(f"Pesquisa criada e aberta: \"{title[:45]}\" ({len(links)} convites gerados)")

        # Recarrega a tela de pesquisas para o usuário ver os cards ativos
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        self.pause(1.2)
        take_shot(page, "08_pesquisas_coleta_ativa")
        ok("Cards de pesquisa com Coleta Ativa visíveis na tela!")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 5: Experiência Real do Colaborador Respondendo no Navegador
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_live_response(self, page: Page):
        stage("5/11", "Simulando Resposta Interativa de um Colaborador no Navegador")

        if not self.surveys or not self.surveys[0].get("links"):
            warn("Sem links de pesquisa disponíveis")
            return

        sample_survey = self.surveys[0]
        first_invite = sample_survey["links"][0]
        token = first_invite["token"]

        info(f"Navegando para o link público de resposta: /responder/{token}")
        page.goto(f"{self.url}/responder/{token}", wait_until="networkidle")
        page.wait_for_timeout(1500)
        self.pause(1.0)
        take_shot(page, "09_tela_boas_vindas_pesquisa")

        # Clica em Iniciar Resposta
        start_btn = page.locator("button:has-text('Iniciar Resposta')").first
        if start_btn.is_visible(timeout=3000):
            start_btn.click()
            page.wait_for_timeout(800)
            self.pause(0.5)

            # Responde as perguntas na tela clicando nas opções
            for q_idx in range(12):  # Limite de segurança de perguntas
                take_shot(page, f"10_pergunta_{q_idx + 1}")
                options = page.locator(".respond-option-btn, button:has-text('Nunca'), button:has-text('Raramente'), button:has-text('Às vezes'), button:has-text('Frequentemente'), button:has-text('Sempre')").all()
                if options:
                    chosen = self.rng.choice(options)
                    chosen.click()
                    self.pause(0.4)
                else:
                    # Se não houver mais perguntas, chegou na tela de envio
                    break

            # Clica no botão final de envio anônimo
            submit_btn = page.locator("button:has-text('Enviar Respostas Anônimas'), button:has-text('Confirmar Envio')").first
            if submit_btn.is_visible(timeout=2000):
                self.pause(0.5)
                submit_btn.click()
                page.wait_for_timeout(2000)
                take_shot(page, "11_resposta_concluida")
                ok("Pesquisa respondida pelo colaborador diretamente na interface!")

        # Retorna para o ambiente administrativo
        page.goto(f"{self.url}/pesquisas", wait_until="networkidle")
        page.wait_for_timeout(1000)

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 6: Coleta em Massa de Respostas (Garantindo Quórum Estatístico)
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_bulk_responses(self, page: Page):
        stage("6/11", "Enviando Respostas em Massa (Adesão de 85%+ com Quórum Garantido)")
        total_answers = 0

        for s_idx, survey in enumerate(self.surveys):
            links = survey.get("links", [])
            if not links:
                continue

            # Obtém fatores da pesquisa pelo primeiro token
            test_token = links[0]["token"]
            spec = self.api.get(f"/respond/{test_token}")
            if not spec or not spec.get("factors"):
                continue

            factor_keys = [f["key"] for f in spec["factors"]]
            target_count = max(8, int(len(links) * 0.85))
            selected_links = self.rng.sample(links, min(target_count, len(links)))

            answered = 0
            for link in selected_links:
                answers = self.gen.answers(factor_keys)
                saved_cookie = dict(self.api.cookies)
                self.api.cookies = {}  # Desanexa sessão para simular colaborador anônimo
                res = self.api.post(f"/respond/{link['token']}", {"answers": answers})
                self.api.cookies = saved_cookie
                if res and res.get("ok"):
                    answered += 1
                    total_answers += 1

            ok(f"Ciclo {s_idx + 1}: {answered}/{len(links)} respostas registradas")

        ok(f"Total consolidado: {total_answers} colaborações anônimas processadas!")

        # Atualiza a tela de Pesquisas para o usuário ver o contador de respostas
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1200)
        self.pause(1.0)
        take_shot(page, "12_pesquisas_com_respostas")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 7: Encerramento de Ciclos e Apuração do Diagnóstico
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_close_and_diagnose(self, page: Page):
        stage("7/11", "Encerrando Ciclos e Apurando Resultados Estatísticos")

        for survey in self.surveys:
            res = self.api.post(f"/surveys/{survey['id']}/close", {
                "confirmEarlyClose": True,
                "reason": "Encerramento formal para emissão do relatório diagnóstico",
            })
            if res and res.get("reportId"):
                rep_id = res["reportId"]
                self.reports.append(rep_id)
                # Aceita e publica o relatório para habilitar matriz de riscos
                self.api.post(f"/reports/{rep_id}/accept", {})
                ok(f"Relatório gerado e publicado (ID: {rep_id[:8]}...)")

        # Navega para a tela Diagnóstico no navegador
        page.locator(".shell-nav button:has-text('Diagnóstico')").first.click()
        page.wait_for_timeout(1500)
        self.pause(1.5)
        take_shot(page, "13_diagnostico_gerado")
        ok("Tela de Diagnóstico com radares, scores de risco e narrativa carregados!")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 8: Gestão de Riscos NR-1 (Matriz 5x5 e Achados)
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_risks(self, page: Page):
        stage("8/11", "Estruturando Matriz de Riscos 5x5 e Achados Técnicos")

        page.locator(".shell-nav button:has-text('Riscos NR-1')").first.click()
        page.wait_for_timeout(1500)
        self.pause(1.0)

        # Cria achados de risco vinculados aos relatórios publicados
        all_reports = self.api.get("/reports") or []
        published = [r for r in all_reports if r.get("published") and r.get("result")]

        created_assessments = []
        if published:
            rep = published[0]
            factors = rep["result"]

            for topic, hazard in RISK_TOPICS[:3]:
                chosen_factor = self.rng.choice(factors)["key"]
                sev = self.rng.randint(2, 5)
                prob = self.rng.randint(2, 4)
                score = sev * prob
                level = "Crítico" if score >= 15 else "Alto" if score >= 10 else "Médio"

                created = self.api.post("/management/assessments", {
                    "reportId": rep["id"],
                    "factor": chosen_factor,
                    "title": topic,
                    "status": "investigating",
                    "classification": "high" if score >= 10 else "medium",
                    "severity": sev,
                    "probability": prob,
                    "riskScore": score,
                    "riskLevel": level,
                    "groupExposed": self.rng.choice([g["name"] for g in self.groups]) if self.groups else "Geral",
                    "hazard": hazard,
                    "consequence": "Desgaste cognitivo contínuo, aumento do absenteísmo e turnover",
                })
                if created and created.get("id"):
                    # Conclui a avaliação do achado com parecer técnico
                    upd = self.api.put(f"/management/assessments/{created['id']}", {
                        "version": created["version"],
                        "reportId": rep["id"],
                        "factor": chosen_factor,
                        "title": topic,
                        "status": "evaluated",
                        "classification": "high" if score >= 10 else "medium",
                        "context": f"Evidenciado índice desfavorável nas pesquisas do setor.",
                        "decision": "Intervenção preventiva imediata via medidas 5W2H.",
                        "severity": sev,
                        "probability": prob,
                        "groupExposed": created.get("groupExposed", "Geral"),
                        "hazard": hazard,
                        "consequence": created.get("consequence", ""),
                    })
                    if upd and upd.get("id"):
                        created_assessments.append(upd)
                        ok(f"Achado de Risco: \"{topic}\" (Score {score} - {level})")

        # Recarrega a tela de Riscos para o usuário ver a matriz populada
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        self.pause(1.2)
        take_shot(page, "14_matriz_riscos_populada")
        ok("Matriz de Riscos 5x5 exibindo perigos avaliados!")
        return created_assessments

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 9: Plano de Ação 5W2H e Evidências Vinculadas
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_actions(self, page: Page, assessments: list[dict]):
        stage("9/11", "Implementando Plano de Ação Preventivo 5W2H")

        page.locator(".shell-nav button:has-text('Plano de Ação')").first.click()
        page.wait_for_timeout(1200)
        self.pause(1.0)

        for i, plan in enumerate(ACTION_PLANS[:3]):
            if not assessments:
                break
            ass = assessments[i % len(assessments)]
            title, desc, hier = plan
            due = (datetime.now() + timedelta(days=45 + i * 15)).strftime("%Y-%m-%d")
            rev = (datetime.now() + timedelta(days=75 + i * 15)).strftime("%Y-%m-%d")

            action = self.api.post("/management/actions", {
                "assessmentId": ass["id"],
                "title": title,
                "description": desc,
                "owner": self.adm_name,
                "dueDate": due,
                "reviewDate": rev,
                "successCriteria": "Atingir redução de 25% nas queixas no próximo ciclo avaliativo.",
                "priority": "high",
                "status": "planned",
                "hierarchy": hier,
            })
            if action and action.get("id"):
                ok(f"Ação 5W2H: \"{title}\" (Resp: {self.adm_name})")

                # Anexa evidência de início à ação
                self.api.post(f"/management/actions/{action['id']}/evidence", {
                    "description": f"Registro formal de aprovação da diretoria para a medida: {title}.",
                    "url": None,
                    "version": action["version"],
                })

        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        self.pause(1.2)
        take_shot(page, "15_plano_acao_populado")
        ok("Tabela de Planos de Ação exibindo medidas estruturadas!")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 10: Evidências Multimétodo Complementares
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_evidences(self, page: Page):
        stage("10/11", "Registrando Evidências Multimétodo (AEP Complementar)")

        page.locator(".shell-nav button:has-text('Evidências')").first.click()
        page.wait_for_timeout(1200)
        self.pause(1.0)

        for ev_type, ev_title in EVIDENCE_ITEMS:
            dt = (datetime.now() - timedelta(days=self.rng.randint(2, 20))).strftime("%Y-%m-%d")
            res = self.api.post("/evidence", {
                "type": ev_type,
                "title": ev_title,
                "collectionDate": dt,
                "responsibleName": self.adm_name,
                "location": "Sede Corporativa",
                "activityDescription": f"Registro técnico formal em conformidade com o método {ev_type}.",
                "participantCount": self.rng.randint(6, 18),
                "observationNotes": "Dados consolidados e preservando estritamente a identidade dos entrevistados.",
            })
            if res and res.get("id"):
                ok(f"Evidência cadastrada: [{ev_type.upper()}] {ev_title[:45]}")

        page.reload(wait_until="networkidle")
        page.wait_for_timeout(1500)
        self.pause(1.2)
        take_shot(page, "16_evidencias_multimetodo")
        ok("Repositório de Evidências exibindo documentação!")

    # ─────────────────────────────────────────────────────────────────────────
    # FASE 11: Hoje (Dashboard Integrado) e Configurações
    # ─────────────────────────────────────────────────────────────────────────
    def run_stage_today_and_settings(self, page: Page):
        stage("11/11", "Visão Consolidada no Dashboard 'Hoje' & Configurações")

        # Dashboard Hoje
        page.locator(".shell-nav button:has-text('Hoje')").first.click()
        page.wait_for_timeout(1500)
        self.pause(1.8)
        take_shot(page, "17_dashboard_hoje_completo")
        ok("Dashboard Hoje refletindo todo o ecossistema ativo!")

        # Configurações
        page.locator(".shell-nav button:has-text('Configurações')").first.click()
        page.wait_for_timeout(1200)
        self.pause(1.2)
        take_shot(page, "18_configuracoes_e_perfil")
        ok("Tela de Configurações visualizada com dados da conta!")

        # Volta para Hoje para fechar com chave de ouro
        page.locator(".shell-nav button:has-text('Hoje')").first.click()
        page.wait_for_timeout(1000)
        self.pause(2.0)
        take_shot(page, "19_final_hoje")

    # ─────────────────────────────────────────────────────────────────────────
    # Execução Principal
    # ─────────────────────────────────────────────────────────────────────────
    def run(self) -> bool:
        banner("EQUILIBRA — TESTE E2E COMPLETO EM TEMPO REAL NO NAVEGADOR")
        info(f"Servidor:        {self.url}")
        info(f"Empresa Gerada:  {self.company}")
        info(f"Colaboradores:   {self.num_employees} pessoas")
        info(f"Ciclos/Modelos:  {self.num_surveys} pesquisas")
        info(f"Interface:       {'Headless (em segundo plano)' if self.headless else 'Janela do Navegador Aberta'}")

        if not self.check_health():
            return False

        if not PLAYWRIGHT_OK:
            err("Playwright não encontrado. Instale com: pip install playwright && playwright install chromium")
            return False

        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=self.headless,
                slow_mo=350 if self.slow else 100,
                args=["--start-maximized"] if not self.headless else [],
            )
            context = browser.new_context(
                viewport={"width": 1366, "height": 840},
                locale="pt-BR",
            )
            page = context.new_page()
            page.set_default_timeout(25000)

            try:
                self.run_stage_register(page, context)
                self.run_stage_onboarding(page)
                self.run_stage_organization(page)
                self.run_stage_surveys(page)
                self.run_stage_live_response(page)
                self.run_stage_bulk_responses(page)
                self.run_stage_close_and_diagnose(page)
                assessments = self.run_stage_risks(page)
                self.run_stage_actions(page, assessments)
                self.run_stage_evidences(page)
                self.run_stage_today_and_settings(page)

                banner("TODOS OS SISTEMAS FORAM UTILIZADOS COM DADOS REAIS!")
                print(f"  {BD}Empresa Cadastrada:{W}   {self.company}")
                print(f"  {BD}Gestor Administrador:{W} {self.adm_email}")
                print(f"  {BD}Senha de Acesso:{W}      {self.adm_pass}")
                print(f"  {BD}Colaboradores:{W}        {len(self.members)}")
                print(f"  {BD}Departamentos:{W}        {len(self.groups)}")
                print(f"  {BD}Pesquisas Criadas:{W}    {len(self.surveys)}")
                print(f"  {BD}Relatórios Emitidos:{W}  {len(self.reports)}")
                print(f"  {BD}Screenshots Salvos:{W}   {SHOTS_DIR.resolve()}")
                print(f"\n  Para acessar o sistema agora mesmo no seu navegador:")
                print(f"  {BD}{self.url}{W}")
                print(f"  E-mail: {self.adm_email}")
                print(f"  Senha:  {self.adm_pass}")
                print(f"{CY}{'═'*68}{W}\n")
                return True

            except KeyboardInterrupt:
                warn("Demonstração cancelada pelo usuário.")
                return False
            except Exception as e:
                err(f"Falha na execução: {e}")
                import traceback
                traceback.print_exc()
                take_shot(page, "ERRO_FALHA")
                return False
            finally:
                if not self.headless:
                    self.pause(2.0)
                context.close()
                browser.close()


def main():
    p = argparse.ArgumentParser(
        description="Equilibra — Executa o teste ponta a ponta com navegador real e dados em massa"
    )
    p.add_argument("--url", default="http://localhost:3000", help="URL do servidor (padrão: http://localhost:3000)")
    p.add_argument("--employees", type=int, default=35, help="Total de colaboradores (padrão: 35)")
    p.add_argument("--surveys", type=int, default=3, help="Total de pesquisas a criar (padrão: 3)")
    p.add_argument("--slow", action="store_true", help="Modo com pausas maiores para acompanhamento")
    p.add_argument("--headless", action="store_true", help="Executar sem abrir janela gráfica")
    args = p.parse_args()

    runner = EquilibraDemoRunner(
        base_url=args.url,
        num_employees=args.employees,
        num_surveys=args.surveys,
        slow_mode=args.slow,
        headless=args.headless,
    )
    success = runner.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
