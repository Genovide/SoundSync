(() => {
  const reactions = new WeakMap();
  const typing = new WeakMap();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const reactionsInfo = {
    ball: [2000, 90],
    love: [1800, 85],
    treat: [2200, 85],
    track: [1800, 50],
    note: [1100, 85],
    level: [2300, 95],
    hello: [2200, 20],
    next: [1700, 95],
    previous: [1900, 95],
    energetic: [5600, 10],
    calm: [5200, 10],
    sad: [4700, 10],
    favorite: [2800, 90],
    volumeUp: [1200, 30],
    volumeDown: [1400, 30],
    shuffle: [2600, 80],
    repeat: [2200, 75],
    explore: [3200, 20],
    error: [5000, 70],
    finish: [4800, 60],
    wake: [650, 25],
    rest: [800, 25],
  };
  window.SoundSyncPetMotion = (host, reaction) => {
    const info = reactionsInfo[reaction];
    if (!host || !info) return false;
    const active = reactions.get(host);
    if (active && active.priority > info[1]) return false;
    const now = performance.now();
    if (
      active &&
      active.type === reaction &&
      (info[1] <= 30 || now - active.started < Math.min(active.duration * 0.7, 1200))
    )
      return false;
    const curled = host.querySelector('.pose-curl');
    const initiallyCurled =
      !!curled &&
      getComputedStyle(curled).display !== 'none' &&
      Number(getComputedStyle(curled).opacity) > 0.5;
    clearTimeout(active?.timer);
    active?.cancel?.(true);
    host.removeAttribute('data-pet-reaction');
    host.removeAttribute('data-pet-pose');
    host.dataset.petReaction = reaction;
    const cancel = window.SoundSyncPetChoreography?.(
      host,
      reaction,
      info[0],
      reducedMotion.matches,
      initiallyCurled
    );
    const state = {
      type: reaction,
      priority: info[1],
      cancel,
      started: now,
      duration: info[0] + 520,
    };
    state.timer = setTimeout(() => {
      if (reactions.get(host) !== state) return;
      cancel?.(false);
      host.removeAttribute('data-pet-reaction');
      host.removeAttribute('data-pet-pose');
      reactions.delete(host);
    }, info[0] + 520);
    reactions.set(host, state);
    return true;
  };
  window.SoundSyncPetMotion.cancel = (host) => {
    const active = reactions.get(host);
    clearTimeout(active?.timer);
    active?.cancel?.(false);
    host.removeAttribute('data-pet-reaction');
    host.removeAttribute('data-pet-pose');
    reactions.delete(host);
  };
  window.SoundSyncPetSpeak = (host, text) => {
    if (!host || host.dataset.message === text) return;
    clearTimeout(typing.get(host));
    host.dataset.message = text;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    const accessible = document.createElement('span');
    accessible.className = 'pet-sr-only';
    accessible.textContent = text;
    host.replaceChildren(visual, accessible);
    host.classList.toggle('pet-typing', !reducedMotion.matches);
    if (reducedMotion.matches) {
      visual.textContent = text;
      return;
    }
    const letters = Array.from(text);
    let index = 0;
    function type() {
      visual.textContent += letters[index++];
      if (index >= letters.length) {
        host.classList.remove('pet-typing');
        return;
      }
      typing.set(host, setTimeout(type, /[.!?…]/.test(letters[index - 1]) ? 150 : 24));
    }
    if (letters.length) type();
    else host.classList.remove('pet-typing');
  };
})();
