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

/** Nested domain warp that builds organic drape before height sampling. */
vec2 nestFoldDomain(vec2 q, vec2 foldAxis, vec2 crossAxis, float baseFreq, float soft, float iters) {
  float freq = baseFreq * 0.55;
  float amp = mix(0.07, 0.16, soft);
  for (int i = 0; i < SILK_MAX_ITERS; i++) {
    if (float(i) >= iters) break;
    float t = float(i);
    float along = dot(q, foldAxis);
    float across = dot(q, crossAxis);
    vec2 nested = q + foldAxis * sin(across * freq * 0.45 + u_seed * 3.0 + t) * amp * 0.5;
    float ripple = sin(along * freq + across * 0.28 + u_seed * 5.0 + t * 0.6);
    float n = valueNoise(nested * (freq * 0.35) + vec2(t * 1.1, u_seed * 4.0));
    float warp = (ripple * 0.65 + (n - 0.5) * 0.7) * amp;
    q += crossAxis * warp + foldAxis * warp * 0.22;
    freq *= 1.18;
    amp *= 0.78;
  }
  return q;
}

/** Draped-surface height: broad folds + secondary ripple in warped domain. */
float silkHeight(vec2 q, vec2 foldAxis, vec2 crossAxis, float baseFreq, float soft, float energy) {
  float along = dot(q, foldAxis);
  float across = dot(q, crossAxis);
  float nSlow = valueNoise(q * (baseFreq * 0.28) + u_seed * 2.3);
  float nMid = valueNoise(q * (baseFreq * 0.65) + vec2(u_seed * 4.1, 1.7));
  float warpAmt = mix(0.28, 0.62, soft);
  float wa = along + (nSlow - 0.5) * warpAmt;
  float wc = across + (nMid - 0.5) * warpAmt * 0.7;

  float h = sin(wa * baseFreq + u_seed * 4.0) * 0.66;
  h += sin(wa * baseFreq * 1.55 + wc * 0.32 + u_seed * 2.2) * 0.28;
  h += sin(wc * baseFreq * 0.42 + wa * 0.18 + u_seed) * 0.16;
  h += (valueNoise(vec2(wa, wc) * baseFreq * 0.4 + u_seed * 1.5) - 0.5) * 0.18;
  return h * (0.92 + energy * 0.28);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  float soft = clamp(u_softness, 0.0, 1.0);
  float energy = clamp(u_energy, 0.0, 1.0);
  float ca = cos(u_foldAngle);
  float sa = sin(u_foldAngle);
  vec2 foldAxis = vec2(ca, sa);
  vec2 crossAxis = vec2(-sa, ca);

  // Softness widens drapes; keep enough cycles to read as fabric, not one ribbon.
  float baseFreq = u_foldFreq * mix(1.05, 0.78, soft);
  float iters = clamp(u_iterations, 4.0, 8.0);

  vec2 q = nestFoldDomain(
    p + vec2(u_seed * 3.7, u_seed * 2.1),
    foldAxis,
    crossAxis,
    baseFreq,
    soft,
    iters
  );

  float h = silkHeight(q, foldAxis, crossAxis, baseFreq, soft, energy);

  // Soft lighting from height derivatives (draped volume, not stripe sheen).
  float e = mix(0.014, 0.022, soft);
  float hFoldP = silkHeight(q + foldAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  float hFoldM = silkHeight(q - foldAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  float hCrossP = silkHeight(q + crossAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  float hCrossM = silkHeight(q - crossAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  vec3 N = normalize(vec3(-(hFoldP - hFoldM) / (2.0 * e), -(hCrossP - hCrossM) / (2.0 * e), 1.15));
  vec3 L = normalize(vec3(0.32, 0.48, 0.9));
  float ndotl = clamp(dot(N, L), 0.0, 1.0);

  float shade = mix(0.32, 1.12, ndotl);
  shade *= mix(0.7, 1.18, smoothstep(-0.75, 0.8, h));
  // Softness calms contrast so folds stay plush, not plastic.
  shade = mix(shade, 0.7 + h * 0.2, soft * 0.4);

  vec3 Hvec = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(N, Hvec), 0.0), mix(64.0, 22.0, soft));
  float crest = smoothstep(0.0, 0.65, h);
  float sheenAmt = u_sheen * mix(1.05, 1.55, energy) * (spec * (0.9 + crest * 0.7));

  // Color wraps the surface (height + slow lateral + facing), not flat fold stripes.
  float tH = smoothstep(-0.8, 0.8, h);
  float tSide = fract(dot(q, crossAxis) * 0.12 + u_seed * 0.7 + tH * 0.25);
  float mixT = clamp(tH * 0.55 + tSide * 0.25 + ndotl * 0.2, 0.0, 1.0);

  vec3 c0 = u_colors[0];
  vec3 c1 = u_colors[1];
  vec3 c2 = u_colors[2];
  vec3 color;
  if (mixT < 0.5) {
    color = mix(c0, c1, smoothstep(0.0, 1.0, mixT * 2.0));
  } else {
    color = mix(c1, c2, smoothstep(0.0, 1.0, (mixT - 0.5) * 2.0));
  }

  // Light iridescent rim on glancing folds.
  float rim = pow(1.0 - ndotl, mix(2.6, 1.5, soft));
  color = mix(color, mix(c2, c0, tH), rim * 0.2);
  color *= shade;
  // Pearlescent crest light (tinted, not pure white bloom).
  color += mix(vec3(1.0), color, 0.28) * sheenAmt * 0.85;

  float satBoost = 0.9 + energy * 0.32;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, satBoost);

  float gFine = hash21(gl_FragCoord.xy + u_seed * 1000.0);
  float gCoarse = valueNoise(gl_FragCoord.xy * 0.45 + u_seed * 40.0);
  float g = (gFine * 0.7 + gCoarse * 0.3 - 0.5) * u_grain * 0.38;
  color += g;

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
