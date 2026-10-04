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
// 0 = final still, 1 = fold ridges, 2 = deepen + sheen hint, 3 = color develop (preview expose)
uniform float u_sketchMode;

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

/** Primary fold lobe along the seeded fold axis. */
float silkHeightPrimary(vec2 q, vec2 foldAxis, vec2 crossAxis, float baseFreq, float soft) {
  float along = dot(q, foldAxis);
  float across = dot(q, crossAxis);
  float nSlow = valueNoise(q * (baseFreq * 0.28) + u_seed * 2.3);
  float nMid = valueNoise(q * (baseFreq * 0.65) + vec2(u_seed * 4.1, 1.7));
  float warpAmt = mix(0.28, 0.62, soft);
  float wa = along + (nSlow - 0.5) * warpAmt;
  float wc = across + (nMid - 0.5) * warpAmt * 0.7;

  float h = sin(wa * baseFreq + u_seed * 4.0) * 0.62;
  h += sin(wa * baseFreq * 1.55 + wc * 0.32 + u_seed * 2.2) * 0.26;
  h += sin(wc * baseFreq * 0.42 + wa * 0.18 + u_seed) * 0.14;
  h += (valueNoise(vec2(wa, wc) * baseFreq * 0.4 + u_seed * 1.5) - 0.5) * 0.16;
  return h;
}

/** Second large-scale lobe on a seed-tilted axis for denser multi-fold mesh. */
float silkHeightSecondary(vec2 q, vec2 foldAxis, vec2 crossAxis, float baseFreq, float soft) {
  float tilt = 0.55 + u_seed * 0.9;
  vec2 axis2 = normalize(foldAxis * cos(tilt) + crossAxis * sin(tilt));
  vec2 cross2 = vec2(-axis2.y, axis2.x);
  float freq2 = baseFreq * 0.48;
  float along = dot(q, axis2);
  float across = dot(q, cross2);
  float n = valueNoise(q * (freq2 * 0.32) + vec2(u_seed * 5.2, 3.4));
  float warpAmt = mix(0.22, 0.5, soft);
  float wa = along + (n - 0.5) * warpAmt;
  float wc = across + (valueNoise(q * freq2 * 0.55 + u_seed) - 0.5) * warpAmt * 0.65;

  float h = sin(wa * freq2 + u_seed * 3.1) * 0.55;
  h += sin(wa * freq2 * 1.35 + wc * 0.4 + u_seed * 1.7) * 0.28;
  h += sin(wc * freq2 * 0.55 + wa * 0.2) * 0.14;
  return h;
}

float silkHeight(vec2 q, vec2 foldAxis, vec2 crossAxis, float baseFreq, float soft, float energy) {
  float h1 = silkHeightPrimary(q, foldAxis, crossAxis, baseFreq, soft);
  float h2 = silkHeightSecondary(q, foldAxis, crossAxis, baseFreq, soft);
  // Secondary lobe near parity so drapes read as dense multi-fold mesh.
  float h = h1 * 0.92 + h2 * mix(0.88, 1.05, soft);
  return h * (0.9 + energy * 0.28);
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

  // Preview expose construction stages (export / final always use mode 0)
  if (u_sketchMode > 0.5) {
    float e = mix(0.014, 0.022, soft);
    float hCrossP = silkHeight(q + crossAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
    float hCrossM = silkHeight(q - crossAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
    float dhCross = (hCrossP - hCrossM) / (2.0 * e);
    float aaH = max(fwidth(h), 1e-4);
    float aaG = max(fwidth(dhCross), 1e-4);

    if (u_sketchMode < 1.5) {
      // Dark field + white fold / ridge strokes from the live silk height field
      float isoFreq = mix(5.2, 3.6, soft);
      float iso = h * isoFreq;
      float distToIso = abs(fract(iso + 0.5) - 0.5);
      float halfW = mix(0.45, 0.95, soft) * aaH * isoFreq;
      float isolines = 1.0 - smoothstep(0.0, halfW, distToIso);
      // Crest strokes follow fold direction (zero-crossing of cross-axis slope)
      float crestStroke = 1.0 - smoothstep(0.0, mix(0.7, 1.4, soft) * aaG, abs(dhCross));
      crestStroke *= smoothstep(-0.35, 0.25, h);
      float stroke = max(isolines * 0.85, crestStroke);
      outColor = vec4(vec3(stroke), 1.0);
      return;
    }

    if (u_sketchMode < 2.5) {
      // Deepen ridges + light sheen hint (still monochrome)
      float isoFreq = mix(7.0, 4.8, soft);
      float iso = h * isoFreq;
      float distToIso = abs(fract(iso + 0.5) - 0.5);
      float halfW = mix(0.4, 0.9, soft) * aaH * isoFreq;
      float isolines = 1.0 - smoothstep(0.0, halfW, distToIso);
      float crestStroke = 1.0 - smoothstep(0.0, mix(0.55, 1.2, soft) * aaG, abs(dhCross));
      crestStroke *= smoothstep(-0.4, 0.35, h);
      float shadeHint = mix(0.08, 0.28, smoothstep(-0.7, 0.75, h));
      float sheenHint = u_sheen * mix(0.25, 0.55, energy) * pow(max(smoothstep(-0.1, 0.7, h), 0.0), 1.4);
      float stroke = max(isolines * 0.9, crestStroke) + shadeHint + sheenHint;
      outColor = vec4(vec3(clamp(stroke, 0.0, 1.0)), 1.0);
      return;
    }

    // Color + sheen develop without grain (settles on final in last stage)
    float hFoldP = silkHeight(q + foldAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
    float hFoldM = silkHeight(q - foldAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
    vec3 N = normalize(vec3(-(hFoldP - hFoldM) / (2.0 * e), -dhCross, 1.15));
    vec3 L = normalize(vec3(0.32, 0.48, 0.9));
    float ndotl = clamp(dot(N, L), 0.0, 1.0);
    float graze = 1.0 - ndotl;
    float shade = mix(0.38, 1.1, ndotl);
    shade *= mix(0.74, 1.16, smoothstep(-0.75, 0.8, h));
    shade = mix(shade, 0.74 + h * 0.18, soft * 0.42);
    vec3 Hvec = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(N, Hvec), 0.0), mix(58.0, 20.0, soft));
    float crest = smoothstep(-0.05, 0.65, h);
    float sheenAmt = u_sheen * mix(1.05, 1.5, energy) * (spec * (0.85 + crest * 0.75));

    vec3 c0 = u_colors[0];
    vec3 c1 = u_colors[1];
    vec3 c2 = u_colors[2];
    float tH = smoothstep(-0.85, 0.85, h);
    float tSide = fract(dot(q, crossAxis) * 0.1 + u_seed * 0.7 + tH * 0.2);
    float pearl = 0.5 + 0.5 * sin(dot(N.xy, vec2(3.2, 2.5)) * 2.2 + h * 2.4 + u_seed * 5.0);
    float mixT = clamp(tH * 0.4 + tSide * 0.18 + ndotl * 0.22 + pearl * 0.2, 0.0, 1.0);
    vec3 alongFold = mix(c0, c1, smoothstep(0.0, 1.0, mixT));
    vec3 acrossFold = mix(c1, c2, smoothstep(0.0, 1.0, fract(mixT + 0.35)));
    vec3 color = mix(alongFold, acrossFold, 0.45 + graze * 0.2);
    float rim = pow(graze, mix(2.2, 1.35, soft));
    vec3 rimColor = mix(c2, c0, clamp(tH * 0.55 + pearl * 0.45, 0.0, 1.0));
    color = mix(color, rimColor, rim * 0.38);
    color = mix(color, mix(c0, c2, pearl), 0.12 + graze * 0.12);
    color *= shade;
    color += mix(vec3(1.0), color, 0.4) * sheenAmt * 0.8;
    float satBoost = 0.82 + energy * 0.28;
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(luma), color, satBoost);
    color = mix(color, max(color, vec3(luma * 0.85 + 0.06)), 0.2);
    outColor = vec4(clamp(color * 0.94, 0.0, 1.0), 1.0);
    return;
  }

  // Soft lighting from height derivatives (draped volume, not stripe sheen).
  float e = mix(0.014, 0.022, soft);
  float hFoldP = silkHeight(q + foldAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  float hFoldM = silkHeight(q - foldAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  float hCrossP = silkHeight(q + crossAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  float hCrossM = silkHeight(q - crossAxis * e, foldAxis, crossAxis, baseFreq, soft, energy);
  vec3 N = normalize(vec3(-(hFoldP - hFoldM) / (2.0 * e), -(hCrossP - hCrossM) / (2.0 * e), 1.15));
  vec3 L = normalize(vec3(0.32, 0.48, 0.9));
  float ndotl = clamp(dot(N, L), 0.0, 1.0);
  float graze = 1.0 - ndotl;

  float shade = mix(0.38, 1.1, ndotl);
  shade *= mix(0.74, 1.16, smoothstep(-0.75, 0.8, h));
  // Softness calms contrast so folds stay plush, not plastic.
  shade = mix(shade, 0.74 + h * 0.18, soft * 0.42);

  vec3 Hvec = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(N, Hvec), 0.0), mix(58.0, 20.0, soft));
  float crest = smoothstep(-0.05, 0.65, h);
  float sheenAmt = u_sheen * mix(1.05, 1.5, energy) * (spec * (0.85 + crest * 0.75));

  vec3 c0 = u_colors[0];
  vec3 c1 = u_colors[1];
  vec3 c2 = u_colors[2];

  // Pastel iridescence: color wraps height, facing, and normal angle.
  float tH = smoothstep(-0.85, 0.85, h);
  float tSide = fract(dot(q, crossAxis) * 0.1 + u_seed * 0.7 + tH * 0.2);
  float pearl = 0.5 + 0.5 * sin(dot(N.xy, vec2(3.2, 2.5)) * 2.2 + h * 2.4 + u_seed * 5.0);
  float mixT = clamp(tH * 0.4 + tSide * 0.18 + ndotl * 0.22 + pearl * 0.2, 0.0, 1.0);

  vec3 alongFold = mix(c0, c1, smoothstep(0.0, 1.0, mixT));
  vec3 acrossFold = mix(c1, c2, smoothstep(0.0, 1.0, fract(mixT + 0.35)));
  vec3 color = mix(alongFold, acrossFold, 0.45 + graze * 0.2);

  // Stronger glancing wrap (pearlescent rim between distant stops).
  float rim = pow(graze, mix(2.2, 1.35, soft));
  vec3 rimColor = mix(c2, c0, clamp(tH * 0.55 + pearl * 0.45, 0.0, 1.0));
  color = mix(color, rimColor, rim * 0.38);
  color = mix(color, mix(c0, c2, pearl), 0.12 + graze * 0.12);

  color *= shade;
  // Pearlescent crest light (tinted, not pure white bloom).
  color += mix(vec3(1.0), color, 0.4) * sheenAmt * 0.8;

  // Keep mid energy from going neon; InstantGradient silk stays plush.
  float satBoost = 0.82 + energy * 0.28;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, satBoost);
  // Lift crushed valleys a touch so pastel mass remains.
  color = mix(color, max(color, vec3(luma * 0.85 + 0.06)), 0.2);

  float gFine = hash21(gl_FragCoord.xy + u_seed * 1000.0);
  float gCoarse = valueNoise(gl_FragCoord.xy * 0.45 + u_seed * 40.0);
  float g = (gFine * 0.7 + gCoarse * 0.3 - 0.5) * u_grain * 0.38;
  color += g;

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
