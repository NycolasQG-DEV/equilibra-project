#!/usr/bin/env python3
"""
Equilibra — Simulação Automatizada de Uso Real com Dados em Massa & Inteligência Contextual
=========================================================================================

Simula o ecossistema completo de uso em larga escala da plataforma:
  1. Cria conta empresarial nova (registro)
  2. Cadastra funcionários em massa (100+ colaboradores com dados brasileiros válidos)
  3. Cria múltiplos departamentos organizacionais (TI, Produção, Comercial, RH, etc.)
  4. Distribui colaboradores nos grupos garantindo quórum estatístico (N >= 5)
  5. Cria múltiplos ciclos de pesquisa cronológicos/aleatórios com ondas temporais repetidas:
     - Permite comparar a evolução ao longo do tempo (deltas, tendências, gráficos temporais)
     - Suporta os 9 modelos oficiais do catálogo psicossocial (NR-1, Maslach, COPSOQ, etc.)
  6. Abre pesquisas gerando tokens individuais seguros
  7. Responde pesquisas com motor de personas sensível ao contexto e à evolução temporal
  8. Encerra pesquisas sequencialmente, processando relatórios comparativos, deltas,
     diagnósticos contextuais, score de risco integrado e recomendações de intervenção.

Uso:
  python scripts/simulate_usage.py
  python scripts/simulate_usage.py --random-cycles --surveys 6
  python scripts/simulate_usage.py --cycles-mode comparative --surveys 6
  python scripts/simulate_usage.py --employees 120 --surveys 5 --scenario stressed
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
from typing import Any

# Force UTF-8 output on Windows
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    except Exception:
        pass

# ---------------------------------------------------------------------------
# Configuração & Catálogos de Apoio
# ---------------------------------------------------------------------------

DEFAULT_BASE_URL = "http://localhost:3000"

FIRST_NAMES_M = [
    "Lucas", "Gabriel", "Arthur", "Miguel", "Rafael", "Matheus", "Pedro",
    "Henrique", "Gustavo", "Felipe", "Bruno", "Leonardo", "Vinícius",
    "Thiago", "André", "Diego", "Rodrigo", "Caio", "Daniel", "Eduardo",
    "Fernando", "João", "Marcos", "Paulo", "Ricardo", "Sérgio", "Carlos",
    "Fábio", "Alexandre", "Roberto", "Leandro", "Wallace", "Anderson",
    "Davi", "Samuel", "Luan", "Enzo", "Bernardo", "Nicolas", "Guilherme",
    "Marcelo", "Renato", "Vitor", "Murilo", "Breno", "Igor", "Otávio",
]

FIRST_NAMES_F = [
    "Ana", "Beatriz", "Camila", "Daniela", "Eduarda", "Fernanda",
    "Gabriela", "Helena", "Isabela", "Juliana", "Karla", "Larissa",
    "Mariana", "Natália", "Olivia", "Patrícia", "Rafaela", "Sofia",
    "Tatiana", "Vanessa", "Letícia", "Amanda", "Carolina", "Débora",
    "Elaine", "Flávia", "Giovana", "Heloísa", "Ingrid", "Jéssica",
    "Laura", "Luana", "Maria", "Michele", "Raquel", "Renata", "Sabrina",
    "Thaís", "Vitória", "Yasmin", "Bruna", "Aline", "Priscila", "Clara",
]

LAST_NAMES = [
    "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira",
    "Almeida", "Nascimento", "Lima", "Araújo", "Melo", "Barbosa",
    "Carvalho", "Ribeiro", "Gomes", "Martins", "Rocha", "Costa",
    "Pereira", "Fernandes", "Mendes", "Correia", "Vieira", "Moreira",
    "Nunes", "Monteiro", "Cardoso", "Teixeira", "Pinto", "Reis",
    "Lopes", "Freitas", "Andrade", "Dias", "Machado", "Borges",
    "Castro", "Campos", "Moura", "Bezerra", "Brito", "Cunha",
    "Guimarães", "Farias", "Cardoso", "Cavalcanti", "Vasconcelos",
]

COMPANY_NAMES = [
    "TechBrasil Inovação & Soluções", "Grupo Nova Energia S.A.",
    "Indústria Metalmecânica Aço Forte", "LogiSul Transportes & Logística",
    "Rede Integrada Mais Saúde", "Construtora Horizonte Moderno",
    "AgroTech Nordeste Sustentável", "Instituto Educacional Futuro",
    "Farmacêutica Central do Brasil", "EngenhariaMax Projetos Industriais",
    "Distribuidora Rio Grande de Alimentos", "Cooperativa Vale do Sol",
]

DEPARTMENTS = [
    ("Operações & Produção", "#DC2626"),
    ("Tecnologia & Sistemas", "#2563EB"),
    ("Comercial & Vendas", "#16A34A"),
    ("RH & Gestão de Pessoas", "#EA580C"),
    ("Financeiro & Controladoria", "#0891B2"),
    ("Logística & Supply Chain", "#CA8A04"),
    ("Segurança do Trabalho & SST", "#059669"),
    ("Qualidade & Processos", "#DB2777"),
]

# ---------------------------------------------------------------------------
# Catálogo Completo de Instrumentos Psicossociais Oficiais
# ---------------------------------------------------------------------------

AVAILABLE_MODELS = [
    {
        "model": "NR-1 & GRO — Diagnóstico de Condições & Organização do Trabalho",
        "tag": "GRO",
        "name": "Condições & Organização GRO",
        "short_title": "Diagnóstico GRO",
    },
    {
        "model": "COPSOQ II (Versão Curta) — Exigências Psicológicas & Carga de Trabalho",
        "tag": "COPSOQ",
        "name": "Carga & Exigências COPSOQ",
        "short_title": "Demandas COPSOQ",
    },
    {
        "model": "Segurança Psicológica & Autonomia no Trabalho (Escala Edmondson)",
        "tag": "Edmondson",
        "name": "Segurança Psicológica Edmondson",
        "short_title": "Clima & Edmondson",
    },
    {
        "model": "Inventário Maslach (MBI Triad) — Exaustão, Cinismo & Eficácia",
        "tag": "Maslach",
        "name": "Inventário de Burnout Maslach",
        "short_title": "Sobrecarga Maslach",
    },
    {
        "model": "Suporte da Liderança & Justiça Organizacional",
        "tag": "Liderança",
        "name": "Suporte & Confiança na Liderança",
        "short_title": "Suporte da Liderança",
    },
    {
        "model": "Prevenção ao Assédio & Canal de Escuta Protegida (Lei 14.457/22)",
        "tag": "CIPA",
        "name": "Prevenção ao Assédio CIPA",
        "short_title": "Compliance Lei 14.457",
    },
    {
        "model": "Gestão de Mudanças Organizacionais & Prontidão de Transição",
        "tag": "Mudanças",
        "name": "Gestão de Transição & Mudanças",
        "short_title": "Prontidão de Mudanças",
    },
    {
        "model": "Pulso Ágil Mensal NR-1 — Termômetro de Estabilidade Psicossocial",
        "tag": "Pulso",
        "name": "Pulso Ágil Mensal NR-1",
        "short_title": "Pulso Ágil Mensal",
    },
    {
        "model": "Eficácia das Medidas Preventivas & Plano de Ação PGR",
        "tag": "Eficácia PGR",
        "name": "Eficácia das Ações PGR",
        "short_title": "Eficácia Ações PGR",
    },
]

# Períodos temporais cronológicos para simulação de evolução no tempo
TEMPORAL_PERIODS = [
    "1º Tri/2024", "2º Tri/2024", "3º Tri/2024", "4º Tri/2024",
    "1º Tri/2025", "2º Tri/2025", "3º Tri/2025", "4º Tri/2025",
    "1º Tri/2026", "2º Tri/2026", "3º Tri/2026", "4º Tri/2026",
]

# Sequência fixa legada para compatibilidade retroativa estrita
LEGACY_HISTORICAL_CYCLES = [
    ("Ciclo 1 — Diagnóstico Inicial GRO", "NR-1 & GRO — Diagnóstico de Condições & Organização do Trabalho"),
    ("Ciclo 2 — Monitoramento de Sobrecarga", "Inventário Maslach (MBI Triad) — Exaustão, Cinismo & Eficácia"),
    ("Ciclo 3 — Demandas Psicológicas COPSOQ", "COPSOQ II (Versão Curta) — Exigências Psicológicas & Carga de Trabalho"),
    ("Ciclo 4 — Clima & Confiança Interpessoal", "Segurança Psicológica & Autonomia no Trabalho (Escala Edmondson)"),
    ("Ciclo 5 — Eficácia das Ações PGR", "Eficácia das Medidas Preventivas & Plano de Ação PGR"),
]

def build_simulation_cycles(rng: random.Random, num_surveys: int, mode: str = "comparative") -> list[dict]:
    """
    Gera uma sequência cronológica de pesquisas com ondas temporais repetidas.
    Garante que os instrumentos se repitam ao longo do tempo para viabilizar
    cálculo de deltas históricos, tendências evolutivas e comparações temporais.
    """
    if mode == "fixed":
        return [
            {
                "cycle": name,
                "title": f"Avaliação Coletiva — {name}",
                "model": model,
                "wave": 0,
                "period": f"Etapa {i + 1}",
            }
            for i, (name, model) in enumerate(LEGACY_HISTORICAL_CYCLES[:num_surveys])
        ]

    # Seleção de instrumentos base:
    # Para comparar ao longo do tempo, precisamos de ondas repetidas do mesmo instrumento
    if mode == "random":
        available_pool = list(AVAILABLE_MODELS)
        rng.shuffle(available_pool)
        # Seleciona de 2 a 3 instrumentos aleatórios do catálogo
        k_models = max(2, min(3, num_surveys // 2 if num_surveys >= 4 else 2))
        selected_models = available_pool[:k_models]
    else:  # comparative (padrão)
        # Sempre inclui NR-1/GRO e COPSOQ (ou Edmondson) para assegurar comparabilidade ideal
        selected_models = [AVAILABLE_MODELS[0], AVAILABLE_MODELS[1]]
        if num_surveys >= 5:
            selected_models.append(AVAILABLE_MODELS[2])

    # Períodos temporais retroativos até a data atual
    periods = TEMPORAL_PERIODS[-(num_surveys + 1):-1]
    if len(periods) < num_surveys:
        periods = TEMPORAL_PERIODS[:num_surveys]

    cycles = []
    model_wave_count = {m["model"]: 0 for m in selected_models}

    for idx in range(num_surveys):
        chosen_info = selected_models[idx % len(selected_models)]
        m_name = chosen_info["model"]
        m_tag = chosen_info["tag"]
        wave = model_wave_count[m_name]
        model_wave_count[m_name] += 1
        period = periods[idx]

        wave_label = "Baseline" if wave == 0 else f"{wave + 1}ª Onda"
        cycle_name = f"Ciclo {idx + 1} ({period}) — {m_tag} {wave_label}"
        title = f"Avaliação Coletiva — {cycle_name}"

        cycles.append({
            "cycle": cycle_name,
            "title": title,
            "model": m_name,
            "wave": wave,
            "period": period,
            "model_info": chosen_info,
        })

    return cycles


PERSONALITY_PROFILES = {
    "otimista": {
        "description": "Engajado e resiliente, tende a notas altas",
        "weights": [0.02, 0.05, 0.15, 0.40, 0.38],
    },
    "neutro": {
        "description": "Equilibrado, pontua no centro",
        "weights": [0.08, 0.15, 0.35, 0.28, 0.14],
    },
    "pessimista": {
        "description": "Insatisfeito, notas moderadamente baixas",
        "weights": [0.25, 0.30, 0.25, 0.12, 0.08],
    },
    "misto": {
        "description": "Variação ampla conforme o tema",
        "weights": [0.15, 0.15, 0.20, 0.25, 0.25],
    },
    "critico": {
        "description": "Exigente, aponta gargalos pontuais",
        "weights": [0.10, 0.25, 0.35, 0.20, 0.10],
    },
    "engajado": {
        "description": "Promotor da cultura, notas altas",
        "weights": [0.03, 0.08, 0.18, 0.41, 0.30],
    },
    "esgotado": {
        "description": "Sobrecarga severa, notas predominantemente baixas",
        "weights": [0.40, 0.30, 0.18, 0.08, 0.04],
    },
}

SCENARIOS = {
    "balanced": {
        "description": "Empresa equilibrada com variação natural saudável",
        "profile_distribution": {
            "otimista": 0.20, "neutro": 0.25, "engajado": 0.22,
            "critico": 0.15, "misto": 0.10, "pessimista": 0.05,
            "esgotado": 0.03,
        },
    },
    "stressed": {
        "description": "Empresa sob forte pressão operacional com índices críticos de esgotamento",
        "profile_distribution": {
            "esgotado": 0.32, "pessimista": 0.25, "critico": 0.20,
            "misto": 0.10, "neutro": 0.08, "engajado": 0.03, "otimista": 0.02,
        },
    },
    "thriving": {
        "description": "Excelente clima psicossocial, alta confiança e autonomia",
        "profile_distribution": {
            "engajado": 0.38, "otimista": 0.32, "neutro": 0.18,
            "misto": 0.07, "critico": 0.03, "pessimista": 0.01, "esgotado": 0.01,
        },
    },
}

# ---------------------------------------------------------------------------
# HTTP Client Otimizado com Retries & Auto-Cookie
# ---------------------------------------------------------------------------

class EquilibraClient:
    """HTTP Client rápido e resiliente para simulação em massa."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.cookies: dict[str, str] = {}
        self.request_count = 0
        self.request_delay = (0.002, 0.008)

    def _delay(self):
        time.sleep(random.uniform(*self.request_delay))

    def _request(self, method: str, path: str, data: dict | None = None, _retry: int = 0) -> dict | None:
        url = f"{self.base_url}/api{path}"
        headers = {"Content-Type": "application/json"}

        if self.cookies:
            headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in self.cookies.items())

        body = json.dumps(data).encode("utf-8") if data else None
        req = urllib.request.Request(url, data=body, headers=headers, method=method)

        try:
            self._delay()
            self.request_count += 1

            with urllib.request.urlopen(req, timeout=15) as resp:
                status = resp.status
                raw = resp.read().decode("utf-8")

                for header in resp.headers.get_all("Set-Cookie") or []:
                    parts = header.split(";")[0].split("=", 1)
                    if len(parts) == 2:
                        self.cookies[parts[0].strip()] = parts[1].strip()

                if raw:
                    try:
                        return json.loads(raw)
                    except json.JSONDecodeError:
                        return {"ok": True, "raw": raw}
                return {"ok": True, "status": status}

        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            try:
                error_json = json.loads(error_body)
                msg = error_json.get("error", error_body)
            except Exception:
                msg = error_body
            if _retry < 2 and e.code in (502, 503):
                time.sleep(1)
                return self._request(method, path, data, _retry + 1)
            print(f"  ✗ HTTP {e.code}: {msg[:100]}")
            return None

        except (ConnectionResetError, urllib.error.URLError) as e:
            if _retry < 3:
                wait = (2 ** _retry) * 0.5
                time.sleep(wait)
                return self._request(method, path, data, _retry + 1)
            print(f"  ✗ Conexão falhou após tentativas: {e}")
            return None

    def get(self, path: str) -> dict | None:
        return self._request("GET", path)

    def post(self, path: str, data: dict | None = None) -> dict | None:
        return self._request("POST", path, data)

    def put(self, path: str, data: dict | None = None) -> dict | None:
        return self._request("PUT", path, data)

    def clear_session(self):
        self.cookies = {}


# ---------------------------------------------------------------------------
# Gerador de Dados Realistas
# ---------------------------------------------------------------------------

class DataGenerator:
    def __init__(self, rng: random.Random):
        self.rng = rng
        self._used_emails: set[str] = set()

    def company_name(self) -> str:
        return self.rng.choice(COMPANY_NAMES)

    def person_name(self) -> str:
        first = self.rng.choice(FIRST_NAMES_M if self.rng.random() < 0.5 else FIRST_NAMES_F)
        l1 = self.rng.choice(LAST_NAMES)
        l2 = self.rng.choice(LAST_NAMES)
        while l2 == l1:
            l2 = self.rng.choice(LAST_NAMES)
        return f"{first} {l1} {l2}"

    def email(self, name: str) -> str:
        base = name.lower()
        for c, r in [(" ", "."), ("á", "a"), ("é", "e"), ("í", "i"), ("ó", "o"), ("ú", "u"),
                     ("ã", "a"), ("õ", "o"), ("ç", "c"), ("ê", "e"), ("â", "a")]:
            base = base.replace(c, r)
        domain = self.rng.choice(["empresa.com.br", "corp.com.br", "inovacao.ind.br"])
        addr = f"{base}@{domain}"
        cnt = 1
        while addr in self._used_emails:
            addr = f"{base}{cnt}@{domain}"
            cnt += 1
        self._used_emails.add(addr)
        return addr

    def phone(self) -> str:
        ddd = self.rng.choice(["11", "21", "31", "41", "51", "61", "19", "27"])
        num = f"9{''.join(str(self.rng.randint(0, 9)) for _ in range(8))}"
        return f"({ddd}) {num[:5]}-{num[5:]}"

    def password(self) -> str:
        chars = string.ascii_letters + string.digits + "!@#$"
        return "".join(self.rng.choice(chars) for _ in range(14))


# ---------------------------------------------------------------------------
# Motor de Resposta Sensível ao Instrumento & Contexto Setorial com Evolução Temporal
# ---------------------------------------------------------------------------

class ContextualPersonaEngine:
    """
    Gera respostas onde o conteúdo reflete:
    1. O cenário geral da empresa
    2. A persona individual do colaborador
    3. O tipo de instrumento psicossocial
    4. O departamento (Operações vs Comercial vs TI vs RH)
    5. A evolução longitudinal no tempo (ondas subsequentes pós-intervenção)
    """

    def __init__(self, rng: random.Random, persona_name: str, department_name: str, scenario: str):
        self.rng = rng
        self.profile = PERSONALITY_PROFILES[persona_name]
        self.dept = department_name.lower()
        self.scenario = scenario

    def generate_answers(self, factor_keys: list[str], survey_model: str, wave_index: int = 0) -> dict[str, int]:
        model_low = survey_model.lower()
        answers = {}

        # Ajuste setorial de vulnerabilidade
        dept_stress_bias = 0.0
        if "operações" in self.dept or "produção" in self.dept:
            dept_stress_bias = -0.35  # Maior desgaste físico e prazos rígidos
        elif "comercial" in self.dept or "vendas" in self.dept:
            dept_stress_bias = -0.25  # Cobrança por metas agressivas
        elif "ti" in self.dept or "sistemas" in self.dept:
            dept_stress_bias = -0.20  # Sobrecarga cognitiva
        elif "rh" in self.dept or "segurança" in self.dept:
            dept_stress_bias = 0.20   # Maior consciência preventiva

        # Efeito de evolução longitudinal ao longo do tempo (intervenções do PGR)
        temporal_intervention_bias = 0.0
        if wave_index == 1:
            temporal_intervention_bias = self.rng.uniform(0.15, 0.35)  # Primeiros ganhos após ações
        elif wave_index >= 2:
            temporal_intervention_bias = self.rng.uniform(0.25, 0.50)  # Consolidação das medidas preventivas

        for key in factor_keys:
            key_low = key.lower()
            weights = list(self.profile["weights"])

            # Sensibilidade contextual ao instrumento
            factor_bias = 0.0

            if "maslach" in model_low or "burnout" in model_low:
                if "exaust" in key_low or "sobrecarga" in key_low or "fadiga" in key_low:
                    factor_bias = -0.5 if self.scenario == "stressed" else -0.1
                elif "realizacao" in key_low or "eficacia" in key_low:
                    factor_bias = 0.3 if self.scenario == "thriving" else -0.2

            elif "segurança" in model_low or "edmondson" in model_low:
                if "expressao" in key_low or "erro" in key_low or "confianca" in key_low:
                    factor_bias = -0.4 if self.scenario == "stressed" else 0.2

            elif "copsoq" in model_low:
                if "ritmo" in key_low or "cognitiv" in key_low or "emocional" in key_low:
                    factor_bias = -0.45 if "operações" in self.dept else -0.15

            # Soma os vieses setorial, do fator e de evolução temporal
            total_bias = dept_stress_bias + factor_bias + temporal_intervention_bias

            # Aplica viés aos pesos da escala 1-5
            if total_bias < -0.2:
                weights[0] *= 1.8
                weights[1] *= 1.6
                weights[3] *= 0.6
                weights[4] *= 0.4
            elif total_bias > 0.2:
                weights[0] *= 0.4
                weights[1] *= 0.6
                weights[3] *= 1.6
                weights[4] *= 1.8

            # Ruído individual gaussiano
            noise = [max(0.01, w + self.rng.gauss(0, 0.05)) for w in weights]
            total = sum(noise)
            norm = [w / total for w in noise]

            answers[key] = self.rng.choices([1, 2, 3, 4, 5], weights=norm, k=1)[0]

        return answers


# ---------------------------------------------------------------------------
# Simulador Principal de Massa com Ciclos Temporais & Comparativos
# ---------------------------------------------------------------------------

class EquilibraMassSimulator:
    def __init__(self, base_url: str, seed: int | None = None,
                 num_employees: int = 120, num_surveys: int = 5,
                 scenario: str = "balanced", response_rate: float = 0.88,
                 cycles_mode: str = "comparative"):
        self.client = EquilibraClient(base_url)
        self.seed = seed or random.randint(100000, 999999)
        self.rng = random.Random(self.seed)
        self.gen = DataGenerator(self.rng)
        self.num_employees = max(num_employees, 20)
        self.num_surveys = min(max(num_surveys, 2), 12)
        self.scenario = scenario
        self.response_rate = min(max(response_rate, 0.6), 1.0)
        self.cycles_mode = cycles_mode

        self.account: dict[str, Any] = {}
        self.members: list[dict] = []
        self.groups: list[dict] = []
        self.member_departments: dict[str, str] = {}
        self.member_personas: dict[str, str] = {}
        self.surveys: list[dict] = []
        self.simulation_cycles: list[dict] = []

        self.stats = {
            "employees_created": 0,
            "groups_created": 0,
            "surveys_created": 0,
            "surveys_opened": 0,
            "responses_sent": 0,
            "surveys_closed": 0,
            "reports_generated": 0,
            "comparisons_generated": 0,
        }

    def run(self) -> bool:
        print()
        print("=" * 66)
        print("   EQUILIBRA — GERAÇÃO DE DADOS EM MASSA COM ANÁLISE CONTEXTUAL")
        print("=" * 66)
        print(f"  Seed de Reprodutibilidade: {self.seed}")
        print(f"  Volume de Colaboradores:   {self.num_employees}")
        print(f"  Ciclos / Pesquisas:        {self.num_surveys} (Modo: {self.cycles_mode.upper()})")
        print(f"  Cenário Psicossocial:      {self.scenario.upper()} — {SCENARIOS[self.scenario]['description']}")
        print(f"  Adesão Estimada:           {self.response_rate:.0%}")
        print(f"  Servidor Alvo:             {self.client.base_url}")
        print("=" * 66)
        print()

        if not self._check_server():
            return False

        steps = [
            ("1/7", "Registro de Conta Empresarial", self._step_register),
            ("2/7", "Cadastro em Massa de Funcionários", self._step_create_employees),
            ("3/7", "Criação de Departamentos Organizacionais", self._step_create_groups),
            ("4/7", "Alocação Estruturada nos Grupos (N >= 5)", self._step_assign_to_groups),
            ("5/7", "Abertura de Ciclos Históricos Comparáveis", self._step_create_surveys),
            ("6/7", "Coleta Massiva de Respostas Psicossociais", self._step_respond_surveys),
            ("7/7", "Encerramento e Apuração de Deltas & Tendências", self._step_close_surveys),
        ]

        for step_num, title, fn in steps:
            print(f"\n{'─' * 66}")
            print(f"  [{step_num}] {title}...")
            print(f"{'─' * 66}")
            if not fn():
                print(f"\n  [FALHA] Falha no passo {step_num}: {title}")
                return False

        self._print_final_report()
        return True

    def _check_server(self) -> bool:
        print("  Verificando integridade da API...")
        try:
            req = urllib.request.Request(f"{self.client.base_url}/health")
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode())
                if data.get("status") == "ok":
                    print("  [OK] Servidor online e respondendo perfeitamente.")
                    return True
        except Exception as e:
            print(f"  [ERRO] Servidor inacessível em {self.client.base_url}: {e}")
            print("  Certifique-se de que o servidor está rodando (npm start ou npm run dev).")
            return False
        return False

    def _step_register(self) -> bool:
        company = self.gen.company_name()
        admin_name = self.gen.person_name()
        admin_email = self.gen.email(admin_name)
        password = self.gen.password()

        print(f"  Empresa: {company}")
        print(f"  Administrador: {admin_name} ({admin_email})")
        print(f"  Senha de Acesso: {password}")

        result = self.client.post("/auth/register", {
            "name": admin_name,
            "company": company,
            "email": admin_email,
            "password": password,
        })

        if not result or not result.get("id"):
            return False

        self.account = result
        print(f"  [OK] Conta empresarial criada com sucesso! (ID: {result['id']})")
        return True

    def _step_create_employees(self) -> bool:
        print(f"  Cadastrando {self.num_employees} colaboradores com perfis validados...")
        batch_personas = SCENARIOS[self.scenario]["profile_distribution"]
        p_keys = list(batch_personas.keys())
        p_weights = list(batch_personas.values())

        for i in range(self.num_employees):
            name = self.gen.person_name()
            email = self.gen.email(name)
            phone = self.gen.phone()

            res = self.client.post("/members", {
                "name": name,
                "email": email,
                "phone": phone,
            })

            if res and res.get("id"):
                self.members.append(res)
                assigned_p = self.rng.choices(p_keys, weights=p_weights, k=1)[0]
                self.member_personas[res["id"]] = assigned_p
                self.stats["employees_created"] += 1

                if (i + 1) % 15 == 0 or (i + 1) == self.num_employees:
                    pct = (i + 1) / self.num_employees
                    bar = "█" * int(pct * 30) + "░" * (30 - int(pct * 30))
                    print(f"\r  [{bar}] {i + 1}/{self.num_employees} colaboradores processados", end="")

        print(f"\n  [OK] Total de {len(self.members)} colaboradores cadastrados.")
        return len(self.members) >= 10

    def _step_create_groups(self) -> bool:
        num_depts = min(6, max(4, len(self.members) // 18))
        chosen_depts = list(DEPARTMENTS)[:num_depts]

        print(f"  Criando {len(chosen_depts)} departamentos com quórum protegido...")

        for dept_name, color in chosen_depts:
            res = self.client.post("/groups", {
                "name": dept_name,
                "memberIds": [],
                "color": color,
            })
            if res and res.get("id"):
                self.groups.append(res)
                self.stats["groups_created"] += 1
                print(f"    • {dept_name}")

        return len(self.groups) >= 2

    def _step_assign_to_groups(self) -> bool:
        print(f"  Alocando {len(self.members)} pessoas nos {len(self.groups)} departamentos...")
        shuffled = list(self.members)
        self.rng.shuffle(shuffled)

        k = len(self.groups)
        chunk_size = len(shuffled) // k

        for i, group in enumerate(self.groups):
            start = i * chunk_size
            end = len(shuffled) if i == k - 1 else (i + 1) * chunk_size
            dept_members = shuffled[start:end]
            member_ids = [m["id"] for m in dept_members]

            for m in dept_members:
                self.member_departments[m["id"]] = group["name"]

            self.client.put(f"/groups/{group['id']}", {
                "name": group["name"],
                "memberIds": member_ids,
                "color": group.get("color"),
            })

            print(f"    • {group['name']:30s} -> {len(member_ids)} membros (N >= 5 garantido)")

        return True

    def _step_create_surveys(self) -> bool:
        print(f"  Estruturando {self.num_surveys} ciclos com ondas cronológicas...")
        all_groups = self.client.get("/groups") or []
        target_group_ids = [g["id"] for g in all_groups if not g.get("isDefault")]

        self.simulation_cycles = build_simulation_cycles(self.rng, self.num_surveys, self.cycles_mode)

        for i, cycle_data in enumerate(self.simulation_cycles):
            cycle_name = cycle_data["cycle"]
            title = cycle_data["title"]
            model_name = cycle_data["model"]
            wave = cycle_data.get("wave", 0)
            period = cycle_data.get("period", "")
            ends_at = (datetime.now() + timedelta(days=15 + i * 10)).isoformat()

            print(f"\n    [{i+1}/{self.num_surveys}] {title}")
            print(f"       Modelo: {model_name} (Onda: {wave + 1} | Período: {period})")

            created = self.client.post("/surveys", {
                "title": title,
                "model": model_name,
                "cycle": cycle_name,
                "groupIds": target_group_ids,
                "endsAt": ends_at,
            })

            if not created or not created.get("id"):
                print("       ✗ Falha ao criar rascunho de pesquisa")
                continue

            survey_id = created["id"]
            self.stats["surveys_created"] += 1

            opened = self.client.post(f"/surveys/{survey_id}/open")
            if not opened or not opened.get("links"):
                print("       ✗ Falha ao abrir convites da pesquisa")
                continue

            links = opened.get("links", [])
            self.surveys.append({
                "id": survey_id,
                "title": title,
                "model": model_name,
                "cycle": cycle_name,
                "wave": wave,
                "period": period,
                "links": links,
            })
            self.stats["surveys_opened"] += 1
            print(f"       ✓ Aberta com {len(links)} convites individuais gerados")

        return len(self.surveys) > 0

    def _step_respond_surveys(self) -> bool:
        print(f"\n  Iniciando coleta automatizada com respostas e evolução temporal...")

        for s_idx, survey_info in enumerate(self.surveys):
            survey_id = survey_info["id"]
            model = survey_info["model"]
            links = survey_info["links"]
            title = survey_info["title"]
            wave = survey_info.get("wave", 0)

            print(f"\n    Respondendo Ciclo {s_idx + 1}/{len(self.surveys)} (Onda {wave + 1}): {title}")

            total_invited = len(links)
            rate = min(1.0, max(0.68, self.response_rate + self.rng.uniform(-0.05, 0.04)))
            num_to_respond = max(5, int(total_invited * rate))

            selected_links = list(links)
            self.rng.shuffle(selected_links)
            selected_links = selected_links[:num_to_respond]

            first_token = selected_links[0]["token"]
            saved_cookies = dict(self.client.cookies)
            self.client.clear_session()
            spec = self.client.get(f"/respond/{first_token}")
            self.client.cookies = saved_cookies

            if not spec or not spec.get("factors"):
                print(f"       ✗ Erro ao obter formulário da pesquisa")
                continue

            factor_keys = [f["key"] for f in spec["factors"]]
            responded = 0

            for link_data in selected_links:
                token = link_data["token"]
                m_id = link_data.get("memberId", "")
                persona = self.member_personas.get(m_id, "neutro")
                dept = self.member_departments.get(m_id, "Geral")

                engine = ContextualPersonaEngine(self.rng, persona, dept, self.scenario)
                answers = engine.generate_answers(factor_keys, model, wave_index=wave)

                self.client.clear_session()
                post_res = self.client.post(f"/respond/{token}", {"answers": answers})
                self.client.cookies = saved_cookies

                if post_res and post_res.get("ok"):
                    responded += 1
                    self.stats["responses_sent"] += 1

                if responded % 15 == 0 or responded == num_to_respond:
                    pct = responded / num_to_respond
                    bar = "█" * int(pct * 25) + "░" * (25 - int(pct * 25))
                    print(f"\r       [{bar}] {responded}/{num_to_respond} respostas ({responded/total_invited:.0%})", end="")

            print(f"\n       ✓ Concluído: {responded} respostas coletadas com sucesso.")

        return self.stats["responses_sent"] > 0

    def _step_close_surveys(self) -> bool:
        print(f"\n  Fechando ciclos e computando deltas comparativos históricos...")

        for s_idx, survey_info in enumerate(self.surveys):
            survey_id = survey_info["id"]
            title = survey_info["title"]

            # Pequena pausa para garantir timestamps closedAt estritamente crescentes
            time.sleep(0.15)

            res = self.client.post(f"/surveys/{survey_id}/close", {
                "confirmEarlyClose": True,
                "reason": "Encerramento planejado para apuração de resultados NR-1",
            })

            if res and res.get("reportId"):
                self.stats["surveys_closed"] += 1
                self.stats["reports_generated"] += 1

                # Inspeciona relatório para verificar cálculo de comparação temporal
                rep = self.client.get(f"/reports/{res['reportId']}")
                comp = rep.get("comparison") if rep else None

                if comp and comp.get("comparable"):
                    self.stats["comparisons_generated"] += 1
                    prev_cycle = comp.get("previousCycle") or "ciclo anterior"
                    factors_with_delta = [f for f in comp.get("factors", []) if f.get("delta") is not None]
                    best_f = max(factors_with_delta, key=lambda x: x["delta"], default=None)
                    worst_f = min(factors_with_delta, key=lambda x: x["delta"], default=None)

                    print(f"    ✓ {title[:48]:48s} -> Relatório Gerado")
                    print(f"      ★ COMPARAÇÃO TEMPORAL DETECTADA vs '{prev_cycle}':")
                    if best_f:
                        ds = "+" if best_f['delta'] > 0 else ""
                        print(f"        • Maior Evolução: \"{best_f['label']}\" ({ds}{best_f['delta']:.2f})")
                    if worst_f and worst_f != best_f and worst_f['delta'] < 0:
                        print(f"        • Maior Declínio: \"{worst_f['label']}\" ({worst_f['delta']:.2f})")
                else:
                    print(f"    ✓ {title[:48]:48s} -> Relatório Gerado (Inaugural / Baseline)")
            else:
                print(f"    ⚠ {title[:48]:48s} -> Fechada sem relatório formal")

        reports = self.client.get("/reports") or []
        print(f"\n  [OK] {len(reports)} relatórios consolidados no banco de dados.")

        if reports:
            print("\n  " + "═" * 62)
            print("  EXEMPLO DE DIAGNÓSTICO CONTEXTUAL COMPUTADO:")
            print("  " + "═" * 62)
            last_report = reports[0]
            insights = last_report.get("insights")
            if insights:
                print(f"  • Instrumento:       {last_report.get('model', 'N/A')}")
                print(f"  • Score de Risco:    {insights.get('riskScore', 'N/A')} ({insights.get('riskLevel', 'N/A').upper()})")
                print(f"  • Diagnóstico:       {insights.get('diagnostico', {}).get('label', 'N/A')}")
                print(f"  • Narrativa:")
                print(f"    \"{insights.get('narrativa', '')[:180]}...\"")
                recs = insights.get("recomendacoes", [])
                if recs:
                    print(f"  • Recomendações Prioritárias ({len(recs)} geradas):")
                    for r in recs[:2]:
                        print(f"    - [{r.get('urgencia', '').upper()}] {r.get('acao')}")
                trends = insights.get("tendencias", [])
                if trends:
                    print(f"  • Tendências vs Ciclo Anterior ({len(trends)} fatores rastreados):")
                    for t in trends[:3]:
                        arrow = "↑" if t.get("direction") == "melhora" else "↓" if t.get("direction") == "piora" else "→"
                        d = t.get("delta", 0)
                        ds = f"+{d:.2f}" if d > 0 else f"{d:.2f}"
                        print(f"    {arrow} {t.get('label')}: {ds} (Atual: {t.get('mediaAtual', 0):.2f})")
            else:
                print("  (Relatório processado sob os padrões estatísticos NR-1)")

        return self.stats["surveys_closed"] > 0

    def _print_final_report(self):
        print()
        print("=" * 66)
        print("                   SIMULAÇÃO EM MASSA CONCLUÍDA")
        print("=" * 66)
        print(f"  Empresa:                   {self.account.get('company', 'N/A')}")
        print(f"  Administrador:             {self.account.get('email', 'N/A')}")
        print(f"  Funcionários Ativos:       {self.stats['employees_created']}")
        print(f"  Departamentos Criados:     {self.stats['groups_created']}")
        print(f"  Ciclos Históricos:         {self.stats['surveys_closed']}")
        print(f"  Comparações Temporais:     {self.stats['comparisons_generated']} ciclos com deltas calculados")
        print(f"  Total de Respostas:        {self.stats['responses_sent']}")
        print(f"  Relatórios & Diagnósticos: {self.stats['reports_generated']}")
        print(f"  Requisições HTTP Totais:   {self.client.request_count}")
        print("-" * 66)
        print(f"  Para visualizar os dashboards e relatórios contextuais:")
        print(f"  {self.client.base_url}")
        print("=" * 66)
        print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Equilibra — Simulação automatizada de uso real em massa com diagnósticos contextuais e ciclos temporais",
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"URL base (padrão: {DEFAULT_BASE_URL})")
    parser.add_argument("--seed", type=int, default=None, help="Seed para reprodução")
    parser.add_argument("--employees", type=int, default=120, help="Total de funcionários (padrão: 120)")
    parser.add_argument("--surveys", type=int, default=5, help="Total de pesquisas/ciclos (padrão: 5)")
    parser.add_argument("--scenario", choices=list(SCENARIOS.keys()), default="balanced", help="Cenário de clima")
    parser.add_argument("--response-rate", type=float, default=0.88, help="Taxa alvo de adesão (padrão: 0.88)")
    parser.add_argument("--random-cycles", action="store_true", help="Sorteia instrumentos aleatórios do catálogo oficial")
    parser.add_argument("--cycles-mode", choices=["comparative", "random", "fixed"], default="comparative",
                        help="Modo de geração de ciclos (padrão: comparative para máxima comparabilidade)")

    args = parser.parse_args()

    mode = "random" if args.random_cycles else args.cycles_mode

    simulator = EquilibraMassSimulator(
        base_url=args.base_url,
        seed=args.seed,
        num_employees=args.employees,
        num_surveys=args.surveys,
        scenario=args.scenario,
        response_rate=args.response_rate,
        cycles_mode=mode,
    )

    success = simulator.run()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
