(() => {
  const snapshots = new WeakMap();
  const smooth = 'cubic-bezier(.42,0,.58,1)';
  const rise = 'cubic-bezier(.18,.7,.3,1)';
  window.SoundSyncPetChoreography = (host, action, duration, reduced, initiallyCurled = false) => {
    host.classList.add('pet-choreographed');
    const animations = [],
      timers = [],
      touched = new Set();
    const previous = snapshots.get(host);
    snapshots.delete(host);
    let curled = initiallyCurled;
    function animate(selector, frames, options = {}) {
      for (const target of host.querySelectorAll(selector)) {
        const keyframes = frames.map((frame) => ({ easing: smooth, ...frame }));
        const from = previous?.get(target);
        if (from && !touched.has(target)) {
          if (keyframes[0].transform !== undefined) keyframes[0].transform = from.transform;
          if (keyframes[0].opacity !== undefined) keyframes[0].opacity = from.opacity;
        }
        touched.add(target);
        animations.push(
          target.animate(keyframes, { duration, easing: 'linear', fill: 'both', ...options })
        );
      }
    }
    function motion(selector, points) {
      animate(
        selector,
        points.map(([offset, transform, easing = smooth]) => ({ offset, transform, easing }))
      );
    }
    function later(time, callback) {
      timers.push(setTimeout(callback, time));
    }
    function pose(sleep, transition = 420) {
      if (sleep && host.closest('.playing,.pet-listening') && action !== 'error') return;
      if (sleep === curled) return;
      curled = sleep;
      host.dataset.petPose = 'transition';
      animate(
        '.pose-sit',
        [
          { opacity: sleep ? 1 : 0, transform: sleep ? 'none' : 'translateY(4px) scale(1.01,.94)' },
          { opacity: sleep ? 0 : 1, transform: sleep ? 'translateY(4px) scale(1.01,.94)' : 'none' },
        ],
        { duration: transition }
      );
      animate(
        '.pose-curl',
        [
          { opacity: sleep ? 0 : 1, transform: sleep ? 'scale(.98,.97)' : 'none' },
          { opacity: sleep ? 1 : 0, transform: sleep ? 'none' : 'scale(.98,.97)' },
        ],
        { duration: transition }
      );
      later(transition, () => {
        host.dataset.petPose = sleep ? 'curl' : 'sit';
      });
    }
    function particles(kind, start = 0.2) {
      host.querySelectorAll('.pet-' + kind).forEach((target, index) => {
        const delay = duration * start + index * 170;
        const life = Math.min(1400, Math.max(200, duration - delay - 120));
        animations.push(
          target.animate(
            [
              { opacity: 0, transform: 'translate(0,2px) scale(.7)', easing: rise },
              {
                opacity: 0.9,
                transform: 'translate(0,-4px) scale(1)',
                offset: 0.25,
                easing: 'ease-out',
              },
              { opacity: 0, transform: 'translate(' + (index - 1) * 16 + 'px,-30px) scale(.85)' },
            ],
            { duration: life, delay, easing: 'linear', fill: 'both' }
          )
        );
      });
    }
    function blink(start = 0.3, end = 0.7) {
      animate('.pet-lid-reveal', [
        { height: '0px', offset: 0 },
        { height: '0px', offset: start },
        { height: '1px', offset: start + 0.07 },
        { height: '1px', offset: end },
        { height: '0px', offset: Math.min(1, end + 0.08) },
        { height: '0px', offset: 1 },
      ]);
    }
    function flight(start, end, height, drift = 0) {
      return Array.from({ length: 13 }, (_, step) => {
        const t = step / 12;
        const y = -4 * height * t * (1 - t);
        const x = drift * Math.sin(Math.PI * t);
        return [start + (end - start) * t, 'translate(' + x + 'px,' + y + 'px)', 'linear'];
      });
    }
    function landing(at) {
      return [
        [at + 0.035, 'scale(1.035,.955)', rise],
        [at + 0.12, 'scale(.996,1.006)'],
        [at + 0.21, 'none'],
        [1, 'none'],
      ];
    }
    function shadow(start, end) {
      motion('.pet-ground-shadow', [
        [0, 'none'],
        [start, 'none'],
        [(start + end) / 2, 'scale(.65,1)'],
        [end, 'none'],
        [1, 'none'],
      ]);
      animate('.pet-ground-shadow', [
        { opacity: 0.14, offset: 0 },
        { opacity: 0.14, offset: start },
        { opacity: 0.07, offset: (start + end) / 2 },
        { opacity: 0.14, offset: end },
        { opacity: 0.14, offset: 1 },
      ]);
    }
    function flip(start, end) {
      const angles = [0, 12, 36, 74, 120, 176, 232, 282, 322, 348, 360];
      motion('.pet-turn', [
        [0, 'rotate(0deg)'],
        [start - 0.045, 'rotate(-5deg)'],
        ...angles.map((angle, index) => {
          const t = index / (angles.length - 1);
          const tuck = 1 - 0.09 * Math.sin(Math.PI * t);
          return [
            start + (end - start) * t,
            'rotate(' + angle + 'deg) scale(' + tuck + ')',
            'linear',
          ];
        }),
        [1, 'rotate(360deg)'],
      ]);
      motion('.pet-paw-left', [
        [0, 'none'],
        [start - 0.04, 'none'],
        [start + 0.05, 'skewX(8deg) scaleY(.92)'],
        [end - 0.04, 'skewX(8deg) scaleY(.92)'],
        [end + 0.04, 'none'],
        [1, 'none'],
      ]);
      motion('.pet-paw-right', [
        [0, 'none'],
        [start - 0.03, 'none'],
        [start + 0.06, 'skewX(-8deg) scaleY(.92)'],
        [end - 0.03, 'skewX(-8deg) scaleY(.92)'],
        [end + 0.05, 'none'],
        [1, 'none'],
      ]);
    }
    function hop(height = 14) {
      const start = 0.33,
        end = 0.57;
      motion('.pet-character', [
        [0, 'none'],
        [0.16, 'none'],
        [0.25, 'scale(1.03,.95)', rise],
        ...flight(start, end, height),
        ...landing(end),
      ]);
      motion('.pet-paw-left', [
        [0, 'none'],
        [0.3, 'none'],
        [0.4, 'skewX(5deg) scaleY(.96)'],
        [0.52, 'skewX(5deg) scaleY(.96)'],
        [0.61, 'none'],
        [1, 'none'],
      ]);
      motion('.pet-paw-right', [
        [0, 'none'],
        [0.31, 'none'],
        [0.41, 'skewX(-5deg) scaleY(.96)'],
        [0.53, 'skewX(-5deg) scaleY(.96)'],
        [0.62, 'none'],
        [1, 'none'],
      ]);
      motion('.pet-tail', [
        [0, 'none'],
        [0.25, 'rotate(-2deg)'],
        [0.38, 'rotate(-5deg)'],
        [0.48, 'rotate(6deg)'],
        [0.65, 'rotate(2deg)'],
        [0.82, 'none'],
        [1, 'none'],
      ]);
      shadow(start, end);
    }
    function look(direction = 1) {
      motion('.pet-head-motion', [
        [0, 'none'],
        [0.15, 'none'],
        [0.32, 'translate(' + direction * 3 + 'px,-1px) rotate(' + direction * 7 + 'deg)'],
        [0.57, 'translate(' + direction * 3 + 'px,0) rotate(' + direction * 6 + 'deg)'],
        [0.8, 'rotate(' + -direction + 'deg)'],
        [1, 'none'],
      ]);
      motion('.pet-ear-left', [
        [0, 'none'],
        [0.2, 'none'],
        [0.4, 'skewX(' + -direction * 3 + 'deg)'],
        [0.7, 'skewX(' + direction * 2 + 'deg)'],
        [1, 'none'],
      ]);
      motion('.pet-ear-right', [
        [0, 'none'],
        [0.22, 'none'],
        [0.42, 'skewX(' + direction * 3 + 'deg)'],
        [0.73, 'skewX(' + -direction * 2 + 'deg)'],
        [1, 'none'],
      ]);
    }
    function nod() {
      motion('.pet-head-motion', [
        [0, 'none'],
        [0.15, 'none'],
        [0.33, 'translateY(4px) rotate(2deg)'],
        [0.49, 'none'],
        [0.66, 'translateY(3px) rotate(1deg)'],
        [0.85, 'none'],
        [1, 'none'],
      ]);
    }
    const cancel = (interrupted = false) => {
      if (interrupted) {
        const values = new Map();
        animations.forEach((animation) => {
          const target = animation.effect?.target;
          if (!target || target.classList.contains('pet-effect')) return;
          const computed = getComputedStyle(target);
          values.set(target, { transform: computed.transform, opacity: computed.opacity });
        });
        snapshots.set(host, values);
      }
      timers.forEach(clearTimeout);
      animations.forEach((animation) => animation.cancel());
    };
    if (reduced) {
      if (['love', 'favorite', 'level'].includes(action))
        animate('.pet-heart', [{ opacity: 1 }, { opacity: 1 }]);
      if (action === 'finish') host.dataset.petPose = 'curl';
      return cancel;
    }
    const interruptedPose =
      previous?.has(host.querySelector('.pose-sit')) ||
      previous?.has(host.querySelector('.pose-curl'));
    if (initiallyCurled || interruptedPose) {
      curled = true;
      pose(false, interruptedPose ? 240 : 320);
    }
    switch (action) {
      case 'ball':
        hop(19);
        look(1);
        motion('.pet-paw-right', [
          [0, 'none'], [0.28, 'none'],
          [0.48, 'translate(7px,-7px) rotate(-12deg)'],
          [0.68, 'translate(3px,-3px) rotate(-5deg)'], [1, 'none'],
        ]);
        break;
      case 'next':
        look(1);
        hop(9);
        motion('.pet-paw-left', [
          [0, 'none'],
          [0.3, 'none'],
          [0.47, 'skewX(22deg)'],
          [0.57, 'skewX(13deg)'],
          [0.66, 'skewX(20deg)'],
          [0.84, 'none'],
          [1, 'none'],
        ]);
        particles('dust', 0.62);
        break;
      case 'previous':
        look(-1);
        motion('.pet-character', [
          [0, 'none'],
          [0.2, 'none'],
          [0.4, 'translateX(-5px)'],
          [0.65, 'translateX(-5px)'],
          [0.9, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-paw-left', [
          [0, 'none'],
          [0.24, 'skewX(3deg)'],
          [0.4, 'skewX(-5deg)'],
          [0.58, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-paw-right', [
          [0, 'none'],
          [0.38, 'none'],
          [0.54, 'skewX(5deg)'],
          [0.72, 'none'],
          [1, 'none'],
        ]);
        break;
      case 'love':
      case 'note':
      case 'level':
        hop(action === 'level' ? 18 : action === 'note' ? 9 : 13);
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.24, 'none'],
          [0.5, 'rotate(-3deg)'],
          [0.74, 'rotate(1deg)'],
          [1, 'none'],
        ]);
        blink(0.42, 0.61);
        particles(action === 'note' ? 'music-note' : 'heart', 0.4);
        break;
      case 'favorite':
        hop(16);
        motion('.pet-turn', [
          [0, 'none'],
          [0.64, 'none'],
          [0.78, 'scale(1.055)'],
          [0.88, 'scale(1.055)'],
          [1, 'none'],
        ]);
        motion('.pet-paw-left', [
          [0, 'none'],
          [0.36, 'none'],
          [0.51, 'skewX(12deg)'],
          [0.72, 'skewX(12deg)'],
          [0.91, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-paw-right', [
          [0, 'none'],
          [0.36, 'none'],
          [0.51, 'skewX(-12deg)'],
          [0.72, 'skewX(-12deg)'],
          [0.91, 'none'],
          [1, 'none'],
        ]);
        animate(
          '.pet-tail',
          [
            { transform: 'none' },
            { transform: 'rotate(11deg)', offset: 0.25 },
            { transform: 'rotate(-9deg)', offset: 0.75 },
            { transform: 'none' },
          ],
          { duration: 200, delay: 450, iterations: 8 }
        );
        animate('.pet-favorite-glow', [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.25 },
          { opacity: 0.75, offset: 0.5 },
          { opacity: 1, offset: 0.72 },
          { opacity: 0, offset: 1 },
        ]);
        blink(0.47, 0.68);
        particles('heart', 0.4);
        break;
      case 'energetic':
        motion('.pet-character', [
          [0, 'none'],
          [0.08, 'translateY(-1px)'],
          [0.16, 'none'],
          [0.23, 'translateY(-1px)'],
          [0.28, 'scale(1.025,.96)'],
          ...flight(0.32, 0.43, 13),
          [0.46, 'scale(1.03,.96)'],
          [0.5, 'none'],
          [0.56, 'scale(1.035,.94)'],
          ...flight(0.6, 0.75, 44, 5),
          [0.78, 'scale(1.035,.95)'],
          [0.87, 'none'],
          [1, 'none'],
        ]);
        flip(0.6, 0.75);
        shadow(0.6, 0.75);
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.8, 'none'],
          [0.85, 'rotate(-3deg)'],
          [0.9, 'rotate(3deg)'],
          [0.97, 'none'],
          [1, 'none'],
        ]);
        animate('.pet-mouth', [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.8 },
          { opacity: 1, offset: 0.84 },
          { opacity: 1, offset: 0.92 },
          { opacity: 0, offset: 1 },
        ]);
        particles('music-note', 0.79);
        break;
      case 'shuffle':
        motion('.pet-character', [
          [0, 'none'],
          [0.15, 'none'],
          [0.25, 'scale(1.035,.94)', rise],
          ...flight(0.32, 0.66, 44, 6),
          ...landing(0.66),
        ]);
        flip(0.32, 0.66);
        shadow(0.32, 0.66);
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.25, 'translateY(2px) rotate(2deg)'],
          [0.38, 'translateY(2px) rotate(2deg)'],
          [0.64, 'none'],
          [1, 'none'],
        ]);
        particles('dust', 0.72);
        break;
      case 'repeat':
        nod();
        motion('.pet-character', [
          [0, 'none'],
          [0.52, 'none'],
          [0.61, 'scale(1.02,.98)'],
          [0.73, 'translateY(-6px)'],
          [0.85, 'scale(1.02,.98)'],
          [1, 'none'],
        ]);
        particles('music-note', 0.62);
        break;
      case 'calm':
        motion('.pet-character', [
          [0, 'none'],
          [0.2, 'rotate(-1deg)'],
          [0.4, 'rotate(1deg)'],
          [0.6, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-tail', [
          [0, 'none'],
          [0.22, 'rotate(3deg)'],
          [0.48, 'rotate(-2deg)'],
          [0.7, 'none'],
          [1, 'none'],
        ]);
        blink(0.2, 0.67);
        later(duration * 0.48, () => pose(true));
        break;
      case 'sad':
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.25, 'translateY(3px) rotate(-3deg)'],
          [0.56, 'translateY(3px) rotate(-3deg)'],
          [0.83, 'none'],
          [1, 'none'],
        ]);
        blink(0.25, 0.64);
        later(duration * 0.5, () => pose(true));
        break;
      case 'volumeUp':
      case 'volumeDown': {
        const up = action === 'volumeUp';
        const rotation = up ? -4 : 7,
          stretch = up ? 1.11 : 0.9;
        motion('.pet-ear-left', [
          [0, 'none'],
          [0.23, 'none'],
          [0.48, 'skewX(' + rotation + 'deg) scaleY(' + stretch + ')'],
          [0.7, 'skewX(' + rotation + 'deg) scaleY(' + stretch + ')'],
          [1, 'none'],
        ]);
        motion('.pet-ear-right', [
          [0, 'none'],
          [0.26, 'none'],
          [0.51, 'skewX(' + -rotation + 'deg) scaleY(' + stretch + ')'],
          [0.73, 'skewX(' + -rotation + 'deg) scaleY(' + stretch + ')'],
          [1, 'none'],
        ]);
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.5, 'translateY(' + (up ? 0 : 2) + 'px)'],
          [1, 'none'],
        ]);
        if (up) {
          motion('.pet-character', [
            [0, 'none'],
            [0.25, 'none'],
            [0.5, 'scale(1.008,1.018)'],
            [0.76, 'scale(1.008,1.018)'],
            [1, 'none'],
          ]);
          motion('.pet-tail', [
            [0, 'none'],
            [0.35, 'rotate(-3deg)'],
            [0.55, 'rotate(6deg)'],
            [0.78, 'rotate(-2deg)'],
            [1, 'none'],
          ]);
        } else blink(0.35, 0.65);
        break;
      }
      case 'explore':
      case 'hello':
      case 'track':
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.14, 'none'],
          [0.3, 'rotate(-5deg)'],
          [0.45, 'rotate(-5deg)'],
          [0.62, 'rotate(5deg)'],
          [0.76, 'translateY(-2px) rotate(3deg)'],
          [0.94, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-character', [
          [0, 'none'],
          [0.3, 'translateX(-3px)'],
          [0.6, 'translateX(3px)'],
          [0.91, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-paw-left', [
          [0, 'none'],
          [0.2, 'skewX(4deg)'],
          [0.36, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-paw-right', [
          [0, 'none'],
          [0.47, 'none'],
          [0.62, 'skewX(-4deg)'],
          [0.78, 'none'],
          [1, 'none'],
        ]);
        break;
      case 'error':
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.16, 'translateY(4px) rotate(-3deg)'],
          [0.28, 'translate(2px,3px) rotate(7deg)'],
          [0.52, 'translate(2px,3px) rotate(7deg)'],
          [0.62, 'translateY(4px) rotate(-2deg)'],
          [0.73, 'translateY(4px) rotate(-2deg)'],
          [1, 'none'],
        ]);
        animate('.pet-scratch-arm', [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.2 },
          { opacity: 1, offset: 0.28 },
          { opacity: 1, offset: 0.51 },
          { opacity: 0, offset: 0.59 },
          { opacity: 0, offset: 1 },
        ]);
        animate('.pet-paw-right', [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.2 },
          { opacity: 0, offset: 0.28 },
          { opacity: 0, offset: 0.51 },
          { opacity: 1, offset: 0.59 },
          { opacity: 1, offset: 1 },
        ]);
        motion('.pet-scratch-paw', [
          [0, 'none'],
          [0.28, 'none'],
          [0.32, 'skewX(-6deg)'],
          [0.36, 'skewX(6deg)'],
          [0.4, 'skewX(-6deg)'],
          [0.44, 'skewX(6deg)'],
          [0.48, 'skewX(-3deg)'],
          [0.52, 'none'],
          [1, 'none'],
        ]);
        motion('.pet-character', [
          [0, 'none'],
          [0.77, 'none'],
          [0.86, 'scale(1.01,1.025)'],
          [0.96, 'scale(1,.99)'],
          [1, 'none'],
        ]);
        blink(0.31, 0.53);
        later(duration * 0.74, () => pose(true, 460));
        break;
      case 'finish':
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.2, 'translateY(-2px)'],
          [0.43, 'translateY(3px)'],
          [0.6, 'none'],
          [1, 'none'],
        ]);
        animate('.pet-mouth', [
          { opacity: 0, offset: 0 },
          { opacity: 1, offset: 0.19 },
          { opacity: 1, offset: 0.32 },
          { opacity: 0, offset: 0.46 },
          { opacity: 0, offset: 1 },
        ]);
        blink(0.22, 0.68);
        later(duration * 0.48, () => pose(true, 520));
        break;
      case 'wake':
        break;
      case 'rest':
        later(80, () => pose(true, 480));
        break;
      case 'treat':
        motion('.pet-head-motion', [
          [0, 'none'],
          [0.2, 'none'],
          [0.31, 'translateY(2px)'],
          [0.41, 'none'],
          [0.51, 'translateY(2px)'],
          [0.61, 'none'],
          [0.71, 'translateY(1px)'],
          [0.85, 'none'],
          [1, 'none'],
        ]);
        blink(0.37, 0.68);
        particles('music-note', 0.55);
        break;
      default:
        nod();
    }
    // Every gesture rejoins the current playback pose before its state is cleared.
    later(duration - 160, () => {
      const listening = !!host.closest('.playing,.pet-listening');
      pose(!listening, 480);
    });
    if (previous) {
      for (const [target, from] of previous) {
        if (touched.has(target) || !host.contains(target)) continue;
        const rest = getComputedStyle(target);
        animations.push(
          target.animate(
            [
              { transform: from.transform, opacity: from.opacity },
              { transform: rest.transform, opacity: rest.opacity },
            ],
            { duration: 240, easing: smooth, fill: 'both' }
          )
        );
      }
    }
    return cancel;
  };
})();
