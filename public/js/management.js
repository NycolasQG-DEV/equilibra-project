/* Management screens share the existing shell, forms, buttons and account state. */
window.Management = (() => {
  const labels = {
    investigating: "Em investigação",
    evaluated: "Avaliado",
    dismissed: "Descartado",
    planned: "Planejada",
    in_progress: "Em execução",
    implemented: "Implementada; revisar eficácia",
    effective: "Eficaz",
    ineffective: "Não eficaz",
    cancelled: "Cancelada",
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    pending: "A avaliar",
    owner: "Administrador",
    editor: "RH / SST",
    viewer: "Consulta",
  };
  const options = (values, selected) =>
    values
      .map(
        (value) =>
          `<option value="${attr(value)}" ${value === selected ? "selected" : ""}>${esc(labels[value] || value)}</option>`,
      )
      .join("");
  const canEdit = () => state.account.role !== "viewer";
  const field = (
    label,
    name,
    value = "",
    type = "text",
    required = false,
    maximum = 160,
  ) =>
    `<label>${label}<input type="${type}" name="${name}" value="${attr(value)}" ${required ? "required" : ""} ${["text", "email", "password"].includes(type) ? `maxlength="${type === "email" ? 254 : type === "password" ? 128 : maximum}"` : ""}></label>`;
  const area = (label, name, value = "", required = false) =>
    `<label>${label}<textarea name="${name}" rows="3" maxlength="2000" ${required ? "required" : ""}>${esc(value)}</textarea></label>`;
  const select = (label, name, values, selected) =>
    `<label>${label}<select name="${name}" required>${options(values, selected)}</select></label>`;
  const button = (label, action, id = "", primary = false) =>
    `<button type="button" class="btn ${primary ? "primary" : "secondary"}" data-management="${action}" data-id="${attr(id)}">${label}</button>`;
  const hidden = (name, value) =>
    `<input type="hidden" name="${name}" value="${attr(value)}">`;
  const empty = (title, description) =>
    `<section class="empty"><h2>${title}</h2><p>${description}</p></section>`;
  const badge = (status) =>
    `<span class="badge">${esc(labels[status] || status)}</span>`;
  const actions = () => state.management?.actions || [];
  const assessments = () => state.management?.assessments || [];
  const reports = () => state.reports.filter((row) => row.published);
  const reportOptions = (selected) =>
    reports()
      .map(
        (row) =>
          `<option value="${attr(row.id)}" ${row.id === selected ? "selected" : ""}>${esc(row.title)} · ${esc(row.cycle)}</option>`,
      )
      .join("");
  function form(title, kind, content, item) {
    modal(
      title,
      `<form data-management-form="${kind}" class="modal-body stack">${item ? hidden("id", item.id) + hidden("version", item.version) : ""}${content}<p class="management-error" role="alert"></p><div class="modal-actions">${button("Cancelar", "close")}<button class="btn primary" type="submit">Salvar</button></div></form>`,
    );
  }
  function assistantPanel(reportId) {
    const available = state.management.entitlement?.plan?.aiMonthly > 0;
    if (!canEdit()) return "";
    const configured = state.management.ai?.configured;
    return `<section class="management-panel"><h2>Assistente de resultados</h2><p class="muted">${!available ? "Disponível a partir do plano Popular." : !configured ? "O assistente está aguardando ativação nesta empresa. As avaliações e ações continuam disponíveis." : "Receba explicações e sugestões para revisão humana."}</p>${available ? `<form data-management-form="assistant" class="stack">${reportId ? hidden("reportId", reportId) : `<label>Resultado de referência<select name="reportId" required>${reportOptions()}</select></label>`}<label>Ciclo anterior para contexto (opcional)<select name="previousReportId"><option value="">Sem comparação</option>${reportOptions()}</select></label><label>Objetivo<select name="mode"><option value="explain">Explicar indicadores</option><option value="action">Propor medida para revisão</option></select></label><label>Sua pergunta<textarea name="question" required maxlength="1200" rows="3" placeholder="Quais fatores merecem investigação e que medidas podemos considerar?"></textarea></label><label class="management-check"><input type="checkbox" name="allowExternal" required> Autorizo enviar indicadores agregados e esta pergunta à IA. Não incluirei nomes, contatos ou relatos individuais.</label><button class="btn primary" type="submit" ${configured ? "" : "disabled"}>Consultar assistente</button><p class="management-error" role="alert"></p></form>` : ""}<div id="assistant-answer" aria-live="polite"></div>${
      state.management.aiHistory.length
        ? `<details class="top-gap"><summary>Consultas anteriores</summary>${state.management.aiHistory
            .filter((row) => !reportId || row.reportId === reportId)
            .slice(0, 5)
            .map(
              (row) =>
                `<article class="management-answer"><strong>${esc(row.question)}</strong><p>${esc(row.answer)}</p><small>${esc(row.provider)} · ${esc(row.model)} · ${date(row.generatedAt)}</small>${row.suggestion ? button("Revisar proposta", "review-suggestion", row.id) : ""}</article>`,
            )
            .join("")}</details>`
        : ""
    }</section>`;
  }
  function assessmentForm(item, reportId) {
    const report = state.reports.find(
      (row) => row.id === (item?.reportId || reportId),
    );
    if (!canEdit())
      return modal(
        "Avaliação",
        `<div class="modal-body stack"><h3>${esc(item.title)}</h3><p>${esc(item.context)}</p><p>${esc(item.decision)}</p></div>`,
      );
    const factor = item
      ? hidden("factor", item.factor)
      : `<label>Fator a investigar<select name="factor" required>${report.result.map((row) => `<option value="${attr(row.key)}">${esc(row.label)} · ${fmt(row.average)} / 5</option>`).join("")}</select></label>`;
    form(
      item ? "Avaliação do achado" : "Registrar achado",
      "assessment",
      hidden("reportId", report.id) +
        factor +
        field("Título do achado", "title", item?.title, "text", true) +
        area(
          "Contexto e condições de trabalho investigadas",
          "context",
          item?.context,
        ) +
        area(
          "Medidas de prevenção existentes",
          "existingMeasures",
          item?.existingMeasures,
        ) +
        select(
          "Estado da avaliação",
          "status",
          ["investigating", "evaluated", "dismissed"],
          item?.status || "investigating",
        ) +
        select(
          "Prioridade definida pelo responsável",
          "classification",
          ["pending", "low", "medium", "high"],
          item?.classification || "pending",
        ) +
        area("Decisão e justificativa", "decision", item?.decision),
      item,
    );
  }
  function actionForm(item, assessmentId, suggestion) {
    if (!canEdit())
      return modal(
        "Ação",
        `<div class="modal-body stack"><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><p>${esc(item.review || item.successCriteria)}</p>${item.evidence.map((e) => `<p>${esc(e.description)}</p>`).join("")}</div>`,
      );
    form(
      item ? "Acompanhar ação" : "Planejar ação",
      "action",
      hidden("assessmentId", item?.assessmentId || assessmentId) +
        hidden("aiSourceId", item?.aiSourceId || suggestion?.sourceId || "") +
        field(
          "Título",
          "title",
          item?.title || suggestion?.title,
          "text",
          true,
        ) +
        area(
          "Medida a implementar",
          "description",
          item?.description || suggestion?.description,
        ) +
        field("Responsável", "owner", item?.owner, "text", true) +
        `<div class="management-form-grid">${field("Prazo de execução", "dueDate", item?.dueDate, "date", true)}${field("Data de revisão", "reviewDate", item?.reviewDate, "date", true)}</div>` +
        select(
          "Prioridade",
          "priority",
          ["low", "medium", "high"],
          item?.priority || "medium",
        ) +
        area(
          "Como verificar se funcionou?",
          "successCriteria",
          item?.successCriteria || suggestion?.successCriteria,
          true,
        ) +
        (item
          ? select(
              "Estado",
              "status",
              state.management.workflow?.actionTransitions[item.status] || [
                item.status,
              ],
              item.status,
            ) +
            area(
              "Verificação de eficácia e justificativa",
              "review",
              item.review,
            ) +
            `<details><summary>Evidências (${item.evidence.length})</summary>${item.evidence.map((row) => `<article class="management-answer"><p>${esc(row.description)}</p>${row.url ? `<a href="${attr(row.url)}" target="_blank" rel="noopener noreferrer">Abrir referência</a>` : ""}</article>`).join("")}</details>`
          : hidden("status", "planned")),
      item,
    );
  }
  async function teamView() {
    return Experience.settingsView("equipe");
  }
  async function subscriptionView() {
    return Experience.settingsView("plano");
  }
  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-management]");
    if (!target) return;
    const { management: action, id } = target.dataset;
    try {
      if (action === "retention") {
        const review = await api("/management/retention");
        modal(
          "Dados e retenção",
          `<div class="modal-body stack"><p>Relatórios, avaliações e ações são preservados. A purga remove respostas brutas e convites de ciclos encerrados com relatório salvo.</p><form data-management-form="retention" class="stack"><label>Retenção de respostas brutas (meses; 0 desativa)<input type="number" name="months" min="0" max="60" value="${review.months}" required></label><button class="btn primary" type="submit">Salvar política</button><p class="management-error" role="alert"></p></form><p>Política atual: ${review.months || "desativada"}. Elegíveis: ${review.responses} respostas e ${review.invitations} convites.</p><p class="fine-print">Backups locais têm retenção separada e ainda podem conter esses dados. A purga não apaga cópias anteriores.</p><form data-management-form="purge" class="stack"><label>Digite PURGAR para confirmar a remoção irreversível dos dados elegíveis<input name="confirmation" required pattern="PURGAR" autocomplete="off"></label><button class="btn secondary" type="submit" ${review.responses || review.invitations ? "" : "disabled"}>Purgar dados elegíveis</button><p class="management-error" role="alert"></p></form></div>`,
        );
      }
      if (action === "password")
        form(
          "Alterar senha",
          "password",
          field("Senha atual", "currentPassword", "", "password", true) +
            field(
              "Nova senha (10 a 128 caracteres)",
              "password",
              "",
              "password",
              true,
            ),
        );
      if (action === "recover-password")
        form(
          "Recuperar acesso",
          "recovery",
          "<p>Solicite ao operador responsável um código de recuperação por canal seguro. Código válido por 30 minutos.</p>" +
            field("Código", "token", "", "text", true) +
            field(
              "Nova senha (10 a 128 caracteres)",
              "password",
              "",
              "password",
              true,
            ),
        );
      if (action === "close") document.querySelector("#modal")?.remove();
      if (action === "new-assessment") assessmentForm(null, id);
      if (action === "assessment")
        assessmentForm(assessments().find((row) => row.id === id));
      if (action === "review-suggestion") {
        const record = state.management.aiHistory.find((row) => row.id === id);
        const choices = assessments().filter(
          (row) =>
            row.reportId === record.reportId && row.status === "evaluated",
        );
        if (!choices.length)
          throw new Error(
            "Conclua a avaliação de um achado desse resultado antes de planejar a medida.",
          );
        form(
          "Revisar proposta da IA",
          "suggestion",
          hidden("suggestionId", id) +
            `<p>${esc(record.suggestion.rationale)}</p><label>Avaliação técnica de referência<select name="assessmentId" required>${choices.map((row) => `<option value="${attr(row.id)}">${esc(row.title)}</option>`).join("")}</select></label><p class="fine-print">A próxima etapa permite editar a proposta, atribuir responsável e definir prazos. Nada foi aprovado automaticamente.</p>`,
        );
      }
      if (action === "new-action") actionForm(null, id);
      if (action === "action")
        actionForm(actions().find((row) => row.id === id));
      if (action === "evidence") {
        const item = actions().find((row) => row.id === id);
        form(
          "Adicionar evidência",
          "evidence",
          area(
            "O que foi realizado? Registre evidência sem dados pessoais.",
            "description",
            "",
            true,
          ) + field("Link HTTPS para documento (opcional)", "url", "", "url"),
          item,
        );
      }
      if (action === "measurement") {
        const item = actions().find((row) => row.id === id);
        form(
          "Vincular remedição",
          "measurement",
          `<label>Ciclo posterior<select name="reportId" required>${reportOptions()}</select></label><p class="fine-print">Somente ciclos com instrumento e público comparáveis são aceitos.</p>`,
          item,
        );
      }
      if (action === "schedule")
        form(
          "Agendar rascunhos recorrentes",
          "schedule",
          `<label>Pesquisa de referência<select name="surveyId" required>${reports()
            .map(
              (row) =>
                `<option value="${attr(row.surveyId)}">${esc(row.title)}</option>`,
            )
            .join("")}</select></label>` +
            field("Título dos próximos ciclos", "title", "", "text", true) +
            field("Primeiro rascunho em", "nextDate", "", "date", true) +
            `<label>Frequência<select name="intervalMonths"><option value="1">Mensal</option><option value="3">Trimestral</option><option value="6">Semestral</option><option value="12">Anual</option></select></label>`,
        );
      if (action === "disable-schedule") {
        await del(`/management/schedules/${id}`);
        await load();
        message("Agendamento desativado.");
      }
      if (action === "team") await teamView();
      if (action === "toggle-user") {
        await put(`/management/team/${id}`, {
          role: target.dataset.role,
          disabled: target.dataset.disabled === "true",
        });
        await teamView();
      }
      if (action === "export-dossier") {
        const data = await api("/management/dossier");
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "equilibra-dossie.json";
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      if (action === "checkout") {
        target.disabled = true;
        const result = await post("/management/billing/checkout", {
          planId: id,
        });
        location.assign(result.url);
      }
      if (action === "sync-subscription") {
        target.disabled = true;
        await post(`/management/billing/${id}/sync`);
        await subscriptionView();
      }
      if (action === "cancel-subscription")
        modal(
          "Cancelar assinatura",
          `<div class="modal-body stack"><p>O cancelamento interrompe futuras cobranças recorrentes. O período já confirmado permanece disponível até o vencimento.</p>${button("Manter assinatura", "close")}${button("Confirmar cancelamento", "confirm-cancel-subscription", id, true)}</div>`,
        );
      if (action === "confirm-cancel-subscription") {
        target.disabled = true;
        await post(`/management/billing/${id}/cancel`);
        document.querySelector("#modal")?.remove();
        await subscriptionView();
      }
    } catch (error) {
      message(error.message, true);
      target.disabled = false;
    }
  });
  document.addEventListener("submit", async (event) => {
    const element = event.target.closest("[data-management-form]");
    if (!element) return;
    event.preventDefault();
    const originHash = location.hash;
    const kind = element.dataset.managementForm,
      data = formData(element),
      submit = element.querySelector('[type="submit"]');
    submit.disabled = true;
    if (element.querySelector(".management-error"))
      element.querySelector(".management-error").textContent = "";
    try {
      if (kind === "compare") {
        const result = await api(
          `/management/compare?current=${encodeURIComponent(data.current)}&previous=${encodeURIComponent(data.previous)}`,
        );
        if (!element.isConnected) return;
        document.querySelector("#comparison-result").innerHTML =
          result.comparable
            ? `${DashboardCharts.markup(result.factors, true)}<p class="fine-print">Diferenças de médias são descritivas; não demonstram causalidade ou significância estatística.</p><div class="management-list">${result.factors.map((row) => `<p><strong>${esc(row.label)}</strong>: ${fmt(row.previous)} para ${fmt(row.average)} · diferença ${fmt(row.delta)}</p>`).join("")}</div>`
            : `<p class="privacy-note">${esc(result.reason)}</p>`;
        return;
      }
      if (kind === "team-role") {
        await put(`/management/team/${data.userId}`, {
          role: data.role,
          disabled: data.disabled === "true",
        });
        await teamView();
        return;
      }
      if (kind === "suggestion") {
        const record = state.management.aiHistory.find(
          (row) => row.id === data.suggestionId,
        );
        actionForm(null, data.assessmentId, {
          ...record.suggestion,
          sourceId: record.id,
        });
        return;
      }
      if (kind === "assistant") {
        const result = await post("/management/assistant", {
          ...data,
          allowExternal: data.allowExternal === "on",
        });
        if (!state.management.aiHistory.some((row) => row.id === result.id))
          state.management.aiHistory.unshift(result);
        if (!element.isConnected) return;
        document.querySelector("#assistant-answer").innerHTML =
          `<article class="management-answer"><p>${esc(result.answer)}</p><small>Sugestão de ${esc(result.provider)} / ${esc(result.model)}. Revisão humana necessária.</small>${result.suggestion ? button("Revisar proposta e planejar ação", "review-suggestion", result.id, true) : ""}</article>`;
        return;
      }
      if (kind === "invite") {
        const result = await post("/management/team/invitations", data);
        if (!element.isConnected) return;
        document.querySelector("#invite-result").innerHTML =
          `<label>Código do convite (exibido somente agora)<input readonly value="${attr(result.token)}"></label><p>Compartilhe por canal seguro. O colaborador deve informar esse código no cadastro com o e-mail convidado.</p>`;
        return;
      }
      if (kind === "retention") {
        await put("/management/retention", data);
        document.querySelector("#modal")?.remove();
        await Experience.settingsView("privacidade");
        message("Política de retenção atualizada.");
        return;
      }
      if (kind === "purge") {
        await post("/management/retention/purge", data);
        await load();
        document.querySelector("#modal")?.remove();
        message("Dados brutos elegíveis removidos. Histórico preservado.");
        return;
      }
      if (kind === "password" || kind === "recovery") {
        await post(
          kind === "password"
            ? "/management/account/password"
            : "/auth/reset-password",
          data,
        );
        document.querySelector("#modal")?.remove();
        state.account = null;
        location.hash = "login";
        render();
        message("Senha atualizada. Entre novamente.");
        return;
      }
      data.version = Number(data.version);
      let savedRecord;
      if (kind === "assessment" || kind === "action") {
        const path = `/management/${kind === "assessment" ? "assessments" : "actions"}`;
        if (data.id) savedRecord = await put(`${path}/${data.id}`, data);
        else savedRecord = await post(path, data);
      }
      if (kind === "evidence" || kind === "measurement")
        await post(`/management/actions/${data.id}/${kind}`, data);
      if (kind === "schedule") await post("/management/schedules", data);
      await load();
      document.querySelector("#modal")?.remove();
      if (
        kind === "action" &&
        !data.id &&
        savedRecord &&
        location.hash === originHash
      )
        location.hash = `acoes/${savedRecord.id}`;
      message("Registro salvo.");
    } catch (error) {
      const inline = element.querySelector(".management-error");
      if (inline) inline.textContent = error.message;
      else message(error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
  return {
    subscriptionView,
    teamView,
    button,
    assistantPanel,
    editAssessment: assessmentForm,
    editAction: actionForm,
    components: {
      labels,
      button,
      field,
      area,
      select,
      hidden,
      badge,
      reportOptions,
      canEdit,
    },
  };
})();
