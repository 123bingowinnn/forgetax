// 铸剑大师 - 第一人称控制器（WASD + 鼠标视角 + 碰撞 + 固定机位过渡）
import * as THREE from 'three';

const EYE = 1.62;
const RADIUS = 0.28;

export class Player {
  constructor(camera, dom, room, colliders) {
    this.camera = camera;
    this.dom = dom;
    this.room = room;
    this.colliders = colliders;
    this.pos = new THREE.Vector3(0, EYE, 0.9);
    this.yaw = Math.PI;   // 面向 +Z（锻造墙）
    this.pitch = -0.12;
    this.keys = {};
    this.enabled = true;     // 是否可以走动
    this.lookEnabled = true;
    this.mode = 'walk';      // walk | fixed | transition
    this.bobT = 0;
    this.stepAcc = 0;
    this.onStep = null;
    this.locked = false;
    this.trans = null;
    this.fixedPose = null;

    // 手持物挂点
    this.hand = new THREE.Group();
    this.hand.position.set(0.16, -0.42, -0.72);
    camera.add(this.hand);

    document.addEventListener('keydown', e => { this.keys[e.code] = true; });
    document.addEventListener('keyup', e => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = {}; });
    document.addEventListener('mousemove', e => {
      if (!this.locked || !this.lookEnabled || this.mode !== 'walk') return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.3, Math.min(1.25, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    this.applyCamera();
  }

  requestLock() {
    if (this.dom.requestPointerLock && !this.locked) {
      try { const p = this.dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { }
    }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }

  setPose(pos, yaw, pitch) { this.pos.copy(pos); this.yaw = yaw; this.pitch = pitch; this.applyCamera(); }

  /** 平滑移动到固定机位（如铁砧视角） */
  goFixed(pos, target, dur = 0.5, done) {
    const q = new THREE.Quaternion();
    const m = new THREE.Matrix4().lookAt(pos, target, new THREE.Vector3(0, 1, 0));
    q.setFromRotationMatrix(m);
    this.trans = { from: this.camera.position.clone(), fromQ: this.camera.quaternion.clone(), to: pos.clone(), toQ: q, t: 0, dur, done, toFixed: true };
    this.mode = 'transition';
    this.fixedPose = { pos: pos.clone(), q };
  }

  /** 从固定机位回到自由行走（回到 walkPos，朝向 yaw） */
  leaveFixed(walkPos, yaw, pitch, dur = 0.45, done) {
    this.pos.copy(walkPos); this.yaw = yaw; this.pitch = pitch;
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(e);
    this.trans = { from: this.camera.position.clone(), fromQ: this.camera.quaternion.clone(), to: walkPos.clone(), toQ: q, t: 0, dur, done, toFixed: false };
    this.mode = 'transition';
  }

  collide(p) {
    const r = this.room;
    p.x = Math.max(r.x0 + RADIUS, Math.min(r.x1 - RADIUS, p.x));
    p.z = Math.max(r.z0 + RADIUS, Math.min(r.z1 - RADIUS, p.z));
    for (const b of this.colliders) {
      const cx = Math.max(b.x0, Math.min(b.x1, p.x));
      const cz = Math.max(b.z0, Math.min(b.z1, p.z));
      const dx = p.x - cx, dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          p.x = cx + dx / d * RADIUS; p.z = cz + dz / d * RADIUS;
        } else {
          // 在盒子内部：推到最近的边
          const opts = [[b.x0 - RADIUS - p.x, 0], [b.x1 + RADIUS - p.x, 0], [0, b.z0 - RADIUS - p.z], [0, b.z1 + RADIUS - p.z]];
          opts.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1]));
          p.x += opts[0][0]; p.z += opts[0][1];
        }
      }
    }
  }

  update(dt) {
    if (this.mode === 'transition' && this.trans) {
      const tr = this.trans;
      tr.t += dt / tr.dur;
      const k = Math.min(1, tr.t);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camera.position.lerpVectors(tr.from, tr.to, e);
      this.camera.quaternion.slerpQuaternions(tr.fromQ, tr.toQ, e);
      if (k >= 1) {
        this.mode = tr.toFixed ? 'fixed' : 'walk';
        this.trans = null;
        if (tr.done) tr.done();
      }
      return;
    }
    if (this.mode === 'fixed') {
      // 固定机位：轻微呼吸感
      const t = performance.now() / 1000;
      this.camera.position.copy(this.fixedPose.pos);
      this.camera.position.y += Math.sin(t * 1.3) * 0.003;
      this.camera.quaternion.copy(this.fixedPose.q);
      return;
    }
    // 键盘转头（无指针锁定时的后备）
    const turn = (this.keys.ArrowLeft ? 1 : 0) - (this.keys.ArrowRight ? 1 : 0);
    const tilt = (this.keys.ArrowUp ? 1 : 0) - (this.keys.ArrowDown ? 1 : 0);
    this.yaw += turn * dt * 2.0;
    this.pitch = Math.max(-1.3, Math.min(1.25, this.pitch + tilt * dt * 1.5));

    if (this.enabled) {
      const f = (this.keys.KeyW ? 1 : 0) - (this.keys.KeyS ? 1 : 0);
      const s = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0);
      if (f || s) {
        const fw = this.forward();
        const rt = new THREE.Vector3(-fw.z, 0, fw.x);
        const v = fw.multiplyScalar(f).add(rt.multiplyScalar(s));
        v.normalize().multiplyScalar((this.keys.ShiftLeft ? 3.2 : 2.1) * dt);
        this.pos.add(v);
        this.collide(this.pos);
        this.bobT += dt * 9;
        this.stepAcc += v.length();
        if (this.stepAcc > 0.75) { this.stepAcc = 0; if (this.onStep) this.onStep(); }
      } else {
        this.bobT += (Math.round(this.bobT / Math.PI) * Math.PI - this.bobT) * Math.min(1, dt * 8);
      }
    }
    this.applyCamera();
  }

  applyCamera() {
    this.camera.position.set(this.pos.x, EYE + Math.abs(Math.sin(this.bobT)) * 0.025, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.hand.position.y = -0.42 + Math.sin(this.bobT * 2) * 0.006;
  }
}
