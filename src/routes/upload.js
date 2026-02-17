const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { DOWNLOAD_DIR, MAX_FILE_SIZE } = require('../config');
const ffmpegService = require('../services/ffmpegService');
const jobManager = require('../services/jobManager');

const upload = multer({
  dest: DOWNLOAD_DIR,
  limits: { fileSize: MAX_FILE_SIZE * 1024 * 1024 },
});

const router = express.Router();

router.post('/upload-extract', upload.single('video'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

    const trimStart = req.body.trimStart || '0:00';
    const trimEnd = req.body.trimEnd || '';
    const uploadMode = req.body.mode || 'extract-mp3';
    const isRemoveAudio = uploadMode === 'remove-audio';

    const origName = (req.file.originalname || 'video').replace(/[/\\<>:"|?*#]/g, '').slice(0, 80);
    const baseName = path.parse(origName).name;
    const tempVideoPath = req.file.path;
    const outputFile = isRemoveAudio
      ? path.join(DOWNLOAD_DIR, `${baseName}-silent.mp4`)
      : path.join(DOWNLOAD_DIR, `${baseName}.mp3`);

    const jobId = crypto.randomBytes(4).toString('hex');
    const actionLabel = isRemoveAudio ? 'Removing audio' : 'Extracting MP3';
    const job = jobManager.create(jobId, 'direct');
    job.log = `Uploaded: ${origName} (${(req.file.size / 1024 / 1024).toFixed(1)} MB)\n${actionLabel}...\n`;

    // Run ffmpeg async
    (async () => {
      const code = isRemoveAudio
        ? await ffmpegService.removeAudio(job, tempVideoPath, outputFile, trimStart, trimEnd)
        : await ffmpegService.extractAudio(job, tempVideoPath, outputFile, trimStart, trimEnd);
      try { fs.unlinkSync(tempVideoPath); } catch {}
      job.done = true;
      if (code !== 0) {
        job.error = 'ffmpeg exited with code ' + code;
      } else {
        job.filename = isRemoveAudio ? `${baseName}-silent.mp4` : `${baseName}.mp3`;
      }
    })();

    res.json({ jobId });
  } catch (err) { next(err); }
});

module.exports = router;
