const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { DOWNLOAD_DIR } = require('../config');
const downloadService = require('../services/downloadService');
const jobManager = require('../services/jobManager');
const queue = require('../services/queue');

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

    const startFn = () => {
      job.status = 'downloading';
      downloadService.startDownload(job, videoUrl, quality, outputPath, audioFormat, trim, () => {
        queue.jobFinished(jobId);
      });
    };

    const result = queue.enqueue(jobId, startFn);

    if (result.rejected) {
      return res.status(503).json({ error: 'Server queue is full. Please try again later.' });
    }

    if (result.queued) {
      job.status = 'queued';
      job.position = result.position;
    } else {
      job.status = 'downloading';
    }

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
  const jobId = req.params.jobId;
  const job = jobManager.get(jobId);

  // Record poll to keep queue spot alive
  queue.recordPoll(jobId);

  // Update queue position dynamically
  const position = queue.getPosition(jobId);
  if (position != null) {
    job.status = 'queued';
    job.position = position;
    job.estimatedWaitMs = queue.estimateWait(position);
  } else if (!job.done && queue.isActive(jobId)) {
    job.status = 'downloading';
    delete job.position;
  }

  res.json(job);
});

router.get('/api/queue/status', (req, res) => {
  res.json(queue.status());
});

// Thumbnail proxy
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
