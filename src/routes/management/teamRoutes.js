const express = require("express");
const crypto = require("node:crypto");
const {
  repo,
  storage,
  DomainError,
  required,
  oneOf,
  ownerOnly,
  hash,
} = require("./context");
module.exports = function createRouter() {
  const router = express.Router();
  router.get("/team", (req, res) => {
    ownerOnly(req);
    res.json({
      users: storage
        .read("accounts")
        .filter((row) => (row.organizationId || row.id) === req.account.id)
        .map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role || "owner",
          disabled: Boolean(row.disabled),
        })),
      invitations: (repo.get(req.account.id).invitations || [])
        .filter((inv) => !inv.usedAt && inv.expiresAt > Date.now())
        .map(({ id, email, role, expiresAt, usedAt, token }) => ({
          id,
          email,
          role,
          expiresAt,
          usedAt,
          token,
        })),
    });
  });
  router.post("/team/invitations", (req, res) => {
    ownerOnly(req);
    const email = required(req.body.email, "o e-mail", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new DomainError("E-mail inválido.");
    const role = oneOf(req.body.role, ["editor", "viewer"], "Papel");
    const token = crypto.randomBytes(32).toString("hex");
    const result = repo.transaction(req.account, "team.invited", (data) => {
      if (
        data.invitations.some(
          (row) =>
            row.email === email && !row.usedAt && row.expiresAt > Date.now(),
        )
      )
        throw new DomainError("Já existe convite ativo para este e-mail.", 409);
      const row = repo.create({
        email,
        role,
        token,
        tokenHash: hash(token),
        expiresAt: Date.now() + 7 * 86400000,
        usedAt: null,
      });
      data.invitations.push(row);
      return row;
    });
    res.status(201).json({ id: result.id, token, expiresAt: result.expiresAt });
  });
  router.delete("/team/invitations/:id", (req, res) => {
    ownerOnly(req);
    repo.transaction(req.account, "team.invitation_revoked", (data) => {
      const invitation = repo.find(data.invitations, req.params.id);
      if (invitation.usedAt)
        throw new DomainError("Este convite já foi utilizado.", 409);
      invitation.expiresAt = 0;
      return invitation;
    });
    res.status(204).end();
  });
  router.put("/team/:id", (req, res) => {
    ownerOnly(req);
    const accounts = storage.read("accounts");
    const row = accounts.find(
      (item) =>
        item.id === req.params.id && item.organizationId === req.account.id,
    );
    if (!row) throw new DomainError("Colaborador não encontrado.", 404);
    if (row.disabled && req.body.disabled !== true)
      require("../../services/entitlementService").checkUserLimit(
        req.account.id,
      );
    row.role = oneOf(req.body.role, ["editor", "viewer"], "Papel");
    row.disabled = req.body.disabled === true;
    storage.write("accounts", accounts);
    repo.transaction(req.account, "team.updated", () => ({ id: row.id }));
    res.json({ id: row.id, role: row.role, disabled: row.disabled });
  });
  router.delete("/team/:id", (req, res) => {
    ownerOnly(req);
    if (req.params.id === req.account.id || req.params.id === req.account.userId) {
      throw new DomainError("Não é possível remover a si mesmo da equipe.", 400);
    }
    const accounts = storage.read("accounts");
    const idx = accounts.findIndex(
      (item) =>
        item.id === req.params.id && item.organizationId === req.account.id,
    );
    if (idx === -1) throw new DomainError("Colaborador não encontrado.", 404);
    const removedAccountId = req.params.id;
    const sessions = storage.read("sessions").filter(s => s.accountId !== removedAccountId);
    accounts.splice(idx, 1);
    storage.writeMany({ accounts, sessions });
    if (storage.deleteDirectly) {
      storage.deleteDirectly('accounts', removedAccountId);
    }
    repo.transaction(req.account, "team.member_removed", () => ({ id: removedAccountId }));
    res.status(204).end();
  });
  return router;
};
