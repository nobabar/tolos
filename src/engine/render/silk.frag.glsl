#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_softness;
uniform float u_grain;
uniform float u_energy;
uniform float u_seed;
uniform float u_foldAngle;
uniform float u_foldFreq;
uniform float u_sheen;
uniform float u_iterations;
uniform vec3 u_colors[3];

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

// Cap: 8 iterations max for full-screen main-thread paint.
const int SILK_MAX_ITERS = 8;

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  float soft = clamp(u_softness, 0.0, 1.0);
  float ca = cos(u_foldAngle);
  float sa = sin(u_foldAngle);
  vec2 foldAxis = vec2(ca, sa);
  vec2 crossAxis = vec2(-sa, ca);

  // Softness lowers fold frequency and spreads warp amplitude.
  float baseFreq = u_foldFreq * mix(1.15, 0.55, soft);
  float freq = baseFreq;
  float amp = mix(0.045, 0.11, soft) * (0.85 + u_energy * 0.35);
  float iters = clamp(u_iterations, 4.0, 8.0);

  vec2 q = p + vec2(u_seed * 3.7, u_seed * 2.1);
  for (int i = 0; i < SILK_MAX_ITERS; i++) {
    if (float(i) >= iters) break;
    float t = float(i);
    float along = dot(q, foldAxis);
    float across = dot(q, crossAxis);
    float ripple = sin(along * freq + across * 0.35 + u_seed * 6.0 + t * 0.7);
    float n = valueNoise(q * (freq * 0.35) + vec2(t * 1.3, u_seed * 4.0));
    float warp = (ripple * 0.7 + (n - 0.5) * 0.6) * amp;
    q += crossAxis * warp + foldAxis * warp * 0.25;
    freq *= 1.08;
    amp *= 0.82;
  }

  float foldPhase = fract(dot(q, foldAxis) * 0.55 + valueNoise(q * 1.2) * 0.2);
  // Softness also blends toward a calmer across-axis mix.
  float acrossPhase = fract(dot(q, crossAxis) * 0.4 + foldPhase * 0.5);
  float mixT = mix(foldPhase, acrossPhase, soft * 0.4);

  vec3 c0 = u_colors[0];
  vec3 c1 = u_colors[1];
  vec3 c2 = u_colors[2];
  vec3 color;
  if (mixT < 0.5) {
    color = mix(c0, c1, smoothstep(0.0, 1.0, mixT * 2.0));
  } else {
    color = mix(c1, c2, smoothstep(0.0, 1.0, (mixT - 0.5) * 2.0));
  }

  // Anisotropic sheen along the fold axis (brushed-fabric highlight).
  float ridge = abs(sin(dot(q, foldAxis) * baseFreq * 0.5 + u_seed * 2.0));
  float sheenMask = pow(1.0 - ridge, mix(4.0, 2.2, soft));
  float sheenAmt = u_sheen * mix(0.75, 1.2, clamp(u_energy, 0.0, 1.0));
  color += vec3(sheenMask * sheenAmt * 0.35);

  float satBoost = 0.88 + u_energy * 0.4;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, satBoost);

  float gFine = hash21(gl_FragCoord.xy + u_seed * 1000.0);
  float gCoarse = valueNoise(gl_FragCoord.xy * 0.45 + u_seed * 40.0);
  float g = (gFine * 0.7 + gCoarse * 0.3 - 0.5) * u_grain * 0.38;
  color += g;

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
