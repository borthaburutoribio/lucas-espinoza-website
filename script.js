/* Lucas Espinoza · Maestro de Armas */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- Entradas por sección (escalonadas) ---- */
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const siblings = [...e.target.parentElement.querySelectorAll(':scope > .reveal')];
        const i = Math.max(0, siblings.indexOf(e.target));
        e.target.style.transitionDelay = (i * 80) + 'ms';
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  /* ---- La barra toma la tinta del capítulo que tiene abajo ---- */
  const bar = document.querySelector('.bar');
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  const hero = document.querySelector('.hero');
  const sticky = document.querySelector('.sticky-cta');
  const paintBar = () => {
    const y = bar.offsetHeight / 2;
    let ink = 'dark';
    for (const c of chapters) {
      const r = c.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) {
        if (c === hero) {
          // en el hero, la costura entre los dos campos
          const seam = document.querySelector('.hero-navy').getBoundingClientRect().top;
          ink = seam <= y ? 'light' : 'dark';
        } else {
          ink = c.dataset.chapter === 'dark' ? 'light' : 'dark';
        }
        break;
      }
    }
    bar.dataset.ink = ink;
    // el botón fijo aparece cuando la persona vuelve hacia arriba (no tapa lo que está leyendo)
    const goingUp = scrollY < lastY - 4;
    if (Math.abs(scrollY - lastY) > 4) lastY = scrollY;
    if (sticky) sticky.classList.toggle('show', goingUp && hero.getBoundingClientRect().bottom < 0 && !nearEnd());
  };
  let lastY = scrollY;
  const nearEnd = () => document.querySelector('.contact').getBoundingClientRect().top < innerHeight;
  addEventListener('scroll', paintBar, { passive: true });
  addEventListener('resize', paintBar);
  paintBar();

  /* ---- Menú del celular ---- */
  const menuBtn = document.querySelector('.menu-word');
  const menu = document.getElementById('menu');
  menuBtn.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open);
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) { menu.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.focus(); }
  });

  /* ---- Tocá al tirador ---- */
  const WEAPONS = {
    florete: {
      valid: ['tronco', 'babero'],
      offTarget: 'white',
      facts: {
        blanco: 'El tronco, de la cintura al cuello, pecho y espalda. También el babero de la careta.',
        toca: 'La punta.',
        prioridad: 'Sí: el que arranca el ataque tiene la derecha.',
        peso: 'Hasta 90 cm de hoja, menos de 500 g en total.'
      }
    },
    espada: {
      valid: ['cabeza', 'babero', 'tronco', 'brazos', 'mano', 'piernas'],
      offTarget: null,
      facts: {
        blanco: 'Todo el cuerpo, de la careta a la punta del pie.',
        toca: 'La punta.',
        prioridad: 'No: si tocan los dos a la vez, se marca doble.',
        peso: 'Hasta 90 cm de hoja, hasta 770 g: la más pesada de las tres.'
      }
    },
    sable: {
      valid: ['cabeza', 'babero', 'tronco', 'brazos'],
      offTarget: 'none',
      facts: {
        blanco: 'De la cintura para arriba: careta, tronco y brazos. Las manos no.',
        toca: 'La punta y el filo: se tira de corte.',
        prioridad: 'Sí, como en florete. Y es la más rápida de las tres.',
        peso: 'Hasta 88 cm de hoja, menos de 500 g.'
      }
    }
  };
  const ZONE_NAME = { cabeza: 'la careta', babero: 'el babero', tronco: 'el tronco', brazos: 'el brazo', mano: 'la mano', piernas: 'la pierna' };

  const stage = document.querySelector('.fencer');
  if (stage) {
    const zones = [...stage.querySelectorAll('.zone')];
    const lamp = document.querySelector('[data-lamp]');
    const score = document.querySelector('[data-score]');
    const facts = document.querySelector('.weapon-facts');
    const picks = [...document.querySelectorAll('[data-weapon]')];
    let weapon = 'florete';
    let timer;

    const paintValid = () => zones.forEach((z) => z.classList.toggle('valid', WEAPONS[weapon].valid.includes(z.dataset.zone)));
    const setLamp = (state) => {
      lamp.dataset.lamp = state;
      lamp.classList.remove('flash'); void lamp.offsetWidth;
      if (state !== 'off' && !reduce) lamp.classList.add('flash');
    };

    const choose = (w) => {
      weapon = w;
      picks.forEach((b) => b.setAttribute('aria-checked', b.dataset.weapon === w));
      facts.classList.add('swap');
      setTimeout(() => {
        Object.entries(WEAPONS[w].facts).forEach(([k, v]) => { facts.querySelector(`[data-fact="${k}"]`).textContent = v; });
        facts.classList.remove('swap');
      }, reduce ? 0 : 220);
      paintValid();
      setLamp('off');
      zones.forEach((z) => z.classList.remove('hit'));
      score.textContent = 'Con ' + w + ', tocá una parte del cuerpo';
    };

    const hit = (zone) => {
      const W = WEAPONS[weapon];
      const name = ZONE_NAME[zone.dataset.zone];
      zones.forEach((z) => z.classList.remove('hit'));
      clearTimeout(timer);
      if (W.valid.includes(zone.dataset.zone)) {
        zone.classList.add('hit');
        setLamp('red');
        score.textContent = '¡Tocado! En ' + weapon + ', ' + name + ' vale.';
      } else if (W.offTarget === 'white') {
        setLamp('white');
        score.textContent = 'Luz blanca: ' + name + ' no es blanco en florete. Se frena el asalto, sin punto.';
      } else {
        setLamp('off');
        score.textContent = 'Sin luz: en sable, ' + name + ' no cuenta y el aparato ni lo marca.';
      }
      timer = setTimeout(() => zones.forEach((z) => z.classList.remove('hit')), 1600);
    };

    picks.forEach((b) => b.addEventListener('click', () => choose(b.dataset.weapon)));
    // flechas para el grupo de radios
    document.querySelector('.weapon-pick').addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
      const i = picks.findIndex((b) => b.dataset.weapon === weapon);
      const n = picks[(i + (e.key === 'ArrowRight' ? 1 : picks.length - 1)) % picks.length];
      choose(n.dataset.weapon); n.focus(); e.preventDefault();
    });
    zones.forEach((z) => {
      z.addEventListener('click', () => hit(z));
      z.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hit(z); } });
    });
    paintValid();
  }

  /* ---- Recorrido: un nombre encendido por vez ---- */
  const names = [...document.querySelectorAll('.names .n')];
  if (names.length) {
    let i = 0;
    names[0].classList.add('lit');
    if (!reduce) setInterval(() => {
      names[i].classList.remove('lit');
      i = (i + 1) % names.length;
      names[i].classList.add('lit');
    }, 2000);
    else names.forEach((n) => n.classList.add('lit'));
  }

  /* ---- Videos del inicio: botón de pausa y sin gastar datos fuera de pantalla ---- */
  const vids = [...document.querySelectorAll('.hero video')];
  const vt = document.querySelector('[data-video-toggle]');
  let userPaused = false;
  const playAll = () => vids.forEach((v) => { const p = v.play(); if (p) p.catch(() => {}); });
  if (vt) vt.addEventListener('click', () => {
    userPaused = !userPaused;
    if (userPaused) vids.forEach((v) => v.pause()); else playAll();
    vt.textContent = userPaused ? 'Reproducir video' : 'Pausar video';
    vt.setAttribute('aria-pressed', userPaused);
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      if (userPaused) return;
      if (e.isIntersecting) playAll(); else vids.forEach((v) => v.pause());
    }).observe(hero);
  }

  /* ---- Compartir ---- */
  const share = document.querySelector('[data-share]');
  if (share) share.addEventListener('click', async () => {
    const data = { title: document.title, url: location.href.split('#')[0] };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(data.url); share.textContent = 'Link copiado'; }
    } catch (_) { /* cancelado */ }
  });
})();
