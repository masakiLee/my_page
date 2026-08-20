/* Canvas rendering: playfield, ghost, previews, line-clear flash, particles, shake. */
(function (T) {
  'use strict';

  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function setupCanvas(canvas, cssW, cssH) {
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * DPR);
    canvas.height = Math.round(cssH * DPR);
    var ctx = canvas.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return ctx;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawCell(ctx, px, py, size, color, alpha) {
    var pad = Math.max(1, size * 0.06);
    var s = size - pad * 2;
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;

    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.35;
    ctx.fillStyle = color;
    roundRect(ctx, px + pad, py + pad, s, s, size * 0.18);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Glass highlight on the top half plus a darker foot, so cells read as 3D.
    var grad = ctx.createLinearGradient(px, py, px, py + size);
    grad.addColorStop(0, 'rgba(255,255,255,0.42)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = grad;
    roundRect(ctx, px + pad, py + pad, s, s, size * 0.18);
    ctx.fill();
    ctx.restore();
  }

  function drawGhostCell(ctx, px, py, size, color) {
    var pad = Math.max(1, size * 0.06);
    var s = size - pad * 2;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.09);
    roundRect(ctx, px + pad, py + pad, s, s, size * 0.18);
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  function bounds(type) {
    var cells = T.CELLS[type][0];
    var minX = 9, maxX = -9, minY = 9, maxY = -9;
    cells.forEach(function (c) {
      minX = Math.min(minX, c[0]); maxX = Math.max(maxX, c[0]);
      minY = Math.min(minY, c[1]); maxY = Math.max(maxY, c[1]);
    });
    return { minX: minX, minY: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  }

  function Renderer(game, settings, els) {
    this.game = game;
    this.settings = settings;
    this.els = els;
    this.cell = 24;
    this.previewCell = 16;
    this.nextCount = T.NEXT_COUNT;
    this.particles = [];
    this.shakeMag = 0;
    this.shakeTime = 0;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    // Measured from the stage, not from the slot: the slot shrink-wraps whatever
    // size we pick here, so measuring it would be circular.
    var stage = this.els.stage;
    var gap = parseFloat(window.getComputedStyle(stage).columnGap) || 0;
    var w = stage.clientWidth - this.els.panelLeft.offsetWidth -
            this.els.panelRight.offsetWidth - gap * 2;
    var h = stage.clientHeight;
    if (w <= 0 || h <= 0) return;

    // The playfield takes the largest whole-cell square grid the slot can hold,
    // so it never overflows however narrow the window gets.
    this.cell = Math.max(8, Math.floor(Math.min(w / T.COLS, h / T.VISIBLE_ROWS)));
    var boardW = this.cell * T.COLS;
    var boardH = this.cell * T.VISIBLE_ROWS;
    this.els.wrap.style.width = boardW + 'px';
    this.els.wrap.style.height = boardH + 'px';
    this.bctx = setupCanvas(this.els.board, boardW, boardH);
    this.boardW = boardW;
    this.boardH = boardH;

    // Previews have to fit the side panel, not just look proportional to the board.
    this.nextCount = window.innerWidth < 560 ? 3 : T.NEXT_COUNT;
    var panel = this.els.panelRight;
    var panelW = panel ? panel.clientWidth : 120;
    var panelH = panel ? panel.clientHeight : 400;
    var byWidth = Math.floor((panelW - 14) / 4.4);
    var byHeight = Math.floor((panelH - 44) / (2.6 * this.nextCount));
    this.previewCell = Math.max(7, Math.min(Math.round(this.cell * 0.62), byWidth, byHeight));

    var pc = this.previewCell;
    this.hctx = setupCanvas(this.els.hold, pc * 4.4, pc * 2.6);
    this.nctx = setupCanvas(this.els.next, pc * 4.4, pc * 2.6 * this.nextCount);
  };

  Renderer.prototype.shake = function (mag) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = 1;
  };

  Renderer.prototype.burst = function (rows) {
    var self = this;
    var cell = this.cell;
    rows.forEach(function (row) {
      var y = (row - T.HIDDEN_ROWS) * cell + cell / 2;
      for (var x = 0; x < T.COLS; x++) {
        var type = self.game.board.grid[row][x];
        var color = T.COLORS[type] || '#ffffff';
        for (var i = 0; i < 3; i++) {
          self.particles.push({
            x: x * cell + cell / 2,
            y: y,
            vx: (Math.random() - 0.5) * 0.42,
            vy: (Math.random() - 0.9) * 0.32,
            life: 1,
            decay: 0.0016 + Math.random() * 0.0016,
            size: cell * (0.1 + Math.random() * 0.14),
            color: color
          });
        }
      }
    });
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  };

  Renderer.prototype.updateEffects = function (dt) {
    var gravity = 0.0016;
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += gravity * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    if (this.shakeTime > 0) {
      this.shakeTime -= dt / 220;
      if (this.shakeTime <= 0) { this.shakeTime = 0; this.shakeMag = 0; }
    }
  };

  Renderer.prototype.render = function (dt) {
    this.updateEffects(dt);
    var ctx = this.bctx;
    var game = this.game;
    var cell = this.cell;
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, this.boardW, this.boardH);

    if (this.shakeTime > 0) {
      var amp = this.shakeMag * this.shakeTime;
      ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
    }

    this.drawBackground(ctx, cell);
    this.drawColumnHint(ctx, cell);
    this.drawLockedCells(ctx, cell);
    this.drawClearing(ctx, cell);

    if (game.active && game.phase !== 'over') {
      if (this.settings.ghost) this.drawGhost(ctx, cell);
      this.drawActive(ctx, cell);
    }

    this.drawParticles(ctx);
    ctx.restore();

    this.drawHold();
    this.drawNext();
  };

  Renderer.prototype.drawBackground = function (ctx, cell) {
    var grad = ctx.createLinearGradient(0, 0, 0, this.boardH);
    grad.addColorStop(0, 'rgba(16,21,38,0.96)');
    grad.addColorStop(1, 'rgba(9,12,24,0.96)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.boardW, this.boardH);

    if (!this.settings.grid) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x = 1; x < T.COLS; x++) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, this.boardH);
    }
    for (var y = 1; y < T.VISIBLE_ROWS; y++) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(this.boardW, y * cell + 0.5);
    }
    ctx.stroke();
  };

  /* A faint tint down the columns the active piece occupies — helps aiming. */
  Renderer.prototype.drawColumnHint = function (ctx, cell) {
    var a = this.game.active;
    if (!a) return;
    var cols = {};
    T.CELLS[a.type][a.rot].forEach(function (c) { cols[a.x + c[0]] = true; });
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    Object.keys(cols).forEach(function (col) {
      ctx.fillRect(col * cell, 0, cell, this.boardH);
    }, this);
  };

  Renderer.prototype.drawLockedCells = function (ctx, cell) {
    var grid = this.game.board.grid;
    var clearing = this.game.clearingRows;
    for (var y = T.HIDDEN_ROWS; y < T.ROWS; y++) {
      if (clearing && clearing.indexOf(y) !== -1) continue;
      for (var x = 0; x < T.COLS; x++) {
        var type = grid[y][x];
        if (type) drawCell(ctx, x * cell, (y - T.HIDDEN_ROWS) * cell, cell, T.COLORS[type]);
      }
    }
  };

  Renderer.prototype.drawClearing = function (ctx, cell) {
    var game = this.game;
    if (!game.clearingRows) return;
    var progress = 1 - Math.max(0, game.clearTimer) / T.CLEAR_ANIM_MS;
    var grid = game.board.grid;

    game.clearingRows.forEach(function (row) {
      var py = (row - T.HIDDEN_ROWS) * cell;
      var squeeze = cell * progress * 0.5;
      for (var x = 0; x < T.COLS; x++) {
        var type = grid[row][x];
        if (!type) continue;
        drawCell(ctx, x * cell, py + squeeze / 2, cell - squeeze, T.COLORS[type], 1 - progress * 0.4);
      }
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, py + squeeze / 2, this.boardW, Math.max(1, cell - squeeze));
      ctx.restore();
    }, this);
  };

  Renderer.prototype.drawGhost = function (ctx, cell) {
    var a = this.game.active;
    var gy = this.game.ghostY();
    if (gy === a.y) return;
    T.CELLS[a.type][a.rot].forEach(function (c) {
      var y = gy + c[1];
      if (y < T.HIDDEN_ROWS) return;
      drawGhostCell(ctx, (a.x + c[0]) * cell, (y - T.HIDDEN_ROWS) * cell, cell, T.COLORS[a.type]);
    });
  };

  Renderer.prototype.drawActive = function (ctx, cell) {
    var a = this.game.active;
    // Flash the piece as its lock delay runs out.
    var alpha = 1;
    if (this.game.grounded) {
      var t = Math.min(1, this.game.lockTimer / T.LOCK_DELAY_MS);
      alpha = 0.72 + 0.28 * Math.cos(t * Math.PI * 6);
    }
    T.CELLS[a.type][a.rot].forEach(function (c) {
      var y = a.y + c[1];
      if (y < T.HIDDEN_ROWS) return;
      drawCell(ctx, (a.x + c[0]) * cell, (y - T.HIDDEN_ROWS) * cell, cell, T.COLORS[a.type], alpha);
    });
  };

  Renderer.prototype.drawParticles = function (ctx) {
    ctx.save();
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();
  };

  Renderer.prototype.drawPreviewPiece = function (ctx, type, cx, cy, cell) {
    var b = bounds(type);
    var ox = cx - (b.w * cell) / 2 - b.minX * cell;
    var oy = cy - (b.h * cell) / 2 - b.minY * cell;
    T.CELLS[type][0].forEach(function (c) {
      drawCell(ctx, ox + c[0] * cell, oy + c[1] * cell, cell, T.COLORS[type]);
    });
  };

  Renderer.prototype.drawHold = function () {
    var ctx = this.hctx;
    if (!ctx) return;
    var w = this.previewCell * 4.4, h = this.previewCell * 2.6;
    ctx.clearRect(0, 0, w, h);
    if (!this.game.hold) return;
    ctx.save();
    if (!this.game.canHold) ctx.globalAlpha = 0.35;
    this.drawPreviewPiece(ctx, this.game.hold, w / 2, h / 2, this.previewCell);
    ctx.restore();
  };

  Renderer.prototype.drawNext = function () {
    var ctx = this.nctx;
    if (!ctx) return;
    var cellW = this.previewCell * 4.4;
    var slotH = this.previewCell * 2.6;
    ctx.clearRect(0, 0, cellW, slotH * this.nextCount);

    for (var i = 0; i < this.game.queue.length && i < this.nextCount; i++) {
      var size = i === 0 ? this.previewCell : this.previewCell * 0.82;
      ctx.save();
      ctx.globalAlpha = i === 0 ? 1 : 0.75 - i * 0.08;
      this.drawPreviewPiece(ctx, this.game.queue[i], cellW / 2, slotH * i + slotH / 2, size);
      ctx.restore();
    }
  };

  T.Renderer = Renderer;
})(window.T = window.T || {});
