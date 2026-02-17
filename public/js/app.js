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
  status.textContent = 'Starting...\n';

  const res = await fetch('/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url, quality, mode,
      filename: document.getElementById('filename').value.trim() || null,
      audioFormat: document.querySelector('#quality option:checked').dataset.audio || null,
      trim: document.querySelector('#quality option:checked').dataset.trim ? {
        start: document.getElementById('trimStart').value,
        end: document.getElementById('trimEnd').value || null,
        duration: parseInt(document.getElementById('trimDuration').value) || 15,
        fitTo15: document.getElementById('fitTo15').checked,
        mode: document.querySelector('#quality option:checked').dataset.trim
      } : null
    })
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
        status.textContent += '\n❌ ' + d.error;
      } else if (d.filename) {
        status.textContent += '\n✅ Done!';
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
          status.textContent += '\n📥 Downloading MP3...';
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
    return '<div class="dl-item"><div><a href="/file/' + enc + '">' + safe + '</a><span class="tag">' + f.size + '</span><span class="timer">' + f.age + '</span></div><button class="btn-sm" onclick="del(\'' + enc + '\')" style="margin:0">🗑</button></div>';
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
setInterval(loadDownloads, 30000);
