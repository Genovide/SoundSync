/* Full-window scenes. The scene owns the interface palette while enabled. */
(() => {
  const scenes = {
    cover: { name: 'По обложке трека' },
    aurora: {
      name: 'Северное сияние',
      colors: [
        [70, 168, 146],
        [26, 60, 104],
        [135, 96, 168],
      ],
      time: 40,
    },
    clouds: {
      name: 'Облака',
      colors: [
        [92, 128, 195],
        [47, 37, 104],
        [139, 112, 183],
      ],
      time: -1000,
    },
  };
  Object.assign(scenes, window.SoundSyncBackgroundPresets.definitions);
  const body = document.body;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let mode = 'cover',
    renderer = null,
    generation = 0,
    error = '';
  try {
    mode = localStorage.getItem('app-background') || 'cover';
  } catch {}
  if (!scenes[mode]) mode = 'cover';
  const cssKeys = ['--cover-primary', '--cover-secondary', '--cover-tertiary', '--cover-tint'];
  function notify() {
    dispatchEvent(new CustomEvent('app-background-change'));
  }
  function palette(colors) {
    const selected = scenes[mode];
    if (!selected?.colors) return;
    // Lift scene colors for readable controls; panels keep their dark translucent tint.
    const lifted = colors.map((c) => {
      const peak = Math.max(...c);
      return c.map((v) =>
        Math.round(Math.min(255, v * (peak < 130 ? 130 / Math.max(peak, 1) : 1)))
      );
    });
    ['primary', 'secondary', 'tertiary'].forEach((key, i) =>
      body.style.setProperty('--cover-' + key, `rgb(${lifted[i].join(',')})`)
    );
    body.style.setProperty('--cover-tint', `rgba(${lifted[0].join(',')},.25)`);
  }
  function release(r) {
    if (!r) return;
    cancelAnimationFrame(r.frame);
    r.image && (r.image.onload = r.image.onerror = null);
    r.dispose?.();
    if (r.program) r.gl.deleteProgram(r.program);
    if (r.buffer) r.gl.deleteBuffer(r.buffer);
    if (r.texture) r.gl.deleteTexture(r.texture);
    r.canvas.remove();
    r.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function fail(message) {
    error = message;
    release(renderer);
    renderer = null;
    body.classList.add('app-background-fallback');
    notify();
  }
  function resize(r) {
    // No devicePixelRatio multiplier: pixel cost stays bounded even on 4K screens.
    const scale = Math.min(0.7, Math.sqrt(520000 / (innerWidth * innerHeight)));
    r.canvas.width = Math.max(2, Math.round(innerWidth * scale));
    r.canvas.height = Math.max(2, Math.round(innerHeight * scale));
    r.gl.viewport(0, 0, r.canvas.width, r.canvas.height);
    r.resize?.();
  }
  function sample(r) {
    const { gl, canvas } = r;
    const pixels = new Uint8Array(9 * 4);
    let i = 0;
    for (const y of [0.45, 0.65, 0.82]) {
      for (const x of [0.2, 0.5, 0.8]) {
        gl.readPixels(
          Math.floor(canvas.width * x),
          Math.floor(canvas.height * y),
          1,
          1,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels.subarray(i, i + 4)
        );
        i += 4;
      }
    }
    if (pixels.some((v, j) => j % 4 !== 3 && v > 28)) palette(CoverPalette.fromPixels(pixels));
  }
  function schedule(r) {
    cancelAnimationFrame(r.frame);
    r.frame = 0;
    if (document.hidden || renderer !== r || r.lost) return;
    r.last = 0;
    const tick = (ms) => {
      r.frame = 0;
      if (renderer !== r || document.hidden || r.lost) return;
      if (!r.last || ms - r.last >= 1000 / 24) {
        const dt = r.last ? Math.min(100, ms - r.last) : 0;
        r.last = ms;
        if (!motion.matches) r.time += dt * (mode === 'clouds' ? 0.0005 : 0.001);
        const { gl, uniforms: u, canvas } = r;
        if (r.draw) r.draw(r.time, dt);
        else {
          gl.useProgram(r.program);
          if (mode === 'aurora') {
            gl.uniform3f(u.resolution, canvas.width, canvas.height, 1);
            gl.uniform4f(u.mouse, 0, 0, 0, 0);
          } else {
            gl.uniform2f(u.resolution, canvas.width, canvas.height);
            gl.uniform2f(u.mouse, 0, 0);
            gl.uniform1f(u.scroll, 0);
          }
          gl.uniform1f(u.time, r.time);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        r.paints++;
        if (ms - r.sampled > 2200 || !r.sampled) {
          r.sampled = ms;
          sample(r);
        }
      }
      if (!motion.matches) r.frame = requestAnimationFrame(tick);
    };
    r.frame = requestAnimationFrame(tick);
  }
  function activate(r) {
    r.canvas.id = 'app-background-canvas';
    r.canvas.setAttribute('aria-hidden', 'true');
    r.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (renderer !== r) return;
      r.lost = true;
      cancelAnimationFrame(r.frame);
      error =
        'Видеокарта приостановила анимацию. Показываем статичный фон; можно выбрать сцену заново.';
      body.classList.add('app-background-fallback');
      r.canvas.hidden = true;
      notify();
    });
    r.canvas.addEventListener('webglcontextrestored', () => {
      if (renderer === r) set(mode, false);
    });
    renderer = r;
    body.prepend(r.canvas);
    resize(r);
    schedule(r);
    notify();
  }
  async function load(selected, token) {
    let r;
    try {
      if (window.SoundSyncBackgroundPresets.definitions[selected]) {
        r = await window.SoundSyncBackgroundPresets.create(selected, () => token === generation);
        if (token !== generation) {
          release(r);
          return;
        }
        activate(r);
        return;
      }
      const response = await fetch(`assets/backgrounds/${selected}.frag`);
      if (!response.ok) throw Error('Не удалось загрузить сцену.');
      const fragment = await response.text();
      if (token !== generation) return;
      const canvas = document.createElement('canvas');
      canvas.id = 'app-background-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: 'low-power',
      });
      if (!gl) throw Error('Видеокарта не поддерживает WebGL 2.');
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const detail = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw Error(detail);
        }
        return shader;
      };
      r = { canvas, gl, frame: 0, time: scenes[selected].time, paints: 0, sampled: 0 };
      const vertex = compile(
        gl.VERTEX_SHADER,
        '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
      );
      const frag = compile(gl.FRAGMENT_SHADER, fragment);
      r.program = gl.createProgram();
      gl.attachShader(r.program, vertex);
      gl.attachShader(r.program, frag);
      gl.linkProgram(r.program);
      gl.deleteShader(vertex);
      gl.deleteShader(frag);
      if (!gl.getProgramParameter(r.program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(r.program));
      gl.useProgram(r.program);
      r.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, r.buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      const pos = gl.getAttribLocation(r.program, 'p');
      gl.enableVertexAttribArray(pos);
      gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
      const loc = (key) => gl.getUniformLocation(r.program, key);
      r.uniforms =
        selected === 'aurora'
          ? { resolution: loc('iResolution'), time: loc('iTime'), mouse: loc('iMouse') }
          : {
              resolution: loc('u_resolution'),
              time: loc('u_time'),
              mouse: loc('u_mouse'),
              scroll: loc('u_scroll'),
            };
      if (selected === 'clouds') {
        r.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, r.texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        r.image = new Image();
        await new Promise((resolve, reject) => {
          r.image.onload = resolve;
          r.image.onerror = () => reject(Error('Не удалось загрузить текстуру облаков.'));
          r.image.src = 'assets/backgrounds/clouds.jpg';
        });
        if (token !== generation) {
          release(r);
          return;
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, r.image);
        gl.uniform1i(loc('u_bg'), 0);
      }
      if (token !== generation) {
        release(r);
        return;
      }
      activate(r);
    } catch {
      release(r);
      if (token === generation)
        fail(
          'Анимация недоступна. Используется статичный фон. Выбери другую сцену или фон по обложке.'
        );
    }
  }
  function set(value, persist = true) {
    if (!scenes[value]) return;
    const token = ++generation;
    release(renderer);
    renderer = null;
    error = '';
    mode = value;
    if (persist) {
      try {
        localStorage.setItem('app-background', mode);
      } catch {}
    }
    body.classList.toggle('animated-app-background', mode !== 'cover');
    body.classList.remove('app-background-fallback');
    body.dataset.appBackground = mode;
    if (mode === 'cover') cssKeys.forEach((key) => body.style.removeProperty(key));
    else {
      palette(scenes[mode].colors);
      load(mode, token);
    }
    notify();
  }
  addEventListener('resize', () => {
    if (renderer) {
      resize(renderer);
      schedule(renderer);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (renderer) schedule(renderer);
  });
  motion.addEventListener('change', () => {
    if (renderer) schedule(renderer);
  });
  addEventListener('pagehide', () => {
    generation++;
    release(renderer);
    renderer = null;
  });
  window.SoundSyncBackground = {
    set,
    get: () => ({
      mode,
      error,
      ready: !!renderer && !renderer.lost,
      frames: renderer?.paints || 0,
      running: !!renderer?.frame && !renderer.lost && !document.hidden,
      width: renderer?.canvas.width || 0,
      height: renderer?.canvas.height || 0,
    }),
    options: Object.entries(scenes).map(([value, scene]) => ({ value, name: scene.name })),
  };
  set(mode, false);
})();
