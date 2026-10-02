/* ======================================================================
   공용 걷기 동작(2026-09-29) — 사용자 「이동 거리랑 발걸음이 안 맞아」「걷는 게 좀 부자연스러워」
   진단(기존 GLB walk 클립, 50명 같은 골격): 한 걸음 8.7cm · 주기 1.33s → 고유 속도 0.10m/s.
   게임은 0.85~1.8m/s 로 움직여(재생 속도 상한 3.6) 딛는 발이 몸 속도의 86% 로 미끄러졌다.
   골반 위아래 3mm·좌우 4mm, 가슴 1.2°·머리 0°(굳음), 팔 10°(좌우 범위도 다름), 발 들림 2.5cm.
   → 파라미터(data/walk_params.json)로 걷기를 새로 만든다. 원본 GLB·클립 파일은 그대로(런타임에서 클립만 새로 만든다).
     · 기준 자세 = 그 캐릭터 자신의 idle 첫 프레임(팔·손 모양이 사람마다 다른 것을 그대로 둔다)
     · 딛는 발: IK 로 발목 목표를 바닥 위에서 고유 속도로 정확히 뒤로(모델 공간) — 게임은 실제 이동 속도 ÷ 고유 속도로 재생
     · 뒤꿈치로 딛고(발끝 들림) 발볼로 뗀다(뒤꿈치 들림) — 회전 중심을 뒤꿈치/발볼에 둬 딛는 점이 안 움직인다
     · 골반: 두 발 딛는 순간 가장 낮고 한 발 가운데서 가장 높다(다리 길이로 닿는 높이를 넘지 않게) · 딛는 발 쪽으로 좌우 이동 · 비틀기/기울기
     · 가슴 반대 비틀기, 머리는 흔들림을 상쇄해 앞을 본다, 팔은 반대 다리와 앞뒤 대칭, 무릎 보조뼈 = 정강이 회전의 절반(기존 클립 실측)
     · 치마 뼈는 허벅지 앞뒤를 따라간다. 얼굴 깜빡임·옷 제어·치마 주름(drape) 모프는 기존 walk 에서 위상 맞춰 가져온다
   같은 파라미터로 Blender 단계(character-packs/staff50-approved17/stage_walk_rework_20260929/apply_walk_params.py)가 같은 키를 '17_Rig' walk 에 쓴다.
   ====================================================================== */
const DEG = Math.PI / 180;

export async function loadWalkParams(url) {
  const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('walk_params HTTP ' + r.status); return r.json();
}

/* C = {model, bones, mixer, actions:{idle, walk}} — native 캐릭터 어댑터가 가진 것 */
export function buildWalkClip(THREE, C, P0) {
  const { model, bones: B, mixer, actions } = C;
  /* 치마를 입은 사람(보이는 치마 메시)은 치마 걸음(보폭 짧게·골반 비틀기 없음) — 치마 뼈가 허벅지를 따라갈 수 있는 범위(50명 치마 뚫림 실측) */
  let hasSkirt = false; model.traverse(o => { if (o.isSkinnedMesh && o.visible && /Skirt/i.test(o.name)) hasSkirt = true; });
  const variant = hasSkirt ? 'skirt' : 'pants';
  const P = Object.assign({}, P0, (P0.variants && P0.variants[variant]) || {});
  const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
  const saved = { pos: model.position.clone(), quat: model.quaternion.clone(), scale: model.scale.clone() };
  model.position.set(0, 0, 0); model.quaternion.identity(); model.updateMatrixWorld(true);
  /* 기준 자세: idle 0 프레임 */
  /* 주의: action.stop() 은 뼈를 바인드(T) 자세로 되돌린다 — idle 을 적용한 직후 기준 자세를 먼저 떠 둔다 */
  mixer.stopAllAction(); const idle = actions.idle; idle.reset(); idle.enabled = true; idle.setEffectiveWeight(1); idle.play(); idle.time = 0; mixer.update(0);
  model.updateMatrixWorld(true);
  const base = {}; for (const n in B) base[n] = { q: B[n].quaternion.clone(), p: B[n].position.clone(), s: B[n].scale.clone() };
  const wq = (b) => b.getWorldQuaternion(new THREE.Quaternion()), wp = (b) => b.getWorldPosition(new THREE.Vector3());
  const setWorldQuat = (b, qw) => { const pq = b.parent ? wq(b.parent) : new THREE.Quaternion(); b.quaternion.copy(pq.invert().multiply(qw)); b.updateMatrixWorld(true); };
  const rotW = (b, axis, ang) => { if (!b || !ang) return; setWorldQuat(b, new THREE.Quaternion().setFromAxisAngle(axis, ang).multiply(wq(b))); };
  const aim = (b, child, dir) => { const cur = wp(child).sub(wp(b)).normalize(); setWorldQuat(b, new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize()).multiply(wq(b))); };
  /* 발 기하(idle): 발목(Foot)·발볼(Toe)·뒤꿈치(발바닥 가장 뒤)·바닥 높이 */
  const feet = {};
  for (const s of ['L', 'R']) {
    const sole = model.getObjectByName('31_Sole_' + s); let ground = Infinity, heelZ = Infinity; const v = new THREE.Vector3();
    if (sole) { const pos = sole.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { sole.getVertexPosition(i, v); v.applyMatrix4(sole.matrixWorld); if (v.y < ground) ground = v.y; } for (let i = 0; i < pos.count; i++) { sole.getVertexPosition(i, v); v.applyMatrix4(sole.matrixWorld); if (v.y < ground + 0.004 && v.z < heelZ) heelZ = v.z; } }
    const ank = wp(B['Foot_' + s]), toe = wp(B['Toe_' + s]);
    feet[s] = { ank, toe, ground: isFinite(ground) ? ground : 0.001, heelZ: isFinite(heelZ) ? heelZ : ank.z - 0.017,
      footQ: wq(B['Foot_' + s]), toeQ: wq(B['Toe_' + s]), thigh: wp(B['Thigh_' + s]),
      l1: wp(B['Thigh_' + s]).distanceTo(wp(B['Shin_' + s])), l2: wp(B['Shin_' + s]).distanceTo(ank) };
  }
  const soleMesh = { L: model.getObjectByName('31_Sole_L'), R: model.getObjectByName('31_Sole_R') };
  const soleLow = (s) => { const m = soleMesh[s], pos = m.geometry.attributes.position, v = new THREE.Vector3(); model.updateMatrixWorld(true); let lo = Infinity; for (let i = 0; i < pos.count; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); if (v.y < lo) lo = v.y; } return lo; };
  const hipsBase = base.Hips.p.clone();   /* Hips 는 Root 아래(Root = 모델 원점) */
  const thighOff = {}; for (const s of ['L', 'R']) thighOff[s] = feet[s].thigh.clone().sub(wp(B.Hips));
  const headQ0 = wq(B.Head);
  const T = P.period_s, S = P.step_m, beta = P.duty, L = 2 * S * beta;   /* 딛는 동안 발이 뒤로 가는 거리 */
  const vNat = 2 * S / T, N = P.keys_per_cycle;
  const ease = (x) => x * x * (3 - 2 * x);
  /* 곡선(모캡에서 뽑은 한 주기 표본, 선택) — cv: 주기(0~1) 반복 보간 · cl: 0~1 구간 보간(흔들 다리 진행·들림) */
  const CV = P.curves || null;
  const cv = (name, x) => { const a = CV && CV[name]; if (!a) return null; const n = a.length, f = (((x % 1) + 1) % 1) * n, i = Math.floor(f), t = f - i; return a[i % n] * (1 - t) + a[(i + 1) % n] * t; };
  const cl = (name, x) => { const a = CV && CV[name]; if (!a) return null; const n = a.length - 1, f = Math.min(1, Math.max(0, x)) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i; return a[i] * (1 - t) + a[i + 1] * t; };
  const PS = P.pitch_scale == null ? 1 : P.pitch_scale;
  /* 한 발의 목표: 발목 위치와 발 기울기(+ = 뒤꿈치 들림, − = 발끝 들림) — 모델 공간 */
  /* 발 기울기의 회전 중심: 발끝 들림(−) = 뒤꿈치 바닥점, 뒤꿈치 들림(+) = 발가락 관절(발가락은 바닥에 평평하게 남는다) */
  const pivotAnkle = (s, dz, pitch, lift, which) => {
    const f = feet[s]; const ank = f.ank.clone(); ank.z += dz; ank.y += lift;
    if (Math.abs(pitch) < 1e-6) return ank;
    const toePiv = which ? which === 'toe' : pitch > 0;
    const piv = toePiv ? new THREE.Vector3(ank.x, f.toe.y + lift, f.toe.z + dz) : new THREE.Vector3(ank.x, f.ground + lift, f.heelZ + dz);
    return ank.sub(piv).applyAxisAngle(X, pitch).add(piv);
  };
  const D = vNat * T;   /* 한 주기 동안 몸(=세계에서 발)이 가는 거리 */
  const footTarget = (s, u) => {
    const hs = P.heel_strike_deg * DEG, to = P.toe_off_deg * DEG;
    if (u < beta) { const c = u / beta, dz = L / 2 - L * c;
      let pitch = 0; if (c < 0.18) pitch = -hs * (1 - c / 0.18); else if (c > 0.62) pitch = to * ((c - 0.62) / 0.38);
      const pc = cv('pitch', u); if (pc != null) { const pp = pc * DEG * PS; pitch = c < 0.3 ? Math.min(0, pp) : c > 0.55 ? Math.max(0, pp) : 0; }   /* 모캡: 뒤꿈치 딛기(발끝 들림만) → 발바닥 평평 → 발볼 떼기(뒤꿈치 들림만) — 부호가 바뀌면 딛는 점이 뒤꿈치↔발볼로 튀어 끌린다 */
      return { ank: pivotAnkle(s, dz, pitch, 0), pitch, stance: true }; }
    /* 흔들 다리: 세계에서 발이 0 속도로 떠서 0 속도로 내린다(모델 공간에서는 양 끝이 −고유속도 = 딛는 발과 같은 속도) */
    const sw = (u - beta) / (1 - beta); let e = sw * sw * sw * (sw * (sw * 6 - 15) + 10);   /* 5차 ease — 떼는·딛는 순간 속도가 0 에 더 빨리 붙는다 */
    const ce = cl('swing_e', sw); if (ce != null) { const w = Math.sin(Math.PI * sw); e = e + (ce - e) * w * w; }   /* 모캡: 흔들 발이 세계에서 나아가는 진행(0→1) — 떼고 딛는 순간은 속도 0(5차) 에 붙인다(딛는 발 끌림 방지) */
    const pc = cv('pitch', u); let cf = cl('lift', sw);
    if (cf != null) { const a0 = Math.sin(Math.PI * Math.pow(sw, 0.6)), w = Math.sin(Math.PI * sw); cf = Math.max(0, a0 + (cf - a0) * w * w); if (P.lift_floor) cf = Math.max(cf, P.lift_floor * Math.sin(Math.PI * sw)); }   /* 모캡 들림 곡선(떼고 딛는 끝은 0 에 붙인다) + 가운데가 너무 낮지 않게 */
    const dz = -L / 2 + D * e - (D - L) * sw, pitch = pc != null ? pc * DEG * (P.swing_pitch_scale == null ? PS : P.swing_pitch_scale) : to + (-hs - to) * e, lift = P.foot_lift_m * (cf != null ? cf : Math.sin(Math.PI * Math.pow(sw, 0.6)));   /* 떼자마자 빨리 들고(발끝이 바닥을 긁지 않게) 천천히 내린다 */
    const ank = pivotAnkle(s, dz, pitch, lift, 'toe').lerp(pivotAnkle(s, dz, pitch, lift, 'heel'), e);
    return { ank, pitch, stance: false, sw };
  };
  const solveLeg = (s, tgt) => {
    const Th = B['Thigh_' + s], Sh = B['Shin_' + s], F = B['Foot_' + s], O = B['Toe_' + s], K = B['KneeSupport_' + s];
    const f = feet[s]; model.updateMatrixWorld(true);
    const hip = wp(Th); let knee = wp(Sh), ank = wp(F);
    const d = Math.min(f.l1 + f.l2 - 1e-4, Math.max(Math.abs(f.l1 - f.l2) + 1e-3, hip.distanceTo(tgt.ank)));
    const want = Math.PI - Math.acos(Math.min(1, Math.max(-1, (f.l1 * f.l1 + f.l2 * f.l2 - d * d) / (2 * f.l1 * f.l2))));
    const now = knee.clone().sub(hip).angleTo(ank.clone().sub(knee));
    rotW(Sh, X, want - now);   /* +X 회전 = 정강이가 뒤로(무릎이 앞으로) 굽는다 */
    ank = wp(F);
    const q = new THREE.Quaternion().setFromUnitVectors(ank.sub(hip).normalize(), tgt.ank.clone().sub(hip).normalize());
    setWorldQuat(Th, q.multiply(wq(Th)));
    setWorldQuat(F, new THREE.Quaternion().setFromAxisAngle(X, tgt.pitch).multiply(f.footQ));
    /* 발볼로 뗄 때 발가락은 바닥에 평평하게 */
    { const withFoot = new THREE.Quaternion().setFromAxisAngle(X, tgt.pitch).multiply(f.toeQ);   /* 발볼로 딛는 동안은 평평, 떠오르며 0.35 동안 발 기울기로 */
      setWorldQuat(O, tgt.pitch > 0 && tgt.stance ? f.toeQ.clone() : tgt.stance ? withFoot : f.toeQ.clone().slerp(withFoot, Math.min(1, (tgt.sw || 0) / 0.2))); }
    if (K) { const dsh = base['Shin_' + s].q.clone().invert().multiply(Sh.quaternion); K.quaternion.copy(base['KneeSupport_' + s].q.clone().multiply(new THREE.Quaternion().slerp(dsh, 0.5))); }
  };
  /* 골반 높이: 두 다리가 닿는 높이를 넘지 않게(다리 길이 − 여유) */
  const hipsY = [];
  const reachY = (phi) => {
    let lim = Infinity;
    for (const s of ['L', 'R']) { const u = (phi + (s === 'R' ? 0.5 : 0)) % 1, t = footTarget(s, u), f = feet[s];
      const sway = -P.sway_m * Math.sin(2 * Math.PI * phi);
      const tx = hipsBase.x + sway + thighOff[s].x, tz = hipsBase.z + thighOff[s].z;
      const r = Math.hypot(t.ank.x - tx, t.ank.z - tz), Lm = f.l1 + f.l2 - P.reach_margin_m;
      lim = Math.min(lim, t.ank.y + Math.sqrt(Math.max(0, Lm * Lm - r * r)) - thighOff[s].y); }
    return lim;
  };
  for (let k = 0; k < N; k++) { const phi = k / N;
    const cb = cv('bob', phi);   /* 모캡: 골반 높이(−1~1) × bob_m */
    const want = hipsBase.y - P.crouch_m - (cb != null ? -cb * (P.bob_m || 0) : P.bob_extra_m * (0.5 + 0.5 * Math.cos(4 * Math.PI * phi)));
    hipsY.push(Math.min(want, reachY(phi))); }
  /* 원형 평활(두 번) 뒤 다시 닿는 높이 이하로 */
  for (let it = 0; it < 2; it++) { const c = hipsY.slice(); for (let k = 0; k < N; k++) hipsY[k] = (c[(k + N - 1) % N] + 2 * c[k] + c[(k + 1) % N]) / 4; }
  for (let k = 0; k < N; k++) hipsY[k] = Math.min(hipsY[k], reachY(k / N));
  /* 키 만들기 */
  const drive = ['Hips', 'Spine', 'Chest', 'Head', 'HairBack', 'HairSide_L', 'HairSide_R', 'UpperArm_L', 'Forearm_L', 'UpperArm_R', 'Forearm_R',
    'Thigh_L', 'KneeSupport_L', 'Shin_L', 'Foot_L', 'Toe_L', 'Thigh_R', 'KneeSupport_R', 'Shin_R', 'Foot_R', 'Toe_R',
    'Skirt_Front_L_1', 'Skirt_Front_L_2', 'Skirt_Back_L_1', 'Skirt_Back_L_2', 'Skirt_Side_L_1', 'Skirt_Side_L_2',
    'Skirt_Front_R_1', 'Skirt_Front_R_2', 'Skirt_Back_R_1', 'Skirt_Back_R_2', 'Skirt_Side_R_1', 'Skirt_Side_R_2'].filter(n => B[n]);
  const times = [], qv = Object.fromEntries(drive.map(n => [n, []])), hp = [], sv = {};
  const footLog = [];
  for (let k = 0; k <= N; k++) {
    const phi = (k % N) / N; times.push(T * k / N);
    for (const n in B) { B[n].quaternion.copy(base[n].q); B[n].position.copy(base[n].p); B[n].scale.copy(base[n].s); }
    const c1 = Math.cos(2 * Math.PI * phi), s1 = Math.sin(2 * Math.PI * phi);
    B.Hips.position.set(hipsBase.x - P.sway_m * s1, hipsY[k % N], hipsBase.z);
    model.updateMatrixWorld(true);
    const TS = P.trunk_scale == null ? 1 : P.trunk_scale;
    const pyaw = cv('pelvis_yaw', phi), prol = cv('pelvis_roll', phi), ppit = cv('pelvis_pitch', phi), chy = cv('chest_yaw', phi);
    const yawP = pyaw != null ? pyaw * DEG * TS : P.pelvis_yaw_deg * DEG * c1;
    rotW(B.Hips, Y, yawP); rotW(B.Hips, Z, prol != null ? prol * DEG * TS : -P.pelvis_roll_deg * DEG * s1 * (1 + (P.asym || 0) * Math.sign(s1)));
    if (ppit != null) rotW(B.Hips, X, ppit * DEG * TS);
    rotW(B.Spine, X, P.spine_lean_deg * DEG); rotW(B.Chest, Y, chy != null ? chy * DEG * TS - yawP : P.chest_yaw_deg * DEG * c1 - P.pelvis_yaw_deg * DEG * c1 * 0.5);
    /* 팔: 반대 다리와 대칭 앞뒤(앞 = 끝이 +z) · 앞으로 갈 때 팔꿈치가 조금 더 굽는다 */
    const pa = phi - (P.arm_lag || 0), ca = Math.cos(2 * Math.PI * pa);   /* 팔은 다리보다 arm_lag 주기만큼 늦게 */
    for (const s of ['L', 'R']) { const f = s === 'L' ? -ca : ca;   /* 왼팔은 오른다리(φ=.5 앞)와 같이 앞 */
      const amp = 1 + (P.asym || 0) * (s === 'L' ? 1 : -1);   /* 좌우가 똑같지 않게 조금 */
      const carm = cv('arm', s === 'L' ? pa : pa + 0.5), cel = cv('elbow', s === 'L' ? pa : pa + 0.5);
      const a = carm != null ? carm * DEG * (P.arm_scale == null ? 1 : P.arm_scale) * amp : P.arm_swing_deg * DEG * (f > 0 ? f : f * P.arm_back_ratio) * amp;
      if (P.arm_pose === 'hang') {
        /* 걷기 전용 팔: idle 의 접힌 팔을 따르지 않고 몸 옆으로 내린다(팔 벌림 arm_out_deg — 몸통·치마를 비키는 각) · 팔꿈치는 살짝(elbow_deg) · 앞뒤로 a */
        const U = B['UpperArm_' + s], Fo = B['Forearm_' + s], Hd = B['Hand_' + s];
        if (U && Fo && Hd) { model.updateMatrixWorld(true);
          const sx = Math.sign(wp(U).x - wp(B.Chest).x) || (s === 'L' ? -1 : 1), out = P.arm_out_deg * DEG;
          const d = new THREE.Vector3(sx * Math.sin(out), -Math.cos(out), 0).applyAxisAngle(X, -a);
          aim(U, Fo, d);
          const el = (cel != null ? P.elbow_deg + Math.max(0, cel - (P.elbow_curve_min || 0)) * (P.elbow_scale == null ? 1 : P.elbow_scale) : P.elbow_deg + P.forearm_swing_deg * Math.max(0, f)) * DEG;
          const k = new THREE.Vector3().crossVectors(d, Z).normalize();
          aim(Fo, Hd, d.clone().applyAxisAngle(k, el));
          if (P.arm_twist_deg) { rotW(U, d.clone().normalize(), sx * P.arm_twist_deg * DEG); } }
        continue; }
      rotW(B['UpperArm_' + s], Z, (s === 'L' ? -1 : 1) * P.arm_out_deg * DEG);
      rotW(B['UpperArm_' + s], X, -a); rotW(B['Forearm_' + s], X, -P.forearm_swing_deg * DEG * Math.max(0, f)); }
    for (const s of ['L', 'R']) { const u = (phi + (s === 'R' ? 0.5 : 0)) % 1; const t = footTarget(s, u); solveLeg(s, t); footLog.push([k, s, t.stance, +t.ank.z.toFixed(4)]);
      /* 흔들 발 바닥 여유(min_clear_m, 선택): 발끝이 내려가 바닥을 긁으면(발바닥 가장 낮은 점) 그만큼 발을 올려 다시 푼다 — 떼고 딛는 끝(12%)에서는 0 으로 줄인다 */
      if (P.min_clear_m && !t.stance && soleMesh[s]) { const fl = P.min_clear_m * Math.min(1, t.sw / 0.12, (1 - t.sw) / 0.12);
        for (let it = 0; it < 2; it++) { const low = soleLow(s), need = feet[s].ground + fl - low; if (need <= 1e-5) break; t.ank.y += need; solveLeg(s, t); } } }
    /* 치마: 허벅지 앞뒤 각(+ = 앞) 을 따라간다 */
    model.updateMatrixWorld(true);
    for (const s of ['L', 'R']) { const d = wp(B['Shin_' + s]).sub(wp(B['Thigh_' + s])).normalize(); const a = Math.atan2(d.z, -d.y);
      /* 윗뼈(_1)는 조금만 — 많이 돌리면 허리 앞판이 벌어져 속살이 보인다. 치맛단은 아랫뼈(_2)로 허벅지를 따라간다 */
      const K = P.skirt, fw = a > 0 ? a : 0, bw = a < 0 ? a : 0;
      rotW(B['Skirt_Front_' + s + '_1'], X, -fw * K.front[0]); rotW(B['Skirt_Front_' + s + '_2'], X, -fw * K.front[1]);
      rotW(B['Skirt_Back_' + s + '_1'], X, -bw * K.back[0]); rotW(B['Skirt_Back_' + s + '_2'], X, -bw * K.back[1]);
      rotW(B['Skirt_Side_' + s + '_1'], X, -a * K.side[0]); rotW(B['Skirt_Side_' + s + '_2'], X, -a * K.side[1]);
      /* 걸을 때 치마가 살짝 퍼진다(다리가 드나들 틈) — 옆판은 바깥으로(Z), 앞·뒤판은 앞·뒤로 */
      const fl = (K.flare_deg || 0) * DEG, sg = s === 'L' ? -1 : 1;
      if (fl) { rotW(B['Skirt_Side_' + s + '_1'], Z, sg * fl); rotW(B['Skirt_Front_' + s + '_1'], X, -fl * 0.6); rotW(B['Skirt_Back_' + s + '_1'], X, fl * 0.6); } }
    /* 걸을 때 치마 윗판을 뼈 길이 방향과 수직으로만 조금 넓힌다(허벅지 윗부분이 치마를 뚫지 않게 — 허리선은 그대로) */
    const inf = P.skirt && P.skirt.inflate;
    if (inf) for (const s of ['L', 'R']) for (const part of ['Front', 'Back', 'Side']) for (const lv of [1, 2]) { const b = B['Skirt_' + part + '_' + s + '_' + lv]; if (!b) continue;
      const f = inf[lv - 1]; b.scale.set(base[b.name].s.x * f, base[b.name].s.y, base[b.name].s.z * f); }
    /* 머리: 몸통 흔들림을 상쇄해 앞을 보고, 튀는 박자에 살짝 끄덕 · 머리카락은 반 박자 늦게 */
    setWorldQuat(B.Head, new THREE.Quaternion().setFromAxisAngle(X, P.head_nod_deg * DEG * Math.cos(4 * Math.PI * (phi - (P.head_lag || 0)))).multiply(headQ0));   /* 머리는 몸보다 head_lag 만큼 늦게 */
    for (const h of ['HairBack', 'HairSide_L', 'HairSide_R']) rotW(B[h], X, P.hair_bounce_deg * DEG * Math.sin(4 * Math.PI * phi - 1.2));
    for (const n of drive) { const q = B[n].quaternion; qv[n].push(q.x, q.y, q.z, q.w); }
    for (const n of drive) if (/^Skirt_/.test(n)) { const sc = B[n].scale; (sv[n] = sv[n] || []).push(sc.x, sc.y, sc.z); }
    hp.push(B.Hips.position.x, B.Hips.position.y, B.Hips.position.z);
  }
  const tracks = [new THREE.VectorKeyframeTrack('Hips.position', times, hp)];
  for (const n of drive) tracks.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', times, qv[n]));
  for (const n in sv) tracks.push(new THREE.VectorKeyframeTrack(n + '.scale', times, sv[n]));
  /* 기존 walk 에서: 얼굴 깜빡임·옷/얼굴 제어·치마 주름 모프 — 위상을 새 주기에 맞춰 늘이고 줄인다 */
  const old = actions.walk.getClip(), k = T / old.duration;
  const keep = (name) => (/morphTargetInfluences$/.test(name) && (P.drape_morphs !== 'none' || !/Skirt/.test(name))) || /^(ClothControl|FaceControl)\./.test(name);
  /* 위상 맞춤: 옛 클립의 왼발 딛기 위상(drape_phase_offset, 실측 0.96)을 새 클립 0 에 맞춰 다시 뽑는다(치마 주름이 다리 위치와 같은 순간에) */
  const off = P.drape_phase_offset || 0;
  for (const t of old.tracks) if (keep(t.name)) {
    if (!off) { const c = t.clone(); c.times = Float32Array.from(t.times, x => x * k); tracks.push(c); continue; }
    const ip = t.createInterpolant(), n = t.getValueSize(), vals = [];
    for (let i = 0; i <= N; i++) { const r = ip.evaluate((((i / N) + off) % 1) * old.duration); for (let j = 0; j < n; j++) vals.push(r[j]); }
    tracks.push(new t.constructor(t.name, times, vals)); }
  /* 나머지 뼈(손가락·비틀림 보조·어깨·목 등)는 idle 기준 자세로 고정 — 기존 walk 의 굽은 팔 자세가 섞이지 않게 */
  const drove = new Set(drive.concat(['Hips']));
  for (const n in B) if (!drove.has(n)) { const b = base[n]; tracks.push(new THREE.QuaternionKeyframeTrack(n + '.quaternion', [0, T], [...b.q.toArray(), ...b.q.toArray()]));
    tracks.push(new THREE.VectorKeyframeTrack(n + '.position', [0, T], [...b.p.toArray(), ...b.p.toArray()])); }
  const clip = new THREE.AnimationClip('walk', T, tracks);
  /* 복원 */
  idle.stop();
  for (const n in B) { B[n].quaternion.copy(base[n].q); B[n].position.copy(base[n].p); B[n].scale.copy(base[n].s); }
  model.position.copy(saved.pos); model.quaternion.copy(saved.quat); model.scale.copy(saved.scale); model.updateMatrixWorld(true);
  const bob = [Math.min(...hipsY), Math.max(...hipsY)];
  return { clip, vNat, report: { name: P.name, variant, period: T, step: S, duty: beta, vNat: +vNat.toFixed(4), strideStanceTravel: +L.toFixed(4), hipsY: bob.map(x => +x.toFixed(4)), legLen: +(feet.L.l1 + feet.L.l2).toFixed(4), stepsPerSec: +(2 / T).toFixed(2), startPhase: P.start_phase == null ? 0.3 : P.start_phase, moveMps: P.move_mps || null, headLocalFwd: new THREE.Vector3(0, 0, 1).applyQuaternion(headQ0.clone().invert()).toArray().map(x => +x.toFixed(4)) } };
}
