const crypto = require("node:crypto");
const { DomainError } = require("../domain/workflow");
function derive(password, salt = crypto.randomBytes(16).toString("hex")) {
  return `${salt}:${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function verify(password, stored) {
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    typeof stored !== "string"
  )
    return false;
  const [salt, expected] = stored.split(":");
  if (!salt || !/^[a-f0-9]{128}$/.test(expected || "")) return false;
  return crypto.timingSafeEqual(
    Buffer.from(derive(password, salt).split(":")[1], "hex"),
    Buffer.from(expected, "hex"),
  );
}
function validate(password) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 128
  )
    throw new DomainError("Use uma senha entre 10 e 128 caracteres.");
}
module.exports = { derive, verify, validate };
