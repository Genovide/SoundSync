/* Original effect shaders run through one bounded renderer, without React or extra loops. */
(() => {
  const definitions = {
    'soft-aurora': {
      name: 'Мягкое сияние',
      colors: [
        [168, 83, 210],
        [56, 94, 155],
        [112, 184, 174],
      ],
      files: ['soft-aurora'],
    },
    globe: {
      name: 'Globe',
      colors: [
        [255, 63, 129],
        [62, 37, 102],
        [179, 157, 219],
      ],
    },
    fog: {
      name: 'Туман',
      colors: [
        [218, 134, 82],
        [94, 61, 153],
        [207, 91, 100],
      ],
      files: ['fog'],
    },
    'dark-veil': {
      name: 'Тёмная вуаль',
      colors: [
        [107, 42, 219],
        [51, 28, 105],
        [157, 114, 211],
      ],
      files: ['dark-veil-field', 'dark-veil-composite'],
    },
    silk: {
      name: 'Шёлк',
      colors: [
        [135, 122, 157],
        [65, 55, 85],
        [175, 156, 193],
      ],
      files: ['silk-field', 'silk-composite'],
      fieldScale: 0.25,
    },
    galaxy: {
      name: 'Galaxy',
      colors: [
        [126, 151, 201],
        [50, 63, 104],
        [175, 142, 201],
      ],
      files: ['galaxy'],
    },
    'light-pillar': {
      name: 'Световой столб',
      colors: [
        [139, 94, 223],
        [90, 40, 174],
        [241, 152, 223],
      ],
      files: ['light-pillar-march', 'light-pillar-composite'],
      fieldScale: 0.6,
    },
  };
  let threePromise;
  function three() {
    if (window.THREE) return Promise.resolve();
    return (threePromise ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'vendor/three-r134.min.js';
      script.onload = resolve;
      script.onerror = () => {
        threePromise = null;
        script.remove();
        reject(Error('Three.js unavailable'));
      };
      document.head.append(script);
    }));
  }
  function uniforms(mode, time, w, h, pass, fw, fh) {
    const common = {
      uTime: time,
      uResolution: [w, h],
      uView: [w, h],
      uOpacity: 1,
      uPresence: 1,
      uFade: 0,
      uLightMode: 0,
    };
    if (mode === 'soft-aurora')
      return {
        ...common,
        uFlow: time * 0.6,
        uHue: time * 0.1,
        uScale: 1.5,
        uBrightness: 1,
        uColor1: [0.969, 0.969, 0.969],
        uColor2: [0.882, 0, 1],
        uNoiseFreq: 2.5,
        uNoiseAmp: 1,
        uBandHeight: 0.5,
        uBandSpread: 1,
        uOctaveDecay: 0.1,
        uLayerOffset: 0,
        uShift: [0, 0],
        uCursor: [(0.5 * w) / h, 0.5, 0, 0],
        uSpectrum: 1,
        uTilt: 0,
        uIntro: [1, 1, 1],
      };
    if (mode === 'fog')
      return {
        iTime: time * 0.6,
        iResolution: [w, h],
        iMouse: [0, 0],
        blurFactor: 0.6,
        zoom: 1,
        baseColor: [1, 0.922, 0.922],
        lowlightColor: [0.176, 0, 1],
        midtoneColor: [1, 0.122, 0],
        highlightColor: [1, 0.765, 0],
      };
    if (mode === 'galaxy')
      return {
        ...common,
        uFocal: [0.5, 0.5],
        uRotation: [1, 0],
        uGloss: time * 0.06,
        uDepth: time * 0.06,
        uDensity: 1,
        uHueShift: 140,
        uSpeed: 1,
        uMouse: [0.5, 0.5],
        uStarGlow: 0.015,
        uFlareGain: 0.3,
        uSquash: 0,
        uSaturation: 0.2,
        uMouseRepulsion: 0,
        uTwinkleIntensity: 0.3,
        uRotationAngle: time * 0.025,
        uRepulsionStrength: 0,
        uMouseActiveFactor: 0,
        uAutoCenterRepulsion: 0,
        uLayers: 4,
        uWarp: 0,
        uReveal: 1,
        uMode: 0,
        uBackground: [0.012, 0.016, 0.032],
      };
    if (mode === 'dark-veil')
      return {
        ...common,
        uScale: [w / fw, h / fh],
        uZoom: 1,
        uTurn: [1, 0],
        uTime: time * 0.5,
        uFlow: 1,
        uWarp: 0,
        uSeed: [0.39483331, 0.36, 0.14],
        uPointer: [w / 2, h / 2, 0, 0.42],
        uDrag: [0, 0],
        uUnfold: 0,
        uDither: 1 / 255,
        uTexel: [1 / fw, 1 / fh],
        uColor: [0.147, 0.006, 0.999],
        uInk: [0.3, 0.12, 0.6],
        uGain: 1.15,
        uSheen: 0.1,
        uGlow: 0.4,
        uGrain: 0.015,
        uLight: [0.5, 0.5, 0, 0],
        uField: 0,
      };
    if (mode === 'silk')
      return {
        ...common,
        uView: pass === 0 ? [fw, fh] : [w, h],
        uScale: 1,
        uRotation: 0,
        uTime: time * 0.5,
        uWave: 1,
        uRipple: 1,
        uFold: 1,
        uShift: [0, 0],
        uPointer: [0.5, 0.5, 0, 0.42],
        uDrag: [0, 0],
        uBloom: 0,
        uColor: [0.482, 0.455, 0.506],
        uSheenColor: [1, 1, 1],
        uNoiseIntensity: 0.4,
        uDepth: 0.5,
        uSheen: 0.5,
        uGlow: 0.3,
        uLight: [-0.3, 0.4, 0],
        uStep: [1 / w, 1 / h],
      };
    const tilt = (25 * Math.PI) / 180,
      angle = time * 0.06;
    return {
      ...common,
      uTarget: [fw, fh],
      uRot: [Math.cos(angle), Math.sin(angle)],
      uPillarRot: [Math.cos(tilt), Math.sin(tilt)],
      uWave: [Math.sin(0.4), Math.cos(0.4)],
      uShift: 0,
      uPillarWidth: 3,
      uPillarHeight: 0.4,
      uDetail: 4,
      uTopColor: [0.322, 0.153, 1],
      uBottomColor: [1, 0.624, 0.988],
      uGlowAmount: 0.002,
      uWidthNorm: 1,
      uField: 0,
      uFieldSize: [fw, fh],
      uAspect: [w / h, 1],
      uIntensity: 1,
      uNoiseIntensity: 0.3,
      uNeutral: 0,
      uBloom: 0.5,
      uReveal: 10000,
      uFlare: 0,
    };
  }
  function setUniforms(gl, program, values) {
    for (const u of program.uniforms) {
      const v = values[u.name];
      if (v === undefined) continue;
      switch (u.type) {
        case gl.FLOAT:
          gl.uniform1f(u.location, v);
          break;
        case gl.INT:
        case gl.BOOL:
        case gl.SAMPLER_2D:
          gl.uniform1i(u.location, v);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(u.location, v);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(u.location, v);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(u.location, v);
          break;
      }
    }
  }
  async function create(mode, isCurrent = () => true) {
    const config = definitions[mode];
    if (!config) throw Error('Unknown background');
    if (mode === 'globe') {
      await three();
      if (!isCurrent()) return null;
      const r = window.createSoundSyncGlobe(document.createElement('canvas'));
      return { ...r, frame: 0, time: 8, paints: 0, sampled: 0 };
    }
    const sources = await Promise.all(
      config.files.map(async (file) => {
        const response = await fetch(`assets/backgrounds/${file}.frag`);
        if (!response.ok) throw Error('Missing shader');
        return response.text();
      })
    );
    if (!isCurrent()) return null;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: 'low-power',
    });
    if (!gl) throw Error('WebGL 2 unavailable');
    const programs = [],
      shaders = [];
    let buffer, texture, framebuffer;
    const dispose = () => {
      programs.forEach((p) => gl.deleteProgram(p.program));
      shaders.forEach((s) => gl.deleteShader(s));
      if (buffer) gl.deleteBuffer(buffer);
      if (texture) gl.deleteTexture(texture);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
    };
    try {
      const compile = (type, source) => {
        const s = gl.createShader(type);
        shaders.push(s);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(s));
        return s;
      };
      const vertex = compile(
        gl.VERTEX_SHADER,
        '#version 300 es\nin vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'
      );
      for (const source of sources) {
        const p = gl.createProgram();
        const entry = { program: p, uniforms: [] };
        programs.push(entry);
        gl.attachShader(p, vertex);
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, source));
        gl.bindAttribLocation(p, 0, 'p');
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(p));
        for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) {
          const u = gl.getActiveUniform(p, i);
          entry.uniforms.push({
            name: u.name.replace(/\[0\]$/, ''),
            type: u.type,
            location: gl.getUniformLocation(p, u.name),
          });
        }
      }
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW
      );
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      if (programs.length > 1) {
        texture = gl.createTexture();
        framebuffer = gl.createFramebuffer();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      }
      let fw = 0,
        fh = 0;
      return {
        canvas,
        gl,
        frame: 0,
        time: 8,
        paints: 0,
        sampled: 0,
        dispose,
        resize() {
          if (!texture) return;
          fw = Math.max(2, Math.round(canvas.width * (config.fieldScale || 1)));
          fh = Math.max(2, Math.round(canvas.height * (config.fieldScale || 1)));
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
          if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
            throw Error('Incomplete scene target');
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        },
        draw(time) {
          for (let i = 0; i < programs.length; i++) {
            const field = programs.length > 1 && i === 0;
            gl.bindFramebuffer(gl.FRAMEBUFFER, field ? framebuffer : null);
            gl.viewport(0, 0, field ? fw : canvas.width, field ? fh : canvas.height);
            gl.useProgram(programs[i].program);
            if (!field && texture) {
              gl.activeTexture(gl.TEXTURE0);
              gl.bindTexture(gl.TEXTURE_2D, texture);
            }
            setUniforms(
              gl,
              programs[i],
              uniforms(mode, time, canvas.width, canvas.height, i, fw, fh)
            );
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            if (field) {
              gl.bindTexture(gl.TEXTURE_2D, texture);
              gl.generateMipmap(gl.TEXTURE_2D);
            }
          }
        },
      };
    } catch (e) {
      dispose();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw e;
    }
  }
  window.SoundSyncBackgroundPresets = { definitions, create };
})();
