/* ======================================================================
   대화 모드 — 「말을 걸면 이야기가 오간다」

   왜 만들었나
     대표 "말을 걸었으면 말을 할 수 있게 해줘, 이야기를." — 지금까지는 NPC 가
     한마디 던지고 대화가 닫혔다. 내가 말할 방법이 없었다.
     대표 "화면 커지면서 채팅할 수 있게 해줘." — 작은 말풍선으로 끝내지 않는다.
     45차 대표 "T를 누르면 상대 캐릭터 얼굴이 보이는 게 아니라 그냥 대화창만 보여.
     그리고 말풍선 없애고 직접 가서 대화로 모든 것들을 듣게 해."

   무엇을 하는가
     ① `Talk.npc(name)` — T 로 말을 건 대화 한 판. 먼저 **그 사람이 할 말**(쌓여 있던 것)을 듣고,
        오늘 그 사람에게 할 일(전달·질문·보고·검산 결과) → 잡담 → 「이만 가 볼게요」.
        할 일을 고르면 **걸어가는 연출 없이 그 자리에서 대화로** 이어진다(이미 마주 서 있으므로).
     ② `Talk.choose(prompt, items, timeLimit, opts)` — 선택지 하나 고르기(전화·목적지 고르기).
     ③ `Talk.hear(who, text)` — NPC 가 **먼저** 할 말이 생겼을 때. 말풍선·알림으로 흘리지 않고
        그 사람 앞으로 쌓아 둔다 → 머리 위 표시(setTalkHint) → 가서 T 를 누르면 대화창에서 듣는다.
        이 방에 자리가 없는 사람(고객·다른 층)은 예전대로 사내 메신저(전자)로 간다.
     ④ `Talk.reply(who, text)` — 방금 한 일(전달·질문·보고)에 대한 상대의 반응. 대화창에 곧바로 잇는다.
     ⑤ 3D 연출(`__office.interact`) 속 대사 — 3D 가 `onSay(fn)` 으로 넘겨 주면 대화창에 띄운다.
        3D 선택 패널(iframe #choice)은 대화창에 가려지므로, 3D 가 `onChoose` 를 주기 전까지는
        그 패널을 읽어 대화창에 옮기고 고른 번호를 `__office.choose(i)` 로 돌려준다.

   화면 — 동물의 숲처럼 **아래 35% 안**. 위 65% 는 3D(얼굴 카메라)가 보이게 딤을 깔지 않는다.
     카메라: 열 때 `talkView(seat,true)`, 닫을 때 `endTalk()`(없으면 `talkView(seat,false)`).

   경계선
     오늘 그 사람에게 할 일이 있으면 그것이 첫 선택지다(전달 · 여쭤보기 · 보고).
     그 밖은 잡담이고 잡담은 채점하지 않는다. 인사를 거듭하면 신뢰가 아주 조금 오르되
     하루 한 사람당 +1 이 상한이다.

   창에 뜨는 것은 **줄 서서 하나씩** 나온다(chain). 대사는 클릭·Enter·Space 로 넘기고,
   선택지는 클릭·숫자키, Esc 는 대화를 닫는다(js/play/pc.js 가 Esc 를 넘겨준다).
   ====================================================================== */
(function (global) {
  'use strict';

  const BOT = !!navigator.webdriver;      /* 자동화(스모크·촬영)는 누를 사람이 없다 — 대사를 기다리지 않는다 */
  /* 2026-09-30 스몰토크 「이어서 대화하기」 — 주소에 ?smalltalk=1 이 있을 때만. 없으면 단추도 요청도 없다(기본 화면 그대로).
     데이터·고르기·기억은 js/play/smalltalk.js(이때만 싣는다), 한 주제 흐름은 아래 smallTalk(). 채점·신뢰는 건드리지 않는다 */
  const SMALLTALK = (() => { try { return new URLSearchParams(location.search).get('smalltalk') === '1'; } catch (e) { return false; } })();
  if (SMALLTALK) { try { const sc = document.createElement('script'); sc.src = 'js/play/smalltalk.js?v=20260930a'; document.head.appendChild(sc); } catch (e) {} }

  let sess = null;              /* 지금 대화 한 판 {id,name,seat,cam,hold,human,closed} */
  let showing = null;           /* 창에 떠 있는 것 {end,item,timer} */
  let chain = Promise.resolve(); let jobs = 0; let seq = 0; let flushTo = 0; let sessSeq = 0;
  let boxOpen = false; let camSeat = null;
  let lastLine = null;          /* 방금 들은 상대의 말 — 분기 반응이 같은 말을 한 번 더 할 때 거른다 */
  const pending = {};           /* NPC 가 먼저 할 말 — {이름:[문장…]} */
  const noticed = {};           /* 「할 말이 있대요」 알림을 이미 한 사람 — 듣고 나면 지운다 */
  const greeted = {};           /* 오늘 인사한 횟수 — 신뢰 상한을 이것으로 잡는다 */
  const trusted = {};           /* 신뢰를 이미 올린 사람 */

  const T = {
    box: () => $('talk'),
    face: () => $('tkFace'),
    name: () => $('tkName'),
    role: () => $('tkRole'),
    text: () => $('tkTx'),
    live: () => $('tkLive'),
    opts: () => $('tkOpts')
  };

  /* ---------- 3D ---------- */
  function O3() { return (typeof office === 'function') ? office() : null; }
  function camIn(seat) {
    const O = O3(); if (!O || !seat) return;
    try { if (typeof O.talkView === 'function' && O.talkView(seat, true) !== false) camSeat = seat; } catch (e) {}
  }
  function camOut() {
    const O = O3(); const s = camSeat; camSeat = null;
    if (!O || !s) return;
    try {
      if (typeof O.endTalk === 'function') O.endTalk();
      else if (typeof O.talkView === 'function') O.talkView(s, false);
    } catch (e) {}
  }

  /* ---------- 이름 ---------- */
  /* 데이터마다 「총무팀 최주임」·「최주임」처럼 부르는 이름이 달라 자리 찾기가 빗나간다 — 등장인물 키로 맞춘다 */
  function normName(who) {
    who = String(who || '').replace(/\s*\(.*?\)\s*/g, '').trim(); if (!who || !D || !D.npcs) return who;
    if (D.npcs[who]) return who;
    for (const k of Object.keys(D.npcs)) { if (k.length >= 2 && (who.endsWith(k) || k.endsWith(who) && who.length >= 2)) return k; }
    return who;
  }
  function roleOf(name) { const info = npcInfo(name) || {}; return [info.team, info.role].filter(Boolean).join(' · '); }
  const meName = () => (S && S.name) || '나';
  /* 이름 자리(「○○씨」 등) — day.js fillName 이 하루 데이터에 이미 적용하지만, 여기서 만드는 잡담·마무리 문장도 같은 규칙으로 */
  const fill = (t) => { t = String(t || ''); return (typeof global.fillName === 'function') ? global.fillName(t) : t; };

  /* ---------- 얼굴 ----------
     사진 경로는 core.js avatarPic(av_cNN.png · 17~AVATAR_HAVE_MAX). 파일이 지워졌으면 onerror 로 이모지에 물러선다. */
  /* 오늘 데이터에 없는 사람(예: 다른 팀 방에 있는 「총무팀 최주임」)도 3D 배역표(CAST)에서 얼굴을 찾는다 — 카메라가 얼굴을 못 잡는 줄에서 사진으로 누구인지 보이게 */
  function chOf(name) {
    const info = npcInfo(name); if (info && info.ch) return info.ch;
    const O = O3(); const cast = O && O.CAST; if (!cast) return '';
    const raw = String(name || '').replace(/\s*\(.*?\)\s*/g, '').trim();
    let team = null, nm = raw;
    for (const [k, v] of Object.entries(TEAM_NAMES || {})) { if (raw.startsWith(v)) { team = k; nm = raw.slice(v.length).trim(); break; } }
    const hit = (list) => (list || []).find((x) => x && x[1] && (x[1] === nm || x[1].replace(/\s*팀장$/, '') === nm));
    if (team && hit(cast[team])) return hit(cast[team])[0];
    const all = Object.values(cast).map((l) => hit(l)).filter(Boolean);
    return all.length === 1 ? all[0][0] : '';
  }
  function faceOf(name) {
    const box = T.face(); box.innerHTML = '';
    const info = npcInfo(name);
    const ch = chOf(name);
    const src = ch ? avatarPic(ch) : '';
    if (src) { const im = document.createElement('img'); im.alt = ''; im.onerror = () => { if (im.parentNode === box) box.textContent = emojiFor(name, info); }; im.src = src; box.appendChild(im); return; }
    box.textContent = emojiFor(name, info);
  }
  /* 내 줄에는 내가 고른 캐릭터 사진 */
  function faceOfMe() {
    const box = T.face(); box.innerHTML = '';
    let src = ''; try { src = (typeof playerChar === 'function') ? avatarPic(playerChar(P && P.avatar)) : ''; } catch (e) {}
    if (src) { const im = document.createElement('img'); im.alt = ''; im.onerror = () => { if (im.parentNode === box) box.textContent = '🙂'; }; im.src = src; box.appendChild(im); return; }
    box.textContent = '🙂';
  }
  function emojiFor(name, info) {
    const r = (info && info.role) || '';
    if (/팀장|부장|대표/.test(name + r)) return '🧑‍💼';
    if (/고객|님$/.test(name)) return '🙋';
    if (/사수|선임|대리|주임|과장/.test(name + r)) return '🧑‍💻';
    return '💬';
  }

  /* ---------- 창 열고 닫기 ----------
     2026-10-02 말풍선: 열 때 살짝 튀어나오고(CSS tkPop) 닫을 때 0.16초 줄어들며 사라진다(tkOut).
     닫히는 사이에 새 줄이 오면 닫기를 거두고 그대로 쓴다. */
  let closeT = 0; let lastWho = null;
  const reduced = () => { try { return global.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  function openBox() {
    if (boxOpen) return; boxOpen = true;
    const box = T.box();
    if (closeT) { clearTimeout(closeT); closeT = 0; }
    box.classList.remove('closing');
    box.classList.add('open');
    document.body.classList.add('talk-on');
    if (global.__pcTalk) { try { global.__pcTalk(true); } catch (e) {} }
  }
  function closeBox() {
    if (!boxOpen) return; boxOpen = false;
    typeFinish(true);
    const box = T.box(); box.classList.remove('next'); box.classList.add('closing');
    T.opts().querySelectorAll('button,input').forEach((b) => { b.disabled = true; });
    if (closeT) clearTimeout(closeT);
    const hide = () => {
      closeT = 0; if (boxOpen) return;
      box.classList.remove('open', 'closing', 'cam', 'me', 'choosing', 'anon');
      T.opts().innerHTML = ''; T.opts().classList.remove('show', 'wait');   /* 닫힌 창에 지난 선택지 단추를 남기지 않는다 */
      lastWho = null;
    };
    if (reduced()) hide(); else closeT = setTimeout(hide, 170);
    document.body.classList.remove('talk-on');
    if (global.__pcTalk) { try { global.__pcTalk(false); } catch (e) {} }
    /* 3D 창으로 키보드를 돌려준다 — 안 돌리면 닫은 뒤 WASD 가 먹지 않는다 */
    try { const a = document.activeElement; if (!a || a === document.body || box.contains(a)) { if (a && a.blur) a.blur(); const f = $('stage'); if (f && f.contentWindow && !NO_STAGE) f.contentWindow.focus(); } } catch (e) {}
  }
  function maybeClose() { setTimeout(() => { if (!jobs && !showing && !(sess && sess.hold)) closeBox(); }, 0); }

  /* ---------- 말하는 사람 얼굴로(45차 후속) ----------
     대표 지적: 브리핑에서 최주임·사수 대사가 **팀장 얼굴 위**에 나왔다(이름표만 맞고 얼굴은 팀장).
     얼굴 카메라가 켜진 대화 판에서는 줄마다 말하는 사람을 잡는다 — 3D 에서 그 사람을 잡을 수 있으면 talkView(그 사람 자리),
     못 잡으면(다른 방·자리 없는 동기) 얼굴 카메라를 잠깐 풀어 **어떤 얼굴도 이름표와 어긋나지 않게** 하고 대화창 사진으로 누구인지 보인다.
     화자가 바뀔 때마다 끊어서 붙인다(rig snap). */
  /* 48차: 이 방에 자리가 없어도 **방문객으로 와 있으면** 그 사람이다
     (1일차 사원증을 주러 온 총무팀 최주임 · 50차 「대면」 카드로 찾아온 조력자).
     office 의 방문객 좌석 id 는 'visitor' 하나뿐이라 **이름이 같을 때만** 넘긴다. */
  function visitorSeatOf(name) {
    try { const O = O3(); const v = O && typeof O.visitorState === 'function' && O.visitorState();
      if (v && v.state === 'seated' && v.name && normName(v.name) === normName(name)) return 'visitor'; } catch (e) {}
    return null;
  }
  /* 「이 사람에게 말이 닿는가」 — 자리(이 방) 또는 방문객 */
  function seatOf(name) { return seatByName(name) || visitorSeatOf(name); }
  function speakerSeat(who) {
    const n = normName(who); if (sess && n === sess.name && sess.seat) return sess.seat;
    const info = npcInfo(n); if (info && info.seat) return info.seat;
    return visitorSeatOf(n);
  }
  /* 카메라를 다른 사람으로 옮겨야 하는 줄인데 내가 아직 말 거는 자리로 걸어가는 중이면(talkApproach) 멈출 때까지 잠깐 기다린다(최대 3초) —
     걷는 도중에 구도를 고르면 도착한 내 몸이 카메라 앞을 막았다(flow_04: 내 뒷머리가 화면 4할) */
  function waitStill(item, fn) {
    const s = (item.sess && item.sess.cam) ? item.sess : (sess && sess.cam ? sess : null); const O = O3();
    if (!s || !O || item.me || !item.who || speakerSeat(item.who) === camSeat) { fn(); return; }
    const t0 = Date.now(); const tick = () => { let w = false; try { w = !!O.walking; } catch (e) {} if (w && Date.now() - t0 < 3000) { setTimeout(tick, 100); return; } fn(); }; tick();
  }
  function aimAt(item) {
    /* 판 밖에서 끼어든 줄(다른 사람의 반응 등)도 얼굴 카메라가 켜진 판이 있으면 같은 규칙 — 카메라가 다른 사람 얼굴에 머물지 않게 */
    const s = (item.sess && item.sess.cam) ? item.sess : (sess && sess.cam ? sess : null); if (!s || s.closed || item.me || !item.who) return;
    const O = O3(); if (!O) return;
    const seat = speakerSeat(item.who);
    if (seat && seat === camSeat) return;
    if (seat) {
      let ok = false; try { ok = typeof O.talkView === 'function' && O.talkView(seat, true) !== false; } catch (e) {}
      /* 화자가 바뀌면 **끊어서** 붙인다 — 미끄러져 옮기면 가운데 선 내 머리를 스치며 지나가 한동안 화면을 덮었다(라이브 스냅 flow_04) */
      if (ok) { camSeat = seat; try { if (typeof O.rig === 'function') O.rig({}); } catch (e) {} return; }
    }
    if (camSeat) { try { if (typeof O.endTalk === 'function') O.endTalk(); if (typeof O.setControl === 'function') O.setControl(false); } catch (e) {} camSeat = null; }
  }

  /* 말하는 사람의 입(45차 후속 — 대표 「말하는 사람이 계속 눈을 감고 웃는다」): 줄이 뜨면 3D 에 그 사람 자리로 speak(글자 수만큼, 0.9~5.2초).
     3D 는 눈 뜬 얼굴에 입만 움직이고, 웃음(눈 감음)은 인사할 때 잠깐만 쓴다. 웃음소리가 적힌 줄(하하·ㅎㅎ·^^)이나 item.mood 가 있으면 첫머리에 그 표정.
     내 줄이 뜨면 앞사람 입을 닫는다 */
  let speakSeat = null;
  function speakLine(item) {
    const O = O3(); if (!O || typeof O.speak !== 'function' || item.keep) return;
    if (item.me || !item.who || !item.text) { if (item.me && speakSeat) { try { O.speak(speakSeat, 0); } catch (e) {} speakSeat = null; } return; }
    const seat = speakerSeat(item.who); if (!seat) return;
    const t = fill(item.text); const ms = Math.max(900, Math.min(5200, 300 + 85 * t.length));
    const mood = item.mood || (/하하|호호|허허|ㅎㅎ|\^\^/.test(t) ? 'happy' : null);
    let ok = false; try { ok = O.speak(seat, ms, mood ? { mood } : {}) !== false; } catch (e) {}
    speakSeat = ok ? seat : null;
  }

  /* ---------- 한 글자씩(타자 효과 · 2026-10-02 말풍선) ----------
     대사는 한 글자씩 찍힌다. 클릭·Enter·Space 를 누르면 그 자리에서 다 나오고, 한 번 더 누르면 넘어간다(예전과 같은 키).
     다 찍힌 뒤에 선택지가 뜨고 대사뿐이면 ▼ 가 뜬다. 시간 제한이 걸린 선택지는 기다리지 않고 곧바로 띄운다(시계가 이미 돈다).
     · 아직 안 찍힌 뒤쪽 글자는 투명하게 자리만 잡아 둔다 — 찍히는 도중에 어절이 줄을 바꿔 튀지 않고, 화면 읽기 프로그램은 문장 전체를 읽는다.
     · 읽어 주기(aria-live)는 글자마다가 아니라 줄마다 한 번 — 숨은 #tkLive 에 「이름: 문장」.
     · 움직임 줄이기(prefers-reduced-motion)·주소 ?type=0 이면 곧바로 다 보인다.
     · 입 움직임(office.html talkMouth — 입·표정 담당의 API): 찍기 시작·한 글자·끝을 typeHooks 로 알린다. 옛 캐시면 함수가 없으니 있는지 보고 부른다. */
  const TYPE_OFF = (() => { try { return new URLSearchParams(location.search).get('type') === '0'; } catch (e) { return false; } })();
  const typer = { item: null, timer: 0, on: null, rest: null, text: '', offs: null, n: 0, i: 0, info: null };
  let cur = null;                /* 지금 창에 그려진 것 */
  const typeHooks = {
    start(item, info) { const O = O3(); if (!info.seat || !O || !O.talkMouth || typeof O.talkMouth.start !== 'function') return; try { O.talkMouth.start(info.seat, { text: info.text, ms: info.ms, mood: info.mood || null }); } catch (e) {} },
    glyph(item, info, ch) { const O = O3(); if (!info.seat || !O || !O.talkMouth || typeof O.talkMouth.glyph !== 'function') return; try { O.talkMouth.glyph(info.seat, ch); } catch (e) {} },
    end(item, info) { const O = O3(); if (!info.seat || !O || !O.talkMouth || typeof O.talkMouth.stop !== 'function') return; try { O.talkMouth.stop(info.seat); } catch (e) {} }
  };
  function hook(k, item, info, ch) { try { typeHooks[k](item, info, ch); } catch (e) {} }
  function glyphs(t) {
    try { if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(t), (s) => s.segment); } catch (e) {}
    return Array.from(t);
  }
  /* 문장 끝·쉼표·줄바꿈에서 잠깐 쉰다 — 말하는 박자 */
  function pauseAfter(ch, next) {
    if (ch === '\n') return 110;
    if (/[.!?…~]$/.test(ch) && (!next || /^[\s"'」』)]/.test(next))) return 130;
    if (/[,，]$/.test(ch)) return 60;
    return 0;
  }
  function typeStart(item, text) {
    typeFinish(true);
    const tx = T.text(); tx.textContent = '';
    const on = document.createElement('span'); on.className = 'tkOn';
    const rest = document.createElement('span'); rest.className = 'tkRest'; rest.textContent = text;
    tx.appendChild(on); tx.appendChild(rest);
    const parts = glyphs(text); const n = parts.length;
    const offs = [0]; for (const p of parts) offs.push(offs[offs.length - 1] + p.length);
    /* 한 글자 30ms(내 줄 20ms). 긴 줄은 글자 몫이 다 합쳐 2.2초 안팎이 되게 빨라지고, 저절로 넘어가는 줄(ms)은 머무는 시간의 절반 안에 다 찍는다 */
    let per = Math.max(12, Math.min(item.me ? 20 : 30, 2200 / Math.max(1, n)));
    if (item.ms) per = Math.max(6, Math.min(per, item.ms * 0.45 / Math.max(1, n)));
    const k = per < 16 ? 2 : 1;                           /* 아주 빠르면 두 글자씩 */
    let total = 0; for (let i = 0; i < n; i++) total += per + pauseAfter(parts[i], parts[i + 1]);
    const instant = TYPE_OFF || reduced() || !n;
    const seat = item.me ? 'me' : (speakerSeat(item.who) || null);
    const info = { seat, name: item.who || '', text, chars: n, ms: instant ? 0 : Math.round(total), mood: item.mood || null };
    Object.assign(typer, { item, on, rest, text, offs, n, i: 0, info });
    hook('start', item, info);
    if (instant) { typeFinish(false); return; }
    const step = () => {
      if (typer.item !== item) return;
      const from = typer.i; typer.i = Math.min(n, typer.i + k);
      on.textContent = text.slice(0, offs[typer.i]); rest.textContent = text.slice(offs[typer.i]);
      hook('glyph', item, info, text.slice(offs[from], offs[typer.i]));
      if (typer.i >= n) { typeFinish(false); return; }
      typer.timer = setTimeout(step, per * k + pauseAfter(parts[typer.i - 1], parts[typer.i]));
    };
    typer.timer = setTimeout(step, 70);                  /* 말풍선이 튀어나오는 첫머리와 겹치지 않게 아주 잠깐 뒤에 */
  }
  /* 다 보이게 하고 끝을 알린다. skipped = 누르거나 넘기거나 닫아서 중간에 끝남 */
  function typeFinish(skipped) {
    const item = typer.item; if (!item) return;
    clearTimeout(typer.timer); typer.timer = 0;
    if (typer.on && typer.on.parentNode) { typer.on.textContent = typer.text; typer.rest.textContent = ''; }
    const info = Object.assign({}, typer.info, { skipped: !!skipped });
    Object.assign(typer, { item: null, on: null, rest: null, offs: null, info: null });
    hook('end', item, info);
    afterType(item);
  }
  /* 다 찍힌 뒤 — 대사뿐이면 ▼, 선택지가 있으면 그때 띄우고 첫 단추로(키보드) */
  function afterType(item) {
    if (cur !== item || typer.item || item._over) return;
    const box = T.box(); const ob = T.opts();
    const asks = !!(item.options && item.options.length) || !!item.input;
    box.classList.toggle('next', !asks);
    if (!asks || !ob.children.length || ob.classList.contains('show')) return;
    ob.classList.remove('wait'); ob.classList.add('show'); fitOpts();
    setTimeout(() => {
      try {
        if (!(showing && showing.item === item) || BOT) return;
        const f = item.input ? ob.querySelector('input') : ob.querySelector('button');
        if (f && !f.disabled) f.focus({ preventScroll: true });
      } catch (e) {}
    }, 90);
  }
  /* 선택지 목록 높이 — 말풍선 위 빈자리(위쪽 시계 띠 64px 남김)만큼. 넘치면 목록 안에서 굴린다 */
  function fitOpts() {
    try {
      const box = T.box(); const bx = box.querySelector('.tkBox'); const ob = T.opts(); if (!bx || !ob.children.length) return;
      const top = box.getBoundingClientRect().top + bx.offsetTop;   /* 튀어나오는 중의 크기 변화(transform)는 빼고 잰다 */
      ob.style.maxHeight = Math.max(120, Math.round(top - 12 - 64)) + 'px';
    } catch (e) {}
  }
  global.addEventListener('resize', () => { if (boxOpen) fitOpts(); });

  /* 이름 알약 색 — 직급·관계별(CSS #talk[data-tk]) */
  function tagOf(item) {
    if (item.me) return 'me';
    const n = normName(item.who || ''); const r = String(item.role || '');
    if (/^(방문|전화)/.test(r) || /고객|님$/.test(n)) return 'guest';
    try { return ({ 팀장: 'lead', 사수: 'senior', 동기: 'peer', 조력자: 'help' })[kindOf(n)] || 'base'; } catch (e) { return 'base'; }
  }

  /* 한 장 그리기 — item {who, role, text, options[], timeLimit, me, keep} */
  function paint(item) {
    const box = T.box();
    cur = item;
    const hasOpts = !!(item.options && item.options.length);
    box.classList.toggle('choosing', hasOpts || !!item.input);
    box.classList.toggle('me', !!item.me);
    box.classList.remove('next');
    /* 얼굴 카메라가 잡은 사람이 말할 때는 작은 사진을 숨긴다(얼굴은 위에 있다). 다른 사람의 줄(브리핑의 사수 등)이면 사진으로 누구인지 보인다 */
    /* 작은 사진은 **말하는 사람의 얼굴이 화면에 잡혀 있을 때만** 숨긴다. 내 줄·얼굴을 못 잡은 사람의 줄은 사진으로 누구인지 보인다 */
    box.classList.toggle('cam', !!camSeat && !item.me && speakerSeat(item.who) === camSeat);
    if (!item.keep) {
      if (item.me) faceOfMe(); else if (/^전화/.test(item.role || '') && !npcInfo(item.who)) T.face().textContent = '☎'; else faceOf(item.who);
      T.name().textContent = item.who || '';
      T.role().textContent = item.role || '';
      box.dataset.tk = tagOf(item);
      box.classList.toggle('anon', !item.who);
      /* 말하는 사람이 바뀌면 이름 알약이 살짝 튄다 */
      if (item.who !== lastWho) { const wh = box.querySelector('.tkWho'); if (wh) { wh.classList.remove('swap'); void wh.offsetWidth; wh.classList.add('swap'); } lastWho = item.who; }
      const text = fill(item.text);
      try { T.live().textContent = (item.who ? item.who + ': ' : '') + text; } catch (e) {}
      typeStart(item, text);
      T.text().scrollTop = 0;
    }
    const ob = T.opts(); ob.innerHTML = ''; ob.classList.remove('show', 'wait'); ob.style.maxHeight = '';
    /* 대사가 찍히는 동안 선택지는 자리만 잡고 숨긴다(시간 제한이 있으면 곧바로) */
    if (typer.item === item && !item.timeLimit) ob.classList.add('wait');
    /* 직접 묻기(plan-interaction-design §3-A): 선택지 대신 **한 줄 입력 칸**. Enter·「묻기」로 보내면 글(string)로, 아래 선택지를 고르면 번호로 풀린다 */
    if (item.input) {
      const row = h('div', 'tkIn'); const inp = document.createElement('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.maxLength = 120;
      inp.placeholder = item.input.placeholder || '한 줄로 물어보세요'; inp.setAttribute('aria-label', inp.placeholder);
      const send = mkBtn(item.input.label || '묻기', 'pri', () => { const v = inp.value.trim(); if (!v) { inp.focus(); return; } if (showing && showing.item === item) showing.end(v); });
      inp.addEventListener('keydown', (ev) => { if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); ev.stopPropagation(); send.click(); } if (ev.code === 'Escape') { ev.stopPropagation(); } });
      row.appendChild(inp); row.appendChild(send); ob.appendChild(row);
      (item.options || []).forEach((o, i) => { const b = mkBtn(o.label, o.cls || '', () => { if (showing && showing.item === item) showing.end(i); }); b.dataset.n = String(i + 1); b.style.setProperty('--i', String(i + 1)); ob.appendChild(b); });
    } else if (hasOpts) {
      item.options.forEach((o, i) => {
        const b = mkBtn(o.label, o.cls || '', () => { if (showing && showing.item === item) showing.end(i); });
        b.dataset.n = String(i + 1); b.style.setProperty('--i', String(i));
        ob.appendChild(b);
      });
      if (item.timeLimit) {
        const bar = h('div', 'tkBar'); const iv = h('i'); bar.appendChild(iv); ob.appendChild(bar);
        requestAnimationFrame(() => { iv.style.transition = `width ${item.timeLimit}s linear`; iv.style.width = '0%'; });
      }
    }
    /* 키보드가 3D 창에 머물러 있으면 Enter·Space 가 대화창에 오지 않는다 — 우선 말풍선으로(선택지가 뜨면 첫 단추로 옮긴다) */
    setTimeout(() => { try { if (showing && showing.item === item && !BOT) { const a = document.activeElement; if (!(a && T.opts().contains(a))) T.box().querySelector('.tkBox').focus({ preventScroll: true }); } } catch (e) {} }, 90);
    if (!typer.item) afterType(item);
  }

  /* 창에 하나 올린다 — 앞의 것이 끝나야 다음 것이 뜬다. 선택지면 번호(-1=무응답), 대사면 undefined 로 풀린다 */
  function display(item) {
    item.seq = ++seq;
    const hasOpts = !!(item.options && item.options.length);
    jobs++;
    const run = () => new Promise((done) => { waitStill(item, () => {
      if (item.seq <= flushTo || (item.sess && item.sess.closed)) { done((hasOpts || item.input) ? -1 : undefined); return; }
      openBox(); aimAt(item); paint(item); speakLine(item);
      if (!item.me && item.text && !(item.options && item.options.length)) lastLine = { name: item.who, text: String(item.text), at: Date.now() };
      let fin = false;
      const end = (v) => {
        if (fin) return; fin = true;
        if (showing && showing.timer) clearTimeout(showing.timer);
        if (showing && showing.item === item) showing = null;
        item._over = true;                                  /* 끝난 줄은 다 찍힌 뒤 처리(▼·선택지 띄우기)를 하지 않는다 */
        if (typer.item === item) typeFinish(true);         /* 다 찍히기 전에 넘어가면(시간·Esc·다음 줄) 끝을 알리고 입을 닫는다 */
        T.box().classList.remove('next');
        T.opts().querySelectorAll('button,input').forEach((b) => { b.disabled = true; });
        if (item.onEnd) { try { item.onEnd(v); } catch (e) {} }
        done((hasOpts || item.input) ? (v == null ? -1 : v) : undefined);
      };
      showing = { end, item, timer: null };
      if (hasOpts) { if (item.timeLimit) showing.timer = setTimeout(() => end(-1), item.timeLimit * 1000); }
      else if (item.ms) showing.timer = setTimeout(() => end(), item.ms);
      if (item.onShow) { try { item.onShow(end); } catch (e) {} }
    }); });
    const p = chain.then(run, run);
    chain = p.then(() => {}, () => {});
    return p.then((v) => { jobs--; maybeClose(); return v; }, () => { jobs--; maybeClose(); return (hasOpts || item.input) ? -1 : undefined; });
  }
  async function idle() { while (jobs > 0) { await chain; await new Promise((r) => setTimeout(r, 0)); } }

  /* 읽는 데 드는 시간 — 글자 수로 잡되 너무 짧거나 길지 않게 */
  const readMs = (t, k) => Math.round(Math.max(2400, Math.min(9000, 1300 + 60 * String(t || '').length)) * (k || 1));

  /* 대사 한 줄. opt: {me, role, auto, soft, sess, ms}
       · auto(자동 플레이)면 띄우지 않는다.
       · 사람이 대화 중(human)이면 상대 대사는 누를 때까지, 내 대사는 잠깐 뒤 저절로 넘어간다.
       · 대화 밖에서 튀어나온 줄(soft)은 읽을 만큼 머물다 저절로 닫힌다 — 줄을 막아 세우지 않게. */
  function sayLine(who, text, opt) {
    opt = opt || {}; if (opt.auto || !text) return Promise.resolve();
    const s = ('sess' in opt) ? opt.sess : sess;
    const human = !!(s && s.human);
    let ms = opt.ms || 0;
    if (!ms) { if (opt.me) ms = human ? readMs(text, 0.55) : readMs(text, 0.8); else if (!human) ms = readMs(text); }
    return display({ who: opt.me ? meName() : who, role: opt.me ? '' : (opt.role != null ? opt.role : roleOf(who)), text, me: !!opt.me, sess: s, ms, live: !!opt.live, mood: opt.mood || undefined });
  }

  /* ---------- 대화 한 판의 틀 ---------- */
  function begin(o) {
    o = o || {};
    const s = { id: ++sessSeq, name: normName(o.name || ''), role: o.role || '', seat: o.seat || null, cam: !!o.cam, hold: !!o.hold, human: o.human != null ? !!o.human : !BOT, closed: false };
    sess = s;
    if (s.cam && s.seat) {
      camIn(s.seat);
      /* 3D 는 talkView 를 켠 뒤 25초가 지나면 카메라를 스스로 푼다(갇히지 않게). 대화가 길어지면 다시 붙잡는다 */
      s.camKeep = setInterval(() => { if (sess === s && !s.closed && camSeat) camIn(camSeat); }, 12000);
    }
    /* 창은 첫 줄이 뜰 때 연다 — 말 거는 자리로 걸어가는 동안(waitStill) 빈 대화창이 먼저 뜨지 않게 */
    return s;
  }
  async function end(s) {
    if (!s) return;
    await idle();
    if (s.camKeep) { clearInterval(s.camKeep); s.camKeep = null; }
    if (sess !== s) return;
    sess = null;
    if (s.cam || camSeat) camOut();
    maybeClose();
  }

  /* ======================================================================
     ① 선택지 하나 고르기
     ====================================================================== */
  function choose(prompt, items, timeLimit, opts) {
    opts = opts || {};
    const options = (items || []).map((t) => ({ label: t }));
    if (!options.length) return Promise.resolve(-1);
    return display({ who: opts.who || '', role: opts.role || '', text: prompt || '', options, timeLimit, sess: opts.sess || sess });
  }

  /* ======================================================================
     ② NPC 와 주고받는 대화 (T)
     ====================================================================== */

  /* 오늘 그 사람에게 남은 일 — 있으면 그것이 첫 선택지가 된다.
     45차(대표 「말·질문·서류 제출은 T로만」): 컴퓨터 카드의 「가서 전달하기」 단추가 없어지고 사람을 직접 찾아간다.
     그런데 **맞는 상대를 고르는 것**이 이 카드들의 학습 목표(조직이해 ⑨ · 맞는 상대 n/m)다. 그래서
       · 전달·질문 — 누구에게 T 를 눌러도 선택지에 뜬다(팀장은 그 건의 상대일 때만 — 예전 목적지 목록과 같은 규칙).
         틀린 사람에게 내밀면 예전과 똑같이 「그건 ○○팀이요」로 돌아오고 셈에 들어간다.
       · 보고·검산 결과 — 상대가 정해져 있으니 그 사람에게만 뜬다.
     opt.mark(머리 위 표시용)면 정답을 드러내는 전달·질문은 뺀다(MARK_TARGETS 로 되돌릴 수 있다). */
  const MARK_TARGETS = false;
  function tasksFor(name, opt) {
    opt = opt || {};
    const out = [];
    if (!D || S.phase !== 'work' || !name) return out;
    const leadName = (D.dests.find((x) => x.seat === 'lead') || {}).name || '';
    const isLead = name === leadName;
    const mark = !!opt.mark;
    for (const id of S.order) {
      const c = CARD(id), st = S.cards[id];
      if (!c || !st || !st.arrived || st.status === 'done' || st.status === 'skipped') continue;
      const steps = st.steps || {}, flow = flowOf(c);
      const dl = c.deliver || null;
      if (flow.includes('visit')) {
        if (st.visitorHere && normName(c.visitorName || c.from) === name) out.push({ id: id, kind: 'visit', label: `「${cut(c.subj)}」 응대하기`, hint: 'T — 응대하기' });
        continue;
      }
      if (flow.includes('work') && steps.work && !steps.deliver && dl && dl.npc === name) {
        out.push({ id: id, kind: 'sheet', label: `「${cut(c.subj)}」 검산 결과 가져가기`, hint: 'T — 검산 결과 가져가기' }); continue;
      }
      if (flow.includes('work')) continue;
      /* 57차 E2 — 2일차부터 글 카드는 학생이 컴퓨터에서 고른 처리(가서 전달하기 · 가서 묻기 · 대면 보고)만 T 로 뜬다(cards.js goChoice).
         흐름마다 할 일이 저절로 떠 있으면 그 목록이 곧 정답(넘길 건 · 물어볼 건 · 보고할 건)이다. 고른 뒤에는 누구에게 가도 뜬다 —
         맞는 사람을 찾는 것이 학생의 일이다. 머리 위 표시(mark)에는 전달·질문을 띄우지 않는다(예전과 같다) */
      if (typeof global.commonCard === 'function' && global.commonCard(c)) {
        if (st.go === 'deliver' && !mark) out.push({ id: id, kind: 'deliver', label: `「${cut(c.subj)}」 전달하기`, hint: 'T — 서류 전달하기' });
        else if (st.go === 'ask' && !mark) out.push({ id: id, kind: 'ask', label: `「${cut(c.subj)}」 여쭤보기`, hint: 'T — 여쭤보기' });
        else if (st.go === 'report' && isLead) out.push({ id: id, kind: 'report', label: `「${cut(c.subj)}」 보고드리기`, hint: 'T — 보고드리기' });
        continue;
      }
      if (flow.includes('deliver') && !steps.deliver && dl) {
        const right = dl.npc === name;
        if ((mark ? (MARK_TARGETS && right) : (!isLead || right))) out.push({ id: id, kind: 'deliver', label: `「${cut(c.subj)}」 전달하기`, hint: 'T — 서류 전달하기' });
        continue;
      }
      if (flow.includes('ask') && !st.ask && !steps.reply) {
        const right = c.npc === name;
        if ((mark ? (MARK_TARGETS && right) : (!isLead || right))) out.push({ id: id, kind: 'ask', label: `「${cut(c.subj)}」 여쭤보기`, hint: 'T — 여쭤보기' });
        continue;
      }
      if (flow.includes('report') && !steps.report) {
        const to = c.npc || (c.report && c.report.npc) || leadName;
        if (to === name) { out.push({ id: id, kind: 'report', label: `「${cut(c.subj)}」 보고드리기`, hint: 'T — 보고드리기' }); continue; }
      }
    }
    /* 할 일이 여럿이면 상대가 정해진 것(보고·검산·응대)을 앞에 */
    const rank = { visit: 0, report: 1, sheet: 1, deliver: 2, ask: 2 };
    return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
  }
  function cut(s, n) { s = String(s || ''); n = n || 15; return s.length > n ? s.slice(0, n) + '…' : s; }

  /* 잡담 — 데이터에 있으면 그것을, 없으면 역할별 기본 문구를 돌려 쓴다.
     사람마다 다르게 들려야 하므로 이름으로 자리를 정해 같은 사람은 같은 결을 유지한다. */
  const SMALL = {
    사수: {
      hi: ['어, 왔어요. 잘 하고 있죠?', '○○씨. 막히는 거 있으면 바로 물어봐요.', '오, 얼굴 좋네. 오늘 할 만해요?'],
      how: ['오늘은 좀 낫네요. 어제가 고비였지.', '늘 이래요. 첫 주가 제일 길어요.', '나야 뭐. ○○씨가 더 바쁠걸요.'],
      bye: ['네, 가 봐요. 필요하면 부르고.', '그래요. 막히면 언제든.']
    },
    팀장: {
      hi: ['○○씨, 적응은 좀 됐어요?', '어, 그래요. 무슨 일이에요?', '왔어요? 급한 거 아니면 나중에 봐도 돼요.'],
      how: ['괜찮아요. 오늘 건은 오늘 안에만 끝내면 돼요.', '바쁘죠 뭐. 그래도 순서만 지키면 돼요.', '숫자만 맞으면 돼요. 그게 제일이에요.'],
      bye: ['네, 가 봐요.', '그래요. 보고할 거 생기면 바로 와요.']
    },
    동기: {
      hi: ['어 왔어? 나 지금 정신없어 ㅋㅋ', '왔네. 살아 있어?', '야, 너도 메일 쌓였지?'],
      how: ['말도 마. 아침부터 세 건 터졌어.', '그럭저럭? 점심은 먹고 하자.', '나 지금 이거 하나만 끝내면 돼. 너는?'],
      bye: ['어 가, 이따 봐.', 'ㅇㅇ 이따 점심때.']
    },
    조력자: {
      hi: ['네, 말씀하세요.', '아, 고객상담팀이시죠. 무슨 건이세요?', '네 안녕하세요. 어떤 거 때문에 오셨어요?'],
      how: ['저희도 오늘 물량이 많아요. 그래도 돌아는 갑니다.', '늘 비슷해요. 요청은 메일로 주시면 빠릅니다.', '오전은 좀 몰리고 오후엔 괜찮아요.'],
      bye: ['네, 필요하면 또 오세요.', '네 들어가세요.']
    },
    기본: {
      hi: ['네, 안녕하세요.', '아, 네. 무슨 일이세요?'],
      how: ['그럭저럭이에요.', '늘 하던 대로죠 뭐.'],
      bye: ['네, 수고하세요.', '네 들어가세요.']
    }
  };
  function kindOf(name) {
    const info = npcInfo(name) || {};
    const r = info.role || '';
    if (r === '사수' || /사수/.test(r)) return '사수';
    if (r === '팀장' || /팀장/.test(name + r)) return '팀장';
    if (r === '동기' || name === (typeof peerName === 'function' ? peerName() : '')) return '동기';
    if (r === '조력자' || (info.teamKey && info.teamKey !== S.team)) return '조력자';
    return '기본';
  }
  function seedOf(name) { let n = 0; for (let i = 0; i < name.length; i++) n = (n * 31 + name.charCodeAt(i)) % 9973; return n; }
  function line(name, key, turn) {
    const data = (D && D.dialog && D.dialog.smalltalk && D.dialog.smalltalk[name]) || null;
    const pool = (data && data[key]) || SMALL[kindOf(name)][key] || SMALL['기본'][key];
    return pool[(seedOf(name) + (turn || 0)) % pool.length];
  }

  /* 대화 한 판. T 를 누른 순간 3D 가 얼굴 카메라를 켜고 여기로 온다 */
  async function npc(name, seat, team) {
    name = normName(name);
    if (!name) return;
    if (sess && sess.hold) { if (sess.name === name && !sess.closed) return; close(); await idle(); }
    const info = npcInfo(name) || {};
    seat = seat || info.seat || seatByName(name);
    const roleText = seat === 'visitor' ? '방문' : roleOf(name);
    const s = begin({ name, seat, cam: true, hold: true });
    s.team = team || null;
    const after = [];                                     /* 대화가 끝난 뒤 컴퓨터에 띄울 카드 */
    const post = [];                                      /* 대화가 닫힌 뒤 부를 것(부르기의 onHeard) */
    try {
      /* ① 그 사람이 먼저 할 말 — 머리 위 표시가 떠 있던 까닭 */
      const heard = (pending[name] || []).splice(0); delete pending[name]; delete noticed[name]; refresh();
      /* 부르기(브리핑·마무리) — 한 줄씩 다 듣고 대화를 닫은 뒤 onHeard(시계 시작·결과 화면). Esc 로 끊으면 못 들은 줄은 다시 쌓는다 */
      if (heard.some((x) => x.call)) {
        const tk = heard.find((x) => x.token && x.token.gathered && x.token.gathered.length); s.gathered = tk ? tk.token.gathered : [];
        /* 모이는 중에 T 를 눌렀으면 아직 걸어오는 사람을 제자리에 세운다(카메라가 걷는 뒷모습을 잡지 않게) */
        if (s.gathered.length) { const O = O3(); try { if (O && typeof O.gatherSnap === 'function') O.gatherSnap(); } catch (e) {} }
        for (let i = 0; i < heard.length; i++) {
          const it = heard[i];
          if (s.closed) { const back = heard.slice(i); pending[name] = back.concat(pending[name] || []); noticed[name] = true; refresh(); break; }
          await sayLine(it.who || name, it.text, { sess: s, role: it.who && it.who !== name && !npcInfo(it.who) ? (it.role || '') : undefined });
          if (it.onSaid) { try { it.onSaid(); } catch (e) { console.warn('줄 뒤 처리 오류', e); } }
          if (it.onHeard) { if (it.token) { it.token.done = true; clearInterval(it.token.remind); } post.push(it.onHeard); }
        }
        throw { done: true };
      }
      for (let i = 0; i < heard.length - 1 && !s.closed; i++) await sayLine(heard[i].who || name, heard[i].text, { sess: s });
      /* 방문객 — 잡담 없이 곧바로 응대로 들어간다 */
      if (seat === 'visitor' && !s.closed) {
        const vt = tasksFor(name).find((x) => x.kind === 'visit');
        if (vt) { await runTask(name, vt); await idle(); throw { done: true }; }
      }
      let say = heard.length ? heard[heard.length - 1].text : line(name, 'hi', 0);
      let keep = false;
      let turn = 0;
      /* ?smalltalk=1 — 이 사람과 일상 대화를 할 수 있으면 「이어서 대화하기」(방문객·명단 밖·플레이어 자신은 null) */
      const st = (SMALLTALK && global.SmallTalk && !s.closed) ? await global.SmallTalk.prep(name, seat).catch(() => null) : null;
      /* ② 고를 때마다 다음 화면을 그린다 */
      while (!s.closed) {
        const opts = [];
        for (const t of tasksFor(name)) opts.push({ label: t.label, cls: 'pri', v: { task: t } });
        if (st) opts.push({ label: '이어서 대화하기', v: { st: true } });
        opts.push({ label: '그냥 인사', v: { say: 'hi' } });
        opts.push({ label: '요즘 어떠세요', v: { say: 'how' } });
        opts.push({ label: '이만 가 볼게요', v: { bye: true } });
        const i = await display({ who: name, role: roleText, text: say, keep, options: opts, sess: s });
        const pick = i >= 0 ? opts[i].v : null;
        if (s.closed) break;
        if (!pick || pick.bye) {
          await sayLine(name, line(name, 'bye', turn), { sess: s, ms: 1300 });
          break;
        }
        if (pick.task) {
          await runTask(name, pick.task);
          await idle();
          after.push(pick.task.id);
          keep = true; say = '';                          /* 상대의 마지막 말을 그대로 둔 채 선택지만 새로 */
          continue;
        }
        if (pick.st) {                                    /* 한 주제 → 마무리 한 줄과 함께 기존 선택지로(창은 닫히지 않는다) */
          const closing = await smallTalk(name, st, s);
          keep = false; say = closing || line(name, 'hi', turn);
          continue;
        }
        turn++; keep = false;
        if (pick.say === 'hi') {
          greeted[name] = (greeted[name] || 0) + 1;
          /* 인사를 세 번 나누면 신뢰가 아주 조금. 하루 한 사람당 한 번뿐이다 */
          if (greeted[name] >= 3 && !trusted[name] && npcInfo(name)) {
            trusted[name] = true; S.trust[name] = (S.trust[name] || 0) + 1;
          }
        }
        say = line(name, pick.say, turn);
      }
    } catch (e) {
      if (!(e && e.done)) console.warn('대화 오류', e);
    } finally {
      s.closed = true;
      await end(s);
    }
    for (const f of post) { try { f(); } catch (e) { console.warn('부르기 뒤 처리 오류', e); } }
    /* 남은 단계(회신 쓰기 등)는 컴퓨터에서 한다 — 카드를 메일 창에 올려 둔다 */
    for (const id of after) {
      const st = S.cards[id];
      /* 쓰던 회신이 있으면 건드리지 않는다 — 작성 칸은 하나라 다른 카드를 열면 쓰던 글이 사라진다 */
      if (st && st.status !== 'done' && !S.composing && typeof global.openCard === 'function') { try { global.openCard(id); } catch (e) {} break; }
    }
  }

  /* ?smalltalk=1 「이어서 대화하기」 한 주제 — 첫마디(마지막 줄은 선택지와 함께) → 내 답 → 반응 → 마무리 한 줄을 돌려준다.
     마무리는 부른 쪽(npc 루프)이 기존 선택지(할 일·인사·가 볼게요)와 함께 띄운다. 오늘 몫을 다 나눴으면 fallback 한 줄만.
     표정(face)은 그 줄의 첫머리 mood 로(3D speak) — 말이 끝나면 3D 가 neutral 로 되돌린다. greeted·trusted·S.trust·S.counts 는 건드리지 않는다 */
  async function smallTalk(name, st, s) {
    const ST = global.SmallTalk; if (!ST || !st) return null;
    const r = await ST.pick(st).catch(() => null);
    if (!r || s.closed || r.kind === 'none') return null;
    if (r.kind !== 'topic') return r.line || null;
    const tp = r.topic; ST.mark(st, tp);
    const op = (tp.opener || []).filter(Boolean); const ch = (tp.choices || []).filter((c) => c && c.text);
    if (!op.length || !ch.length) return tp.closing || null;
    for (let i = 0; i < op.length - 1 && !s.closed; i++) await sayLine(name, op[i], { sess: s, mood: i === 0 ? tp.face : null });
    if (s.closed) return null;
    const i = await display({ who: name, role: roleOf(name), text: op[op.length - 1], options: ch.map((c) => ({ label: fill(c.text) })), sess: s, mood: op.length === 1 ? (tp.face || undefined) : undefined });
    if (s.closed || i == null || i < 0) return null;
    const c = ch[i];
    await sayLine(name, c.text, { me: true, sess: s });
    const rep = (c.reply || []).filter(Boolean);
    for (let k = 0; k < rep.length && !s.closed; k++) await sayLine(name, rep[k], { sess: s, mood: k === 0 ? c.face : null });
    return s.closed ? null : (tp.closing || null);
  }

  /* 고른 일을 실제로 한다 — 채점 경로는 기존 함수 그대로다(새로 만들지 않는다) */
  async function runTask(name, t) {
    const info = npcInfo(name) || {};
    /* 오늘 데이터에 없는 사람(다른 팀 사무실의 팀장 등)도 받을 수 있게 — 팀은 3D 가 알려 준 지금 방으로 */
    const room = (sess && sess.team) || info.teamKey || S.team;
    const d = (D.dests || []).find((x) => x.name === name) ||
      { seat: info.seat || (sess && sess.seat) || seatByName(name), name: name, team: info.team || TEAM_NAMES[room] || '', key: info.teamKey || room };
    try {
      if (t.kind === 'visit') await doVisit(t.id);
      else if (t.kind === 'deliver') await doDeliver(t.id, d);
      else if (t.kind === 'ask') await doAsk(t.id, d);
      else if (t.kind === 'report') await doReport(t.id);
      else if (t.kind === 'sheet') await doSheetDeliver(t.id);
    } catch (e) { console.warn('대화에서 시작한 일 처리 오류', e); }
  }

  /* ======================================================================
     ③ 그 자리에서 대화로 — 전달·질문·보고를 걷는 연출 없이
     `travel()`(core.js) 을 감싼다. T 로 마주 선 상대에게 하는 일이면 이 창에서 주고받고,
     3D 가 없거나 연출을 못 하는 경우(예전의 「알림 한 줄」 대체)도 이 창에서 한다.
     그 밖(컴퓨터 카드의 「가서 전달하기」)은 예전대로 3D 가 걸어가 연출하고, 대사는 onSay 로 이 창에 온다.
     돌려주는 값은 3D interact 와 같다: deliver {ok,present,line} · ask {choice,answer,present} · report {choice,line,present} · visit {choice,present}
     ====================================================================== */
  async function talkFlow(mode, opts, s) {
    const who = opts.who || (s && s.name) || '';
    const A = opts.auto != null && opts.auto !== false;
    const autoI = (n) => Math.max(0, Math.min(n - 1, +opts.auto || 0));
    const me = (t) => sayLine(who, t, { me: true, auto: A, sess: s });
    const them = (t, name) => sayLine(name || who, t, { auto: A, sess: s, role: name && name !== who ? (opts.role || '') : undefined });
    if (mode === 'deliver') {
      await me(opts.text || '이거 전달드리러 왔어요.');
      const ln = opts.npcLine || (opts.ok === false ? '그건 다른 팀인데요.' : '네, 처리할게요.');
      await them(ln);
      return { ok: opts.ok !== false, present: true, line: ln };
    }
    if (mode === 'ask' && opts.open) return askOpenFlow(opts, s, who, A, me, them);
    if (mode === 'ask') {
      const qs = opts.questions || [];
      const i = A ? autoI(qs.length) : await choose(`${who}에게 무엇을 물어볼까요?`, qs, null, { who, role: roleOf(who), sess: s });
      if (i == null || i < 0) return { choice: -1, answer: null, present: true };
      await me(qs[i]);
      const ans = (opts.answers && opts.answers[i]) || opts.answer || '그건 저도 잘 모르겠는데요.';
      await them(ans);
      return { choice: i, answer: ans, present: true };
    }
    if (mode === 'report') {
      const ch = opts.choices || [];
      if (opts.text) await me(opts.text);
      if (!A) await them(opts.ask || '근거가 뭐야?');
      const i = A ? autoI(ch.length) : await display({ who, role: roleOf(who), text: opts.ask || '근거가 뭐야?', keep: true, options: ch.map((t) => ({ label: t })), sess: s });
      if (i == null || i < 0) return { choice: -1, present: true };
      await me(ch[i]);
      const ln = (opts.lines && opts.lines[i]) || '';
      if (ln) await them(ln);
      return { choice: i, line: ln, present: true };
    }
    if (mode === 'visit') {
      const name = opts.name || who || '방문객';
      const ch = opts.choices || [];
      const open = opts.lines && opts.lines.open;
      if (open && !A) await sayLine(name, open, { sess: s, role: '방문' });
      const i = A ? autoI(ch.length) : await display({ who: name, role: '방문', text: open || opts.prompt || '어떻게 응대할까요?', keep: !!open, options: ch.map((t) => ({ label: t })), timeLimit: opts.timeLimit || null, sess: s });
      if (i == null || i < 0) return { choice: -1, present: true };
      await me(ch[i]);
      const re = (opts.reacts && opts.reacts[i]) || '';
      if (re) await sayLine(name, re, { auto: A, sess: s, role: '방문' });
      return { choice: i, present: true };
    }
    return { ok: true, present: true };
  }
  /* ---------- 직접 묻기(askOpen · docs/plan-interaction-design.md §3-A) ----------
     opts.open = {greet, tries, model, classify(text, got, n) → Promise<{say, got, done, cap, need}>}. 채점(어느 조각을 건드렸나)은 classify 가 한다 —
     로컬은 Score.askOpen, 배포본은 서버(정답 조각은 서버에만). 이 함수는 **대화 판만** 돈다.
       ① 담당자 첫마디 → 입력 칸(「무엇을 물어볼까요?」) + 「이만 됐어요」
       ② 학생이 한 줄 묻는다 → 내 줄 → 담당자 답(건드린 조각만, 못 알아들으면 되묻기) → 다시 입력 칸
       ③ 필요한 조각을 다 얻었거나 횟수를 다 쓰면 끝. 「이만 됐어요」는 언제든 — 한 번도 안 물었으면 취소(-1)와 같다.
     자동 플레이는 모범 질문(model) 한 줄로 한 번에 묻는다. */
  async function askOpenFlow(opts, s, who, A, me, them) {
    const O = opts.open; const asked = []; let got = []; let last = null;
    const cls = (t, n) => Promise.resolve(O.classify(t, got.slice(), n));
    if (A) {
      const q = O.model || ''; if (!q) return { open: true, asked, got, cap: 40, present: true };
      asked.push(q); const r = await cls(q, 1); got = r.got || []; last = r;
      return { open: true, asked, got, cap: r.cap, need: r.need, present: true };
    }
    let prompt = O.greet || '네, 말씀하세요.';
    const tries = Math.max(1, +O.tries || 3);
    while (asked.length < tries) {
      const left = tries - asked.length;
      const v = await display({ who, role: roleOf(who), text: prompt, sess: s,
        input: { placeholder: asked.length ? `더 물어볼 것 (${left}번 남음)` : `무엇을 물어볼까요? 한 줄로 (${left}번까지)`, label: '묻기' },
        options: [{ label: asked.length ? '이만 됐어요' : '그냥 갈게요' }] });
      if (typeof v !== 'string') break;
      const text = v.trim(); if (!text) continue;
      asked.push(text); await me(text);
      let r; try { r = await cls(text, asked.length); } catch (e) { console.warn('직접 묻기 채점 실패', e); asked.pop(); await them('잠깐만요, 다시 한 번 말씀해 주세요.'); continue; }
      got = r.got || got; last = r; prompt = r.say || '…';
      if (r.done) { await them(prompt); break; }
    }
    if (!asked.length) return { choice: -1, open: true, asked, got, present: true };
    return { open: true, asked, got, cap: last ? last.cap : 40, need: last ? last.need : 0, present: true };
  }
  /* 3D 가 이 연출을 할 수 있는가 — core.js travel() 의 분기와 같은 조건 */
  function stageCan(opts) {
    const O = O3(); if (!O || O.busy) return false;
    if (typeof O.goToTeam === 'function' && opts.teamKey && opts.teamKey !== S.team) return true;
    return !!(opts.seat && O.npcAt && O.npcAt(opts.seat));
  }
  /* 3D 연출 한 판을 대화의 틀로 감싼다. 연출이 끝난 직후 오는 반응(Talk.reply)도 같은 판에 이어 붙도록 한 틱 뒤에 닫는다 */
  async function stage(opts, fn) {
    opts = opts || {};
    const s = begin({ name: normName(opts.who || opts.name || ''), seat: opts.seat || null, hold: false, human: opts.auto == null && !BOT });
    s.stage = true; s.auto = opts.auto != null; s.timeLimit = opts.timeLimit || null;
    if (!s.auto) watchChoice(s);
    try { return await fn(); }
    finally { s.stageDone = true; setTimeout(() => end(s), 0); }
  }
  function wrapTravel() {
    const orig = global.travel; if (typeof orig !== 'function' || orig.__talk) return;
    /* 그 팀 사람을 만났으면(present) 그 팀 사규집 편을 연다 — core.js travel 이 하는 일. 이 래퍼는 대화창·3D 방 안 연출 경로에서 core travel 을 거치지 않아
       PC 창 모드·T 로 마주 선 대화에서 다른 팀에 물어도 편이 안 열렸다(57차 E1 후속 · QA Y-7). 두 번 열어도 괜찮다(rbUnlock 이 본다) */
    const wrapped = async function (mode, opts) {
      const r = await inner.apply(this, arguments);
      try { if (r && r.present !== false && opts && opts.teamKey && typeof global.rbUnlock === 'function') global.rbUnlock(opts.teamKey); } catch (e) {}
      return r;
    };
    const inner = async function (mode, opts) {
      opts = opts || {};
      /* T 로 마주 선 사람에게 하는 일 — 그 자리에서 대화로 */
      if (sess && !sess.closed && sess.hold && (opts.who === sess.name || (opts.seat && opts.seat === sess.seat))) {
        return talkFlow(mode, opts, sess);
      }
      const human = opts.auto == null && !BOT;
      if (mode === 'ask' && opts.open) {
        if (stageCan(opts)) {
          const ap = Object.assign({}, opts, { text: '여쭤볼 게 있는데요.', npcLine: opts.open.greet || '네, 말씀하세요.', ok: true }); delete ap.open;
          const r0 = await stage(ap, () => orig.call(this, 'deliver', ap));
          if (r0 && r0.present === false) return { present: false };
        }
        const s = begin({ name: opts.who || '', seat: null, hold: false, human });
        try { return await talkFlow(mode, opts, s); }
        finally { setTimeout(() => end(s), 0); }
      }
      if (!stageCan(opts)) {
        /* 예전의 「알림 한 줄」 대체 연출 — 이제 대화창에서 한다 */
        const s = begin({ name: opts.who || opts.name || '', seat: null, hold: false, human });
        try { if (!NO_STAGE && opts.auto == null) await sleep(400); return await talkFlow(mode, opts, s); }
        finally { setTimeout(() => end(s), 0); }
      }
      /* 3D 가 걸어가 연출한다 — 대사는 onSay 로, 선택지는 onChoose/패널 옮기기로 이 창에 온다.
         상대가 **지금 이 방 자리에 앉아 있으면**(45차 데이터: 조력자도 우리 방 staff2~4 에 앉는다) 다른 팀 방으로 돌아가지 않고
         이 방에서 연출한다 — core.js travel() 은 팀이 다르면 무조건 복도로 나가 그 팀 방에서 사람을 찾다가 못 찾고 돌아왔다. */
      const O = O3();
      const occ = O && !O.busy && opts.seat && O.npcAt ? O.npcAt(opts.seat) : null;
      const inRoom = occ && (typeof O.roomOf !== 'function' || O.roomOf() === S.team) && (!occ.label || normName(occ.label) === normName(opts.who));
      if (inRoom && opts.teamKey && opts.teamKey !== S.team && typeof O.interact === 'function') {
        return stage(opts, async () => { const r = await O.interact(mode, Object.assign({}, opts, { to: opts.seat })); return r || { present: false }; });
      }
      const self = this, args = arguments;
      return stage(opts, () => orig.apply(self, args));
    };
    wrapped.__talk = true;
    global.travel = wrapped;
  }

  /* ---------- 3D 선택 패널 옮기기 ----------
     3D 연출(interact)은 선택지를 iframe 안 #choice 에 띄운다. 대화창이 화면 아래를 덮으므로 그대로 두면
     가려진다. 3D 가 onChoose 를 내주기 전까지는 그 패널을 읽어 이 창에 옮기고, 고르면 __office.choose(i). */
  let choiceHooked = false;
  function watchChoice(s) {
    if (choiceHooked) return;
    const iv = setInterval(() => {
      if (s.stageDone || s.closed) { clearInterval(iv); return; }
      let doc = null; try { doc = $('stage').contentDocument; } catch (e) {}
      const el = doc && doc.getElementById('choice');
      if (!el || el.style.display !== 'block' || el.__talkMirrored) return;
      el.__talkMirrored = true;
      const q = (el.querySelector('.q') || {}).textContent || '';
      const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent.replace(/^\d+\.\s*/, ''));
      el.style.visibility = 'hidden';
      const item = {
        who: s.name || '', role: roleOf(s.name), text: q, options: labels.map((t) => ({ label: t })), timeLimit: s.timeLimit, sess: s, mirror: true,
        onShow: (endIt) => {
          /* 3D 쪽에서 먼저 닫히면(시간 초과 choose(-1) 등) 이 창도 닫는다 */
          const w = setInterval(() => { if (el.style.display !== 'block' || s.closed) { clearInterval(w); endIt(); return; } el.style.visibility = 'hidden'; }, 150);
          item._w = w;
        },
        onEnd: (v) => { clearInterval(item._w); el.style.visibility = ''; el.__talkMirrored = false; if (v != null && v >= 0) { const O = O3(); try { if (O && typeof O.choose === 'function') O.choose(v); } catch (e) {} } }
      };
      display(item);
    }, 120);
  }
  /* 3D 가 선택지를 넘겨주는 계약(요청 중) — fn({q, options, mode, name, seat, team, timeLimit}) → Promise<번호> */
  function onChoose(p) {
    choiceHooked = true;
    p = p || {};
    const s = sess && !sess.closed ? sess : null;
    if ((s && s.auto) || (!s && BOT)) return Promise.resolve(-1);
    return display({ who: p.name || (s && s.name) || '', role: roleOf(p.name || (s && s.name)), text: p.q || '', options: (p.options || []).map((t) => ({ label: t })), timeLimit: p.timeLimit || (s && s.timeLimit) || null, sess: s });
  }
  /* 3D 연출 대사 — fn({name, text, ttl, who:'npc'|'player', seat, team}).
     3D 는 ttl 초 기다리고 다음 대사로 넘어간다. 3D 가 이 약속의 Promise 를 기다려 주면(sayWaits) 상대 대사는 누를 때까지 둔다. */
  function onSay(p) {
    p = p || {};
    const s = sess && !sess.closed ? sess : null;
    if (s && s.auto) return undefined;
    /* 기다려 달라고 하는 것은 사람이 보고 있는 연출 판뿐이다 — 판 밖(퇴근 연출 등)·자동화에서 기다리면 3D 가 180초씩 멈춘다 */
    const O = O3(); const waits = !!(O && O.sayWaits) && !!(s && s.human);
    const isMe = p.who === 'player';
    const name = isMe ? meName() : normName(p.name || (s && s.name) || '');
    /* 앞 대사가 아직 떠 있으면(3D 는 이미 다음으로 넘어갔다) 걷어내고 새 대사를 띄운다 */
    if (!waits && showing && showing.item.live) showing.end();
    /* 3D 가 기다려 주지 않으면 ttl 보다 조금 더 머문다 — 다음 대사가 오면 곧바로 갈아 끼우므로 창이 깜빡이지 않는다 */
    const ms = waits ? (isMe ? readMs(p.text, 0.55) : 0) : Math.max(1200, (+p.ttl || 2.5) * 1000 + 700);
    const pr = display({ who: name, role: isMe ? '' : (roleOf(name) || (p.seat ? '' : '방문')), text: p.text, me: isMe, sess: s, ms, live: !waits });
    return waits ? pr : undefined;
  }

  /* ======================================================================
     ④ NPC 가 먼저 할 말 · 방금 한 일의 반응
     ====================================================================== */
  function refresh() { try { if (typeof global.refreshTalkHints === 'function') global.refreshTalkHints(); } catch (e) {} }
  /* 먼저 할 말 — 자리가 있으면 쌓아 두고(머리 위 표시), 없으면 사내 메신저 */
  function hear(who, text) {
    const name = normName(who); text = String(text || '').trim();
    if (!name || !text) return false;
    /* 하루가 닫히는 중(결과 계산 · 팀장 마무리 대기)에 미처리 카드 분기가 쏟아내는 말은 흘려보낸다 — 마무리 대화 앞에 끼어들지 않게 */
    if (S.phase === 'debrief' || S.phase === 'wrap') return true;
    /* 50차 주의: 여기서는 **자리만** 본다(seatOf 가 아니다).
       hear 는 「가서 T 로 들어야 하는 말」인데, 머리 위 표시(refreshTalkHints)가 좌석만 훑어서
       방문객에게 쌓으면 표시가 안 뜨고 말이 갇힌다. 찾아온 손님의 말은 reply(그 자리에서 바로)로 간다. */
    if (!seatByName(name)) { if (typeof msgLine === 'function') msgLine(name, fill(text)); return true; }
    if (sess && !sess.closed && sess.name === name) { sayLine(name, text, { sess }); return true; }
    /* PC 창 모드(3D 없음)에는 걸어가 T 로 들을 길이 없다 — 곧바로 대화창에 띄운다. 쌓아 두면 「다음 업무까지 넘기기」가 그날 내내 숨었다(57차 E1 후속 · QA Y-6) */
    if (NO_STAGE) { sayLine(name, text, { sess: null }); return true; }
    const q = (pending[name] = pending[name] || []);
    if (!q.some((x) => x.text === text)) q.push({ text, who: name });
    while (q.length > 6) { const i = q.findIndex((x) => !x.call); if (i < 0) break; q.splice(i, 1); }
    refresh();
    /* 내용은 알리지 않는다 — 누가 부르는지만. 같은 사람은 한 번 알리고 들을 때까지 다시 알리지 않는다 */
    if (!noticed[name] && S.phase === 'work') { noticed[name] = true; toast('할 말이 있대요. 가서 T 로 들어 보세요.', name, 3800, 'cust'); }
    return true;
  }
  /* 방금 한 일의 반응 — 대화 중이면 그 판에, 아니면 잠깐 창을 띄워 읽힌다 */
  function reply(who, text) {
    const name = normName(who); text = String(text || '').trim();
    if (!name || !text) return;
    /* 데이터에 연출 대사(wrongNpcLine 등)와 분기 반응(now.text)이 거의 같은 말로 두 번 적힌 경우가 있다 — 방금 한 말에 담기면 넘긴다 */
    const same = (a, b) => { const n = (x) => String(x || '').replace(/[\s.,!?…~"'「」]/g, ''); a = n(a); b = n(b); return !!a && !!b && (a.includes(b) || b.includes(a)); };
    if (lastLine && lastLine.name === name && Date.now() - lastLine.at < 60000 && same(lastLine.text, fill(text))) return;
    const seat = seatOf(name);   /* 50차: 방문객으로 와 있는 사람도 대화창에 띄운다 */
    if (sess && !sess.closed && (sess.name === name || !seat)) { sayLine(name, text, { sess, role: (sess.name === name && !npcInfo(name) && sess.role) || undefined }); return; }
    if (!seat) { if (typeof msgLine === 'function') msgLine(name, fill(text)); return; }
    sayLine(name, text, { sess: null });
  }
  function hasPending(name) { const q = pending[normName(name)]; return !!(q && q.length); }

  /* 부르기 — 그 사람에게 가서 T 로 **들어야 하는** 말 묶음(45차: 아침 브리핑 · 퇴근 마무리).
     lines [{who,text,role}] 는 그 사람과의 대화 한 판에 차례로 나오고(말한 사람 이름표로), 다 들으면 onHeard.
     머리 위 표시는 쌓인 말이 있으니 저절로 뜬다. notice 알림을 띄우고 remind 마다(대화창이 닫혀 있을 때) 다시 알린다.
     돌려주는 cancel() — 자동 플레이처럼 듣지 않고 넘어갈 때 쌓인 말과 알림을 걷는다. */
  function call(name, lines, opts) {
    name = normName(name); opts = opts || {};
    const token = { name, done: false, remind: null, gathered: [].concat(opts.gathered || []) };
    /* 48차: onSaid — 그 줄을 다 들은 순간(다음 줄로 넘어가기 직전). 사원증을 준 최주임이 그때 문으로 나간다 */
    const items = (lines || []).filter((l) => l && l.text).map((l) => ({ text: String(l.text), who: normName(l.who || name), role: l.role, onSaid: l.onSaid || null, call: true, token }));
    if (!name || !items.length) { token.done = true; if (opts.onHeard) { try { opts.onHeard(); } catch (e) { console.warn(e); } } return { cancel() {}, heard: () => true }; }
    items[items.length - 1].onHeard = opts.onHeard || null;
    (pending[name] = pending[name] || []).push(...items);
    noticed[name] = true;
    refresh();
    const say = () => { if (!token.done && opts.notice && typeof toast === 'function') toast(opts.notice, null, 5200, 'cust'); };
    say();
    if (opts.remind) token.remind = setInterval(() => { if (token.done) { clearInterval(token.remind); return; } if (!boxOpen) say(); }, opts.remind);
    return {
      heard: () => token.done,
      cancel() { token.done = true; clearInterval(token.remind);
        const q = pending[name]; if (q) { pending[name] = q.filter((x) => x.token !== token); if (!pending[name].length) delete pending[name]; }
        refresh(); }
    };
  }

  /* 대화를 닫는다(Esc) — 떠 있는 것과 줄 선 것을 모두 걷는다 */
  function close() {
    /* 3D 연출이 선택을 기다리는 중이면 닫지 않는다 — 닫으면 3D 가 영영 기다린다 */
    if (showing && showing.item.mirror) return;
    flushTo = seq;
    if (sess) sess.closed = true;
    if (showing) showing.end();
    const s = sess; if (s) end(s);
    maybeClose();
  }

  /* ---------- 말풍선·알림 경로를 대화로 돌린다 ----------
     core.js 의 bubble()·sayNpc() 는 3D 말풍선 + 알림으로 흘려보냈다(대표 「말풍선 없애고」).
     core.js 는 다른 담당 파일이라 여기서 전역 이름을 갈아 끼운다(pc.js 가 travel 을 감싸는 방식과 같다). */
  global.sayNpc = function (who, text) { hear(who, text); return true; };
  global.bubble = function (who, text) { const n = normName(who); if (!seatByName(n)) return false; hear(n, text); return true; };
  wrapTravel();

  /* ---------- 키보드 ----------
     대사: 클릭·Enter·Space 로 넘긴다 / 선택지: 숫자키 / Esc 는 pc.js 가 Talk.close() 로 넘긴다.
     3D 창(iframe)에 포커스가 남아 있어도 받도록 그 창에도 붙인다(같은 출처). */
  function onKey(ev) {
    if (!boxOpen || !showing) return false;
    const t = ev.target; const tag = (t && t.tagName || '').toUpperCase();
    /* 글을 쓰는 중이면 가로채지 않는다. 다만 컴퓨터가 꺼져 안 보이는 작성 칸에 포커스만 남은 경우는 대화창 차례다 */
    if ((tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') && t.offsetParent !== null) return false;
    const it = showing.item; const hasOpts = !!(it.options && it.options.length);
    /* 글자가 찍히는 중이면 Enter·Space 는 「바로 다 보이기」— 한 번 더 누르면 넘어간다 */
    if (typer.item === it && (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space')) { ev.preventDefault(); typeFinish(true); return true; }
    if (!hasOpts && (ev.code === 'Enter' || ev.code === 'NumpadEnter' || ev.code === 'Space')) { ev.preventDefault(); showing.end(); return true; }
    if (hasOpts && /^(Digit|Numpad)[1-9]$/.test(ev.code)) { const n = +ev.code.slice(-1) - 1; if (n < it.options.length) { ev.preventDefault(); showing.end(n); return true; } }
    return false;
  }
  document.addEventListener('keydown', (ev) => { if (ev.repeat) return; onKey(ev); }, true);
  setInterval(() => {
    if (NO_STAGE) return; let w = null; try { w = $('stage').contentWindow; } catch (e) {}
    if (!w || !w.document || w.__talkKeys) return;
    try {
      w.__talkKeys = true;
      w.addEventListener('keydown', (ev) => {
        if (!boxOpen) return;
        if (ev.code === 'Escape') { ev.preventDefault(); ev.stopImmediatePropagation(); close(); return; }
        if (onKey(ev)) { ev.stopImmediatePropagation(); return; }
        /* 대화 중에는 3D 의 E·T·Space 가 새 행동을 시작하지 않게 막는다 */
        if (/^(KeyE|KeyT|Space|Enter)$/.test(ev.code)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
      }, true);
    } catch (e) {}
  }, 1000);
  /* 대사 칸을 누르면 넘어간다(선택지 단추 누름은 단추가 처리). 글자가 찍히는 중이면 먼저 다 보이게 한다 */
  { const bx = T.box(); if (bx) bx.addEventListener('click', (ev) => {
    if (!showing) return;
    if (ev.target && ev.target.closest && ev.target.closest('button,input')) return;
    if (typer.item === showing.item) { typeFinish(true); return; }
    if (showing.item.options && showing.item.options.length) return;
    showing.end(); }); }

  global.Talk = {
    choose: choose,
    npc: npc,
    tasks: tasksFor,
    hear: hear,
    reply: reply,
    hasPending: hasPending,
    anyPending: () => Object.keys(pending).some((k) => pending[k] && pending[k].length),
    pending: () => Object.fromEntries(Object.entries(pending).map(([k, q]) => [k, q.map((x) => x.text)])),
    call: call,
    norm: normName,
    chOf: chOf,   /* 48차: 이름 → 3D 모델 번호(오늘 데이터에 없으면 office CAST 에서). 없으면 '' */
    seatOf: seatOf,   /* 50차: 자리 또는 'visitor' — 말이 닿는가 */
    say: (who, text, opt) => sayLine(normName(who), text, Object.assign({ sess: sess }, opt || {})),
    begin: begin,
    end: end,
    stage: stage,
    idle: idle,
    isOpen: () => boxOpen || !!showing || !!(sess && sess.hold && !sess.closed),   /* 창이 열리기 전(말 거는 자리로 걸어가는 중)도 대화 중이다 */
    close: close,
    onSay: onSay,
    onChoose: onChoose,
    /* 3D 가 「말을 걸었다」고 알려 올 때 붙이는 자리 */
    onNpc: (info) => { if (!info) return; npc(info.name || npcBySeat(info.seat), info.seat, info.team); },
    /* 지금 T 로 마주 선 사람인가 — cards.js doVisit 가 3D 연출 대신 대화로 갈지 정한다 */
    here: (who, seat) => !!(sess && !sess.closed && sess.hold && ((who && normName(who) === sess.name) || (seat && seat === sess.seat))),
    /* 검사용 */
    typeHooks: typeHooks,   /* 2026-10-02: 글자 찍기 시작·한 글자·끝 — 입 움직임(office talkMouth)에 이어 둔 자리 */
    state: () => ({ open: boxOpen, typing: !!typer.item, showing: showing ? { who: showing.item.who, text: showing.item.text, options: (showing.item.options || []).map((o) => o.label) } : null, sess: sess ? { name: sess.name, seat: sess.seat, hold: sess.hold, cam: sess.cam } : null, jobs, pending: Object.keys(pending) })
  };
})(window);
