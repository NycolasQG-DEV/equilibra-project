const crypto = require("node:crypto");
const storage = require("../config/equilibraStorage");
const repo = require("../repositories/managementRepository");
const { closeExpiredSurveys } = require("./surveyLifecycle");
function nextMonth(date, months) {
  return require("../domain/dates")
    .addMonths(`${date}T12:00:00Z`, months)
    .toISOString()
    .slice(0, 10);
}
function tick() {
  closeExpiredSurveys();
  const today = require("../domain/dates").today();
  for (const workspace of storage.read("management")) {
    for (const schedule of workspace.schedules.filter(
      (row) => row.enabled && row.nextDate <= today,
    )) {
      const surveys = storage.read("surveys");
      const source = surveys.find(
        (row) => row.id === schedule.surveyId && row.accountId === workspace.id,
      );
      if (!source) continue;
      const key = `${schedule.id}:${schedule.nextDate}`;
      // Persist idempotency key with the draft before advancing the schedule.
      if (!surveys.some((row) => row.scheduleKey === key)) {
        surveys.push({
          id: crypto.randomUUID(),
          accountId: workspace.id,
          title: schedule.title,
          cycle: schedule.nextDate.slice(0, 7),
          model: source.model,
          instrument: require("../domain/instruments").surveyInstrument(source),
          collectionChannel: "web",
          groupIds: source.groupIds || [source.groupId],
          groupId: source.groupId,
          memberIds: [],
          status: "draft",
          endsAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          createdAt: new Date().toISOString(),
          scheduleKey: key,
        });
        storage.write("surveys", surveys);
      }
      repo.transaction(
        { id: workspace.id, name: "Agendador" },
        "schedule.draft_created",
        (data) => {
          const row = repo.find(data.schedules, schedule.id);
          row.nextDate = nextMonth(today, row.intervalMonths);
          row.lastRunAt = new Date().toISOString();
          return row;
        },
      );
    }
  }
}
module.exports = { tick, nextMonth };
