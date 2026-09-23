/**
 * Flappy Bird — Reborn
 * -------------------------------------------------------------------------
 * Perbaikan utama dari versi sebelumnya:
 *  1. Event listener keydown/keyup TIDAK lagi didaftarkan ulang setiap frame
 *     (bug lama menumpuk ribuan listener dalam beberapa detik -> game makin
 *     berat & suara jadi telat/ngelag). Sekarang listener didaftarkan sekali
 *     saja saat game dimuat.
 *  2. Efek suara memakai "AudioPool" (beberapa clone <audio> yang sudah
 *     di-preload) supaya bisa diputar berkali-kali secara instan tanpa
 *     delay maupun saling memotong satu sama lain.
 *  3. File audio dikompres jauh lebih kecil & diberi preload="auto" supaya
 *     browser sudah siap memutar begitu dibutuhkan (bukan baru mulai
 *     mendownload saat itu juga).
 *  4. Game loop memakai delta-time (bukan asumsi 60fps tetap) sehingga
 *     kecepatan gerak konsisten di layar refresh rate berapa pun.
 *  5. Restart tidak lagi window.location.reload() (yang bikin flicker/putih
 *     sesaat) — sekarang direset murni lewat state JavaScript.
 *  6. Skor dihitung dari status "sudah dilewati" tiap pasang pipa, bukan
 *     menebak posisi tiap frame — lebih akurat, tidak pernah dobel/skip.
 *  7. Tambahan: layar mulai/skor terbaik (localStorage), jeda, mute,
 *    dukungan sentuh/klik untuk mobile, rotasi burung, dan skala kesulitan.
 * -------------------------------------------------------------------------
 */

(() => {
  'use strict';

  /* ------------------------------ Elemen DOM ------------------------------ */
  const gameEl = document.getElementById('game');
  const birdEl = document.getElementById('bird');
  const pipesLayer = document.getElementById('pipes-layer');
  const scoreEl = document.getElementById('score');
  const bestValueEl = document.getElementById('best-value');
  const muteBtn = document.getElementById('mute-btn');
  const pauseBtn = document.getElementById('pause-btn');

  const startScreen = document.getElementById('start-screen');
  const pauseScreen = document.getElementById('pause-screen');
  const gameoverScreen = document.getElementById('gameover-screen');
  const startBtn = document.getElementById('start-btn');
  const resumeBtn = document.getElementById('resume-btn');
  const restartBtn = document.getElementById('restart-btn');
  const finalScoreEl = document.getElementById('final-score');
  const finalBestEl = document.getElementById('final-best');
  const newBestMsg = document.getElementById('new-best-msg');

  /* ------------------------------ Audio pool ------------------------------ */
  class AudioPool {
    constructor(src, size = 4, volume = 1) {
      this.pool = Array.from({ length: size }, () => {
        const a = new Audio(src);
        a.preload = 'auto';
        a.volume = volume;
        a.load();
        return a;
      });
      this.idx = 0;
    }
    play() {
      const a = this.pool[this.idx];
      this.idx = (this.idx + 1) % this.pool.length;
      a.currentTime = 0;
      a.play().catch(() => {});
    }
    setMuted(muted) {
      this.pool.forEach((a) => (a.muted = muted));
    }
  }

  const soundPoint = new AudioPool('sounds/point.mp3', 4, 0.9);
  const soundDie = new AudioPool('sounds/gameover.mp3', 2, 1);

  const musicBg = new Audio('sounds/lagu.mp3');
  musicBg.loop = true;
  musicBg.volume = 0.45;
  musicBg.preload = 'auto';
  musicBg.load();

  /* ------------------------------ Preferensi ------------------------------ */
  let muted = localStorage.getItem('flappy_muted') === '1';
  let best = parseInt(localStorage.getItem('flappy_best') || '0', 10);
  bestValueEl.textContent = best;
  applyMuted();

  function applyMuted() {
    musicBg.muted = muted;
    soundPoint.setMuted(muted);
    soundDie.setMuted(muted);
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.setAttribute('aria-label', muted ? 'Aktifkan suara' : 'Bisukan suara');
  }

  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    muted = !muted;
    localStorage.setItem('flappy_muted', muted ? '1' : '0');
    applyMuted();
  });

  /* ------------------------------ Konstanta game ------------------------------ */
  const GRAVITY = 1400;        // px/detik^2
  const FLAP_VELOCITY = -420;  // px/detik
  const BASE_SPEED = 165;      // px/detik, kecepatan awal pipa
  const MAX_SPEED = 320;       // px/detik, batas atas kecepatan
  const SPEED_PER_SCORE = 6;   // penambahan kecepatan per skor
  const PIPE_GAP_VH = 32;      // celah antar pipa (vh)
  const PIPE_SPACING = 300;    // jarak horizontal antar pasangan pipa (px)
  const HITBOX_SHRINK = 0.78;  // burung sedikit lebih "kecil" dari sprite-nya, biar adil
  const FLAP_SPRITE_MS = 140;  // lama sprite kepakan sayap ditampilkan

  /* ------------------------------ State game ------------------------------ */
  let state = 'ready'; // ready | playing | paused | over
  let birdY = 0;
  let birdVelocity = 0;
  let rafId = null;
  let lastTime = 0;
  let distanceSinceSpawn = Infinity; // supaya pipa pertama langsung muncul
  let score = 0;
  let speed = BASE_SPEED;
  let flapTimeout = null;
  /** @type {{topEl:HTMLElement, bottomEl:HTMLElement, x:number, scored:boolean}[]} */
  let pipes = [];

  function birdStartTop() {
    return window.innerHeight * 0.4;
  }

  /* ------------------------------ Setup posisi awal ------------------------------ */
  function resetVisuals() {
    birdY = birdStartTop();
    birdVelocity = 0;
    birdEl.style.top = birdY + 'px';
    birdEl.style.transform = 'rotate(0deg)';
    birdEl.src = 'images/bird.png';
    pipes.forEach((p) => {
      p.topEl.remove();
      p.bottomEl.remove();
    });
    pipes = [];
    distanceSinceSpawn = Infinity;
    score = 0;
    speed = BASE_SPEED;
    scoreEl.textContent = '0';
  }

  /* ------------------------------ Pipa ------------------------------ */
  function spawnPipePair() {
    const vh = window.innerHeight / 100;
    const minTop = 8 * vh;
    const maxTop = 58 * vh;
    const gapTop = minTop + Math.random() * (maxTop - minTop);
    const gapBottom = gapTop + PIPE_GAP_VH * vh;

    const topEl = document.createElement('div');
    topEl.className = 'pipe pipe-top';
    topEl.style.left = window.innerWidth + 'px';
    topEl.style.top = '0px';
    topEl.style.height = gapTop + 'px';

    const bottomEl = document.createElement('div');
    bottomEl.className = 'pipe pipe-bottom';
    bottomEl.style.left = window.innerWidth + 'px';
    bottomEl.style.top = gapBottom + 'px';
    bottomEl.style.height = window.innerHeight - gapBottom + 'px';

    pipesLayer.appendChild(topEl);
    pipesLayer.appendChild(bottomEl);

    pipes.push({ topEl, bottomEl, x: window.innerWidth, scored: false });
  }

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function shrinkRect(r, factor) {
    const dw = (r.width * (1 - factor)) / 2;
    const dh = (r.height * (1 - factor)) / 2;
    return {
      left: r.left + dw,
      right: r.right - dw,
      top: r.top + dh,
      bottom: r.bottom - dh,
    };
  }

  /* ------------------------------ Loop utama ------------------------------ */
  function loop(timestamp) {
    if (state !== 'playing') return;
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000; // detik
    dt = Math.min(dt, 1 / 20); // jaga-jaga kalau tab sempat tidak aktif
    lastTime = timestamp;

    updateBird(dt);
    updatePipes(dt);
    checkGroundCeiling();

    if (state === 'playing') {
      rafId = requestAnimationFrame(loop);
    }
  }

  function updateBird(dt) {
    birdVelocity += GRAVITY * dt;
    birdY += birdVelocity * dt;
    birdEl.style.top = birdY + 'px';

    const angle = Math.max(-25, Math.min(90, birdVelocity * 0.08));
    birdEl.style.transform = `rotate(${angle}deg)`;
  }

  function updatePipes(dt) {
    distanceSinceSpawn += speed * dt;
    if (distanceSinceSpawn >= PIPE_SPACING) {
      distanceSinceSpawn = 0;
      spawnPipePair();
    }

    const birdRectRaw = birdEl.getBoundingClientRect();
    const birdRect = shrinkRect(birdRectRaw, HITBOX_SHRINK);

    for (let i = pipes.length - 1; i >= 0; i--) {
      const p = pipes[i];
      p.x -= speed * dt;
      p.topEl.style.left = p.x + 'px';
      p.bottomEl.style.left = p.x + 'px';

      if (p.x + p.topEl.offsetWidth < 0) {
        p.topEl.remove();
        p.bottomEl.remove();
        pipes.splice(i, 1);
        continue;
      }

      if (!p.scored && p.x + p.topEl.offsetWidth < birdRectRaw.left) {
        p.scored = true;
        score++;
        scoreEl.textContent = String(score);
        scoreEl.classList.remove('pop');
        void scoreEl.offsetWidth; // restart animasi
        scoreEl.classList.add('pop');
        soundPoint.play();
        speed = Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_PER_SCORE);
      }

      const topRect = p.topEl.getBoundingClientRect();
      const bottomRect = p.bottomEl.getBoundingClientRect();
      if (rectsOverlap(birdRect, topRect) || rectsOverlap(birdRect, bottomRect)) {
        endGame();
        return;
      }
    }
  }

  function checkGroundCeiling() {
    const groundHeight = document.getElementById('ground').getBoundingClientRect().height;
    const floor = window.innerHeight - groundHeight - birdEl.offsetHeight;
    if (birdY <= 0) {
      birdY = 0;
      endGame();
    } else if (birdY >= floor) {
      birdY = floor;
      endGame();
    }
  }

  /* ------------------------------ Kontrol ------------------------------ */
  function flap() {
    if (state === 'ready') {
      startGame();
      return;
    }
    if (state !== 'playing') return;
    birdVelocity = FLAP_VELOCITY;
    birdEl.src = 'images/bird2.png';
    clearTimeout(flapTimeout);
    flapTimeout = setTimeout(() => {
      if (state === 'playing') birdEl.src = 'images/bird.png';
    }, FLAP_SPRITE_MS);
  }

  function togglePause() {
    if (state === 'playing') {
      state = 'paused';
      cancelAnimationFrame(rafId);
      musicBg.pause();
      pauseScreen.classList.remove('hidden');
    } else if (state === 'paused') {
      state = 'playing';
      lastTime = 0;
      pauseScreen.classList.add('hidden');
      if (!muted) musicBg.play().catch(() => {});
      rafId = requestAnimationFrame(loop);
    }
  }

  /* ------------------------------ Alur game ------------------------------ */
  function startGame() {
    resetVisuals();
    state = 'playing';
    lastTime = 0;
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    musicBg.currentTime = 0;
    if (!muted) musicBg.play().catch(() => {});
    rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    if (state !== 'playing') return;
    state = 'over';
    cancelAnimationFrame(rafId);
    musicBg.pause();
    soundDie.play();

    const isNewBest = score > best;
    if (isNewBest) {
      best = score;
      localStorage.setItem('flappy_best', String(best));
    }
    bestValueEl.textContent = best;
    finalScoreEl.textContent = String(score);
    finalBestEl.textContent = String(best);
    newBestMsg.classList.toggle('hidden', !isNewBest);

    gameoverScreen.classList.remove('hidden');
  }

  /* ------------------------------ Event listener (didaftarkan SEKALI) ------------------------------ */
  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'ArrowUp' || e.code === 'Space') {
      e.preventDefault();
      flap();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (state === 'ready' || state === 'over') startGame();
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      togglePause();
    }
  });

  gameEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.icon-btn') || e.target.closest('.panel')) return;
    flap();
  });

  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });
  restartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    startGame();
  });
  resumeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });
  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });

  window.addEventListener('resize', () => {
    if (state === 'ready') birdEl.style.top = birdStartTop() + 'px';
  });

  /* ------------------------------ Inisialisasi ------------------------------ */
  resetVisuals();
})();
