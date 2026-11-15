(() => {
  let enabled = window.initialUiPreferences?.resumePlayback !== false;
  let ready = false,
    restoring = false,
    lastSave = 0,
    pending = null,
    awaitingUserPlay = false,
    pendingRestore = null;
  const originalStart = start;
  start = function (...args) {
    if (!restoring) {
      awaitingUserPlay = false;
      return originalStart.apply(this, args);
    }
  };
  function capture() {
    if (!ready || !enabled || !current) return;
    let position = audio.currentTime + (current.remote ? window.remoteSeekOffset || 0 : 0);
    if (pendingRestore?.id === current.id) position = pendingRestore.position;
    if (current.duration && position >= current.duration - 1) position = 0;
    window.lumen.sessionState({
      current: current.id,
      position,
      queue: queue.map((t) => t.id),
      qi,
      upNext: upNext.map((t) => t.id),
      manualReturn: manualReturn.map((t) => t.id),
      shuffle,
      repeat,
    });
    lastSave = Date.now();
  }
  window.SoundSyncResume = {
    get enabled() {
      return enabled;
    },
    get awaitingUserPlay() {
      return awaitingUserPlay;
    },
    setEnabled(value) {
      enabled = !!value;
      window.lumen.preferencesSet({ resumePlayback: enabled }).catch(() => {});
      capture();
    },
  };
  window.lumen.onSessionCapture(capture);
  audio.addEventListener('timeupdate', () => {
    if (Date.now() - lastSave > 5000) capture();
  });
  for (const event of ['pause', 'seeked', 'play']) audio.addEventListener(event, capture);
  const originalRenderQueue = renderQueue;
  renderQueue = function (...args) {
    const result = originalRenderQueue.apply(this, args);
    clearTimeout(pending);
    pending = setTimeout(capture, 150);
    return result;
  };
  document.addEventListener('click', () => {
    clearTimeout(pending);
    pending = setTimeout(capture, 150);
  });
  window.addEventListener('beforeunload', capture);
  window.lumen
    .sessionLoad()
    .then((saved) => {
      if (!saved || current) return;
      queue = saved.queue.length ? saved.queue : [saved.current];
      qi = Math.max(0, saved.qi);
      upNext = saved.upNext;
      manualReturn = saved.manualReturn;
      shuffle = saved.shuffle;
      repeat = saved.repeat;
      $('shuffle').classList.toggle('active', shuffle);
      $('repeat').classList.toggle('active', repeat);
      const id = saved.current.id;
      pendingRestore = { id, position: saved.position || 0 };
      const restorePosition = () => {
        if (current?.id !== id) return;
        if (saved.current.remote) {
          const seek = $('seek');
          seek.value = String((saved.position / (saved.current.duration || 1)) * 1000);
          seek.dispatchEvent(new Event('input'));
          seek.dispatchEvent(new Event('change'));
        } else audio.currentTime = Math.min(saved.position || 0, Math.max(0, audio.duration - 0.5));
        pendingRestore = null;
      };
      audio.addEventListener('loadedmetadata', restorePosition, { once: true });
      restoring = true;
      awaitingUserPlay = true;
      try {
        load(saved.current);
        renderQueue();
      } finally {
        restoring = false;
      }
    })
    .catch(() => {})
    .finally(() => {
      ready = true;
    });
})();
