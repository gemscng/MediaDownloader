/* ============================================
   MediaDownloader — App Logic (Redesigned)
   ============================================ */

let mode = 'direct';

// --- Platform Detection ---
const PLATFORMS = {
  youtube: { pattern: /youtu\.?be/, color: '#FF0000', svg: '<svg viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>' },
  instagram: { pattern: /instagram\.com|instagr\.am/, color: '#E4405F', svg: '<svg viewBox="0 0 24 24" fill="#E4405F"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>' },
  tiktok: { pattern: /tiktok\.com/, color: '#fff', svg: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.76 1.52V6.69h-1z"/></svg>' },
  facebook: { pattern: /facebook\.com|fb\.watch/, color: '#1877F2', svg: '<svg viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' },
  twitter: { pattern: /twitter\.com|x\.com/, color: '#fff', svg: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>' },
  threads: { pattern: /threads\.net/, color: '#fff', svg: '<svg viewBox="0 0 24 24" fill="#fff"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.773.767c-1.028-3.702-3.594-5.56-7.562-5.56-2.614.018-4.633.885-5.996 2.577-1.323 1.643-2.01 4.013-2.04 7.04.033 3.036.72 5.407 2.04 7.046 1.364 1.694 3.382 2.558 5.996 2.577.656-.004 2.55-.098 4.314-1.182 1.263-.775 2.27-1.994 2.991-3.622l2.639 1.098c-.87 1.96-2.15 3.51-3.81 4.61-2.16 1.44-4.67 1.59-6.12 1.584z"/></svg>' }
};

function detectPlatform(url) {
  for (const [name, p] of Object.entries(PLATFORMS)) {
    if (p.pattern.test(url)) return { name, ...p };
  }
  return null;
}

function updatePlatformIcon(url) {
  const icon = document.getElementById('platformIcon');
  const input = document.getElementById('url');
  const platform = detectPlatform(url);
  // Remove all platform classes
  input.className = input.className.replace(/platform-\w+/g, '').trim();
  if (platform) {
    icon.innerHTML = platform.svg;
    icon.classList.add('visible');
    input.classList.add('has-platform');
    input.classList.add('platform-' + platform.name);
    document.documentElement.style.setProperty('--platform-accent', platform.color);
  } else {
    icon.classList.remove('visible');
    input.classList.remove('has-platform');
    document.documentElement.style.removeProperty('--platform-accent');
  }
}

// --- Thumbnail Download ---
let currentThumbnailUrl = '';
function downloadThumbnail() {
  if (!currentThumbnailUrl) return;
  const a = document.createElement('a');
  a.href = '/api/thumbnail?url=' + encodeURIComponent(currentThumbnailUrl);
  a.download = 'thumbnail.jpg';
  a.click();
}

// --- Paste from Clipboard ---
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    const input = document.getElementById('url');
    input.value = text;
    onUrlInput(text);
    input.focus();
  } catch(e) {
    // Clipboard API not available
  }
}

// --- Mode Toggle ---
function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => {
    const isActive = b.dataset.mode === m;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-checked', isActive);
  });
}

// --- Quality Pills ---
let currentQuality = { value: 'best[height<=1080]', audio: null, trim: null };

document.querySelectorAll('.quality-pill').forEach(pill => {
  pill.addEventListener('click', function() {
    document.querySelectorAll('.quality-pill').forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-checked', 'false');
    });
    this.classList.add('active');
    this.setAttribute('aria-checked', 'true');

    currentQuality = {
      value: this.dataset.value,
      audio: this.dataset.audio || null,
      trim: this.dataset.trim || null
    };

    // Sync hidden select
    const sel = document.getElementById('quality');
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === this.dataset.value &&
          (sel.options[i].dataset.audio || null) === (this.dataset.audio || null) &&
          (sel.options[i].dataset.trim || null) === (this.dataset.trim || null)) {
        sel.selectedIndex = i;
        break;
      }
    }

    // Show/hide trim panel
    updateTrimPanel();
  });
});

function updateTrimPanel() {
  const panel = document.getElementById('trimPanel');
  const trimEnd = document.getElementById('trimEnd');
  const trimEndLabel = document.getElementById('trimEndLabel');
  const trimDurLabel = document.getElementById('trimDurLabel');
  const trimDuration = document.getElementById('trimDuration');
  const trimDurUnit = document.getElementById('trimDurUnit');
  const fitPanel = document.getElementById('fitPanel');

  const trim = currentQuality.trim;
  if (trim) {
    panel.classList.add('visible');
  } else {
    panel.classList.remove('visible');
    return;
  }

  if (trim === 'free') {
    trimEnd.style.display = '';
    trimEndLabel.style.display = '';
    trimDurLabel.style.display = 'none';
    trimDuration.style.display = 'none';
    trimDurUnit.style.display = 'none';
    fitPanel.style.display = 'none';
  } else {
    trimEnd.style.display = 'none';
    trimEndLabel.style.display = 'none';
    trimDurLabel.style.display = '';
    trimDuration.style.display = '';
    trimDurUnit.style.display = '';
    fitPanel.style.display = 'flex';
    trimDuration.value = trim;
  }
}

// --- Speed Label ---
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

// --- URL Input & Info Fetch ---
let infoTimeout = null;
let lastInfoUrl = '';

function onUrlInput(val) {
  val = val.trim();
  updatePlatformIcon(val);
  if (!val || val === lastInfoUrl) return;
  clearTimeout(infoTimeout);
  if (!val.match(/^https?:\/\//)) return;
  infoTimeout = setTimeout(() => fetchInfo(val), 800);
}

async function fetchInfo(videoUrl) {
  if (videoUrl === lastInfoUrl) return;
  lastInfoUrl = videoUrl;
  const info = document.getElementById('videoInfo');
  const meta = document.getElementById('videoMeta');
  const fname = document.getElementById('filename');
  const thumb = document.getElementById('videoThumb');
  const thumbImg = document.getElementById('videoThumbImg');

  info.classList.add('visible');
  fname.value = '';
  meta.innerHTML = '<span class="video-meta-tag">⏳ Fetching info...</span>';
  thumb.classList.add('skeleton');
  thumbImg.style.display = 'none';

  try {
    const res = await fetch('/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl })
    });
    const data = await res.json();
    if (data.error) {
      meta.innerHTML = '<span class="video-meta-tag">⚠️ ' + data.error + '</span>';
      thumb.classList.remove('skeleton');
      return;
    }
    fname.value = data.title || '';

    // Thumbnail
    if (data.thumbnail) {
      thumbImg.src = data.thumbnail;
      thumbImg.alt = data.title || 'Video thumbnail';
      thumbImg.style.display = 'block';
      currentThumbnailUrl = data.thumbnail;
      document.getElementById('thumbDlBtn').style.display = 'inline-block';
    } else {
      document.getElementById('thumbDlBtn').style.display = 'none';
      currentThumbnailUrl = '';
    }
    thumb.classList.remove('skeleton');

    // Meta tags
    const tags = [];
    if (data.uploader) tags.push('<span class="video-meta-tag">👤 ' + data.uploader + '</span>');
    if (data.duration) {
      const dur = Math.floor(data.duration/60) + ':' + String(Math.floor(data.duration%60)).padStart(2,'0');
      tags.push('<span class="video-meta-tag">⏱ ' + dur + '</span>');
    }
    const platform = detectPlatform(videoUrl);
    if (platform) tags.push('<span class="video-meta-tag">' + platform.name + '</span>');
    else if (data.extractor) tags.push('<span class="video-meta-tag">' + data.extractor + '</span>');
    meta.innerHTML = tags.join('');

    // Pulse download button
    document.getElementById('downloadBtn').classList.add('ready');
  } catch(e) {
    meta.innerHTML = '<span class="video-meta-tag">⚠️ Could not fetch info</span>';
    thumb.classList.remove('skeleton');
  }
}

// --- Download ---
async function startDownload() {
  const url = document.getElementById('url').value.trim();
  if (!url) return;

  const btn = document.getElementById('downloadBtn');
  const btnText = document.getElementById('downloadBtnText');
  const progressBar = document.getElementById('progressBar');
  const status = document.getElementById('status');

  btn.disabled = true;
  btn.classList.remove('ready');
  status.style.display = 'block';
  status.textContent = 'Starting...\n';
  progressBar.style.width = '0%';

  const quality = currentQuality.value;
  const audioFormat = currentQuality.audio;
  const trimMode = currentQuality.trim;

  const res = await fetch('/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url, quality, mode,
      filename: document.getElementById('filename').value.trim() || null,
      audioFormat: audioFormat || null,
      trim: trimMode ? {
        start: document.getElementById('trimStart').value,
        end: document.getElementById('trimEnd').value || null,
        duration: parseInt(document.getElementById('trimDuration').value) || 15,
        fitTo15: document.getElementById('fitTo15').checked,
        mode: trimMode
      } : null
    })
  });
  const { jobId } = await res.json();

  let progress = 0;
  const poll = setInterval(async () => {
    const r = await fetch('/status/' + jobId);
    const d = await r.json();
    status.textContent = d.log || 'Working...';
    status.scrollTop = status.scrollHeight;

    // Extract progress percentage from log
    const match = (d.log || '').match(/(\d+(?:\.\d+)?)%/);
    if (match) {
      progress = parseFloat(match[1]);
      progressBar.style.width = Math.min(progress, 100) + '%';
      btnText.textContent = '⬇️ ' + Math.round(progress) + '%';
    }

    if (d.done) {
      clearInterval(poll);
      btn.disabled = false;
      progressBar.style.width = '100%';
      btnText.textContent = '⬇️ Download';
      if (typeof i18n !== 'undefined') {
        const t = i18n.t('btn_download');
        if (t !== 'btn_download') btnText.textContent = t;
      }

      if (d.error) {
        status.textContent += '\n❌ ' + d.error;
        progressBar.style.width = '0%';
      } else if (d.filename) {
        status.textContent += '\n✅ Done!';
        btn.classList.add('complete');
        setTimeout(() => btn.classList.remove('complete'), 2000);
        if (mode === 'direct') {
          const enc = encodeURIComponent(d.filename).replace(/#/g, '%23');
          const a = document.createElement('a');
          a.href = '/file/' + enc + '?autodelete=1';
          a.download = d.filename;
          a.click();
          status.textContent += '\n📥 Downloading to your device...';
        }
        loadDownloads();
      } else {
        status.textContent += '\n✅ Done!';
        loadDownloads();
      }
      setTimeout(() => { progressBar.style.width = '0%'; }, 2000);
    }
  }, 1000);
}

// --- Video Tools ---
function toggleTools() {
  const toggle = document.getElementById('toolsToggle');
  const content = document.getElementById('toolsContent');
  const isOpen = content.classList.toggle('open');
  toggle.classList.toggle('open', isOpen);
  toggle.setAttribute('aria-expanded', isOpen);
}

function switchTab(tab, btn) {
  document.querySelectorAll('.toolbox-tab').forEach(t => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
  document.querySelectorAll('.toolbox-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById(tab === 'download' ? 'tabDownload' : 'tabTools');
  if (panel) panel.style.display = 'block';
}

function setUploadMode(val, el) {
  document.querySelectorAll('.upload-mode-pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('uploadMode').value = val;
  const btn = document.getElementById('uploadBtn');
  btn.textContent = val === 'extract-mp3' ? '🎵 Extract MP3' : '🔇 Remove Audio';
}

// Drag & drop
const uploadArea = document.getElementById('uploadArea');
if (uploadArea) {
  ['dragenter', 'dragover'].forEach(e => uploadArea.addEventListener(e, ev => { ev.preventDefault(); uploadArea.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach(e => uploadArea.addEventListener(e, ev => { ev.preventDefault(); uploadArea.classList.remove('drag-over'); }));
  uploadArea.addEventListener('drop', ev => {
    const files = ev.dataTransfer.files;
    if (files.length) {
      document.getElementById('uploadFile').files = files;
      showUploadName(document.getElementById('uploadFile'));
    }
  });
  uploadArea.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); document.getElementById('uploadFile').click(); } });
}

function showUploadName(input) {
  const el = document.getElementById('uploadName');
  el.textContent = input.files[0] ? input.files[0].name + ' (' + (input.files[0].size / 1024 / 1024).toFixed(1) + ' MB)' : '';
}

function toggleUploadTrim() {
  const mode = document.getElementById('uploadMode').value;
  const btn = document.getElementById('uploadBtn');
  btn.textContent = mode === 'extract-mp3' ? '🎵 Extract MP3' : '🔇 Remove Audio';
}

async function uploadExtract() {
  const fileInput = document.getElementById('uploadFile');
  if (!fileInput.files[0]) return alert('Please choose a video file first');
  const file = fileInput.files[0];
  if (file.size > 500 * 1024 * 1024) return alert('File too large (max 500MB)');

  const btn = document.getElementById('uploadBtn');
  const status = document.getElementById('uploadStatus');
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = 'Uploading ' + file.name + '...\n';

  const form = new FormData();
  form.append('video', file);
  form.append('trimStart', document.getElementById('upTrimStart').value || '0:00');
  form.append('trimEnd', document.getElementById('upTrimEnd').value || '');
  form.append('mode', document.getElementById('uploadMode').value || 'extract-mp3');

  try {
    const res = await fetch('/upload-extract', { method: 'POST', body: form });
    const { jobId, error } = await res.json();
    if (error) { status.textContent = '❌ ' + error; btn.disabled = false; return; }
    status.textContent = 'Processing...\n';

    const poll = setInterval(async () => {
      const r = await fetch('/status/' + jobId);
      const d = await r.json();
      status.textContent = d.log || 'Working...';
      status.scrollTop = status.scrollHeight;
      if (d.done) {
        clearInterval(poll);
        btn.disabled = false;
        if (d.error) {
          status.textContent += '\n❌ ' + d.error;
        } else if (d.filename) {
          status.textContent += '\n✅ Done!';
          const enc = encodeURIComponent(d.filename).replace(/#/g, '%23');
          const a = document.createElement('a');
          a.href = '/file/' + enc + '?autodelete=1';
          a.download = d.filename;
          a.click();
          status.textContent += '\n📥 Downloading...';
          loadDownloads();
        }
      }
    }, 1000);
  } catch(e) {
    status.textContent = '❌ Upload failed: ' + e.message;
    btn.disabled = false;
  }
}

// --- FAQ Accordion ---
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.toggle('open');
  btn.setAttribute('aria-expanded', isOpen);
}

// --- Downloads ---
async function loadDownloads() {
  const res = await fetch('/files');
  const files = await res.json();
  const el = document.getElementById('downloads');
  if (!files.length) { el.innerHTML = '<div style="color:var(--text-dim);font-size:13px;text-align:center;padding:12px">No files yet</div>'; return; }
  el.innerHTML = files.map(f => {
    const enc = encodeURIComponent(f.name).replace(/#/g, '%23');
    const safe = f.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<div class="dl-item"><div><a href="/file/' + enc + '">' + safe + '</a><span class="tag">' + f.size + '</span><span class="timer">' + f.age + '</span></div><button class="btn-sm" onclick="del(\'' + enc + '\')" aria-label="Delete file">🗑</button></div>';
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

// --- Init ---
loadDownloads();
setInterval(loadDownloads, 30000);
