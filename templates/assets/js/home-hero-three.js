/* Home hero — Cyber Core particle engine (three.js) */
import * as THREE from 'three';

(function () {
const container = document.getElementById('cc-term-body');
if (!container) return;

/* ================= 可调参数 ================= */
const OUTER_N = 900;
const INNER_N = 500;
const OUTER_R = 2.25;
const INNER_R = 1.32;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = REDUCED ? 0.35 : 1;

/* ================= 主题色自适应 ================= */
function getThemeColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--heo-theme').trim();
  return v || '#425AEF';
}

// 从站点主题色（--heo-theme）派生一套协调的赛博调色板
// 策略：以主题色为主，搭配两个邻近色（色相 ±30°）形成冷暖层次，
//       线框/连线/轨道环统一降饱和度变暗，数据包用邻近高亮色形成跳跃点
function buildPalette(baseHex) {
  const base = new THREE.Color(baseHex);
  const hsl = {};
  base.getHSL(hsl);
  const h = hsl.h;
  // 饱和度下限抬高，避免派生色发灰；亮度以主题色为基准
  const s = Math.max(0.45, Math.min(1, hsl.s));
  const l = Math.max(0.4, Math.min(0.75, hsl.l));

  // 辅助：按色相偏移、饱和度偏移、亮度偏移生成颜色
  const c = (dh, ds, dl) => new THREE.Color().setHSL(
    (h + dh + 1) % 1,
    Math.max(0.2, Math.min(1, s + ds)),
    Math.max(0.15, Math.min(0.9, l + dl))
  );

  return {
    bg: 0x070B16,
    outer: base.getHex(),                                    // 外层粒子球 = 主题色
    inner: c(0.0, 0.1, 0.18).getHex(),                       // 内层 = 更亮的同色
    wire: c(0.0, -0.15, -0.25).getHex(),                     // 线框 = 暗化同色
    links: c(0.0, -0.2, -0.35).getHex(),                     // 邻接连线 = 更暗
    ring: c(0.0, -0.25, -0.42).getHex(),                     // 轨道环 = 最暗同色
    dust: c(0.0, 0.0, 0.1).getHex(),                         // 尘埃 = 轻微提亮
    shock: base.getHex(),                                    // 冲击波 = 主题色
    // 三个数据包色：主题色 + 两个邻近色相（±30°），形成冷暖层次
    pulses: [
      base.getHex(),
      c(-0.083, 0.05, 0.15).getHex(),
      c(0.083, 0.05, 0.15).getHex(),
    ],
  };
}

let PALETTE = buildPalette(getThemeColor());

function applyPalette(p) {
  renderer.setClearColor(p.bg, 1);
  outerMat.color.setHex(p.outer);
  innerMat.color.setHex(p.inner);
  wireMat.color.setHex(p.wire);
  window.__linkMat.color.setHex(p.links);
  ringMats.forEach((m) => m.color.setHex(p.ring));
  window.__dust.material.color.setHex(p.dust);
  shockMat.color.setHex(p.shock);
  let pi = 0;
  pulses.forEach((pp) => {
    const col = p.pulses[pi % 3];
    pp.head.material.color.setHex(col);
    pp.trails.forEach((s) => s.material.color.setHex(col));
    pi++;
  });
}

// 监听深浅主题切换，实时同步配色
const mo = new MutationObserver(() => {
  const np = buildPalette(getThemeColor());
  if (np.outer !== PALETTE.outer) { PALETTE = np; applyPalette(PALETTE); }
});
mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

const canvas = document.getElementById('cc-canvas');
const term = document.getElementById('cc-term');
const termBar = document.getElementById('cc-term-bar');
const hudFps = document.getElementById('cc-fps');
const hudRotX = document.getElementById('cc-rotx');
const hudRotY = document.getElementById('cc-roty');
document.getElementById('cc-nodes').textContent = OUTER_N + INNER_N;
if (REDUCED) term.classList.add('reduced');

/* ================= WebGL 检测 ================= */
function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) { return false; }
}
if (!webglOK()) {
  const fb = document.getElementById('cc-fallback');
  fb.classList.remove('hidden');
  fb.classList.add('flex');
  canvas.style.display = 'none';
  return;
}
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  const fb = document.getElementById('cc-fallback');
  fb.classList.remove('hidden');
  fb.classList.add('flex');
  canvas.style.display = 'none';
});

/* ================= 基础渲染 ================= */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
camera.position.set(0, 0, 10.4);

/* ================= 发光圆点纹理 ================= */
function makeDotTexture() {
  const s = 64, cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,.9)');
  g.addColorStop(0.7, 'rgba(255,255,255,.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}
const dotTex = makeDotTexture();

/* ================= Fibonacci 均匀球面分布 ================= */
function fibSphere(n, r) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push(new THREE.Vector3(Math.cos(theta) * rad * r, y * r, Math.sin(theta) * rad * r));
  }
  return pts;
}

/* ================= 核心组 ================= */
const core = new THREE.Group();
scene.add(core);
const outerPts = fibSphere(OUTER_N, OUTER_R);

const outerMat = new THREE.PointsMaterial({
  color: PALETTE.outer, size: 0.085, map: dotTex, transparent: true, opacity: 0.95,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
const outerPoints = new THREE.Points(new THREE.BufferGeometry().setFromPoints(outerPts), outerMat);
core.add(outerPoints);

const innerMat = new THREE.PointsMaterial({
  color: PALETTE.inner, size: 0.07, map: dotTex, transparent: true, opacity: 0.9,
  depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
});
const innerPoints = new THREE.Points(new THREE.BufferGeometry().setFromPoints(fibSphere(INNER_N, INNER_R)), innerMat);
core.add(innerPoints);

const wireMat = new THREE.MeshBasicMaterial({
  color: PALETTE.wire, wireframe: true, transparent: true, opacity: 0.22, depthWrite: false,
});
const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(OUTER_R * 1.02, 1), wireMat);
core.add(wire);

// 球面邻接连线
(function buildLinks() {
  const seg = [];
  const seen = new Set();
  for (let i = 0; i < OUTER_N; i++) {
    const nearest = [];
    for (let j = 0; j < OUTER_N; j++) {
      if (i === j) continue;
      nearest.push({ j, d: outerPts[i].distanceToSquared(outerPts[j]) });
    }
    nearest.sort((a, b) => a.d - b.d);
    for (let k = 0; k < 2; k++) {
      const j = nearest[k].j;
      const key = i < j ? i + '-' + j : j + '-' + i;
      if (seen.has(key)) continue;
      seen.add(key);
      seg.push(outerPts[i].x, outerPts[i].y, outerPts[i].z);
      seg.push(outerPts[j].x, outerPts[j].y, outerPts[j].z);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const linkMat = new THREE.LineBasicMaterial({
    color: PALETTE.links, transparent: true, opacity: 0.32, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  core.add(new THREE.LineSegments(geo, linkMat));
  window.__linkMat = linkMat;
})();

/* ================= 轨道环 + 飞行数据包 ================= */
const ringsGroup = new THREE.Group();
scene.add(ringsGroup);
const ringMats = [];
const pulses = [];

function makePulse(radius, colorHex, speed, phase) {
  const head = new THREE.Sprite(new THREE.SpriteMaterial({
    map: dotTex, color: colorHex, transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  head.scale.set(0.34, 0.34, 1);
  const trails = [];
  for (let i = 1; i <= 5; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: dotTex, color: colorHex, transparent: true, opacity: 0.55 / i,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    const k = 1 - i / 6.5;
    s.scale.set(0.3 * k, 0.3 * k, 1);
    trails.push(s);
  }
  return { head, trails, angle: phase, speed, radius };
}

const ringDefs = [
  { r: 3.05, tilt: 1.15, twist: 0.3, speed: 0.85 },
  { r: 3.55, tilt: 1.85, twist: -0.5, speed: -0.6 },
  { r: 4.05, tilt: 0.75, twist: 0.9, speed: 1.05 },
];
ringDefs.forEach((def, idx) => {
  const g = new THREE.Group();
  g.rotation.set(def.tilt, def.twist, def.tilt * 0.35);
  const rMat = new THREE.MeshBasicMaterial({
    color: PALETTE.ring, transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  ringMats.push(rMat);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(def.r, 0.009, 8, 160), rMat);
  torus.rotation.x = Math.PI / 2;
  g.add(torus);

  const c1 = PALETTE.pulses[idx % 3];
  const c2 = PALETTE.pulses[(idx + 1) % 3];
  [makePulse(def.r, c1, def.speed, 0), makePulse(def.r, c2, def.speed, Math.PI)].forEach((p) => {
    g.add(p.head);
    p.trails.forEach((s) => g.add(s));
    pulses.push(p);
  });
  ringsGroup.add(g);
});

/* ================= 背景尘埃 ================= */
(function buildDust() {
  const pos = [];
  for (let i = 0; i < 420; i++) {
    pos.push((Math.random() * 2 - 1) * 11, (Math.random() * 2 - 1) * 6.5, (Math.random() * 2 - 1) * 5 - 2.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: PALETTE.dust, size: 0.055, map: dotTex, transparent: true,
    opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  window.__dust = new THREE.Points(geo, mat);
  scene.add(window.__dust);
})();

/* ================= 冲击波扫描环 ================= */
const shockMat = new THREE.MeshBasicMaterial({
  color: PALETTE.shock, transparent: true, opacity: 0, depthWrite: false,
  side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
});
const shock = new THREE.Mesh(new THREE.RingGeometry(1.95, 2.02, 96), shockMat);
scene.add(shock);
let shockT = 1;

/* ================= 初始化材质配色 ================= */
applyPalette(PALETTE);
termBar.className = 'cc-term__bar cc-term__bar--dark';

/* ================= 尺寸自适应 ================= */
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(container);
resize();

/* ================= 拖拽旋转 + 惯性 ================= */
let dragging = false, lastX = 0, lastY = 0;
let rotX = 0, rotY = 0, vx = 0, vy = 0.004 * SPEED;
let mouseNX = 0, mouseNY = 0;

canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  const r = container.getBoundingClientRect();
  mouseNX = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouseNY = ((e.clientY - r.top) / r.height) * 2 - 1;
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  vy += dx * 0.0011 * SPEED;
  vx += dy * 0.0011 * SPEED;
  vx = THREE.MathUtils.clamp(vx, -0.06, 0.06);
});
canvas.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('pointercancel', () => { dragging = false; });
canvas.addEventListener('pointerleave', () => { mouseNX = 0; mouseNY = 0; });

/* ================= 视口暂停 ================= */
let onScreen = true;
new IntersectionObserver((entries) => {
  onScreen = entries[0].isIntersecting;
}, { threshold: 0.05 }).observe(container);

/* ================= 主循环 ================= */
const clock = new THREE.Clock();
let fpsTimer = 0, fpsFrames = 0, elapsed = 0;

renderer.setAnimationLoop(() => {
  if (!onScreen) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt * SPEED;

  vx *= 0.955;
  rotX += vx * SPEED;
  rotY += vy * SPEED;
  vy += (0.004 * SPEED - vy) * 0.0025;
  rotX = THREE.MathUtils.clamp(rotX, -1.05, 1.05);

  core.rotation.set(rotX, rotY, 0);
  innerPoints.rotation.y = -rotY * 0.55 - elapsed * 0.12;
  innerPoints.rotation.x = rotX * 0.4;
  wire.rotation.y = -elapsed * 0.08;
  wire.rotation.z = elapsed * 0.05;
  ringsGroup.rotation.y = rotY * 0.45 + elapsed * 0.03;
  ringsGroup.rotation.x = rotX * 0.35;

  outerMat.opacity = 0.82 + Math.sin(elapsed * 2.2) * 0.13;
  innerMat.opacity = 0.75 + Math.cos(elapsed * 1.8) * 0.15;

  pulses.forEach((p) => {
    p.angle += p.speed * dt * SPEED;
    for (let i = 0; i < 6; i++) {
      const a = p.angle - i * 0.12;
      const x = Math.cos(a) * p.radius, z = Math.sin(a) * p.radius;
      const obj = i === 0 ? p.head : p.trails[i - 1];
      obj.position.set(x, 0, z);
    }
  });

  shockT += dt * SPEED * 0.32;
  if (shockT > 1) shockT = 0;
  const sc = 0.7 + shockT * 2.1;
  shock.scale.setScalar(sc);
  shockMat.opacity = (1 - shockT) * 0.85;
  shock.rotation.x = Math.PI / 2.35;
  shock.rotation.z = elapsed * 0.25;

  window.__dust.rotation.y += dt * 0.02 * SPEED;
  camera.position.x += (mouseNX * 0.55 - camera.position.x) * 0.04;
  camera.position.y += (-mouseNY * 0.4 - camera.position.y) * 0.04;
  camera.lookAt(0, 0, 0);

  renderer.render(scene, camera);

  fpsTimer += dt;
  fpsFrames++;
  if (fpsTimer >= 0.5) {
    hudFps.textContent = Math.round(fpsFrames / fpsTimer);
    fpsTimer = 0;
    fpsFrames = 0;
    hudRotX.textContent = (rotX >= 0 ? '+' : '') + rotX.toFixed(2);
    hudRotY.textContent = (rotY >= 0 ? '+' : '') + (rotY % (Math.PI * 2)).toFixed(2);
  }
});

/* PJAX cleanup */
window.addEventListener('pjax:send', () => {
  renderer.setAnimationLoop(null);
  renderer.dispose();
});
})();
