#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_softness;
uniform float u_grain;
uniform float u_energy;
uniform float u_seed;
uniform float u_swirl;
uniform float u_fieldScale;
uniform vec2 u_phase;
uniform vec3 u_stops[5];
uniform float u_stopCount;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * valueNoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

/** Pre-warp the potential domain so finite-diff curl gains nested structure. */
vec2 nestPotential(vec2 p) {
  vec2 offset = vec2(
    fbm(p * 0.55 + vec2(2.3, 0.7)) - 0.5,
    fbm(p * 0.55 + vec2(0.9, 3.1)) - 0.5
  );
  return p + offset * 0.38;
}

// Finite-difference curl of a scalar potential (stable swirl at rest).
vec2 curlNoise(vec2 p) {
  vec2 nested = nestPotential(p);
  float e = 0.02;
  float nL = fbm(nested + vec2(-e, 0.0));
  float nR = fbm(nested + vec2(e, 0.0));
  float nD = fbm(nested + vec2(0.0, -e));
  float nU = fbm(nested + vec2(0.0, e));
  return vec2(nU - nD, nL - nR) / (2.0 * e);
}

vec3 sampleStops(float t) {
  float count = clamp(u_stopCount, 3.0, 5.0);
  float x = clamp(t, 0.0, 1.0) * (count - 1.0);
  float i0 = floor(x);
  float f = smoothstep(0.0, 1.0, fract(x));
  // Unrolled for portable dynamic stop counts (3-5).
  if (i0 < 0.5) return mix(u_stops[0], u_stops[1], f);
  if (i0 < 1.5) return mix(u_stops[1], u_stops[2], f);
  if (i0 < 2.5) return mix(u_stops[2], u_stops[3], f);
  return mix(u_stops[3], u_stops[4], f);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  // Softness lowers field frequency; energy lifts outer swirl structure.
  float soft = clamp(u_softness, 0.0, 1.0);
  float energy = clamp(u_energy, 0.0, 1.0);
  float scale = u_fieldScale * mix(1.25, 0.55, soft);
  float swirl = u_swirl * mix(0.8, 1.4, energy);

  vec2 q = p * scale + u_phase + vec2(u_seed * 11.0, u_seed * 7.0);
  vec2 warp = curlNoise(q) * swirl * 0.1;
  // Second octave of domain warp for liquid drift without animation.
  vec2 q2 = (p + warp) * (scale * 0.7) + vec2(3.1, 1.7) + u_phase.yx;
  warp += curlNoise(q2) * swirl * 0.055;
  // Third nest at lower amplitude for sky / swirl depth.
  vec2 q3 = (p + warp) * (scale * 0.45) + vec2(5.7, 2.3) + u_phase * 0.5;
  warp += curlNoise(q3) * swirl * 0.028;

  vec2 adv = p + warp;
  float structure = fbm(adv * 1.15 + u_seed * 5.0);
  // Stronger fbm coupling into palette t for secondary curl structure.
  float along = fract(adv.x * 0.55 + adv.y * 0.35 + structure * 0.42);
  // Softness also blends toward a calmer radial falloff mix.
  float radial = length(adv - vec2(0.5 * aspect, 0.5));
  float t = mix(along, fract(radial * 0.9 + along * 0.4), soft * 0.35);
  // Mild warp-magnitude carry so stop hues follow swirl without hard bands.
  float curlCarry = length(warp) / max(swirl * 0.18, 0.001);
  t = fract(t + (structure - 0.5) * 0.14 + curlCarry * 0.05);

  vec3 color = sampleStops(t);

  // Mild sat lift only; keep mix factor <= 1 so energy never overshoots into neon.
  float satBoost = 0.82 + energy * 0.18;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, satBoost);
  color = mix(color, smoothstep(0.0, 1.0, color), energy * 0.06);

  float gFine = hash21(gl_FragCoord.xy + u_seed * 1000.0);
  float gCoarse = valueNoise(gl_FragCoord.xy * 0.45 + u_seed * 40.0);
  float g = (gFine * 0.7 + gCoarse * 0.3 - 0.5) * u_grain * 0.38;
  color += g;

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
