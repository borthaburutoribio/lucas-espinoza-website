/* Área de alumnos · Lucas Espinoza
   Cada ficha está cifrada con la clave del alumno (ver _build/alumnos.mjs).
   El navegador baja el archivo y lo abre con la clave: si no coincide, no hay nada que leer. */
(() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const $ = (s, r = document) => r.querySelector(s);
  const views = { login: $('[data-view="login"]'), dash: $('[data-view="dash"]') };
  const SESSION = 'lefc:sesion';
  const DEMO = { usuario: 'prueba', clave: 'en-garde-2026' }; // ficha de ejemplo, pública a propósito
  const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };

  async function fileId(usuario) {
    const h = await crypto.subtle.digest('SHA-256', enc.encode('lefc:' + usuario.trim().toLowerCase()));
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
  }

  async function open(usuario, clave) {
    const id = await fileId(usuario);
    const res = await fetch('data/' + id + '.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('nope');
    const box = await res.json();
    const base = await crypto.subtle.importKey('raw', enc.encode(clave), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(box.salt), iterations: box.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return { id, data: JSON.parse(dec.decode(plain)) };
  }

  /* ---------- Ingreso ---------- */
  const form = $('.login-form');
  const err = $('.login-error');
  const go = $('.login-go');
  const passToggle = $('.pass-toggle');

  passToggle.addEventListener('click', () => {
    const inp = $('#c');
    const show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    passToggle.textContent = show ? 'Ocultar' : 'Ver';
    passToggle.setAttribute('aria-pressed', show);
    passToggle.setAttribute('aria-label', show ? 'Ocultar clave' : 'Mostrar clave');
  });

  async function login(usuario, clave) {
    err.hidden = true;
    if (!usuario.trim() || !clave) { err.textContent = 'Completá usuario y clave.'; err.hidden = false; return; }
    go.disabled = true; go.textContent = 'Abriendo tu ficha…';
    try {
      const s = await open(usuario, clave);
      try { sessionStorage.setItem(SESSION, JSON.stringify(s)); } catch (_) {}
      show(s);
    } catch (_) {
      err.textContent = 'Usuario o clave incorrectos. Revisalos o pedíselos a Lucas.';
      err.hidden = false;
      $('#c').select();
    } finally {
      go.disabled = false; go.textContent = 'Entrar';
    }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); login($('#u').value, $('#c').value); });
  $('[data-demo]').addEventListener('click', () => { $('#u').value = DEMO.usuario; $('#c').value = DEMO.clave; login(DEMO.usuario, DEMO.clave); });
  $('[data-logout]').addEventListener('click', () => {
    try { sessionStorage.removeItem(SESSION); } catch (_) {}
    stopTimer(); location.reload();
  });

  /* ---------- Panel ---------- */
  const fmtDate = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

  function show({ id, data }) {
    views.login.hidden = true;
    views.dash.hidden = false;
    $('[data-logout]').hidden = false;
    document.title = 'Ficha de ' + data.nombre + ' · Área de alumnos';
    $('[data-hello]').textContent = 'Hola, ' + data.nombre.split(' ')[0];
    $('[data-meta]').textContent = [data.arma, data.nivel, data.sala, 'actualizada el ' + fmtDate(data.actualizado)].filter(Boolean).join(' · ');
    $('[data-sample]').hidden = !data.ejemplo;
    $('[data-message]').textContent = data.mensaje || 'Sin mensajes nuevos.';

    // Objetivos
    $('[data-goals]').innerHTML = (data.objetivos || []).map((o) => `<li class="${o.hecho ? 'done' : ''}"><span class="tick" aria-hidden="true"></span>${esc(o.texto)}<span class="sr-only">${o.hecho ? ' (cumplido)' : ''}</span></li>`).join('');
    // Notas
    $('[data-notes]').innerHTML = (data.notas || []).map((n) => `<li><b>${esc(fmtDate(n.fecha))}</b>${esc(n.texto)}</li>`).join('') || '<li>Todavía no hay notas.</li>';
    // Torneo
    if (data.torneo && data.torneo.fecha) {
      const days = Math.ceil((new Date(data.torneo.fecha + 'T09:00:00') - new Date()) / 864e5);
      if (days >= 0) {
        $('[data-meet]').hidden = false;
        $('[data-meet-days]').textContent = days === 0 ? 'Es hoy' : days === 1 ? 'Falta 1 día' : 'Faltan ' + days + ' días';
        $('[data-meet-name]').textContent = data.torneo.nombre + ', ' + fmtDate(data.torneo.fecha) + (data.torneo.lugar ? ' · ' + data.torneo.lugar : '');
      }
    }
    renderWeek(id, data);
    requestAnimationFrame(() => views.dash.classList.add('in'));
  }

  function renderWeek(id, data) {
    const key = 'lefc:' + id + ':' + data.actualizado;
    const done = store.get(key) || {};
    const days = data.semana || [];
    const tabs = $('[data-days]');
    const body = $('[data-day]');
    const todayName = new Date().toLocaleDateString('es-AR', { weekday: 'long' }).toLowerCase();
    let current = Math.max(0, days.findIndex((d) => d.dia.toLowerCase() === todayName));

    tabs.innerHTML = days.map((d, i) => `<button type="button" role="tab" id="tab-${i}" aria-controls="dia" data-i="${i}">${esc(d.dia)}</button>`).join('');
    body.id = 'dia';

    const progress = () => {
      const d = days[current];
      const all = d.bloques.flatMap((b, bi) => b.items.map((_, ii) => current + '-' + bi + '-' + ii));
      const n = all.filter((k) => done[k]).length;
      $('[data-progress-text]').textContent = n === all.length ? '¡Día completo! ' + n + ' de ' + all.length : n + ' de ' + all.length + ' hechos';
      $('[data-progress]').style.transform = 'scaleX(' + (all.length ? n / all.length : 0) + ')';
    };

    const paint = () => {
      [...tabs.children].forEach((b, i) => { b.setAttribute('aria-selected', i === current); b.tabIndex = i === current ? 0 : -1; });
      body.setAttribute('aria-labelledby', 'tab-' + current);
      const d = days[current];
      body.innerHTML = `<p class="day-focus">${esc(d.foco || '')}</p>` + d.bloques.map((b, bi) => `
        <div class="block">
          <h3>${esc(b.tipo)}</h3>
          <ul>${b.items.map((it, ii) => {
            const k = current + '-' + bi + '-' + ii;
            return `<li><label class="${done[k] ? 'done' : ''}"><input type="checkbox" data-k="${k}" ${done[k] ? 'checked' : ''}><span class="box" aria-hidden="true"></span><span class="it"><span class="it-name">${esc(it.nombre)}</span><span class="it-dose">${esc(it.dosis || '')}</span>${it.nota ? `<span class="it-note">${esc(it.nota)}</span>` : ''}</span></label></li>`;
          }).join('')}</ul>
        </div>`).join('');
      progress();
    };

    tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; current = +b.dataset.i; paint(); });
    tabs.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      current = (current + (e.key === 'ArrowRight' ? 1 : days.length - 1)) % days.length;
      paint(); tabs.children[current].focus(); e.preventDefault();
    });
    body.addEventListener('change', (e) => {
      const k = e.target.dataset.k; if (!k) return;
      if (e.target.checked) done[k] = 1; else delete done[k];
      e.target.closest('label').classList.toggle('done', e.target.checked);
      store.set(key, done);
      progress();
    });
    paint();
  }

  /* ---------- Cronómetro ---------- */
  const PRESETS = [
    { id: 'asalto', label: 'Asalto 3 min', rounds: 1, work: 180, rest: 0 },
    { id: 'pies', label: 'Pies 45/30 × 6', rounds: 6, work: 45, rest: 30 },
    { id: 'intervalos', label: 'Intervalos 30/30 × 8', rounds: 8, work: 30, rest: 30 }
  ];
  const clock = $('[data-clock]');
  const phase = $('[data-phase]');
  const startBtn = $('[data-start]');
  let preset = PRESETS[0], left, round, resting, tick = null, last, wake = null, audio;

  $('[data-presets]').innerHTML = PRESETS.map((p, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-p="${p.id}">${p.label}</button>`).join('');
  $('[data-presets]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    preset = PRESETS.find((p) => p.id === b.dataset.p);
    [...b.parentElement.children].forEach((x) => x.setAttribute('aria-checked', x === b));
    resetTimer();
  });

  const fmtClock = (s) => { const t = Math.ceil(s); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const paintClock = () => {
    clock.textContent = fmtClock(left);
    clock.classList.toggle('rest', resting);
    phase.textContent = preset.rounds > 1
      ? (resting ? 'Pausa' : 'Trabajo') + ' · ronda ' + round + ' de ' + preset.rounds
      : (left <= 0 ? '¡Halte!' : 'Asalto');
  };
  function beep(f = 880, d = 0.18) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audio.destination);
      g.gain.setValueAtTime(0.25, audio.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + d);
      o.start(); o.stop(audio.currentTime + d);
    } catch (_) {}
    if (navigator.vibrate) navigator.vibrate(120);
  }
  function resetTimer() { stopTimer(); left = preset.work; round = 1; resting = false; paintClock(); startBtn.textContent = 'Empezar'; }
  function stopTimer() {
    if (tick) clearInterval(tick); tick = null;
    if (wake) { wake.release().catch(() => {}); wake = null; }
  }
  function loop() {
    const t = performance.now();
    const dt = (t - last) / 1000; last = t;
    const before = Math.ceil(left);
    left -= dt;
    if (Math.ceil(left) !== before && left > 0 && left <= 3) beep(660, 0.08);
    if (left <= 0) {
      if (!resting && preset.rest && round <= preset.rounds) {
        if (round === preset.rounds) return finish();
        resting = true; left = preset.rest; beep(440, 0.3);
      } else if (resting) {
        resting = false; round++; left = preset.work; beep(990, 0.3);
      } else return finish();
    }
    paintClock();
  }
  function finish() { left = 0; paintClock(); stopTimer(); beep(990, 0.5); startBtn.textContent = 'Otra vez'; startBtn.dataset.done = '1'; }
  startBtn.addEventListener('click', async () => {
    if (startBtn.dataset.done) { delete startBtn.dataset.done; resetTimer(); }
    if (tick) { stopTimer(); startBtn.textContent = 'Seguir'; return; }
    beep(990, 0.12);
    last = performance.now(); tick = setInterval(loop, 200);
    startBtn.textContent = 'Pausa';
    try { if ('wakeLock' in navigator) wake = await navigator.wakeLock.request('screen'); } catch (_) {}
  });
  $('[data-reset]').addEventListener('click', resetTimer);
  resetTimer();

  /* ---------- Sesión abierta en esta pestaña ---------- */
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION));
    if (s && s.data) show(s);
  } catch (_) {}
  if (!crypto.subtle) { err.textContent = 'Este navegador no puede abrir fichas cifradas. Probá con Chrome o Safari actualizados.'; err.hidden = false; }
})();
