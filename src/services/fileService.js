const fs = require('fs');
const path = require('path');
const { DOWNLOAD_DIR, TEMP_MAX_AGE_MS } = require('../config');

function listFiles() {
  if (!fs.existsSync(DOWNLOAD_DIR)) return [];
  const now = Date.now();
  return fs.readdirSync(DOWNLOAD_DIR).map(name => {
    const stat = fs.statSync(path.join(DOWNLOAD_DIR, name));
    const mb = (stat.size / 1024 / 1024).toFixed(1);
    const ageMin = Math.floor((now - stat.mtimeMs) / 60000);
    const age = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago`;
    const ttl = Math.max(0, Math.ceil((TEMP_MAX_AGE_MS - (now - stat.mtimeMs)) / 60000));
    return { name, size: mb + ' MB', mtime: stat.mtime, age, ttl: `${ttl}m left` };
  }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
}

function clearAll() {
  if (!fs.existsSync(DOWNLOAD_DIR)) return;
  for (const name of fs.readdirSync(DOWNLOAD_DIR)) {
    try { fs.unlinkSync(path.join(DOWNLOAD_DIR, name)); } catch {}
  }
}

function deleteFile(name) {
  const fp = path.join(DOWNLOAD_DIR, path.basename(name));
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

module.exports = { listFiles, clearAll, deleteFile };
