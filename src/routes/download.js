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

module.exports = router;
