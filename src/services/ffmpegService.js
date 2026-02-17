const { spawn } = require('child_process');

function extractAudio(job, inputPath, outputPath, trimStart, trimEnd) {
  const args = ['-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '0'];
  addTrimArgs(args, trimStart, trimEnd);
  args.push('-y', outputPath);
  return runFfmpeg(job, args);
}

function removeAudio(job, inputPath, outputPath, trimStart, trimEnd) {
  const args = ['-i', inputPath, '-an', '-c:v', 'copy'];
  addTrimArgs(args, trimStart, trimEnd);
  args.push('-y', outputPath);
  return runFfmpeg(job, args);
}

function addTrimArgs(args, trimStart, trimEnd) {
  if (trimStart && trimStart !== '0:00' && trimStart !== '0') {
    const parts = trimStart.split(':').map(Number);
    const sec = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] || 0;
    if (sec > 0) args.push('-ss', String(sec));
  }
  if (trimEnd) {
    const endParts = trimEnd.split(':').map(Number);
    const endSec = endParts.length === 2 ? endParts[0] * 60 + endParts[1] : endParts[0] || 0;
    if (endSec > 0) {
      const startParts = (trimStart || '0:00').split(':').map(Number);
      const startSec = startParts.length === 2 ? startParts[0] * 60 + startParts[1] : startParts[0] || 0;
      const duration = endSec - startSec;
      if (duration > 0) args.push('-t', String(duration));
    }
  }
}

function runFfmpeg(job, args) {
  const proc = spawn('ffmpeg', args);
  proc.stdout.on('data', d => { job.log += d.toString(); });
  proc.stderr.on('data', d => { job.log += d.toString(); });
  return new Promise((resolve) => {
    proc.on('close', code => resolve(code));
  });
}

module.exports = { extractAudio, removeAudio };
