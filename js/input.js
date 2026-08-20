/* Keyboard (with DAS/ARR auto-shift) and touch gestures. */
(function (T) {
  'use strict';

  function Input(game, settings, els, hooks) {
    this.game = game;
    this.settings = settings;
    this.els = els;
    this.hooks = hooks || {};

    this.dir = 0;
    this.pressed = {};
    this.charged = false;
    this.dasTimer = 0;
    this.arrTimer = 0;

    this.touch = null;
    this.cellSize = function () { return 24; };

    this.attach();
  }

  Input.prototype.notify = function () {
    if (this.hooks.onInput) this.hooks.onInput();
  };

  /* --- horizontal auto-shift ---------------------------------------------- */

  Input.prototype.startShift = function (dir) {
    this.dir = dir;
    this.charged = false;
    this.dasTimer = 0;
    this.arrTimer = 0;
    this.game.move(dir);
  };

  Input.prototype.stopShift = function (dir) {
    if (this.dir !== dir) return;
    var other = dir === 1 ? -1 : 1;
    if (this.pressed[other]) this.startShift(other);
    else this.dir = 0;
  };

  Input.prototype.update = function (dt) {
    if (!this.dir || this.game.phase !== 'playing') return;
    var das = this.settings.das;
    var arr = this.settings.arr;

    if (!this.charged) {
      this.dasTimer += dt;
      if (this.dasTimer < das) return;
      this.charged = true;
      this.arrTimer = arr;                         // fire the first repeat right away
    } else {
      this.arrTimer += dt;
    }

    if (arr <= 0) {
      var guard = 0;
      while (this.game.move(this.dir) && guard++ < T.COLS) { /* slide to the wall */ }
      return;
    }

    var steps = 0;
    while (this.arrTimer >= arr && steps++ < 20) {
      this.arrTimer -= arr;
      if (!this.game.move(this.dir)) break;
    }
  };

  /* --- keyboard ------------------------------------------------------------ */

  var HOLD_KEYS = { KeyC: 1, ShiftLeft: 1, ShiftRight: 1 };
  var CW_KEYS = { ArrowUp: 1, KeyX: 1 };
  var CCW_KEYS = { KeyZ: 1, ControlLeft: 1, ControlRight: 1 };
  var PAUSE_KEYS = { KeyP: 1, Escape: 1 };
  var BLOCKED = {
    ArrowLeft: 1, ArrowRight: 1, ArrowUp: 1, ArrowDown: 1, Space: 1,
    KeyZ: 1, KeyX: 1, KeyC: 1, KeyP: 1, KeyR: 1, Enter: 1
  };

  Input.prototype.onKeyDown = function (e) {
    var code = e.code;
    if (BLOCKED[code]) e.preventDefault();
    this.notify();

    if (code === 'KeyR') {
      if (this.hooks.onRestart) this.hooks.onRestart();
      return;
    }
    if (PAUSE_KEYS[code]) {
      if (this.hooks.onPause) this.hooks.onPause();
      return;
    }
    if (!this.game.isRunning()) {
      if ((code === 'Enter' || code === 'Space') && this.hooks.onStart) this.hooks.onStart();
      return;
    }
    if (e.repeat) return;                          // DAS handles repetition itself

    switch (code) {
      case 'ArrowLeft':
        this.pressed[-1] = true;
        this.startShift(-1);
        break;
      case 'ArrowRight':
        this.pressed[1] = true;
        this.startShift(1);
        break;
      case 'ArrowDown':
        this.game.softDropping = true;
        break;
      case 'Space':
        this.game.hardDrop();
        break;
      default:
        if (CW_KEYS[code]) this.game.rotate(1);
        else if (CCW_KEYS[code]) this.game.rotate(-1);
        else if (HOLD_KEYS[code]) this.game.holdPiece();
    }
  };

  Input.prototype.onKeyUp = function (e) {
    switch (e.code) {
      case 'ArrowLeft':
        this.pressed[-1] = false;
        this.stopShift(-1);
        break;
      case 'ArrowRight':
        this.pressed[1] = false;
        this.stopShift(1);
        break;
      case 'ArrowDown':
        this.game.softDropping = false;
        break;
    }
  };

  Input.prototype.releaseAll = function () {
    this.pressed = {};
    this.dir = 0;
    this.game.softDropping = false;
  };

  /* --- touch --------------------------------------------------------------- */

  Input.prototype.onTouchStart = function (e) {
    this.notify();
    if (!this.game.isRunning()) return;
    var t = e.touches[0];
    e.preventDefault();
    this.touch = {
      startX: t.clientX, startY: t.clientY,
      anchorX: t.clientX, anchorY: t.clientY,
      startTime: (window.performance || Date).now(),
      moved: false
    };
  };

  Input.prototype.onTouchMove = function (e) {
    if (!this.touch || this.game.phase !== 'playing') return;
    e.preventDefault();
    var t = e.touches[0];
    var step = Math.max(18, this.cellSize());
    var guard = 0;

    var dx = t.clientX - this.touch.anchorX;
    while (Math.abs(dx) >= step && guard++ < 20) {
      var sign = dx > 0 ? 1 : -1;
      this.game.move(sign);
      this.touch.anchorX += sign * step;
      dx -= sign * step;
      this.touch.moved = true;
    }

    var dy = t.clientY - this.touch.anchorY;
    while (dy >= step && guard++ < 30) {
      if (this.game.active) this.game.stepDown(true);
      this.touch.anchorY += step;
      dy -= step;
      this.touch.moved = true;
    }
  };

  Input.prototype.onTouchEnd = function (e) {
    if (!this.touch) return;
    e.preventDefault();
    var touch = this.touch;
    this.touch = null;
    if (!this.game.isRunning()) return;

    var t = e.changedTouches[0];
    var dx = t.clientX - touch.startX;
    var dy = t.clientY - touch.startY;
    var elapsed = Math.max(1, (window.performance || Date).now() - touch.startTime);

    // Swipe up: hold.
    if (dy < -50 && Math.abs(dy) > Math.abs(dx) && elapsed < 320) {
      this.game.holdPiece();
      return;
    }
    // Fast flick down: hard drop.
    if (dy > 60 && Math.abs(dy) > Math.abs(dx) && dy / elapsed > 0.7) {
      this.game.hardDrop();
      return;
    }
    // Tap: rotate clockwise.
    if (!touch.moved && elapsed < 260 && Math.abs(dx) < 14 && Math.abs(dy) < 14) {
      this.game.rotate(1);
    }
  };

  Input.prototype.attach = function () {
    var self = this;
    window.addEventListener('keydown', function (e) { self.onKeyDown(e); });
    window.addEventListener('keyup', function (e) { self.onKeyUp(e); });
    window.addEventListener('blur', function () { self.releaseAll(); });

    var surface = this.els.wrap;
    surface.addEventListener('touchstart', function (e) { self.onTouchStart(e); }, { passive: false });
    surface.addEventListener('touchmove', function (e) { self.onTouchMove(e); }, { passive: false });
    surface.addEventListener('touchend', function (e) { self.onTouchEnd(e); }, { passive: false });
    surface.addEventListener('touchcancel', function () { self.touch = null; }, { passive: false });
  };

  T.Input = Input;
})(window.T = window.T || {});
