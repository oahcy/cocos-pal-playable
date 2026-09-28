(function (root) {
  'use strict';
  var finished = false;
  var listeners = { pause: [], resume: [], mute: [] };
  function subscribe(event, callback) {
    if (typeof callback !== 'function') throw new TypeError('callback must be a function');
    listeners[event].push(callback);
    return function () { var i = listeners[event].indexOf(callback); if (i >= 0) listeners[event].splice(i, 1); };
  }
  function emit(event, value) { listeners[event].slice().forEach(function (fn) { fn(value); }); }
  root.playable = Object.freeze({
    capabilities: Object.freeze({ openStore: true, finishNotification: false, containerLifecycle: false }),
    openStore: function () {
      if (typeof root.openAppStore !== 'function') throw new Error('TikTok Playable SDK is unavailable');
      root.openAppStore();
    },
    finish: function () { if (finished) return; finished = true; },
    onPause: function (fn) { return subscribe('pause', fn); },
    onResume: function (fn) { return subscribe('resume', fn); },
    onMuteChange: function (fn) { var off = subscribe('mute', fn); fn(muted()); return off; },
  });
  // Browser visibility is a baseline only; real-container lifecycle remains to be verified.
  var interacted = false;
  function muted() { return !interacted || document.hidden; }
  document.addEventListener('visibilitychange', function () {
    emit(document.hidden ? 'pause' : 'resume'); emit('mute', muted());
  });
  document.addEventListener('pointerdown', function () {
    interacted = true; emit('mute', muted());
  }, { once: true });
})(window);
