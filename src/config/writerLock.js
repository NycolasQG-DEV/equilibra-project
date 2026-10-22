const fs = require("node:fs");
const path = require("node:path");
const { directory, initializeStorage } = require("./equilibraStorage");
function acquire() {
  fs.mkdirSync(directory, { recursive: true });
  const filename = path.join(directory, ".writer.lock");
  if (fs.existsSync(filename)) {
    const pid = Number(fs.readFileSync(filename, "utf8"));
    let alive = false;
    if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        alive = true;
      } catch (error) {
        if (error.code !== "ESRCH") alive = true;
      }
    }
    if (alive)
      throw new Error(
        "Já existe um servidor usando esta pasta de dados. JSON exige um único processo.",
      );
    fs.unlinkSync(filename);
  }
  fs.writeFileSync(filename, String(process.pid), { flag: "wx", mode: 0o600 });
  process.on("exit", () => {
    if (
      fs.existsSync(filename) &&
      fs.readFileSync(filename, "utf8") === String(process.pid)
    )
      fs.unlinkSync(filename);
  });
  initializeStorage();
}
module.exports = { acquire };
