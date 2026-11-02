/* Adapted from long-wind by jbang2004 (2026), MIT source-code license.
 * Leaf painting, culm/crown geometry, alpha dilation, wind noise and bend math.
 * Reduced to a bounded duel grove, independent of the original application.
 * See LICENSE-long-wind.txt. No third-party character or animation assets copied. */
import * as THREE from 'three';
const T0=.45;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function dilateAlpha(ctx, w, h, passes = 6) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3];
  const filled = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) filled[i] = alpha[i] > 8 ? 1 : 0;
  const next = new Uint8Array(w * h);
  for (let p = 0; p < passes; p++) {
    next.set(filled);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (filled[i]) continue;
        let r = 0, g = 0, b = 0, n = 0;
        if (x > 0 && filled[i - 1]) { r += d[(i - 1) * 4]; g += d[(i - 1) * 4 + 1]; b += d[(i - 1) * 4 + 2]; n++; }
        if (x < w - 1 && filled[i + 1]) { r += d[(i + 1) * 4]; g += d[(i + 1) * 4 + 1]; b += d[(i + 1) * 4 + 2]; n++; }
        if (y > 0 && filled[i - w]) { r += d[(i - w) * 4]; g += d[(i - w) * 4 + 1]; b += d[(i - w) * 4 + 2]; n++; }
        if (y < h - 1 && filled[i + w]) { r += d[(i + w) * 4]; g += d[(i + w) * 4 + 1]; b += d[(i + w) * 4 + 2]; n++; }
        if (n) { d[i * 4] = r / n; d[i * 4 + 1] = g / n; d[i * 4 + 2] = b / n; next[i] = 1; }
      }
    }
    filled.set(next);
  }
  // any texel never reached takes the global average of opaque texels
  let ar = 0, ag = 0, ab = 0, an = 0;
  for (let i = 0; i < w * h; i++) if (alpha[i] > 8) { ar += d[i * 4]; ag += d[i * 4 + 1]; ab += d[i * 4 + 2]; an++; }
  if (an) { ar /= an; ag /= an; ab /= an; }
  for (let i = 0; i < w * h; i++) {
    if (!filled[i]) { d[i * 4] = ar; d[i * 4 + 1] = ag; d[i * 4 + 2] = ab; }
    d[i * 4 + 3] = alpha[i];
  }
  ctx.putImageData(img, 0, 0);
}

export function canvasTexture(canvas, { srgb = true, mips = true, aniso = 4, repeat = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = aniso;
  // canvas pixels are straight alpha after dilation: never premultiply on upload
  t.premultiplyAlpha = false;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}


const rgb = (r, g, b, a = 1) => `rgba(${Math.round(Math.max(0, Math.min(255, r)))},${Math.round(Math.max(0, Math.min(255, g)))},${Math.round(Math.max(0, Math.min(255, b)))},${a})`;

/** Lanceolate bamboo leaf at the origin pointing +y (canvas units), long acuminate tip, short petiole. */
function drawLeaf(ctx, L, W, col, rng) {
  const [r, g, b] = col;
  const bend = (rng() - 0.5) * W * 1.6;   // leaves curve a little sideways
  ctx.beginPath();
  ctx.moveTo(0, 0);
  const N = 10, pts = [];
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    // widest at ~30 %, long tapering tip
    const w = W * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.25) ** 0.75), 1.1) * (1 - 0.35 * t) * (t > 0.95 ? 0.3 : 1);
    pts.push([w * 0.5, t * L, bend * t * t]);
  }
  for (const [w, y, o] of pts) ctx.lineTo(o + w, y);
  for (let i = pts.length - 1; i >= 0; i--) { const [w, y, o] = pts[i]; ctx.lineTo(o - w, y); }
  ctx.closePath();
  const gr = ctx.createLinearGradient(-W, 0, W, L);
  gr.addColorStop(0, rgb(r * 0.8, g * 0.82, b * 0.8));
  gr.addColorStop(0.5, rgb(r, g, b));
  gr.addColorStop(1, rgb(r * 1.12, g * 1.1, b * 0.95));
  ctx.fillStyle = gr;
  ctx.fill();
  // midrib (lighter) + a darker half
  ctx.strokeStyle = rgb(r * 1.25, g * 1.2, b * 1.05, 0.55);
  ctx.lineWidth = Math.max(0.7, W * 0.09);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(bend * 0.25, L * 0.5, bend * 0.9, L * 0.93); ctx.stroke();
  ctx.fillStyle = rgb(r * 0.55, g * 0.6, b * 0.55, 0.22);
  ctx.beginPath(); ctx.moveTo(0, 0);
  for (const [w, y, o] of pts) ctx.lineTo(o + w, y);
  for (let i = pts.length - 1; i >= 0; i--) { const [, y, o] = pts[i]; ctx.lineTo(o, y); }
  ctx.closePath(); ctx.fill();
  // some leaves have dry / yellowed tips
  if (rng() < 0.22) {
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgb(150, 130, 60, 0.55);
    ctx.fillRect(-W * 2, L * (0.7 + rng() * 0.2), W * 4, L);
    ctx.restore();
  }
}

const LEAF_PAL = [[58, 88, 30], [72, 104, 36], [86, 118, 40], [100, 128, 46], [66, 96, 40], [118, 136, 52], [80, 100, 34]];

/**
 * One spray: a slender twig from the bottom centre (the branch at the culm) with short alternate branchlets, each
 * ending in a palmate fan of 3–6 lanceolate leaves splayed forward and sideways (the card is near-horizontal in 3D, so
 * "forward" reads as the leaves hanging out from the branch). Clipped to its cell.
 */
function sprayCell(ctx, ox, oy, S, rng, { dense = false } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
  ctx.translate(ox + S / 2, oy + S);
  ctx.scale(1, -1); // +y up the card (away from the culm)
  const leaves = [];
  const stroke = (pts, w0, w1, col) => {
    ctx.strokeStyle = col; ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      ctx.lineWidth = w0 + (w1 - w0) * (i / pts.length);
      ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
    }
  };
  const fan = (x, y, a, n, spread, lk) => {
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) - 0.5 : 0;
      const la = a + u * spread + (rng() - 0.5) * 0.25;
      const L = S * (0.15 + rng() * 0.08) * lk;
      leaves.push({ x, y, a: la, L, W: L * (0.13 + rng() * 0.05), col: LEAF_PAL[Math.floor(rng() * LEAF_PAL.length)], k: 0.82 + rng() * 0.36 });
    }
  };
  const twig = (a0, len, w) => {
    const pts = [[0, 0]];
    let x = 0, y = 0, a = a0;
    const segs = 14, curl = (rng() - 0.5) * 0.05;
    const nodes = [];
    for (let i = 1; i <= segs; i++) {
      a += curl + (rng() - 0.5) * 0.05;
      x += Math.sin(a) * len / segs; y += Math.cos(a) * len / segs;
      pts.push([x, y]);
      if (y > S * 0.1 && i < segs) nodes.push([x, y, a]);
    }
    stroke(pts, w, w * 0.35, rgb(98, 104, 52));
    let side = rng() < 0.5 ? -1 : 1;
    for (const [nx, ny, na] of nodes) {
      if (rng() > (dense ? 0.95 : 0.9)) continue;
      side = -side;
      const t = ny / (S * 0.9);
      const ba = na + side * (0.55 + rng() * 0.45);
      const bl = S * (0.1 + rng() * 0.13) * (1.2 - 0.55 * t);
      const ex = nx + Math.sin(ba) * bl, ey = ny + Math.cos(ba) * bl;
      stroke([[nx, ny], [ex, ey]], w * 0.45, w * 0.25, rgb(104, 110, 56));
      fan(ex, ey, ba + side * 0.25, (dense ? 4 : 3) + Math.floor(rng() * 3), 1.5 + rng() * 0.7, 1);
    }
    fan(x, y, a, 5 + Math.floor(rng() * 3), 1.9, 1.05);
  };
  if (dense) { twig(-0.28 + (rng() - 0.5) * 0.1, S * 0.9, S * 0.011); twig(0.3 + (rng() - 0.5) * 0.1, S * 0.82, S * 0.009); twig((rng() - 0.5) * 0.1, S * 0.6, S * 0.008); }
  else twig((rng() - 0.5) * 0.2, S * 0.9, S * 0.012);
  // small leaves first so the big ones overlap them
  leaves.sort((p, q) => p.L - q.L);
  for (const l of leaves) {
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.rotate(-l.a);
    drawLeaf(ctx, l.L, l.W, l.col.map((c) => c * l.k), rng);
    ctx.restore();
  }
  ctx.restore();
}

function buildLeafAtlas(seed) {
  const S = 512, canvas = makeCanvas(S * 2, S * 2);
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);
  for (let c = 0; c < 4; c++) sprayCell(ctx, (c % 2) * S, Math.floor(c / 2) * S, S, rng, { dense: c === 3 });
  dilateAlpha(ctx, S * 2, S * 2, 8);
  return { canvas, texture: canvasTexture(canvas, { aniso: 4 }) };
}


function culmGeometry(radial, rings) {
  const P = [], N = [], UV = [], I = [];
  for (let j = 0; j <= rings; j++) {
    // denser rings low down, where the camera looks at the culm up close
    const t = Math.pow(j / rings, 1.25);
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      P.push(c, t, s); N.push(c, 0, s); UV.push(i / radial, t);
    }
  }
  const row = radial + 1;
  for (let j = 0; j < rings; j++) for (let i = 0; i < radial; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    I.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setIndex(I);
  return g;
}


function crownGeometry(rng, { sprays, len, wid, cells, top = false, cross = 1 }) {
  const P = [], N = [], UV = [], A = [], I = [];
  const up = new THREE.Vector3(0, 1, 0);
  const out = new THREE.Vector3(), d = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  const base = new THREE.Vector3(), q = new THREE.Vector3();
  const quad = (t, o, dir, across, L, W, cell, phase, nrm) => {
    const i0 = P.length / 3;
    const cu = (cell % 2) * 0.5, cv = 0.5 - Math.floor(cell / 2) * 0.5;
    const flip = rng() < 0.5;
    for (let k = 0; k < 4; k++) {
      const u = k === 0 || k === 3 ? 0 : 1, v = k < 2 ? 0 : 1;
      // slight spoon: the far edge droops a bit more than the axis
      q.copy(o).addScaledVector(dir, v * L).addScaledVector(across, (u - 0.5) * W * (0.35 + 0.65 * v));
      q.y -= v * v * L * 0.12;
      P.push(q.x, q.y, q.z);
      N.push(nrm.x, nrm.y, nrm.z);
      UV.push(cu + (0.18 + (flip ? 1 - u : u) * 0.64) * 0.5, cv + v * 0.5);   // sprays fill the middle 64 % of a cell
      A.push(t, v, phase, 0);
    }
    I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  };
  const GA = Math.PI * (3 - Math.sqrt(5));
  let az = rng() * Math.PI * 2;
  for (let s = 0; s < sprays; s++) {
    const f = (s + 0.3 + rng() * 0.4) / sprays;                 // 0 (lowest branch) .. 1 (top)
    const t = T0 + (0.99 - T0) * Math.pow(f, 0.75);
    az += GA + (rng() - 0.5) * 0.5;
    out.set(Math.cos(az), 0, Math.sin(az));
    // branch length profile: long in the lower-middle crown, short at the top → narrow spindle crown
    const prof = 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, 0.1 + f * 0.9));
    const L = (len[0] + (len[1] - len[0]) * rng()) * prof * (1 - 0.45 * f * f);
    const W = (wid[0] + (wid[1] - wid[0]) * rng()) * (0.8 + 0.2 * prof) * 0.7;
    // spray direction: up-and-out at the attach, drooping toward horizontal (lower sprays droop more)
    const pitch = -0.42 + 0.5 * f - 1.1 * Math.max(0, f - 0.7) + (rng() - 0.5) * 0.3;   // top sprays hang off the arching tip
    d.copy(out).multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize();
    a.crossVectors(up, d).normalize();
    b.crossVectors(d, a).normalize();
    base.copy(out).multiplyScalar(0.03);
    const phase = rng() * 6.283;
    const cell = cells[Math.floor(rng() * cells.length)];
    // lighting normal: crown-volume (outward + up) blended with the card's upper face
    n.copy(out).multiplyScalar(0.55).addScaledVector(up, 0.5).addScaledVector(b, 0.3).normalize();
    // flat-ish card (rolled a little) + a steep card sharing the same spine
    const roll = (rng() - 0.5) * 1.3;
    const acr = a.clone().multiplyScalar(Math.cos(roll)).addScaledVector(b, Math.sin(roll));
    quad(t, base, d, acr, L, W, cell, phase, n);
    if (f > 0.72 || rng() > cross) continue;   // no steep cross cards up top: seen from the side they read as flags
    const rr = (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.25);   // second card rolled 35–50° off the first
    const acr2 = a.clone().multiplyScalar(Math.cos(rr)).addScaledVector(b, Math.sin(rr)).normalize();
    quad(t, base, d, acr2, L * 0.92, W * 0.8, cells[Math.floor(rng() * cells.length)], phase + 0.4, n);
  }
  if (top) {
    // top tuft: the leader's last spray pointing up, bowed downwind in the shader
    for (let k = 0; k < 2; k++) {
      const ang = rng() * Math.PI;
      out.set(Math.cos(ang), 0, Math.sin(ang));
      d.set(out.x * 0.35, 1, out.z * 0.35).normalize();
      a.crossVectors(up, out).normalize();
      n.set(0, 1, 0).addScaledVector(out, 0.3).normalize();
      quad(0.97, base.set(0, 0, 0), d, a, len[0] * 0.8, wid[1] * 0.8, cells[0], rng() * 6.283, n);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.setAttribute('aLeaf', new THREE.Float32BufferAttribute(A, 4));
  g.setIndex(I);
  return g;
}


const N=256;

function buildNoiseBytes() {
  const data = new Uint8Array(N * N * 4);
  const chan = (seed) => {
    const out = new Float32Array(N * N);
    let amp = 0.5, norm = 0;
    for (let o = 0; o < 4; o++) {
      const period = 8 << o;          // 8, 16, 32, 64 lattice cells across the tile
      const rng = mulberry32(seed + o * 101);
      const lat = new Float32Array(period * period);
      for (let i = 0; i < lat.length; i++) lat[i] = rng();
      const cell = N / period;
      for (let y = 0; y < N; y++) {
        const fy = y / cell, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
        const y0 = iy % period, y1 = (iy + 1) % period;
        for (let x = 0; x < N; x++) {
          const fx = x / cell, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
          const x0 = ix % period, x1 = (ix + 1) % period;
          const a = lat[y0 * period + x0], b = lat[y0 * period + x1], c = lat[y1 * period + x0], d = lat[y1 * period + x1];
          out[y * N + x] += amp * ((a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy);
        }
      }
      norm += amp; amp *= 0.5;
    }
    // normalise to full 0..1 range for better byte precision
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < out.length; i++) { out[i] /= norm; mn = Math.min(mn, out[i]); mx = Math.max(mx, out[i]); }
    for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) / (mx - mn);
    return out;
  };
  const r = chan(9001), g = chan(4242);
  for (let i = 0; i < N * N; i++) {
    data[i * 4] = Math.round(r[i] * 255);
    data[i * 4 + 1] = Math.round(g[i] * 255);
    data[i * 4 + 2] = 0; data[i * 4 + 3] = 255;
  }
  return data;
}


export const WIND_GLSL = /* glsl */`
#ifndef WX_WIND
#define WX_WIND
uniform float uTime; uniform vec4 uWind; uniform sampler2D tWindNoise;// gust fronts: λ≈126 m, travelling downwind; cat's-paw puffs 5–15 m drifting at 9 m/s
float windGust(vec3 wp) {
  float along = dot(wp.xz, uWind.xy);
  float g = 0.55 + 0.45 * sin(uTime * 0.6 - along * 0.05) * (0.6 + 0.4 * sin(uTime * 0.19 + wp.x * 0.011 - wp.z * 0.013));
  float n = texture2D(tWindNoise, (wp.xz - uWind.xy * uTime * 9.0) / 46.0).r;
  return max(g * (0.6 + 0.8 * n), 0.08) * uWind.z;
}
// sway wave travels DOWNWIND (−k·along); returns a world-space horizontal displacement direction * amount
vec3 windSway(vec3 wp, float flex, float phase) {
  float g = windGust(wp), t = uTime, along = dot(wp.xz, uWind.xy);
  float s = sin(t * 1.7 - along * 0.7 + phase) * 0.55 + sin(t * 2.9 - along * 1.3 + phase * 1.9) * 0.20;
  vec3 dir = vec3(uWind.x, 0.0, uWind.y), side = vec3(-uWind.y, 0.0, uWind.x);
  return (dir * (0.55 + s) * g + side * sin(t * 1.7 + phase * 2.3) * 0.18 * g) * flex;
}
// high-frequency flutter (leaves, cloth edges): -1..1
float windFlutter(vec3 wp, float t) {
  return texture2D(tWindNoise, wp.xz / 7.0 + vec2(t * 0.9, t * 0.37)).g * 2.0 - 1.0;
}
#endif
`;


const COMMON_PARS = /* glsl */`
${WIND_GLSL}
attribute vec4 aI0;   // base xyz, yaw
attribute vec4 aI1;   // height, radius, lean x, lean z (top offset, m)
attribute vec4 aI2;   // phase, age, node spacing, floor = first-branch height %, fract = crown scale / 2
uniform float uBBWind;
vec3 bbRotY(vec3 p, float c, float s) { return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }
// culm centre-line offset at height fraction t: lean (curved: stiff base) + wind (∝ t², bigger for tall culms)
vec3 bbAxis(float t, float H, out vec3 sw) {
  sw = windSway(aI0.xyz + vec3(0.0, H * 0.7, 0.0), 1.0, aI2.x) * uBBWind * (0.2 + 0.012 * H);
  float bk = t * (0.3 + 0.7 * t);
  // the leader arches over under the weight of its leaves (along the lean, or a random side for straight culms)
  vec2 ld = vec2(aI1.z, aI1.w);
  float ll = length(ld);
  vec2 dd = ll > 1e-3 ? ld / ll : vec2(cos(aI2.x), sin(aI2.x));
  float tip = smoothstep(0.55, 1.0, t);
  float droop = (0.5 + 0.2 * H) * (0.35 + 0.65 * fract(aI2.x * 3.31)) * tip * tip;
  return vec3(aI1.z, 0.0, aI1.w) * bk + vec3(dd.x, -0.5 * tip, dd.y) * droop + sw * (t * t);
}
`;

const CULM_BODY = /* glsl */`
void bbCulm(out vec3 P, out vec3 Nn) {
  float t = position.y, H = aI1.x, R = aI1.y;
  float along = t * H;
  float r = R * (1.0 - 0.62 * pow(t, 1.5)) * (1.0 + 0.3 * exp(-along * 6.0)) * (1.0 - 0.75 * smoothstep(0.86, 1.0, t));   // whip-thin leader
  float c = cos(aI0.w), s = sin(aI0.w);
  vec3 sw;
  vec3 ax = bbAxis(t, H, sw);
#ifdef BB_RIBBON
  // distant culm: a 2-sided ribbon turned to the viewer (or the light in the shadow pass), shaded as a cylinder
  vec3 axisP = aI0.xyz + vec3(0.0, along, 0.0) + ax;
  vec3 toC = cameraPosition - axisP; toC.y = 0.0;
  toC = normalize(toC + vec3(1e-4, 0.0, 0.0));
  vec3 side = vec3(toC.z, 0.0, -toC.x);
  P = axisP + side * (position.x * r * 1.15);
  Nn = normalize(side * position.x * 0.85 + toC * 0.53);
  return;
#endif
  vec3 ring = bbRotY(vec3(position.x * r, 0.0, position.z * r), c, s);
  P = aI0.xyz + vec3(0.0, along, 0.0) + ax + ring;
  // tilt the normal by the local slope of the centre line (lean + wind)
  vec3 slope = (vec3(aI1.z, 0.0, aI1.w) * (0.3 + 1.4 * t) + sw * 2.0 * t) / H;
  vec3 n = bbRotY(vec3(position.x, 0.0, position.z), c, s);
  Nn = normalize(n - vec3(0.0, dot(n, slope), 0.0));
}
`;

const CROWN_BODY = /* glsl */`
attribute vec4 aLeaf; // t (authored for branches from ${T0.toFixed(2)}), flutter weight, phase, 0
varying float vLeafAO;
void bbCrown(out vec3 P, out vec3 Nn) {
  float H = aI1.x;
  float tS = floor(aI2.w) * 0.01;
  float t = tS + (1.0 - tS) * (aLeaf.x - ${T0.toFixed(3)}) / ${(1 - T0).toFixed(3)};
  float c = cos(aI0.w), s = sin(aI0.w);
  vec3 sw;
  vec3 ax = bbAxis(t, H, sw);
  float k = fract(aI2.w) * 2.0;
  vec3 lp = bbRotY(position * k, c, s);
  Nn = bbRotY(normal, c, s);
  // flutter: sprays bob + twist, stronger toward the tips and in gusts
  float g = windGust(aI0.xyz) * uBBWind;
  float ph = aLeaf.z + aI2.x;
  vec3 fl = vec3(sin(uTime * 5.3 + ph * 7.0), 0.7 * sin(uTime * 4.1 + ph * 5.0), sin(uTime * 6.1 + ph * 3.0)) * (0.05 * g * aLeaf.y);
  // sprays trail downwind a little more than the culm they hang on
  P = aI0.xyz + vec3(0.0, t * H, 0.0) + ax + lp + fl + sw * (0.25 * aLeaf.y * length(position.xz) * k);
  vLeafAO = mix(0.55, 1.0, smoothstep(tS - 0.05, 1.0, t)) * (0.8 + 0.2 * aLeaf.y);
}
`;

// mip-aware alpha boost (keeps thin leaves from dissolving in the distance)
const ALPHA_MIP = /* glsl */`
#ifdef USE_MAP
  {
    vec2 bbDx = dFdx(vMapUv * 1024.0), bbDy = dFdy(vMapUv * 1024.0);
    float bbLod = 0.5 * log2(max(max(dot(bbDx, bbDx), dot(bbDy, bbDy)), 1e-6));
    diffuseColor.a *= 1.0 + max(bbLod, 0.0) * 0.16;
  }
#endif
`;

// cards seen edge-on read as planks: thin their coverage at grazing angles (true face normal from derivatives)
const EDGE_FADE = /* glsl */`
  {
    vec3 fN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
    diffuseColor.a *= smoothstep(0.06, 0.32, abs(dot(fN, normalize(vViewPosition))));
  }
`;


let sharedLeafAtlas;
// Standalone integration for Inkblade; instanced attributes retain long-wind's layout.
export function createDuelBamboo(items, clock, options={}) {
  const {radial=8,rings=20,sprays=18,castShadow=true}=options;
  const noiseTexture=new THREE.DataTexture(buildNoiseBytes(),N,N,THREE.RGBAFormat);
  noiseTexture.wrapS=noiseTexture.wrapT=THREE.RepeatWrapping;
  noiseTexture.magFilter=noiseTexture.minFilter=THREE.LinearFilter;
  noiseTexture.generateMipmaps=false;noiseTexture.needsUpdate=true;
  const uniforms={uTime:clock,uWind:{value:new THREE.Vector4(.82,.57,1.2,0)},tWindNoise:{value:noiseTexture},uBBWind:{value:1}};
  const group=new THREE.Group();group.name='long-wind-derived-bamboo';
  const data=new Float32Array(items.length*12);
  items.forEach((a,i)=>data.set([a.x,a.y,a.z,a.yaw,a.h,a.r,a.leanX,a.leanZ,a.phase,a.age,a.spacing,45+a.crown*.5],i*12));
  const ib=new THREE.InstancedInterleavedBuffer(data,12);
  const instanced=base=>{const g=new THREE.InstancedBufferGeometry();g.index=base.index;for(const key in base.attributes)g.setAttribute(key,base.attributes[key]);['aI0','aI1','aI2'].forEach((key,i)=>g.setAttribute(key,new THREE.InterleavedBufferAttribute(ib,4,i*4)));g.instanceCount=items.length;return g;};
  const atlas=sharedLeafAtlas??=buildLeafAtlas(33419).texture;
  function material(crown,depth=false){
    const mat=depth?new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,...(crown?{map:atlas,alphaTest:.42,side:THREE.DoubleSide}:{})}):(!castShadow?new THREE.MeshLambertMaterial(crown?{map:atlas,alphaTest:.42,side:THREE.DoubleSide}:{color:0xffffff}):new THREE.MeshStandardMaterial(crown?{map:atlas,alphaTest:.42,side:THREE.DoubleSide,roughness:.76,envMapIntensity:.5}:{color:0xffffff,roughness:.42,envMapIntensity:.6}));
    mat.name=(crown?'fine-bamboo-leaves':'segmented-bamboo-culms')+(depth?'-shadow':'');
    mat.onBeforeCompile=sh=>{
      Object.assign(sh.uniforms,uniforms);
      const vary=crown?'varying vec3 vBambooTint;':'varying vec4 vBambooNode;';
      let vs=sh.vertexShader.replace('void main() {',COMMON_PARS+(crown?CROWN_BODY:CULM_BODY)+vary+'\nvoid main() {');
      const fn=crown?'bbCrown':'bbCulm';
      const capture=crown?'vBambooTint=mix(vec3(1.05,1.15,1.12),vec3(1.22,1.18,.86),aI2.y);':'vBambooNode=vec4(position.y*aI1.x,uv.x,aI2.y,aI2.z);';
      if(depth)vs=vs.replace('#include <begin_vertex>',`vec3 transformed; { vec3 bbN; ${fn}(transformed,bbN); ${capture} }`);
      else vs=vs.replace('#include <beginnormal_vertex>',`vec3 bbP, objectNormal; ${fn}(bbP,objectNormal); ${capture}`).replace('#include <begin_vertex>','vec3 transformed=bbP;');
      sh.vertexShader=vs;
      if(depth)return;
      sh.fragmentShader=sh.fragmentShader.replace('void main() {',vary+(crown?'varying float vLeafAO;':'')+'\nvoid main() {');
      if(crown){sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb *= vBambooTint * mix(.72,1.0,vLeafAO);').replace('#include <alphatest_fragment>',ALPHA_MIP+EDGE_FADE+'\n#include <alphatest_fragment>');}
      else sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float along=vBambooNode.x, age=vBambooNode.z, spacing=vBambooNode.w;
        float node=fract(along/spacing);float dn=(node<.5?node:node-1.0)*spacing;
        float fine=clamp(1.0-fwidth(along)*18.0,0.0,1.0);
        vec3 green=mix(vec3(.105,.19,.12),vec3(.23,.27,.17),age);
        green*=.91+.09*sin(vBambooNode.y*113.0+sin(along*1.3)*.5);
        green*=1.0-.58*exp(-pow(dn/.006,2.0))*fine;
        green*=1.0+.35*exp(-pow((dn-.014)/.009,2.0))*fine;
        green=mix(vec3(.07,.065,.045),green,smoothstep(.01,.5,along));
        diffuseColor.rgb=green;`);
    };
    mat.customProgramCacheKey=()=>`inkblade-longwind-${crown}-${depth}-${castShadow}-v5`;
    return mat;
  }
  const culms=new THREE.Mesh(instanced(culmGeometry(radial,rings)),material(false));
  culms.name='bamboo-culms-instanced';culms.customDepthMaterial=material(false,true);
  const leaves=new THREE.Mesh(instanced(crownGeometry(mulberry32(881),{sprays,len:[1.3,2.7],wid:[.9,1.65],cells:[0,1,2,3],top:true,cross:.85})),material(true));
  leaves.name='bamboo-leaf-sprays-instanced';leaves.customDepthMaterial=material(true,true);
  for(const m of [culms,leaves]){m.frustumCulled=false;m.castShadow=castShadow;m.receiveShadow=castShadow;group.add(m);}
  return {group,stemCount:items.length,drawCalls:2,triangles:items.length*((culms.geometry.index.count+leaves.geometry.index.count)/3),atlas};
}
