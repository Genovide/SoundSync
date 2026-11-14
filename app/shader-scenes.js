/* Шесть абстрактных WebGL-сцен визуализации: Аврора, Капля, Туннель, Лава, Орбиты, Клетки.
   Шейдеры перенесены из прототипа «SoundSync Visual Lab» без изменения логики. Единственная
   правка: в «Клетках» smoothstep с обратным порядком краёв записан как 1 - smoothstep(...)
   — значение то же, но такой вызов определён в GLSL и одинаково считается на всех видеокартах. */
(function (root) {
  const HEAD = `
precision highp float;
uniform vec2 R; uniform float T, B, M, H, K, I, F, P;
uniform vec3 C1, C2, C3, BG;
uniform sampler2D S;
float spec(float x){ return texture2D(S, vec2(clamp(x,0.,1.), .5)).r; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float h21(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
  for(int i=0;i<5;i++){ v+=a*n2(p); p=m*p; a*=.5; } return v; }
float h31(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x), f.y), f.z); }
vec3 finish(vec3 c){
  vec2 q = gl_FragCoord.xy / R;
  c *= .35 + .65 * pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y), .22);
  c = 1. - exp(-c * 1.6);
  c += (h21(gl_FragCoord.xy + fract(T*7.)*91.) - .5) * .035;
  return c * F;
}
`;
  const VERTEX = 'attribute vec2 p; void main(){ gl_Position=vec4(p,0.,1.); }';
  const PRESETS = {
    aurora: {
      name: 'Аврора',
      desc: 'Ленты северного сияния. Басы поднимают их, середина делает толще.',
      scale: 1.0,
      frag: `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  vec3 col=BG + C2*.06*(1.-length(uv));
  for(int i=0;i<6;i++){
    float fi=float(i);
    float n=fbm(vec2(uv.x*1.1+fi*1.7+T*.06*(1.+fi*.25), T*.07+fi*2.3));
    float off=(n-.5)*(.75+.6*B*I) + (fi-2.5)*.085;
    float d=abs(uv.y-off);
    float w=.006+.045*n*(.5+M*I);
    float s=spec(.04+fi*.11);
    float g=exp(-d*d/(w*w)*1.5)*.8 + .0022/(d+.004);
    float streak=.5+.5*fbm(vec2(uv.x*16.+fi*3., T*.35+fi));
    vec3 c=mix(C1,C2,fi/5.); c=mix(c,C3,smoothstep(.45,.8,n));
    col+=c*g*streak*(.3+.45*B*I+.5*s*I);
  }
  col+=C1*K*.08*I;
  gl_FragColor=vec4(finish(col),1.);
}`,
    },
    blob: {
      name: 'Капля',
      desc: 'Жидкий 3D-объект. Дышит на басах, на высоких частотах покрывается рябью.',
      scale: 0.8,
      frag: `
float map(vec3 p){
  p.xz*=rot(T*.25); p.xy*=rot(T*.17);
  float d=length(p)-(.72+.2*B*I);
  d+=(n3(p*1.6+vec3(0.,T*.5,0.))-.5)*.45*(.6+M*I);
  d+=sin(p.x*7.+T*3.)*sin(p.y*7.+T*2.3)*sin(p.z*7.+T*2.7)*.05*(.3+H*2.*I);
  return d*.55;
}
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  vec3 ro=vec3(0.,0.,4.), rd=normalize(vec3(uv,-1.6));
  float t=0., hit=0., md=9.;
  for(int i=0;i<80;i++){ vec3 p=ro+rd*t; float d=map(p); md=min(md,d); if(d<.001){hit=1.;break;} t+=d; if(t>7.)break; }
  float r=length(uv);
  vec3 col=BG + C2*.22*exp(-r*2.4)*(.5+B*I);
  col+=mix(C2,C1,.3)*exp(-md*14.)*.45*(1.-hit);
  if(hit>.5){
    vec3 p=ro+rd*t; vec2 e=vec2(.002,0.);
    vec3 n=normalize(vec3(map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx)));
    float fr=pow(1.-max(dot(n,-rd),0.),3.);
    vec3 l=normalize(vec3(.6,.8,.5));
    float dif=max(dot(n,l),0.), sp=pow(max(dot(reflect(rd,n),l),0.),40.);
    vec3 base=mix(C1,C2,.5+.5*n.y); base=mix(base,C3,.5+.5*sin(n.x*3.+T));
    col=base*(.12+.55*dif)+C3*fr*1.5+vec3(1.)*sp*.9;
  }
  col+=C1*K*.5*I*exp(-abs(r-.95-K*.35)*22.);
  gl_FragColor=vec4(finish(col),1.);
}`,
    },
    tunnel: {
      name: 'Туннель',
      desc: 'Полёт сквозь кольца. Каждое кольцо светится своей частотой, скорость задают басы.',
      scale: 1.0,
      frag: `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y; uv*=rot(T*.08);
  float r=length(uv)+1e-3, a=atan(uv.y,uv.x);
  float seg=6.28318/8., ka=abs(mod(a,seg)-seg*.5);
  float z=.35/r+P;
  float fz=fract(z*2.);
  float s=spec(fract(floor(z*2.)*.137)+.02);
  float ring=exp(-abs(fz-.5)*38.)*(.25+s*1.8*I);
  float spoke=exp(-ka*r*90.)*.55*(.4+M*I);
  float tiles=n2(vec2(ka*7., z*4.));
  vec3 c=mix(C1,C2,.5+.5*sin(z*.8)); c=mix(c,C3,s*.8);
  float fog=smoothstep(0.,.5,r);
  vec3 col=BG+(c*(ring+spoke)+c*tiles*.07)*fog;
  col+=C2*.05/(r*7.+.15)*(.5+B*I);
  col+=C1*K*.18*I*fog;
  gl_FragColor=vec4(finish(col),1.);
}`,
    },
    lava: {
      name: 'Лава',
      desc: 'Медленно перетекающий градиент с плёночным зерном. Спокойная сцена для фона.',
      scale: 0.75,
      frag: `
void main(){
  vec2 uv=gl_FragCoord.xy/R.y*1.4;
  float t=T*.6;
  vec2 q=vec2(fbm(uv+vec2(0.,t*.08)), fbm(uv+vec2(5.2,1.3)-t*.06));
  vec2 r2=vec2(fbm(uv+4.*q+vec2(1.7,9.2)+t*.15*(1.+B*I)), fbm(uv+4.*q+vec2(8.3,2.8)-t*.1));
  float f=fbm(uv+4.*r2*(.85+.3*B*I));
  vec3 col=mix(BG, C1, clamp(f*f*f*3.,0.,1.));
  col=mix(col, C2, clamp(length(q)*.9,0.,1.)*.85);
  col=mix(col, C3, clamp(r2.x*r2.x*1.2,0.,1.)*(.45+.4*M*I));
  col*= .2+1.15*f*f + .2*B*I + .12*K*I;
  gl_FragColor=vec4(finish(col*.95),1.);
}`,
    },
    orbits: {
      name: 'Орбиты',
      desc: 'Кольца, которые гнёт спектр. Внутренние отвечают за басы, внешние за высокие.',
      scale: 1.0,
      frag: `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;
  float r=length(uv), a=atan(uv.y,uv.x);
  vec3 col=BG + C2*.05*exp(-r*3.);
  for(int i=0;i<28;i++){
    float fi=float(i)/28.;
    float s=spec(.02+fi*.75);
    float rr=.07+fi*.43 + .03*B*I*(1.-fi);
    float k=3.+floor(fi*7.);
    float wob=(.008+.04*s*I)*sin(a*k+T*(.6+fi*1.4)*(mod(float(i),2.)*2.-1.)+fi*11.);
    float d=abs(r-rr-wob);
    vec3 c=mix(mix(C1,C2,fi),C3,s*.7);
    col+=c*(.0012+.0035*s*I)/(d+.0025)*(.35+s);
  }
  col+=C1*K*.35*I*exp(-abs(r-.05-K*.5)*30.);
  gl_FragColor=vec4(finish(col*.6),1.);
}`,
    },
    cells: {
      name: 'Клетки',
      desc: 'Живая сетка. Каждая ячейка слушает свою частоту и вспыхивает на ней.',
      scale: 1.0,
      frag: `
void main(){
  vec2 uv=(gl_FragCoord.xy-.5*R)/R.y; uv*=rot(T*.03); uv*=3.6-.5*B*I;
  vec2 g=floor(uv), f=fract(uv);
  float f1=8., f2=8.; vec2 id=vec2(0.);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){
    vec2 o=vec2(float(x),float(y));
    vec2 h=vec2(h21(g+o), h21(g+o+17.3));
    vec2 pt=o+.5+.4*sin(T*.7+6.2831*h)-f;
    float d=length(pt);
    if(d<f1){ f2=f1; f1=d; id=g+o; } else if(d<f2){ f2=d; }
  }
  float hid=h21(id), s=spec(.04+hid*.6);
  float edge=f2-f1;
  vec3 c=mix(C1,C2,hid); c=mix(c,C3,step(.78,hid));
  vec3 col=BG + c*.018/(edge+.014)*(.22+s*1.4*I);
  col+=c*(1.-smoothstep(0.,.55,f1))*s*s*.9*I;
  col+=C1*K*.15*I*(1.-smoothstep(0.,.12,edge));
  gl_FragColor=vec4(finish(col*.8),1.);
}`,
    },
  };
  const SPEC_N = 256;
  const BASE_BG = [0.055, 0.051, 0.063];
  const mixColor = (rgb, lift) => {
    const c = rgb.map((x) => x / 255),
      peak = Math.max(...c, 0.05);
    return c.map((x) => Math.min(1, (x / peak) * (0.75 + lift) + 0.04));
  };
  const reducedMotion = () =>
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  class ShaderScene {
    constructor() {
      this.canvas = document.createElement('canvas');
      this.programs = {};
      this.failed = {};
      this.frames = {};
      this.totalFrames = 0;
      this.time = 0;
      this.travel = 0;
      this.kick = 0;
      this.lastKick = -1;
      this.fade = 1;
      this.lastPreset = '';
      this.colors = null;
      this.spectrum = new Float32Array(SPEC_N);
      this.specBytes = new Uint8Array(SPEC_N);
      this.error = null;
      this.lost = false;
    }
    init() {
      const gl = this.canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      });
      if (!gl) throw Error('WebGL недоступен');
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      this.texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        SPEC_N,
        1,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        this.specBytes
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!this.watchingContext) {
        this.watchingContext = true;
        // Видеокарта может сбросить контекст (сон, смена GPU, сбой драйвера): кадр станет чёрным.
        this.canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          this.gl = null;
          this.programs = {};
          this.lost = true;
        });
        this.canvas.addEventListener('webglcontextrestored', () => {
          this.lost = false;
        });
      }
      this.gl = gl;
    }
    // Программы компилируются при первом показе сцены и кешируются.
    program(id) {
      if (this.programs[id]) return this.programs[id];
      const gl = this.gl;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
          throw Error(gl.getShaderInfoLog(shader) || 'Shader compile failed');
        return shader;
      };
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, HEAD + PRESETS[id].frag));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(program) || 'Shader link failed');
      const uniforms = {};
      for (const name of ['R', 'T', 'B', 'M', 'H', 'K', 'I', 'F', 'P', 'C1', 'C2', 'C3', 'BG', 'S'])
        uniforms[name] = gl.getUniformLocation(program, name);
      return (this.programs[id] = {
        program,
        uniforms,
        position: gl.getAttribLocation(program, 'p'),
      });
    }
    // Спектр 256×1 по логарифмической шкале 30 Гц … 16 кГц, вверх быстро, вниз плавно.
    updateSpectrum(freq, sampleRate, moving) {
      const nyquist = (sampleRate || 48000) / 2,
        bins = freq?.length || 0;
      for (let i = 0; i < SPEC_N; i++) {
        let target = 0;
        if (moving && bins) {
          const f = 30 * Math.pow(16000 / 30, i / (SPEC_N - 1));
          target = freq[Math.min(bins - 1, Math.round((f / nyquist) * bins))] / 255;
        }
        const old = this.spectrum[i];
        this.spectrum[i] = old + (target - old) * (target > old ? 0.6 : moving ? 0.15 : 0.05);
        this.specBytes[i] = Math.min(255, this.spectrum[i] * 255);
      }
    }
    // Возвращает false, если сцена не может быть нарисована: тогда показывается запасная 2D-сцена.
    draw(
      target,
      width,
      height,
      presetId,
      response,
      freq,
      sampleRate,
      fftSize,
      palette,
      dt,
      moving,
      intensity
    ) {
      const preset = PRESETS[presetId];
      if (!preset || this.error || this.lost || this.failed[presetId]) return false;
      try {
        if (!this.gl) this.init();
      } catch (e) {
        this.error = e;
        console.warn('Shader scenes:', e.message);
        return false;
      }
      const gl = this.gl;
      let compiled;
      try {
        compiled = this.program(presetId);
      } catch (e) {
        this.failed[presetId] = e;
        console.warn('Shader scene ' + presetId + ':', e.message);
        return false;
      }
      const seconds = Math.min(80, dt || 16) / 1000;
      // Длинная сторона не больше 1100 px; для тяжёлых сцен ещё меньше, как в прототипе.
      const scale = Math.min(1, 1100 / Math.max(width, height)) * preset.scale,
        w = Math.max(2, Math.round(width * scale)),
        h = Math.max(2, Math.round(height * scale));
      if (this.canvas.width !== w || this.canvas.height !== h) {
        this.canvas.width = w;
        this.canvas.height = h;
      }
      // На паузе сцена медленно дышит, а не замирает; при «уменьшить движение» всё медленнее.
      const pace = (moving ? 1 : 0.15) * (reducedMotion() ? 0.35 : 1),
        level = moving ? 1 : 0.35,
        bass = response.bass * level;
      this.time += seconds * pace;
      this.travel += seconds * pace * (0.35 + bass * 1.1 * intensity);
      if (moving && response.hit > 0.35 && this.time - this.lastKick >= 0.22) {
        this.kick = 1;
        this.lastKick = this.time;
      }
      this.kick = Math.max(0, this.kick - 3.2 * seconds);
      if (presetId !== this.lastPreset) {
        this.lastPreset = presetId;
        this.fade = 0;
      }
      this.fade = Math.min(1, this.fade + seconds / 0.4);
      this.updateSpectrum(freq, sampleRate, moving);
      const targetColors = [
        mixColor(palette[0], 0.35),
        mixColor(palette[1], 0.3),
        mixColor(palette[2], 0.25),
      ];
      if (!this.colors) this.colors = targetColors.map((c) => [...c]);
      const ease = 1 - Math.exp(-seconds * 2.5);
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
          this.colors[i][j] += (targetColors[i][j] - this.colors[i][j]) * ease;
      const bg = BASE_BG.map((x, i) => x + this.colors[0][i] * 0.06);
      gl.viewport(0, 0, w, h);
      gl.useProgram(compiled.program);
      gl.enableVertexAttribArray(compiled.position);
      gl.vertexAttribPointer(compiled.position, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        SPEC_N,
        1,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        this.specBytes
      );
      const u = compiled.uniforms;
      gl.uniform2f(u.R, w, h);
      gl.uniform1f(u.T, this.time);
      gl.uniform1f(u.B, bass);
      gl.uniform1f(u.M, response.mid * level);
      gl.uniform1f(u.H, response.high * level);
      gl.uniform1f(u.K, this.kick);
      gl.uniform1f(u.I, intensity);
      gl.uniform1f(u.F, this.fade);
      gl.uniform1f(u.P, this.travel);
      gl.uniform3fv(u.C1, this.colors[0]);
      gl.uniform3fv(u.C2, this.colors[1]);
      gl.uniform3fv(u.C3, this.colors[2]);
      gl.uniform3fv(u.BG, bg);
      gl.uniform1i(u.S, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const frames = (this.frames[presetId] = (this.frames[presetId] || 0) + 1);
      // Проверка вывода на 8-м и 60-м кадре сцены: сетка 4×4 точек. У «Лавы» и «Клеток» центр
      // не обязательно светится, поэтому смотрим на сумму по всей сетке.
      if (frames === 8 || frames === 60) {
        const pixel = new Uint8Array(4);
        let lit = 0;
        for (let y = 0; y < 4; y++)
          for (let x = 0; x < 4; x++) {
            gl.readPixels(
              Math.floor(((x + 0.5) / 4) * w),
              Math.floor(((y + 0.5) / 4) * h),
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixel
            );
            lit += pixel[0] + pixel[1] + pixel[2];
          }
        if (!lit || gl.isContextLost()) {
          this.failed[presetId] = Error('Видеокарта не отрисовала сцену');
          console.warn('Shader scene ' + presetId + ': blank output');
          return false;
        }
      }
      target.save();
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.imageSmoothingQuality = 'high';
      target.drawImage(this.canvas, 0, 0, width, height);
      target.restore();
      this.totalFrames++;
      return true;
    }
  }
  root.ShaderScene = ShaderScene;
  root.shaderScenePresets = Object.fromEntries(
    Object.entries(PRESETS).map(([id, p]) => [id, p.name])
  );
  root.shaderSceneInfo = Object.fromEntries(
    Object.entries(PRESETS).map(([id, p]) => [id, { name: p.name, desc: p.desc }])
  );
})(globalThis);
