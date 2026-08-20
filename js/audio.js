/* Synthesised sound. No audio files: every effect and the theme are generated
   with the Web Audio API, so the whole game stays a single static folder. */
(function (T) {
  'use strict';

  var ctx = null;
  var master = null, sfxBus = null, musicBus = null;
  var soundOn = true, musicOn = false;

  // Korobeiniki, the traditional folk melody used as the Tetris theme.
  // Each entry is [midi note (0 = rest), length in beats].
  var MELODY = [
    [76, 1], [71, 0.5], [72, 0.5], [74, 1], [72, 0.5], [71, 0.5],
    [69, 1], [69, 0.5], [72, 0.5], [76, 1], [74, 0.5], [72, 0.5],
    [71, 1.5], [72, 0.5], [74, 1], [76, 1],
    [72, 1], [69, 1], [69, 2],
    [0, 0.5], [74, 1.5], [77, 0.5], [81, 1], [79, 0.5],
    [77, 0.5], [76, 1.5], [72, 0.5], [76, 1], [74, 0.5],
    [72, 1], [71, 1], [71, 0.5], [72, 0.5], [74, 1],
    [76, 1], [72, 1], [69, 1], [69, 1]
  ];
  var BASS = [40, 40, 45, 45, 40, 40, 45, 47, 50, 50, 48, 48, 47, 47, 40, 40];
  var LOOP_BEATS = 32;

  var timeline = [];
  (function buildTimeline() {
    var beat = 0, i;
    for (i = 0; i < MELODY.length; i++) {
      if (MELODY[i][0]) timeline.push({ beat: beat, midi: MELODY[i][0], dur: MELODY[i][1], lead: true });
      beat += MELODY[i][1];
    }
    for (i = 0; i < BASS.length; i++) {
      timeline.push({ beat: i * 2, midi: BASS[i], dur: 1.7, lead: false });
    }
    timeline.sort(function (a, b) { return a.beat - b.beat; });
  })();

  var musicTimer = null, loopStart = 0, eventIndex = 0, bpm = 140;

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function ensureContext() {
    if (ctx) return ctx;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = soundOn ? 1 : 0;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = musicOn ? 0.34 : 0;
    musicBus.connect(master);
    return ctx;
  }

  function tone(opts) {
    if (!ensureContext()) return;
    var start = opts.at || ctx.currentTime;
    var dur = opts.dur || 0.1;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();

    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.freq, start);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), start + dur);

    var peak = opts.gain === undefined ? 0.2 : opts.gain;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(gain);
    gain.connect(opts.bus || sfxBus);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function noise(opts) {
    if (!ensureContext()) return;
    var dur = opts.dur || 0.08;
    var frames = Math.floor(ctx.sampleRate * dur);
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    var src = ctx.createBufferSource();
    src.buffer = buffer;

    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = opts.cutoff || 1200;

    var gain = ctx.createGain();
    gain.gain.value = opts.gain === undefined ? 0.18 : opts.gain;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    src.start();
  }

  function arpeggio(notes, step, type, gain) {
    if (!ensureContext()) return;
    var now = ctx.currentTime;
    notes.forEach(function (midi, i) {
      tone({
        freq: midiToFreq(midi),
        at: now + i * step,
        dur: step * 2.2,
        type: type || 'triangle',
        gain: gain === undefined ? 0.22 : gain
      });
    });
  }

  var effects = {
    move: function () { tone({ freq: 200, dur: 0.03, type: 'square', gain: 0.08 }); },
    rotate: function () { tone({ freq: 320, dur: 0.05, type: 'square', gain: 0.1 }); },
    kick: function () { tone({ freq: 420, slideTo: 620, dur: 0.07, type: 'square', gain: 0.11 }); },
    hold: function () { tone({ freq: 520, slideTo: 700, dur: 0.09, type: 'triangle', gain: 0.14 }); },
    harddrop: function () {
      tone({ freq: 300, slideTo: 70, dur: 0.09, type: 'sawtooth', gain: 0.14 });
      noise({ dur: 0.09, cutoff: 900, gain: 0.14 });
    },
    lock: function () { tone({ freq: 130, slideTo: 80, dur: 0.07, type: 'square', gain: 0.12 }); },
    clear1: function () { arpeggio([72, 76, 79], 0.055); },
    clear2: function () { arpeggio([72, 76, 79, 83], 0.055); },
    clear3: function () { arpeggio([72, 76, 79, 84, 88], 0.05); },
    clear4: function () { arpeggio([72, 79, 84, 88, 91, 96], 0.05, 'square', 0.24); },
    levelup: function () { arpeggio([69, 73, 76, 81], 0.07, 'triangle', 0.2); },
    gameover: function () { arpeggio([72, 68, 65, 60, 53], 0.13, 'sawtooth', 0.18); }
  };

  /* --- music scheduling ---------------------------------------------------- */

  function scheduleMusic() {
    if (!ctx || !musicOn) return;
    var secPerBeat = 60 / bpm;
    var horizon = ctx.currentTime + 0.2;
    var guard = 0;

    // A backgrounded tab freezes the timer; resync rather than replaying the backlog.
    if (loopStart < ctx.currentTime - 1) {
      loopStart = ctx.currentTime;
      eventIndex = 0;
    }

    while (loopStart + timeline[eventIndex].beat * secPerBeat < horizon && guard++ < 64) {
      var ev = timeline[eventIndex];
      var at = loopStart + ev.beat * secPerBeat;
      tone({
        freq: midiToFreq(ev.midi),
        at: Math.max(at, ctx.currentTime),
        dur: Math.max(0.08, ev.dur * secPerBeat * 0.9),
        type: ev.lead ? 'square' : 'triangle',
        gain: ev.lead ? 0.16 : 0.2,
        bus: musicBus
      });

      eventIndex++;
      if (eventIndex >= timeline.length) {
        eventIndex = 0;
        loopStart += LOOP_BEATS * secPerBeat;
      }
    }
  }

  function startMusic() {
    if (!ensureContext() || musicTimer) return;
    loopStart = ctx.currentTime + 0.1;
    eventIndex = 0;
    musicTimer = window.setInterval(scheduleMusic, 30);
    scheduleMusic();
  }

  function stopMusic() {
    if (musicTimer) {
      window.clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  T.audio = {
    /* Browsers only allow audio after a gesture, so this is called on first input. */
    unlock: function () {
      if (!ensureContext()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (musicOn) startMusic();
    },

    play: function (name) {
      if (!soundOn || !effects[name]) return;
      if (!ensureContext() || ctx.state === 'suspended') return;
      effects[name]();
    },

    playClear: function (count) {
      this.play('clear' + Math.min(4, Math.max(1, count)));
    },

    setSound: function (on) {
      soundOn = !!on;
      if (sfxBus) sfxBus.gain.value = soundOn ? 1 : 0;
    },

    setMusic: function (on) {
      musicOn = !!on;
      if (!ensureContext()) return;
      musicBus.gain.value = musicOn ? 0.34 : 0;
      if (musicOn) startMusic();
      else stopMusic();
    },

    /* The theme speeds up as the stack gets faster. */
    setLevel: function (level) {
      bpm = Math.min(200, 132 + (level - 1) * 5);
    },

    suspendMusic: stopMusic,

    resumeMusic: function () {
      if (musicOn) startMusic();
    }
  };
})(window.T = window.T || {});
