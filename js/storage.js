/* localStorage wrapper: best score and player settings, tolerant of private mode. */
(function (T) {
  'use strict';

  var BEST_KEY = 'neon-tetris:best';
  var SETTINGS_KEY = 'neon-tetris:settings';

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }

  function write(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* quota or private mode */ }
  }

  T.storage = {
    getBest: function () {
      var raw = parseInt(read(BEST_KEY), 10);
      return isFinite(raw) && raw > 0 ? raw : 0;
    },

    setBest: function (score) {
      write(BEST_KEY, String(score));
    },

    getSettings: function () {
      var settings = {}, raw = read(SETTINGS_KEY), saved = null;
      Object.keys(T.DEFAULT_SETTINGS).forEach(function (key) {
        settings[key] = T.DEFAULT_SETTINGS[key];
      });
      try { saved = JSON.parse(raw); } catch (e) { saved = null; }
      if (saved && typeof saved === 'object') {
        Object.keys(settings).forEach(function (key) {
          if (typeof saved[key] === typeof settings[key]) settings[key] = saved[key];
        });
      }
      return settings;
    },

    setSettings: function (settings) {
      write(SETTINGS_KEY, JSON.stringify(settings));
    }
  };
})(window.T = window.T || {});
