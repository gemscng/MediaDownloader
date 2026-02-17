const express = require('express');
const fs = require('fs');
const path = require('path');
const { DOWNLOAD_DIR } = require('../config');
const fileService = require('../services/fileService');
const log = require('../logger');

const router = express.Router();

router.get('/files', (req, res) => {
  res.json(fileService.listFiles());
});

router.post('/files/clear', (req, res) => {
  fileService.clearAll();
  res.json({ ok: true });
});

router.get('/file/:name', (req, res, next) => {
  try {
    const name = req.params.name;
    const fp = path.join(DOWNLOAD_DIR, path.basename(name));
    if (!fs.existsSync(fp)) return res.status(404).send('Not found');
    const stat = fs.statSync(fp);
    const ext = path.extname(fp).toLowerCase();
    const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.opus': 'audio/opus', '.ogg': 'audio/ogg' }[ext] || 'application/octet-stream';
    const safeName = path.basename(name);
    const encodedName = encodeURIComponent(safeName);
    res.set({
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    });
    const stream = fs.createReadStream(fp);
    stream.pipe(res);
    if (req.query.autodelete === '1') {
      stream.on('end', () => {
        setTimeout(() => {
          try { fs.unlinkSync(fp); log.info(`🗑 Auto-deleted: ${safeName}`); } catch {}
        }, 5000);
      });
    }
  } catch (err) { next(err); }
});

router.delete('/file/:name', (req, res) => {
  fileService.deleteFile(req.params.name);
  res.json({ ok: true });
});

module.exports = router;
