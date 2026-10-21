const express = require("express");
const crypto = require("node:crypto");
const storage = require("../config/equilibraStorage");
const password = require("../services/passwordService");
const repo = require("../repositories/managementRepository");
const router = express.Router();
router.post("/auth/reset-password", (req, res) => {
  try {
    password.validate(req.body.password);
    const tokenHash = crypto
      .createHash("sha256")
      .update(
        typeof req.body.token === "string" ? req.body.token.slice(0, 100) : "",
      )
      .digest("hex");
    const state = storage
      .read("management")
      .find((row) =>
        row.recovery.some(
          (item) => item.tokenHash === tokenHash && item.expiresAt > Date.now(),
        ),
      );
    const recovery = state?.recovery.find(
      (item) => item.tokenHash === tokenHash && item.expiresAt > Date.now(),
    );
    if (!recovery)
      return res.status(400).json({ error: "Código inválido ou expirado." });
    const accounts = storage.read("accounts"),
      actor = accounts.find(
        (row) => row.id === recovery.userId && !row.disabled,
      );
    if (!actor)
      return res.status(400).json({ error: "Código inválido ou expirado." });
    // Consume first: a crash cannot leave a reusable recovery token.
    repo.transaction(
      { id: state.id, userId: actor.id, name: actor.name },
      "account.password_recovered",
      (data) => {
        data.recovery = data.recovery.filter(
          (row) => row.tokenHash !== tokenHash,
        );
        return { id: actor.id };
      },
    );
    actor.passwordHash = password.derive(req.body.password);
    storage.writeMany({
      accounts,
      sessions: storage
        .read("sessions")
        .filter((row) => row.accountId !== actor.id),
    });
    res.status(204).end();
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message });
  }
});
module.exports = router;
