// Local operator only. No token is returned by public recovery requests.
const fs = require("node:fs");
const path = require("node:path");
if (fs.existsSync(path.join(__dirname, "..", ".env")))
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
const crypto = require("node:crypto");
const storage = require("../src/config/equilibraStorage");
const repo = require("../src/repositories/managementRepository");
require("../src/config/writerLock").acquire();
const account = storage
  .read("accounts")
  .find(
    (row) =>
      row.email === process.argv[2]?.trim().toLowerCase() && !row.disabled,
  );
if (!account) {
  console.error("Conta não encontrada.");
  process.exitCode = 1;
} else {
  const token = crypto.randomBytes(32).toString("hex");
  repo.transaction(
    { id: account.organizationId || account.id, name: "Operador local" },
    "account.recovery_issued",
    (data) => {
      data.recovery = data.recovery.filter((row) => row.userId !== account.id);
      data.recovery.push({
        userId: account.id,
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
        expiresAt: Date.now() + 1800000,
      });
      return { id: account.id };
    },
  );
  console.log(`Código de recuperação (30 minutos, uso único): ${token}`);
}
