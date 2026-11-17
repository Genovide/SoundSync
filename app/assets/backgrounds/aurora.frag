#version 300 es
precision highp float;

uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
out vec4 fragColor;

/*--- BEGIN OF SHADERTOY ---*/

#define MAX_MARCHING_STEPS 128
#define MAX_DIST 6.
#define EPSILON 0.001
#define PI 3.1415926535

#define u_time iTime
#define u_resolution iResolution

#define CAMERA_HEIGHT 1.2
#define CAMERA_SPEED 0.001
#define CAMERA_DISTANCE 2.5
#define CAMERA_TARGET_X_MIN 0.9
#define CAMERA_TARGET_X_MAX 1.64
#define CAMERA_TARGET_Y_MIN -0.1
#define CAMERA_TARGET_Y_MAX 0.1
#define CAMERA_FOV 1.064

#define TERRAIN_OCTAVES_M 5
#define TERRAIN_OCTAVES_H 8
#define TERRAIN_OCTAVES_L 2

#define AURORA_LAYERS 32.
#define AURORA_SPEED 0.03
#define AURORA_HUE_SPEED 0.023

#define LIGHT_POS_X 10.
#define LIGHT_POS_Y 150.
#define LIGHT_POS_Z 100.
#define AMBIENT_INTENSITY 0.412
#define AMBIENT_COLOR vec3(0.931, 0.975, 0.906)
#define DIRECT_LIGHT_COLOR vec3(0.254, 1.000, 0.777)
#define DIRECT_LIGHT_INTENSITY vec3(0.162, 0.555, 0.560)

#define GROUND_COLOR vec3(0.026, 0.093, 0.100)
#define SKY_COLOR_TOP vec3(0.006, 0.026, 0.095)
#define SKY_COLOR_BOTTOM vec3(0.007, 0.011, 0.035)

#define STAR_THRESHOLD 0.707


float random(vec2 p)
{
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}


vec3 noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);

  vec2 df = 20.0*f*f*(f*(f-2.0)+1.0);
  f = f*f*f*(f*(f*6.-15.)+10.);

  float a = random(i + vec2(0.5));
  float b = random(i + vec2(1.5, 0.5));
  float c = random(i + vec2(.5, 1.5));
  float d = random(i + vec2(1.5, 1.5));

  float k = a - b - c + d;
  float n = mix(mix(a, b, f.x), mix(c, d, f.x), f.y);

  return vec3(n, vec2(b - a + k * f.y, c - a + k * f.x) * df);
}

mat2 terrainProps = mat2(0.8,-0.4, 0.5,0.8);
float fbmM(vec2 p) {
  vec2 df = vec2(0.0);
  float f = 0.0;
  float w = 0.5;

  for (int i = 0; i < TERRAIN_OCTAVES_M; i++) {
    vec3 n = noise(p);
    df += n.yz;
    f += abs(w * n.x / (1.0 + dot(df, df)));
    w *= 0.5;
    p = 2. * terrainProps * p;
  }
  return f;
}

float fbmH(vec2 p) {
  vec2 df = vec2(0.0);
  float f = 0.0;
  float w = 0.5;

  for (int i = 0; i < TERRAIN_OCTAVES_H; i++) {
    vec3 n = noise(p);
    df += n.yz;
    f += abs(w * n.x / (1.0 + dot(df, df)));
    w *= 0.5;
    p = 2. * terrainProps * p;
  }
  return f;
}


float fbmL(vec2 p) {
  vec2 df = vec2(0.0);
  float f = 0.0;
  float w = 0.5;

  for (int i = 0; i < TERRAIN_OCTAVES_L; i++) {
    vec3 n = noise(p);
    df += n.yz;
    f += abs(w * n.x / (1.0 + dot(df, df)));
    w *= 0.5;
    p = 2. * terrainProps * p;
  }
  return f;
}



float map(vec3 p) {
    float scene = p.y;
    
    float h = fbmM(p.xz);	
    scene -= h;

  	return scene;
}


float raymarch(vec3 ro, vec3 rd) {
  float d = 0.;
  float t = 0.;
  for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
    d = map(ro + t * rd);
    if (d < EPSILON * t || t > MAX_DIST) break;
    t += 0.5 * d;
  }

  return d < EPSILON * t ? t : -1.;
}

vec3 normal(vec3 pos, float t) {
	vec2  eps = vec2( 0.002*t, 0.0 );
    return normalize( vec3( fbmH(pos.xz-eps.xy) - fbmH(pos.xz+eps.xy),
                            2.0*eps.x,
                            fbmH(pos.xz-eps.yx) - fbmH(pos.xz+eps.yx) ) );
}

struct light {
  vec3 lightPosition;
  vec3 amibnetColor;
  float ambientIntencity;
  vec3 directLightColor;
  vec3 directLightIntencity;
};

vec3 diffuseLight(vec3 k_d, vec3 p, vec3 eye, vec3 lightPos, vec3 lightIntensity) {
  vec3 N = normal(p, 0.01);
  vec3 L = normalize(lightPos - p);

  float dotLN = dot(L, N);

  if (dotLN < 0.0) {
    return vec3(0.0, 0.0, 0.0);
  }

  return lightIntensity * (k_d * dotLN);
}

vec3 calcLights(light data, vec3 p, vec3 eye) {
  vec3 ambientColor = data.ambientIntencity * data.amibnetColor;
  vec3 phongColor = diffuseLight(data.directLightColor, p, eye, data.lightPosition, data.directLightIntencity);

  return ambientColor + phongColor;
}

mat3 calcLookAtMatrix(vec3 origin, vec3 target, float roll) {
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = cross(ww, rr);
  vec3 vv = cross(uu, ww);

  return mat3(uu, vv, ww);
}

void setColor(vec3 p, vec3 n, out vec3 color) {
  float a = smoothstep(0.340 * n.y, 0.916 * n.y, fbmM(p.xz));
  color = mix(GROUND_COLOR, vec3(1.), a);  
}

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
float tri(in float x){return clamp(abs(fract(x)-.5),0.01,0.49);}
vec2 tri2(in vec2 p){return vec2(tri(p.x)+tri(p.y),tri(p.y+tri(p.x)));}

float fbmAurora(vec2 p, float spd) {
    float z = 1.8;
    float z2 = 2.5;
	float rz = 0.;
    p *= mm2(p.x * 0.06);
    vec2 bp = p;
	for (float i = 0.; i < 5.; i++ ) {
        vec2 dg = tri2(bp*1.85)*.75;
        dg *= mm2(u_time*spd);
        p -= dg/z2;

        bp *= 1.3;
        z2 *= .45;
        z *= .42;
		p *= 1.21 + (rz-1.0)*.02;
        
        rz += tri(p.x+tri(p.y))*z;
        p*= sin(u_time * 0.05) * cos(u_time * 0.01);
	}
    return clamp(1. / pow(rz * 20., 1.3), 0.,1.);
}


vec4 aurora( vec3 rd) {
    vec4 col = vec4(0);
    vec4 avgCol = vec4(0);    

    for (float i=0.; i < AURORA_LAYERS; i++) {
        float of = 0.006*random(gl_FragCoord.xy)*smoothstep(0.,15., i);
        float pt = ((.8+pow(i,1.4)*.002)) / (rd.y * 2. + 0.4);
        pt -= of;
    	vec3 bpos = 5.5 + pt * rd;
        vec2 p = bpos.zx;
        float rzt = fbmAurora(p, AURORA_SPEED);
        vec4 col2 = vec4(0,0,0, rzt);
        float hue = fract(i * AURORA_HUE_SPEED + u_time * 0.1);
        vec3 rainbow = 0.5 + 0.5 * cos(6.28318 * (hue + vec3(0.0, 0.33, 0.67)));
        col2.rgb = rainbow * rzt;
        avgCol = mix(avgCol, col2, .5);
        col += avgCol * exp2(-i*0.065 - 2.5) * smoothstep(0., 5., i);
    }
    col *= (clamp(rd.y*15.+.4,0.,1.));
 
    return smoothstep(0.,1.1,pow(col,vec4(1.))*1.5);
}

vec3 stars(vec2 p) {
    float r = fbmL(p * 20.  );
    float isStar = step(STAR_THRESHOLD, r);
    return vec3(r) * isStar;
}

void setSkyColor(vec2 uv, out vec3 color, vec3 dir) {
   color = mix(SKY_COLOR_TOP, SKY_COLOR_BOTTOM, uv.y);
   color += stars(dir.xz / dir.y);
   color += aurora(dir).rgb;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  vec2 uv = fragCoord.xy / u_resolution.xy;
  vec2 p = (-u_resolution.xy + 2.0 * gl_FragCoord.xy) / u_resolution.y;

  float terrainEndTime = abs(sin(u_time * CAMERA_SPEED));
  vec3 ro = vec3(mix(0., 100., terrainEndTime), CAMERA_HEIGHT, mix(0., 100., terrainEndTime));
    
  float minHeight = 0.2 + 1.1 * fbmL(ro.xz);
  ro.y = minHeight;

  float a = sin(u_time * CAMERA_SPEED * 2.);	
  vec3 target = ro + vec3(mix(CAMERA_TARGET_X_MIN, CAMERA_TARGET_X_MAX, (sin(u_time * 0.25))),
                          mix(CAMERA_TARGET_Y_MIN, CAMERA_TARGET_Y_MAX, abs(sin(u_time * 0.125 + cos(u_time * 0.0125)))),
                          a) * CAMERA_DISTANCE;
  mat3 cam = calcLookAtMatrix(ro, target, 0.);
  vec3 rd = cam * normalize(vec3(p.xy, CAMERA_FOV));

  vec3 color = vec3(0.0);
  float scene = raymarch(ro, rd);
  vec3 point = ro + scene * rd;
  if (scene > -1.) {
    light light1 = light(
      ro + vec3(LIGHT_POS_X, LIGHT_POS_Y, LIGHT_POS_Z),
      AMBIENT_COLOR, AMBIENT_INTENSITY,
      DIRECT_LIGHT_COLOR, DIRECT_LIGHT_INTENSITY);

    vec3 nor = normal(point, scene);

    setColor(point, nor, color);

    color *= calcLights(light1, point, ro);
  } else {
    point = ro + scene * rd;
    setSkyColor(uv, color, rd);
  }

  color = pow(color, vec3(1. / 2.2));
  color = smoothstep(0., 1.,color);

  fragColor = vec4(color,1.0);
}

/*--- END OF SHADERTOY ---*/

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}
