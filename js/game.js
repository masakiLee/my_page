/* Game rules: gravity, lock delay, rotation with kicks, hold, scoring and levels. */
(function (T) {
  'use strict';

  function Game(settings) {
    this.settings = settings;
    this.board = new T.Board();
    this.bag = new T.Randomizer();
    this.listeners = {};
    this.reset();
  }

  /* --- events ------------------------------------------------------------ */

  Game.prototype.on = function (name, fn) {
    (this.listeners[name] || (this.listeners[name] = [])).push(fn);
    return this;
  };

  Game.prototype.emit = function (name, payload) {
    var fns = this.listeners[name];
    if (!fns) return;
    for (var i = 0; i < fns.length; i++) fns[i](payload);
  };

  /* --- lifecycle --------------------------------------------------------- */

  Game.prototype.reset = function () {
    this.board.reset();
    this.bag.reset();
    this.queue = [];
    for (var i = 0; i < T.NEXT_COUNT; i++) this.queue.push(this.bag.next());

    this.active = null;
    this.hold = null;
    this.canHold = true;

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.elapsed = 0;

    this.phase = 'ready';         // ready | playing | clearing | paused | over
    this.softDropping = false;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.grounded = false;
    this.clearingRows = null;
    this.clearTimer = 0;
  };

  Game.prototype.start = function () {
    this.reset();
    this.phase = 'playing';
    this.spawn();
    this.emit('start');
  };

  Game.prototype.togglePause = function () {
    if (this.phase === 'playing' || this.phase === 'clearing') {
      this.pausedFrom = this.phase;
      this.phase = 'paused';
      this.softDropping = false;
      this.emit('pause');
    } else if (this.phase === 'paused') {
      this.phase = this.pausedFrom || 'playing';
      this.emit('resume');
    }
  };

  Game.prototype.isRunning = function () {
    return this.phase === 'playing' || this.phase === 'clearing';
  };

  /* --- piece handling ---------------------------------------------------- */

  Game.prototype.spawn = function (type) {
    if (type === undefined) {
      type = this.queue.shift();
      this.queue.push(this.bag.next());
    }

    this.active = { type: type, rot: 0, x: T.SPAWN_X[type], y: 0 };
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.grounded = false;

    var a = this.active;
    if (this.board.collides(a.type, a.rot, a.x, a.y)) {
      this.gameOver();                                  // block out
      return;
    }
    // Guideline spawn: the piece immediately drops one row into view if it can.
    if (!this.board.collides(a.type, a.rot, a.x, a.y + 1)) a.y++;
    this.emit('spawn', a.type);
  };

  /* Bookkeeping shared by every successful player action. */
  Game.prototype.afterAction = function () {
    var a = this.active;
    if (this.board.collides(a.type, a.rot, a.x, a.y + 1)) {
      if (!this.grounded) {
        this.grounded = true;
        this.lockTimer = 0;
      } else if (this.lockResets < T.MAX_LOCK_RESETS) {
        this.lockResets++;
        this.lockTimer = 0;                             // move reset, capped at 15
      }
    } else {
      this.grounded = false;
      this.lockTimer = 0;
    }
  };

  Game.prototype.move = function (dx) {
    if (this.phase !== 'playing' || !this.active) return false;
    var a = this.active;
    if (this.board.collides(a.type, a.rot, a.x + dx, a.y)) return false;
    a.x += dx;
    this.afterAction();
    this.emit('move');
    return true;
  };

  Game.prototype.rotate = function (dir) {
    if (this.phase !== 'playing' || !this.active) return false;
    var a = this.active;
    var to = (a.rot + dir + 4) % 4;
    var kicks = T.kicks(a.type, a.rot, to);

    for (var i = 0; i < kicks.length; i++) {
      var nx = a.x + kicks[i][0];
      var ny = a.y + kicks[i][1];
      if (!this.board.collides(a.type, to, nx, ny)) {
        a.rot = to;
        a.x = nx;
        a.y = ny;
        this.afterAction();
        this.emit('rotate', i > 0);                     // i > 0 means a wall kick saved it
        return true;
      }
    }
    return false;
  };

  Game.prototype.stepDown = function (fromSoftDrop) {
    var a = this.active;
    if (this.board.collides(a.type, a.rot, a.x, a.y + 1)) return false;
    a.y++;
    if (fromSoftDrop) this.score++;
    this.grounded = false;
    this.lockTimer = 0;
    return true;
  };

  Game.prototype.hardDrop = function () {
    if (this.phase !== 'playing' || !this.active) return;
    var a = this.active;
    var distance = this.board.dropDistance(a.type, a.rot, a.x, a.y);
    a.y += distance;
    this.score += distance * 2;
    this.emit('harddrop', distance);
    this.lockPiece();
  };

  Game.prototype.holdPiece = function () {
    if (this.phase !== 'playing' || !this.active || !this.canHold) return false;
    var swapped = this.hold;
    this.hold = this.active.type;
    this.canHold = false;
    this.emit('hold');

    if (swapped) this.spawn(swapped);
    else this.spawn();
    return true;
  };

  /* --- locking and clearing ---------------------------------------------- */

  Game.prototype.lockPiece = function () {
    var a = this.active;
    this.board.lock(a.type, a.rot, a.x, a.y);
    var lockedOut = this.board.isLockOut(a.type, a.rot, a.y);
    this.active = null;
    this.canHold = true;

    var rows = this.board.fullRows();
    if (rows.length) {
      var gained = T.LINE_SCORES[rows.length] * this.level;
      this.score += gained;
      this.lines += rows.length;

      var nextLevel = Math.floor(this.lines / T.LINES_PER_LEVEL) + 1;
      var leveled = nextLevel > this.level;
      this.level = nextLevel;

      this.clearingRows = rows;
      this.clearTimer = T.CLEAR_ANIM_MS;
      this.phase = 'clearing';
      this.emit('clear', { rows: rows, count: rows.length, score: gained });
      if (leveled) this.emit('levelup', this.level);
      return;
    }

    this.emit('lock');
    if (lockedOut) {
      this.gameOver();
      return;
    }
    this.spawn();
  };

  Game.prototype.finishClear = function () {
    this.board.clearRows(this.clearingRows);
    this.clearingRows = null;
    this.phase = 'playing';
    this.spawn();
  };

  Game.prototype.gameOver = function () {
    this.phase = 'over';
    this.active = null;
    this.softDropping = false;
    this.emit('gameover', { score: this.score, lines: this.lines, level: this.level });
  };

  /* --- per-frame update --------------------------------------------------- */

  Game.prototype.update = function (dt) {
    if (this.phase === 'clearing') {
      this.elapsed += dt;
      this.clearTimer -= dt;
      if (this.clearTimer <= 0) this.finishClear();
      return;
    }

    if (this.phase !== 'playing' || !this.active) return;
    this.elapsed += dt;

    var a = this.active;
    var resting = this.board.collides(a.type, a.rot, a.x, a.y + 1);

    if (resting) {
      if (!this.grounded) {
        this.grounded = true;
        this.lockTimer = 0;
      }
      this.lockTimer += dt;
      if (this.lockTimer >= T.LOCK_DELAY_MS) this.lockPiece();
      return;
    }

    this.grounded = false;
    var natural = T.gravityMs(this.level);
    var soft = this.softDropping;
    var interval = soft ? Math.min(natural, Math.max(1, this.settings.softDrop)) : natural;

    this.gravityAcc += dt;
    var steps = 0;
    while (this.gravityAcc >= interval && steps < 64) {
      this.gravityAcc -= interval;
      if (!this.stepDown(soft)) break;
      steps++;
    }
  };

  /* --- queries for the renderer ------------------------------------------- */

  Game.prototype.ghostY = function () {
    if (!this.active) return 0;
    var a = this.active;
    return a.y + this.board.dropDistance(a.type, a.rot, a.x, a.y);
  };

  T.Game = Game;
})(window.T = window.T || {});
