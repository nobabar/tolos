#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_softness;
uniform float u_grain;
uniform float u_energy;
uniform float u_seed;
uniform vec2 u_anchorPos[6];
uniform vec3 u_anchorRgb[6];
uniform float u_anchorRadius[6];

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
  for (int i = 0; i < 5; i++) {
    v += a * valueNoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = vec2(uv.x * aspect, uv.y);

  float warpAmt = 0.12 + u_energy * 0.2;
  vec2 warp = vec2(
    fbm(p * 1.25 + u_seed * 17.0),
    fbm(p * 1.25 + vec2(5.2, 1.3) + u_seed * 9.0)
  );
  p += (warp - 0.5) * warpAmt;

  // Softness widens blobs; competition keeps peaks readable so hues don't mud
  float soft = clamp(u_softness, 0.0, 1.0);
  // Softness gentles falloff but stays above the mud floor
  float falloff = mix(3.15, 1.55, soft);
  // Finite competition power: nearer lobes dominate without hard seams
  float edgeK = mix(2.75, 1.9, soft);
  // Long-tail fill grows with Softness so mid/high soft rarely leaves voids
  float tailAmt = mix(0.035, 0.28, soft);
  vec3 color = vec3(0.0);
  float weightSum = 0.0;

  for (int i = 0; i < 6; i++) {
    float radius = u_anchorRadius[i];
    // Inactive slots are uploaded with radius 0
    float slotLive = step(0.001, radius);
    vec2 ap = vec2(u_anchorPos[i].x * aspect, u_anchorPos[i].y);
    // Low soft can leave dark pockets; mid/high soft should fill the frame
    float r = radius * mix(1.25, 2.85, soft);
    float d = length(p - ap) / max(r, 0.001);
    float core = pow(max(0.0, 1.0 - d), falloff * 1.4);
    core = pow(max(core, 0.0), edgeK);
    float tail = pow(1.0 / (1.0 + 2.2 * d * d), mix(2.6, 1.35, soft));
    float w = (core + tailAmt * tail) * slotLive;
    color += u_anchorRgb[i] * w;
    weightSum += w;
  }

  color /= max(weightSum, 1e-4);

  float satBoost = 0.92 + u_energy * 0.35;
  float luma = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(luma), color, satBoost);
  color = mix(color, smoothstep(0.0, 1.0, color), u_energy * 0.15);

  float gFine = hash21(gl_FragCoord.xy + u_seed * 1000.0);
  float gCoarse = valueNoise(gl_FragCoord.xy * 0.45 + u_seed * 40.0);
  float g = (gFine * 0.7 + gCoarse * 0.3 - 0.5) * u_grain * 0.38;
  color += g;

  outColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
