import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const host = document.getElementById('stage'), tip = document.getElementById('tip');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
catch { host.innerHTML = '<p style="color:#98a5ad;padding:20px">3D model needs WebGL. Type a body part instead.</p>'; }

if (renderer) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  cam.position.set(0, 2.5, 11);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 6, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xff5a4f, 0.6); rim.position.set(-4, 3, -5); scene.add(rim);
  scene.add(new THREE.PolarGridHelper(2.4, 8, 5, 48, 0x2a2a33, 0x2a2a33));

  const fig = new THREE.Group(); scene.add(fig);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85, flatShading: true });
  const zones = {}, all = [];
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const base = (g, x, y, z, sz = 1) => { const m = new THREE.Mesh(g, baseMat); m.position.set(x, y, z); m.scale.z = sz; fig.add(m); };
  const zone = (name, g, x, y, z, rz = 0) => {
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x4aa3ff, transparent: true, opacity: 0.8, roughness: 0.55, flatShading: true }));
    m.position.set(x, y, z); m.rotation.z = rz; m.userData.muscle = name;
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), new THREE.LineBasicMaterial({ color: 0xb5d9ff, transparent: true, opacity: 0.35 })));
    fig.add(m); (zones[name] ||= []).push(m); all.push(m);
  };
  // Neutral body
  base(new THREE.SphereGeometry(0.3, 12, 8), 0, 4.6, 0);
  base(cyl(0.58, 0.46, 1.8, 10), 0, 3.15, 0, 0.6); base(cyl(0.5, 0.55, 0.6, 10), 0, 2.3, 0, 0.65);
  for (const s of [-1, 1]) {
    base(cyl(0.2, 0.15, 1.15), s * 0.3, 1.7, 0); base(cyl(0.14, 0.09, 1.0), s * 0.3, 0.55, 0);
    base(cyl(0.1, 0.08, 0.85), s * 0.92, 3.25, 0); base(cyl(0.08, 0.06, 0.85), s * 1.0, 2.4, 0);
  }
  // Muscle zones (names match the exercise data)
  zone('neck', cyl(0.14, 0.17, 0.35), 0, 4.2, 0);
  zone('traps', new THREE.BoxGeometry(0.95, 0.45, 0.14), 0, 3.95, -0.31);
  zone('middle back', new THREE.BoxGeometry(0.75, 0.5, 0.14), 0, 3.45, -0.35);
  zone('lower back', new THREE.BoxGeometry(0.65, 0.5, 0.14), 0, 2.85, -0.33);
  zone('chest', new THREE.BoxGeometry(1.05, 0.55, 0.18), 0, 3.62, 0.34);
  zone('abdominals', new THREE.BoxGeometry(0.7, 0.85, 0.16), 0, 2.88, 0.32);
  for (const s of [-1, 1]) {
    zone('shoulders', new THREE.SphereGeometry(0.27, 10, 8), s * 0.8, 3.9, 0);
    zone('lats', new THREE.BoxGeometry(0.42, 0.9, 0.14), s * 0.42, 3.3, -0.33, s * 0.2);
    zone('biceps', cyl(0.15, 0.13, 0.7), s * 0.92, 3.25, 0.09);
    zone('triceps', cyl(0.15, 0.13, 0.7), s * 0.92, 3.25, -0.09);
    zone('forearms', cyl(0.14, 0.1, 0.85), s * 1.0, 2.4, 0, s * 0.05);
    zone('glutes', new THREE.SphereGeometry(0.33, 10, 8), s * 0.27, 2.3, -0.27);
    zone('quadriceps', cyl(0.27, 0.2, 1.0), s * 0.3, 1.7, 0.1);
    zone('hamstrings', cyl(0.26, 0.2, 1.0), s * 0.3, 1.7, -0.1);
    zone('adductors', new THREE.BoxGeometry(0.12, 0.8, 0.26), s * 0.08, 1.75, 0);
    zone('abductors', new THREE.BoxGeometry(0.1, 0.7, 0.3), s * 0.55, 1.85, 0);
    zone('calves', cyl(0.2, 0.13, 0.9), s * 0.3, 0.58, -0.08);
  }

  const controls = new OrbitControls(cam, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: true, minDistance: 6, maxDistance: 15, minPolarAngle: 0.5, maxPolarAngle: 1.9, autoRotate: !reduce, autoRotateSpeed: 0.8 });
  controls.target.set(0, 2.4, 0);
  controls.addEventListener('start', () => controls.autoRotate = false);

  let hover = null; const sel = new Set();
  const paint = () => all.forEach(m => {
    const on = sel.has(m.userData.muscle), hv = m.userData.muscle === hover;
    m.material.color.set(on ? 0xffd23f : hv ? 0xff5a4f : 0x4aa3ff);
    m.material.emissive.set(on ? 0x5a4600 : hv ? 0x4a1612 : 0x000000);
    m.material.opacity = on || hv ? 0.95 : 0.8;
  });
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const hit = e => { const r = renderer.domElement.getBoundingClientRect(); ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ptr, cam); return ray.intersectObjects(all, false)[0]; };
  let down = null;
  const el = renderer.domElement;
  el.addEventListener('pointermove', e => {
    const h = hit(e), n = h ? h.object.userData.muscle : null;
    if (n !== hover) { hover = n; paint(); el.style.cursor = n ? 'pointer' : 'grab'; }
    tip.hidden = !n; if (n) tip.textContent = n;
  });
  el.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; paint(); });
  el.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  el.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const h = hit(e); if (h) document.dispatchEvent(new CustomEvent('pickmuscle', { detail: h.object.userData.muscle }));
  });

  const size = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(size).observe(host); size();
  let flip = null;
  (function loop() {
    requestAnimationFrame(loop);
    if (document.hidden || !host.clientWidth) return;
    if (flip) { const a = Math.atan2(cam.position.x, cam.position.z), d = flip.target - a, step = Math.sign(d) * Math.min(Math.abs(d), 0.12), r = Math.hypot(cam.position.x, cam.position.z), na = a + step; cam.position.x = Math.sin(na) * r; cam.position.z = Math.cos(na) * r; if (Math.abs(d) < 0.01) flip = null; }
    controls.update(); renderer.render(scene, cam);
  })();

  window.Viz = {
    highlight(list) { sel.clear(); (list || []).forEach(m => sel.add(m)); paint(); },
    view(side) { controls.autoRotate = false; const a = Math.atan2(cam.position.x, cam.position.z); const t = side === 'back' ? Math.PI : 0; flip = { target: a + Math.atan2(Math.sin(t - a), Math.cos(t - a)) }; },
  };
}
