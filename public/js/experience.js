/* Page composition and navigation. Mutations remain in the management module. */
window.Experience = (() => {
  let settingsRequest = 0;
  const ui = () => Management.components;
  const route = () => location.hash.slice(1).split("?")[0].split("/");
  const link = (label, hash, primary = false) =>
    `<a class="btn ${primary ? "primary" : "secondary"}" href="#${attr(hash)}">${label}</a>`;
  const tag = (label, tone = "") =>
    `<span class="ux-tag ${tone}">${esc(label)}</span>`;
  const panel = (title, content, action = "") =>
    `<section class="ux-panel"><div class="ux-panel-head"><h2>${title}</h2>${action}</div>${content}</section>`;
  const empty = (title, description, action = "") =>
    `<section class="ux-empty"><span class="ux-empty-mark" aria-hidden="true">${icon("resultados")}</span><h2>${title}</h2><p>${description}</p>${action}</section>`;
  const tabs = (items, active, label = "Seções") =>
    `<nav class="ux-tabs" aria-label="${label}">${items.map(([key, title, hash]) => `<a href="#${attr(hash)}" ${active === key ? 'aria-current="page"' : ""}>${title}</a>`).join("")}</nav>`;
  const reportById = (id) => state.reports.find((row) => row.id === id);
  const published = () => state.reports.filter((row) => row.published);
  const today = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
      new Date(),
    );
  const dateText = (value) =>
    date(value?.length === 10 ? `${value}T12:00:00` : value);
  const isLate = (row) =>
    ["planned", "in_progress"].includes(row.status) && row.dueDate < today();
  const needsReview = (row) =>
    row.status === "implemented" && row.reviewDate <= today();
  const timeText = (value) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(new Date(value));
  const readOnly = () => state.account.role === "viewer";
  const factorName = (assessment, report) =>
    report?.result?.find((row) => row.key === assessment.factor)?.label ||
    assessment.factor;

  function icon(name) {
    const names = { geral: "table-cells-large", pessoas: "users", pesquisas: "clipboard-list", resultados: "chart-column", acoes: "list-check", configuracoes: "gear", sair: "right-from-bracket", menu: "bars", fechar: "xmark", busca: "magnifying-glass" };
    return `<i class="fa-solid fa-${names[name] || 'chart-column'}" aria-hidden="true"></i>`;
  }

  function organizationNav() {
    return tabs(
      [
        ["pessoas", "Pessoas", "pessoas"],
        ["grupos", "Grupos", "grupos"],
      ],
      state.tab,
      "Organização",
    );
  }
  function resultNav(active = "ciclos") {
    return tabs(
      [
        ["ciclos", "Ciclos e resultados", "resultados"],
        ["documentos", "Relatórios e histórico", "resultados/documentos"],
      ],
      active,
      "Resultados",
    );
  }
  function overview() {
    const data = state.management;
    if (!data || (!data.assessments.length && !data.actions.length)) return "";
    const queue = [...data.actions]
      .filter((row) => isLate(row) || needsReview(row))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    return `<div class="ux-metrics"><a href="#resultados?avaliacao=pendente"><span>Achados a investigar</span><strong>${data.summary.investigating}</strong><small>Revisar avaliações</small></a><a href="#acoes?f=overdue"><span>Ações atrasadas</span><strong>${data.summary.overdue}</strong><small>Ver prazos vencidos</small></a><a href="#acoes?f=review"><span>Eficácia a verificar</span><strong>${data.summary.reviewDue}</strong><small>Revisar medidas implementadas</small></a></div>${
      queue.length
        ? panel(
            "Prioridades de hoje",
            `<div class="ux-worklist">${queue
              .slice(0, 4)
              .map(
                (row) =>
                  `<a href="#acoes/${attr(row.id)}"><div><strong>${esc(row.title)}</strong><span>${esc(row.owner)} · ${isLate(row) ? "Prazo vencido" : "Revisão de eficácia"} em ${dateText(isLate(row) ? row.dueDate : row.reviewDate)}</span></div>${tag(isLate(row) ? "Atrasada" : "Revisar", "attention")}<span aria-hidden="true">↗</span></a>`,
              )
              .join("")}</div>`,
          )
        : ""
    }`;
  }
  function resultsView() {
    const [, section, id, detail] = route();
    if (section === "documentos") return documentsView();
    if (section === "ciclo") return cycleView(id, detail || "indicadores");
    const pendingOnly =
      new URLSearchParams(location.hash.split("?")[1] || "").get(
        "avaliacao",
      ) === "pendente";
    const reports = published().filter(
      (report) =>
        !pendingOnly ||
        state.management.assessments.some(
          (row) => row.reportId === report.id && row.status === "investigating",
        ),
    );
    shell(
      heading(
        "RESULTADOS",
        "Resultados dos ciclos",
        "Abra um ciclo para examinar os indicadores, avaliar achados e planejar medidas.",
      ) +
        resultNav() +
        (pendingOnly
          ? `<div class="ux-filter-note">Mostrando ciclos com achados em investigação. <a href="#resultados">Limpar filtro</a></div>`
          : "") +
        (reports.length
          ? `<div class="ux-cycle-grid">${reports
              .map((report) => {
                const findings = state.management.assessments.filter(
                  (row) => row.reportId === report.id,
                );
                const actions = state.management.actions.filter((row) =>
                  findings.some((finding) => finding.id === row.assessmentId),
                );
                return `<article class="ux-cycle-card"><div class="ux-card-meta">${tag("Publicado", "positive")}<span>${dateText(report.closedAt)}</span></div><h2><a href="#resultados/ciclo/${attr(report.id)}">${esc(report.title)}</a></h2><p>${esc(report.groupName)} · ${esc(report.cycle)}</p><div class="ux-cycle-counts"><span><strong>${report.responseCount}</strong> respostas</span><span><strong>${findings.length}</strong> achados</span><span><strong>${actions.length}</strong> ações</span></div><div class="ux-card-footer"><span>${findings.some((row) => row.status === "investigating") ? "Avaliação em andamento" : findings.length ? "Avaliação registrada" : "Pronto para análise"}</span>${link("Abrir ciclo", `resultados/ciclo/${report.id}`)}</div></article>`;
              })
              .join("")}</div>`
          : empty(
              pendingOnly
                ? "Nenhum achado pendente"
                : "Os resultados aparecerão aqui",
              pendingOnly
                ? "Os achados registrados já foram avaliados."
                : "Encerre uma pesquisa com volume suficiente de respostas para iniciar a análise.",
              link(
                pendingOnly ? "Ver todos os ciclos" : "Ver pesquisas",
                pendingOnly ? "resultados" : "pesquisas",
              ),
            )),
    );
  }
  function cycleView(id, section) {
    const report = reportById(id);
    if (!report?.published)
      return shell(
        empty(
          "Ciclo indisponível",
          "Este resultado não está disponível para sua conta.",
          link("Voltar aos resultados", "resultados"),
        ),
      );
    const findings = state.management.assessments.filter(
      (row) => row.reportId === id,
    );
    const cycleActions = state.management.actions.filter((row) =>
      findings.some((finding) => finding.id === row.assessmentId),
    );
    const base = `resultados/ciclo/${id}`;
    let body =
      `<a class="ux-back" href="#resultados">← Todos os resultados</a>` +
      heading(
        esc(report.cycle),
        esc(report.title),
        `${esc(report.groupName)} · ${report.responseCount} respostas · encerrado em ${dateText(report.closedAt)}`,
      ) +
      tabs(
        [
          ["indicadores", "Indicadores", base],
          [
            "avaliacoes",
            `Avaliações (${findings.length})`,
            `${base}/avaliacoes`,
          ],
          ...(!readOnly()
            ? [["assistente", "Assistente", `${base}/assistente`]]
            : []),
        ],
        section,
        "Análise do ciclo",
      );
    if (section === "avaliacoes") {
      body += `<div class="ux-section-intro"><div><h2>Da percepção à avaliação</h2><p>Registre o contexto de trabalho e a decisão antes de definir uma medida.</p></div>${!readOnly() ? ui().button("Registrar achado", "new-assessment", id, true) : ""}</div>`;
      body += findings.length
        ? findings
            .map((row) =>
              panel(
                esc(row.title),
                `<div class="ux-assessment-meta">${tag(ui().labels[row.status])}<span>${esc(factorName(row, report))} · Prioridade ${esc(ui().labels[row.classification])}</span></div><p>${esc(row.decision || "Investigue as condições de trabalho e registre as evidências que apoiam a decisão.")}</p><div class="ux-related-actions">${cycleActions
                  .filter((action) => action.assessmentId === row.id)
                  .map(
                    (action) =>
                      `<a href="#acoes/${attr(action.id)}">${icon("acoes")} ${esc(action.title)} <span>${esc(ui().labels[action.status])}</span></a>`,
                  )
                  .join(
                    "",
                  )}</div><div class="ux-inline-actions">${ui().button(readOnly() ? "Consultar avaliação" : "Editar avaliação", "assessment", row.id)}${!readOnly() && row.status === "evaluated" ? ui().button("Planejar ação", "new-action", row.id, true) : ""}</div>`,
              ),
            )
            .join("")
        : empty(
            "Qual sinal merece investigação?",
            "Registre um achado deste ciclo. A avaliação conecta os indicadores às decisões da empresa.",
          );
    } else if (section === "assistente") {
      body +=
        `<p class="ux-context-note">O assistente usa os indicadores deste ciclo. Toda proposta precisa de revisão e aprovação humana.</p>` +
        Management.assistantPanel(id);
    } else {
      const sorted = [...report.result].sort((a, b) => a.average - b.average);
      const lowest = sorted.filter((row) => row.average === sorted[0].average);
      const attention =
        lowest.length === sorted.length
          ? "As médias dos fatores são iguais. Investigue o contexto de trabalho antes de definir prioridades."
          : `Menor percepção em <strong>${lowest.map((row) => esc(row.label)).join(", ")}</strong>. Investigue o contexto antes de definir a prioridade técnica.`;
      body += `<div class="ux-analysis-layout"><div>${panel("Percepção por fator", `<p class="ux-help">Escala de 1 a 5. Valores maiores representam percepção mais favorável.</p>${DashboardCharts.markup(sorted)}<div class="ux-factors">${sorted.map((row) => `<div><div><strong>${esc(row.label)}</strong><span>${fmt(row.average)} <small>/ 5</small></span></div><div class="ux-factor-track"><span style="width:${row.average * 20}%"></span></div></div>`).join("")}</div><details class="ux-details"><summary>Distribuição das respostas</summary>${report.distribution ? report.distribution.map((row) => `<p><strong>${esc(row.label)}:</strong> ${row.suppressed ? "Omitida para proteger grupos pequenos." : row.counts.map((count, i) => `${i + 1}: ${count}`).join(" · ")}</p>`).join("") : "<p>Distribuição indisponível para este instrumento ou relatório.</p>"}</details>`)}</div><aside>${panel("Próximo passo", `<p>${attention}</p>${link(findings.length ? "Continuar avaliação" : "Avaliar os achados", `${base}/avaliacoes`, true)}<div class="ux-mini-stats"><span>Achados registrados: ${findings.length}</span><span>Ações vinculadas: ${cycleActions.length}</span></div>`)}<p class="ux-help">${esc(report.instrument?.limitation || "Médias não determinam diagnóstico, causa ou classificação técnica de risco.")}</p></aside></div>`;
      const previous = published().filter(
        (row) =>
          row.id !== id && new Date(row.closedAt) < new Date(report.closedAt),
      );
      body += panel(
        "Evolução entre ciclos",
        previous.length
          ? `<p class="ux-help">Compare com um ciclo anterior do mesmo instrumento e público.</p><form data-management-form="compare" class="ux-compare-form">${ui().hidden("current", id)}<label>Ciclo de referência<select name="previous" required>${previous.map((row) => `<option value="${attr(row.id)}">${esc(row.title)} · ${esc(row.cycle)}</option>`).join("")}</select></label><button class="btn secondary" type="submit">Comparar ciclos</button></form><div id="comparison-result" aria-live="polite"></div>`
          : '<p class="ux-help">Este é o primeiro ciclo disponível. A comparação aparece quando houver um ciclo anterior compatível.</p>',
      );
    }
    shell(body);
  }
  function actionsView() {
    const id = route()[1];
    if (id) return actionView(id);
    const filter =
      new URLSearchParams(location.hash.split("?")[1] || "").get("f") || "all";
    const all = state.management.actions;
    const rows = all.filter((row) =>
      filter === "overdue"
        ? isLate(row)
        : filter === "review"
          ? needsReview(row)
          : filter === "closed"
            ? ["effective", "ineffective", "cancelled"].includes(row.status)
            : filter === "active"
              ? !["effective", "ineffective", "cancelled"].includes(row.status)
              : true,
    );
    shell(
      heading(
        "PLANOS DE AÇÃO",
        "Do planejamento à eficácia",
        "Acompanhe responsáveis, execução e resultado de cada medida.",
      ) +
        tabs(
          [
            ["all", `Todas (${all.length})`, "acoes"],
            ["active", "Em acompanhamento", "acoes?f=active"],
            ["overdue", "Atrasadas", "acoes?f=overdue"],
            ["review", "Revisar eficácia", "acoes?f=review"],
            ["closed", "Encerradas", "acoes?f=closed"],
          ],
          filter,
          "Filtrar ações",
        ) +
        (all.length
          ? `<div class="ux-list-tools"><label class="ux-search">Buscar ação ou responsável<input type="search" data-ux-search placeholder="Digite para filtrar…"></label><span data-ux-count>${rows.length} ${rows.length === 1 ? "ação" : "ações"}</span></div>`
          : "") +
        (rows.length
          ? `<div class="ux-action-list">${rows.map((row) => `<a class="ux-action-row" href="#acoes/${attr(row.id)}" data-ux-searchable="${attr(`${row.title} ${row.owner}`.toLocaleLowerCase("pt-BR"))}"><div><span class="ux-eyebrow">${esc(row.owner)}</span><h2>${esc(row.title)}</h2><p>Execução: ${dateText(row.dueDate)} · Revisão: ${dateText(row.reviewDate)}</p></div><div class="ux-action-state">${tag(ui().labels[row.status], row.status === "effective" ? "positive" : "")}${isLate(row) ? tag("Atrasada", "attention") : ""}<span aria-hidden="true">↗</span></div></a>`).join("")}</div><p class="ux-search-empty" hidden>Nenhuma ação corresponde à busca.</p>`
          : empty(
              all.length
                ? "Nenhuma ação neste filtro"
                : "As ações começam com uma avaliação",
              all.length
                ? "Escolha outro filtro para consultar as demais medidas."
                : "Examine os resultados de um ciclo e avalie um achado antes de planejar a medida.",
              link(
                all.length ? "Ver todas" : "Abrir resultados",
                all.length ? "acoes" : "resultados",
              ),
            )),
    );
  }
  function actionView(id) {
    const row = state.management.actions.find((item) => item.id === id);
    if (!row)
      return shell(
        empty(
          "Ação indisponível",
          "Este registro não está disponível para sua conta.",
          link("Voltar às ações", "acoes"),
        ),
      );
    const assessment = state.management.assessments.find(
      (item) => item.id === row.assessmentId,
    );
    const report = reportById(assessment?.reportId);
    const terminal = ["effective", "ineffective", "cancelled"].includes(
      row.status,
    );
    let next =
      row.status === "planned"
        ? ui().button("Iniciar execução", "ux-start", id, true)
        : row.status === "in_progress"
          ? `<p>${row.evidence.length ? "Há evidência registrada. Revise a execução e registre a implementação." : "Adicione evidência da execução antes de registrar a implementação."}</p>${ui().button(row.evidence.length ? "Registrar implementação" : "Adicionar evidência", row.evidence.length ? "ux-implement" : "evidence", id, true)}`
          : row.status === "implemented"
            ? `<p>Verifique a medida com base no critério definido. Revisão prevista para ${dateText(row.reviewDate)}.</p>${`<button class="btn primary" data-ux="review-action" data-id="${attr(id)}" ${row.reviewDate > today() ? "disabled" : ""}>Registrar verificação</button>`}`
            : `<p>${row.status === "ineffective" ? "A medida não alcançou o resultado esperado. Revise o plano para iniciar uma nova execução." : row.status === "effective" ? "Eficácia registrada. O histórico permanece disponível para acompanhamento." : "Esta ação foi cancelada."}</p>${row.status === "ineffective" ? ui().button("Revisar plano", "action", id, true) : ""}`;
    const activity = state.management.audit
      .filter((entry) => entry.entityId === id)
      .slice(0, 12);
    shell(
      `<a class="ux-back" href="#acoes">← Todas as ações</a>` +
        heading(
          "PLANO DE AÇÃO",
          esc(row.title),
          `${esc(row.owner)} · Prioridade ${esc(ui().labels[row.priority])}`,
          !readOnly() ? ui().button("Editar ação", "action", id) : "",
        ) +
        `<div class="ux-action-summary">${tag(ui().labels[row.status], row.status === "effective" ? "positive" : row.status === "ineffective" ? "attention" : "")}${isLate(row) ? tag("Atrasada", "attention") : ""}<span>Execução até <strong>${dateText(row.dueDate)}</strong></span><span>Revisão em <strong>${dateText(row.reviewDate)}</strong></span></div><div class="ux-analysis-layout"><div>${panel("Medida e resultado esperado", `<p class="ux-prose">${esc(row.description || "Descrição não registrada.")}</p><h3>Como verificar a eficácia</h3><p class="ux-prose">${esc(row.successCriteria)}</p>`)}${panel("Evidências de execução", row.evidence.length ? row.evidence.map((evidence) => `<article class="ux-evidence"><p>${esc(evidence.description)}</p><small>${esc(evidence.actor)} · ${dateText(evidence.createdAt)}</small>${evidence.url ? `<a href="${attr(evidence.url)}" target="_blank" rel="noopener noreferrer">Abrir documento ↗</a>` : ""}</article>`).join("") : '<p class="ux-help">Registre o que foi realizado e inclua uma referência quando houver documento de apoio.</p>', !readOnly() && !terminal ? ui().button("Adicionar evidência", "evidence", id) : "")}${row.review ? panel("Verificação registrada", `<p class="ux-prose">${esc(row.review)}</p>`) : ""}${panel("Histórico da ação", `<ol class="ux-timeline">${activity.map((entry) => `<li><strong>${esc(eventLabel(entry.event, entry))}</strong><span>${esc(entry.actor)} · ${timeText(entry.at)}${entry.after?.status ? ` · ${esc(ui().labels[entry.after.status])}` : ""}</span></li>`).join("")}</ol>`)}</div><aside>${!readOnly() ? panel(terminal ? "Situação da medida" : "Próximo passo", next) : ""}${panel("Origem e acompanhamento", `<p><strong>${esc(assessment?.title || "Avaliação de referência")}</strong></p><p class="ux-help">${esc(report?.title || "")} · ${esc(report?.cycle || "")}</p>${report ? link("Consultar avaliação", `resultados/ciclo/${report.id}/avaliacoes`) : ""}${row.measurementReportId ? `<p class="ux-measurement">Remedição vinculada. Diferença no fator: <strong>${fmt(row.measurementDelta)} ponto(s)</strong>.</p>${link("Abrir remedição", `resultados/ciclo/${row.measurementReportId}`)}` : `<p class="ux-help top-gap">Uma nova medição pode apoiar a revisão, sem substituir a avaliação das condições de trabalho.</p>`}${!readOnly() && published().length > 1 ? ui().button(row.measurementReportId ? "Alterar remedição" : "Vincular remedição", "measurement", id) : ""}`)}</aside></div>`,
    );
  }
  function eventLabel(event, entry) {
    if (
      event === "action.updated" &&
      entry?.before?.status !== entry?.after?.status
    ) {
      const transitions = {
        in_progress: "Execução iniciada",
        implemented: "Implementação registrada",
        effective: "Eficácia registrada",
        ineffective: "Medida avaliada sem eficácia",
        cancelled: "Ação cancelada",
      };
      if (transitions[entry?.after?.status])
        return transitions[entry.after.status];
    }
    return (
      {
        "action.created": "Ação planejada",
        "action.updated": "Plano atualizado",
        "action.evidence_added": "Evidência registrada",
        "action.measurement_linked": "Remedição vinculada",
        "assessment.created": "Achado registrado",
        "assessment.updated": "Avaliação atualizada",
        "assistant.generated": "Consulta ao assistente",
        "team.invited": "Convite de acesso criado",
        "team.joined": "Colaborador entrou na equipe",
        "team.updated": "Acesso atualizado",
        "schedule.created": "Recorrência configurada",
        "schedule.disabled": "Recorrência desativada",
        "schedule.draft_created": "Novo ciclo preparado",
        "privacy.raw_data_purged": "Retenção aplicada",
        "privacy.retention_configured": "Política de retenção atualizada",
        "account.password_changed": "Senha alterada",
      }[event] || "Registro administrativo atualizado"
    );
  }
  function documentsView() {
    shell(
      heading(
        "RESULTADOS",
        "Relatórios e histórico",
        "Consulte documentos dos ciclos e a rastreabilidade das decisões.",
      ) +
        resultNav("documentos") +
        `<div class="ux-section-intro"><div><h2>Relatórios dos ciclos</h2><p>Abra o documento para imprimir ou salvar como PDF.</p></div>${ui().button("Exportar dossiê", "export-dossier")}</div>` +
        (state.reports.length
          ? `<div class="ux-document-list">${state.reports.map((report) => `<article><div class="ux-document-icon">${icon("pesquisas")}</div><div><h3>${esc(report.title)}</h3><p>${esc(report.cycle)} · ${esc(report.groupName)} · ${dateText(report.closedAt)}</p>${!report.published ? `<small>${esc(report.suppressionReason || "Volume insuficiente para publicação.")}</small>` : ""}</div>${tag(report.published ? "Disponível" : "Protegido", report.published ? "positive" : "")}<button class="btn secondary" data-action="view-report" data-id="${attr(report.id)}">Abrir relatório</button></article>`).join("")}</div>`
          : empty(
              "Nenhum relatório disponível",
              "Os relatórios são preservados quando os ciclos são encerrados.",
            )) +
        (state.management.audit.length
          ? panel(
              "Histórico de decisões",
              `<ol class="ux-timeline">${state.management.audit
                .slice(0, 20)
                .map(
                  (entry) =>
                    `<li><strong>${esc(eventLabel(entry.event, entry))}</strong><span>${esc(entry.actor)} · ${timeText(entry.at)}</span></li>`,
                )
                .join("")}</ol>`,
            )
          : ""),
    );
  }
  function settingsFrame(content, section) {
    const owner = state.account.role === "owner";
    return (
      heading(
        "ADMINISTRAÇÃO",
        "Configurações",
        "Gerencie sua conta e as preferências da empresa.",
      ) +
      tabs(
        [
          ["conta", "Minha conta", "configuracoes"],
          ...(owner
            ? [
                ["equipe", "Equipe e acessos", "configuracoes/equipe"],
                ["plano", "Plano e cobrança", "configuracoes/plano"],
                [
                  "privacidade",
                  "Privacidade e dados",
                  "configuracoes/privacidade",
                ],
              ]
            : []),
        ],
        section,
        "Configurações da empresa",
      ) +
      content
    );
  }
  async function settingsView(section = route()[1] || "conta") {
    if (section !== "conta" && state.account.role !== "owner")
      section = "conta";
    const requestId = ++settingsRequest;
    const expectedHash = location.hash;
    const show = (content) => {
      if (requestId === settingsRequest && location.hash === expectedHash)
        shell(settingsFrame(content, section));
    };
    if (section === "conta")
      return show(
        `<div class="ux-settings-layout">${panel("Seus dados", `<form id="settings-form" class="stack">${ui().field("Nome completo", "name", state.account.name, "text", true)}<label>Empresa<input name="company" value="${attr(state.account.company)}" required maxlength="120" ${state.account.role !== "owner" ? "readonly" : ""}></label>${ui().field("E-mail da conta", "email", state.account.email, "email", true)}<div><button class="btn primary" type="submit">Salvar alterações</button></div></form>`)}${panel("Acesso à conta", `<p>${tag(ui().labels[state.account.role])}</p><p class="ux-help">Altere sua senha quando necessário. A alteração encerra as sessões existentes.</p>${ui().button("Alterar senha", "password")}<div class="ux-security-footer"><h3>Encerrar sessão</h3><p class="ux-help">Saia da conta ao terminar o uso em um dispositivo compartilhado.</p><button class="btn secondary" data-action="logout">Sair da conta</button></div>`)}</div>`,
      );
    show(
      '<div class="ux-loading" role="status">Carregando configurações…</div>',
    );
    try {
      if (section === "equipe") {
        const team = await api("/management/team");
        return show(
          panel(
            "Pessoas com acesso à plataforma",
            `<p class="ux-help">Esses acessos são da equipe de gestão. Trabalhadores participantes das pesquisas ficam em Organização.</p>${team.users.map((user) => `<article class="ux-team-row"><div class="ux-avatar">${esc(user.name.slice(0, 1))}</div><div class="ux-team-person"><strong>${esc(user.name)}</strong><span>${esc(user.email)}</span>${tag(user.disabled ? "Acesso desativado" : ui().labels[user.role])}</div>${user.role !== "owner" ? `<form data-management-form="team-role" class="ux-role-form">${ui().hidden("userId", user.id)}${ui().hidden("disabled", String(user.disabled))}${ui().select("Permissão de " + esc(user.name), "role", ["editor", "viewer"], user.role)}<button class="btn secondary" type="submit">Salvar</button><p class="management-error" role="alert"></p></form><button class="text-button" data-management="toggle-user" data-id="${attr(user.id)}" data-role="${user.role}" data-disabled="${!user.disabled}">${user.disabled ? "Reativar" : "Desativar"}</button>` : '<span class="ux-help">Responsável pela empresa</span>'}</article>`).join("")}`,
          ) +
            (team.invitations.some(
              (item) => !item.usedAt && item.expiresAt > Date.now(),
            )
              ? panel(
                  "Convites pendentes",
                  team.invitations
                    .filter(
                      (item) => !item.usedAt && item.expiresAt > Date.now(),
                    )
                    .map(
                      (item) =>
                        `<article class="ux-billing-row"><div><strong>${esc(item.email)}</strong><p>${esc(ui().labels[item.role])} · válido até ${dateText(new Date(item.expiresAt).toISOString())}</p></div><button class="btn secondary" data-ux="revoke-invite" data-id="${attr(item.id)}">Revogar convite</button></article>`,
                    )
                    .join(""),
                )
              : "") +
            `<div class="ux-settings-layout">${panel("Convidar para a equipe", `<form data-management-form="invite" class="stack">${ui().field("E-mail do colaborador", "email", "", "email", true)}${ui().select("Permissão", "role", ["editor", "viewer"], "editor")}<div><button class="btn primary" type="submit">Gerar convite</button></div><p class="management-error" role="alert"></p><div id="invite-result" aria-live="polite"></div></form>`)}${panel("Quem pode fazer o quê", '<dl class="ux-permissions"><dt>Administrador</dt><dd>Cadastros, equipe, planos e toda a operação.</dd><dt>RH / SST</dt><dd>Pesquisas, avaliação de achados e acompanhamento das ações.</dd><dt>Consulta</dt><dd>Resultados e histórico, sem alterar os registros de gestão.</dd></dl>')}</div>`,
        );
      }
      if (section === "plano") {
        const data = await api("/management/billing");
        const current = state.management.entitlement;
        const money = (value) =>
          new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(value / 100);
        return show(
          panel(
            "Seu plano",
            `<div class="ux-current-plan"><div><span class="ux-eyebrow">${current.source === "local_preview" ? "Ambiente de avaliação" : current.paid ? "Período confirmado" : "Sem assinatura ativa"}</span><h2>${esc(current.plan?.name || "Escolha um plano")}</h2><p>${current.paidUntil ? `Período disponível até ${dateText(current.paidUntil)}` : current.source === "local_preview" ? "A prévia local não representa uma assinatura paga." : "Escolha um plano para habilitar a operação."}</p></div>${current.plan ? `<div class="ux-plan-limits"><span>${current.plan.members} pessoas</span><span>${current.plan.groups} grupos</span><span>${current.plan.users} acessos</span></div>` : ""}</div>`,
          ) +
            `<div class="ux-section-intro"><div><h2>Planos disponíveis</h2><p>Todos incluem avaliações, planos de ação, evidências e histórico.</p></div></div><div class="ux-pricing-grid">${data.plans.map((plan) => `<article class="ux-price-card ${plan.id === "popular" ? "featured" : ""}"><div class="ux-price-name"><h3>${esc(plan.name)}</h3>${plan.id === "popular" ? tag("Com assistente") : ""}</div><p class="ux-price">${money(plan.amountCents)}<span>/mês</span></p><ul><li>${plan.members} pessoas cadastradas</li><li>${plan.groups} grupos personalizados</li><li>${plan.users} acessos de gestão</li><li>${plan.aiMonthly ? plan.aiMonthly + " consultas de IA por mês" : "Avaliação e ações sem assistente"}</li></ul><button class="btn ${plan.id === "popular" ? "primary" : "secondary"}" data-management="checkout" data-id="${attr(plan.id)}" ${data.configured ? "" : "disabled"}>Escolher ${esc(plan.name)}</button></article>`).join("")}</div>${!data.configured ? '<p class="ux-context-note">Contratação ainda não habilitada neste ambiente. Seus dados e funcionalidades locais continuam disponíveis.</p>' : `<p class="ux-help">${data.mode === "test" ? "Ambiente de teste de pagamento." : "Pagamento processado pelo Mercado Pago."} Uma empresa por assinatura.</p>`}${panel("Histórico de cobrança", data.subscriptions.length ? data.subscriptions.map((subscription) => `<article class="ux-billing-row"><div><strong>${esc(subscription.plan.name)}</strong><p>${esc({ creating: "Preparando contratação", pending: "Aguardando contratação", authorized: "Recorrência autorizada", cancelled: "Cancelada", failed: "Contratação não concluída", paused: "Pausada" }[subscription.status] || "Aguardando atualização")}${subscription.paidUntil ? " · Período confirmado até " + dateText(subscription.paidUntil) : ""}</p></div><div class="ux-inline-actions">${subscription.providerId ? ui().button("Atualizar situação", "sync-subscription", subscription.id) + (subscription.status !== "cancelled" ? ui().button("Cancelar assinatura", "cancel-subscription", subscription.id) : "") : ""}</div></article>`).join("") : '<p class="ux-help">Nenhuma contratação registrada.</p>')}`,
        );
      }
      if (section === "privacidade") {
        const review = await api("/management/retention");
        return show(
          `<div class="ux-settings-layout">${panel(
            "Retenção de respostas",
            `<p class="ux-help">Defina por quanto tempo manter respostas brutas e convites. Relatórios, avaliações e ações são preservados.</p><form data-management-form="retention" class="stack"><label>Prazo de retenção<select name="months">${[
              [0, "Manter até revisão manual"],
              [3, "3 meses"],
              [6, "6 meses"],
              [12, "12 meses"],
              [24, "24 meses"],
              [36, "36 meses"],
              [60, "60 meses"],
            ]
              .map(
                ([value, label]) =>
                  `<option value="${value}" ${value === review.months ? "selected" : ""}>${label}</option>`,
              )
              .join(
                "",
              )}${![0, 3, 6, 12, 24, 36, 60].includes(review.months) ? `<option value="${review.months}" selected>${review.months} meses</option>` : ""}</select></label><div><button class="btn primary" type="submit">Salvar política</button></div><p class="management-error" role="alert"></p></form>`,
          )}${panel("O que permanece no histórico", '<ul class="ux-checklist"><li>Resultados coletivos já publicados</li><li>Avaliações e decisões registradas</li><li>Planos de ação e evidências</li><li>Histórico da operação</li></ul><p class="ux-help">Cópias de segurança têm política própria e podem conter dados removidos da base operacional.</p>')}</div>${panel("Remover dados elegíveis", `<p>${review.responses} resposta(s) e ${review.invitations} convite(s) elegíveis pela política atual.</p>${review.responses || review.invitations ? `<form data-management-form="purge" class="stack ux-danger-zone"><label>Digite PURGAR para confirmar a remoção irreversível<input name="confirmation" required pattern="PURGAR" autocomplete="off"></label><div><button class="btn secondary" type="submit">Remover dados elegíveis</button></div><p class="management-error" role="alert"></p></form>` : '<p class="ux-help">Nenhum dado precisa ser removido neste momento.</p>'}`)}`,
        );
      }
      show(
        empty(
          "Seção indisponível",
          "Escolha uma seção das configurações acima.",
        ),
      );
    } catch (error) {
      show(
        `<div class="ux-error" role="alert"><h2>Não foi possível carregar esta seção</h2><p>${esc(error.message)}</p><button class="btn secondary" data-ux="retry-settings">Tentar novamente</button></div>`,
      );
    }
  }
  function schedulesView() {
    const schedules = state.management.schedules.filter((row) => row.enabled);
    shell(
      `<a class="ux-back" href="#pesquisas">← Todas as pesquisas</a>` +
        heading(
          "PESQUISAS",
          "Recorrência dos ciclos",
          "Prepare os próximos ciclos na frequência definida. A revisão acontece antes do início da coleta.",
          !readOnly() && published().length
            ? ui().button("Nova recorrência", "schedule", "", true)
            : "",
        ) +
        (schedules.length
          ? schedules
              .map((row) =>
                panel(
                  esc(row.title),
                  `<p>Próximo ciclo preparado em <strong>${dateText(row.nextDate)}</strong> · frequência ${row.intervalMonths === 1 ? "mensal" : "a cada " + row.intervalMonths + " meses"}</p><p class="ux-help">O ciclo será criado como rascunho para conferir público e encerramento.</p>`,
                  !readOnly()
                    ? ui().button(
                        "Desativar recorrência",
                        "disable-schedule",
                        row.id,
                      )
                    : "",
                ),
              )
              .join("")
          : empty(
              "Ainda não há ciclos recorrentes",
              published().length
                ? "Use uma pesquisa encerrada como referência para preparar as próximas rodadas."
                : "Encerre o primeiro ciclo antes de configurar uma recorrência.",
            )),
    );
  }
  document.addEventListener("input", (event) => {
    if (!event.target.matches("[data-ux-search]")) return;
    const query = event.target.value.trim().toLocaleLowerCase("pt-BR");
    const rows = [...document.querySelectorAll("[data-ux-searchable]")];
    rows.forEach((row) => {
      row.hidden = !row.dataset.uxSearchable.includes(query);
    });
    const count = document.querySelector("[data-ux-count]");
    const visible = rows.filter((row) => !row.hidden).length;
    if (count)
      count.textContent = `${visible} ${visible === 1 ? "ação" : "ações"}`;
    const hint = document.querySelector(".ux-search-empty");
    if (hint) hint.hidden = rows.some((row) => !row.hidden);
  });
  document.addEventListener("click", async (event) => {
    const revoke = event.target.closest('[data-ux="revoke-invite"]');
    if (revoke) {
      revoke.disabled = true;
      try {
        await del(`/management/team/invitations/${revoke.dataset.id}`);
        await settingsView("equipe");
        message("Convite revogado.");
      } catch (error) {
        message(error.message, true);
        revoke.disabled = false;
      }
      return;
    }
    const reviewButton = event.target.closest('[data-ux="review-action"]');
    if (reviewButton) {
      const row = state.management.actions.find(
        (item) => item.id === reviewButton.dataset.id,
      );
      modal(
        "Verificar eficácia da medida",
        `<form data-experience-form="review" class="modal-body stack">${ui().hidden("id", row.id)}${ui().hidden("version", row.version)}<p><strong>${esc(row.title)}</strong></p><p class="ux-help">Critério definido: ${esc(row.successCriteria)}</p><label>Resultado da verificação<select name="status" required><option value="">Selecione o resultado</option><option value="effective">Medida eficaz</option><option value="ineffective">Medida não eficaz</option></select></label>${ui().area("O que comprova o resultado?", "review", row.review, true)}<p class="management-error" role="alert"></p><div class="modal-actions"><button type="button" class="btn secondary" data-management="close">Cancelar</button><button type="submit" class="btn primary">Registrar verificação</button></div></form>`,
      );
      return;
    }
    const retry = event.target.closest('[data-ux="retry-settings"]');
    if (retry) return settingsView();
    const target = event.target.closest(
      '[data-management="ux-start"], [data-management="ux-implement"]',
    );
    if (!target) return;
    target.disabled = true;
    const row = state.management.actions.find(
      (item) => item.id === target.dataset.id,
    );
    try {
      await put(`/management/actions/${row.id}`, {
        ...row,
        status:
          target.dataset.management === "ux-start"
            ? "in_progress"
            : "implemented",
      });
      await load();
      message("Acompanhamento atualizado.");
    } catch (error) {
      message(error.message, true);
      target.disabled = false;
    }
  });
  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-experience-form]");
    if (!form) return;
    event.preventDefault();
    const data = formData(form),
      submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const row = state.management.actions.find((item) => item.id === data.id);
      await put(`/management/actions/${row.id}`, {
        ...row,
        status: data.status,
        review: data.review,
        version: Number(data.version),
      });
      await load();
      document.querySelector("#modal")?.remove();
      message("Verificação de eficácia registrada.");
    } catch (error) {
      form.querySelector(".management-error").textContent = error.message;
      submit.disabled = false;
    }
  });
  function afterRender() {
    document.querySelectorAll(".ux-tabs").forEach((nav) => {
      const active = nav.querySelector('[aria-current="page"]');
      if (active && nav.scrollWidth > nav.clientWidth)
        nav.scrollLeft = Math.max(0, active.offsetLeft - nav.offsetLeft - 16);
    });
  }
  return {
    afterRender,
    icon,
    organizationNav,
    overview,
    resultsView,
    actionsView,
    settingsView,
    settingsFrame,
    schedulesView,
  };
})();
