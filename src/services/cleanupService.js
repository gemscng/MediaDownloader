const fs = require('fs');
const path = require('path');
const { DOWNLOAD_DIR, TEMP_MAX_AGE_MS, CLEANUP_INTERVAL_MS } = require('../config');
const log = require('../logger');

function cleanupTempFiles() {
  if (!fs.existsSync(DOWNLOAD_DIR)) return;
  const now = Date.now();
  let cleaned = 0;
  for (const name of fs.readdirSync(DOWNLOAD_DIR)) {
    const fp = path.join(DOWNLOAD_DIR, name);
    try {
      const stat = fs.statSync(fp);
      if (now - stat.mtimeMs > TEMP_MAX_AGE_MS) {
        fs.unlinkSync(fp);
        cleaned++;
        log.info(`🗑 Cleaned: ${name}`);
      }
    } catch {}
  }
  if (cleaned) log.info(`🧹 Cleaned ${cleaned} temp file(s)`);
}

function start() {
  cleanupTempFiles();
  setInterval(cleanupTempFiles, CLEANUP_INTERVAL_MS);
}

module.exports = { start, cleanupTempFiles };
