/* ========== hue control (persists) ========== */
(function() {
  const root = document.documentElement;
  const KEY = 'poc-hue';
  const stored = localStorage.getItem(KEY);
  if (stored !== null) root.style.setProperty('--hue', stored);
  const slider = document.getElementById('hue-slider');
  const label = document.getElementById('hue-value');
  if (!slider) return;
  slider.value = stored !== null ? stored : getComputedStyle(root).getPropertyValue('--hue').trim() || 35;
  if (label) label.textContent = slider.value + '°';
  slider.addEventListener('input', () => {
    root.style.setProperty('--hue', slider.value);
    if (label) label.textContent = slider.value + '°';
    localStorage.setItem(KEY, slider.value);
  });
})();

/* ========== copy-to-clipboard buttons (e.g. GPG fingerprint) ========== */
document.querySelectorAll('button.copy[data-copy]').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    const target = document.getElementById(btn.dataset.copy);
    if (!target) return;
    const text = target.textContent.trim().replace(/\s+/g, ' ');
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'copied';
      btn.classList.add('ok');
      setTimeout(() => { btn.textContent = original; btn.classList.remove('ok'); }, 1500);
    } catch {
      btn.textContent = 'select & copy';
    }
  });
});

/* ========== status bar clock + uptime ========== */
(function() {
  const clock = document.getElementById('sb-clock');
  if (!clock) return;
  function tick() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    clock.textContent = `${hh}:${mm}:${ss}`;
  }
  tick(); setInterval(tick, 1000);
})();

/* ========== asciinema-style cast player ========== */
(function() {
  const cast = document.getElementById('cast');
  if (!cast) return;
  const body = cast.querySelector('.cast-body');
  const btnReplay = cast.querySelector('[data-act="replay"]');
  const btnPause = cast.querySelector('[data-act="pause"]');

  // Each step is either a typed command or rendered output.
  // {type:'type', text, pause} types char-by-char (delay = pause ms between chars)
  // {type:'out',  text, pause} appears instantly then waits pause ms
  // {type:'wait', pause} just waits
  const SCRIPT = [
    { type: 'out',  text: '<span class="com"># welcome — this terminal is a recording, not a shell</span>\n' },
    { type: 'wait', pause: 400 },
    { type: 'type', text: '<span class="prompt">polyedre@home</span>:<span class="com">~</span>$ guix shell -- emacs', pause: 28 },
    { type: 'wait', pause: 450 },
    { type: 'out',  text: '\n<span class="com">; building dependency graph…</span>\n<span class="ok">✓ 142 packages resolved</span>  <span class="com">(cache hit)</span>\n', pause: 350 },
    { type: 'type', text: '<span class="prompt">polyedre@home</span>:<span class="com">~</span>$ emacs -nw posts/tramp.md', pause: 26 },
    { type: 'wait', pause: 400 },
    { type: 'out',  text: '\n<span class="warn">[ buffer opened · 1842 lines · org-mode ]</span>\n', pause: 600 },
    { type: 'type', text: '<span class="prompt">polyedre@home</span>:<span class="com">~</span>$ make build && rsync site/ pages:', pause: 24 },
    { type: 'wait', pause: 450 },
    { type: 'out',  text: '\n<span class="com">→ guile build.scm</span>\n  rendered 11 posts in <span class="ok">312ms</span>\n  wrote /site (47 files, 184 KB)\n<span class="com">→ rsync</span>\n  <span class="ok">deployed</span> · build #214\n', pause: 400 },
    { type: 'wait', pause: 700 },
    { type: 'out',  text: '<span class="com"># end of recording — looping…</span>\n', pause: 1500 },
  ];

  let i = 0, charIdx = 0, paused = false, currentTimer = null, currentText = '';

  function clear() {
    body.innerHTML = '';
    i = 0; charIdx = 0; currentText = '';
  }
  function appendHTML(html) {
    body.innerHTML += html;
    cast.scrollTop = cast.scrollHeight;
  }
  function setCursor() {
    // remove existing cursor
    const cur = body.querySelector('.cursor');
    if (cur) cur.remove();
    const span = document.createElement('span');
    span.className = 'cursor';
    body.appendChild(span);
  }
  function removeCursor() {
    const cur = body.querySelector('.cursor');
    if (cur) cur.remove();
  }
  function step() {
    if (paused) return;
    if (i >= SCRIPT.length) {
      // loop
      setTimeout(() => { clear(); step(); }, 600);
      return;
    }
    const s = SCRIPT[i];
    if (s.type === 'wait') {
      currentTimer = setTimeout(() => { i++; step(); }, s.pause);
      return;
    }
    if (s.type === 'out') {
      removeCursor();
      appendHTML(s.text);
      setCursor();
      currentTimer = setTimeout(() => { i++; step(); }, s.pause || 100);
      return;
    }
    if (s.type === 'type') {
      // type char by char — but s.text may contain HTML tags. Walk through, emit
      // tag-runs whole, then characters one at a time.
      typeHTML(s.text, s.pause || 30, () => { i++; step(); });
    }
  }
  function typeHTML(html, perChar, done) {
    removeCursor();
    let pos = 0;
    let acc = '';
    function next() {
      if (paused) { return; }
      if (pos >= html.length) {
        appendHTML(acc + '\n');
        setCursor();
        currentTimer = setTimeout(done, 120);
        return;
      }
      if (html[pos] === '<') {
        const close = html.indexOf('>', pos);
        acc += html.substring(pos, close + 1);
        pos = close + 1;
        // re-render once we have an updated chunk to keep the cursor visible
        renderTyping();
        currentTimer = setTimeout(next, 0);
        return;
      }
      acc += html[pos++];
      renderTyping();
      currentTimer = setTimeout(next, perChar);
    }
    function renderTyping() {
      // Replace the last "line in progress" — simpler: rebuild body from frozen + acc
      body.innerHTML = frozenHTML + acc + '<span class="cursor"></span>';
      cast.scrollTop = cast.scrollHeight;
    }
    const frozenHTML = body.innerHTML.replace(/<span class="cursor"><\/span>$/, '');
    next();
  }

  if (btnReplay) btnReplay.addEventListener('click', () => {
    clearTimeout(currentTimer); paused = false;
    if (btnPause) btnPause.textContent = '⏸ pause';
    clear(); step();
  });
  if (btnPause) btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '▶ resume' : '⏸ pause';
    if (!paused) step();
  });

  // Start when scrolled into view (or immediately on small pages)
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting && i === 0) { step(); io.disconnect(); }
    });
  }, { threshold: 0.2 });
  io.observe(cast);
})();
