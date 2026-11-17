#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2 uResolution;
uniform vec2 uTexel;
uniform vec3 uColor;
uniform vec3 uInk;
uniform float uGain;
uniform float uSheen;
uniform float uGlow;
uniform float uPresence;
uniform float uGrain;
uniform float uFade;
uniform float uOpacity;
uniform float uTime;
uniform float uLightMode;
uniform vec4 uLight;
out vec4 outColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float smootherstep(float edge, float x) {
  float t = clamp(x / max(edge, 0.0001), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float level(vec2 uv, float lod) {
  return textureLod(uField, uv, lod).b;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float base = clamp(level(uv, 0.0), 0.0, 1.0);
  float glow = 0.0;
  glow += level(uv, 2.0) * 0.4;
  glow += level(uv, 3.0) * 0.3;
  glow += level(uv, 4.0) * 0.2;
  glow += level(uv, 5.0) * 0.1;

  float dx = level(uv + vec2(uTexel.x, 0.0), 0.0) - level(uv - vec2(uTexel.x, 0.0), 0.0);
  float dy = level(uv + vec2(0.0, uTexel.y), 0.0) - level(uv - vec2(0.0, uTexel.y), 0.0);
  vec2 slope = vec2(dx / (2.0 * uTexel.x) * (uResolution.y / uResolution.x), dy / (2.0 * uTexel.y));
  vec3 normal = normalize(vec3(-slope * 0.12, 1.0));
  vec2 pixel = gl_FragCoord.xy / uResolution.y;
  vec3 toLight = normalize(vec3(uLight.xy - pixel, 0.7));
  vec3 halfway = normalize(toLight + vec3(0.0, 0.0, 1.0));
  float facing = max(dot(normal, halfway), 0.0);
  float sheen = pow(facing, 40.0) * smoothstep(0.08, 0.7, base);
  float near = uLight.z * exp(-dot(uLight.xy - pixel, uLight.xy - pixel) / 0.2);

  float energy = pow(base, 2.2) * uGain * (1.0 + near * 0.4);
  energy += pow(glow, 2.2) * uGlow * uGain;
  energy *= uPresence;
  vec3 light = uColor * energy;
  light += uColor * energy * energy * 0.35;
  vec3 gleam = mix(uColor * 2.0, vec3(1.0), 0.55);
  light += gleam * sheen * uSheen * (0.8 + near * 0.4) * uPresence;

  float edge = uFade * 0.5;
  float mask = smootherstep(edge, uv.x) * smootherstep(edge, 1.0 - uv.x) * smootherstep(edge, uv.y) * smootherstep(edge, 1.0 - uv.y);
  mask *= uOpacity;
  float grain = (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * uGrain;
  float dither = (hash(gl_FragCoord.yx + 31.7) - 0.5) / 255.0;

  float peak = max(light.r, max(light.g, light.b));
  if (uLightMode > 0.5) {
    float cover = 1.0 - exp(-peak * 1.6);
    vec3 ink = mix(uInk, uInk * 0.82, smoothstep(0.5, 1.0, cover));
    ink = mix(ink, vec3(1.0), clamp(sheen * uSheen * 1.5, 0.0, 1.0) * 0.8);
    float alpha = clamp(cover * 0.85 * (1.0 + grain) + dither, 0.0, 1.0) * mask;
    outColor = vec4(ink * alpha, alpha);
  } else {
    vec3 color = 1.0 - exp(-light);
    color = pow(color, vec3(1.0 / 2.2));
    color = clamp(color + grain * peak + dither, 0.0, 1.0) * mask;
    outColor = vec4(color, max(color.r, max(color.g, color.b)));
  }
}