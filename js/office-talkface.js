/* ======================================================================
   말할 때 입·표정(2026-10-02) — 사용자 「말한때 입도 움직이고 표정변화도 있어야지 너무 그냥 입을 벌리고만있어」

   원인: 대화 중 얼굴이 'talk' 한 칸이었다 — native GLB 에서는 mouth_open 모양키를 1 로 고정(talk(true)·speakTick 교대)이라
         글이 다 나온 뒤에도 입을 벌린 채로 멈춰 있었고, 표정 키(happy·sad·surprised·angry)는 대화에 쓰이지 않았다.

   얼굴 = 메시 + 모양키(50명 GLB 공통, 에셋 손대지 않음)
     · 입: '06 Smile'·'Mouth opening' 의 mouth_open
     · 표정: happy·sad·angry·surprised — 눈(홍채·흰자·하이라이트·속눈썹·윗눈꺼풀)·눈썹(04 Brow)·입(06 Smile, surprised 는 Mouth opening 도)
     · 깜빡임: blink_L/R + 중간 키 blink_mid·blink_near(클립의 깜빡임 곡선을 그대로 읽어 쓴다 — 눈 디자인은 그대로)
   하는 일
     · 입: 대사 글자(음절) 박자마다 열었다 닫는다. 열림 정도 = 모음(ㅏ 크게 · ㅓㅗ 중간 · ㅜㅡㅣ 작게) × 무작위(0.8~1.15),
       받침 ㅁ·ㅂ·ㅍ 은 끝에 다문다. 띄어쓰기는 거의 닫고, 문장 부호는 닫고 쉰다. 글이 다 나오면 다문다.
     · 표정: 줄의 mood(대사 데이터 face 값 → 없으면 moodOf(text) 규칙)를 말하는 동안 + 끝나고 1.2초 들고 있다가 평상으로.
       눈 영역은 약하게(웃음 0.35 — 눈을 감고 웃지 않게), 눈썹·입 영역은 크게.
     · 깜빡임: 말하는 중·표정 중, 그리고 클립에 깜빡임이 없는 동작(idle_breath 등)에서는 직접 깜빡인다(2.2~5.5초 간격).
       깜빡이는 동안 눈 영역 표정은 그만큼 뺀다(happy+blink_mid 가 겹쳐 눈이 납작해지던 것 — 2026-09-29 기록).
   시간: 입 박자는 실제 시각(performance.now) 기준 — 대화창 글자 찍기(setTimeout)와 프레임 저하에도 어긋나지 않게.
   ====================================================================== */

export const FACE_EXPR = ['happy', 'sad', 'angry', 'surprised'];
const BLINK_L = ['blink_L', 'blink_mid_L', 'blink_near_L'];
const BLINK_R = ['blink_R', 'blink_mid_R', 'blink_near_R'];

/* 표정별 영역 무게 — eye: 눈 메시들 · brow: 눈썹 · mouth: 06 Smile·Mouth opening */
export const MOOD_W = {
  neutral: {},
  happy: { happy: { eye: 0.6, brow: 1.0, mouth: 1.0 } },     /* 1.0 이어도 눈은 아래만 살짝 접힌다(감지 않음) — 실측 tmp/talk_face/sheet_mix.jpg */
  surprised: { surprised: { eye: 0.85, brow: 1.0, mouth: 0.55 } },   /* 입 영역은 말하는 동안 0.4배(둥근 O 로 굳지 않게) */
  sad: { sad: { eye: 0.7, brow: 1.0, mouth: 0.9 } },        /* 곤란 — 입꼬리 내림·눈썹 八 */
  angry: { angry: { eye: 0.6, brow: 0.9, mouth: 0.7 } },
  wink: { happy: { eye: 0.3, brow: 0.8, mouth: 1.0 } },      /* + 왼눈 한 번 감기 */
};

/* 대사 분위기 규칙 — 데이터에 face/mood 가 없을 때. {mood, k(세기 0~1)} */
export function moodOf(text) {
  const t = String(text || '');
  if (!t) return { mood: 'neutral', k: 0 };
  if (/하하|호호|허허|헤헤|ㅎㅎ|\^\^|다행|고마워|고맙|감사(해|합|드려)|반가|축하|잘됐|잘 됐|최고|재밌|재미있|맛있|좋아요|좋네요|좋죠|좋겠|좋았|신나|기대돼|기대되/.test(t)) return { mood: 'happy', k: 1 };
  if (/헉|어머|세상에|깜짝|웬일|(^|[\s,.!…])(어|네|응|엥|뭐)\?|정말요?\?|진짜요?\?|그래요\?!|설마|벌써요\?|^와[,!.… ]|^우와|!\?|\?!/.test(t)) return { mood: 'surprised', k: 1 };   /* 「왔어?」처럼 말끝 -어? 는 놀람이 아니다 — 홀로 선 「어?」「네?」만 */
  if (/죄송|미안|곤란|어쩌죠|어쩌지|어떡|큰일|걱정|난감|글쎄|힘드|힘들|아쉽|피곤|정신없|ㅠ|ㅜㅜ|;;|큰일이/.test(t)) return { mood: 'sad', k: 1 };
  if (/[?？]\s*$/.test(t)) return { mood: 'surprised', k: 0.35 };   /* 묻는 말 — 눈썹을 살짝 올린다 */
  if (/(…|\.\.\.)\s*$/.test(t) || /^(음|흠|어)…/.test(t)) return { mood: 'sad', k: 0.45 };   /* 말끝을 흐린다 */
  if (/!\s*$/.test(t)) return { mood: 'happy', k: 0.6 };
  return { mood: 'neutral', k: 0 };
}

/* 한 글자의 입 열림 — 한글 음절은 모음으로, 그 밖 글자는 중간. 띄어쓰기·문장 부호는 쉼(0) */
const OPEN_V = [1.0, 0.8, 1.0, 0.8, 0.75, 0.7, 0.7, 0.65, 0.6, 0.9, 0.8, 0.6, 0.55, 0.45, 0.7, 0.65, 0.45, 0.45, 0.4, 0.45, 0.38];
//              ㅏ   ㅐ   ㅑ   ㅒ   ㅓ    ㅔ   ㅕ   ㅖ    ㅗ   ㅘ   ㅙ   ㅚ   ㅛ    ㅜ    ㅝ   ㅞ    ㅟ    ㅠ    ㅡ   ㅢ    ㅣ
const LIP_CLOSE = new Set([16, 17, 26]);   /* 받침 ㅁ·ㅂ·ㅍ */
export function glyphOpen(ch) {
  const c = ch ? ch.codePointAt(0) : 32;
  if (c >= 0xac00 && c <= 0xd7a3) { const s = c - 0xac00, v = Math.floor((s % 588) / 28), f = s % 28; return { a: OPEN_V[v], close: LIP_CLOSE.has(f), rest: 0 }; }
  if (/\s/.test(ch)) return { a: 0, close: false, rest: 1 };
  if (/[.,!?…~·:;'"()\[\]「」『』、。！？]/.test(ch)) return { a: 0, close: true, rest: 2 };
  if (/[ㄱ-ㅎㅏ-ㅣ]/.test(ch)) return { a: 0.5, close: false, rest: 0 };
  return { a: 0.6, close: false, rest: 0 };   /* 영문·숫자 */
}

/* 깜빡임 곡선(클립 idle 에서 읽는다) — 못 읽으면 실측값(60fps, 0.27초: mid→near→full→near→mid) */
const BLINK_FALLBACK = { dt: 1 / 60, full: [0, 0, 0, 0, 0, 0, 0, 0.552, 1, 0.552, 0, 0, 0, 0, 0, 0, 0], mid: [0, 0.023, 0.194, 0.5, 0.895, 0.613, 0.166, 0, 0, 0, 0.166, 0.613, 0.895, 0.5, 0.194, 0.023, 0], near: [0, 0, 0, 0, 0, 0.387, 0.834, 0.448, 0, 0.448, 0.834, 0.387, 0, 0, 0, 0, 0] };
function readBlink(meshes, clips) {
  const idle = clips && clips.find((c) => c.name === 'idle'); if (!idle) return BLINK_FALLBACK;
  for (const m of meshes) {
    const d = m.morphTargetDictionary; if (!d || d.blink_L == null || d.blink_mid_L == null || d.blink_near_L == null) continue;
    const tr = idle.tracks.find((t) => t.name === m.name + '.morphTargetInfluences'); if (!tr) continue;
    const N = m.morphTargetInfluences.length, T = tr.times; if (tr.values.length !== T.length * N) continue;
    const at = (i, k) => tr.values[i * N + d[k]];
    let a = -1, b = -1; for (let i = 0; i < T.length; i++) { if (at(i, 'blink_L') > 1e-4 || at(i, 'blink_mid_L') > 1e-4 || at(i, 'blink_near_L') > 1e-4) { if (a < 0) a = i; b = i; } }
    if (a < 0) continue; a = Math.max(0, a - 1); b = Math.min(T.length - 1, b + 1);
    const out = { dt: (T[b] - T[a]) / Math.max(1, b - a), full: [], mid: [], near: [] };
    for (let i = a; i <= b; i++) { out.full.push(at(i, 'blink_L')); out.mid.push(at(i, 'blink_mid_L')); out.near.push(at(i, 'blink_near_L')); }
    return out;
  }
  return BLINK_FALLBACK;
}
function clipBlinkSet(meshes, clips) {
  const S = new Set(); if (!clips) return S;
  const eye = meshes.filter((m) => m.morphTargetDictionary && m.morphTargetDictionary.blink_L != null);
  for (const c of clips) {
    let has = false;
    for (const m of eye) { const tr = c.tracks.find((t) => t.name === m.name + '.morphTargetInfluences'); if (!tr) continue; const N = m.morphTargetInfluences.length, k = m.morphTargetDictionary.blink_L; for (let i = 0; i < tr.times.length && !has; i++) if (tr.values[i * N + k] > 0.05) has = true; if (has) break; }
    if (has) S.add(c.name);
  }
  return S;
}

const PRI = { babble: 0, speak: 1, say: 2, type: 3 };
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* meshes: 모양키가 있는 메시들 · clips: gltf.animations · opt.seed(사람마다 다른 난수) */
export function createTalkFace(meshes, clips, opt = {}) {
  const M = [];
  for (const m of meshes) {
    const d = m.morphTargetDictionary, v = m.morphTargetInfluences; if (!d || !v) continue;
    const eye = d.blink_L != null || d.blink_R != null, mouth = d.mouth_open != null;
    const ex = FACE_EXPR.filter((k) => d[k] != null).map((k) => [k, d[k]]);
    if (!eye && !mouth && !ex.length) continue;
    const side = d.blink_L != null ? BLINK_L : d.blink_R != null ? BLINK_R : null;
    M.push({ v, region: eye ? 'eye' : mouth ? 'mouth' : 'brow', ex, mouth: mouth ? d.mouth_open : -1,
      bl: side ? side.map((k) => (d[k] != null ? d[k] : -1)) : null, left: d.blink_L != null });
  }
  if (!M.some((x) => x.mouth >= 0)) return null;   /* 입 모양키가 없는 GLB — 옛 동작 */
  const BL = readBlink(meshes, clips), BLINKS = clipBlinkSet(meshes, clips), BLDUR = BL.dt * (BL.full.length - 1);
  let seed = (opt.seed >>> 0) || 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  const S = {
    line: null,            /* {src,t0,ms,glyphs[],per,end,mood,k,glyphMode,lastGlyph} */
    mouth: 0, mouthGoal: 0,
    mood: 'neutral', moodK: 0, moodUntil: 0, greetUntil: 0, hold: false,
    w: { happy: 0, sad: 0, angry: 0, surprised: 0 },   /* 지금 표정 세기(부드럽게 따라감) */
    blinkT: -1, blinkNext: 1.5 + rnd() * 3, winkT: -1,
    beat: null,             /* 지금 입 한 번 여닫기 {t0, a, close} — 글자(찍기·어림)가 박자를 밀어 넣는다 */
    active: 0,              /* 표정·입을 직접 쓰는 중(초) — 0 이면 클립 값 그대로 */
  };

  /* 열림 a(0~1) → mouth_open 값. 실측: 0.3 아래는 닫힌 입선 그대로, 0.45 실틈, 0.6 열림, 0.85 크게 — 박자마다 확실히 열리게 0.5+0.5a(ㅡㅣ 도 실틈 이상) */
  const AMP = (v) => 0.5 + 0.5 * Math.min(1, v);
  function lineAmp(ch) { const g = glyphOpen(ch); return { a: g.a ? AMP(g.a * (0.8 + rnd() * 0.35)) : 0, close: g.close, rest: g.rest }; }

  /* 한 줄 시작 — o {text, ms, mood, k, src, greet} · 돌려주는 값 {dur(초), ignored} */
  function say(o) {
    o = o || {}; const t = now(); const src = o.src || 'speak';
    const L = S.line, live = L && t < L.end + 150;
    if (!(+o.ms > 0) && !o.greet) { stop(); return { dur: 0 }; }   /* 길이 0 = 다물기(누가 부르든) */
    if (o.greet && !(+o.ms > 0)) { S.greetUntil = t + 1100; if (!live) setMood('happy', 1, 1100); return { dur: 0 }; }   /* 인사 웃음만(입은 그대로) */
    if (o.greet) S.greetUntil = t + 1100;
    if (live && PRI[src] < PRI[L.src]) {   /* 더 정확한 쪽(대화창 글자 찍기)이 이미 이 줄을 돌리는 중 */
      return { dur: Math.max(0, (L.end - t) / 1000), ignored: true };
    }
    const text = String(o.text || ''); let ms = Math.max(0, +o.ms || 0);
    if (!text && live && L.text && PRI[src] <= PRI[L.src] + 1 && t - L.t0 < 600) {   /* 같은 줄을 글 없이 다시 부름(speak 가 say 뒤에) — 길이만 맞춘다 */
      if (ms) L.end = L.t0 + ms;
      return { dur: Math.max(0, (L.end - t) / 1000), ignored: true };
    }
    /* 표정: 줄에 mood 가 있으면 그것(데이터 face) · 없으면 글로 규칙(moodOf) · 글도 없으면 지금 표정 유지(null) */
    let mood = o.mood, k = o.k != null ? +o.k : 1;
    if (mood === 'talk' || mood === 'blink') mood = null;
    if (!mood) { if (text) { const r = moodOf(text); mood = r.mood; k = r.k; if (mood === 'neutral' && S.hold) mood = null; } else mood = null; }   /* 글에 단서가 없으면 setFace 로 잡아 둔 표정(잡담 웃음 등)은 그대로 */
    if ((mood === 'neutral' || mood === null) && t < S.greetUntil) { mood = 'happy'; k = 1; }
    if (mood && !MOOD_W[mood]) mood = 'neutral';
    if (!ms) { stop(); return { dur: 0 }; }
    const chars = text ? [...text] : null;
    const n = chars ? chars.length : Math.max(1, Math.round(ms / 110));
    const glyphs = []; for (let i = 0; i < n; i++) glyphs.push(chars ? lineAmp(chars[i]) : (i % 7 === 6 ? { a: 0, close: false, rest: 1 } : { a: AMP([0.9, 0.6, 0.75, 0.45, 1][i % 5] * (0.8 + rnd() * 0.35)), close: rnd() < 0.15, rest: 0 }));   /* 글 없이 길이만 — 7박에 한 번 쉰다 */
    S.line = { src, t0: t, ms, end: t + ms, glyphs, per: n ? ms / n : 0, text, glyphMode: false, lastGlyph: 0, gi: 0 };
    if (mood) setMood(mood, k, ms + 1200);
    S.active = Math.max(S.active, ms / 1000 + 1.5);
    if (rnd() < 0.3 && S.blinkT < 0) S.blinkNext = Math.min(S.blinkNext, 0.25 + rnd() * 0.4);   /* 말 꺼내며 깜빡 */
    return { dur: ms / 1000 };
  }
  /* 대화창이 글자를 하나 찍을 때(선택) — 이 줄은 그때부터 글자 박자로만 움직인다(어림 박자는 멈춘다) */
  function glyph(ch) {
    const t = now(); let L = S.line;
    if (!L || t > L.end + 400) { L = S.line = { src: 'type', t0: t, ms: 0, end: t + 300, glyphs: [], per: 0, text: '', glyphMode: true, lastGlyph: t, gi: 0 }; S.active = Math.max(S.active, 2); }
    L.glyphMode = true; L.lastGlyph = t; L.end = Math.max(L.end, t + 250);
    beatPush(lineAmp(ch), t);
  }
  /* 입 박자: 글자가 빨리 찍혀도(대화창 34ms/자) 한 번 여닫는 데 BEAT ms — 그 사이 글자는 한 박에 묶고(가장 큰 열림), 띄어쓰기·문장 부호는 지금 박을 끝까지 닫는다 */
  const BEAT = 115;
  function beatPush(g, t) {
    const B = S.beat;
    if (g.rest) { if (B) B.close = true; return; }
    if (B && t - B.t0 < BEAT) { B.a = Math.max(B.a, g.a); B.close = B.close || g.close; return; }
    S.beat = { t0: t, a: g.a, close: g.close };
  }
  /* 다물기 — 지금 박은 끝까지 닫히게 두고(뚝 끊지 않게) 새 박은 받지 않는다 */
  function stop() { const L = S.line; if (L) { L.end = Math.min(L.end, now()); S.line = null; } if (S.beat) S.beat.close = true; if (!S.hold) S.moodUntil = Math.min(S.moodUntil, now() + 1200); S.active = Math.max(S.active, 1.4); }
  function setMood(m, k = 1, holdMs = 0) {
    if (m === 'blink') { S.blinkNext = 0; return; }
    if (m === 'talk') { beatPush({ a: 0.75, close: false, rest: 0 }, now()); S.active = Math.max(S.active, 0.6); return; }   /* 옛 'talk' 칸 — 한 박자만 */
    if (!MOOD_W[m]) m = 'neutral';
    S.mood = m; S.moodK = Math.max(0, Math.min(1, k)); S.hold = !holdMs && m !== 'neutral';
    S.moodUntil = holdMs ? now() + holdMs : (m === 'neutral' ? 0 : Infinity);
    if (m === 'wink') S.winkT = 0;
    if (m !== 'neutral') S.active = Math.max(S.active, holdMs ? holdMs / 1000 + 1 : 3600); else S.active = Math.min(S.active, 1.5);   /* 평상으로 풀면 1.5초 뒤 클립 얼굴로 */
  }

  /* 매 프레임(믹서 뒤) — ctl: 대화 상대 등 바깥에서 표정을 맡긴 상태 · clip: 지금 클립 이름(깜빡임 유무) */
  function update(dt, ctl, clip) {
    const t = now();
    /* 입 */
    let goal = 0; const L = S.line;
    if (L) {
      if (!L.glyphMode) { const n = L.glyphs.length; while (L.gi < n && L.t0 + L.gi * L.per <= t && t < L.end) { beatPush(L.glyphs[L.gi], L.t0 + L.gi * L.per); L.gi++; } }   /* 어림 박자: 줄 길이(ms)를 글자 수로 나눠 글자를 차례로 밀어 넣는다 */
      if (t >= L.end && !L.glyphMode) S.line = null;
      else if (L.glyphMode && t > L.end + 400) S.line = null;
    }
    const B = S.beat;
    if (B) { const u = (t - B.t0) / BEAT; if (u >= 1) S.beat = null; else goal = B.a * env(u, B.close); }
    S.mouthGoal = goal;
    const tau = S.mouthGoal > S.mouth ? 0.015 : 0.028; S.mouth += (S.mouthGoal - S.mouth) * (1 - Math.exp(-dt / tau)); if (S.mouth < 1e-3) S.mouth = 0;
    /* 표정 */
    if (S.mood !== 'neutral' && t > S.moodUntil) { S.mood = 'neutral'; S.moodK = 0; }
    const want = MOOD_W[S.mood] || {}; let any = false;
    for (const k of FACE_EXPR) { const goalK = want[k] ? S.moodK : 0; S.w[k] += (goalK - S.w[k]) * (1 - Math.exp(-dt / 0.14)); if (S.w[k] < 2e-3 && !goalK) S.w[k] = 0; if (S.w[k] > 0) any = true; }
    S.active = Math.max(0, S.active - dt);
    const own = ctl || any || S.active > 0 || S.mouth > 0 || !!S.line;
    /* 깜빡임 — 직접 표정을 쓰는 동안, 또는 지금 클립에 깜빡임이 없으면 */
    const needBlink = own || (clip && !BLINKS.has(clip));
    let bf = 0, bm = 0, bn = 0, wl = 0;
    if (needBlink) {
      if (S.blinkT < 0) { S.blinkNext -= dt; if (S.blinkNext <= 0) { S.blinkT = 0; S.blinkNext = 2.2 + rnd() * 3.3; } }
      if (S.blinkT >= 0) { const f = S.blinkT / BL.dt, i = Math.floor(f), u = f - i, n = BL.full.length; if (i >= n - 1) S.blinkT = -1; else { const lerp = (A) => A[i] * (1 - u) + A[i + 1] * u; bf = lerp(BL.full); bm = lerp(BL.mid); bn = lerp(BL.near); } if (S.blinkT >= 0) S.blinkT += dt; }
      if (S.winkT >= 0) { S.winkT += dt; const w = S.winkT; wl = w < 0.08 ? w / 0.08 : w < 0.38 ? 1 : w < 0.48 ? 1 - (w - 0.38) / 0.1 : 0; if (w >= 0.48) S.winkT = -1; }
    }
    const bAmt = Math.max(bf, bm * 0.9, bn);   /* 깜빡이는 정도(눈 영역 표정을 그만큼 뺀다) */
    /* 쓰기 */
    for (const x of M) {
      const v = x.v;
      if (x.mouth >= 0) v[x.mouth] = S.mouth;
      if (!own) { if (x.bl && needBlink && x.region === 'eye') writeBlink(x, bf, bm, bn, wl); continue; }
      const eyeK = x.region === 'eye' ? (1 - Math.max(bAmt, x.left ? wl : 0)) : 1;
      for (const [k, i] of x.ex) { let W = (want[k] || MOOD_W[k][k])[x.region] || 0; if (k === 'surprised' && x.region === 'mouth' && S.line) W *= 0.4; v[i] = S.w[k] * W * eyeK; }   /* 빠져나가는 표정은 제 영역 무게로 줄어든다 */
      if (x.bl) writeBlink(x, bf, bm, bn, wl);
    }
  }
  function writeBlink(x, bf, bm, bn, wl) { const v = x.v, [i0, i1, i2] = x.bl; const f = x.left ? Math.max(bf, wl) : bf, m = x.left && wl > bf ? 0 : bm, n = x.left && wl > bf ? 0 : bn; if (i0 >= 0) v[i0] = f; if (i1 >= 0) v[i1] = m; if (i2 >= 0) v[i2] = n; }
  /* 한 박자 안의 열림 — 빨리 열고(30%) 닫는다(60%). 받침 ㅁ·ㅂ·ㅍ·문장 부호 앞은 끝까지 닫는다 */
  function env(u, close) { u = Math.max(0, Math.min(1, u)); if (u < 0.3) { const s = u / 0.3; return s * s * (3 - 2 * s); } const s = Math.min(1, (u - 0.3) / 0.6); return 1 - (close ? 1 : 0.94) * s * s * (3 - 2 * s); }   /* 박 끝 10% 는 닫힌 채 — 다음 박과 사이에 입선이 보이게 */

  return {
    say, glyph, stop, setMood,
    update,
    get speaking() { return !!S.line && now() < S.line.end + 50; },
    get mood() { return S.mood; },
    get mouth() { return S.mouth; },
    get state() { return { mouth: +S.mouth.toFixed(3), mood: S.mood, k: S.moodK, w: Object.fromEntries(FACE_EXPR.map((k) => [k, +S.w[k].toFixed(3)])), speaking: !!S.line, src: S.line && S.line.src, blink: S.blinkT >= 0, active: +S.active.toFixed(2) }; },
    clipBlinks: BLINKS, blinkDur: BLDUR,
  };
}
