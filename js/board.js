/* The playfield grid: collision tests, locking and line clears. */
(function (T) {
  'use strict';

  function Board() {
    this.grid = [];
    this.reset();
  }

  Board.prototype.reset = function () {
    this.grid = [];
    for (var y = 0; y < T.ROWS; y++) {
      this.grid.push(new Array(T.COLS).fill(null));
    }
  };

  Board.prototype.cell = function (x, y) {
    if (y < 0) return null;
    return this.grid[y][x];
  };

  /* True when the piece at (x, y, rot) overlaps a wall, the floor or a locked cell. */
  Board.prototype.collides = function (type, rot, x, y) {
    var cells = T.CELLS[type][rot], i, cx, cy;
    for (i = 0; i < cells.length; i++) {
      cx = x + cells[i][0];
      cy = y + cells[i][1];
      if (cx < 0 || cx >= T.COLS || cy >= T.ROWS) return true;
      if (cy >= 0 && this.grid[cy][cx]) return true;   // above the ceiling is free space
    }
    return false;
  };

  Board.prototype.lock = function (type, rot, x, y) {
    var cells = T.CELLS[type][rot], i, cx, cy;
    for (i = 0; i < cells.length; i++) {
      cx = x + cells[i][0];
      cy = y + cells[i][1];
      if (cy >= 0 && cy < T.ROWS && cx >= 0 && cx < T.COLS) this.grid[cy][cx] = type;
    }
  };

  /* A piece that locks entirely inside the spawn buffer is a "lock out" — game over. */
  Board.prototype.isLockOut = function (type, rot, y) {
    var cells = T.CELLS[type][rot], i;
    for (i = 0; i < cells.length; i++) {
      if (y + cells[i][1] >= T.HIDDEN_ROWS) return false;
    }
    return true;
  };

  Board.prototype.fullRows = function () {
    var rows = [], y, x, full;
    for (y = 0; y < T.ROWS; y++) {
      full = true;
      for (x = 0; x < T.COLS; x++) {
        if (!this.grid[y][x]) { full = false; break; }
      }
      if (full) rows.push(y);
    }
    return rows;
  };

  Board.prototype.clearRows = function (rows) {
    var self = this;
    rows.slice().sort(function (a, b) { return a - b; }).forEach(function (y) {
      self.grid.splice(y, 1);
      self.grid.unshift(new Array(T.COLS).fill(null));
    });
  };

  /* Number of rows the piece can fall before it would collide. */
  Board.prototype.dropDistance = function (type, rot, x, y) {
    var distance = 0;
    while (!this.collides(type, rot, x, y + distance + 1)) distance++;
    return distance;
  };

  T.Board = Board;
})(window.T = window.T || {});
