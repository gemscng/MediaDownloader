const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

const PORT = 3003;
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const COOKIE_FILE = path.join(__dirname, 'cookies.txt');
const TEMP_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // check every 10 min

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// Track active downloads
const jobs = new Map();

// === Auto-cleanup: delete temp files older than 1 hour ===
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
        console.log(`🗑 Cleaned: ${name}`);
      }
    } catch {}
  }
  if (cleaned) console.log(`🧹 Cleaned ${cleaned} temp file(s)`);
}
setInterval(cleanupTempFiles, CLEANUP_INTERVAL_MS);
cleanupTempFiles(); // run on startup

// === Multipart parser ===
function parseMultipart(buf, boundary) {
  const parts = {};
  const sep = Buffer.from('--' + boundary);
  let start = buf.indexOf(sep) + sep.length;
  while (start < buf.length) {
    let end = buf.indexOf(sep, start);
    if (end === -1) break;
    const part = buf.slice(start, end);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) { start = end + sep.length; continue; }
    const header = part.slice(0, headerEnd).toString();
    const body = part.slice(headerEnd + 4, part.length - 2);
    const nameMatch = header.match(/name="([^"]+)"/);
    const fileMatch = header.match(/filename="([^"]+)"/);
    if (nameMatch) {
      parts[nameMatch[1]] = { data: body, filename: fileMatch?.[1], header };
    }
    start = end + sep.length;
  }
  return parts;
}

// === yt-dlp args builder ===
function buildArgs(videoUrl, quality, outputPath, audioFormat, trim) {
  const isAudioOnly = quality === 'bestaudio[ext=m4a]' || audioFormat === 'mp3';
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
      // Parse start time to seconds
      const parseTime = (t) => { const p = (t || '0:00').split(':').map(Number); return p.length === 3 ? p[0]*3600+p[1]*60+p[2] : p.length === 2 ? p[0]*60+p[1] : p[0]||0; };
      const startSec = parseTime(trim.start);
      if (trim.mode === 'free' && trim.end) {
        // Free trim: start to end
        const endSec = parseTime(trim.end);
        const dur = endSec - startSec;
        if (dur > 0) {
          args.push('--postprocessor-args', 'ffmpeg:-ss ' + startSec + ' -t ' + dur);
        }
      } else {
        const dur = trim.duration || 15;
        if (trim.fitTo15 && dur > 15) {
          // Speed up audio to fit into 15s using atempo filter
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

// === HTML ===
function getHTML() {
  const hasCookies = fs.existsSync(COOKIE_FILE);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Free Video Downloader - YouTube, Facebook, Instagram, TikTok, Threads | Download HD 1080p</title>
<meta name="description" content="Free online video downloader. Download videos from YouTube, Facebook, Instagram, Threads, TikTok, Twitter/X in HD 1080p MP4. QuickTime compatible. No ads, no watermark.">
<meta name="keywords" content="video downloader, youtube downloader, facebook video download, instagram video download, tiktok download, threads video download, twitter video download, free HD download, 1080p mp4, online video downloader">
<meta name="robots" content="index, follow">
<meta property="og:title" content="Free Video Downloader - YouTube, FB, IG, TikTok, Threads">
<meta property="og:description" content="Download videos from YouTube, Facebook, Instagram, Threads, TikTok, Twitter/X in HD 1080p MP4. Free, fast, no ads.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Free Video Downloader - HD 1080p MP4">
<meta name="twitter:description" content="Download videos from YouTube, Facebook, Instagram, TikTok, Threads & more. Free, no ads.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0f0f0f;color:#fff;min-height:100vh;padding:20px}
.layout{display:flex;gap:20px;max-width:900px;margin:0 auto;align-items:flex-start}
.main{flex:1;display:flex;flex-direction:column;align-items:center;min-width:0}
.sidebar{width:260px;flex-shrink:0;position:sticky;top:20px}
@media(max-width:768px){.layout{flex-direction:column}.sidebar{width:100%;position:static;order:99}}
h1{font-size:24px;margin:20px 0;color:#ff4444}
.aff-card{background:#1a1a1a;border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid #262626;transition:border-color .2s}
.aff-card:hover{border-color:#444}
.aff-badge{font-size:10px;color:#ff9800;font-weight:600;letter-spacing:1px;margin-bottom:6px}
.aff-title{font-size:15px;font-weight:700;color:#fff;margin-bottom:4px}
.aff-desc{font-size:12px;color:#888;line-height:1.5;margin-bottom:10px}
.aff-btn{display:block;text-align:center;padding:10px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;transition:opacity .2s}
.aff-btn:hover{opacity:.85}
.aff-deal{font-size:11px;color:#4CAF50;margin-top:6px;text-align:center}
.aff-tag{display:inline-block;font-size:10px;padding:2px 6px;border-radius:4px;background:#333;color:#aaa;margin-right:4px;margin-top:4px}
.card{background:#1a1a1a;border-radius:12px;padding:24px;width:100%;max-width:600px;margin:10px 0}
input[type="text"]{width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#222;color:#fff;font-size:16px;outline:none}
input[type="text"]:focus{border-color:#ff4444}
select{width:100%;padding:10px;margin-top:8px;border-radius:8px;border:1px solid #333;background:#222;color:#fff}
.btn{background:#ff4444;color:#fff;border:none;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;width:100%;margin-top:12px;font-weight:600}
.btn:hover{background:#ff6666}
.btn:disabled{background:#555;cursor:not-allowed}
.btn-sm{background:#333;padding:8px 16px;font-size:14px;width:auto;margin-top:8px;border:none;color:#fff;border-radius:8px;cursor:pointer}
.btn-sm:hover{background:#444}
.status{margin-top:12px;padding:12px;background:#222;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap;max-height:200px;overflow-y:auto;display:none}
.cookie-status{font-size:13px;color:${hasCookies ? '#4CAF50' : '#ff9800'};margin-bottom:12px}
.downloads{margin-top:8px}
.dl-item{display:flex;justify-content:space-between;align-items:center;padding:10px;background:#222;border-radius:8px;margin:6px 0}
.dl-item a{color:#ff4444;text-decoration:none;font-weight:600;word-break:break-all}
label.upload{display:inline-block;padding:8px 16px;background:#333;border-radius:8px;cursor:pointer;font-size:14px;margin-top:8px}
label.upload:hover{background:#444}
input[type="file"]{display:none}
.tag{font-size:11px;padding:2px 8px;border-radius:4px;background:#333;margin-left:8px;white-space:nowrap}
.mode-toggle{display:flex;gap:8px;margin-top:8px}
.mode-btn{flex:1;padding:10px;border-radius:8px;border:2px solid #333;background:transparent;color:#999;cursor:pointer;font-size:13px;font-weight:600;text-align:center;transition:all .2s}
.mode-btn.active{border-color:#ff4444;color:#ff4444;background:#ff444410}
.mode-btn:hover{border-color:#ff6666;color:#ff6666}
.timer{font-size:11px;color:#666;margin-left:8px}
</style>
</head>
<body>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"Free Video Downloader","description":"Download videos from YouTube, Facebook, Instagram, Threads, TikTok, Twitter/X in HD 1080p MP4","applicationCategory":"MultimediaApplication","operatingSystem":"All","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
<header style="text-align:center">
<h1>🎬 Free Video Downloader</h1>
<p style="color:#888;font-size:13px;margin-bottom:10px">Download HD videos from <strong>YouTube</strong> · <strong>Facebook</strong> · <strong>Instagram</strong> · <strong>Threads</strong> · <strong>TikTok</strong> · <strong>Twitter/X</strong> · and 1000+ sites</p>
</header>
<div class="layout">
<div class="main">

<!-- Admin cookie panel: access via /admin -->


<div class="card">
  <input type="text" id="url" placeholder="Paste video URL (YouTube, FB, IG, Threads, TikTok...)" autofocus oninput="onUrlInput(this.value)">
  <div id="videoInfo" style="display:none;margin-top:8px;padding:10px;background:#222;border-radius:8px">
    <div style="font-size:11px;color:#888;margin-bottom:4px">📹 Video title (editable):</div>
    <input type="text" id="filename" placeholder="Video filename..." style="font-size:14px;padding:8px;border-color:#444">
    <div id="videoMeta" style="font-size:11px;color:#666;margin-top:4px"></div>
  </div>
  <select id="quality">
    <option value="best[height<=480]">480p</option>
    <option value="best[height<=720]">720p</option>
    <option value="best[height<=1080]" selected>1080p</option>
    <option value="best">Best</option>
    <option value="bestaudio[ext=m4a]">Audio only (m4a)</option>
    <option value="bestaudio/best" data-audio="mp3">Audio only (mp3)</option>
    <option value="bestaudio/best" data-audio="mp3" data-trim="free">✂️ MP3 Trim (custom range)</option>
    <option value="bestaudio/best" data-audio="mp3" data-trim="15">🎵 MP3 Ringtone (15s trim)</option>
  </select>
  <div id="trimPanel" style="display:none;margin-top:8px;padding:10px;background:#222;border-radius:8px">
    <div style="font-size:11px;color:#888;margin-bottom:6px">✂️ Trim settings:</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label style="font-size:13px;color:#aaa">Start:</label>
      <input type="text" id="trimStart" value="0:00" placeholder="0:00" style="width:70px;padding:6px;font-size:13px;text-align:center">
      <label style="font-size:13px;color:#aaa" id="trimEndLabel" style="display:none">End:</label>
      <input type="text" id="trimEnd" placeholder="1:30" style="width:70px;padding:6px;font-size:13px;text-align:center;display:none">
      <label style="font-size:13px;color:#aaa" id="trimDurLabel">Duration:</label>
      <input type="text" id="trimDuration" value="15" placeholder="15" style="width:50px;padding:6px;font-size:13px;text-align:center">
      <span id="trimDurUnit" style="font-size:13px;color:#666">seconds</span>
    </div>
    <div id="fitPanel" style="margin-top:8px;display:flex;align-items:center;gap:8px">
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:13px;color:#aaa">
        <input type="checkbox" id="fitTo15" style="accent-color:#ff4444"> Fit to 15s (speed up if longer)
      </label>
      <span id="speedLabel" style="font-size:11px;color:#ff4444;display:none">→ 1.0x</span>
    </div>
  </div>
  <div class="mode-toggle">
    <div class="mode-btn active" data-mode="direct" onclick="setMode('direct')">⚡ Direct Download<br><span style="font-size:11px;font-weight:400">Stream to you, no server storage</span></div>
    <div class="mode-btn" data-mode="save" onclick="setMode('save')">💾 Save on Server<br><span style="font-size:11px;font-weight:400">Keep file (auto-deletes in 1h)</span></div>
  </div>
  <button class="btn" onclick="startDownload()">⬇️ Download</button>
  <div class="status" id="status"></div>
</div>

<div class="card">
  <h3 style="margin-bottom:8px">🛠️ Video Tools</h3>
  <p style="font-size:12px;color:#888;margin-bottom:12px">Upload a video file to extract audio or remove audio</p>
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <label class="upload" style="margin:0">📁 Choose Video<input type="file" id="uploadFile" accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.flv,.wmv,.m4v,.3gp" onchange="showUploadName(this)"></label>
    <span id="uploadName" style="font-size:13px;color:#888;word-break:break-all"></span>
  </div>
  <select id="uploadMode" style="margin-top:8px" onchange="toggleUploadTrim()">
    <option value="extract-mp3">🎵 Extract MP3 (audio only)</option>
    <option value="remove-audio">🔇 Remove Audio (silent video)</option>
  </select>
  <div id="uploadTrimPanel" style="margin-top:8px;padding:10px;background:#222;border-radius:8px">
    <div style="font-size:11px;color:#888;margin-bottom:6px">✂️ Trim (optional):</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label style="font-size:13px;color:#aaa">Start:</label>
      <input type="text" id="upTrimStart" value="0:00" placeholder="0:00" style="width:70px;padding:6px;font-size:13px;text-align:center">
      <label style="font-size:13px;color:#aaa">End:</label>
      <input type="text" id="upTrimEnd" placeholder="(full)" style="width:70px;padding:6px;font-size:13px;text-align:center">
      <span style="font-size:11px;color:#666">leave End empty for full length</span>
    </div>
  </div>
  <button class="btn" onclick="uploadExtract()" style="background:#9c27b0" id="uploadBtn">🎵 Extract MP3</button>
  <div class="status" id="uploadStatus"></div>
</div>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <h3>📦 Downloads</h3>
    <button class="btn-sm" onclick="clearAll()" style="margin:0">🗑 Clear All</button>
  </div>
  <div class="downloads" id="downloads">Loading...</div>
</div>

<section class="card" style="margin-top:16px">
<details><summary style="cursor:pointer;font-weight:600;color:#ccc">❓ FAQ - How to download videos</summary>
<div style="margin-top:12px;font-size:13px;color:#999;line-height:1.8">
<p><strong>How to download YouTube videos?</strong><br>Paste the YouTube video URL and click Download. Supports 480p, 720p, 1080p and best quality.</p>
<p><strong>How to download Facebook videos?</strong><br>Copy the Facebook video link from the share button, paste it here and download in MP4 format.</p>
<p><strong>How to download Instagram Reels?</strong><br>Copy the Instagram Reel or post URL, paste it and download. Works with Stories, Reels, and IGTV.</p>
<p><strong>How to download Threads videos?</strong><br>Copy the Threads post URL and paste it here. Videos are downloaded in HD MP4.</p>
<p><strong>How to download TikTok videos?</strong><br>Copy the TikTok video link, paste it here. Downloads without watermark in HD quality.</p>
<p><strong>What's the difference between Direct and Save mode?</strong><br><strong>Direct:</strong> Video streams straight to your browser — no file stored on server. <strong>Save:</strong> File stays on server for 1 hour so you can re-download or share the link.</p>
<p><strong>What format are downloads?</strong><br>All videos are downloaded as MP4 with H.264 codec — compatible with QuickTime, VLC, and all major players.</p>
<p><strong>Is it free?</strong><br>Yes, 100% free. No ads, no watermarks, no sign-up required.</p>
</div>
</details>
</section>

</div><!-- /main -->

<aside class="sidebar">
  <div class="aff-card">
    <div class="aff-badge">🛡️ RECOMMENDED</div>
    <div class="aff-title">NordVPN</div>
    <div class="aff-desc">Protect your privacy while downloading. Hide your IP, unblock geo-restricted content, and stay safe online.</div>
    <a class="aff-btn" style="background:#4687ff;color:#fff" href="https://go.nordvpn.net/aff_c?offer_id=15&aff_id=AFFILIATE_ID&url_id=902" target="_blank" rel="nofollow sponsored noopener">🔒 Get 73% Off NordVPN</a>
    <div class="aff-deal">💰 30-day money-back guarantee</div>
    <div><span class="aff-tag">VPN</span><span class="aff-tag">Privacy</span><span class="aff-tag">Streaming</span></div>
  </div>

  <div class="aff-card">
    <div class="aff-badge">⚡ POPULAR</div>
    <div class="aff-title">Surfshark VPN</div>
    <div class="aff-desc">Unlimited devices, one subscription. Fast servers in 100+ countries. Perfect for streaming & downloading.</div>
    <a class="aff-btn" style="background:#1fcca1;color:#000" href="https://surfshark.com/deal?utm_source=AFFILIATE_ID" target="_blank" rel="nofollow sponsored noopener">🌊 Get 82% Off Surfshark</a>
    <div class="aff-deal">💰 From $2.49/mo + 2 months free</div>
    <div><span class="aff-tag">VPN</span><span class="aff-tag">Unlimited Devices</span></div>
  </div>

  <div class="aff-card">
    <div class="aff-badge">☁️ STORAGE</div>
    <div class="aff-title">pCloud</div>
    <div class="aff-desc">Save your downloaded videos forever. Lifetime cloud storage — pay once, use forever. Up to 10TB.</div>
    <a class="aff-btn" style="background:#2196F3;color:#fff" href="https://partner.pcloud.com/r/AFFILIATE_ID" target="_blank" rel="nofollow sponsored noopener">☁️ Get Lifetime Storage</a>
    <div class="aff-deal">💰 Up to 75% off lifetime plans</div>
    <div><span class="aff-tag">Cloud</span><span class="aff-tag">Lifetime</span><span class="aff-tag">10TB</span></div>
  </div>

  <div class="aff-card">
    <div class="aff-badge">🎵 MUSIC</div>
    <div class="aff-title">Epidemic Sound</div>
    <div class="aff-desc">Royalty-free music & sound effects for your video projects. 40,000+ tracks, cleared for all platforms.</div>
    <a class="aff-btn" style="background:#ff5722;color:#fff" href="https://www.epidemicsound.com/referral/AFFILIATE_ID" target="_blank" rel="nofollow sponsored noopener">🎵 Get 30 Days Free</a>
    <div class="aff-deal">💰 Cancel anytime</div>
    <div><span class="aff-tag">Music</span><span class="aff-tag">Royalty-Free</span><span class="aff-tag">Creator</span></div>
  </div>

  <div style="text-align:center;font-size:10px;color:#444;margin-top:8px">
    <p>Affiliate links help keep this tool free ❤️</p>
  </div>
</aside>
</div><!-- /layout -->

<footer style="margin-top:20px;font-size:11px;color:#444;text-align:center;width:100%">
<p>Supports 1000+ video sites powered by yt-dlp · H.264 MP4 · QuickTime compatible</p>
<p style="margin-top:4px">Temp files auto-delete after 1 hour</p>
</footer>

<script>
let mode = 'direct';

function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
}

function updateSpeedLabel() {
  const dur = parseInt(document.getElementById('trimDuration').value) || 15;
  const fit = document.getElementById('fitTo15').checked;
  const label = document.getElementById('speedLabel');
  if (fit && dur > 15) {
    const speed = (dur / 15).toFixed(2);
    label.textContent = '→ ' + speed + 'x speed → 15s output';
    label.style.display = 'inline';
  } else {
    label.style.display = 'none';
  }
}
document.getElementById('trimDuration')?.addEventListener('input', updateSpeedLabel);
document.getElementById('fitTo15')?.addEventListener('change', updateSpeedLabel);

document.getElementById('quality').addEventListener('change', function() {
  const opt = this.options[this.selectedIndex];
  const trim = opt.dataset.trim;
  const panel = document.getElementById('trimPanel');
  const trimEnd = document.getElementById('trimEnd');
  const trimEndLabel = document.getElementById('trimEndLabel');
  const trimDurLabel = document.getElementById('trimDurLabel');
  const trimDuration = document.getElementById('trimDuration');
  const trimDurUnit = document.getElementById('trimDurUnit');
  const fitPanel = document.getElementById('fitPanel');
  panel.style.display = trim ? 'block' : 'none';
  if (trim === 'free') {
    trimEnd.style.display = '';
    trimEndLabel.style.display = '';
    trimDurLabel.style.display = 'none';
    trimDuration.style.display = 'none';
    trimDurUnit.style.display = 'none';
    fitPanel.style.display = 'none';
  } else if (trim) {
    trimEnd.style.display = 'none';
    trimEndLabel.style.display = 'none';
    trimDurLabel.style.display = '';
    trimDuration.style.display = '';
    trimDurUnit.style.display = '';
    fitPanel.style.display = 'flex';
    trimDuration.value = trim;
  }
});

let infoTimeout = null;
let lastInfoUrl = '';

function onUrlInput(val) {
  val = val.trim();
  if (!val || val === lastInfoUrl) return;
  // Debounce - wait 800ms after user stops typing
  clearTimeout(infoTimeout);
  if (!val.match(/^https?:\\/\\//)) return;
  infoTimeout = setTimeout(() => fetchInfo(val), 800);
}

async function fetchInfo(videoUrl) {
  if (videoUrl === lastInfoUrl) return;
  lastInfoUrl = videoUrl;
  const info = document.getElementById('videoInfo');
  const meta = document.getElementById('videoMeta');
  const fname = document.getElementById('filename');
  info.style.display = 'block';
  fname.value = '';
  meta.textContent = '⏳ Fetching video info...';
  try {
    const res = await fetch('/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    const data = await res.json();
    if (data.error) {
      meta.textContent = '⚠️ ' + data.error;
      return;
    }
    fname.value = data.title || '';
    const dur = data.duration ? Math.floor(data.duration/60) + ':' + String(Math.floor(data.duration%60)).padStart(2,'0') : '';
    const parts = [data.uploader, dur, data.extractor].filter(Boolean);
    meta.textContent = parts.join(' · ');
  } catch(e) {
    meta.textContent = '⚠️ Could not fetch info';
  }
}

async function uploadCookies(input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('cookies', file);
  const res = await fetch('/cookies', { method: 'POST', body: form });
  const data = await res.json();
  alert(data.message);
  location.reload();
}

async function startDownload() {
  const url = document.getElementById('url').value.trim();
  if (!url) return;
  const quality = document.getElementById('quality').value;
  const btn = document.querySelector('.btn');
  const status = document.getElementById('status');
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = 'Starting...\\n';
  
  const res = await fetch('/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, quality, mode, filename: document.getElementById('filename').value.trim() || null, audioFormat: document.querySelector('#quality option:checked').dataset.audio || null, trim: document.querySelector('#quality option:checked').dataset.trim ? { start: document.getElementById('trimStart').value, end: document.getElementById('trimEnd').value || null, duration: parseInt(document.getElementById('trimDuration').value) || 15, fitTo15: document.getElementById('fitTo15').checked, mode: document.querySelector('#quality option:checked').dataset.trim } : null })
  });
  const { jobId } = await res.json();
  
  const poll = setInterval(async () => {
    const r = await fetch('/status/' + jobId);
    const d = await r.json();
    status.textContent = d.log || 'Working...';
    status.scrollTop = status.scrollHeight;
    if (d.done) {
      clearInterval(poll);
      btn.disabled = false;
      if (d.error) {
        status.textContent += '\\n❌ ' + d.error;
      } else if (d.filename) {
        status.textContent += '\\n✅ Done!';
        if (mode === 'direct') {
          // Trigger browser download then tell server to cleanup
          const enc = encodeURIComponent(d.filename).replace(/#/g, '%23');
          const a = document.createElement('a');
          a.href = '/file/' + enc + '?autodelete=1';
          a.download = d.filename;
          a.click();
          status.textContent += '\\n📥 Downloading to your device...';
        }
        loadDownloads();
      } else {
        status.textContent += '\\n✅ Done!';
        loadDownloads();
      }
    }
  }, 1000);
}

function toggleUploadTrim() {
  const mode = document.getElementById('uploadMode').value;
  const btn = document.getElementById('uploadBtn');
  if (mode === 'extract-mp3') {
    btn.textContent = '🎵 Extract MP3';
  } else {
    btn.textContent = '🔇 Remove Audio';
  }
}

function showUploadName(input) {
  const el = document.getElementById('uploadName');
  el.textContent = input.files[0] ? input.files[0].name + ' (' + (input.files[0].size / 1024 / 1024).toFixed(1) + ' MB)' : '';
}

async function uploadExtract() {
  const fileInput = document.getElementById('uploadFile');
  if (!fileInput.files[0]) return alert('Please choose a video file first');
  const file = fileInput.files[0];
  if (file.size > 500 * 1024 * 1024) return alert('File too large (max 500MB)');
  
  const btn = document.querySelectorAll('.btn')[1];
  const status = document.getElementById('uploadStatus');
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = 'Uploading ' + file.name + '...\\n';
  
  const form = new FormData();
  form.append('video', file);
  form.append('trimStart', document.getElementById('upTrimStart').value || '0:00');
  form.append('trimEnd', document.getElementById('upTrimEnd').value || '');
  form.append('mode', document.getElementById('uploadMode').value || 'extract-mp3');
  
  try {
    const res = await fetch('/upload-extract', { method: 'POST', body: form });
    const { jobId, error } = await res.json();
    if (error) { status.textContent = '❌ ' + error; btn.disabled = false; return; }
    status.textContent = 'Processing...\\n';
    
    const poll = setInterval(async () => {
      const r = await fetch('/status/' + jobId);
      const d = await r.json();
      status.textContent = d.log || 'Working...';
      status.scrollTop = status.scrollHeight;
      if (d.done) {
        clearInterval(poll);
        btn.disabled = false;
        if (d.error) {
          status.textContent += '\\n❌ ' + d.error;
        } else if (d.filename) {
          status.textContent += '\\n✅ Done!';
          const enc = encodeURIComponent(d.filename).replace(/#/g, '%23');
          const a = document.createElement('a');
          a.href = '/file/' + enc + '?autodelete=1';
          a.download = d.filename;
          a.click();
          status.textContent += '\\n📥 Downloading MP3...';
          loadDownloads();
        }
      }
    }, 1000);
  } catch(e) {
    status.textContent = '❌ Upload failed: ' + e.message;
    btn.disabled = false;
  }
}

async function loadDownloads() {
  const res = await fetch('/files');
  const files = await res.json();
  const el = document.getElementById('downloads');
  if (!files.length) { el.innerHTML = '<div style="color:#666">No files yet</div>'; return; }
  el.innerHTML = files.map(f => {
    const enc = encodeURIComponent(f.name).replace(/#/g, '%23');
    const safe = f.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="dl-item"><div><a href="/file/' + enc + '">' + safe + '</a><span class="tag">' + f.size + '</span><span class="timer">' + f.age + '</span></div><button class="btn-sm" onclick="del(\\'' + enc + '\\')" style="margin:0">🗑</button></div>';
  }).join('');
}

async function del(name) {
  await fetch('/file/' + name, { method: 'DELETE' });
  loadDownloads();
}

async function clearAll() {
  if (!confirm('Delete all downloaded files?')) return;
  await fetch('/files/clear', { method: 'POST' });
  loadDownloads();
}

loadDownloads();
setInterval(loadDownloads, 30000); // refresh file list every 30s
</script>
</body>
</html>`;
}

// === Server ===
const server = http.createServer(async (req, res) => {
  // CORS for future S3 frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(getHTML());
  }

  // Admin panel - cookie management
  if (req.method === 'GET' && url.pathname === '/admin') {
    const hasCookies = fs.existsSync(COOKIE_FILE);
    const cookieAge = hasCookies ? Math.floor((Date.now() - fs.statSync(COOKIE_FILE).mtimeMs) / 86400000) : 0;
    const dlCount = fs.existsSync(DOWNLOAD_DIR) ? fs.readdirSync(DOWNLOAD_DIR).length : 0;
    const uptimeH = Math.floor(process.uptime() / 3600);
    const uptimeM = Math.floor((process.uptime() % 3600) / 60);
    const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const cookieClass = hasCookies ? 'green' : 'orange';
    const cookieText = hasCookies ? '✅ Loaded (' + cookieAge + 'd old)' : '⚠️ Not set';
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admin</title>' +
'<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#0f0f0f;color:#fff;padding:40px;max-width:500px;margin:0 auto}' +
'h1{color:#ff4444;margin-bottom:20px}.card{background:#1a1a1a;border-radius:12px;padding:20px;margin:12px 0}' +
'.stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #222}.stat:last-child{border:none}' +
'.green{color:#4CAF50}.orange{color:#ff9800}.btn{background:#ff4444;color:#fff;border:none;padding:12px;border-radius:8px;width:100%;cursor:pointer;font-size:14px;font-weight:600;margin-top:8px}' +
'.btn:hover{background:#ff6666}label.upload{display:inline-block;padding:10px 20px;background:#333;border-radius:8px;cursor:pointer;margin-top:8px}label.upload:hover{background:#444}input[type=file]{display:none}</style></head>' +
'<body><h1>🔧 Admin Panel</h1>' +
'<div class="card"><h3 style="margin-bottom:12px">Server Status</h3>' +
'<div class="stat"><span>🍪 Cookies</span><span class="' + cookieClass + '">' + cookieText + '</span></div>' +
'<div class="stat"><span>📦 Downloads</span><span>' + dlCount + ' files</span></div>' +
'<div class="stat"><span>⏱️ Uptime</span><span>' + uptimeH + 'h ' + uptimeM + 'm</span></div>' +
'<div class="stat"><span>💾 Memory</span><span>' + memMB + 'MB</span></div></div>' +
'<div class="card"><h3 style="margin-bottom:12px">🍪 Cookie Management</h3>' +
'<p style="font-size:13px;color:#888;margin-bottom:12px">Upload browser cookies for YouTube/Facebook/Instagram authentication. All users share these cookies.</p>' +
'<form id="cf" enctype="multipart/form-data"><label class="upload">📁 Upload cookies.txt<input type="file" name="cookies" accept=".txt" onchange="uc(this)"></label></form>' +
'<button class="btn" style="background:#333;margin-top:8px" onclick="fetch(\'/cookies\',{method:\'DELETE\'}).then(()=>location.reload())">🗑 Delete Cookies</button></div>' +
'<div class="card"><h3 style="margin-bottom:12px">🧹 Cleanup</h3>' +
'<button class="btn" onclick="fetch(\'/files/clear\',{method:\'POST\'}).then(()=>alert(\'Cleared!\')).then(()=>location.reload())">🗑 Clear All Downloads</button></div>' +
'<a href="/" style="display:block;text-align:center;color:#ff4444;margin-top:20px">← Back to Downloader</a>' +
'<script>async function uc(i){var f=new FormData();f.append("cookies",i.files[0]);var r=await fetch("/cookies",{method:"POST",body:f});var d=await r.json();alert(d.message);location.reload()}</script>' +
'</body></html>');
  }

  // Health check for monitoring
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, downloads: fs.readdirSync(DOWNLOAD_DIR).length }));
  }
  
  if (req.method === 'DELETE' && url.pathname === '/cookies') {
    try { fs.unlinkSync(COOKIE_FILE); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'POST' && url.pathname === '/cookies') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = Buffer.concat(chunks);
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) { res.writeHead(400); return res.end('No boundary'); }
    const parts = parseMultipart(body, boundary);
    if (parts.cookies) {
      fs.writeFileSync(COOKIE_FILE, parts.cookies.data);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ message: 'Cookies uploaded! ✅' }));
    }
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'No file received' }));
  }
  
  // Fetch video info (title, duration, thumbnail)
  if (req.method === 'POST' && url.pathname === '/info') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const { url: videoUrl } = JSON.parse(Buffer.concat(chunks).toString());
    const args = ['--dump-json', '--no-playlist', '--socket-timeout', '15'];
    if (fs.existsSync(COOKIE_FILE)) args.push('--cookies', COOKIE_FILE);
    args.push(videoUrl);
    const proc = spawn('yt-dlp', args);
    let out = '', err = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });
    proc.on('close', code => {
      if (code !== 0 || !out) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: err || 'Failed to fetch info' }));
      }
      try {
        const info = JSON.parse(out);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          title: info.title || '',
          duration: info.duration || 0,
          uploader: info.uploader || info.channel || '',
          thumbnail: info.thumbnail || '',
          extractor: info.extractor || '',
        }));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to parse info' }));
      }
    });
    return;
  }

  // Upload video → extract MP3
  if (req.method === 'POST' && url.pathname === '/upload-extract') {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing multipart boundary' }));
    }
    const maxSize = 500 * 1024 * 1024; // 500MB
    let size = 0;
    const chunks = [];
    let aborted = false;
    for await (const c of req) {
      size += c.length;
      if (size > maxSize) { aborted = true; break; }
      chunks.push(c);
    }
    if (aborted) {
      res.writeHead(413, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'File too large (max 500MB)' }));
    }
    const buf = Buffer.concat(chunks);
    const parts = parseMultipart(buf, boundaryMatch[1]);
    if (!parts.video || !parts.video.filename) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'No video file uploaded' }));
    }
    
    const trimStart = parts.trimStart ? parts.trimStart.data.toString().trim() : '0:00';
    const trimEnd = parts.trimEnd ? parts.trimEnd.data.toString().trim() : '';
    const uploadMode = parts.mode ? parts.mode.data.toString().trim() : 'extract-mp3';
    
    // Save uploaded video to temp
    const origName = parts.video.filename.replace(/[/\\<>:"|?*#]/g, '').slice(0, 80);
    const baseName = path.parse(origName).name;
    const tempId = crypto.randomBytes(4).toString('hex');
    const tempVideoPath = path.join(DOWNLOAD_DIR, `_upload_${tempId}${path.extname(origName) || '.mp4'}`);
    const isRemoveAudio = uploadMode === 'remove-audio';
    const outputFile = isRemoveAudio
      ? path.join(DOWNLOAD_DIR, `${baseName}-silent.mp4`)
      : path.join(DOWNLOAD_DIR, `${baseName}.mp3`);
    
    fs.writeFileSync(tempVideoPath, parts.video.data);
    
    const jobId = crypto.randomBytes(4).toString('hex');
    const actionLabel = isRemoveAudio ? 'Removing audio' : 'Extracting MP3';
    const job = { log: `Uploaded: ${origName} (${(parts.video.data.length / 1024 / 1024).toFixed(1)} MB)\n${actionLabel}...\n`, done: false, error: null, filename: null, mode: 'direct' };
    jobs.set(jobId, job);
    
    // Build ffmpeg args
    let ffArgs;
    if (isRemoveAudio) {
      ffArgs = ['-i', tempVideoPath, '-an', '-c:v', 'copy'];
    } else {
      ffArgs = ['-i', tempVideoPath, '-vn', '-acodec', 'libmp3lame', '-q:a', '0'];
    }
    // Parse trim
    if (trimStart && trimStart !== '0:00' && trimStart !== '0') {
      const startParts = trimStart.split(':').map(Number);
      const startSec = startParts.length === 2 ? startParts[0] * 60 + startParts[1] : startParts[0] || 0;
      if (startSec > 0) ffArgs.push('-ss', String(startSec));
    }
    if (trimEnd) {
      const endParts = trimEnd.split(':').map(Number);
      const endSec = endParts.length === 2 ? endParts[0] * 60 + endParts[1] : endParts[0] || 0;
      if (endSec > 0) {
        const startParts2 = trimStart.split(':').map(Number);
        const startSec2 = startParts2.length === 2 ? startParts2[0] * 60 + startParts2[1] : startParts2[0] || 0;
        const duration = endSec - startSec2;
        if (duration > 0) ffArgs.push('-t', String(duration));
      }
    }
    ffArgs.push('-y', outputFile);
    
    const proc = spawn('ffmpeg', ffArgs);
    proc.stdout.on('data', d => { job.log += d.toString(); });
    proc.stderr.on('data', d => { job.log += d.toString(); });
    proc.on('close', code => {
      // Clean up temp video
      try { fs.unlinkSync(tempVideoPath); } catch {}
      job.done = true;
      if (code !== 0) {
        job.error = 'ffmpeg exited with code ' + code;
      } else {
        job.filename = isRemoveAudio ? `${baseName}-silent.mp4` : `${baseName}.mp3`;
      }
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ jobId }));
  }

  if (req.method === 'POST' && url.pathname === '/download') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const { url: videoUrl, quality, mode, filename: customName, audioFormat, trim } = JSON.parse(Buffer.concat(chunks).toString());
    const jobId = crypto.randomBytes(4).toString('hex');
    const safeName = customName ? customName.replace(/[/\\<>:"|?*#]/g, '').slice(0, 80) : null;
    const outputPath = safeName
      ? path.join(DOWNLOAD_DIR, safeName + '.%(ext)s')
      : path.join(DOWNLOAD_DIR, '%(title).80s.%(ext)s');
    const args = buildArgs(videoUrl, quality, outputPath, audioFormat, trim);
    
    const job = { log: '', done: false, error: null, filename: null, mode: mode || 'save' };
    jobs.set(jobId, job);
    
    const proc = spawn('yt-dlp', args);
    proc.stdout.on('data', d => { job.log += d.toString(); });
    proc.stderr.on('data', d => { job.log += d.toString(); });
    proc.on('close', code => {
      job.done = true;
      if (code !== 0) {
        job.error = 'yt-dlp exited with code ' + code;
      } else {
        // Find the most recently created file
        const files = fs.readdirSync(DOWNLOAD_DIR).map(name => ({
          name, mtime: fs.statSync(path.join(DOWNLOAD_DIR, name)).mtimeMs
        })).sort((a, b) => b.mtime - a.mtime);
        if (files.length > 0) job.filename = files[0].name;
      }
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ jobId }));
  }
  
  if (req.method === 'GET' && url.pathname.startsWith('/status/')) {
    const jobId = url.pathname.split('/')[2];
    const job = jobs.get(jobId) || { log: 'Unknown job', done: true, error: 'Not found' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(job));
  }
  
  if (req.method === 'GET' && url.pathname === '/files') {
    const now = Date.now();
    const files = fs.existsSync(DOWNLOAD_DIR) ? fs.readdirSync(DOWNLOAD_DIR).map(name => {
      const stat = fs.statSync(path.join(DOWNLOAD_DIR, name));
      const mb = (stat.size / 1024 / 1024).toFixed(1);
      const ageMin = Math.floor((now - stat.mtimeMs) / 60000);
      const age = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ${ageMin % 60}m ago`;
      const ttl = Math.max(0, Math.ceil((TEMP_MAX_AGE_MS - (now - stat.mtimeMs)) / 60000));
      return { name, size: mb + ' MB', mtime: stat.mtime, age, ttl: `${ttl}m left` };
    }).sort((a, b) => new Date(b.mtime) - new Date(a.mtime)) : [];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(files));
  }

  // Clear all files
  if (req.method === 'POST' && url.pathname === '/files/clear') {
    if (fs.existsSync(DOWNLOAD_DIR)) {
      for (const name of fs.readdirSync(DOWNLOAD_DIR)) {
        try { fs.unlinkSync(path.join(DOWNLOAD_DIR, name)); } catch {}
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  
  if (req.url.startsWith('/file/')) {
    const rawPath = req.url.split('?')[0];
    const name = decodeURIComponent(rawPath.slice(6));
    const fp = path.join(DOWNLOAD_DIR, path.basename(name));
    if (!fs.existsSync(fp)) { res.writeHead(404); return res.end('Not found'); }
    
    if (req.method === 'DELETE') {
      fs.unlinkSync(fp);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }
    
    const stat = fs.statSync(fp);
    const ext = path.extname(fp).toLowerCase();
    const mime = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.opus': 'audio/opus', '.ogg': 'audio/ogg' }[ext] || 'application/octet-stream';
    const safeName = path.basename(name);
    const encodedName = encodeURIComponent(safeName);
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    });
    const stream = fs.createReadStream(fp);
    stream.pipe(res);
    
    // Auto-delete after download in direct mode
    const autodelete = url.searchParams.get('autodelete');
    if (autodelete === '1') {
      stream.on('end', () => {
        setTimeout(() => {
          try { fs.unlinkSync(fp); console.log(`🗑 Auto-deleted: ${safeName}`); } catch {}
        }, 5000); // 5s delay to ensure download completes
      });
    }
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

process.on('uncaughtException', (err) => { console.error('Uncaught:', err.message); });
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err); });

server.listen(PORT, () => console.log(`Video Downloader running at http://0.0.0.0:${PORT}`));
