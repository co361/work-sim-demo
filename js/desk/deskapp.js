/* ==========================================================================
   PC 바탕화면 — 우리 게임과 co-work-sim 바탕화면을 잇는 얇은 판.

   `js/desk/` 의 나머지 넷(desktop.js · windows.js · appicon.js · wallpaper.js)은
   co-work-sim 원본을 **한 글자도 안 고치고** 복사한 것이다. 원본이 기대하는
   의존(OC.ui.toast · OC.join.loadTabSession · OC.app.hasDockApp)을 여기서 채우고,
   우리 앱 넷(메일함 · 사내 메신저 · 전화 메모 · 업무 노트)을 그 독·아이콘 체계에 얹는다.

   원본과 다른 점은 네 가지다.
     ① 앱 구성이 다르다 — 코치 피드백은 없고 전화 메모가 있다. 종류를 한 창에 섞지
        않는 것이 규칙이다(대표 "너무 산만해. 메신저와 이메일은 분리된 창에서").
     ② 앱 화면을 새로 그리지 않고 play.html 의 기존 패널(#inbox · #card · #side)을
        **창 안으로 옮겨 담는다.** 아이디가 그대로라 엔진(js/play/*.js)은 그대로 돈다.
     ③ 자리(방 코드·pid) 대신 팀 코드를 쓴다 — 바탕화면 아이콘을 옮겨 둔 자리가
        localStorage 에 팀별로 남는다(RTDB 없음, 원본도 여기는 localStorage 다).
     ④ **내 자리에 앉아야만 켜진다.** 대표 "본인 자리로 돌아가서 컴퓨터를 열 수 있어야
        하지 않을까?" — 아무 데서나 열리면 걸어 다닐 이유가 없어진다. 3D 가 앉았다고
        알려 줄 때(onSit)만 seated 가 참이 되고, 이동이 시작되면 거짓이 된다.
        3D 가 아예 없는 검사·저사양 모드(?stage=0)에서는 언제나 참이다.
   ========================================================================== */
(function (global) {
  'use strict';

  var OC = global.OC = global.OC || {};
  OC.ui = OC.ui || {}; OC.app = OC.app || {}; OC.join = OC.join || {};
  var $ = function (id) { return document.getElementById(id); };

  /* ── 1. 원본이 기대하는 의존을 채운다 ──────────────────────────────────
     없으면 desktop.js 가 console.info 를 남기고 조용히 넘어가지만, 채워 두면
     휴지통 사유·바탕화면 우클릭 메뉴가 실제로 말을 한다. */

  /* 긴 사유는 상단 알림 한 줄에 안 담긴다 — play.html 의 토스트로 낸다.
     인자 차례가 다르다: 원본은 (제목, 본문, 클래스), 우리 것은 (본문, 누가, ms, 클래스). */
  if (typeof OC.ui.toast !== 'function') {
    OC.ui.toast = function (title, body, cls) {
      if (typeof global.toast !== 'function') return;
      try { global.toast(String(body == null ? '' : body), String(title || ''), 5200, ''); }
      catch (e) {}
    };
  }
  /* 바탕화면 배치를 어느 자리에 저장할지 정하는 값. 원본은 방 코드 + 자리 번호이고
     우리는 방이 없으니 팀 코드 + 일차를 쓴다. 못 읽으면 배치는 화면에만 산다. */
  if (typeof OC.join.loadTabSession !== 'function') {
    OC.join.loadTabSession = function () {
      var S = global.S;
      if (!S) return null;
      return { roomCode: 'worksim-' + (S.team || 'demo'), playerId: String(S.day || 1) };
    };
  }
  /* 강사 관제 앱(`host-` 접두사)은 우리 화면에 없다 — 언제나 false 가 정답이다.
     windows.js 의 작업표시줄 중복 방지가 학생 독은 OC.ui.desktop.hasDockApp 에
     따로 물으므로 이쪽이 false 라고 잃는 것이 없다. */
  if (typeof OC.app.hasDockApp !== 'function') {
    OC.app.hasDockApp = function () { return false; };
  }
  if (typeof OC.app.dockIconKeyFor !== 'function') {
    OC.app.dockIconKeyFor = function () { return null; };
  }

  /* ── 2. 앱 둘 ─────────────────────────────────────────────────────────
     창 아이디는 desktop.js 가 'app-' + id 로 만든다. windows.js 의 WIN_ICON_KEY 가
     `app-inbox` → mail · `app-rulebook` → book 을 이미 알고 있으므로, 독 왼쪽(앱)과
     오른쪽(열린 창)에서 **같은 그림**이 나오려면 아이디를 그 둘로 두어야 한다.
     크기는 co-work-sim 라이브와 같은 값이다(메일 820×600 · 사규집 720×640). */
  /* 창 넷을 **따로** 둔다 — 대표 "메신저와 이메일은 분리된 창에서 떴으면 좋겠고",
     "한 창 안에서 종류를 섞지 마라". 메일 · 메신저 · 전화 메모 · 업무 노트. */
  var MAIL = 'inbox', NOTE = 'rulebook', MSG = 'messenger', TEL = 'phone';

  function stash() { return $('stash'); }

  /* 메일함 창 속: 왼쪽 목록(#inbox) + 오른쪽 읽기·작성(#card) */
  function mountMail(c) {
    c.id = 'mailApp';
    var lst = $('inbox'), card = $('card');
    if (lst) c.appendChild(lst);
    if (card) c.appendChild(card);
    /* 창에 들어가기 전까지는 보관함에 둔다 — 문서에서 빠지면 엔진의
       getElementById 가 패널을 못 찾는다. 기본 앱은 곧바로 창이 가져간다. */
    var s = stash(); if (s) s.appendChild(c);
  }
  /* 업무 노트 창 속: 힌트 · 사규집 · 조직도 · 진행 (기존 오른쪽 패널 그대로) */
  function mountNote(c) {
    c.classList.add('noteApp');
    c.style.cssText = 'display:flex;flex-direction:column;height:100%;min-height:0';
    var side = $('side'); if (side) c.appendChild(side);
    var s = stash(); if (s) s.appendChild(c);
  }

  /* 사내 메신저 창 속: js/desk/msgapp.js 가 그린다 */
  function mountMsg(c) {
    if (global.Msg && global.Msg.mount) { try { global.Msg.mount(c); } catch (e) {} }
    var s = stash(); if (s) s.appendChild(c);
  }
  /* 전화 메모 창 속: js/desk/telapp.js 가 그린다 */
  function mountTel(c) {
    if (global.Tel && global.Tel.mount) { try { global.Tel.mount(c); } catch (e) {} }
    var s = stash(); if (s) s.appendChild(c);
  }

  var APPS = [
    { id: MAIL, title: '📥 메일함', dockLabel: '메일', 'default': true,
      w: 820, h: 600, iconKey: 'mail', mount: mountMail },
    { id: MSG, title: '💬 사내 메신저', dockLabel: '메신저',
      w: 560, h: 620, iconKey: 'messenger', mount: mountMsg },
    { id: TEL, title: '☎ 전화 메모', dockLabel: '전화',
      w: 460, h: 520, iconKey: 'talk', mount: mountTel },
    /* 🔴 2026-09-29 — 업무 노트는 `note` 다. 사용자 승인 입체 아이콘 24종에 「업무 노트」 뜻의
       그림이 없어 **종전 벡터(펼친 책)를 그대로** 쓴다(appicon.js VEC_ALIAS note→book 벡터).
       `book` 키는 이제 뜻 그대로 「사규집(규정집 · 9번 그림)」이다 — co-work-sim 과 같은 뜻. */
    { id: NOTE, title: '📕 업무 노트', dockLabel: '업무 노트',
      w: 520, h: 640, iconKey: 'note', mount: mountNote }
  ];

  /* ── 3. 바탕화면 아이콘 ────────────────────────────────────────────────
     「내 자리에 놓인 자료」 — 업무 노트의 네 탭으로 곧장 들어가는 문이다.
     타일 키는 전부 appicon.js 에 있는 것만 쓴다(새로 그리지 않는다).
     🔴 2026-09-29 — 키를 **뜻**으로 고른다(사용자 승인 입체 아이콘 24종 적용).
        · 사규집 → `book`(9번 규정집 그림). 종전 `law` 는 co-work-sim 에서 「법무·계약」(16번)이라
          뜻이 어긋난다. 독의 업무 노트는 `note` 로 옮겼다(위 APPS).
        · 오늘 진행 → `log`(7번 진행 기록 그림).
        · 조직도(`org`)·사수 메모(`memo`) — 뜻이 맞는 그림이 없어 **종전 벡터 그대로**
          (appicon.js VEC_ALIAS: org → 옛 data 표 · memo → 옛 doc 쪽지). 가장 가까운 그림을
          억지로 붙이지 않는다. */
  var FILES = [
    { name: '사규집',    tile: 'book', icon: '📕', note: '규정·조항을 찾아본다', tab: 'rule', unlock: 'rulebook' },
    { name: '조직도',    tile: 'org',  icon: '🗂', note: '누구에게 넘길지 본다',  tab: 'org',  unlock: 'orgchart' },
    { name: '오늘 진행', tile: 'log',  icon: '📋', note: '처리한 것과 남은 것',   tab: 'prog' },
    { name: '사수 메모', tile: 'memo', icon: '📝', note: '사수가 남긴 한 줄',     tab: 'hint' }
  ];

  /* ── 권한 단계 ────────────────────────────────────────────────────────
     상단 바 자물쇠(renderUnlocks)와 업무 노트 탭은 이미 막고 있었는데 바탕화면
     아이콘만 그냥 열렸다. 같은 값(오늘 화 데이터의 unlock 배열)을 여기서도 본다.
     게임 쪽 상수는 window.UNLOCK_DAY·UNLOCK_LABEL 에 없다(스크립트 스코프) —
     읽지 못할 때를 대비해 같은 표를 여기에도 둔다. */
  var LOCK_DAY = { rulebook: 2, approval: 3, orgchart: 4, report: 5, decide: 7 };
  function unlocked(key) {
    if (!key) return true;
    try {
      var list = (global.__play && global.__play.data) ? (global.__play.data().unlock || null) : null;
      if (!list) return true;                       /* 아직 하루가 안 열렸으면 막지 않는다 */
      return list.indexOf(key) >= 0;
    } catch (e) { return true; }
  }
  function lockMsg(f) { return f.name + '은 ' + (LOCK_DAY[f.unlock] || '다음 ') + '일차에 열립니다.'; }

  function openNoteTab(tab) {
    openPc();
    openApp(NOTE);
    if (typeof global.showTab === 'function') { try { global.showTab(tab); } catch (e) {} }
  }
  function deskFiles() {
    return FILES.map(function (f) {
      var lock = !unlocked(f.unlock);
      return { name: f.name, tile: f.tile, icon: f.icon,
        note: lock ? (LOCK_DAY[f.unlock] + '일차에 열린다') : f.note,
        open: function () {
          if (!unlocked(f.unlock)) {
            if (typeof global.toast === 'function') global.toast(lockMsg(f), '🔒', 4200, 'cust');
            return;
          }
          openNoteTab(f.tab);
        } };
    });
  }
  /* 잠긴 아이콘은 흐리게 + 자물쇠 배지. setFiles 가 그린 뒤에 덧입힌다
     (원본 desktop.js 는 「잠김」이라는 개념을 모른다 — 파일을 고치지 않는다). */
  function paintLocks() {
    var host = $('dtIcons');
    if (!host) return;
    FILES.forEach(function (f, i) {
      var el = host.querySelector('.dt-icon[data-oc-idx="' + i + '"]');
      if (!el) return;
      var lock = !unlocked(f.unlock);
      el.classList.toggle('locked', lock);
      if (lock) {
        el.title = lockMsg(f);
        el.setAttribute('aria-label', f.name + ' — 잠김 · ' + lockMsg(f));
      }
    });
  }

  /* ── 4. 켜고 끄기 ─────────────────────────────────────────────────────
     desktop.js 는 「무엇을 어떻게 그리는가」만 안다. 화면을 켜고 끄는 것은
     우리 몫이다 — 3D 사무실 위에 덮이는 화면이라 원본에는 없던 개념이다. */
  var mounted = false;

  function mount() {
    if (mounted) return;
    var D = OC.ui.desktop;
    if (!D || typeof D.mountStudentDesktop !== 'function') return;
    mounted = true;
    /* 배경을 **먼저** 깐다. mountStudentDesktop 은 맨 앞에서 재진입 방지로
       unmount 를 부르는데 그때 keepWall 이라 배경이 살아남는다(원본 주석 참조). */
    if (OC.wall && typeof OC.wall.mount === 'function') {
      try { OC.wall.mount({ isHost: true }); } catch (e) {}
      /* 벽지의 평균색을 바탕 상자에도 옮긴다. 사진이 아직 안 내려온 첫 프레임의
         색이자, 흰 아이콘 이름이 무엇 위에 앉는지의 정직한 근사값이다 —
         `#wallpaper` 는 아이콘의 조상이 아니라서(형제다) CSS 로는 못 닿는다.
         벽지를 다른 사진으로 바꿔도 여기가 따라온다(숫자를 두 곳에 안 적는다). */
      try {
        var wp = $('wallpaper'), env = $('deskEnv');
        var avg = wp && wp.style ? wp.style.backgroundColor : '';
        if (avg && env) env.style.backgroundColor = avg;
      } catch (e2) {}
    }
    var s = OC.join.loadTabSession() || {};
    D.mountStudentDesktop({ pid: s.playerId || null, apps: APPS });
    try { D.setFiles(deskFiles()); paintLocks(); lockSig = FILES.map(function (f) { return unlocked(f.unlock) ? '1' : '0'; }).join(''); } catch (e2) {}
    wireDockClock();
  }

  /* 독 시계 — desktop.js 가 그리는 마지막 아이콘이다. 원본은 상단바의
     `#gameClock` 을 튕기는데 우리 상단 시각은 `#clock` 이다. 원본 파일을 고치는
     대신 여기서 **리스너를 하나 더 얹는다**(원본 것은 그대로 두고 아무 일도 안 한다). */
  function wireDockClock() {
    var b = document.querySelector('#dockApps .dock-app[data-label="시계"]');
    if (!b || b._wsClock) return;
    b._wsClock = true;
    b.addEventListener('click', function () {
      var c = $('clock');
      if (c && c.animate) {
        c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }],
          { duration: 420 });
      }
    });
  }

  function isOpen() { var pc = $('pc'); return !!(pc && pc.classList.contains('on')); }

  /* 하루가 바뀌면 열린 앱이 달라진다 — 자물쇠 구성이 바뀐 때만 다시 그린다
     (아이콘을 매번 새로 그리면 끌어다 놓은 자리가 깜빡인다). */
  var lockSig = null;
  function refreshLocks() {
    var D = OC.ui.desktop;
    if (!mounted || !D) return;
    var sig = FILES.map(function (f) { return unlocked(f.unlock) ? '1' : '0'; }).join('');
    if (sig === lockSig) return;
    lockSig = sig;
    try { D.setFiles(deskFiles()); paintLocks(); } catch (e) {}
  }

  /* ── 내 자리에 앉아 있는가 ────────────────────────────────────────────
     3D 가 `onSit` 으로 알려 주면 참, 이동이 시작되면 거짓(js/play/pc.js 가 넣는다).
     3D 가 없으면(검사·저사양) 언제나 참이다 — 거기서는 걸어 다닐 방 자체가 없다. */
  var seated = false, seatKnown = false;
  function setSeated(v) {
    seatKnown = true;
    v = !!v;
    if (v === seated) return;
    seated = v;
    if (!v) closePc();                       /* 자리를 뜨면 화면이 따라 꺼진다 */
    if (typeof global.onSeatChange === 'function') { try { global.onSeatChange(v); } catch (e) {} }
  }
  function isSeated() { return seatKnown ? seated : !hasOffice(); }
  function hasOffice() {
    try { return typeof global.office === 'function' && !!global.office(); } catch (e) { return false; }
  }

  function openPc(force) {
    if (!force && !isSeated()) {
      if (typeof global.toast === 'function') global.toast('내 자리에 앉아야 컴퓨터를 쓸 수 있어요.', '', 3600, 'cust');   // 🖥 는 뜻 맞는 그림이 없어 뺐다(2026-09-29)
      return false;
    }
    mount();
    refreshLocks();
    var pc = $('pc'); if (!pc) return false;
    if (pc.classList.contains('on')) return true;
    pc.classList.add('on');
    document.body.classList.add('pc-on');
    var hint = $('pcHint'); if (hint) hint.classList.remove('on');
    /* 켜지기 전에는 #winLayer 도 #dtIcons 도 상자가 0×0 이라 창 좌표와 아이콘 칸이
       정해지지 않는다. 보이게 된 다음에 한 번 다시 잡는다 — 아이콘 쪽은
       ResizeObserver 도 같은 일을 하지만 첫 프레임을 기다리게 하지 않는다. */
    try { if (OC.ui.reflowWins) OC.ui.reflowWins(); } catch (e) {}
    try { if (OC.ui.desktop && OC.ui.desktop.relayoutIcons) OC.ui.desktop.relayoutIcons(); } catch (e2) {}
    return true;
  }
  function closePc() {
    var pc = $('pc'); if (!pc) return;
    pc.classList.remove('on');
    document.body.classList.remove('pc-on');
  }
  function toggle() { if (isOpen()) closePc(); else openPc(); }

  /* 앱을 연다(이미 열려 있으면 앞으로 — openWin 이 그렇게 판정한다). */
  function openApp(id) {
    if (!isSeated()) return false;
    mount();
    var D = OC.ui.desktop;
    if (!D || typeof D.openApp !== 'function') return false;
    return D.openApp(id === 'note' ? NOTE : id === 'mail' ? MAIL : id === 'msg' ? MSG : id === 'tel' ? TEL : id);
  }
  function setBadge(id, n) {
    var D = OC.ui.desktop;
    if (D && typeof D.setBadge === 'function') D.setBadge(id === 'mail' ? MAIL : id, n);
  }

  /* 사무실에서 컴퓨터가 열리는 두 길 — 둘 다 하는 일은 같다.
       ① 내 자리에 앉으면(3D 의 onSit) 바로 바탕화면이 뜬다 — 대표 "앉으면 바로".
       ② 모니터를 누르면 뜬다(onScreenClick).
     3D 쪽에 아직 없는 신호는 조용히 건너뛴다. 그때는 상단 「PC」 단추와 안내 띠가
     같은 일을 한다. PC 를 닫아도 3D 는 앉은 자세 그대로다 — 여기서 일어서게 하지
     않는다(docs/office-api-requests.md 「onSit」·「leadVisit」 참고). */
  function bindScreen(officeGetter) {
    var tries = 0;
    var boundSit = false, boundClick = false;
    var iv = setInterval(function () {
      tries++;
      var O = null;
      try { O = officeGetter(); } catch (e) { O = null; }
      if (O) {
        if (!boundSit && typeof O.onSit === 'function') {
          boundSit = true;
          try { O.onSit(function () { setSeated(true); openPc(true); }); } catch (e2) {}
        }
        if (!boundClick && typeof O.onScreenClick === 'function') {
          boundClick = true;
          try { O.onScreenClick(function () { setSeated(true); openPc(true); }); } catch (e3) {}
        }
        if (boundClick) { clearInterval(iv); return; }
      }
      if (tries > 200) clearInterval(iv);
    }, 500);
  }

  global.Desk = {
    mount: mount,
    open: openPc,
    close: closePc,
    toggle: toggle,
    isOpen: isOpen,
    openApp: openApp,
    setBadge: setBadge,
    bindScreen: bindScreen,
    refreshLocks: refreshLocks,
    setSeated: setSeated,
    isSeated: isSeated,
    /* 독의 실행 중 점은 desktop.js 가 스스로 켜고 끈다 — 부르는 쪽 호환용이다. */
    markRunning: function () {},
    MAIL: MAIL, NOTE: NOTE, MSG: MSG, TEL: TEL
  };
})(window);
