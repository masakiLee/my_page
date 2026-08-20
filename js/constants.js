/* Board geometry, tetromino shapes, SRS kick tables, gravity and scoring. */
(function (T) {
  'use strict';

  T.COLS = 10;
  T.HIDDEN_ROWS = 2;            // spawn buffer above the visible field
  T.VISIBLE_ROWS = 20;
  T.ROWS = T.HIDDEN_ROWS + T.VISIBLE_ROWS;

  T.TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  T.COLORS = {
    I: '#22d3ee',
    J: '#4f7dff',
    L: '#f59e0b',
    O: '#facc15',
    S: '#22c55e',
    T: '#a855f7',
    Z: '#f43f5e'
  };

  // Spawn orientations, exactly as the SRS guideline defines them.
  var SPAWN_SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };

  // Column the bounding box spawns at, so every piece lands centred on the field.
  T.SPAWN_X = { I: 3, J: 3, L: 3, O: 4, S: 3, T: 3, Z: 3 };

  function rotateCW(m) {
    var n = m.length, out = [], y, x;
    for (y = 0; y < n; y++) {
      out.push([]);
      for (x = 0; x < n; x++) out[y].push(m[n - 1 - x][y]);
    }
    return out;
  }

  // SHAPES[type][rotation] -> matrix. Rotations are 0, R(1), 2, L(3).
  T.SHAPES = {};
  T.TYPES.forEach(function (type) {
    var frames = [SPAWN_SHAPES[type]];
    for (var i = 1; i < 4; i++) frames.push(rotateCW(frames[i - 1]));
    T.SHAPES[type] = frames;
  });

  // Cell offsets of each rotation, precomputed so collision tests stay cheap.
  T.CELLS = {};
  T.TYPES.forEach(function (type) {
    T.CELLS[type] = T.SHAPES[type].map(function (m) {
      var cells = [];
      for (var y = 0; y < m.length; y++) {
        for (var x = 0; x < m.length; x++) {
          if (m[y][x]) cells.push([x, y]);
        }
      }
      return cells;
    });
  });

  /*
   * SRS wall kicks. The published tables use y-up; these are already negated
   * to screen space (y grows downward), so they can be applied as-is.
   * Key is "<from><to>" using rotation indices 0=spawn, 1=R, 2=180, 3=L.
   */
  var KICKS_JLSTZ = {
    '01': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '10': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '12': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '21': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '23': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '32': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '30': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '03': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
  };

  var KICKS_I = {
    '01': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '10': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '12': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
    '21': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '23': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
    '32': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
    '30': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
    '03': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
  };

  var NO_KICK = [[0, 0]];

  T.kicks = function (type, from, to) {
    if (type === 'O') return NO_KICK;
    var table = type === 'I' ? KICKS_I : KICKS_JLSTZ;
    return table['' + from + to] || NO_KICK;
  };

  // Guideline gravity curve, floored so the top levels stay humanly playable.
  T.MIN_GRAVITY_MS = 50;
  T.gravityMs = function (level) {
    var l = Math.min(level, 15);
    var seconds = Math.pow(0.8 - (l - 1) * 0.007, l - 1);
    return Math.max(T.MIN_GRAVITY_MS, seconds * 1000);
  };

  T.LINE_SCORES = [0, 100, 300, 500, 800];
  T.LINES_PER_LEVEL = 10;

  T.LOCK_DELAY_MS = 500;
  T.MAX_LOCK_RESETS = 15;
  T.CLEAR_ANIM_MS = 180;
  T.NEXT_COUNT = 5;

  T.DEFAULT_SETTINGS = {
    das: 130,
    arr: 25,
    softDrop: 25,
    ghost: true,
    grid: true,
    sound: true,
    music: false
  };
})(window.T = window.T || {});
