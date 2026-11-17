/* A sealed record: no artwork or track metadata is loaded before the reveal. */
window.createIncognitoArt = (host) => {
  host.className = 'incognito-art';
  host.innerHTML = `<div class="incognito-aura"></div><div class="incognito-record-scene">
    <div class="incognito-vinyl"><div class="incognito-vinyl-label">✦</div></div>
    <div class="incognito-sleeve">
      <div class="incognito-face incognito-sealed">
        <span class="incognito-edition">SOUNDSYNC / INCOGNITO</span>
        <svg class="incognito-question" viewBox="0 0 80 100" fill="none"><path d="M22 28C22 5 60 5 60 28C60 44 40 44 40 61"/><path d="M40 80V81"/></svg>
        <div class="incognito-wave">${Array.from({ length: 13 }, () => '<b></b>').join('')}</div>
        <span class="incognito-seal-label">НЕИЗВЕСТНАЯ ЗАПИСЬ</span>
        <span class="incognito-serial">SS — 001</span>
      </div>
      <div class="incognito-face incognito-unsealed"><span class="incognito-cover-fallback">♫</span><img alt="" hidden></div>
    </div>
  </div><div class="incognito-record-shadow"></div><div class="incognito-sparks">${Array.from({ length: 6 }, () => '<b>✦</b>').join('')}</div>`;
  const find = (s) => host.querySelector(s);
  const scene = find('.incognito-record-scene');
  const sleeve = find('.incognito-sleeve');
  const vinyl = find('.incognito-vinyl');
  const bars = [...host.querySelectorAll('.incognito-wave b')];
  const sparks = [...host.querySelectorAll('.incognito-sparks b')];
  const image = find('img');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let loops = [],
    transition = null,
    playing = false,
    isRevealed = false;
  function cancel() {
    transition?.cancel();
    transition = null;
    loops.forEach((animation) => animation.cancel());
    loops = [];
  }
  function setPlaying(value) {
    playing = value;
    host.classList.toggle('is-playing', value);
    if (
      !value ||
      motion.matches ||
      isRevealed ||
      !host.closest('dialog')?.open ||
      document.hidden
    ) {
      loops.forEach((animation) => animation.pause());
      return;
    }
    if (loops.length) {
      loops.forEach((animation) => animation.resume());
      return;
    }
    loops.push(
      anime.animate(scene, {
        y: [0, -7],
        rotate: [-3, -1],
        duration: 2300,
        alternate: true,
        loop: true,
        ease: 'inOutSine',
      })
    );
    loops.push(
      anime.animate(find('.incognito-vinyl-label'), {
        rotate: [0, 360],
        duration: 9000,
        loop: true,
        ease: 'linear',
      })
    );
    bars.forEach((bar, i) =>
      loops.push(
        anime.animate(bar, {
          scaleY: [0.35, 1],
          duration: 420 + (i % 5) * 115,
          delay: i * 65,
          alternate: true,
          loop: true,
          ease: 'inOutSine',
        })
      )
    );
  }
  function reset(number = 1) {
    cancel();
    playing = false;
    isRevealed = false;
    host.classList.remove('is-revealed', 'is-playing', 'is-summary');
    image.hidden = true;
    image.removeAttribute('src');
    image.onerror = null;
    find('.incognito-serial').textContent = 'SS — ' + String(number).padStart(3, '0');
    find('.incognito-seal-label').textContent = 'НЕИЗВЕСТНАЯ ЗАПИСЬ';
    anime.utils.set(scene, { y: 0, rotate: -3 });
    anime.utils.set(sleeve, { rotateY: 0 });
    anime.utils.set(vinyl, { x: 0 });
    anime.utils.set(bars, { scaleY: 0.5 });
    anime.utils.set(sparks, { opacity: 0 });
  }
  function reveal(track) {
    cancel();
    playing = false;
    isRevealed = true;
    host.classList.remove('is-playing');
    host.classList.add('is-revealed');
    // Resolve the cover only now; the hidden face never exposes the answer.
    image.onerror = () => {
      image.hidden = true;
    };
    if (track.cover || track.customCover || track.remote) {
      image.hidden = false;
      image.src = media(track, true);
    }
    if (motion.matches) {
      anime.utils.set(scene, { y: 0, rotate: 0 });
      anime.utils.set(sleeve, { rotateY: 180 });
      anime.utils.set(vinyl, { x: -24 });
      return;
    }
    transition = anime
      .createTimeline({ autoplay: false, defaults: { ease: 'inOutCubic' } })
      .add(scene, { y: 0, rotate: 0, duration: 700 }, 0)
      .add(vinyl, { x: -24, duration: 350 }, 0)
      .add(sleeve, { rotateY: 180, duration: 900, ease: 'inOutQuint' }, 100);
    sparks.forEach((spark, i) => {
      const angle = (i / sparks.length) * Math.PI * 2;
      transition
        .add(
          spark,
          {
            x: [0, Math.cos(angle) * 115],
            y: [0, Math.sin(angle) * 95],
            scale: [0.3, 1],
            opacity: [0, 0.65],
            duration: 500,
            ease: 'outCubic',
          },
          460
        )
        .add(spark, { opacity: 0, duration: 550 }, 960);
    });
    transition.play();
  }
  function stop() {
    setPlaying(false);
    transition?.pause();
  }
  function resume() {
    if (transition && !transition.completed) transition.resume();
    setPlaying(playing);
  }
  motion.addEventListener('change', () => {
    const active = playing;
    if (isRevealed) {
      cancel();
      anime.utils.set(scene, { y: 0, rotate: 0 });
      anime.utils.set(sleeve, { rotateY: 180 });
      anime.utils.set(sparks, { opacity: 0 });
    } else {
      reset();
      setPlaying(active);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      loops.forEach((animation) => animation.pause());
      transition?.pause();
    } else if (host.closest('dialog')?.open) resume();
  });
  reset();
  return {
    reset,
    setPlaying,
    reveal,
    stop,
    resume,
    summary() {
      reset();
      host.classList.add('is-summary');
      find('.incognito-seal-label').textContent = 'ПЯТЬ ВСТРЕЧ СО ЗВУКОМ';
    },
  };
};
