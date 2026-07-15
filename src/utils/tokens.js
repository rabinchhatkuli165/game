const crypto = require("crypto");

function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

module.exports = { randomToken };
