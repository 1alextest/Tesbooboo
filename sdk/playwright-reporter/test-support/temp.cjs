const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function consumerTempRoot() {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const approved = path.join(localAppData, "Temp", "opencode");
    if (fs.existsSync(approved)) return approved;
  }
  return os.tmpdir();
}

module.exports = { consumerTempRoot };
