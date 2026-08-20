/* Wiring: DOM, game loop, HUD, overlay states and the settings panel. */
(function (T) {
  'use strict';

  function $(id) { return document.getElementById(id); }

  var els = {
    wrap: $('board-wrap'),
    slot: $('board-slot'),
    stage: document.querySelector('.stage'),
    panelLeft: $('panel-left'),
    panelRight: $('panel-right'),
    board: $('board-canvas'),
    hold: $('hold-canvas'),
    next: $('next-canvas'),
    overlay: $('overlay'),
    overlayKicker: $('overlay-kicker'),
    overlayTitle: $('overlay-title'),
    overlayBody: $('overlay-body'),
    overlayScores: $('overlay-scores'),
    overlayRecord: $('overlay-record'),
    overlayBtn: $('overlay-btn'),
    overlayHint: $('overlay-hint'),
    overScore: $('over-score'),
    overLines: $('over-lines'),
    overLevel: $('over-level'),
    score: $('stat-score'),
    best: $('stat-best'),
    level: $('stat-level'),
    lines: $('stat-lines'),
    time: $('stat-time'),
    btnSound: $('btn-sound'),
    btnMusic: $('btn-music'),
    btnSettings: $('btn-settings'),
    modal: $('settings-modal'),
    touchControls: $('touch-controls')
  };

  var settings = T.storage.getSettings();
  var best = T.storage.getBest();

  var game = new T.Game(settings);
  var renderer = new T.Renderer(game, settings, els);
  var input = new T.Input(game, settings, els, {
    onInput: function () { T.audio.unlock(); },
    onStart: startGame,
    onRestart: startGame,
    onPause: togglePause
  });
  input.cellSize = function () { return renderer.cell; };

  T.audio.setSound(settings.sound);
  T.audio.setMusic(settings.music);

  /* --- overlay -------------------------------------------------------------- */

  var OVERLAY_TEXT = {
    ready: {
      kicker: 'READY',
      title: 'NEON TETRIS',
      body: '填滿一整列就會消除。撐到不能再堆為止。',
      btn: '開始遊戲',
      hint: '按 Enter 或空白鍵開始'
    },
    paused: {
      kicker: 'PAUSED',
      title: '暫停中',
      body: '喘口氣，隨時回來。',
      btn: '繼續遊戲',
      hint: '按 P 或 Esc 繼續'
    },
    over: {
      kicker: 'GAME OVER',
      title: '結束了',
      body: '再一局？',
      btn: '再玩一次',
      hint: '按 R 或 Enter 重新開始'
    }
  };

  function setOverlay(state) {
    if (!state) {
      els.overlay.hidden = true;
      els.overlay.dataset.state = 'hidden';
      return;
    }
    var text = OVERLAY_TEXT[state];
    els.overlay.hidden = false;
    els.overlay.dataset.state = state;
    els.overlayKicker.textContent = text.kicker;
    els.overlayTitle.textContent = text.title;
    els.overlayBody.textContent = text.body;
    els.overlayBtn.textContent = text.btn;
    els.overlayHint.textContent = text.hint;
    els.overlayScores.hidden = state !== 'over';
    if (state !== 'over') els.overlayRecord.hidden = true;
  }

  /* --- game control --------------------------------------------------------- */

  function startGame() {
    T.audio.unlock();
    game.start();
    T.audio.setLevel(game.level);
    T.audio.resumeMusic();
    renderer.particles.length = 0;
    setOverlay(null);
  }

  function togglePause() {
    if (game.phase === 'ready' || game.phase === 'over') return;
    game.togglePause();
    if (game.phase === 'paused') {
      input.releaseAll();
      T.audio.suspendMusic();
      setOverlay('paused');
    } else {
      T.audio.resumeMusic();
      setOverlay(null);
    }
  }

  els.overlayBtn.addEventListener('click', function () {
    if (game.phase === 'paused') togglePause();
    else startGame();
  });

  /* --- game events ----------------------------------------------------------- */

  game.on('move', function () { T.audio.play('move'); });
  game.on('rotate', function (kicked) { T.audio.play(kicked ? 'kick' : 'rotate'); });
  game.on('hold', function () { T.audio.play('hold'); });
  game.on('lock', function () { T.audio.play('lock'); });

  game.on('harddrop', function (distance) {
    T.audio.play('harddrop');
    if (distance > 1) renderer.shake(Math.min(9, 1.5 + distance * 0.42));
  });

  game.on('clear', function (info) {
    T.audio.playClear(info.count);
    renderer.burst(info.rows);
    renderer.shake(info.count >= 4 ? 14 : 4 + info.count * 1.6);
  });

  game.on('levelup', function (level) {
    T.audio.play('levelup');
    T.audio.setLevel(level);
    els.level.classList.remove('pop');
    void els.level.offsetWidth;
    els.level.classList.add('pop');
  });

  game.on('gameover', function (result) {
    T.audio.play('gameover');
    T.audio.suspendMusic();
    input.releaseAll();
    renderer.shake(12);

    var isRecord = result.score > best;
    if (isRecord) {
      best = result.score;
      T.storage.setBest(best);
    }
    els.overScore.textContent = result.score.toLocaleString();
    els.overLines.textContent = result.lines;
    els.overLevel.textContent = result.level;
    setOverlay('over');
    els.overlayRecord.hidden = !isRecord;
  });

  /* --- HUD -------------------------------------------------------------------- */

  var lastHud = {};

  function setText(el, key, value) {
    if (lastHud[key] === value) return;
    lastHud[key] = value;
    el.textContent = value;
  }

  function formatTime(ms) {
    var total = Math.floor(ms / 1000);
    var mins = Math.floor(total / 60);
    var secs = total % 60;
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function updateHud() {
    setText(els.score, 'score', game.score.toLocaleString());
    setText(els.best, 'best', Math.max(best, game.score).toLocaleString());
    setText(els.level, 'level', String(game.level));
    setText(els.lines, 'lines', String(game.lines));
    setText(els.time, 'time', formatTime(game.elapsed));
  }

  /* --- settings ---------------------------------------------------------------- */

  function persist() {
    T.storage.setSettings(settings);
  }

  function syncSettingsUi() {
    $('set-das').value = settings.das;
    $('set-das-val').textContent = settings.das;
    $('set-arr').value = settings.arr;
    $('set-arr-val').textContent = settings.arr;
    $('set-sdr').value = settings.softDrop;
    $('set-sdr-val').textContent = settings.softDrop;
    $('set-ghost').checked = settings.ghost;
    $('set-grid').checked = settings.grid;

    els.btnSound.setAttribute('aria-pressed', String(settings.sound));
    els.btnSound.classList.toggle('is-off', !settings.sound);
    els.btnMusic.setAttribute('aria-pressed', String(settings.music));
    els.btnMusic.classList.toggle('is-off', !settings.music);
  }

  function bindRange(id, key, label) {
    $(id).addEventListener('input', function () {
      settings[key] = parseInt(this.value, 10);
      $(label).textContent = settings[key];
      persist();
    });
  }

  bindRange('set-das', 'das', 'set-das-val');
  bindRange('set-arr', 'arr', 'set-arr-val');
  bindRange('set-sdr', 'softDrop', 'set-sdr-val');

  $('set-ghost').addEventListener('change', function () {
    settings.ghost = this.checked;
    persist();
  });

  $('set-grid').addEventListener('change', function () {
    settings.grid = this.checked;
    persist();
  });

  $('set-reset').addEventListener('click', function () {
    ['das', 'arr', 'softDrop', 'ghost', 'grid'].forEach(function (key) {
      settings[key] = T.DEFAULT_SETTINGS[key];
    });
    syncSettingsUi();
    persist();
  });

  function openModal() {
    els.modal.hidden = false;
    if (game.phase === 'playing' || game.phase === 'clearing') togglePause();
  }

  function closeModal() {
    els.modal.hidden = true;
  }

  els.btnSettings.addEventListener('click', openModal);
  els.modal.addEventListener('click', function (e) {
    if (e.target.hasAttribute('data-close')) closeModal();
  });

  els.btnSound.addEventListener('click', function () {
    settings.sound = !settings.sound;
    T.audio.setSound(settings.sound);
    T.audio.unlock();
    syncSettingsUi();
    persist();
    T.audio.play('rotate');
  });

  els.btnMusic.addEventListener('click', function () {
    settings.music = !settings.music;
    T.audio.unlock();
    T.audio.setMusic(settings.music);
    syncSettingsUi();
    persist();
  });

  /* --- on-screen buttons --------------------------------------------------------- */

  els.touchControls.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    T.audio.unlock();
    switch (btn.dataset.act) {
      case 'rotateCW': game.rotate(1); break;
      case 'rotateCCW': game.rotate(-1); break;
      case 'hold': game.holdPiece(); break;
      case 'pause': togglePause(); break;
    }
  });

  /* --- loop ------------------------------------------------------------------------ */

  var lastTime = 0;

  function frame(now) {
    var dt = lastTime ? Math.min(100, now - lastTime) : 16;
    lastTime = now;

    input.update(dt);
    game.update(dt);
    renderer.render(dt);
    updateHud();

    window.requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function () { renderer.resize(); });
  window.addEventListener('orientationchange', function () {
    window.setTimeout(function () { renderer.resize(); }, 200);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden && game.phase === 'playing') togglePause();
  });

  syncSettingsUi();
  setOverlay('ready');
  updateHud();
  renderer.resize();
  window.requestAnimationFrame(frame);
})(window.T = window.T || {});
