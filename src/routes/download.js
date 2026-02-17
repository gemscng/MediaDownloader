const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { DOWNLOAD_DIR } = require('../config');
const downloadService = require('../services/downloadService');
const jobManager = require('../services/jobManager');

const router = express.Router();

router.post('/download', (req, res, next) => {
  try {
    const { url: videoUrl, quality, mode, filename: customName, audioFormat, trim } = req.body;
    const jobId = crypto.randomBytes(4).toString('hex');
    const safeName = customName ? customName.replace(/[/\\<>:"|?*#]/g, '').slice(0, 80) : null;
    const outputPath = safeName
      ? path.join(DOWNLOAD_DIR, safeName + '.%(ext)s')
      : path.join(DOWNLOAD_DIR, '%(title).80s.%(ext)s');
    const job = jobManager.create(jobId, mode || 'save');
    downloadService.startDownload(job, videoUrl, quality, outputPath, audioFormat, trim);
    res.json({ jobId });
  } catch (err) { next(err); }
});

router.post('/info', async (req, res, next) => {
  try {
    const { url: videoUrl } = req.body;
    const info = await downloadService.fetchInfo(videoUrl);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:jobId', (req, res) => {
  const job = jobManager.get(req.params.jobId);
  res.json(job);
});

// Thumbnail proxy — fetch video thumbnail by job's info URL
router.get('/api/thumbnail', async (req, res) => {
  const { url: thumbUrl } = req.query;
  if (!thumbUrl) return res.status(400).json({ error: 'Missing url parameter' });
  try {
    const https = require('https');
    const http = require('http');
    const mod = thumbUrl.startsWith('https') ? https : http;
    mod.get(thumbUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (upstream) => {
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        return res.redirect(upstream.headers.location);
      }
      res.setHeader('Content-Type', upstream.headers['content-type'] || 'image/jpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="thumbnail.jpg"');
      upstream.pipe(res);
    }).on('error', () => res.status(502).json({ error: 'Failed to fetch thumbnail' }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
