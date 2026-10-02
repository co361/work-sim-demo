/* ======================================================================
   앉아서 일하기(2026-10-01) — 사용자 「캐릭터들이 앉았는데 일하고 있는것 같지않아 그냥 팔이 위아래로 조금씩 움직이면서 일하는 타이핑하는 것처럼」
   GLB 안 work_* 클립 7개(타자 A·B·C · 마우스 · 화면 읽기 · 기지개 · 목 돌리기)를 사람마다 다른 순서·시점으로 무작위로 잇는다.
   원본: character-packs/staff50-approved17/stage_seated_work_20261001/web/work_scheduler.js(클립 담당 참고 구현)
         + validation/rework_20260929/work_seated_20261001_all/work_clips_meta.json(무게·종류·대화 멈춤 가능 여부)
   · 모든 work_* 클립의 첫·끝 프레임 = type2 0프레임(앉기 sit_down 다음 자세 = 「집 자세」) → 어느 순서로 이어도 위치가 튀지 않는다
   · 무작위 규칙(메타 schedule.rule 그대로): 무게대로 · 바로 앞 클립 반복 금지 · 기지개·목 돌리기(kind variation)는 40초에 한 번까지 ·
     마우스 다음은 타자 · 첫 클립은 타자 중 하나를 0~0.6×길이 지점부터(사람마다 어긋나게)
   · 대화: pause_ok 클립(타자·읽기·목)은 그 자리에서 멈춘다(손은 키보드 위) · 아니면(마우스·기지개) 0.25초에 집 자세(type2 0프레임)로 섞고 멈춘다.
     대화가 끝나면 멈춘 클립을 이어 틀거나 다음 클립으로
   게임에 옮기며 바꾼 것
   · 메타를 이 파일에 둔다(배포본에는 character-packs 폴더가 없다). 클립 길이는 GLB 클립에서 읽는다
   · 클립 사이 전환: 앞 클립이 끝나기 FADE_BETWEEN 초 전에 다음 클립을 섞어 들인다(두 클립 모두 집 자세 근처라 위치가 튀지 않고 속도도 이어진다)
   · 다음 클립은 믹서 갱신 밖(update — mixer.update 앞)에서 건다 — 'finished' 처리 중에 동작을 끄고 켜면 믹서의 활성 동작 배열이 그 자리에서 바뀐다
   · onSwitch(action) 로 캐릭터 어댑터의 「지금 동작」을 맞춘다 — 일어서기·대화 클립이 실제로 보이는 동작에서 섞이게
   · work_* 타자 클립이 하나도 없으면 null → 어댑터는 기존 앉은 자세(type2)를 그대로 쓴다(콘솔 출력 없음)
   ====================================================================== */
export const WORK_META = {
  params: 'seated_work_v2_20261001',
  clips: {
    work_type_a: { kind: 'typing', weight: 0.26, pause_ok: true },    /* 두 손 번갈아 타자 — 가운데 한 번 멈칫 */
    work_type_b: { kind: 'typing', weight: 0.18, pause_ok: true },    /* 두 손 → 오른손만 천천히 → 두 손 */
    work_type_c: { kind: 'typing', weight: 0.18, pause_ok: true },    /* 고르게 타자 → 끝에 엔터 톡 + 작은 끄덕 */
    work_mouse: { kind: 'mouse', weight: 0.18, pause_ok: false },     /* 오른손을 마우스로 → 클릭·휠 → 키보드로 */
    work_read: { kind: 'read', weight: 0.12, pause_ok: true },        /* 손 쉬고 화면 읽기 — 고개 좌우 */
    work_stretch: { kind: 'variation', weight: 0.04, pause_ok: false }, /* 기지개 */
    work_neck: { kind: 'variation', weight: 0.04, pause_ok: true },   /* 목 돌리기 — 손은 키보드 위 */
  },
  schedule: { variation_cooldown_s: 40, fade_between_s: 0.2, fade_from_sit_down_s: 0.18, talk_home_fade_s: 0.25, resume_fade_s: 0.12, start_spread: 0.6 },
};

/* 이 GLB 에 일하기 클립이 있는가(타자 클립이 하나라도) — 동작(action)은 만들지 않는다 */
export function hasWorkClips(clips, meta = WORK_META) {
  return !!clips && clips.some((c) => meta.clips[c.name] && meta.clips[c.name].kind === 'typing');
}

/* mixer: 캐릭터 AnimationMixer · clips: gltf.animations · home: type2 동작(대화 때 집 자세로 섞을 곳) */
export function createWork(THREE, mixer, clips, opts = {}) {
  const meta = opts.meta || WORK_META, C = meta.clips, SC = meta.schedule || {};
  if (!hasWorkClips(clips, meta)) return null;
  const rnd = opts.random || Math.random, home = opts.home || null, onSwitch = opts.onSwitch || null;
  const A = {}; for (const c of clips) if (C[c.name] && !A[c.name]) A[c.name] = mixer.clipAction(c);
  const names = Object.keys(A), typing = names.filter((n) => C[n].kind === 'typing');
  const dur = (n) => A[n].getClip().duration;
  const cooldown = SC.variation_cooldown_s ?? 40, fadeBetween = SC.fade_between_s ?? 0.2, homeFade = SC.talk_home_fade_s ?? 0.25,
    resumeFade = SC.resume_fade_s ?? 0.12, spread = SC.start_spread ?? 0.6;
  let cur = null, curName = null, last = null, lastVar = -1e9, clock = 0, talk = null, on = false, homeFrozen = false;
  const pick = () => {
    let pool = names.filter((n) => n !== last); if (!pool.length) pool = names.slice();
    let p = pool; if (clock - lastVar < cooldown) p = p.filter((n) => C[n].kind !== 'variation'); if (p.length) pool = p;
    if (last && C[last] && C[last].kind === 'mouse') { p = pool.filter((n) => C[n].kind === 'typing'); if (p.length) pool = p; }
    const tot = pool.reduce((s, n) => s + C[n].weight, 0); let r = rnd() * tot;
    for (const n of pool) { r -= C[n].weight; if (r <= 0) return n; } return pool[pool.length - 1];
  };
  const play = (n, fade, t0 = 0) => {
    const a = A[n], prev = cur;
    if (a === prev) { a.reset(); a.setEffectiveWeight(1); a.timeScale = 1; a.time = t0; a.play(); }   /* 클립이 하나뿐인 GLB — 처음부터 다시(끝나 멈춘 상태도 푼다) */
    else {
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.timeScale = 1; a.time = t0;
      if (prev) { if (fade > 0) a.crossFadeFrom(prev, fade, false); else prev.stop(); }
      a.play();
    }
    cur = a; curName = n; last = n; if (C[n].kind === 'variation') lastVar = clock;
    if (onSwitch) onSwitch(a, n);
  };
  const unfreezeHome = () => { if (homeFrozen && home) home.timeScale = 1; homeFrozen = false; };
  return {
    actions: A, names,
    get on() { return on; }, get talking() { return !!talk; }, get current() { return curName; }, get action() { return cur; },
    /* 앉는 동작(sit_down)이 끝난 뒤 · 자리에 바로 앉힐 때 · 대화로 바뀐 자세가 풀린 뒤 — from = 지금 보이는 동작(섞기 시작점) */
    start(from, fade = SC.fade_from_sit_down_s ?? 0.18) {
      unfreezeHome(); on = true; talk = null; cur = from || null; curName = null;
      const pool = typing.length ? typing : names; const n = pool[Math.floor(rnd() * pool.length)] || names[0];
      play(n, cur ? fade : 0, rnd() * spread * dur(n));   /* 시작 시각을 흩뜨린다(같은 방 사람들이 같이 움직이지 않게) */
    },
    /* 다른 동작(일어서기·걷기·말하기 등)으로 넘어갈 때 — 동작은 어댑터가 섞어 내보낸다 */
    stop() { unfreezeHome(); on = false; talk = null; },
    /* 매 프레임 mixer.update 앞에 — 끝나 가는 클립이면 다음 클립을 섞어 들인다 */
    update(dt) {
      clock += dt; if (!on || talk || !cur || !curName || cur !== A[curName]) return;
      const remain = (dur(curName) - cur.time) / Math.max(1e-3, cur.timeScale || 1);
      if (remain > Math.max(fadeBetween, dt)) return;
      play(pick(), fadeBetween > 0 ? Math.max(0, Math.min(fadeBetween, remain)) : 0);
    },
    pauseForTalk() {
      if (!on || talk || !cur) return;
      if (curName && C[curName] && C[curName].pause_ok) { cur.timeScale = 0; talk = { mode: 'freeze', a: cur }; return; }
      if (!home) { cur.timeScale = 0; talk = { mode: 'freeze', a: cur }; return; }
      home.reset(); home.enabled = true; home.setEffectiveWeight(1); home.setLoop(THREE.LoopRepeat, Infinity); home.time = 0; home.timeScale = 0; homeFrozen = true;
      home.crossFadeFrom(cur, homeFade, false); home.play(); cur = home; curName = null; talk = { mode: 'home' };
      if (onSwitch) onSwitch(home, 'type2');
    },
    resumeAfterTalk() {
      if (!talk) return; const m = talk; talk = null; if (!on) return;
      if (m.mode === 'freeze') { m.a.timeScale = 1; return; }
      unfreezeHome(); play(pick(), resumeFade);
    },
    dispose() { on = false; talk = null; unfreezeHome(); },
  };
}
