const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DOWNLOAD_DIR, COOKIE_FILE } = require('../config');

function buildArgs(videoUrl, quality, outputPath, audioFormat, trim) {
  const args = [
    '-f', (() => {
      if (audioFormat === 'mp3') return 'bestaudio/best';
      if (quality === 'bestaudio[ext=m4a]') return quality;
      const h = quality.match(/\d+/)?.[0] || '1080';
      return `bv*[height<=${h}]+ba/b[height<=${h}]/bv*+ba/b`;
    })(),
  ];
  if (audioFormat === 'mp3') {
    args.push('-x', '--audio-format', 'mp3', '--audio-quality', '0');
    if (trim) {
      const parseTime = (t) => {
        const p = (t || '0:00').split(':').map(Number);
        return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0] || 0;
      };
      const startSec = parseTime(trim.start);
      if (trim.mode === 'free' && trim.end) {
        const endSec = parseTime(trim.end);
        const dur = endSec - startSec;
        if (dur > 0) {
          args.push('--postprocessor-args', 'ffmpeg:-ss ' + startSec + ' -t ' + dur);
        }
      } else {
        const dur = trim.duration || 15;
        if (trim.fitTo15 && dur > 15) {
          const speed = dur / 15;
          let atempoChain = '';
          let remaining = speed;
          while (remaining > 2.0) {
            atempoChain += 'atempo=2.0,';
            remaining /= 2.0;
          }
          atempoChain += 'atempo=' + remaining.toFixed(4);
          args.push('--postprocessor-args', 'ffmpeg:-ss ' + startSec + ' -t ' + dur + ' -af ' + atempoChain + ' -t 15');
        } else {
          args.push('--postprocessor-args', 'ffmpeg:-ss ' + startSec + ' -t ' + dur);
        }
      }
    }
  } else {
    args.push('--merge-output-format', 'mp4');
    const isAudioOnly = quality === 'bestaudio[ext=m4a]';
    if (!isAudioOnly) args.push('--postprocessor-args', 'ffmpeg:-c:v libx264 -c:a aac -movflags +faststart');
  }
  args.push(
    '-o', outputPath,
    '--replace-in-metadata', 'title', '#', '',
    '--no-playlist',
    '--max-filesize', '200M',
    '--impersonate', 'Chrome-131:Android-14',
    '--no-write-thumbnail',
    '--remote-components', 'ejs:github',
    '--socket-timeout', '30',
  );
  if (fs.existsSync(COOKIE_FILE)) args.push('--cookies', COOKIE_FILE);
  if (/facebook\.com|fb\.watch/i.test(videoUrl)) {
    args.push('--extractor-args', 'facebook:manifest=dash_sd');
  }
  args.push(videoUrl);
  return args;
}

function startDownload(job, videoUrl, quality, outputPath, audioFormat, trim) {
  const args = buildArgs(videoUrl, quality, outputPath, audioFormat, trim);
  const proc = spawn('yt-dlp', args);
  proc.stdout.on('data', d => { job.log += d.toString(); });
  proc.stderr.on('data', d => { job.log += d.toString(); });
  proc.on('close', code => {
    job.done = true;
    if (code !== 0) {
      job.error = 'yt-dlp exited with code ' + code;
    } else {
      const files = fs.readdirSync(DOWNLOAD_DIR).map(name => ({
        name, mtime: fs.statSync(path.join(DOWNLOAD_DIR, name)).mtimeMs
      })).sort((a, b) => b.mtime - a.mtime);
      if (files.length > 0) job.filename = files[0].name;
    }
  });
}

function fetchInfo(videoUrl) {
  return new Promise((resolve, reject) => {
    const args = ['--dump-json', '--no-playlist', '--socket-timeout', '15'];
    if (fs.existsSync(COOKIE_FILE)) args.push('--cookies', COOKIE_FILE);
    args.push(videoUrl);
    const proc = spawn('yt-dlp', args);
    let out = '', err = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });
    proc.on('close', code => {
      if (code !== 0 || !out) return reject(new Error(err || 'Failed to fetch info'));
      try {
        const info = JSON.parse(out);
        resolve({
          title: info.title || '',
          duration: info.duration || 0,
          uploader: info.uploader || info.channel || '',
          thumbnail: info.thumbnail || '',
          extractor: info.extractor || '',
        });
      } catch {
        reject(new Error('Failed to parse info'));
      }
    });
  });
}

module.exports = { buildArgs, startDownload, fetchInfo };
