#version 300 es
precision highp float;

uniform vec2 uView;
uniform float uScale;
uniform float uRotation;
uniform float uTime;
uniform float uWave;
uniform float uRipple;
uniform float uFold;
uniform vec2 uShift;
uniform vec4 uPointer;
uniform vec2 uDrag;
uniform vec4 uWaves[4];

const float e = 2.71828182845904523536;

float noise(vec2 texCoord) {
  float G = e;
  vec2 r = (G * sin(G * texCoord));
  return fract(r.x * r.y * (1.0 + texCoord.x));
}

vec2 rotateUvs(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  mat2 rot = mat2(c, -s, s, c);
  return rot * uv;
}

vec2 bend(vec2 uv) {
  vec2 aspect = vec2(uView.x / uView.y, 1.0);
  vec2 offset = (uv - uPointer.xy) * aspect;
  float touch = uPointer.z * exp(-dot(offset, offset) / (uPointer.w * uPointer.w));
  uv -= uDrag * touch;
  for (int i = 0; i < 4; i++) {
    vec4 wave = uWaves[i];
    if (wave.w <= 0.0) continue;
    vec2 q = (uv - wave.xy) * aspect;
    float dist = length(q);
    float front = dist - wave.z;
    float ring = exp(-front * front * 60.0) * wave.w;
    uv += q / max(dist, 0.0001) / aspect * ring * 0.034 * sin(front * 34.0);
  }
  return uv;
}

float silk(vec2 vUv) {
  vec2 uv = rotateUvs(vUv * uScale, uRotation);
  vec2 tex = uv * uScale + uShift;
  float tOffset = uTime;
  tex.y += 0.03 * uWave * sin(8.0 * tex.x - tOffset);
  return 0.6 + 0.4 * uFold * sin(5.0 * (tex.x + tex.y + cos(3.0 * tex.x + 5.0 * tex.y) + 0.02 * tOffset) + uRipple * sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));
}

out vec4 outColor;

void main() {
  vec2 vUv = gl_FragCoord.xy / uView;
  float pattern = silk(bend(vUv));
  float n = clamp((pattern - 0.2) / 0.8, 0.0, 1.0);
  outColor = vec4(pow(n, 6.0), 0.0, 0.0, 1.0);
}