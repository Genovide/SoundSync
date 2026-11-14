(() => {
  const pet = window.SoundSyncPet;
  const hosts = () =>
    [document.querySelector('.player-pet-face'), document.querySelector('.pet-creature')].filter(
      Boolean
    );
  const cooldowns = new Map();
  let suppressTrackUntil = 0,
    suppressPauseUntilPlaying = false,
    browsingTimer,
    errorTimer,
    volumeTimer;
  let trackId = current?.id,
    lastBrowseInput = 0,
    lastInteraction = performance.now(),
    lastSpeech = 0;
  let volumeBaseline = audio.muted ? 0 : audio.volume;
  let lastVolumeGesture = -Infinity,
    previouslyPaused = audio.paused;

  function say(event) {
    pet.sayEvent(event);
    lastSpeech = performance.now();
  }
  function reaction(type, event = type, cooldown = 0) {
    const now = performance.now();
    if (now - (cooldowns.get(type) ?? -Infinity) < cooldown) return false;
    if (!pet.react(type)) return false;
    cooldowns.set(type, now);
    if (event) say(event);
    return true;
  }
  function volumeState() {
    const volume = audio.muted ? 0 : audio.volume;
    hosts().forEach((host) => {
      host.dataset.petVolume = volume <= 0.3 ? 'quiet' : volume >= 0.75 ? 'lively' : 'normal';
    });
    return volume;
  }
  function volumeGesture() {
    const volume = volumeState(),
      delta = volume - volumeBaseline;
    if (Math.abs(delta) > 0.004) reaction(delta > 0 ? 'volumeUp' : 'volumeDown');
    volumeBaseline = volume;
    lastVolumeGesture = performance.now();
  }
  audio.addEventListener('volumechange', () => {
    const volume = volumeState();
    if (Math.abs(volume - volumeBaseline) >= 0.03 && performance.now() - lastVolumeGesture > 500)
      volumeGesture();
    clearTimeout(volumeTimer);
    volumeTimer = setTimeout(volumeGesture, 140);
  });
  hosts().forEach((host) => {
    host.classList.add('pet-choreographed');
    delete host.dataset.petMood;
  });
  volumeState();

  audio.addEventListener(
    'playing',
    () => {
      clearTimeout(errorTimer);
      suppressPauseUntilPlaying = false;
      pet.react('wake');
      if (previouslyPaused && performance.now() >= suppressTrackUntil) say('playing');
      previouslyPaused = false;
    },
    true
  );
  audio.addEventListener(
    'pause',
    () => {
      pet.react('rest');
      previouslyPaused = true;
      if (!audio.ended && !suppressPauseUntilPlaying) say('paused');
    },
    true
  );

  const previousAdvance = advance;
  advance = async function (delta = 1, automatic = false) {
    const before = current?.id;
    if (!automatic && queue.length) {
      suppressTrackUntil = performance.now() + 3500;
      suppressPauseUntilPlaying = true;
      reaction(delta < 0 ? 'previous' : 'next', 'switch', 300);
    }
    const result = await previousAdvance.apply(this, arguments);
    if (automatic && before && current?.id === before) {
      if (audio.paused && !upNext.length) reaction('finish');
      else if (repeat) reaction('repeat');
    }
    return result;
  };
  const previousFavorite = toggleFavorite;
  toggleFavorite = function (id) {
    const liked = favorites.has(id);
    const result = previousFavorite.apply(this, arguments);
    if (!liked && favorites.has(id)) reaction('favorite', 'favorite', 1800);
    return result;
  };
  for (const [id, type] of [
    ['shuffle', 'shuffle'],
    ['shuffle-all', 'shuffle'],
    ['repeat', 'repeat'],
  ]) {
    $(id)?.addEventListener('click', () => {
      if (id === 'repeat' && !repeat) return;
      if (id === 'shuffle' && !shuffle) return;
      reaction(type, type, 500);
    });
  }
  audio.addEventListener('loadedmetadata', () => {
    clearTimeout(errorTimer);
    if (current?.id === trackId) return;
    const previous = trackId;
    trackId = current?.id;
    if (previous && performance.now() >= suppressTrackUntil) {
      reaction('track', 'switch');
      suppressTrackUntil = performance.now() + 1800;
    }
  });
  window.addEventListener('offline', () => reaction('error', 'error', 6000));
  window.addEventListener('online', () => say('online'));
  audio.addEventListener('error', () => {
    clearTimeout(errorTimer);
    const id = current?.id,
      source = audio.src,
      started = performance.now();
    function check() {
      if (id !== current?.id || source !== audio.src || !audio.error || audio.error.code === 1)
        return;
      if (window.localPlaybackRecovering?.has(id) && performance.now() - started < 12000) {
        errorTimer = setTimeout(check, 1000);
        return;
      }
      reaction('error', 'error', 6000);
    }
    errorTimer = setTimeout(check, 1500);
  });
  function exploreSoon() {
    clearTimeout(browsingTimer);
    browsingTimer = setTimeout(() => reaction('explore', 'explore', 6000), 420);
  }
  $('search')?.addEventListener('input', exploreSoon);
  const main = document.querySelector('main');
  main?.addEventListener(
    'wheel',
    () => {
      lastBrowseInput = performance.now();
    },
    { passive: true }
  );
  main?.addEventListener(
    'touchmove',
    () => {
      lastBrowseInput = performance.now();
    },
    { passive: true }
  );
  main?.addEventListener(
    'pointerdown',
    () => {
      lastBrowseInput = performance.now();
    },
    { passive: true }
  );
  document.addEventListener('keydown', (event) => {
    lastInteraction = performance.now();
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key))
      lastBrowseInput = performance.now();
  });
  document.addEventListener(
    'pointerdown',
    () => {
      lastInteraction = performance.now();
    },
    { passive: true }
  );
  main?.addEventListener(
    'scroll',
    () => {
      if (performance.now() - lastBrowseInput < 800) exploreSoon();
    },
    { passive: true }
  );
  // Track mood analysis is suspended. Playback always uses the same listening pose.
  setInterval(() => {
    if (document.hidden || !hosts().some((host) => host.checkVisibility())) return;
    if (hosts().some((host) => host.dataset.petReaction)) return;
    const now = performance.now();
    if (now - lastSpeech < 30000) return;
    if (audio.paused && now - lastInteraction >= 45000) say('idle');
    else if (!audio.paused) say(now - lastInteraction >= 45000 ? 'character' : 'playing');
  }, 1000);
})();
