// 剑形态图标渲染（剑尖朝上、正面朝镜头，透明背景），用于图鉴与进化提示
import * as THREE from 'three';
import * as SW from './swords.js';

let rig = null;
const cache = new Map();
function getRig() {
  if (rig) return rig;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x302820, 1.4));
  const key = new THREE.DirectionalLight(0xfff0dd, 2.6); key.position.set(1.5, 2, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc0ff, 1.2); rim.position.set(-2, 1, -1.5); scene.add(rim);
  const rt = new THREE.WebGLRenderTarget(512, 512, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
  rig = { scene, camera, rt };
  return rig;
}

/** silhouette=true 时渲染为纯黑剪影（未解锁形态） */
export function swordIcon(renderer, formId, size = 160, silhouette = false) {
  const k = formId + ':' + size + ':' + silhouette;
  if (cache.has(k)) return cache.get(k);
  const { scene, camera, rt } = getRig();
  let g;
  try { g = SW.buildSword(formId, { level: 0 }); } catch (e) { console.warn('form', formId, e); g = SW.buildSword(1, { level: 0 }); }
  const holder = new THREE.Group();
  // 剑尖(+X) → 上(+Y)，正面(+Y) → 镜头(+Z)
  holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  holder.add(g);
  if (silhouette) g.traverse(o => { if (o.isMesh) o.material = new THREE.MeshBasicMaterial({ color: 0x0b0908 }); });
  scene.add(holder);
  holder.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(holder);
  const c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3());
  const r = Math.max(sz.x, sz.y) * 0.55;
  const dist = r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(c.x + dist * 0.12, c.y + dist * 0.08, c.z + dist);
  camera.lookAt(c);
  camera.near = dist * 0.1; camera.far = dist * 4; camera.updateProjectionMatrix();
  const prevRT = renderer.getRenderTarget(), prevC = renderer.getClearColor(new THREE.Color()), prevA = renderer.getClearAlpha();
  const prevTM = renderer.toneMapping;
  const buf = new Uint8Array(512 * 512 * 4);
  try {
    renderer.setRenderTarget(rt); renderer.setClearColor(0, 0); renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(rt, 0, 0, 512, 512, buf);
  } finally {
    renderer.setRenderTarget(prevRT); renderer.setClearColor(prevC, prevA); renderer.toneMapping = prevTM;
  }
  scene.remove(holder);
  const cv = document.createElement('canvas'); cv.width = cv.height = 512;
  const ctx = cv.getContext('2d'); const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) img.data.set(buf.subarray((511 - y) * 2048, (512 - y) * 2048), y * 2048);
  ctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas'); out.width = out.height = size;
  out.getContext('2d').drawImage(cv, 0, 0, size, size);
  const url = out.toDataURL();
  cache.set(k, url);
  return url;
}
