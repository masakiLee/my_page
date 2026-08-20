/* 7-bag randomizer: every seven pieces contain each tetromino exactly once. */
(function (T) {
  'use strict';

  function Randomizer() {
    this.bag = [];
  }

  Randomizer.prototype.refill = function () {
    var bag = T.TYPES.slice(), i, j, tmp;
    for (i = bag.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
    }
    this.bag = bag;
  };

  Randomizer.prototype.next = function () {
    if (!this.bag.length) this.refill();
    return this.bag.pop();
  };

  Randomizer.prototype.reset = function () {
    this.bag = [];
  };

  T.Randomizer = Randomizer;
})(window.T = window.T || {});
