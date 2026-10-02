/* ======================================================================
   사용자 Blender 사무실 킷(?office=kit) — 2026-09-29
   사용자 원문: 「내가 준 사무실에서 수정해」「너가 만들었던 건 안 쓸 계획이야」「사람 소품 사무실 전부」
   · 소품·맞춤 의자·복도 = character-packs/staff50-approved17/deliverables_revision6/props 의 GLB
     (게임용 사본 assets/office_kit/ — tools/sync_office_kit.py 가 복사·해시 기록. 원본은 건드리지 않는다)
   · 킷에 방 껍데기(벽·바닥·천장)는 없다 → 킷 재질 색(Linen plaster · Honey oak · Warm porcelain · Limestone)으로 코드 벽·바닥만 둔다
   · 불러올 때만 맞춘다(원본 GLB 불변): 의자 높이·등받이 위치는 게임 실측 좌석 프로필에 맞춰 노드 변환만 바꾼다
   좌표: 킷 GLB 는 glTF(Y 위) · 소품 앞면 +Z · 벽 부착형은 벽면 z=0 에서 +Z 로 나온다.
   ====================================================================== */
export const KIT_DIR = 'assets/office_kit/';
const KIT_VER = '20260929kit2';

/* Blender 재질의 Base Color(선형값) — 킷 GLB 와 같은 수치 */
export const KIT_LINEAR = {
  linenPlaster: [0.68, 0.65, 0.57], honeyOak: [0.40, 0.25, 0.13], warmPorcelain: [0.79, 0.75, 0.66],
  limestone: [[0.58, 0.55, 0.48], [0.592, 0.562, 0.493], [0.604, 0.574, 0.506], [0.616, 0.586, 0.519], [0.628, 0.598, 0.532]],
  graphite: [0.047, 0.061, 0.055], mutedSage: [0.24, 0.35, 0.29], warmDiffuser: [0.95, 0.82, 0.58],
};
const lin = (THREE, rgb) => new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2], THREE.LinearSRGBColorSpace);
const css = (THREE, rgb) => '#' + lin(THREE, rgb).getHexString();

/* 방 바닥: 복도 킷의 석회암 타일(5단 색) 톤을 그대로 — 큰 줄눈 타일, 잔무늬 약하게 */
function limestoneFloor(THREE, RW, RD) {
  const cols = KIT_LINEAR.limestone.map(c => css(THREE, c));
  const S = 1024, N = 8, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cell = S / N;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x * cell, y * cell, cell, cell);
    for (let i = 0; i < 90; i++) { g.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.025)' : 'rgba(255,255,255,.035)'; g.fillRect(x * cell + rnd() * cell, y * cell + rnd() * cell, 2, 2); }
  }
  g.strokeStyle = 'rgba(92,80,64,.28)'; g.lineWidth = 3;
  for (let i = 0; i <= N; i++) { g.beginPath(); g.moveTo(i * cell, 0); g.lineTo(i * cell, S); g.stroke(); g.beginPath(); g.moveTo(0, i * cell); g.lineTo(S, i * cell); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.repeat.set(RW / (N * 0.5), RD / (N * 0.5));   /* 타일 한 장 0.5 m(복도 킷 타일과 같은 크기) */
  return t;
}
/* 벽: Linen plaster 한 색 + 아주 약한 잔무늬(평평한 단색이면 조명에서 판자처럼 보인다) */
function plasterTex(THREE) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = css(THREE, KIT_LINEAR.linenPlaster); g.fillRect(0, 0, 128, 256);
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 700; i++) { g.fillStyle = rnd() < .5 ? 'rgba(0,0,0,.03)' : 'rgba(255,255,255,.04)'; g.fillRect(rnd() * 128, rnd() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/* 게임 공용 재질(M)을 킷 색으로 바꾼다 — 방 껍데기(벽·바닥·천장·몰딩·창틀)만 쓰는 재질들 */
export function applyKitMaterials(THREE, M, { RW, RD }) {
  M.floor = new THREE.MeshStandardMaterial({ map: limestoneFloor(THREE, RW, RD), roughness: .86, metalness: 0 });
  M.wall = new THREE.MeshStandardMaterial({ map: plasterTex(THREE), roughness: .95, metalness: 0 });
  M.ceil = new THREE.MeshStandardMaterial({ color: lin(THREE, KIT_LINEAR.warmPorcelain), roughness: 1, metalness: 0 });
  M.base = new THREE.MeshStandardMaterial({ color: lin(THREE, KIT_LINEAR.warmPorcelain), roughness: .7 });   /* 벽 윗단 마감선·천장 몰딩 */
  M.kitSkirt = new THREE.MeshStandardMaterial({ color: lin(THREE, KIT_LINEAR.honeyOak), roughness: .62 });  /* 걸레받이 = 킷 Oak skirting */
  M.white = new THREE.MeshStandardMaterial({ color: lin(THREE, KIT_LINEAR.warmPorcelain), roughness: .72 });  /* 창틀·창턱 */
  M.blind = new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: .9, side: THREE.DoubleSide });
  return M;
}
export const KIT_BG = '#e9e3d6';   /* 가림막·배경 — 킷 벽색보다 한 톤 밝게 */

/* ---------------------------------------------------------------------- */
const PRELOAD = ['desk', 'chair', 'monitor', 'keyboard_mouse', 'laptop', 'mug', 'redphone', 'headphones', 'camera',
  'smallplant', 'bigplant', 'bookshelf', 'corkboard', 'coathanger', 'paper_stack', 'file_folder', 'paper_tray',
  'filing_cabinet', 'locker', 'sofa', 'rug', 'water_dispenser', 'copier', 'storage_box', 'waste_bin',
  'wall_clock', 'whiteboard', 'calendar', 'poster_frame', 'floor_lamp', 'ceiling_light', 'door', 'meeting_table', 'meeting_stool'];

/* 킷 로더. 소품 GLB 는 종류마다 한 번만 받아 방마다 clone(형상·재질 공유) */
export async function loadOfficeKit(THREE, GLTFLoader, { onProgress } = {}) {
  const t0 = performance.now();
  const man = await fetch(KIT_DIR + 'manifest.json?v=' + KIT_VER).then(r => { if (!r.ok) throw new Error('office_kit manifest HTTP ' + r.status); return r.json(); });
  const loader = new GLTFLoader();
  const url = (f) => KIT_DIR + f + '?v=' + (man.files[f]?.sha256 || KIT_VER).slice(0, 12);
  const proto = {}; let bytes = 0, done = 0;
  const chairFiles = [...new Set(Object.values(man.chairs))];
  const names = [...PRELOAD.map(n => n + '.glb'), ...chairFiles];
  await Promise.all(names.map(async f => {
    const g = await loader.loadAsync(url(f));
    g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.scene.userData.kitFile = f; g.scene.userData.kitExtras = extrasOf(g.scene);
    proto[f.replace(/\.glb$/, '')] = g.scene; bytes += man.files[f]?.bytes || 0; done++;
    onProgress?.(done, names.length);
  }));
  let corridorP = null;
  const KIT = {
    manifest: man, proto, loadMs: Math.round(performance.now() - t0), bytes, files: names.length,
    has: (n) => !!proto[n],
    /* 같은 형상·재질을 공유하는 복제본 */
    clone(n) { const p = proto[n]; if (!p) throw new Error('office_kit: 없는 소품 ' + n); const c = p.clone(true); c.name = 'kit:' + n; c.userData.kit = n; return c; },
    extras: (n) => proto[n]?.userData.kitExtras || {},
    chairFileFor: (id) => (man.chairs[id] || 'chair.glb').replace(/\.glb$/, ''),
    corridor() { if (!corridorP) corridorP = loader.loadAsync(url('office_corridor.glb')).then(g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g.scene; }); return corridorP; },
    chairFor: (id, fit, over) => fittedChair(THREE, KIT, id, fit, over || {}),
    monitorScreen: (obj, mat) => overlayScreen(THREE, obj, mat),
  };
  return KIT;
}
function extrasOf(scene) { let ex = null; scene.traverse(o => { if (!ex && o.userData && o.userData.asset_id) ex = o.userData; }); return ex || {}; }

/* 모니터·노트북 화면: 킷 화면판(MAT Screen)은 꺼진 짙은 청록 유리라 일하는 화면을 한 장 얹는다(원본 메시·재질은 그대로).
   화면 메시의 로컬 상자에서 가장 얇은 축을 찾아, 그 면 중 사용자 쪽(원형 기준 +Z)을 향한 면에 붙인다 */
function overlayScreen(THREE, obj, mat) {
  obj.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  obj.traverse(o => {
    if (!o.isMesh || !/^(Monitor|Laptop)[ _]Screen$/.test(o.name) || o.userData.kitScreen) return;
    o.userData.kitScreen = true; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
    const size = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z]; const t = size.indexOf(Math.min(...size));
    const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);   /* 소품 원형 공간 기준 */
    const nW = axes[t].clone().transformDirection(m); const sign = nW.z >= 0 ? 1 : -1;
    const W = t === 0 ? size[2] : size[0], H = t === 1 ? size[2] : size[1];
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W * .94, H * .92), mat);
    /* PlaneGeometry 는 XY 평면·법선 +Z. 얇은 축(t)이 법선이 되도록 돌린다 */
    if (t === 0) f.rotation.y = sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    else if (t === 1) f.rotation.x = sign > 0 ? -Math.PI / 2 : Math.PI / 2;
    else if (sign < 0) f.rotation.y = Math.PI;
    const c = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
    c.setComponent(t, sign > 0 ? b.max.getComponent(t) + .0006 : b.min.getComponent(t) - .0006);
    f.position.copy(c); f.name = 'kit_screen_face'; f.castShadow = false; f.receiveShadow = false; o.add(f);
  });
}

/* 게임 소품 슬롯 종류 → 킷 GLB */
export const KIT_SLOT = { monitor: 'monitor', laptop: 'laptop', phone_red: 'redphone', headphones: 'headphones', camera: 'camera', mug: 'mug',
  corkboard: 'corkboard', coathanger: 'coathanger', plant_big: 'bigplant', plant_small: 'smallplant', shelf_books: 'bookshelf' };

/* ---------------------------------------------------------------------- *
 * 방 배치(킷) — 좌석·동선 그래프(노드·간선·정거장)는 기존 방과 같다. 킷 소품이 기존 코드 가구보다 크거나 깊어
 * 동선을 막는 자리는 옮겼다(배치 뒤 __office.pathCheckAll() 로 10팀 검사).
 *   a: 킷 소품 · x,z: 바닥 중심(벽 부착형은 벽면 위 점) · y: 높이 · ry: 회전(앞면 +Z 기준) · wall: 붙는 벽(그 벽 윗단과 함께 숨는다)
 *   방: x[-5.3,5.3] z[-4,4], 창 x −2.6·0.6·3.5(뒤벽), 문 왼벽 z 2.2
 * ---------------------------------------------------------------------- */
const HP = Math.PI / 2;
export const KIT_ROOM = [
  /* 뒤벽(창) — 앞면 +Z */
  { a: 'locker', x: -3.5, z: -3.785, note: '뒤벽 로커(창 왼쪽)' },
  { a: 'storage_box', x: -4.62, z: -3.8, ry: .08, note: '뒤벽 왼쪽 상자' },
  { a: 'storage_box', x: -4.6, z: -3.81, y: .264, ry: -.14, note: '상자 위 상자' },
  { a: 'storage_box', x: -4.2, z: -3.8, ry: .3, note: '상자' },
  { a: 'bigplant', x: -5.08, z: -3.2, note: '뒤왼 구석 화분' },
  { a: 'bookshelf', x: -1.9, z: -3.895, note: '창 사이 책장' },
  { a: 'bookshelf', x: -1.38, z: -3.895, note: '창 사이 책장 2' },
  { a: 'bigplant', x: -0.25, z: -3.72, ry: 2.1, note: '창 사이 화분' },
  { a: 'wall_clock', x: 0.6, y: 1.40, z: -4.0, wall: 'back', note: '가운데 창 위 벽시계' },
  { a: 'bookshelf', x: 4.45, z: -3.895, note: '팀장 뒤 책장' },
  { a: 'calendar', x: 4.45, y: 1.02, z: -4.0, wall: 'back', note: '팀장 뒤 달력' },
  { a: 'waste_bin', x: 4.0, z: -3.62, note: '팀장 휴지통' },
  { a: 'bigplant', x: 5.05, z: -3.72, ry: .6, note: '뒤오른 구석 화분' },
  /* 왼벽(문) — 앞면 +X */
  { a: 'poster_frame', x: -5.3, y: .70, z: -2.4, ry: HP, wall: 'left', note: '왼벽 포스터' },
  { a: 'sofa', x: -4.925, z: -0.72, ry: HP, note: '방문객 소파' },
  { a: 'rug', x: -4.15, z: -0.72, ry: HP, note: '소파 러그' },
  { a: 'floor_lamp', x: -5.02, z: -1.9, lamp: true, note: '소파 옆 스탠드' },
  { a: 'bookshelf', x: -5.195, z: 1.15, ry: HP, note: '문 옆 책장' },
  { a: 'coathanger', x: -5.05, z: 3.62, note: '앞왼 구석 옷걸이' },
  /* 오른벽 — 앞면 −X */
  { a: 'whiteboard', x: 5.3, y: .62, z: -3.0, ry: -HP, wall: 'right', note: '오른벽 화이트보드' },
  { a: 'floor_lamp', x: 5.02, z: -2.42, lamp: true, note: '팀장석 옆 스탠드' },
  { a: 'bigplant', x: 5.05, z: -1.62, ry: .4, note: '오른벽 화분' },
  { a: 'filing_cabinet', x: 5.03, z: -0.98, ry: -HP, note: '오른벽 캐비닛', top: [['paper_tray', 0, 0, 0]] },
  { a: 'filing_cabinet', x: 5.03, z: -0.44, ry: -HP, note: '오른벽 캐비닛 2', top: [['smallplant', 0.02, -0.08, 0], ['file_folder', 0, 0.12, .3]] },
  { a: 'coathanger', x: 4.98, z: 0.1, note: '오른벽 옷걸이' },
  { a: 'corkboard', x: 5.3, y: .56, z: 0.62, ry: -HP, wall: 'right', off: .024, note: '오른벽 게시판' },
  { a: 'water_dispenser', x: 5.09, z: 3.45, ry: -HP, note: '정수기' },
  /* 앞벽(카메라 쪽 — 낮은 것만) — 앞면 −Z */
  { a: 'copier', x: 3.55, z: 3.735, ry: Math.PI, note: '복합기' },
  { a: 'bigplant', x: 4.35, z: 3.75, ry: 1.2, note: '앞오른 구석 화분' },
  { a: 'waste_bin', x: -0.2, z: 3.76, note: '앞벽 휴지통' },
  { a: 'storage_box', x: -1.45, z: 3.8, ry: Math.PI + .1, note: '앞벽 상자' },
  { a: 'storage_box', x: -1.02, z: 3.82, ry: Math.PI - .2, note: '앞벽 상자 2' },
  { a: 'bigplant', x: -2.6, z: 3.72, ry: .6, note: '앞벽 화분' },
  { a: 'poster_frame', x: -1.6, y: .70, z: 4.0, ry: Math.PI, wall: 'front', note: '앞벽 포스터' },
  /* 가운데 */
  { a: 'filing_cabinet', x: 1.25, z: 0.4, ry: HP, note: '섬·선임 사이 캐비닛', top: [['smallplant', 0, 0, 0]] },
  { a: 'filing_cabinet', x: 2.45, z: -2.08, note: '팀장 앞 캐비닛', top: [['smallplant', .1, 0, 0]] },
  { a: 'bigplant', x: -0.2, z: -1.9, ry: .9, note: '섬 뒤 화분' },
  { a: 'bigplant', x: 3.9, z: 1.6, ry: 2.6, note: '선임석 앞 화분' },
  { a: 'bigplant', x: 2.62, z: 0.95, ry: 1.3, note: '협업 자리 화분' },
  { a: 'waste_bin', x: 3.35, z: -0.12, note: '선임 휴지통' },
];
/* 회의 원탁(킷 meeting_table 지름 1.24, 상판 0.355 = 책상 높이) — 조력자 자리 staff3·staff4 가 쓴다 */
export const KIT_TABLE = { x: 1.6, z: 3.05, seatR: 0.64, stoolR: 0.79, seats: { staff3: Math.PI, staff4: 0 }, spare: [[HP, 0.74]] };
/* 팀장 책상 소품(킷 책상은 폭 0.71 — 기존 1.0 책상 목록은 상판 밖으로 나간다) */
export const KIT_LEAD_DESK = [['laptop', 0.04, 0.2, 0], ['phone_red', -0.25, 0.27, 0.3], ['mug', 0.27, 0.1, 0], ['plant_small', 0.27, 0.29, 0]];
/* 천장등(킷 ceiling_light) — 기존 펜던트 자리 */
export const KIT_CEIL = { y: -0.0 };

/* ---------------------------------------------------------------------- *
 * 캐릭터별 맞춤 의자(킷 chair_acnh_XX.glb) — 게임 좌석 프로필에 맞추기
 *  · 의자 원점 = 캐릭터 루트 + (0,0,-0.1702)  (킷 fitted_chairs.json placement_three 그대로)
 *  · 좌판 윗면: 킷 0.200 → 게임 실측 좌석 높이(chairSeatY, 옷 아랫면 −2mm)로 의자 전체 높이 비율만 맞춘다(0.943~1.005)
 *  · 등받이: 긴 머리·치마 뒷자락(프로필 backrestZ/seatBackZ)보다 앞에 있으면 등받이·뒤 브래킷만 뒤로 민다
 *            프로필 backrestHeight(머리가 등받이 위로 내려오는 인물)가 있으면 등받이를 그 높이까지만 남긴다
 *  반환 그룹 원점 = 캐릭터 루트(게임 좌석 원점) — 게임이 앉기·일어서기 때 이 그룹을 사람과 같이 민다
 * ---------------------------------------------------------------------- */
/* 좌판 앞이 긴 킷 의자(chair_acnh_18 형)에서 실제 게임 모델(현재 판)의 허벅지·치마가 좌판 앞 5.9mm(앉기 중 16mm) 파묻힌 12명 —
   사용자가 만든 좌판 앞을 줄인 킷 의자(chair_acnh_32 형, 좌판 앞 0.0796)로 바꾼다. 근거: 50명 좌석 관통 검사(tmp office_kit/seatqa_kit_all.json) */
export const KIT_CHAIR_VARIANT = Object.fromEntries(['acnh_30', 'acnh_52', 'acnh_54', 'acnh_20', 'acnh_56', 'acnh_58', 'acnh_60', 'acnh_62', 'acnh_64', 'acnh_66', 'acnh_68', 'acnh_70'].map(id => [id, 'chair_acnh_32']));
export const KIT_CHAIR = { placeZ: -0.1702185496687889, seatTop: 0.200, backFront: -0.0825, backTop: 0.3951, backBottom: 0.2049 };
function fittedChair(THREE, KIT, id, fit, over = {}) {
  const file = id ? (KIT_CHAIR_VARIANT[id] || KIT.chairFileFor(id)) : 'chair';
  const inner = KIT.clone(file); inner.position.z = KIT_CHAIR.placeZ;
  const g = new THREE.Group(); g.name = 'Kit_fitted_chair_' + (id || 'empty'); g.userData.officeProp = true; g.userData.kitChair = file;
  g.add(inner);
  const rep = { file, sy: 1, backShift: 0, backScale: 1 };
  if (fit && fit.measurementComplete) {
    const sy = Math.max(.9, Math.min(1.05, fit.chairSeatY / KIT_CHAIR.seatTop)); inner.scale.y = sy; rep.sy = +sy.toFixed(4);
    /* 등받이 앞면(캐릭터 공간) — 프로필의 등받이 허용선(긴 머리 backrestZ · 등/치마 seatBackZ)보다 4mm 뒤 */
    const allow = (fit.backrestZ ?? fit.seatBackZ) - 0.004;
    const now = KIT_CHAIR.placeZ + KIT_CHAIR.backFront;
    let dz = Math.min(0, allow - now);
    let k = 1;
    if (fit.backrestHeight != null) {   /* 머리가 등받이 위로 내려오는 인물 — 등받이 윗단을 프로필 높이까지만 */
      const top = (fit.chairSeatY + 0.003 + fit.backrestHeight) / sy, b0 = KIT_CHAIR.backBottom;
      k = Math.max(.35, Math.min(1, (top - b0) / (KIT_CHAIR.backTop - b0)));
    }
    if (over.dz != null) dz = over.dz; if (over.k != null) k = over.k;
    if (dz < -1e-4 || k < .999) {
      /* 등받이 + 뒤 브래킷을 한 묶음(backAsm)으로 옮긴다 — 묶음 원점 = 등받이 아래 앞끝 */
      const asm = new THREE.Group(); asm.name = 'Kit_back_assembly';
      const parts = []; inner.traverse(o => { if (o.isMesh && /^(Chair.Padded.Back|Backrest.Rear.Bracket)/.test(o.name)) parts.push(o); });
      const root = parts[0]?.parent || inner; root.add(asm); asm.position.set(0, KIT_CHAIR.backBottom, KIT_CHAIR.backFront);   /* 등받이와 같은 부모(chair__ORIGIN) 아래 */
      inner.updateMatrixWorld(true); for (const o of parts) asm.attach(o);
      asm.scale.y = k; asm.position.z += dz;
      /* 뒤로 많이 민 등받이는 좌판 뒤끝과 떨어져 떠 보인다 → 좌판 아래 가로 연결대(킷 금속 재질) */
      if (dz < -0.02) {
        let metal = null; inner.traverse(o => { if (!metal && o.isMesh && /Chair.Stem|Chair.Hub/.test(o.name)) metal = o.material; });
        const L = -dz + 0.04, bar = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.012, L), metal); bar.name = 'Kit_back_connector';
        bar.position.set(0, 0.16, -0.116 - L / 2 + 0.03); bar.castShadow = bar.receiveShadow = true; root.add(bar);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.07, 0.014), metal); post.name = 'Kit_back_post';
        post.position.set(0, 0.195, KIT_CHAIR.backFront - 0.03 + dz); post.castShadow = post.receiveShadow = true; root.add(post);
      }
    }
    rep.backShift = +dz.toFixed(4); rep.backScale = +k.toFixed(3);
  }
  g.userData.kitFit = rep;
  return g;
}

/* ---------------------------------------------------------------------- *
 * 복도(킷 office_corridor.glb, 17.6 × 5.0) — 사용자 Blender 파일의 벽·바닥·문·문틀·명패·벤치·화분·정수기
 *  · Blender 좌표를 그대로 내보낸 파일이라 게임 카메라(+z 쪽)에서 보면 높은 벽이 카메라 쪽에 온다
 *    → 모델을 Y 축 π 회전(글자가 거울상이 되지 않게 뒤집기 대신 회전). 그래서 문 x 는 게임 기본 배치의 반대(−x)
 *  · 타일 윗면이 +0.009 라 0.009 내려 발이 바닥에 닿게 한다
 *  · 가구 충돌 상자(게임 좌표, π 회전 후) — 사용자 corridor_review.blend 의 벤치 3·화분 5·정수기 1
 * ---------------------------------------------------------------------- */
export const KIT_CORRIDOR = {
  rotY: Math.PI, y: -0.009,
  solids: [
    { x0: 6.11, x1: 7.09, z0: 2.035, z1: 2.365, y1: 0.36, note: '벤치' }, { x0: -0.49, x1: 0.49, z0: 2.035, z1: 2.365, y1: 0.36, note: '벤치' },
    { x0: -7.09, x1: -6.11, z0: 2.035, z1: 2.365, y1: 0.36, note: '벤치' }, { x0: 7.98, x1: 8.32, z0: -2.425, z1: -2.014, y1: 0.82, note: '정수기' },
    { x0: 4.805, x1: 5.099, z0: -2.403, z1: -1.995, y1: 0.62, note: '화분' }, { x0: -1.795, x1: -1.501, z0: -2.403, z1: -1.995, y1: 0.62, note: '화분' },
    { x0: -5.095, x1: -4.801, z0: -2.403, z1: -1.995, y1: 0.62, note: '화분' }, { x0: 3.155, x1: 3.449, z0: 1.997, z1: 2.405, y1: 0.62, note: '화분' },
    { x0: -3.445, x1: -3.151, z0: 1.997, z1: 2.405, y1: 0.62, note: '화분' },
  ],
};
/* 합쳐진 메시(재질별)를 삼각형 중심 x 부호로 둘로 나눈다(끝벽 두 개를 따로 숨기려고) — 원본 형상은 그대로, 새 형상 두 개를 만든다 */
export function splitByX(THREE, mesh) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const tri = idx ? idx.count / 3 : pos.count / 3; const A = [], B = [];
  const at = (i) => idx ? idx.getX(i) : i;
  for (let t = 0; t < tri; t++) { const a = at(t * 3), b = at(t * 3 + 1), c = at(t * 3 + 2); const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3; (cx < 0 ? A : B).push(a, b, c); }
  const mk = (list) => { if (!list.length) return null; const ng = new THREE.BufferGeometry(); for (const k of Object.keys(g.attributes)) ng.setAttribute(k, g.attributes[k]); ng.setIndex(list); ng.computeBoundingBox(); ng.computeBoundingSphere(); const m = new THREE.Mesh(ng, mesh.material); m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow; m.name = mesh.name + (list === A ? '_neg' : '_pos'); return m; };
  return { neg: mk(A), pos: mk(B) };
}
/* 킷 가구가 기존 코드 가구보다 깊어 옮긴 정거장(좌표만 — 이름·간선은 그대로). 킷 소파 깊이 0.67(기존 0.57) */
export const KIT_STATIONS = { sofa_front: { x: -4.36, z: -0.12 } };
