/* =========================================================
   H🌸PE PDF — Core script
   Modules:
   1.  Petals canvas (with wind direction + gust system)
   2.  Theme toggle (dark/light)
   3.  Reveal-on-scroll
   4.  Smooth scroll & mouse-glow buttons
   5.  Toasts
   6.  Wind ambient sound (WebAudio noise)
   7.  Workspace modal (open/close, dropzone, file list,
       drag-reorder, multi-select, undo/redo, recents,
       file thumbnails for PDFs/images)
   8.  Strict file validation
   9.  Tool grid renderer + filter pills + nav jump
   10. Footer year + privacy/terms info modals
   11. Mega menu mobile toggle
   12. Butterfly system + lifecycle + rarity + click-quote
   13. Consent modal (first-visit gate)
   14. Chatbot assistant (rule-based)
   ========================================================= */

(() => {
  'use strict';

  /* small helpers */
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const escapeHtml = s => String(s).replace(/[&<>"']/g, m => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]
  ));
  const rand = (a,b) => a + Math.random() * (b - a);

  /* ────────────────────────────────────────────────
     Wind state — shared by petals & sound
     ──────────────────────────────────────────────── */
  const Wind = {
    enabled: false,    // true when sound is on
    angle: 0,          // radians, current wind direction
    targetAngle: 0,    // gust target
    strength: 0,       // current strength
    targetStrength: 0, // gust target
    nextGustAt: 0,
    update(now) {
      if (this.enabled) {
        if (now > this.nextGustAt) {
          this.targetAngle = rand(-Math.PI*0.6, Math.PI*0.6); // mostly horizontal
          this.targetStrength = rand(0.6, 1.6);
          this.nextGustAt = now + rand(2500, 6000);
        }
      } else {
        this.targetAngle = 0;
        this.targetStrength = 0;
      }
      // ease toward target
      this.angle    += (this.targetAngle    - this.angle)    * 0.02;
      this.strength += (this.targetStrength - this.strength) * 0.015;
    }
  };

  /* ────────────────────────────────────────────────
     1. Petals canvas
     ──────────────────────────────────────────────── */
  const canvas = $('#petal-canvas');
  const ctx = canvas.getContext('2d');
  let W=0, H=0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  let petals = [];
  let petalImg = null;

  function makePetal() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(26, 26, 4, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.4, 'rgba(255,200,212,0.9)');
    g.addColorStop(1, 'rgba(231,111,138,0.85)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(32, 6);
    x.bezierCurveTo(60, 16, 60, 45, 32, 60);
    x.bezierCurveTo(4, 45, 4, 16, 32, 6);
    x.fill();
    return c;
  }
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W*dpr; canvas.height = H*dpr;
    canvas.style.width = W+'px'; canvas.style.height = H+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function spawnPetal(initial=false) {
    return {
      x: Math.random() * W,
      y: initial ? Math.random()*H : -40 - Math.random()*120,
      size: 12 + Math.random()*16,
      rot: Math.random()*Math.PI*2,
      rotSpeed: (Math.random()-0.5) * 0.02,
      vyBase: 0.35 + Math.random()*0.7,
      sway: Math.random()*Math.PI*2,
      swaySpeed: 0.005 + Math.random()*0.015,
      swayAmp: 0.5 + Math.random()*1.2,
      opacity: 0.55 + Math.random()*0.4,
    };
  }
  function initPetals() {
    const count = window.innerWidth < 720 ? 18 : 34;
    petals = Array.from({length: count}, () => spawnPetal(true));
  }
  let petalsPaused = false;
  function tick(now) {
    if (petalsPaused) return;
    Wind.update(now);
    ctx.clearRect(0,0,W,H);
    const wxBase = Math.cos(Wind.angle) * Wind.strength * 1.4;
    const wyBase = Math.sin(Wind.angle) * Wind.strength * 0.6;
    for (const p of petals) {
      p.sway += p.swaySpeed;
      p.x += Math.sin(p.sway) * p.swayAmp + wxBase;
      p.y += p.vyBase + Math.max(0, wyBase);
      p.rot += p.rotSpeed + Wind.strength * 0.005;
      if (p.y - p.size > H || p.x < -p.size - 60 || p.x > W + p.size + 60) {
        Object.assign(p, spawnPetal());
        if (Wind.enabled && Math.random() < 0.5) p.x = Math.random() < 0.5 ? -20 : W + 20;
      }
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(petalImg, -p.size/2, -p.size/2, p.size, p.size);
      ctx.restore();
    }
    requestAnimationFrame(tick);
  }
  petalImg = makePetal();
  resize(); initPetals(); requestAnimationFrame(tick);
  // Debounce resize — avoid thrashing on mobile orientation flicks
  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { resize(); initPetals(); }, 120);
  });
  // Pause petal canvas when tab hidden — saves CPU, cinematic restart on return
  document.addEventListener('visibilitychange', () => {
    petalsPaused = document.hidden;
    if (!petalsPaused) requestAnimationFrame(tick);
  });

  /* ────────────────────────────────────────────────
     2. Theme toggle
     ──────────────────────────────────────────────── */
  const body = document.body;
  const themeBtn = $('#theme-toggle');
  const savedTheme = localStorage.getItem('hope-theme');
  if (savedTheme === 'light') body.dataset.theme = 'light';
  function applyTheme(next, persist = true) {
    body.dataset.theme = next;
    if (persist) localStorage.setItem('hope-theme', next);
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  }
  themeBtn.addEventListener('click', () => {
    applyTheme(body.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  // Big celestial toggle (moon/sun in the sky) — premium pulse + cross-fade
  const celestialBtn = $('#celestial-toggle');
  function syncCelestialTooltip() {
    if (!celestialBtn) return;
    const isDark = body.dataset.theme !== 'light';
    const t = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    celestialBtn.title = t;
    celestialBtn.setAttribute('aria-label', t);
  }
  syncCelestialTooltip();
  document.addEventListener('themechange', syncCelestialTooltip);
  if (celestialBtn) {
    let isPulsing = false;
    celestialBtn.addEventListener('click', () => {
      if (isPulsing) return;
      isPulsing = true;
      // 1) intensify glow briefly
      celestialBtn.classList.add('is-pulsing');
      // 2) swap theme mid-pulse so moon fades out + sun fades in (CSS does the rest)
      setTimeout(() => {
        applyTheme(body.dataset.theme === 'dark' ? 'light' : 'dark');
      }, 220);
      // 3) clear pulse class after the full ~550ms transition
      setTimeout(() => {
        celestialBtn.classList.remove('is-pulsing');
        isPulsing = false;
      }, 600);
    });
  }

  /* ────────────────────────────────────────────────
     3. Reveal-on-scroll
     ──────────────────────────────────────────────── */
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  const observeReveals = () => $$('.reveal').forEach(el => io.observe(el));
  observeReveals();

  /* ────────────────────────────────────────────────
     4. Smooth scroll
     ──────────────────────────────────────────────── */
  $$('[data-link]').forEach(a => a.addEventListener('click', e => {
    const href = a.getAttribute('href') || '';
    if (href.startsWith('#')) {
      e.preventDefault();
      const t = $(href);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }));

  /* Button ripple — single delegated listener for every .btn (current + future). */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn || btn.hasAttribute('disabled')) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  });

  /* Footer year */
  $('#footYear').textContent = new Date().getFullYear();

  /* ────────────────────────────────────────────────
     5. Toasts
     ──────────────────────────────────────────────── */
  const toastsEl = $('#toasts');
  function toast(type, title, message, opts = {}) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✓', error: '!', info: '✿' };
    el.innerHTML = `
      <div class="t-icon">${icons[type] || '✿'}</div>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <div class="t-msg">${escapeHtml(message)}</div>
      </div>`;
    toastsEl.appendChild(el);
    const ttl = opts.ttl || 4200;
    setTimeout(() => {
      el.classList.add('is-out');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, ttl);
  }
  window.HopeToast = toast;

  /* ────────────────────────────────────────────────
     6. Wind ambient sound (filtered noise)
     ──────────────────────────────────────────────── */
  const soundBtn = $('#sound-toggle');
  let audioCtx = null, noiseSrc = null, gainNode = null, filterNode = null, soundOn = false;

  function startWind() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    // pink-ish noise
    let b0=0,b1=0,b2=0;
    for (let i=0;i<bufferSize;i++) {
      const white = Math.random()*2-1;
      b0 = 0.99765*b0 + white*0.0990460;
      b1 = 0.96300*b1 + white*0.2965164;
      b2 = 0.57000*b2 + white*1.0526913;
      data[i] = (b0+b1+b2 + white*0.1848)*0.05;
    }
    noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = buffer;
    noiseSrc.loop = true;

    filterNode = audioCtx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 800;

    gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.0;

    noiseSrc.connect(filterNode).connect(gainNode).connect(audioCtx.destination);
    noiseSrc.start();

    // ramp up
    const t = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.linearRampToValueAtTime(0.06, t + 1.2);

    // gentle volume modulation
    function modLoop() {
      if (!soundOn) return;
      const t = audioCtx.currentTime;
      const v = 0.04 + Math.random()*0.06;
      gainNode.gain.linearRampToValueAtTime(v, t + 1.5 + Math.random()*1.5);
      filterNode.frequency.linearRampToValueAtTime(500 + Math.random()*900, t + 1.5);
      setTimeout(modLoop, 1500 + Math.random()*1500);
    }
    modLoop();
  }
  function stopWind() {
    if (!gainNode || !audioCtx) return;
    const t = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(t);
    gainNode.gain.linearRampToValueAtTime(0.0, t + 0.6);
    setTimeout(() => { try { noiseSrc.stop(); } catch{} noiseSrc = null; }, 800);
  }
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    Wind.enabled = soundOn;
    soundBtn.classList.toggle('muted', !soundOn);
    if (soundOn) { startWind(); toast('info','Wind on','A gentle breeze fills the space.'); }
    else { stopWind(); toast('info','Wind off','Petals rest in stillness.'); }
  });

  /* ────────────────────────────────────────────────
     7. Workspace modal
     ──────────────────────────────────────────────── */
  const ws         = $('#workspace');
  const wsTitle    = $('#ws-title');
  const wsSub      = $('#ws-sub');
  const wsMeta     = $('#ws-meta');
  const dropzone   = $('#dropzone');
  const dzTitle    = $('#dz-title');
  const dzSub      = $('#dz-sub');
  const fileInput  = $('#file-input');
  const fileList   = $('#file-list');
  const optionsEl  = $('#options');
  const runBtn     = $('#run-btn');
  const clearBtn   = $('#clear-btn');
  const undoBtn    = $('#undo-btn');
  const redoBtn    = $('#redo-btn');
  const recentList = $('#recent-list');

  const tools = {};
  let currentTool = null;
  let currentFiles = [];
  let history = [], historyIndex = -1;
  let thumbCache = new WeakMap();

  // Strict format profiles
  const FORMATS = {
    pdf:   { exts: ['.pdf'], mimes: ['application/pdf'], label: 'PDF' },
    word:  { exts: ['.doc','.docx'], mimes: ['application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'], label: 'Word (.doc, .docx)' },
    image: { exts: ['.jpg','.jpeg','.png'], mimes: ['image/jpeg','image/png'], label: 'JPG/PNG' },
    excel: { exts: ['.xls','.xlsx'], mimes: ['application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], label: 'Excel (.xls, .xlsx)' },
    ppt:   { exts: ['.ppt','.pptx'], mimes: ['application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation'], label: 'PowerPoint (.ppt, .pptx)' },
    html:  { exts: ['.html','.htm'], mimes: ['text/html'], label: 'HTML' },
  };

  function validateFile(file, format) {
    const profile = FORMATS[format];
    if (!profile) return true;
    const name = file.name.toLowerCase();
    const okExt  = profile.exts.some(e => name.endsWith(e));
    const okMime = !file.type || profile.mimes.includes(file.type);
    return okExt && (okMime || !file.type);
  }

  function setRunButtonEnabled() {
    runBtn.disabled = !(currentTool && currentFiles.length >= (currentTool.minFiles || 1));
  }
  function pushHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(currentFiles.slice());
    historyIndex = history.length - 1;
    if (history.length > 20) history.shift();
  }
  function undo() {
    if (historyIndex > 0) { historyIndex--; currentFiles = history[historyIndex].slice(); renderFileList(); setRunButtonEnabled(); }
  }
  function redo() {
    if (historyIndex < history.length - 1) { historyIndex++; currentFiles = history[historyIndex].slice(); renderFileList(); setRunButtonEnabled(); }
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  function openTool(name) {
    const t = tools[name];
    if (!t) {
      toast('info', 'Coming soon', `The "${name}" tool isn't ready yet — try one nearby.`);
      return;
    }
    currentTool = { name, ...t };
    currentFiles = [];
    history = []; historyIndex = -1;
    wsTitle.textContent = t.title;
    wsSub.textContent = t.subtitle;
    dzTitle.textContent = t.dzTitle || `Drop your ${(FORMATS[t.format]?.label || 'file')} here`;
    dzSub.textContent   = t.dzSub   || 'or click to browse';
    fileInput.accept    = (FORMATS[t.format]?.exts || []).join(',') || '';
    fileInput.multiple  = !!t.multiple;
    fileList.innerHTML = '';
    optionsEl.innerHTML = t.optionsHtml || '';
    runBtn.querySelector('.btn-label').textContent = t.runLabel || 'Process';
    runBtn.classList.remove('is-loading');
    wsMeta.textContent = '';
    renderRecent();
    setRunButtonEnabled();
    ws.classList.add('is-open'); ws.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (t.onMount) t.onMount({ files: () => currentFiles, refresh: renderFileList, toast });
  }
  function closeTool() {
    ws.classList.remove('is-open'); ws.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
    currentTool = null;
  }
  $$('[data-close]').forEach(el => el.addEventListener('click', closeTool));
  document.addEventListener('keydown', (e) => {
    if (!ws.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeTool();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); }
  });

  /* Dropzone */
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') { e.preventDefault(); fileInput.click(); } });
  ['dragenter','dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('is-drag'); }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('is-drag'); }));
  dropzone.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', () => { if (fileInput.files?.length) handleFiles(fileInput.files); fileInput.value=''; });

  function handleFiles(filesLike) {
    if (!currentTool) return;
    const arr = Array.from(filesLike);
    const fmt = currentTool.format;
    const accepted = [], rejected = [];
    arr.forEach(f => validateFile(f, fmt) ? accepted.push(f) : rejected.push(f));
    if (rejected.length) {
      const label = FORMATS[fmt]?.label || 'correct';
      dropzone.classList.add('is-error');
      setTimeout(() => dropzone.classList.remove('is-error'), 600);
      toast('error', 'Invalid file type', `Please upload a valid ${label} file.`);
    }
    if (!accepted.length) return;

    // Plan gate: Free plan = 1 file at a time even on multi-file tools.
    // Premium = batch upload + parallel processing.
    const isPremium = window.HopeAuth && window.HopeAuth.isPremium && window.HopeAuth.isPremium();
    let next = currentTool.multiple ? currentFiles.concat(accepted) : accepted.slice(0, 1);
    if (currentTool.multiple && !isPremium && next.length > 1) {
      next = next.slice(0, 1);
      toast('info', 'Free plan: 1 file at a time',
        'Upgrade to Premium for batch upload + parallel processing.');
    }
    currentFiles = next;
    pushHistory();
    saveRecent(accepted);
    renderFileList();
    setRunButtonEnabled();
  }

  /* Render file list with drag-reorder + thumbnails */
  function renderFileList() {
    fileList.innerHTML = '';
    let totalSize = 0, totalPages = 0;
    currentFiles.forEach((file, idx) => {
      totalSize += file.size;
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.idx = idx;
      const ext = (file.name.split('.').pop() || '').toUpperCase().slice(0,4);
      li.innerHTML = `
        <span class="fi-handle" title="Drag to reorder">⋮⋮</span>
        <span class="fi-thumb">${ext}</span>
        <div class="fi-info">
          <div class="fi-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
          <div class="fi-meta">${formatBytes(file.size)}<span class="fi-pages"></span></div>
          <div class="fi-bar"><span></span></div>
        </div>
        <div class="fi-actions">
          <button class="fi-btn" data-act="preview" title="Preview" aria-label="Preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="fi-btn danger" data-act="remove" title="Remove" aria-label="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>
          </button>
        </div>`;
      // Async thumbnail
      const thumb = li.querySelector('.fi-thumb');
      const pagesEl = li.querySelector('.fi-pages');
      buildThumb(file, thumb, pagesEl).then(p => { if (p) totalPages += p; updateMeta(); });

      // Actions
      li.querySelector('[data-act="remove"]').addEventListener('click', (e) => {
        e.stopPropagation();
        currentFiles.splice(idx,1); pushHistory(); renderFileList(); setRunButtonEnabled();
      });
      li.querySelector('[data-act="preview"]').addEventListener('click', (e) => {
        e.stopPropagation();
        openPreview(file);
      });

      // Drag-reorder
      li.addEventListener('dragstart', e => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        li.classList.add('is-dragging');
      });
      li.addEventListener('dragend', () => li.classList.remove('is-dragging'));
      li.addEventListener('dragover', e => { e.preventDefault(); li.classList.add('is-drop-target'); });
      li.addEventListener('dragleave', () => li.classList.remove('is-drop-target'));
      li.addEventListener('drop', e => {
        e.preventDefault(); li.classList.remove('is-drop-target');
        const from = parseInt(e.dataTransfer.getData('text/plain'),10);
        const to = idx;
        if (Number.isFinite(from) && from !== to) {
          const [m] = currentFiles.splice(from,1);
          currentFiles.splice(to,0,m);
          pushHistory(); renderFileList();
        }
      });
      // Keyboard reorder
      li.tabIndex = 0;
      li.addEventListener('keydown', e => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          currentFiles.splice(idx,1); pushHistory(); renderFileList(); setRunButtonEnabled();
        } else if (e.key === 'ArrowUp' && idx > 0) {
          e.preventDefault();
          [currentFiles[idx-1], currentFiles[idx]] = [currentFiles[idx], currentFiles[idx-1]];
          pushHistory(); renderFileList();
        } else if (e.key === 'ArrowDown' && idx < currentFiles.length - 1) {
          e.preventDefault();
          [currentFiles[idx+1], currentFiles[idx]] = [currentFiles[idx], currentFiles[idx+1]];
          pushHistory(); renderFileList();
        }
      });
      fileList.appendChild(li);
    });

    // Toolbar (sort, multi-select etc) when 2+ files
    if (currentFiles.length > 1 && currentTool?.multiple) {
      const tb = document.createElement('div');
      tb.className = 'fl-toolbar';
      tb.innerHTML = `
        <button data-act="sort">Sort A–Z</button>
        <button data-act="reverse">Reverse</button>
        <button data-act="clearall">Clear all</button>`;
      tb.addEventListener('click', e => {
        const act = e.target?.dataset?.act;
        if (act === 'sort') currentFiles.sort((a,b) => a.name.localeCompare(b.name));
        else if (act === 'reverse') currentFiles.reverse();
        else if (act === 'clearall') currentFiles = [];
        pushHistory(); renderFileList(); setRunButtonEnabled();
      });
      fileList.appendChild(tb);
    }

    function updateMeta() {
      wsMeta.textContent = currentFiles.length
        ? `${currentFiles.length} file${currentFiles.length>1?'s':''} · ${formatBytes(totalSize)}${totalPages?` · ${totalPages} pages`:''}`
        : '';
    }
    updateMeta();
  }

  /* Build thumbnail and read pages where possible */
  async function buildThumb(file, thumbEl, pagesEl) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      try {
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        if (pagesEl) pagesEl.textContent = ` · ${pdf.numPages} pages`;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.3 });
        const c = document.createElement('canvas');
        c.width = viewport.width; c.height = viewport.height;
        await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
        thumbEl.innerHTML = ''; thumbEl.appendChild(c);
        return pdf.numPages;
      } catch (e) { /* fallback to ext */ }
    } else if (/^image\//.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.onload = () => setTimeout(() => URL.revokeObjectURL(img.src), 5000);
      thumbEl.innerHTML = ''; thumbEl.appendChild(img);
    }
    return 0;
  }

  function formatBytes(b) {
    if (!b && b !== 0) return '';
    if (b < 1024) return b + ' B';
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
    return (b / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /* Recent files (localStorage) */
  function saveRecent(files) {
    try {
      const arr = JSON.parse(localStorage.getItem('hope-recent') || '[]');
      files.forEach(f => arr.unshift({ name: f.name, size: f.size, at: Date.now() }));
      const seen = new Set();
      const out = arr.filter(x => { if (seen.has(x.name)) return false; seen.add(x.name); return true; }).slice(0, 8);
      localStorage.setItem('hope-recent', JSON.stringify(out));
    } catch {}
  }
  function renderRecent() {
    const arr = JSON.parse(localStorage.getItem('hope-recent') || '[]');
    if (!arr.length) { recentList.innerHTML = ''; return; }
    recentList.innerHTML = arr.map(f =>
      `<li title="${escapeHtml(f.name)}">${escapeHtml(f.name.length>26 ? f.name.slice(0,23)+'…' : f.name)}</li>`
    ).join('');
  }

  clearBtn.addEventListener('click', () => { currentFiles = []; pushHistory(); renderFileList(); setRunButtonEnabled(); });

  runBtn.addEventListener('click', async () => {
    if (!currentTool || !currentFiles.length) return;

    // ── Auth + plan guard (Free 20 MB / Premium 100 MB; rate per hour+day)
    if (window.HopeAuth) {
      try {
        for (const f of currentFiles) window.HopeAuth.checkFile(f);
        window.HopeAuth.checkRate();
      } catch (err) {
        toast('error', 'Limit reached', err.message || 'Try a smaller file or upgrade.');
        return;
      }
    }

    const opts = collectOptions();
    runBtn.classList.add('is-loading'); runBtn.disabled = true;
    // simulated per-file progress
    const bars = $$('.fi-bar > span', fileList);
    bars.forEach(b => b.style.width = '0');
    const progT = setInterval(() => {
      bars.forEach(b => { const cur = parseFloat(b.style.width)||0; b.style.width = Math.min(cur+rand(2,12), 92) + '%'; });
    }, 220);
    try {
      await currentTool.run(currentFiles, opts, { toast, downloadBlob, downloadBytes, openPreview });
      bars.forEach(b => b.style.width = '100%');
      toast('success', 'Done', 'Your file is ready.');
    } catch (err) {
      console.error(err);
      toast('error', 'Something went wrong', err.message || 'Please try a different file.');
    } finally {
      clearInterval(progT);
      runBtn.classList.remove('is-loading'); runBtn.disabled = false;
    }
  });

  function collectOptions() {
    const out = {};
    optionsEl.querySelectorAll('[name]').forEach(el => {
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }

  function downloadBlob(blob, filename) {
    if (window.saveAs) return window.saveAs(blob, filename);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function downloadBytes(bytes, filename, mime='application/octet-stream') {
    downloadBlob(new Blob([bytes], { type: mime }), filename);
  }

  /* Preview modal */
  const previewModal = $('#preview-modal');
  const previewBody  = $('#preview-body');
  const previewTitle = $('#preview-title');
  $$('[data-close-preview]').forEach(el => el.addEventListener('click', closePreview));
  function closePreview() { previewModal.classList.remove('is-open'); previewBody.innerHTML = ''; }
  async function openPreview(file) {
    previewTitle.textContent = file.name;
    previewBody.innerHTML = '<p style="text-align:center;color:var(--ink-mute)">Rendering preview…</p>';
    previewModal.classList.add('is-open');
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const buf = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
        previewBody.innerHTML = '';
        const max = Math.min(pdf.numPages, 8);
        for (let i=1;i<=max;i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.85 });
          const c = document.createElement('canvas');
          c.width = viewport.width; c.height = viewport.height;
          await page.render({ canvasContext: c.getContext('2d'), viewport }).promise;
          previewBody.appendChild(c);
        }
        if (pdf.numPages > max) {
          const m = document.createElement('p');
          m.style.cssText = 'text-align:center;color:var(--ink-mute);font-size:13px;';
          m.textContent = `…and ${pdf.numPages - max} more pages`;
          previewBody.appendChild(m);
        }
      } else if (/^image\//.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)) {
        previewBody.innerHTML = '';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        previewBody.appendChild(img);
      } else {
        previewBody.innerHTML = '<p style="text-align:center;color:var(--ink-mute)">Preview not available for this file.</p>';
      }
    } catch (e) {
      previewBody.innerHTML = '<p style="text-align:center;color:var(--ink-mute)">Could not preview this file.</p>';
    }
  }

  /* ────────────────────────────────────────────────
     Auth + plan UI (Google Sign-In + Razorpay upgrade)
     Owns nothing the animation code touches; safe to live here.
     ──────────────────────────────────────────────── */
  (function setupAuthUi() {
    if (!window.HopeAuth) return;
    const planBadge   = $('#plan-badge');
    const upgradeBtn  = $('#upgrade-btn');
    const authSlot    = $('#auth-slot');
    if (!planBadge || !upgradeBtn || !authSlot) return;

    /* Single source of truth for the auth slot.
     *   Signed in  → Google-style profile button + dropdown card with
     *                avatar / name / email / plan-tinted card / actions
     *   Signed out → empty #googleSignInContainer; HopeAuth.initGoogle
     *                renders the one-and-only Google button into it.
     *
     * Plan-based card styling:
     *   premium-yearly  → "gold"   (gold gradient + glow)
     *   premium-monthly → "silver" (silver gradient)
     *   free            → "free"   (dark theme)
     *
     * Upgrade button: tinted gold and disabled when the user is already
     * on a premium plan. */
    function classForPlan(p) {
      if (p === 'premium-yearly')  return 'gold';
      if (p === 'premium-monthly') return 'silver';
      return 'free';
    }

    function tagForPlan(p) {
      if (p === 'premium-yearly')  return 'PREMIUM YEARLY';
      if (p === 'premium-monthly') return 'PREMIUM MONTHLY';
      return 'FREE';
    }

    function syncBadgeAndSlot() {
      const u = window.HopeAuth.getUser();
      const p = window.HopeAuth.plan();
      const label = window.HopeAuth.PLANS[p].label;
      planBadge.textContent = p === 'free' ? 'Free' : label;
      planBadge.dataset.plan = p;

      // Upgrade button — visible only for free users (premium hides it).
      // Use both `hidden` attribute and inline style so cached CSS or
      // late renders can't bring the pill back.
      const isPrem = p !== 'free';
      upgradeBtn.dataset.plan = p;
      upgradeBtn.textContent  = 'Upgrade';
      upgradeBtn.disabled     = false;
      upgradeBtn.classList.remove('is-gold');
      if (isPrem) {
        upgradeBtn.setAttribute('hidden', '');
        upgradeBtn.style.display = 'none';
      } else {
        upgradeBtn.removeAttribute('hidden');
        upgradeBtn.style.display = '';
      }

      if (u) {
        const initial = (u.name || u.email || '?').trim().charAt(0).toUpperCase();
        const cardCls = classForPlan(p);
        const tag     = tagForPlan(p);
        const avatarUrl = u.picture ? escapeHtml(u.picture) : '';

        authSlot.innerHTML = `
          <button id="profileBtn" class="profile-btn" type="button"
                  aria-haspopup="true" aria-expanded="false" aria-label="Account">
            ${avatarUrl
              ? `<img class="profile-avatar" src="${avatarUrl}" alt="${escapeHtml(u.name || u.email)}" referrerpolicy="no-referrer" />`
              : `<span class="profile-avatar profile-avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`}
          </button>

          <div id="accountPopup" class="account-popup hidden" role="dialog" aria-label="Account">
            <div class="account-card account-card-${cardCls}">
              <div class="account-head">
                ${avatarUrl
                  ? `<img class="account-avatar-lg" src="${avatarUrl}" alt="" referrerpolicy="no-referrer" />`
                  : `<span class="account-avatar-lg account-avatar-fallback" aria-hidden="true">${escapeHtml(initial)}</span>`}
                <div class="account-id">
                  <div class="account-name">${escapeHtml(u.name || u.email)}</div>
                  <div class="account-email" title="${escapeHtml(u.email)}">${escapeHtml(u.email)}</div>
                </div>
              </div>
              <span class="account-plan-tag account-plan-${cardCls}">${tag}</span>
              <div class="account-actions">
                <button id="manageAccountBtn" type="button" class="account-btn ghost">Manage Account</button>
                <button id="signOutBtn"       type="button" class="account-btn danger">Sign Out</button>
              </div>
            </div>
          </div>`;

        // ── Popup wiring ─────────────────────────────────────────
        const profileBtn = $('#profileBtn');
        const popup      = $('#accountPopup');

        function closePopup() {
          popup.classList.add('hidden');
          profileBtn.setAttribute('aria-expanded', 'false');
        }
        function openPopup() {
          popup.classList.remove('hidden');
          profileBtn.setAttribute('aria-expanded', 'true');
        }

        profileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          popup.classList.contains('hidden') ? openPopup() : closePopup();
        });

        // Click outside / Esc to close
        document.addEventListener('click', (e) => {
          if (popup.classList.contains('hidden')) return;
          if (!popup.contains(e.target) && e.target !== profileBtn) closePopup();
        }, true);
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && !popup.classList.contains('hidden')) closePopup();
        });

        // Manage Account → opens the existing pricing modal so the user
        // can change plan / see status. Keeps logic in one place.
        $('#manageAccountBtn').addEventListener('click', () => {
          closePopup();
          openPricingModal();
        });

        // Sign out — clear the verified user and reload (per spec).
        $('#signOutBtn').addEventListener('click', () => {
          window.HopeAuth.signOut();
          try { localStorage.removeItem('hope.user'); } catch (_) {}
          location.reload();
        });
      } else {
        // Signed out → single custom gold "Continue with Google" button.
        // Click → server-side OAuth redirect (handled by passport at
        // GET /auth/google → /auth/google/callback → ?token= back).
        const BACKEND = 'https://hopepdf-api.onrender.com';
        authSlot.innerHTML = `
          <button id="googleLoginBtn" type="button" class="gold-google-btn" aria-label="Sign in with Google">
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="" width="18" height="18" />
            <span>Sign in</span>
          </button>`;
        $('#googleLoginBtn').addEventListener('click', () => {
          window.location.href = `${BACKEND}/auth/google`;
        });
      }
    }

    syncBadgeAndSlot();
    window.HopeAuth.onChange(syncBadgeAndSlot);
    // GIS may finish loading after first paint — re-render the button then.
    setTimeout(syncBadgeAndSlot, 1500);

    upgradeBtn.addEventListener('click', openPricingModal);

    function openPricingModal() {
      const u = window.HopeAuth.getUser();
      if (!u) { toast('info', 'Sign in first', 'Use Continue with Google to manage your plan.'); return; }
      const PLANS = window.HopeAuth.PLANS;
      const cur = window.HopeAuth.plan();

      // Reuse the existing info-modal scaffold so styling stays consistent.
      const infoModal = $('#info-modal');
      const infoTitle = $('#info-title');
      const infoBody  = $('#info-body');
      infoTitle.textContent = 'Plans & Pricing';
      infoBody.innerHTML = `
        <div class="pricing-grid">
          <article class="pricing-card ${cur === 'free' ? 'is-current' : ''}">
            <h5>Free</h5>
            <p class="price">₹0</p>
            <ul>
              <li>20 MB max file</li>
              <li>${PLANS.free.dailyQuota} files / day</li>
              <li>Ads enabled</li>
            </ul>
            <button class="btn btn-ghost full" data-pick="free" ${cur === 'free' ? 'disabled' : ''}>${cur === 'free' ? 'Current' : 'Switch to Free'}</button>
          </article>
          <article class="pricing-card highlight ${cur === 'premium-monthly' ? 'is-current' : ''}">
            <h5>Premium Monthly</h5>
            <p class="price">₹150<span>/mo</span></p>
            <ul>
              <li>100 MB max file</li>
              <li>Unlimited usage</li>
              <li>No ads</li>
            </ul>
            <button class="btn btn-primary full" data-pick="premium-monthly" ${cur === 'premium-monthly' ? 'disabled' : ''}>${cur === 'premium-monthly' ? 'Active' : 'Choose Monthly'}</button>
          </article>
          <article class="pricing-card ${cur === 'premium-yearly' ? 'is-current' : ''}">
            <h5>Premium Yearly</h5>
            <p class="price">₹1000<span>/yr</span></p>
            <p class="save-pill">Save ₹800</p>
            <ul>
              <li>Everything in Monthly</li>
              <li>Best value</li>
              <li>Priority support</li>
            </ul>
            <button class="btn btn-primary full" data-pick="premium-yearly" ${cur === 'premium-yearly' ? 'disabled' : ''}>${cur === 'premium-yearly' ? 'Active' : 'Choose Yearly'}</button>
          </article>
        </div>
        <p class="opt-hint">Secure payment via Razorpay. Files never leave your browser regardless of plan.</p>`;
      infoModal.classList.add('is-open');
      infoModal.setAttribute('aria-hidden', 'false');

      $$('.pricing-card [data-pick]', infoBody).forEach(btn => {
        btn.addEventListener('click', async () => {
          const pick = btn.dataset.pick;
          try {
            if (pick === 'free') {
              window.HopeAuth.setPlan('free', null);
              toast('success', 'Switched to Free', '');
            } else {
              btn.disabled = true; btn.textContent = 'Opening payment…';
              await window.HopeAuth.startCheckout(pick);
              toast('success', 'Welcome', `${PLANS[pick].label} activated.`);
            }
            infoModal.classList.remove('is-open');
            infoModal.setAttribute('aria-hidden', 'true');
          } catch (err) {
            toast('error', 'Could not upgrade', err.message || 'Try again.');
            btn.disabled = false;
            btn.textContent = pick === 'premium-yearly' ? 'Choose Yearly' : 'Choose Monthly';
          }
        });
      });
    }
  })();

  /* Public API for tools.js
     - Cards land on the homepage only when the tool declares a
       homepageBucket ('pdf' | 'word' | 'image' | 'others').
     - Tools without a bucket are still searchable + reachable
       through the mega-menu, just not on the grid. */
  window.HopeWS = {
    register(name, config) {
      tools[name] = config;
      if (config.homepageBucket) ToolGrid.add(name, config);
    },
    open: openTool,
    close: closeTool,
    toast,
  };

  /* ────────────────────────────────────────────────
     8. Tool grid + filter pills
     Filter values ↔ homepage buckets:
       all · pdf · word · image · others
     Tools flagged comingSoon render as disabled cards
     (no click-through, badge instead).
     ──────────────────────────────────────────────── */
  const grid = $('#tool-grid');
  const ToolGrid = (() => {
    const cards = [];
    function add(name, config) {
      cards.push({ name, ...config });
    }
    function render(filter = 'all') {
      grid.innerHTML = '';
      cards.forEach((c, i) => {
        // Hard rule (per spec): Coming Soon tools never appear on the homepage.
        if (c.comingSoon) return;
        if (filter !== 'all' && c.homepageBucket !== filter) return;
        const card = document.createElement('button');
        card.className = 'tool-card reveal';
        card.dataset.cat = c.homepageBucket || c.cardCategory;
        card.style.setProperty('--i', i);
        card.innerHTML = `
          ${c.tag ? `<span class="tool-tag">${c.tag}</span>` : ''}
          <div class="tool-icon">${c.icon || ''}</div>
          <h3>${escapeHtml(c.title)}</h3>
          <p>${escapeHtml(c.cardDesc || c.subtitle || '')}</p>`;
        card.addEventListener('click', () => openTool(c.name));
        grid.appendChild(card);
      });
      observeReveals();
    }
    function list() { return cards.slice(); }
    return { add, render, list };
  })();

  /* ────────────────────────────────────────────────
     8b. Tool search bar (top-right of header)
     Filters tools by title/desc/category, opens on click.
     Keyboard: '/' focuses, Esc closes, ↑↓ + Enter navigate.
     ──────────────────────────────────────────────── */
  const searchInput = $('#tool-search');
  const searchResults = $('#search-results');
  let searchActiveIdx = -1;

  function searchScore(card, q) {
    if (!q) return 0;
    const t = (card.title || '').toLowerCase();
    const d = (card.cardDesc || card.subtitle || '').toLowerCase();
    const c = (card.cardCategory || '').toLowerCase();
    if (t.startsWith(q)) return 100;
    if (t.includes(q))   return 80;
    if (c.includes(q))   return 50;
    if (d.includes(q))   return 30;
    return 0;
  }
  function categoryDot(cat) {
    const map = { organize:'#ffb1c8', optimize:'#ffd28b', convert:'#b9d4ff', edit:'#c0f0d8', security:'#ffc9c9', workflow:'#e6b352' };
    return map[cat] || '#ffb1c8';
  }
  function renderSearchResults(q) {
    if (!q) {
      searchResults.hidden = true;
      searchResults.innerHTML = '';
      searchActiveIdx = -1;
      return;
    }
    const ranked = ToolGrid.list()
      .map(c => ({ c, s: searchScore(c, q) }))
      .filter(r => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);

    searchResults.hidden = false;
    if (ranked.length === 0) {
      searchResults.innerHTML = `<div class="search-empty">No tools match “${escapeHtml(q)}”.</div>`;
      searchActiveIdx = -1;
      return;
    }
    searchResults.innerHTML = ranked.map((r, i) => {
      const cat = r.c.cardCategory || '';
      return `<button class="search-result" type="button" data-tool="${escapeHtml(r.c.name)}" data-idx="${i}">
        <span class="sr-dot" style="background:${categoryDot(cat)};color:${categoryDot(cat)}"></span>
        <span class="sr-name">${escapeHtml(r.c.title)}</span>
        <span class="sr-cat">${escapeHtml(cat)}</span>
      </button>`;
    }).join('');
    searchActiveIdx = 0;
    highlightActive();
    $$('.search-result', searchResults).forEach(b => {
      b.addEventListener('mousedown', e => e.preventDefault()); // keep input focused
      b.addEventListener('click', () => {
        const tool = b.dataset.tool;
        if (tool) {
          searchInput.value = '';
          searchResults.hidden = true;
          searchResults.innerHTML = '';
          openTool(tool);
        }
      });
    });
  }
  function highlightActive() {
    const items = $$('.search-result', searchResults);
    items.forEach((it, i) => it.classList.toggle('is-active', i === searchActiveIdx));
  }
  if (searchInput && searchResults) {
    searchInput.addEventListener('input', () => {
      renderSearchResults(searchInput.value.trim().toLowerCase());
    });
    searchInput.addEventListener('focus', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (q) renderSearchResults(q);
    });
    searchInput.addEventListener('keydown', e => {
      const items = $$('.search-result', searchResults);
      if (e.key === 'ArrowDown') {
        if (items.length) { searchActiveIdx = (searchActiveIdx + 1) % items.length; highlightActive(); }
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        if (items.length) { searchActiveIdx = (searchActiveIdx - 1 + items.length) % items.length; highlightActive(); }
        e.preventDefault();
      } else if (e.key === 'Enter') {
        const it = items[searchActiveIdx];
        if (it) { e.preventDefault(); it.click(); }
      } else if (e.key === 'Escape') {
        searchInput.value = '';
        renderSearchResults('');
        searchInput.blur();
      }
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-search')) {
        searchResults.hidden = true;
      }
    });
    // Global '/' shortcut → focus search
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  // Filter pills
  $$('.pill').forEach(p => p.addEventListener('click', () => {
    $$('.pill').forEach(x => x.classList.remove('is-active'));
    p.classList.add('is-active');
    const f = p.dataset.filter || 'all';
    ToolGrid.render(f);
  }));

  // Header / mega-menu jumps to tools
  $$('[data-jump-tool]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const tool = a.dataset.jumpTool;
    closeMobileMenu();
    // close any open dropdown
    $$('.nav-dd.is-open').forEach(x => x.classList.remove('is-open'));
    openTool(tool);
  }));

  /* ────────────────────────────────────────────────
     9. Mega menu mobile click-to-open
     ──────────────────────────────────────────────── */
  $$('.nav-dd-trigger').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    const dd = b.closest('.nav-dd');
    const wasOpen = dd.classList.contains('is-open');
    $$('.nav-dd.is-open').forEach(x => x.classList.remove('is-open'));
    if (!wasOpen) dd.classList.add('is-open');
  }));
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-dd')) $$('.nav-dd.is-open').forEach(x => x.classList.remove('is-open'));
  });

  /* Mobile hamburger */
  const navLinks = $('.nav-links');
  const mobileBtn = $('#mobile-menu');
  function closeMobileMenu() { navLinks.classList.remove('is-mobile-open'); }
  mobileBtn.addEventListener('click', () => navLinks.classList.toggle('is-mobile-open'));

  /* ────────────────────────────────────────────────
     10. Privacy / Terms info modal
     ──────────────────────────────────────────────── */
  const infoModal = $('#info-modal');
  const infoTitle = $('#info-title');
  const infoBody  = $('#info-body');
  const INFO = {
    privacy: { title: 'Privacy Policy', body: `
      <p>Your trust matters. H🌸PE PDF processes files entirely inside your browser — they are <strong>not uploaded</strong> to any server.</p>
      <p>We do not collect personal information. We do not run third-party trackers. Your theme preference and recent file names are stored locally on your device for convenience.</p>
      <p>If we introduce ads in the future, they will be clearly marked, and we will never sell your data.</p>` },
    terms:   { title: 'Terms of Service', body: `
      <p>By using H🌸PE PDF, you agree to use it responsibly. Avoid uploading sensitive or confidential documents — though processing is local, please use good judgment.</p>
      <p>The service is provided "as is" without warranty. We continually improve features but cannot guarantee specific outcomes for every file.</p>
      <p>Premium features, when launched, will be optional and clearly differentiated from the free toolkit.</p>` },
  };
  $$('[data-show]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    const k = a.dataset.show;
    if (!INFO[k]) return;
    infoTitle.textContent = INFO[k].title;
    infoBody.innerHTML = INFO[k].body;
    infoModal.classList.add('is-open');
  }));
  $$('[data-close-info]').forEach(el => el.addEventListener('click', () => infoModal.classList.remove('is-open')));

  /* (Premium CTA removed — section deleted) */

  /* ────────────────────────────────────────────────
     12. Butterfly system + click quote
     ──────────────────────────────────────────────── */
  const bLayer = $('#butterfly-layer');
  // Samurai sprite canvas (idle breathing + cloth sway, drawn frame-by-frame).
  const samuraiCanvas = $('#samurai-canvas');
  const samuraiCtx    = samuraiCanvas ? samuraiCanvas.getContext('2d') : null;
  // Mobile-aware caps — premium feel without lag on small devices
  const isMobile = window.matchMedia('(max-width: 720px)').matches || window.innerWidth < 720;
  const MAX_BUTTERFLIES = isMobile ? 6 : 10;
  const INITIAL_BUTTERFLIES = isMobile ? 5 : 8;
  const SEPARATION_DIST = 78;       // minimum px distance between butterflies
  const SEPARATION_FORCE = 0.06;    // gentle steering away
  const butterflies = [];

  function pickRarity() {
    const r = Math.random();
    if (r < 0.001)  return 'rainbow';
    if (r < 0.011)  return 'red';
    if (r < 0.031)  return 'blue';
    if (r < 0.131)  return 'pink';
    if (r < 0.381)  return 'white';
    return 'normal';
  }
  function rarityColor(rarity) {
    if (rarity === 'rainbow') return null; // animated
    if (rarity === 'red')   return ['#ff6f6f','#ff9090'];
    if (rarity === 'blue')  return ['#7da9ff','#a8c4ff'];
    if (rarity === 'pink')  return ['#ffb1c8','#ffd1de'];
    if (rarity === 'white') return ['#ffffff','#f4ecef'];
    // normal — pick from theme
    const isLight = body.dataset.theme === 'light';
    return isLight ? ['#3a2d2a','#6b574f'] : ['#f4ecef','#c8b9bf'];
  }
  function butterflySVG(rarity) {
    const colors = rarityColor(rarity);
    const c1 = colors ? colors[0] : '#f4ecef';
    const c2 = colors ? colors[1] : '#c8b9bf';
    const id = 'bg-' + Math.random().toString(36).slice(2,7);
    return `
      <svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${id}" x1="0" x2="1" y1="0" y2="1">
            <stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
          </linearGradient>
        </defs>
        <g class="b-wing-l" style="transform-origin: 50% 40px">
          <path fill="url(#${id})" d="M48 40 C 18 10, 0 25, 5 40 C 0 55, 18 70, 48 40 Z"/>
          <circle cx="20" cy="30" r="3" fill="rgba(0,0,0,.2)"/>
        </g>
        <g class="b-wing-r" style="transform-origin: 50% 40px">
          <path fill="url(#${id})" d="M52 40 C 82 10, 100 25, 95 40 C 100 55, 82 70, 52 40 Z"/>
          <circle cx="80" cy="30" r="3" fill="rgba(0,0,0,.2)"/>
        </g>
        <ellipse cx="50" cy="40" rx="3" ry="14" fill="${c2}"/>
        <circle cx="50" cy="26" r="3.5" fill="${c2}"/>
      </svg>
      <style>
        .b-wing-l { animation: flapL .35s ease-in-out infinite alternate; }
        .b-wing-r { animation: flapR .35s ease-in-out infinite alternate; }
        @keyframes flapL { 0%{transform: rotateY(0)} 100%{transform: rotateY(60deg)} }
        @keyframes flapR { 0%{transform: rotateY(0)} 100%{transform: rotateY(-60deg)} }
      </style>`;
  }

  function spawnButterfly(opts = {}) {
    if (butterflies.length >= MAX_BUTTERFLIES) return null;
    // Butterflies only fly in light mode
    if (body.dataset.theme !== 'light' && !opts.force) return null;
    const rarity = opts.rarity || pickRarity();
    const el = document.createElement('div');
    el.className = `butterfly rare-${rarity}`;
    el.innerHTML = butterflySVG(rarity);

    // Pick a non-overlapping spawn point (try a few times)
    let sx = opts.x ?? rand(60, window.innerWidth-60);
    let sy = opts.y ?? rand(80,  window.innerHeight*0.6);
    if (opts.x == null && opts.y == null) {
      for (let attempt = 0; attempt < 6; attempt++) {
        let ok = true;
        for (const o of butterflies) {
          const dx = o.x - sx, dy = o.y - sy;
          if (dx*dx + dy*dy < SEPARATION_DIST*SEPARATION_DIST) { ok = false; break; }
        }
        if (ok) break;
        sx = rand(60, window.innerWidth-60);
        sy = rand(80, window.innerHeight*0.6);
      }
    }
    el.style.left = sx + 'px';
    el.style.top  = sy + 'px';
    bLayer.appendChild(el);

    // Depth pass — small/medium/large + opacity variation for parallax feel
    const depthRoll = Math.random();
    const depth = depthRoll < 0.30 ? 'small' : (depthRoll < 0.78 ? 'medium' : 'large');
    const sizeScale = depth === 'small' ? 0.78 : (depth === 'medium' ? 1.0 : 1.22);
    const opacity = depth === 'small' ? 0.72 : (depth === 'medium' ? 0.92 : 1.0);
    el.style.opacity = opacity;

    const state = {
      el, rarity, depth, sizeScale, opacity,
      x: sx, y: sy,
      vx: rand(-0.5, 0.5), vy: rand(-0.3, 0.3),
      ax: 0, ay: 0,
      // Sinusoidal drift — gentle floating curve, not a straight line
      driftPhase: Math.random() * Math.PI * 2,
      driftFreq: rand(0.0008, 0.0014),       // per ms
      driftAmp:  rand(0.06, 0.14),
      mode: 'flying',          // 'flying' | 'resting'
      modeUntil: performance.now() + rand(4000, 12000),
      restAngle: 0,
      bornAt: performance.now(),
      isOld: opts.old || false,
    };
    el.addEventListener('click', () => onButterflyClick(state));
    butterflies.push(state);
    return state;
  }

  function onButterflyClick(state) {
    // dies, pop quote
    state.el.classList.add('is-dying');
    setTimeout(() => state.el.remove(), 950);
    butterflies.splice(butterflies.indexOf(state), 1);
    showQuote();
  }

  function fadeOldButterfly(state) {
    if (!state || !state.el || !state.el.parentNode) return;
    state.el.classList.add('is-fading');
    setTimeout(() => { try { state.el.remove(); } catch{} }, 1450);
    butterflies.splice(butterflies.indexOf(state), 1);
  }

  // Pause animation when tab is hidden — saves CPU, no jitter on return
  let butterflyPaused = false;
  document.addEventListener('visibilitychange', () => {
    butterflyPaused = document.hidden;
    if (!butterflyPaused) requestAnimationFrame(tickButterflies);
  });

  let lastTickTs = 0;
  function tickButterflies(now) {
    if (butterflyPaused) return;
    const W = window.innerWidth, H = window.innerHeight;
    now = now || performance.now();
    // delta in 60fps frame units — keeps physics consistent on low-FPS devices
    const dt = lastTickTs ? Math.min(2.5, (now - lastTickTs) / 16.667) : 1;
    lastTickTs = now;

    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];

      if (now > b.modeUntil) {
        b.mode = b.mode === 'flying' ? 'resting' : 'flying';
        b.modeUntil = now + (b.mode === 'flying' ? rand(5000, 12000) : rand(2200, 5000));
        b.restAngle = (Math.random()*40 - 20);
      }

      if (b.mode === 'flying') {
        // gentle random drift
        b.ax += rand(-0.035, 0.035);
        b.ay += rand(-0.035, 0.035);
        b.ax = Math.max(-0.16, Math.min(0.16, b.ax));
        b.ay = Math.max(-0.16, Math.min(0.16, b.ay));

        // Anti-overlap separation — steer away from neighbors
        let sepX = 0, sepY = 0;
        for (let j = 0; j < butterflies.length; j++) {
          if (i === j) continue;
          const o = butterflies[j];
          const dx = b.x - o.x, dy = b.y - o.y;
          const d2 = dx*dx + dy*dy;
          if (d2 > 0 && d2 < SEPARATION_DIST*SEPARATION_DIST) {
            const d = Math.sqrt(d2);
            const f = (SEPARATION_DIST - d) / SEPARATION_DIST; // 0..1, stronger when closer
            sepX += (dx / d) * f;
            sepY += (dy / d) * f;
          }
        }
        b.vx += sepX * SEPARATION_FORCE;
        b.vy += sepY * SEPARATION_FORCE;

        // Sinusoidal drift — soft floating curves rather than straight lines
        const driftX = Math.sin(b.driftPhase) * b.driftAmp;
        const driftY = Math.cos(b.driftPhase * 0.85) * b.driftAmp * 0.6;
        b.driftPhase += b.driftFreq * (now - (b._dpLast || now));
        b._dpLast = now;

        // Velocity integration with damping
        b.vx = b.vx * 0.955 + b.ax + Math.cos(Wind.angle) * Wind.strength * 0.04 + driftX;
        b.vy = b.vy * 0.955 + b.ay + Math.sin(Wind.angle) * Wind.strength * 0.02 + driftY;

        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // Soft boundary nudges
        if (b.x < 30)      b.vx += 0.18;
        if (b.x > W - 30)  b.vx -= 0.18;
        if (b.y < 60)      b.vy += 0.18;
        if (b.y > H - 100) b.vy -= 0.18;

        // Bake depth scale + tilt into the transform (no jitter)
        const tilt = Math.max(-12, Math.min(12, b.vx * 7));
        b.el.style.transform =
          `translate3d(0,0,0) rotate(${tilt}deg) scale(${b.sizeScale})`;
      } else {
        b.el.style.transform =
          `translate3d(0,0,0) rotate(${b.restAngle}deg) scale(${b.sizeScale * 0.95})`;
      }
      b.el.style.left = b.x + 'px';
      b.el.style.top  = b.y + 'px';
    }
    requestAnimationFrame(tickButterflies);
  }
  requestAnimationFrame(tickButterflies);

  /* ────────────────────────────────────────────────
     12c. Bat-with-quote creatures (DARK MODE ONLY)
     Replaces butterflies in dark mode. Each bat carries
     a short quote and pops a full quote on click.
     ──────────────────────────────────────────────── */
  const batLayerEl = $('#bat-layer');
  const MAX_BATS_DARK = isMobile ? 5 : 8;
  const INITIAL_BATS  = isMobile ? 5 : 7;
  const bats = [];

  function batSVG() {
    return `<svg class="bat-svg" viewBox="0 0 56 36" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" aria-hidden="true">
      <g class="bat-wing-l" fill="#1a0e14"><path d="M22 16 L8 8 L4 14 L2 22 L10 20 L16 22 Z"/></g>
      <g class="bat-wing-r" fill="#1a0e14"><path d="M34 16 L48 8 L52 14 L54 22 L46 20 L40 22 Z"/></g>
      <g fill="#1a0e14">
        <ellipse cx="28" cy="20" rx="8" ry="5"/>
        <path d="M22 14 L24 10 L26 14 Z"/>
        <path d="M34 14 L32 10 L30 14 Z"/>
      </g>
      <circle cx="25" cy="19" r="1" fill="#f48aa9"/>
      <circle cx="31" cy="19" r="1" fill="#f48aa9"/>
    </svg>`;
  }

  function shortQuoteText(q) {
    const t = q.text || '';
    if (t.length <= 38) return t;
    return t.slice(0, 36).replace(/\s+\S*$/, '') + '…';
  }

  function spawnBatCreature() {
    if (!batLayerEl) return null;
    if (bats.length >= MAX_BATS_DARK) return null;
    if (body.dataset.theme !== 'dark') return null;
    const el = document.createElement('div');
    el.className = 'bat-creature';
    el.innerHTML = batSVG();   // bat only — no carried text
    const sx = rand(60, window.innerWidth - 80);
    const sy = rand(80, window.innerHeight * 0.6);
    el.style.left = sx + 'px';
    el.style.top  = sy + 'px';
    batLayerEl.appendChild(el);
    const state = {
      el,
      x: sx, y: sy,
      vx: rand(-0.4, 0.4), vy: rand(-0.2, 0.2),
      ax: 0, ay: 0,
      driftPhase: Math.random() * Math.PI * 2,
      driftFreq:  rand(0.0008, 0.0014),
      driftAmp:   rand(0.05, 0.12),
      bornAt: performance.now(),
    };
    el.addEventListener('click', () => onBatClick(state));
    bats.push(state);
    return state;
  }

  function onBatClick(state) {
    state.el.classList.add('is-dying');
    setTimeout(() => { try { state.el.remove(); } catch{} }, 400);
    const idx = bats.indexOf(state);
    if (idx !== -1) bats.splice(idx, 1);
    // Pop the next quote (click-only reward)
    showQuote();
    // Respawn a new bat elsewhere after a short pause (still in dark mode)
    setTimeout(() => {
      if (body.dataset.theme === 'dark' && bats.length < MAX_BATS_DARK) spawnBatCreature();
    }, 700);
  }

  let lastBatTickTs = 0;
  function tickBats(now) {
    if (butterflyPaused) return;
    now = now || performance.now();
    const W = window.innerWidth, H = window.innerHeight;
    const dt = lastBatTickTs ? Math.min(2.5, (now - lastBatTickTs) / 16.667) : 1;
    lastBatTickTs = now;

    for (let i = 0; i < bats.length; i++) {
      const b = bats[i];
      b.ax += rand(-0.025, 0.025);
      b.ay += rand(-0.020, 0.020);
      b.ax = Math.max(-0.14, Math.min(0.14, b.ax));
      b.ay = Math.max(-0.10, Math.min(0.10, b.ay));
      const driftX = Math.sin(b.driftPhase) * b.driftAmp;
      const driftY = Math.cos(b.driftPhase * 0.9) * b.driftAmp * 0.5;
      b.driftPhase += b.driftFreq * (now - (b._dpLast || now));
      b._dpLast = now;
      b.vx = b.vx * 0.96 + b.ax + Math.cos(Wind.angle) * Wind.strength * 0.03 + driftX;
      b.vy = b.vy * 0.96 + b.ay + Math.sin(Wind.angle) * Wind.strength * 0.015 + driftY;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 30)        b.vx += 0.18;
      if (b.x > W - 60)    b.vx -= 0.18;
      if (b.y < 60)        b.vy += 0.18;
      if (b.y > H - 100)   b.vy -= 0.18;
      const tilt = Math.max(-10, Math.min(10, b.vx * 6));
      b.el.style.transform = `translate3d(0,0,0) rotate(${tilt}deg)`;
      b.el.style.left = b.x + 'px';
      b.el.style.top  = b.y + 'px';
    }
    requestAnimationFrame(tickBats);
  }
  requestAnimationFrame(tickBats);

  function clearBats() {
    while (bats.length) {
      const b = bats.pop();
      try { b.el.remove(); } catch{}
    }
  }
  function clearButterflies() {
    while (butterflies.length) {
      const b = butterflies.pop();
      try { b.el.remove(); } catch{}
    }
  }

  /* Mode-conditional spawning — fired on theme load + theme change */
  function repopulateForTheme() {
    const isLight = body.dataset.theme === 'light';
    if (isLight) {
      clearBats();
      // Spawn butterflies up to initial cap
      const need = Math.max(0, INITIAL_BUTTERFLIES - butterflies.length);
      for (let i = 0; i < need; i++) spawnButterfly();
    } else {
      clearButterflies();
      const need = Math.max(0, INITIAL_BATS - bats.length);
      for (let i = 0; i < need; i++) spawnBatCreature();
    }
  }
  document.addEventListener('themechange', repopulateForTheme);
  // Initial population once DOM is ready (quotes.js loads before this script)
  repopulateForTheme();

  // Periodic top-up — keeps the scene alive in either mode
  setInterval(() => {
    if (document.hidden) return;
    if (body.dataset.theme === 'light') {
      if (butterflies.length < MAX_BUTTERFLIES) spawnButterfly();
    } else {
      if (bats.length < MAX_BATS_DARK) spawnBatCreature();
    }
  }, 8000);

  /* Quote popup */
  const quotePopup = $('#quote-popup');
  const quoteText  = $('#quote-text');
  const quoteTrans = $('#quote-trans');
  const quoteAuth  = $('#quote-author');
  const quoteFlag  = $('#quote-flag');
  const quoteCloseBtn = $('#quote-close');
  let quoteOpenTimer = null, quoteAutoTimer = null;

  function showQuote() {
    if (quotePopup.classList.contains('is-open')) return; // anti-stack
    const q = window.pickQuote();
    quoteText.textContent  = q.text;
    quoteTrans.textContent = q.trans || '';
    quoteAuth.textContent  = '— ' + q.author;
    quoteFlag.textContent  = q.flag || '🌸';
    quotePopup.classList.add('is-open');
    quotePopup.classList.remove('is-out');
    clearTimeout(quoteAutoTimer);
    quoteAutoTimer = setTimeout(closeQuote, 5000);
  }
  function closeQuote() {
    if (!quotePopup.classList.contains('is-open')) return;
    quotePopup.classList.add('is-out');
    setTimeout(() => quotePopup.classList.remove('is-open','is-out'), 450);
    clearTimeout(quoteAutoTimer);
  }
  quoteCloseBtn.addEventListener('click', closeQuote);

  /* ──────────────────────────────────────────────
     PixelSprite engine + samurai sprite (lifecycle removed)
     ────────────────────────────────────────────── */

  // ── PixelSprite — frame buffer + FPS clamp + rAF-driven update ──
  class PixelSprite {
    constructor({ frames, palette, w, h, fps = 10 }) {
      this.frames = frames;       // array of flat row-major char strings
      this.palette = palette;     // { char → css color | null }
      this.w = w; this.h = h;
      this.fps = Math.max(1, Math.min(24, fps));   // clamp to a sane band
      this.frameIdx = 0;
      this.lastFrameTs = 0;
    }
    update(now) {
      const interval = 1000 / this.fps;
      if (!this.lastFrameTs) { this.lastFrameTs = now; return; }
      if (now - this.lastFrameTs >= interval) {
        this.frameIdx = (this.frameIdx + 1) % this.frames.length;
        this.lastFrameTs = now;
      }
    }
    reset() { this.frameIdx = 0; this.lastFrameTs = 0; }
    setFrame(i) { this.frameIdx = ((i % this.frames.length) + this.frames.length) % this.frames.length; }
    draw(ctx, ox, oy, scale = 1, alpha = 1, opts = {}) {
      const flipX = !!opts.flipX;
      const rotate = opts.rotate || 0;       // radians, around sprite center
      const grid = this.frames[this.frameIdx];
      const w = this.w, h = this.h, p = this.palette;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (rotate) {
        const cx = ox + (w * scale) / 2;
        const cy = oy + (h * scale) / 2;
        ctx.translate(cx, cy);
        ctx.rotate(rotate);
        ctx.translate(-cx, -cy);
      }
      const ix = Math.round(ox), iy = Math.round(oy);
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const ch = grid.charCodeAt(py * w + px);
          const color = p[String.fromCharCode(ch)];
          if (!color) continue;
          const dx = flipX ? (w - 1 - px) : px;
          ctx.fillStyle = color;
          ctx.fillRect(ix + dx * scale, iy + py * scale, scale, scale);
        }
      }
      ctx.restore();
    }
  }

  // ── Sprite frame builders ──
  // Samurai: 16w × 24h — 6 idle frames (breathing + cloth sway + sword glint)
  function buildSamuraiFrames() {
    const w = 16, h = 24;
    const out = [];
    const breathSeq = [0, 0, -1, -1, 0, 0];
    const swaySeq   = [0, 1, 0, -1, 0, 1];
    for (let f = 0; f < 6; f++) {
      const g = new Array(w * h).fill('.');
      const setPx = (x, y, ch) => { if (x>=0&&x<w&&y>=0&&y<h) g[y*w+x] = ch; };
      const breath = breathSeq[f];
      const sway   = swaySeq[f];
      const glint  = (f === 4 || f === 5);

      // hat (kasa cone) — wide-brim
      const hy = 1 + breath;
      for (let x = 5; x <= 10; x++) setPx(x, hy, 'H');
      setPx(4, hy+1, 'H'); setPx(5, hy+1, 'H');
      for (let x = 6; x <= 9; x++) setPx(x, hy+1, 'h');
      setPx(10, hy+1, 'H'); setPx(11, hy+1, 'H');
      setPx(3, hy+2, 'H'); setPx(4, hy+2, 'H');
      setPx(11, hy+2, 'H'); setPx(12, hy+2, 'H');

      // face
      for (let x = 6; x <= 9; x++) setPx(x, hy+3, 'F');
      setPx(6, hy+4, 'F'); setPx(7, hy+4, 'E');
      setPx(8, hy+4, 'E'); setPx(9, hy+4, 'F');
      setPx(7, hy+5, 'F'); setPx(8, hy+5, 'F');

      // torso (kimono) — fixed under hat, breathing pulls it 1px up
      const ty = hy + 6;
      for (let x = 4; x <= 11; x++) setPx(x, ty, 'K');
      setPx(4, ty+1, 'K'); setPx(11, ty+1, 'K');
      for (let x = 5; x <= 10; x++) setPx(x, ty+1, 'k');
      setPx(7, ty+1, 'b'); setPx(8, ty+1, 'b');
      setPx(4, ty+2, 'K'); setPx(11, ty+2, 'K');
      for (let x = 5; x <= 10; x++) setPx(x, ty+2, 'k');
      setPx(7, ty+2, 'b'); setPx(8, ty+2, 'b');
      setPx(4, ty+3, 'K'); setPx(11, ty+3, 'K');
      for (let x = 5; x <= 10; x++) setPx(x, ty+3, 'k');

      // belt (obi)
      for (let x = 5; x <= 10; x++) setPx(x, ty+4, 'O');

      // hakama legs (sway)
      const ly = ty + 5;
      const sx = sway;
      setPx(5+sx, ly,   'K'); setPx(6+sx, ly,   'k');
      setPx(9+sx, ly,   'k'); setPx(10+sx, ly,  'K');
      setPx(5+sx, ly+1, 'K'); setPx(6+sx, ly+1, 'k');
      setPx(9+sx, ly+1, 'k'); setPx(10+sx, ly+1,'K');
      setPx(4+sx, ly+2, 'K'); setPx(5+sx, ly+2, 'K');
      setPx(10+sx, ly+2,'K'); setPx(11+sx, ly+2,'K');

      // sword scabbard on left hip
      setPx(2, ty+3, 'S'); setPx(2, ty+4, 'S');
      setPx(2, ty+5, 'S'); setPx(2, ty+6, 'S');
      setPx(3, ty+2, 'h'); // hilt
      if (glint) setPx(2, ty+3, 'g');

      out.push(g.join(''));
    }
    return out;
  }
  const SAMURAI_PALETTE = {
    '.': null,
    'H': '#3a2a18',
    'h': '#5a4326',
    'F': '#d8b894',
    'E': '#1a0e0c',
    'K': '#1a1f2e',
    'k': '#2a3243',
    'b': '#7a1e2e',
    'O': '#c43d4d',
    'S': '#8a8a8a',
    'g': '#fff5b8',
  };

  // ── Sprite instances (built once) ──
  const samuraiSprite = samuraiCanvas ? new PixelSprite({ frames: buildSamuraiFrames(), palette: SAMURAI_PALETTE, w: 16, h: 24, fps: 8 }) : null;

  // ── Canvas sizing (DPR-aware, pixelated) ──
  function sizeSamuraiCanvas() {
    if (!samuraiCanvas || !samuraiCtx) return;
    const rect = samuraiCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    samuraiCanvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    samuraiCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    samuraiCtx.imageSmoothingEnabled = false;
    samuraiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (samuraiCanvas) sizeSamuraiCanvas();
  let _samResizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(_samResizeT);
    _samResizeT = setTimeout(sizeSamuraiCanvas, 120);
  });

  // ── Tab-pause for samurai canvas (CPU-friendly) ──
  let canvasPaused = false;
  document.addEventListener('visibilitychange', () => {
    canvasPaused = document.hidden;
    if (!canvasPaused && samuraiCtx) requestAnimationFrame(samuraiTick);
  });

  // ── Samurai sprite tick (small canvas, low CPU) ──
  function samuraiTick(now) {
    if (canvasPaused || !samuraiCtx || !samuraiSprite) return;
    // hide samurai entirely in light mode
    if (body.dataset.theme === 'light') {
      samuraiCtx.clearRect(0, 0, samuraiCanvas.width, samuraiCanvas.height);
      requestAnimationFrame(samuraiTick);
      return;
    }
    now = now || performance.now();
    samuraiSprite.update(now);
    const rect = samuraiCanvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    samuraiCtx.clearRect(0, 0, W, H);
    if (W < 2 || H < 2) { requestAnimationFrame(samuraiTick); return; }
    const scale = Math.max(2, Math.floor(Math.min(W / 16, H / 24)));
    const drawW = 16 * scale, drawH = 24 * scale;
    const x = Math.round((W - drawW) / 2);
    const y = Math.round((H - drawH) / 2);
    // soft ground shadow
    samuraiCtx.save();
    samuraiCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    samuraiCtx.beginPath();
    samuraiCtx.ellipse(W / 2, y + drawH - scale * 0.5, drawW * 0.4, scale * 1.2, 0, 0, Math.PI * 2);
    samuraiCtx.fill();
    samuraiCtx.restore();
    samuraiSprite.draw(samuraiCtx, x, y, scale);
    requestAnimationFrame(samuraiTick);
  }

  // ── Initial population + start loops ──
  // (creature spawn is gated on theme — see below)
  if (samuraiCtx) requestAnimationFrame(samuraiTick);

  /* ──────────────────────────────────────────────
     12b. Samurai vs Bats mini-game
     Click the samurai sprite → full-screen overlay.
     Pure canvas, frame-by-frame, offline-only.
     ────────────────────────────────────────────── */
  const gameOverlay  = $('#game-overlay');
  const gameCanvas   = $('#game-canvas');
  const gameCtx      = gameCanvas ? gameCanvas.getContext('2d') : null;
  const gameScoreEl  = $('#game-score');
  const gameLivesEl  = $('#game-lives');
  const gameOverEl   = $('#game-over');
  const gameIntroEl  = $('#game-intro');
  const gameFinalEl  = $('#game-final-score');
  const gameExitBtn  = $('#game-exit');
  const gameStartBtn = $('#game-start');
  const gameRestartBtn = $('#game-restart');
  const gameQuitBtn  = $('#game-quit');

  // Bat sprite — 12w × 9h, 3 wing-flap frames
  function buildBatFrames() {
    const w = 12, h = 9;
    // Three poses: wings up, mid, down
    const F1 = (
      '............' +
      '.W........W.' +
      'WW........WW' +
      '.WW.bbbb.WW.' +
      '..W.bebe.W..' +
      '....bbbb....' +
      '.....bb.....' +
      '............' +
      '............'
    );
    const F2 = (
      '............' +
      '............' +
      '.W........W.' +
      'WWW.bbbb.WWW' +
      '.WW.bebe.WW.' +
      '....bbbb....' +
      '.....bb.....' +
      '.....f......' +
      '............'
    );
    const F3 = (
      '............' +
      '............' +
      '............' +
      '...Wbbbb W..' +
      'WWWWbebeWWWW' +
      'W.W.bbbb.W.W' +
      '.....bb.....' +
      '.....f......' +
      '............'
    );
    return [F1, F2, F3];
  }
  const BAT_PALETTE = {
    '.': null,
    'W': '#1a0e18',  // wing dark
    'b': '#2a1a26',  // body
    'e': '#ff4d4d',  // glowing eye
    'f': '#5a2a36',  // tail/foot
  };

  // Game samurai — 16w × 24h, 4 frames (idle 1, idle 2, slash A, slash B)
  function buildGameSamuraiFrames() {
    // Reuse idle base, plus add a slash frame variant
    const w = 16, h = 24;
    const out = [];
    const baseBuilders = [
      { breath: 0, sway: 0,  slash: 0 },
      { breath: -1, sway: 1, slash: 0 },
      { breath: 0, sway: 0,  slash: 1 },   // sword raised
      { breath: 0, sway: -1, slash: 2 },   // sword swung
    ];
    for (const cfg of baseBuilders) {
      const g = new Array(w * h).fill('.');
      const setPx = (x, y, ch) => { if (x>=0&&x<w&&y>=0&&y<h) g[y*w+x] = ch; };
      const breath = cfg.breath, sway = cfg.sway;

      // hat
      const hy = 1 + breath;
      for (let x = 5; x <= 10; x++) setPx(x, hy, 'H');
      setPx(4, hy+1, 'H'); setPx(5, hy+1, 'H');
      for (let x = 6; x <= 9; x++) setPx(x, hy+1, 'h');
      setPx(10, hy+1, 'H'); setPx(11, hy+1, 'H');
      setPx(3, hy+2, 'H'); setPx(4, hy+2, 'H');
      setPx(11, hy+2, 'H'); setPx(12, hy+2, 'H');

      // face
      for (let x = 6; x <= 9; x++) setPx(x, hy+3, 'F');
      setPx(6, hy+4, 'F'); setPx(7, hy+4, 'E');
      setPx(8, hy+4, 'E'); setPx(9, hy+4, 'F');
      setPx(7, hy+5, 'F'); setPx(8, hy+5, 'F');

      // torso
      const ty = hy + 6;
      for (let x = 4; x <= 11; x++) setPx(x, ty, 'K');
      setPx(4, ty+1, 'K'); setPx(11, ty+1, 'K');
      for (let x = 5; x <= 10; x++) setPx(x, ty+1, 'k');
      setPx(7, ty+1, 'b'); setPx(8, ty+1, 'b');
      setPx(4, ty+2, 'K'); setPx(11, ty+2, 'K');
      for (let x = 5; x <= 10; x++) setPx(x, ty+2, 'k');
      setPx(7, ty+2, 'b'); setPx(8, ty+2, 'b');
      setPx(4, ty+3, 'K'); setPx(11, ty+3, 'K');
      for (let x = 5; x <= 10; x++) setPx(x, ty+3, 'k');

      // belt
      for (let x = 5; x <= 10; x++) setPx(x, ty+4, 'O');

      // legs
      const ly = ty + 5;
      const sx = sway;
      setPx(5+sx, ly,   'K'); setPx(6+sx, ly,   'k');
      setPx(9+sx, ly,   'k'); setPx(10+sx, ly,  'K');
      setPx(5+sx, ly+1, 'K'); setPx(6+sx, ly+1, 'k');
      setPx(9+sx, ly+1, 'k'); setPx(10+sx, ly+1,'K');
      setPx(4+sx, ly+2, 'K'); setPx(5+sx, ly+2, 'K');
      setPx(10+sx, ly+2,'K'); setPx(11+sx, ly+2,'K');

      // sword position depends on slash phase
      if (cfg.slash === 0) {
        // sheathed on hip
        setPx(2, ty+3, 'S'); setPx(2, ty+4, 'S');
        setPx(2, ty+5, 'S'); setPx(2, ty+6, 'S');
        setPx(3, ty+2, 'h');
      } else if (cfg.slash === 1) {
        // raised — diagonal blade above shoulder
        setPx(13, ty-2, 'g');
        setPx(14, ty-3, 'g');
        setPx(15, ty-4, 'g');
        setPx(12, ty-1, 'g');
        setPx(11, ty,   'h');
        setPx(11, ty+1, 'h');
      } else {
        // swung — horizontal blade across, motion lines
        for (let x = 12; x <= 15; x++) setPx(x, ty+1, 'g');
        setPx(11, ty+1, 'h');
        setPx(12, ty,   'g');
        // motion arc
        setPx(13, ty-1, 'M');
        setPx(14, ty,   'M');
      }
      out.push(g.join(''));
    }
    return out;
  }
  const GAME_SAMURAI_PALETTE = {
    '.': null,
    'H': '#3a2a18',
    'h': '#5a4326',
    'F': '#d8b894',
    'E': '#1a0e0c',
    'K': '#1a1f2e',
    'k': '#2a3243',
    'b': '#7a1e2e',
    'O': '#c43d4d',
    'S': '#8a8a8a',
    'g': '#fff5b8',
    'M': 'rgba(255, 245, 184, 0.45)',
  };

  // Game state
  const Game = {
    running: false,
    paused: false,
    samurai: null,
    bats: [],
    slashes: [],
    particles: [],
    score: 0,
    lives: 3,
    keys: Object.create(null),
    lastTs: 0,
    spawnTimer: 0,
    invincibleUntil: 0,
    samuraiSprite: null,
    batSprite: null,
    bgPhase: 0,
  };

  function gameInit() {
    Game.samuraiSprite = new PixelSprite({
      frames: buildGameSamuraiFrames(),
      palette: GAME_SAMURAI_PALETTE,
      w: 16, h: 24, fps: 6,
    });
    Game.batSprite = new PixelSprite({
      frames: buildBatFrames(),
      palette: BAT_PALETTE,
      w: 12, h: 9, fps: 9,
    });
  }

  function sizeGameCanvas() {
    if (!gameCanvas || !gameCtx) return;
    const rect = gameCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    gameCanvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    gameCanvas.height = Math.max(1, Math.round(rect.height * dpr));
    gameCtx.imageSmoothingEnabled = false;
    gameCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetGame() {
    Game.score = 0;
    Game.lives = 5;                 // was 3 — more forgiving
    Game.bats = [];
    Game.slashes = [];
    Game.particles = [];
    Game.spawnTimer = 2200;         // was 0 — 2.2s grace period at start
    Game.invincibleUntil = 0;
    Game.startedAt = performance.now();
    const rect = gameCanvas.getBoundingClientRect();
    Game.samurai = {
      x: rect.width / 2 - 24,
      y: rect.height - 100,
      vx: 0, vy: 0,
      onGround: true,
      facing: 1,
      attacking: false,
      attackUntil: 0,
      width: 16 * 4,
      height: 24 * 4,
    };
    updateHUD();
  }

  function updateHUD() {
    if (gameScoreEl) gameScoreEl.textContent = Game.score;
    if (gameLivesEl) {
      const hearts = gameLivesEl.querySelectorAll('.g-heart');
      hearts.forEach((h, i) => h.classList.toggle('spent', i >= Game.lives));
    }
  }

  function openGame() {
    if (!gameOverlay) return;
    gameOverlay.classList.add('is-open');
    gameOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    gameOverEl.classList.remove('is-shown');
    gameIntroEl.classList.add('is-shown');
    sizeGameCanvas();
  }
  function closeGame() {
    if (!gameOverlay) return;
    Game.running = false;
    gameOverlay.classList.remove('is-open');
    gameOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  function startRound() {
    gameIntroEl.classList.remove('is-shown');
    gameOverEl.classList.remove('is-shown');
    sizeGameCanvas();
    resetGame();
    Game.running = true;
    Game.lastTs = performance.now();
    requestAnimationFrame(gameLoop);
  }
  function gameOver() {
    Game.running = false;
    gameFinalEl.textContent = Game.score;
    gameOverEl.classList.add('is-shown');
  }

  // ── Input handling ──
  function onKeyDown(e) {
    if (!Game.running) return;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Spacebar'].includes(e.key)) {
      e.preventDefault();
    }
    const k = e.key === 'Spacebar' ? ' ' : e.key;
    Game.keys[k] = true;
    if (k === ' ' || k === 'Space') triggerAttack();
    if (k === 'Escape') closeGame();
  }
  function onKeyUp(e) {
    const k = e.key === 'Spacebar' ? ' ' : e.key;
    Game.keys[k] = false;
  }

  function triggerAttack() {
    if (!Game.running || !Game.samurai) return;
    const s = Game.samurai;
    if (s.attacking) return;
    s.attacking = true;
    s.attackUntil = performance.now() + 280;
    // spawn slash hitbox — bigger and lasts longer
    const range = 110;                                 // was 70
    Game.slashes.push({
      x: s.facing > 0 ? s.x + s.width - 8 : s.x - range + 8,
      y: s.y + 8,                                       // was 24 (taller)
      w: range,
      h: s.height - 8,                                  // was -24
      until: performance.now() + 320,                   // was 200
      hit: new Set(),
    });
    // sparkle particles
    for (let i = 0; i < 6; i++) {
      Game.particles.push({
        x: s.facing > 0 ? s.x + s.width : s.x,
        y: s.y + 30 + Math.random() * 30,
        vx: (s.facing > 0 ? 1 : -1) * (1 + Math.random() * 3),
        vy: -1 + Math.random() * 2,
        life: 360,
        born: performance.now(),
        color: 'rgba(255, 245, 184, 0.85)',
      });
    }
  }

  function spawnBat(rect) {
    if (Game.bats.length >= 4) return;          // was 8 — fewer bats on screen
    const fromLeft = Math.random() < 0.5;
    const y = 40 + Math.random() * (rect.height - 200);
    const speed = 0.30 + Math.random() * 0.35;  // was 0.6–1.5; slower entry
    Game.bats.push({
      x: fromLeft ? -20 : rect.width + 20,
      y,
      vx: fromLeft ? speed : -speed,
      vy: 0,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.03 + Math.random() * 0.03,
      hp: 1,
      width: 12 * 4,
      height: 9 * 4,
      dead: false,
    });
  }

  // ── Main game loop ──
  function gameLoop(now) {
    if (!Game.running) return;
    const rect = gameCanvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (W < 2 || H < 2) { requestAnimationFrame(gameLoop); return; }
    const dt = Math.min(48, now - Game.lastTs);
    Game.lastTs = now;

    // ── Update ──
    const s = Game.samurai;
    const speed = 0.42;             // was .32 — samurai is faster
    if (Game.keys['ArrowLeft']  || Game.keys['a'] || Game.keys['A']) { s.vx = -speed * dt; s.facing = -1; }
    else if (Game.keys['ArrowRight'] || Game.keys['d'] || Game.keys['D']) { s.vx = speed * dt; s.facing = 1; }
    else { s.vx = 0; }
    if ((Game.keys['ArrowUp'] || Game.keys['w'] || Game.keys['W']) && s.onGround) {
      s.vy = -9.2; s.onGround = false;   // higher jump
    }
    // gravity
    s.vy += 0.45 * dt / 16;
    s.x += s.vx;
    s.y += s.vy * dt / 16;
    if (s.y > H - 100) { s.y = H - 100; s.vy = 0; s.onGround = true; }
    if (s.x < 12) s.x = 12;
    if (s.x > W - 12 - s.width) s.x = W - 12 - s.width;
    if (s.attacking && now > s.attackUntil) s.attacking = false;

    // animate samurai sprite
    if (s.attacking) {
      // sword raised → swing
      const phase = (s.attackUntil - now) / 280;
      Game.samuraiSprite.setFrame(phase > 0.5 ? 2 : 3);
    } else {
      Game.samuraiSprite.update(now);
      // Limit idle frames to first two (frames 0, 1)
      if (Game.samuraiSprite.frameIdx > 1) Game.samuraiSprite.setFrame(0);
    }

    // bat spawn cadence — slower, ramps up gradually
    Game.spawnTimer -= dt;
    const elapsedSec = (now - (Game.startedAt || now)) / 1000;
    const maxBatsAlive = elapsedSec < 8 ? 2 : (elapsedSec < 20 ? 3 : 4);
    if (Game.spawnTimer <= 0 && Game.bats.length < maxBatsAlive) {
      spawnBat(rect);
      // wider intervals: 1.4s → 2.6s
      Game.spawnTimer = 1400 + Math.random() * 1200;
    }

    // bat update
    Game.batSprite.update(now);
    for (const b of Game.bats) {
      b.sway += b.swaySpeed;
      // gentle homing toward samurai — much weaker
      const dx = (s.x + s.width/2) - (b.x + b.width/2);
      const dy = (s.y + s.height/2) - (b.y + b.height/2);
      const d  = Math.hypot(dx, dy) || 1;
      b.vx += (dx / d) * 0.005 * dt / 16;   // was 0.012
      b.vy += (dy / d) * 0.003 * dt / 16;   // was 0.008
      // cap velocity — slower ceiling
      const maxV = 0.85;                     // was 1.6
      b.vx = Math.max(-maxV, Math.min(maxV, b.vx));
      b.vy = Math.max(-maxV, Math.min(maxV, b.vy));
      b.x += b.vx * dt / 16 + Math.sin(b.sway) * 0.35;
      b.y += b.vy * dt / 16 + Math.cos(b.sway) * 0.22;
      // off-screen cleanup
      if (b.x < -60 || b.x > W + 60 || b.y > H + 40) b.dead = true;
    }

    // slash hitbox check
    Game.slashes = Game.slashes.filter(sl => sl.until > now);
    for (const sl of Game.slashes) {
      for (const b of Game.bats) {
        if (b.dead || sl.hit.has(b)) continue;
        if (b.x < sl.x + sl.w && b.x + b.width > sl.x &&
            b.y < sl.y + sl.h && b.y + b.height > sl.y) {
          b.dead = true;
          sl.hit.add(b);
          Game.score += 1;
          updateHUD();
          // hit particles
          for (let i = 0; i < 7; i++) {
            Game.particles.push({
              x: b.x + b.width/2, y: b.y + b.height/2,
              vx: (Math.random() - 0.5) * 4,
              vy: (Math.random() - 0.5) * 4,
              life: 480, born: now,
              color: 'rgba(255, 111, 142, 0.9)',
            });
          }
        }
      }
    }

    // bat-vs-samurai damage
    if (now > Game.invincibleUntil) {
      for (const b of Game.bats) {
        if (b.dead) continue;
        if (b.x < s.x + s.width && b.x + b.width > s.x &&
            b.y < s.y + s.height && b.y + b.height > s.y) {
          b.dead = true;
          Game.lives -= 1;
          Game.invincibleUntil = now + 1500;     // was 900 — longer i-frames
          updateHUD();
          // damage burst
          for (let i = 0; i < 10; i++) {
            Game.particles.push({
              x: s.x + s.width/2, y: s.y + s.height/2,
              vx: (Math.random() - 0.5) * 5,
              vy: (Math.random() - 0.5) * 5,
              life: 600, born: now,
              color: 'rgba(255, 80, 80, 0.85)',
            });
          }
          if (Game.lives <= 0) { gameOver(); return; }
        }
      }
    }

    // cleanup dead
    Game.bats = Game.bats.filter(b => !b.dead);
    Game.particles = Game.particles.filter(p => now - p.born < p.life);

    // ── Render ──
    Game.bgPhase += dt * 0.0006;
    drawGameBackground(gameCtx, W, H, now);

    // bats first (behind samurai if vertically lower)
    for (const b of Game.bats) {
      const flip = b.vx > 0; // face direction of motion
      const scale = 4;
      Game.batSprite.draw(gameCtx, b.x, b.y, scale, 1, { flipX: flip });
    }

    // slash arcs
    for (const sl of Game.slashes) {
      const t = (sl.until - now) / 200;
      gameCtx.save();
      gameCtx.globalAlpha = Math.max(0, t) * 0.85;
      gameCtx.strokeStyle = 'rgba(255, 245, 184, 0.95)';
      gameCtx.lineWidth = 4;
      gameCtx.beginPath();
      gameCtx.moveTo(sl.x, sl.y);
      gameCtx.quadraticCurveTo(sl.x + sl.w/2, sl.y - 24, sl.x + sl.w, sl.y + sl.h);
      gameCtx.stroke();
      gameCtx.restore();
    }

    // samurai (flicker if invincible)
    const flick = (Game.invincibleUntil > now) && (Math.floor(now / 80) % 2 === 0);
    if (!flick) {
      Game.samuraiSprite.draw(gameCtx, s.x, s.y, 4, 1, { flipX: s.facing < 0 });
    }

    // particles
    for (const p of Game.particles) {
      const age = now - p.born;
      const a = Math.max(0, 1 - age / p.life);
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      gameCtx.fillStyle = p.color;
      gameCtx.globalAlpha = a;
      gameCtx.fillRect(Math.round(p.x), Math.round(p.y), 3, 3);
    }
    gameCtx.globalAlpha = 1;

    requestAnimationFrame(gameLoop);
  }

  function drawGameBackground(ctx, W, H, now) {
    // night sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a0510');
    sky.addColorStop(0.5, '#160b18');
    sky.addColorStop(1, '#0a050a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // moon
    const mx = W * 0.78, my = H * 0.22;
    const moonGrad = ctx.createRadialGradient(mx, my, 4, mx, my, 70);
    moonGrad.addColorStop(0, 'rgba(255, 240, 220, 0.9)');
    moonGrad.addColorStop(0.4, 'rgba(255, 220, 180, 0.4)');
    moonGrad.addColorStop(1, 'rgba(255, 220, 180, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath(); ctx.arc(mx, my, 70, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff5e0';
    ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();

    // distant mountains (pixel-style)
    ctx.fillStyle = '#1a0f1a';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.7);
    for (let i = 0; i <= 12; i++) {
      const x = (W / 12) * i;
      const y = H * (0.6 + Math.sin(i * 1.3) * 0.06);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#241624';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.82);
    for (let i = 0; i <= 8; i++) {
      const x = (W / 8) * i;
      const y = H * (0.78 + Math.sin(i * 0.7 + Game.bgPhase) * 0.04);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fill();

    // ground line
    ctx.fillStyle = '#0a050a';
    ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = 'rgba(244, 138, 169, 0.16)';
    ctx.fillRect(0, H - 40, W, 2);
  }

  // ── Bind input + UI ──
  if (gameCanvas && gameCtx) {
    gameInit();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', () => {
      if (gameOverlay && gameOverlay.classList.contains('is-open')) sizeGameCanvas();
    });
    if (gameStartBtn)   gameStartBtn.addEventListener('click', startRound);
    if (gameRestartBtn) gameRestartBtn.addEventListener('click', startRound);
    if (gameQuitBtn)    gameQuitBtn.addEventListener('click', closeGame);
    if (gameExitBtn)    gameExitBtn.addEventListener('click', closeGame);

    // Touch buttons → simulated key state
    document.querySelectorAll('.g-touch').forEach(btn => {
      const key = btn.dataset.key;
      const press = (e) => {
        e.preventDefault();
        btn.classList.add('is-pressed');
        Game.keys[key] = true;
        if (key === ' ') triggerAttack();
      };
      const release = () => {
        btn.classList.remove('is-pressed');
        Game.keys[key] = false;
      };
      btn.addEventListener('touchstart', press,   { passive: false });
      btn.addEventListener('touchend',   release, { passive: true  });
      btn.addEventListener('touchcancel',release, { passive: true  });
      btn.addEventListener('mousedown',  press);
      btn.addEventListener('mouseup',    release);
      btn.addEventListener('mouseleave', release);
    });

    // Click on samurai sprite in the world → open game
    if (samuraiCanvas) {
      samuraiCanvas.addEventListener('click',  openGame);
      samuraiCanvas.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGame(); }
      });
    }
  }

  /* ────────────────────────────────────────────────
     13. Consent modal (first-visit)
     ──────────────────────────────────────────────── */
  const consentModal = $('#consent-modal');
  const consentCheck = $('#consent-check');
  const consentBtn   = $('#consent-btn');
  const consentHint  = $('#consent-hint');

  function showConsent() {
    consentModal.classList.add('is-open');
    consentModal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  }
  function closeConsent() {
    consentModal.classList.remove('is-open');
    consentModal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  }
  consentCheck.addEventListener('change', () => {
    consentBtn.disabled = !consentCheck.checked;
    if (consentCheck.checked) consentHint.classList.remove('show');
  });
  consentBtn.addEventListener('click', () => {
    if (!consentCheck.checked) { consentHint.classList.add('show'); return; }
    localStorage.setItem('hope-consent', '1');
    closeConsent();
    toast('success', 'Welcome', 'Glad to have you here.');
    // greet via chatbot after delay
    setTimeout(() => greet(), 5000);
  });
  // If the user clicks the button without checking, animate the hint
  consentBtn.addEventListener('mouseenter', () => { if (!consentCheck.checked) consentHint.classList.add('show'); });

  if (!localStorage.getItem('hope-consent')) showConsent();
  else setTimeout(() => greet(), 5000);

  /* ────────────────────────────────────────────────
     14. Smart Chatbot assistant
     - context-aware (knows which tool is open)
     - session memory (last tool + greeted flag)
     - offline detection
     - quote integration ("motivate me")
     - file/format help
     - quick-action chips that change with context
     - tightly scoped fallback (won't drift off-topic)
     ──────────────────────────────────────────────── */
  const chatFab    = $('#chat-fab');
  const chatWin    = $('#chat-window');
  const chatClose  = $('#chat-close');
  const chatBody   = $('#chat-body');
  const chatForm   = $('#chat-form');
  const chatInput  = $('#chat-input');
  const chatGreet  = $('#chat-greet');
  const chatQuick  = $('#chat-quick');
  let   chatOpened = false;

  // Current tool context — written by openTool / closeTool below
  function getCurrentToolName() {
    return (typeof currentTool !== 'undefined' && currentTool && currentTool.name) || null;
  }
  function rememberLastTool(name) {
    try { if (name) localStorage.setItem('hope-last-tool', name); } catch {}
  }
  function recallLastTool() {
    try { return localStorage.getItem('hope-last-tool') || null; } catch { return null; }
  }
  // Hook into openTool to track usage (idempotent monkey-patch)
  if (!window.__chatOpenToolHooked) {
    window.__chatOpenToolHooked = true;
    const _origOpen = openTool;
    openTool = function (name) { rememberLastTool(name); return _origOpen(name); };
    window.HopeWS.open = openTool;
  }

  // ── Tool catalog used for guidance + suggestions ──
  const TOOL_INFO = {
    merge:        { label: 'Merge PDF',        steps: ['Open Merge PDF', 'Drop in 2 or more PDFs', 'Drag the cards to set the order', 'Click "Merge PDFs"'] },
    split:        { label: 'Split PDF',        steps: ['Open Split PDF', 'Drop one PDF', 'Pick "Custom ranges" or "One PDF per page"', 'Click "Split PDF"'] },
    compress:     { label: 'Compress PDF',     steps: ['Open Compress PDF', 'Drop your PDF', 'Pick a level (Recommended is the safe default)', 'Click "Compress PDF"'] },
    rotate:       { label: 'Rotate PDF',       steps: ['Open Rotate PDF', 'Drop your PDF', 'Choose angle and which pages (or "all")', 'Click "Rotate PDF"'] },
    watermark:    { label: 'Watermark',        steps: ['Open Watermark', 'Drop your PDF', 'Type the watermark text and tweak opacity/position', 'Click "Add Watermark"'] },
    'page-numbers':{label: 'Page Numbers',     steps: ['Open Page Numbers', 'Drop your PDF', 'Pick position and starting number', 'Click "Add page numbers"'] },
    'remove-pages':{label: 'Remove Pages',     steps: ['Open Remove Pages', 'Drop your PDF', 'List which pages to remove (e.g. "2, 5-7")', 'Click "Remove pages"'] },
    'extract-pages':{label:'Extract Pages',    steps: ['Open Extract Pages', 'Drop your PDF', 'List pages to keep (e.g. "1-3, 7")', 'Click "Extract"'] },
    crop:         { label: 'Crop PDF',         steps: ['Open Crop PDF', 'Drop your PDF', 'Set top/right/bottom/left margins (in points)', 'Click "Crop PDF"'] },
    pdf2word:     { label: 'PDF → Word',       steps: ['Open PDF to Word', 'Drop a text-based PDF', 'Click "Convert to Word"'] },
    word2pdf:     { label: 'Word → PDF',       steps: ['Open Word to PDF', 'Drop a .doc / .docx', 'Click "Convert to PDF"'] },
    jpg2pdf:      { label: 'JPG → PDF',        steps: ['Open JPG to PDF', 'Drop your JPG/PNG images', 'Drag to set the order', 'Click "Create PDF"'] },
    pdf2jpg:      { label: 'PDF → JPG',        steps: ['Open PDF to JPG', 'Drop your PDF', 'Pick scale and quality', 'Click "Convert to JPG"'] },
    protect:      { label: 'Protect PDF',      steps: ['Open Protect PDF', 'Drop your PDF', 'Choose a strong password (and confirm)', 'Click "Protect"'] },
    unlock:       { label: 'Unlock PDF',       steps: ['Open Unlock PDF', 'Drop your PDF', 'Enter the password you have', 'Click "Unlock"'] },
  };

  // ── Intent system ──
  // Each intent: keys (substring match), and a reply(ctx) → { text, actions }
  // ctx = { currentTool, lastTool, online }
  const intents = [
    // motivation → trigger quote popup directly
    { keys: ['motivate','motivation','quote','inspire','encourage'], reply: () => {
        showQuote();
        return { text: 'Here\'s one for you 🌸' };
      } },

    // privacy / data
    { keys: ['privacy','safe','upload','server','data','share my file'], reply: () => ({
        text: 'Your files never leave your browser — H🌸PE PDF processes everything locally in memory. Nothing is uploaded to any server.' }) },

    // file size / limits
    { keys: ['size','limit','huge','too big','too large','large file'], reply: () => ({
        text: 'There\'s no hard limit, but very large files (over ~200MB) may slow down older devices. Try splitting a big PDF first if it stalls.' }) },

    // speed
    { keys: ['slow','fast','speed','taking long'], reply: () => ({
        text: 'Most operations finish in seconds. Long PDFs and image-heavy merges can take a moment because everything runs locally.' }) },

    // formats / wrong file
    { keys: ['format','wrong file','invalid','unsupported','what files'], reply: () => ({
        text: 'Each tool accepts a specific format:<br>• PDF tools → <code>.pdf</code><br>• Word → <code>.doc</code> / <code>.docx</code><br>• Images → <code>.jpg</code> / <code>.png</code><br>• Excel → <code>.xls</code> / <code>.xlsx</code><br>If a file is rejected, the dropzone briefly turns red.' }) },

    // errors / not working
    { keys: ['error','not work','not working','broken','fail','failed','cannot','can\'t','wont','won\'t','stuck','glitch'], reply: ctx => {
        const tool = ctx.currentTool;
        if (tool && TOOL_INFO[tool]) {
          return {
            text: `Sorry that happened in <strong>${TOOL_INFO[tool].label}</strong>. Try: (1) reload the page, (2) re-add the file, (3) check the file format matches this tool. If a small test file works, the original may be too large or password-protected.`,
            actions: [{ label: 'Re-open ' + TOOL_INFO[tool].label, tool }]
          };
        }
        return { text: 'Sorry that happened. Try: (1) reload the page, (2) re-upload the file, (3) confirm the format matches the tool you opened. If it persists, try a smaller copy first.' };
      } },

    // file not uploading
    { keys: ['upload','not uploading','can\'t upload','dropzone','drop zone'], reply: () => ({
        text: 'If a file won\'t upload: check the format matches the tool, the file isn\'t password-protected, and your browser allows file access. Try clicking the dropzone instead of dragging.' }) },

    // OCR
    { keys: ['ocr','scanned','scan','image-only','recognise','recognize'], reply: () => ({
        text: 'OCR is on our roadmap and shows a "Coming soon" message today. For now, run scanned PDFs through a desktop OCR tool, then come back to use the editing flow.' }) },

    // game / samurai (friendly redirect — game isn't in this build)
    { keys: ['game','play','samurai','mini game','fun'], reply: () => ({
        text: 'A samurai mini-game is on the wishlist. For now, try clicking a butterfly — you\'ll get a quote from someone admired in history.' }) },

    // greetings
    { keys: ['hello','hi ','hey','hola','good morning','good evening','namaste'], reply: () => ({
        text: 'Hi 🌸 — what would you like to do with a PDF today?' }) },

    // thanks
    { keys: ['thanks','thank you','arigato','merci','gracias'], reply: () => ({
        text: 'Anytime — I\'m here whenever you need.' }) },

    // identity
    { keys: ['who are you','what are you','your name','about you'], reply: () => ({
        text: 'I\'m the H🌸PE Assistant — a focused helper for this PDF toolkit. I can guide you through any tool, explain formats, or surface a quick action for you.' }) },

    // tool-specific (ordered roughly most-asked first)
    { keys: ['merge','combine','join'],                                                     reply: () => toolReply('merge') },
    { keys: ['split','separate'],                                                            reply: () => toolReply('split') },
    { keys: ['extract page','extract pages'],                                                reply: () => toolReply('extract-pages') },
    { keys: ['remove page','delete page'],                                                   reply: () => toolReply('remove-pages') },
    { keys: ['compress','shrink','smaller','reduce'],                                        reply: () => toolReply('compress') },
    { keys: ['rotate'],                                                                      reply: () => toolReply('rotate') },
    { keys: ['watermark','stamp'],                                                           reply: () => toolReply('watermark') },
    { keys: ['page number','page numbers','numbering'],                                      reply: () => toolReply('page-numbers') },
    { keys: ['crop','trim'],                                                                 reply: () => toolReply('crop') },
    { keys: ['pdf to word','to docx','word doc'],                                            reply: () => toolReply('pdf2word') },
    { keys: ['word to pdf','docx to pdf','doc to pdf'],                                      reply: () => toolReply('word2pdf') },
    { keys: ['jpg to pdf','image to pdf','png to pdf','picture'],                            reply: () => toolReply('jpg2pdf') },
    { keys: ['pdf to jpg','convert to image','pdf to image'],                                reply: () => toolReply('pdf2jpg') },
    { keys: ['protect','password','encrypt','secure'],                                       reply: () => toolReply('protect') },
    { keys: ['unlock','remove password','decrypt'],                                          reply: () => toolReply('unlock') },
  ];

  function toolReply(toolKey) {
    const info = TOOL_INFO[toolKey];
    if (!info) return { text: 'That tool is part of H🌸PE PDF — try the All Tools menu.' };
    const list = info.steps.map((s, i) => `${i + 1}. ${escapeHtml(s)}`).join('<br>');
    return {
      text: `<strong>${escapeHtml(info.label)}</strong><br>${list}<br><br>Want me to open it for you?`,
      actions: [{ label: 'Open ' + info.label, tool: toolKey }],
    };
  }

  function quickChips() {
    const tool = getCurrentToolName();
    const last = recallLastTool();
    if (tool && TOOL_INFO[tool]) {
      // contextual chips while a tool is open
      return [
        { label: 'How do I use this?', q: tool.replace('-', ' ') },
        { label: 'It\'s not working',  q: 'error in ' + tool },
        { label: 'Privacy?',           q: 'privacy' },
      ];
    }
    if (last && TOOL_INFO[last]) {
      return [
        { label: 'Re-open ' + TOOL_INFO[last].label, tool: last },
        { label: 'Merge PDF',    q: 'merge' },
        { label: 'Compress PDF', q: 'compress' },
      ];
    }
    return [
      { label: 'Merge PDF',    q: 'merge' },
      { label: 'Split PDF',    q: 'split' },
      { label: 'Compress PDF', q: 'compress' },
      { label: 'PDF → Word',   q: 'pdf to word' },
    ];
  }

  function openChat() {
    chatWin.classList.add('is-open');
    chatWin.setAttribute('aria-hidden','false');
    chatGreet.classList.remove('show');
    if (!chatOpened) {
      chatOpened = true;
      try { sessionStorage.setItem('hope-greeted', '1'); } catch {}
      const tool = getCurrentToolName();
      const last = recallLastTool();
      const online = navigator.onLine !== false;
      let greeting = "Hi 🌸 I\'m your H🌸PE assistant. Need help with PDFs or tools?";
      if (tool && TOOL_INFO[tool]) {
        greeting = `Hi 🌸 you have <strong>${TOOL_INFO[tool].label}</strong> open. Want me to walk you through it?`;
      } else if (last && TOOL_INFO[last]) {
        greeting = `Welcome back 🌸 last time you used <strong>${TOOL_INFO[last].label}</strong>. Pick up where you left off?`;
      }
      if (!online) {
        greeting += '<br><em>You\'re offline — every tool still runs locally, so most things keep working.</em>';
      }
      addBot(greeting, quickChips());
    } else {
      // refresh chips with current context each time the chat is reopened
      renderChips();
    }
    setTimeout(() => chatInput.focus(), 200);
  }
  function closeChat() { chatWin.classList.remove('is-open'); chatWin.setAttribute('aria-hidden','true'); }
  chatFab.addEventListener('click', () => chatWin.classList.contains('is-open') ? closeChat() : openChat());
  chatClose.addEventListener('click', closeChat);
  document.addEventListener('click', (e) => {
    if (!chatWin.classList.contains('is-open')) return;
    if (chatWin.contains(e.target) || chatFab.contains(e.target)) return;
    closeChat();
  });

  function greet() {
    if (chatOpened || chatWin.classList.contains('is-open')) return;
    // only show the bubble once per session (non-intrusive)
    try { if (sessionStorage.getItem('hope-greeted')) return; } catch {}
    chatGreet.classList.add('show');
    setTimeout(() => chatGreet.classList.remove('show'), 8000);
  }
  chatGreet.addEventListener('click', () => { chatGreet.classList.remove('show'); openChat(); });

  function addUser(text) {
    const el = document.createElement('div');
    el.className = 'chat-msg user';
    el.textContent = text;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  function addBot(html, actions) {
    const el = document.createElement('div');
    el.className = 'chat-msg bot';
    el.innerHTML = html;
    if (actions?.length) {
      const wrap = document.createElement('div');
      wrap.className = 'chat-actions';
      actions.forEach(a => {
        const b = document.createElement('button');
        b.className = 'chat-action-btn';
        b.textContent = a.label;
        b.addEventListener('click', () => {
          if (a.tool) openTool(a.tool);
          else if (a.q) handleQuery(a.q);
        });
        wrap.appendChild(b);
      });
      el.appendChild(wrap);
    }
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  function addTyping() {
    const el = document.createElement('div');
    el.className = 'chat-typing';
    el.innerHTML = '<span></span><span></span><span></span>';
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
    return el;
  }

  function renderChips() {
    if (!chatQuick) return;
    const chips = quickChips();
    chatQuick.innerHTML = '';
    chips.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-quick-btn';
      b.textContent = c.label;
      if (c.tool) b.dataset.tool = c.tool;
      else if (c.q) b.dataset.q = c.q;
      chatQuick.appendChild(b);
    });
  }
  renderChips();

  function handleQuery(text) {
    const q = text.toLowerCase();
    addUser(text);
    const typing = addTyping();
    const ctx = {
      currentTool: getCurrentToolName(),
      lastTool: recallLastTool(),
      online: navigator.onLine !== false,
    };
    setTimeout(() => {
      typing.remove();
      // offline-specific guard for online-only intents (none here, but ready for future)
      const hit = intents.find(i => i.keys.some(k => q.includes(k)));
      if (hit) {
        const r = hit.reply(ctx);
        addBot(r.text, r.actions);
      } else if (ctx.currentTool && TOOL_INFO[ctx.currentTool]) {
        // Context-aware fallback when a tool is open
        const t = TOOL_INFO[ctx.currentTool];
        addBot(`I\'m focused on <strong>${escapeHtml(t.label)}</strong> right now. Here\'s the quick flow:<br>${t.steps.map((s, i) => `${i + 1}. ${escapeHtml(s)}`).join('<br>')}`,
          [{ label: 'Got it', q: 'thanks' }, { label: 'Privacy?', q: 'privacy' }]);
      } else {
        addBot("I\'m here to help with PDF tools. Try asking about <em>merging</em>, <em>splitting</em>, <em>compressing</em>, or <em>converting</em> files — or describe an error you\'re seeing.",
          quickChips());
      }
      // refresh chips after each turn so they track context
      renderChips();
    }, 600 + Math.random()*450);
  }

  chatForm.addEventListener('submit', e => {
    e.preventDefault();
    const v = chatInput.value.trim();
    if (!v) return;
    chatInput.value = '';
    handleQuery(v);
  });
  chatQuick.addEventListener('click', e => {
    const b = e.target.closest('button[data-q], button[data-tool]');
    if (!b) return;
    if (b.dataset.tool) { openTool(b.dataset.tool); return; }
    if (b.dataset.q) handleQuery(b.dataset.q);
  });

  // Online/offline awareness — one-shot toast when status changes during the session.
  window.addEventListener('offline', () => {
    if (!chatWin.classList.contains('is-open')) return;
    addBot("You\'re offline — but every tool here runs locally in your browser, so most things still work fine.");
  });
  window.addEventListener('online', () => {
    if (!chatWin.classList.contains('is-open')) return;
    addBot('Back online 🌸');
  });

  // initial render of grid (after tools register on next tick)
  setTimeout(() => ToolGrid.render('all'), 0);
})();
