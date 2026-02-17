const express = require('express');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { COOKIE_FILE, DOWNLOAD_DIR } = require('../config');

const router = express.Router();
const upload = multer({ dest: '/tmp' });

router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
});

router.get('/health', (req, res) => {
  const count = fs.existsSync(DOWNLOAD_DIR) ? fs.readdirSync(DOWNLOAD_DIR).length : 0;
  res.json({ ok: true, downloads: count });
});

router.post('/cookies', upload.single('cookies'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file received' });
  fs.copyFileSync(req.file.path, COOKIE_FILE);
  fs.unlinkSync(req.file.path);
  res.json({ message: 'Cookies uploaded! ✅' });
});

router.delete('/cookies', (req, res) => {
  try { fs.unlinkSync(COOKIE_FILE); } catch {}
  res.json({ ok: true });
});

module.exports = router;
