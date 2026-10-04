#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_softness;
uniform float u_grain;
uniform float u_energy;
uniform float u_seed;
uniform float u_warpScale;
uniform float u_warpAmp;
uniform float u_fieldScale;
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

// 5-octave value fBM (Perlin stand-in for main-thread paint).
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

// Cellular F1 / F2 (Worley). Returns distances in .xy.
vec2 worley(vec2 p) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(17.3, 9.1)));
      vec2 r = g + o - f;
      float d = length(r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec2(f1, f2);
}

float worleyFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    vec2 w = worley(p);
    v += a * (1.0 - w.x);
    p = m * p;
    a *= 0.5;
  }
  return clamp(v, 0.0, 1.0);
}

// remap(perlin, 0, 1, worley, 1) -> mix(worley, 1, perlin)
float perlinWorley(float perlin, float worley) {
  return mix(worley, 1.0, clamp(perlin, 0.0, 1.0));
}

vec3 sampleStops(float t) {
  float n = max(u_stopCount - 1.0, 1.0);
  float x = clamp(t, 0.0, 1.0) * n;
  float i0 = floor(x);
  float f = fract(x);
  if (i0 < 0.5) return mix(u_stops[0], u_stops[1], f);
  if (i0 < 1.5) return mix(u_stops[1], u_stops[2], f);
  if (i0 < 2.5) return mix(u_stops[2], u_stops[3], f);
  return mix(u_stops[3], u_stops[4], f);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 pBase = vec2(uv.x * aspect, uv.y);

  float soft = clamp(u_softness, 0.0, 1.0);
  float energy = clamp(u_energy, 0.0, 1.0);

  // Softness calms spatial scale; Energy raises warp amplitude / structure.
  float fieldScale = u_warpScale * mix(1.2, 0.55, soft);
  float warpAmp = u_warpAmp * mix(0.75, 1.35, energy);
  float cellScale = u_fieldScale * mix(1.15, 0.7, soft);

  vec2 p = pBase * fieldScale + vec2(u_seed * 11.0, u_seed * 7.0);

  // Quilez 2-level nested domain warp.
  vec2 q = vec2(
    fbm(p),
    fbm(p + vec2(5.2, 1.3))
  );
  vec2 r = vec2(
    fbm(p + 4.0 * q * warpAmp + vec2(1.7, 9.2)),
    fbm(p + 4.0 * q * warpAmp + vec2(8.3, 2.8))
  );
  float fWarp = fbm(p + 4.0 * r * warpAmp);

  vec2 warped = p + 4.0 * r * warpAmp * 0.35;

  float perlinField = fbm(warped * 1.1 + u_seed * 3.0);
  float worleyField = worleyFbm(warped * cellScale * 1.15 + vec2(2.1, 0.7));
  float density = perlinWorley(perlinField, worleyField);

  // Optional F2-F1 as soft secondary structure (not hard Voronoi edges).
  vec2 cell = worley(warped * mix(1.8, 1.1, soft) * cellScale + u_seed);
  float ridges = clamp(cell.y - cell.x, 0.0, 1.0);
  density = mix(density, density * (0.75 + 0.45 * ridges), 0.28 + energy * 0.22);

  // Softness pulls toward a calmer low-contrast field.
  density = mix(density, smoothstep(0.15, 0.85, density), 1.0 - soft * 0.55);

  float t = clamp(density * 0.72 + fWarp * 0.28, 0.0, 1.0);
  vec3 finalColor = sampleStops(t);

  float satBoost = 0.88 + energy * 0.22;
  float luma = dot(finalColor, vec3(0.299, 0.587, 0.114));
  finalColor = mix(vec3(luma), finalColor, satBoost);
  finalColor = mix(finalColor, smoothstep(0.0, 1.0, finalColor), energy * 0.1);

  float gFine = hash21(gl_FragCoord.xy + u_seed * 1000.0);
  float gCoarse = valueNoise(gl_FragCoord.xy * 0.45 + u_seed * 40.0);
  float g = (gFine * 0.7 + gCoarse * 0.3 - 0.5) * u_grain * 0.38;
  finalColor += g;
  finalColor = clamp(finalColor, 0.0, 1.0);

  outColor = vec4(finalColor, 1.0);
}
