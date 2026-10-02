/* =====================================================
   Office Co-op — desktop.js  (OC.ui.desktop)
   Student game desktop launcher. Turns the static 3-column
   #panes mockup into real windows driven by the existing
   window manager (OC.ui.openWin/focusWin/closeWin/…).

   This module is game-agnostic: it never touches firebase or
   game state. Callers hand it apps of the shape
     { id, title, dockLabel, default?:bool, icon?:string,
       w?:number, h?:number, mount:(container)=>void }
   and desktop.js owns only the windowing + dock wiring.
   w/h 는 그대로 openWin 으로 넘어간다(안 주면 WM 기본값 620×520).

   Public API (OC.ui.desktop):
     mountStudentDesktop(ctx)   ctx.apps = [app, …]
     unmountStudentDesktop()
     openApp(id) -> bool        프로그램적으로 앱 창을 연다(이미 열려 있으면 앞으로)
     setBadge(id, n)            독 아이콘의 「안 읽은 개수」 배지 (0 이면 지운다)
     hasDockApp(winId) -> bool  windows.js 의 작업표시줄 중복 방지가 부른다
     iconKeyOf(winId) -> key    앱 창의 아이콘 키(독과 같은 값) — windows.js 가 부른다

   Reuses (never reimplements) the WM in windows.js:
     openWin(id,title,node,opts) — traffic-lights (.win-x close,
       .win-min minimize, .win-max max), title-bar drag, edge
       snap, focus z-order, resize are ALL provided there.
     focusWin(id) — un-minimizes + brings to front.
     closeWin(id) — with opts.keep stashes node + calls opts.onClose.

   WM ids are namespaced 'app-'+id (e.g. app-inbox) so they never
   collide with shell.js demo windows.
===================================================== */
window.OC = window.OC || {}; OC.ui = OC.ui || {};

(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  // Guarded call into the window manager (windows.js). Returns its result
  // or undefined if the WM has not loaded (keeps this file load-safe).
  function wm(fnName, args) {
    var fn = OC.ui[fnName];
    if (typeof fn === 'function') {
      try { return fn.apply(OC.ui, args); }
      catch (e) { console.warn('[desktop] OC.ui.' + fnName + ' threw:', e); }
    } else {
      console.info('[desktop] OC.ui.' + fnName + ' not available — window manager (windows.js) not loaded?');
    }
    return undefined;
  }

  // --- launcher state (closure-scoped; not leaked as globals) ---
  var apps = {};        // id -> app spec {id,title,dockLabel,default,icon,mount}
  var order = [];       // app ids in mount order (dock order)
  var appNode = {};     // id -> content node (persisted across close/reopen)
  var openState = {};   // id -> bool (is an 'app-'+id window currently open)
  var dockBtn = {};     // id -> dock <button> element (for running-dot toggle)
  var badgeN = {};      // id -> 안 읽은 개수(0/없음이면 배지를 그리지 않는다)

  function winId(id) { return 'app-' + id; }

  /* 이 창을 **학생 독의 앱 아이콘이 이미 대표하고 있는가.**
     windows.js 의 작업표시줄(#tbWins)이 중복 아이콘을 막을 때 부른다.

     🔴 2026-08-14 — 오너 화면에 같은 아이콘이 독에 두 번 서 있었다. windows.js 는
        OC.app.hasDockApp 만 물었는데 그것은 `host-` 접두사(강사 관제 앱)만 본다.
        학생 독(#dockApps)은 이 파일이 따로 그리므로 저쪽 판정에 걸릴 수가 없었고,
        학생이 앱을 열 때마다 왼쪽 앱 칸과 오른쪽 창 칸에 같은 것이 두 번 떴다.
     ⚠️ 아이콘 유무가 아니라 **등록 여부**로 판정한다 — main.js 에서 아이콘을
        비웠을 때 중복 방지가 조용히 풀렸던 전례가 있다(host-loop S68b). */
  function hasDockApp(wid) {
    var k = String(wid || '');
    if (k.indexOf('app-') !== 0) return false;
    return !!apps[k.slice(4)];
  }
  /* 이 앱 창의 아이콘 키 — 독 버튼과 **같은 값**(app.iconKey). windows.js 가 최소화한
     창을 독 오른쪽에 세울 때 묻는다. 창 id 로 짐작한 표(WIN_ICON_KEY)만 보면 게임마다
     앱 구성이 다를 때 독과 창 칸의 그림이 갈린다(v2 의 `rulebook` 창은 「업무 노트」다). */
  function iconKeyOf(wid) {
    var k = String(wid || '');
    if (k.indexOf('app-') !== 0) return null;
    var app = apps[k.slice(4)];
    return app ? (app.iconKey || app.id || null) : null;
  }

  /* 🔴 학생별 배경은 `js/wallpaper.js`(`OC.wall`)가 한다 — 여기가 아니다.
     종전에는 `.wp-1`~`.wp-5` CSS 프리셋(`img/wp1~5.jpg`)을 붙이는 계통이 여기에도
     있었다. 둘 다 돌았지만 **인라인 style 이 클래스를 덮어** 화면에 나온 적이 없고,
     헤드리스 실측에서도 `wp*.jpg` 는 **한 번도 내려받히지 않았다**(2.1MB 사장).
     정본을 하나로 남긴다 — 배경을 바꾸려면 `wallpaper.js` 를 고쳐라. */
  /* #wallpaper 를 기본 상태로 되돌린다.
     🔴 2026-08-15: 종전에는 **`wp-*` 클래스만** 걷었다. 그런데 실제로 화면에 걸리는
        배경은 `js/wallpaper.js`(`OC.wall`)가 넣는 **인라인 style** 이다 — 인라인이
        클래스를 덮으므로 클래스만 지우면 **학생 배경이 그대로 남는다.**
        「학생 배경 제거 → 호스트/랜딩에 잔류 방지」라고 적어 둔 주석이 실제로는
        아무 일도 안 하고 있었다. 인라인까지 지운다.
     `wp-*` 제거는 남겨 둔다 — 옛 클래스가 붙은 화면이 남아 있을 수 있고 비용이 0이다. */
  function clearWallpaper() {
    var wp = $('wallpaper');
    if (!wp) return;
    var drop = [];
    for (var i = 0; i < wp.classList.length; i++) {
      if (/^wp-/.test(wp.classList[i])) drop.push(wp.classList[i]);
    }
    drop.forEach(function (c) { wp.classList.remove(c); });
    wp.style.backgroundImage = '';
    wp.style.backgroundColor = '';
    /* 🔴 `wallpaper.js` 가 남기는 **두 개의 표시**도 같이 걷는다.
       ① `#wallpaper[data-wall]` — 지금 어느 배경인가
       ② `<html>[data-wall-tone]` — 그 배경이 밝은가 어두운가. 상단바가 이 값으로
          자기 글자색을 고른다(theme.css). 안 지우면 학생 배경의 tone 이 강사
          화면·랜딩까지 따라간다. 배경 4장이 모두 dark 라 지금은 증상이 없지만,
          밝은 사진을 한 장 넣는 순간 상단바 글자가 배경에 묻는다. */
    if (wp.dataset) { try { delete wp.dataset.wall; } catch (e) { wp.removeAttribute('data-wall'); } }
    try {
      if (document.documentElement) document.documentElement.removeAttribute('data-wall-tone');
    } catch (e2) {}
  }

  // Derive a dock emoji: explicit app.icon wins, else the leading token of
  // the title ('📥 받은 메일함' -> '📥'), else a generic app glyph.
  /* 🔴 이것은 이제 **폴백**이다. 정본 그림은 ui/appicon.js 의 인라인 SVG 타일이고
     (app.iconKey), 모르는 키이거나 그리지 못할 때만 여기로 떨어진다. */
  function iconFor(app) {
    if (app.icon) return app.icon;
    var t = (app.title || '').trim();
    if (t) {
      var first = t.split(/\s+/)[0];
      if (first) return first;
    }
    return '🗔';
  }

  /* 앱 아이콘을 버튼에 그린다 — 학생 독·관제 독·열린 창이 **같은 함수**를 쓴다.
     appicon 이 아직 안 실려도 화면은 뜬다(그림 문자). */
  function paintIcon(el, key, emoji) {
    var A = OC.ui && OC.ui.appicon;
    if (A && typeof A.paint === 'function') return A.paint(el, key, emoji);
    el.textContent = emoji || '🗔';
    return false;
  }

  function setRunning(id, on) {
    var b = dockBtn[id];
    if (b) b.classList.toggle('running', !!on);
  }

  // 독 말풍선·스크린리더에 쓰는 앱 이름(renderDock 과 배지가 같은 값을 쓴다).
  function labelOf(id) {
    var app = apps[id] || {};
    return app.dockLabel || app.title || id;
  }

  /* ---- 독 배지(안 읽은 개수) ----------------------------------------------
     macOS 독의 빨간 원과 같은 자리(아이콘 오른쪽 위)다.

     ⚠️ 왜 인라인 스타일인가 — app.css 의 `.dock-app` 은 가상 요소를 이미 다 쓰고
        있다(::after = 이름 말풍선 + 실행 중 점). 배지를 CSS 로 붙이려면 그 파일을
        고쳐야 하는데, 이 작업은 CSS 를 건드리지 않기로 한 범위다. 진짜 자식
        <span> 을 넣으면 가상 요소 충돌 없이 얹힌다.
     🔴 2026-08-15 — 독이 밝은 유리로 바뀌면서 두 가지가 어긋났다.
        ① 빨강 #ff3b30 위의 흰 숫자는 3.96:1 이었다. 11px 은 「큰 글자」가 아니라
           AA 하한이 4.5:1 이다 — 종전 주석의 "4.0:1 이면 된다"는 오독이었다.
           #d70015(theme.css --t-bad 와 같은 값)로 내리면 흰 숫자와 **5.38:1**.
        ② 원과 독 바닥의 경계: 밝은 유리(합성색 rgb(148,148,148)~흰색) 위에서
           흰 테두리는 흰 유리와, 빨간 원은 어두운 유리와 각각 붙어 보일 수 있다.
           두 경계 중 **하나는 반드시** 3:1 을 넘는다 —
             벽지가 어두울 때(유리 rgb148): 흰 테두리 대 유리 3.04:1
             벽지가 밝을 때(유리 흰색)  : 빨간 원 대 유리 5.38:1 */
  /* 🔴 2026-08-15 — 독이 작아지면(아이콘 46 → 40px) 18px 배지가 상대적으로 커진다.
     배지/아이콘 비율을 그대로 유지한다: 18/46 = 39%  →  16/40 = 40%.
     글자는 11px 그대로다(원 안에 세로로 앉히려고 line-height 만 16px 로 내렸다).
     **색은 건드리지 않는다** — #d70015 위 흰 숫자 5.38:1 이 그대로 유지돼야 한다
     (11px 은 「큰 글자」가 아니라 AA 하한이 4.5:1 이다). */
  var BADGE_CSS = 'position:absolute;top:-1px;right:-1px;min-width:16px;height:16px;' +
    'padding:0 4px;box-sizing:border-box;border-radius:8px;background:#d70015;color:#fff;' +
    'font:700 11px/16px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
    'text-align:center;letter-spacing:0;' +
    /* 흰 테두리 안쪽 + 어두운 테두리 바깥쪽. 독 유리가 벽지를 빨아들여 밝게도
       중간톤으로도 나오는데, 흰 테두리만 두면 밝은 유리 위에서 원이 유리에
       녹는다. 두 겹이면 어느 쪽 유리에서든 한 겹은 3:1 위에 남는다. */
    'box-shadow:0 0 0 1.5px rgba(255,255,255,.92),0 0 0 2.5px rgba(0,0,0,.5);' +
    'pointer-events:none';

  // badgeN[id] 를 실제 DOM 에 반영. 독이 아직 안 그려졌으면 renderDock 이 다시 부른다.
  function paintBadge(id) {
    var b = dockBtn[id];
    if (!b) return;
    var n = badgeN[id] || 0;
    var el = b.querySelector('.dock-badge');
    if (!n) {
      if (el) el.parentNode.removeChild(el);
      b.setAttribute('aria-label', labelOf(id));
      return;
    }
    if (!el) {
      el = document.createElement('span');
      el.className = 'dock-badge';
      el.setAttribute('style', BADGE_CSS);
      b.appendChild(el);
    }
    // 세 자리부터는 원이 아이콘보다 넓어진다. 정확한 수는 앱 안에서 읽는다.
    el.textContent = n > 99 ? '99+' : String(n);
    // 빨간 원은 눈에만 보인다 — 스크린리더에도 개수를 읽힌다.
    b.setAttribute('aria-label', labelOf(id) + ' — 안 읽음 ' + n + '건');
  }

  /* 공개: 안 읽은 개수를 세팅한다. 개수를 **세는 것은 호출자 몫**이다 —
     desktop.js 는 게임 상태를 모르고, 알면 안 된다(리스너도 여기서 안 건다). */
  function setBadge(id, n) {
    n = Math.max(0, Math.floor(Number(n) || 0));
    badgeN[id] = n;
    paintBadge(id);
  }

  // Called by the WM (via opts.onClose) when a window closes for ANY reason
  // — traffic-light ✕, unmount, etc. Keeps dock + state in sync.
  function markClosed(id) {
    openState[id] = false;
    setRunning(id, false);
  }

  /* Open (or first-time show) an app's window from its persisted node.
     여러 번 불러도 안전하다 — openWin 이 같은 id 의 창이 있으면 새로 만들지 않고
     focusWin 으로 앞에 세운다(최소화돼 있으면 같이 펼친다). 그래서 이 함수가
     프로그램적 「앱 열기」의 정본이다: 열려 있으면 앞으로, 아니면 연다. */
  function openApp(id) {
    var app = apps[id];
    var node = appNode[id];
    // 조용히 실패하면 부르는 쪽이 "왜 안 열리지"로 한참 헤맨다.
    if (!app || !node) { console.warn('[desktop] openApp: 등록되지 않은 앱', id); return false; }
    wm('openWin', [winId(id), app.title, node, {
      /* 창 크기는 **앱이 정한다.** 코치 피드백처럼 글이 긴 앱은 인박스만 한
         창에서는 읽히지 않는다. 안 주면 undefined 가 넘어가 windows.js 의
         기본값(620×520)이 그대로 쓰이므로, 기존 앱의 크기는 1px 도 안 변한다. */
      w: app.w, h: app.h,
      keep: true,                         // stash node on close so state survives
      onClose: function () { markClosed(id); }
    }]);
    openState[id] = true;
    setRunning(id, true);
    return true;
  }

  // Dock icon click: focus if open (focusWin auto-restores a minimized win
  // and raises it), otherwise open it. Clicking the dock never minimizes —
  // minimize is the yellow (–) traffic-light's job.
  function dockClick(id) {
    if (openState[id]) wm('focusWin', [winId(id)]);
    else openApp(id);
  }

  // Rebuild #dockApps with the student game's app icons + a clock. No printer.
  function renderDock() {
    var el = $('dockApps');
    if (!el) { console.info('[desktop] #dockApps missing — dock not rendered.'); return; }
    el.innerHTML = '';
    dockBtn = {};

    order.forEach(function (id) {
      var app = apps[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-app';
      // 이름은 CSS 말풍선(data-label)이 띄운다. title 속성을 같이 두면
      // 브라우저 기본 툴팁과 겹쳐 두 개가 뜬다 — shell.js 와 같은 규칙.
      var lbl = labelOf(id);
      b.setAttribute('data-label', lbl);
      b.setAttribute('aria-label', lbl);
      /* iconKey 는 앱이 준다(main.js 의 앱 목록). 없으면 id 를 그대로 써 본다 —
         'inbox'·'coach'·'messenger'·'rulebook' 중 앞의 셋은 파일명과 같다. */
      paintIcon(b, app.iconKey || app.id, iconFor(app));
      b.addEventListener('click', function () {
        try { dockClick(id); } catch (e) { console.warn('[desktop] dock click', id, e); }
      });
      if (openState[id]) b.classList.add('running');
      el.appendChild(b);
      dockBtn[id] = b;
      // 독을 다시 그려도 배지는 살아남아야 한다(개수는 badgeN 에 있다).
      paintBadge(id);
    });

    // Clock (harmless pulse of the menu-bar clock) — mirrors shell.js dock.
    var clock = document.createElement('button');
    clock.type = 'button';
    clock.className = 'dock-app';
    clock.setAttribute('data-label', '시계');
    clock.setAttribute('aria-label', '시계');
    paintIcon(clock, 'clock', '🕘');
    clock.addEventListener('click', function () {
      var c = $('gameClock');
      if (c && c.animate) {
        c.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.28)' }, { transform: 'scale(1)' }],
          { duration: 420 }
        );
      }
    });
    el.appendChild(clock);
  }

  /* ---- 창–독 틈 실측 점검 (개발용 경고, 화면에는 아무 영향 없음) ------------
     app.css 의 `#winLayer` 하단 inset(현재 64px)은 self-test(S20e)가 리터럴 px 를
     요구해 calc() 를 못 쓴다. 그래서 독 기하(app.css `:root` 의 --dock-* 값)와
     이 숫자가 **두 곳**에 적혀 있고, 실제로 어긋난 적이 있다 — 창 아래와 독
     사이에 배경만 보이는 28px 짜리 죽은 띠가 생겼다(2026-08-15 오너: "라인 딱 맞춰").
     여기서 한 번 재서 어긋나면 콘솔에 경고한다. RTDB 읽기·쓰기 0, 리스너 0. */
  var DOCK_GAP_MIN = 0, DOCK_GAP_MAX = 14;   // 창 아래와 독 위 사이 허용 범위(px)
  function checkDockGap() {
    try {
      var wl = $('winLayer'), tb = $('taskbar');
      if (!wl || !tb) return null;
      var a = wl.getBoundingClientRect(), b = tb.getBoundingClientRect();
      if (!a.height || !b.height) return null;      // 아직 안 그려진 화면이면 넘긴다
      var gap = Math.round(b.top - a.bottom);
      if (gap < DOCK_GAP_MIN || gap > DOCK_GAP_MAX) {
        console.warn('[desktop] 창 레이어와 독 사이가 ' + gap + 'px 다(허용 ' +
          DOCK_GAP_MIN + '~' + DOCK_GAP_MAX + 'px). app.css 의 #winLayer{inset} 과 ' +
          '#taskbar 의 --dock-* 값이 어긋났다.');
      }
      return gap;
    } catch (e) { return null; }
  }

  /* ---- public: mount ---- */
  function mountStudentDesktop(ctx) {
    ctx = ctx || {};
    var list = ctx.apps || [];

    // Idempotent: tear down any previous mount first.
    // 🔴 배경은 남긴다 — 바로 앞에서 OC.wall.mount() 가 깔아 둔 학생 배경이다.
    unmountStudentDesktop({ keepWall: true });

    apps = {}; order = []; appNode = {}; openState = {}; dockBtn = {}; badgeN = {};
    /* 바탕화면 배치를 어느 자리에 저장할지 정하는 값. unmount 다음에 넣는다 —
       위 unmountStudentDesktop() 이 이 값을 비운다. */
    deskCtx.pid = (ctx.pid === undefined || ctx.pid === null) ? null : String(ctx.pid);
    pinnedKey = null;   // 자리가 바뀌었을 수 있다 → 다음 setFiles 에서 다시 읽는다

    list.forEach(function (app) {
      if (!app || !app.id) { console.warn('[desktop] skipping app without id', app); return; }
      apps[app.id] = app;
      order.push(app.id);
      openState[app.id] = false;

      // Build the content container and let the caller render into it ONCE.
      var container = document.createElement('div');
      container.className = 'app-body';
      container.dataset.appId = app.id;
      try {
        if (typeof app.mount === 'function') app.mount(container);
      } catch (e) {
        console.warn('[desktop] app.mount threw for', app.id, e);
      }
      appNode[app.id] = container;   // held even while the window is closed
    });

    renderDock();

    // Open default apps immediately (focused); the rest stay stashed/closed.
    order.forEach(function (id) {
      if (apps[id]['default']) openApp(id);
    });

    /* 창이 놀 수 있는 상자(#winLayer)가 바뀌면 이미 열려 있던 창은 옛 상자 기준
       좌표에 남는다. 배포로 CSS 가 바뀐 직후가 정확히 그 상황이다.
       windows.js 가 주는 정리 함수를 한 번만 부른다(있을 때만 — 로드 순서 안전). */
    wm('reflowWins', []);
    checkDockGap();

    return { openApp: openApp, focusApp: function (id) { dockClick(id); }, setBadge: setBadge };
  }

  /* ---- public: unmount ---- */
  // Closes every app window and drops launcher references. Does NOT unsubscribe
  // the app components themselves — that stays main.js's responsibility.
  /**
   * @param {{keepWall?:boolean}} [opts] keepWall 이면 배경을 지우지 않는다.
   *   🔴 2026-08-18 — `mountStudentDesktop()` 이 맨 앞에서 재진입 방지로 이 함수를
   *   부르는데, 그때 배경까지 지우면 **바로 앞에서 깐 학생 배경이 사라진다.**
   *   `main.js` 는 `OC.wall.mount({pid})` 를 동기로 부르고(4610) 바탕화면은
   *   `identity.then()` 안에서 세운다(4680) — 그래서 **언제나** 지우는 쪽이 이겼다.
   *   증상: 사진 벽지가 안 뜨고 `app.css` 의 CSS 노을만 보인다.
   *   🔴 왜 여태 안 드러났나: 8차(2026-08-15)에 `clearWallpaper` 가 「인라인까지
   *   지우도록」 고쳐지기 전에는 클래스만 지워 **아무 일도 안 했다.** 그 고침이
   *   정확했기 때문에 이 충돌이 비로소 나타났다.
   *   지우는 것이 필요한 자리는 **진짜 떠날 때**(호스트·랜딩 복귀)뿐이고,
   *   그건 `main.js` 가 이 함수를 직접 부르는 경로다 — 거기서는 옵션을 안 준다. */
  function unmountStudentDesktop(opts) {
    order.forEach(function (id) {
      if (openState[id]) wm('closeWin', [winId(id)]);
    });
    if (!(opts && opts.keepWall)) clearWallpaper();   // 학생 배경 제거 → 호스트/랜딩에 잔류 방지
    apps = {}; order = []; appNode = {}; openState = {}; dockBtn = {}; badgeN = {};
    /* 격자에 걸어 둔 것도 같이 푼다 — 등록과 해제는 짝을 맞춘다(§5-4).
       옮겨 둔 자리는 localStorage 에 있으므로 다시 들어와도 그대로다. */
    teardownGrid();
    deskCtx.pid = null; pinnedKey = null; pinned = {};
  }

  /* ==========================================================================
   * 바탕화면 파일 — 「내 자리에 놓인 자료」
   * --------------------------------------------------------------------------
   * 🔴 2026-08-15 오너: "공통업무에 필요한 자료들은 각 팀원들 바탕화면에
   *    저장되어 있게 하자. 이거 너무 이렇게 되어 있으니까 보기 어렵다.
   *    그리고 규정집도 바탕화면에 있는 게 좋을 것 같다."
   *
   * 종전에는 `#dtIcons` 에 `shell.js` 의 **샘플 더미**(샘플 창·샘플 시트·샘플 문서)가
   * 들어 있었고, 학생 화면에서는 아예 숨겨져 있었다. 자리만 차지하고 아무것도
   * 아니었던 셈이다. 그 자리를 **실제로 그 학생에게 배부된 자료**로 채운다.
   *
   * 사무실 은유가 여기서 맞아떨어진다 — 내 자료는 내 바탕화면에 있고,
   * 남의 자료는 남의 바탕화면에 있어서 물어봐야 한다.
   *
   * 🔴 RTDB 를 읽지 않는다. 부르는 쪽이 이미 가진 것만 넘긴다.
   * ======================================================================== */
  /* ---- 바탕화면 앱 타일 --------------------------------------------------
     🔴 2026-08-15 오너: "아이콘 디자인 너무 맘에 안들고", "이런거 디자인도 다
        바꿔 디자인 맘에 안들어", "애플 아이콘 디자인들 참고해" (첨부: macOS 독 실물)

     ── 무엇이 문제였나 ──
     종전에는 이 자리에 인라인 SVG 4종(book/sheet/doc/frag, 합계 3,485바이트)이
     있었다. **단색 사각형 + 흰 글리프**뿐이라 깊이가 없었고, 더 나쁜 것은
     바탕화면 아이콘 7개 중 **5개가 거의 같은 「문서」 그림**이었다는 점이다 —
     구매 데이터·비용 자료·상담 기록·법무 메모·문서가 전부 frag/doc 한 장으로
     뭉개져, 오너 화면에서 서로 구분되지 않았다.

     ── 지금 ──
     그림은 `ui/appicon.js` 한 곳에서 나온다(**인라인 SVG**). 자료 조각은 제목에
     따라 data·cost·talk·law·frag 로 갈린다(`appicon.fragKey`). 독·관제 독·열린
     창도 **같은 파일**을 쓴다.

     ── 여기까지 세 번 갈아엎었다. 무엇이 틀렸었는지 남긴다 ──
     ① Meshy 생성 래스터 → 오너 "너무너무 안 이뻐". 생성 모델이 질감·광택을 넣고
        1024px 을 40px 로 줄이면 뭉갠다.
     ② 손으로 그린 SVG → 오너 "너무 구린데". **타일은 옳았다** — 실물 macOS 독
        스크린샷을 픽셀로 떠서 스퀘어클(|x|⁵+|y|⁵≤1)과 그라디언트 비율
        (위 = 아래 × V1.24 · S0.83)을 맞췄다. **틀린 것은 그 위의 글리프**다.
     ③ 지금 — 타일은 ②를 그대로 두고 **글리프만 Phosphor Icons `Fill`(MIT)** 로
        바꿨다. 40px 흰 글리프는 선 굵기로는 안 보여서 채움이 필수다.

     🔴 이 저장소의 디자인 규칙에 답이 이미 적혀 있었다:
        「**NEVER hand-roll SVG icons.** ... do not draw icon paths from scratch」
        두 번 반려된 이유가 한 줄로 적혀 있었고 우리는 그걸 어겼다.

     ── 폐기된 요구: 「벽지 양쪽에서 3:1」 ──
     한때 흰 벽지·검은 벽지 양쪽에서 실루엣 대비 3:1 을 요구했다. 한 색으로 양쪽을
     만족하는 상대휘도는 0.10~0.30 뿐이라 **브랜드색이 전부 탈락**하고, 그래서
     타일에 어두운 테두리를 둘러 검사를 통과시켰다 — 그것이 「싸구려」의 정체였다.
     실물 애플 타일 가장자리에는 안티에일리어싱 1px 말고 아무것도 없다.
     **요구를 폐기했고 `S68o` 가 어두운 윤곽선의 재발을 막는다.** 이름 글자는
     자기 판(plate)을 깔고 있어서 읽기는 그것이 책임진다.

     지킨 것
       - 크기는 여전히 **--dock-icon 한 곳**에서 나온다(app.css). 숫자를 안 만든다.
       - **이미지 요청 0건** · `appicon.js` brotli 9.2KB(그림만 재면 장당 806B).
       - MIT 허가문 전문이 `appicon.js` 머리말에 있다 — `S68t` 가 매번 확인한다.
       - 글자를 그리지 않는다 — 40px 에서 글자는 얼룩이 된다. 형태로만 말한다.
       - 모르는 키·로드 실패면 **그림 문자로 떨어진다**. */

  /* ==========================================================================
   * 바탕화면 격자 — 「칸에 맞춰 놓고, 끌어서 옮긴다」
   * --------------------------------------------------------------------------
   * 🔴 2026-08-15 오너: *"바탕화면에 아이콘들 정렬 맞춰서 위치 바꿀 수 있게"*
   *
   * ── 무엇이 문제였나 ──
   * 종전에는 `#dtIcons` 가 flex-wrap 이라 아이콘이 **화면 위쪽 한 줄**로만 흘렀다.
   * 창은 대개 화면 가운데를 차지하므로 그 줄이 통째로 창 뒤로 들어가 버렸고,
   * 학생이 자기 자료를 찾으려면 창을 치워야 했다.
   *
   * ── 지금 ──
   *  ① 맥처럼 **세로 우선**으로 채운다(위→아래, 넘치면 다음 칸). 창이 가운데를
   *     차지해도 왼쪽 기둥은 살아 있다.
   *  ② 끌면 **가장 가까운 칸에 달라붙는다.** 자유 배치가 아니다 — 30~50명이
   *     처음 쓰는 화면에서 자유 배치는 곧 흐트러진 화면이 된다.
   *  ③ 옮긴 자리는 **localStorage 에 방·자리별로** 남는다. 새로고침해도 그대로다.
   *
   * 🔴 RTDB 에 쓰지 않는다. 배치는 순전히 각자 화면의 문제라 방에 쓸 이유가 없고,
   *    CLAUDE.md §5-2 가 새 학생-쓰기 노드를 금지한다. 읽기도 0, 리스너도 0이다
   *    (여기서 다는 것은 화면 크기 관찰자 하나뿐이다).
   * 🔴 칸 기하를 여기서 만들지 않는다. app.css 의 `--dt-*`(전부 --dock-icon 파생)가
   *    만든 **실제 상자를 실측**해서 쓴다. 숫자가 두 곳으로 갈릴 자리를 없앤다.
   * ======================================================================== */

  var GRID_ON = 'dt-grid';       // #dtIcons 에 붙는 격자 모드 클래스(app.css)
  /* 이만큼 못 움직였으면 **클릭**이다. 끌기를 붙이면서 클릭이 죽는 것이 이
     기능의 전형적인 사고다 — 손이 떨리는 학생도 아이콘을 열 수 있어야 한다. */
  var DRAG_SLOP = 5;             // px
  var CLICK_MUTE_MS = 320;       // 끌어 놓은 직후의 click/dblclick 은 열기가 아니다
  var STORE_MAX = 12;            // localStorage 에 남길 방·자리 조합 수(옛 방 배치 청소)
  var STORE_PREFIX = 'oc.deskpos.';

  var deskCtx = { pid: null };   // mountStudentDesktop 이 채운다(자리 번호)
  var gridItems = [];            // [{key, el, file, cell:{c,r}, fixed?}] — 화면에 있는 아이콘
  var trashIt = null;            // 🗑 휴지통 항목(있으면 오른쪽 아래 칸 고정)
  var pinned = {};               // key -> [c,r]  **학생이 직접 옮긴 것만**(저장 대상)
  var autoCell = {};             // key -> [c,r]  자동 배치의 기억(저장하지 않는다)
  var pinnedKey = null;          // 지금 읽고 있는 localStorage 키
  var gridGeo = null;            // 마지막 실측 기하
  var lastDragEnd = 0;           // 끌기가 끝난 시각(클릭 판정용)
  var gridWired = false;         // 우클릭·크기변화 배선을 한 번만 건다
  var roObs = null;              // ResizeObserver (RTDB 와 무관)
  var relayoutReq = 0;

  function hasOwn(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function lstore() { try { return window.localStorage || null; } catch (e) { return null; } }

  /* 🔴 키를 **방·자리별로 가른다.** 한 브라우저로 여러 방을 오가는 일이 흔하다
     (강사 시연, 재접속, 교실 공용 PC). 키가 하나면 옛 방 배치가 새 방에 튀어나온다.
     방 코드는 이 탭의 세션에서 읽는다 — RTDB 를 읽지 않는다. */
  function seatOf() {
    var pid = deskCtx.pid, room = null, s = null;
    try {
      if (OC.join && typeof OC.join.loadTabSession === 'function') s = OC.join.loadTabSession();
    } catch (e) {}
    if (s) { room = s.roomCode || null; if (!pid) pid = s.playerId || null; }
    try {
      var st = OC.app && OC.app._state;
      if (st) { if (!room) room = st.roomCode || null; if (!pid) pid = st.pid || null; }
    } catch (e2) {}
    return (room && pid) ? { room: String(room), pid: String(pid) } : null;
  }
  function posKey() {
    var s = seatOf();
    return s ? (STORE_PREFIX + s.room + '.' + s.pid) : null;
  }

  /* 저장소에서 이 자리의 배치를 읽어 온다. 자리를 아직 모르면(입장 직후 등)
     아무것도 읽지 않고 화면 안에서만 산다 — 나중에 자리가 정해지면 다시 읽는다. */
  function syncStore() {
    var k = posKey();
    if (k === pinnedKey) return;
    pinnedKey = k;
    pinned = {};
    if (!k) return;
    var s = lstore(); if (!s) return;
    try {
      var o = JSON.parse(s.getItem(k) || 'null');
      var p = o && o.p;
      if (!p) return;
      for (var key in p) {
        if (!hasOwn(p, key)) continue;
        var v = p[key];
        if (v && v.length === 2 && isFinite(v[0]) && isFinite(v[1]) && v[0] >= 0 && v[1] >= 0) {
          pinned[key] = [v[0] | 0, v[1] | 0];
        }
      }
    } catch (e) { /* 깨진 값이면 그냥 기본 배치로 간다(fail open) */ }
  }

  // 옛 방·옛 자리의 배치가 무한정 쌓이지 않게 오래된 것부터 지운다.
  function prune(s, keep) {
    try {
      var rows = [], i, k, t;
      for (i = 0; i < s.length; i++) {
        k = s.key(i);
        if (!k || k.indexOf(STORE_PREFIX) !== 0) continue;
        t = 0;
        try { t = (JSON.parse(s.getItem(k)) || {}).t || 0; } catch (e) {}
        rows.push([t, k]);
      }
      if (rows.length <= STORE_MAX) return;
      rows.sort(function (a, b) { return a[0] - b[0]; });
      for (i = 0; i < rows.length - STORE_MAX; i++) {
        if (rows[i][1] !== keep) s.removeItem(rows[i][1]);
      }
    } catch (e) {}
  }

  function savePinned() {
    var k = pinnedKey || posKey();
    if (!k) return false;
    pinnedKey = k;
    var s = lstore(); if (!s) return false;
    var n = 0, key;
    for (key in pinned) { if (hasOwn(pinned, key)) n++; }
    try {
      if (!n) s.removeItem(k);
      else s.setItem(k, JSON.stringify({ v: 1, t: Date.now(), p: pinned }));
      prune(s, k);
      return true;
    } catch (e) {
      // 사파리 시크릿·용량 초과. 배치는 이 화면에서만 살고 새로고침하면 초기 배치다.
      console.info('[desktop] 배치를 저장하지 못했다(저장소 사용 불가) — 화면에만 남는다.');
      return false;
    }
  }

  /* ---- 격자 기하 실측 -------------------------------------------------------
     🔴 여기서 숫자를 만들지 않는다. app.css 의 --dt-*(전부 --dock-icon 파생)가
        만든 상자를 그대로 잰다: 밭의 여백·칸 사이(gap)·아이콘 한 칸의 크기.
        CSS 를 고치면 격자가 자동으로 따라온다.
     ⚠️ 밭이 안 보이면(관제 화면·오버레이에서 display:none) null 이다 —
        보이게 되는 순간 ResizeObserver 가 다시 부른다. */
  function measure() {
    var el = document.getElementById('dtIcons');
    if (!el || !el.classList.contains(GRID_ON) || !gridItems.length) return null;
    var box = el.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    var cs = window.getComputedStyle(el);
    if (cs.display === 'none') return null;
    var padL = parseFloat(cs.paddingLeft) || 0, padR = parseFloat(cs.paddingRight) || 0;
    var padT = parseFloat(cs.paddingTop) || 0,  padB = parseFloat(cs.paddingBottom) || 0;
    var gapX = parseFloat(cs.columnGap) || 0,   gapY = parseFloat(cs.rowGap) || 0;
    // 끌고 있는 아이콘은 확대돼 있다(.dragging) — 안 끌리는 것을 잰다.
    var probe = null, i;
    for (i = 0; i < gridItems.length; i++) {
      if (!gridItems[i].el.classList.contains('dragging')) { probe = gridItems[i].el; break; }
    }
    if (!probe) return gridGeo;
    var one = probe.getBoundingClientRect();
    if (!one.width || !one.height) return null;
    var fw = box.width - padL - padR, fh = box.height - padT - padB;
    return {
      padL: padL, padT: padT,
      cellW: one.width + gapX, cellH: one.height + gapY,
      cols: Math.max(1, Math.floor((fw + gapX) / (one.width + gapX))),
      rows: Math.max(1, Math.floor((fh + gapY) / (one.height + gapY)))
    };
  }

  /* ---- 배치 계산 -----------------------------------------------------------
     ① 학생이 옮겨 둔 자리를 먼저 잡는다(밭 안이고 비어 있을 때만).
     ② 직전에 자동으로 놓였던 자리를 그대로 쓴다 — **새 파일이 들어와도 남이
        움직이지 않는다.** 업무 카드가 도착하면 자료 조각이 늘어나는데, 그때마다
        아이콘이 우르르 밀리면 학생이 누르던 손이 빗나간다.
     ③ 남은 것만 빈 칸에 **세로 우선**으로 넣는다. */
  /* 🗑 휴지통이 앉는 칸 — **처음 자리는 맥과 같은 오른쪽 아래 구석**. 기하가
     바뀌면(창 크기, 전체화면) 같이 따라온다. 여기서 숫자를 만들지 않는다.
     🔴 2026-08-18 오너: *"휴지통은 위치가 고정되어 있어"* — 다른 아이콘은 다
        옮기는데 휴지통만 못 옮겼다. 이제 **다른 아이콘과 같은 규칙**으로 옮긴다:
        학생이 옮겨 두면 `pinned` 에 남고(같은 localStorage 키·같은 저장 경로),
        옮긴 적이 없으면 여기 구석이 그대로 기본값이다. 「🧹 아이콘 정렬하기」가
        `pinned` 를 비우므로 **되돌리는 길도 이미 있다.** */
  function trashCell(g) { return [g.cols - 1, g.rows - 1]; }
  /** 🗑 이 칸이 **지금** 휴지통이 앉아 있는 칸인가.
      🔴 고정 구석이 아니라 **현재 자리**로 판정한다 — 휴지통이 움직이므로,
         구석으로 재면 「빈 구석에는 못 놓고, 휴지통 자리에는 겹쳐 놓이는」
         정반대 결과가 난다. 아직 배치 전이면 기본 구석을 답으로 쓴다. */
  function isTrashCell(c, r) {
    if (!trashIt) return false;
    if (trashIt.cell) return c === trashIt.cell.c && r === trashIt.cell.r;
    var g = gridGeo || measure();
    if (!g) return false;
    var t = trashCell(g);
    return c === t[0] && r === t[1];
  }

  /* 🔴 다시 그릴 때는 **미끄러지면 안 된다.**
     `.dt-icon` 에 `transition:left/top .16s` 가 걸려 있다. 그건 학생이 끌어다
     놓았을 때 착 붙는 맛을 내려는 것인데, **첫 배치와 다시 그리기에도 발동한다.**
     실측(2026-08-15, 헤드리스): 휴지통이 그려진 뒤 오른쪽 아래 제자리로
     `left 516 → 874 → 1142 → 1252` 로 약 0.5초에 걸쳐 화면을 가로질러 갔다.
     바탕화면은 **업무 카드가 도착할 때마다** 다시 그려지므로(자료 조각이 늘어난다)
     수업 내내 아이콘이 흘러다니게 된다.
     → 자리를 코드가 정할 때는 애니메이션을 끄고, `moveTo`(학생이 옮긴 것)일 때만
       켠다. 끄는 방식은 클래스 한 개다 — 인라인 style 을 건드리면 CSS 의 정본이
       두 곳이 된다. */
  var animOnce = false;
  var NOANIM = 'dt-noanim';
  function layout() {
    var g = measure();
    if (!g) return false;
    gridGeo = g;
    /* 자리를 쓰기 **전에** 꺼야 한다. 쓴 뒤에 끄면 전환은 이미 시작돼 있다. */
    var box = document.getElementById('dtIcons');
    if (box && !animOnce) box.classList.add(NOANIM);
    var taken = {}, place = {}, i, it, cell;
    function free(c, r) { return !hasOwn(taken, c + ',' + r); }
    function take(key, c, r) { taken[c + ',' + r] = key; place[key] = [c, r]; }

    /* 🔴 휴지통 칸을 **맨 먼저** 잡는다. 격자는 이미 「빈 칸을 찾아 채우는」 구조라,
       칸 하나를 미리 taken 에 넣어 두면 나머지 배치 코드가 한 줄도 안 바뀌고
       휴지통을 피해 간다.
       🔴 옮길 수 있게 된 뒤에도 **먼저 잡는 것은 그대로다.** 학생이 옮겨 둔 자리가
          있으면 그 자리를, 없으면 기본 구석을 잡는다 — 어느 쪽이든 휴지통이
          자리를 먼저 정하므로 「놓는 자리」가 다른 파일에 밀려 흔들리지 않는다.
          (옮긴 자리가 화면 밖이면 — 창을 줄였다 — 기본 구석으로 돌아간다.) */
    if (trashIt) {
      cell = pinned[trashIt.key];
      if (!(cell && cell[0] < g.cols && cell[1] < g.rows)) cell = trashCell(g);
      take(trashIt.key, cell[0], cell[1]);
    }

    for (i = 0; i < gridItems.length; i++) {
      it = gridItems[i]; if (place[it.key]) continue;
      cell = pinned[it.key];
      if (cell && cell[0] < g.cols && cell[1] < g.rows && free(cell[0], cell[1])) {
        take(it.key, cell[0], cell[1]);
      }
    }
    for (i = 0; i < gridItems.length; i++) {
      it = gridItems[i]; if (place[it.key]) continue;
      cell = autoCell[it.key];
      if (cell && cell[0] < g.cols && cell[1] < g.rows && free(cell[0], cell[1])) {
        take(it.key, cell[0], cell[1]);
      }
    }
    var cur = 0, total = g.cols * g.rows;
    for (i = 0; i < gridItems.length; i++) {
      it = gridItems[i]; if (place[it.key]) continue;
      var got = null, c, r;
      while (cur < total) {
        c = Math.floor(cur / g.rows); r = cur % g.rows; cur++;
        if (free(c, r)) { got = [c, r]; break; }
      }
      /* 밭보다 파일이 많다 — 현실에서는 안 일어난다(1024×768 에서 40칸, 파일은
         많아야 열댓 개). 그래도 화면 밖으로 던지지는 않는다: 앞칸에 겹쳐 둔다. */
      if (!got) { var x = i % total; got = [Math.floor(x / g.rows), x % g.rows]; }
      take(it.key, got[0], got[1]);
    }

    for (i = 0; i < gridItems.length; i++) {
      it = gridItems[i]; cell = place[it.key];
      it.cell = { c: cell[0], r: cell[1] };
      if (!pinned[it.key]) autoCell[it.key] = [cell[0], cell[1]];
      it.el.style.left = (g.padL + cell[0] * g.cellW) + 'px';
      it.el.style.top = (g.padT + cell[1] * g.cellH) + 'px';
    }
    /* 씌운 클래스를 벗긴다. 벗기기 **전에** 한 번 강제로 재계산시켜야 한다 —
       안 그러면 브라우저가 「끄기 → 자리 쓰기 → 켜기」를 한 덩어리로 합쳐
       버려서 결국 미끄러진다. `offsetWidth` 읽기가 그 강제 재계산이다. */
    if (box) { void box.offsetWidth; box.classList.remove(NOANIM); }
    animOnce = false;
    return true;
  }

  /* 화면 크기 변화는 잦다 — 한 프레임에 한 번만 다시 잡는다.
     ⚠️ rAF 는 window 에서 떼어 부르면 안 된다(Illegal invocation). 반드시 window 로 부른다. */
  function relayoutSoon() {
    if (relayoutReq) return;
    relayoutReq = window.requestAnimationFrame
      ? window.requestAnimationFrame(function () { relayoutReq = 0; layout(); })
      : window.setTimeout(function () { relayoutReq = 0; layout(); }, 16);
  }

  /* 칸 옮기기. 이미 누가 있으면 **자리를 맞바꾼다** — 겹쳐서 하나가 사라지면
     학생은 파일이 지워졌다고 생각한다. */
  function moveTo(it, c, r) {
    /* 🗑 휴지통 **자리는 빼앗기지 않는다.** 다른 아이콘을 휴지통 칸에 겹쳐 놓으면
       놓는 자리가 사라진다 — 버리려던 학생이 겨눌 곳이 없어진다.
       ⚠️ 휴지통 **자신**이 그리로 가는 것은 막지 않는다(제자리 = 아무 일 없음). */
    if (it !== trashIt && isTrashCell(c, r)) return false;
    var from = it.cell, other = null, i;
    for (i = 0; i < gridItems.length; i++) {
      var o = gridItems[i];
      if (o !== it && o.cell && o.cell.c === c && o.cell.r === r) { other = o; break; }
    }
    /* 🗑 휴지통과는 **자리를 맞바꾸지 않는다.** 다른 아이콘을 휴지통 위에 놓는 것은
       「옮기기」가 아니라 「버리기」이고, 그 판정은 좌표로 이미 끝났다(finish·onDeskDrop).
       여기까지 온 것은 휴지통 옆을 겨눴다가 칸이 겹친 경우라 제자리로 돌린다.
       ⚠️ 반대 방향(휴지통이 다른 아이콘 칸으로 가는 것)은 맞바꾼다 — `it === trashIt`. */
    if (other && other === trashIt) return false;
    if (other && from) { pinned[other.key] = [from.c, from.r]; other.cell = { c: from.c, r: from.r }; }
    pinned[it.key] = [c, r];
    it.cell = { c: c, r: r };
    savePinned();
    /* 🔴 **학생이 옮긴 것만** 미끄러진다. 그래야 「내가 놓은 자리로 착 붙었다」가
       보이고, 카드가 도착해 다시 그릴 때는 아무것도 안 움직인다. */
    animOnce = true;
    return true;
  }

  // 놓은 자리에서 **가장 가까운 칸**을 고른다(밭 밖으로 나가면 가장자리 칸).
  function dropAt(it, left, top) {
    var g = gridGeo || measure(); if (!g) return;
    var c = Math.max(0, Math.min(g.cols - 1, Math.round((left - g.padL) / g.cellW)));
    var r = Math.max(0, Math.min(g.rows - 1, Math.round((top - g.padT) / g.cellH)));
    moveTo(it, c, r);
  }

  /* ==========================================================================
   * 🗑 휴지통에 버리기
   * --------------------------------------------------------------------------
   * 오너(2026-08-15): *"휴지통에 버릴 수 있게 휴지통 만들어줘"*
   *
   * 🔴 **버리기는 이 파일의 포인터 끌기와 네이티브 끌기 둘 다에서 받는다.**
   *    (2026-08-15 이전에는 포인터 끌기 하나뿐이었고, `wireDrag` 가 모든 아이콘의
   *     `dragstart` 를 막고 있어 「끌어다 메일에 첨부」가 아예 시작조차 못 했다.
   *     아래 「네이티브 끌기」 절이 그 사고와 해법을 적어 두었다.)
   * 🔴 **끌기 하나만으로는 안 된다.** 우클릭 메뉴 「🗑 휴지통으로 이동」과
   *    Delete 키가 같은 일을 한다(setFiles 안 keydown · ctxItems).
   * 🔴 **무엇이 버려지는지는 이 파일이 정하지 않는다.** 항목이 `canTrash`(버릴 수
   *    있는가) · `onTrash`(버리기) · `denyTrash`(못 버리는 사유)를 들고 온다.
   *    desktop.js 는 게임을 모르고, 알면 안 된다.
   * ======================================================================== */
  /* ✏️ 제자리 이름 바꾸기. 입력칸을 띄우고, 확정되면 `onRename` 에 넘긴다.
     ⚠️ **여기서 이름 규칙을 판정하지 않는다.** 규칙은 저장할 때 쓰는 것과 같아야
        하고(그쪽이 정본이다), 여기서 또 판정하면 「앱에서는 경고, 바탕화면에서는
        무경고」로 갈린다. 이 함수는 글자를 받아 넘길 뿐이다. */
  function startRename(nmEl, file) {
    if (!nmEl || nmEl.querySelector('input')) return;      // 이미 고치는 중
    var before = String(file.name || '');
    var inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'dt-rename';
    inp.value = before;
    inp.maxLength = 80;
    nmEl.textContent = '';
    nmEl.appendChild(inp);
    inp.focus();
    /* 확장자 앞까지만 고르게 — 학생이 `.xlsx` 를 지우는 사고를 줄인다. */
    var dot = before.lastIndexOf('.');
    try { inp.setSelectionRange(0, dot > 0 ? dot : before.length); } catch (e) {}

    var done = false;
    function finish(commit) {
      if (done) return;
      done = true;
      var val = String(inp.value || '').trim();
      nmEl.textContent = before;                            // 일단 원래대로 되돌린다
      if (!commit || !val || val === before) return;
      try { file.onRename(val); } catch (e) {
        console.warn('[desktop] onRename 실패', e);
      }
    }
    inp.onkeydown = function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
      else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      ev.stopPropagation();                                  // 바탕화면 단축키와 안 겹치게
    };
    inp.onblur = function () { finish(true); };
    inp.onclick = function (ev) { ev.stopPropagation(); };
  }

  function canTrash(it) {
    return !!(trashIt && it && it !== trashIt && it.file &&
      it.file.canTrash && typeof it.file.onTrash === 'function');
  }
  /* 🔴 상단바 알림(#notif)이 한 줄에 담는 글자 수. 300px ÷ 13.5px 한글 ≈ 22자.
     app.css 의 `#notif{max-width:300px}` 에서 나온 값이고, 넘으면 「…」로 잘린다. */
  var NOTIF_ONE_LINE = 22;
  /**
   * 휴지통 항목이 준 말하기 통로(main.js 의 알림). 없으면 조용히 넘어간다.
   * 🔴 2026-08-18 오너 스크린샷 — 「업무 카드가 준 자료라 버릴 수 없습니다 —
   *    버리면 그 업무를 못 합니다」가 상단바에서 **두 줄로 흘러 위아래가 잘렸다.**
   *    상단바는 26px 짜리 **상태 한 줄** 자리라 문단을 담는 그릇이 아니다
   *    (app.css `#notif` 주석 — 이제 한 줄로 자르고 「…」를 보인다).
   * 🔴 그런데 **이 문장은 학생이 반드시 읽어야 하는 것**이다(왜 못 버리는지).
   *    그래서 긴 사유는 **토스트로 같이 낸다** — 400px 폭에 줄바꿈이 되는
   *    그릇이라 문장이 통째로 읽힌다(ui/handoff.js 의 `.toast`).
   *    상단바에는 흔적이 남고, 읽히는 본문은 토스트에 있다.
   * ⚠️ 짧은 말(「휴지통이 비어 있습니다」 따위)은 상단바 한 줄로 충분하다 —
   *    같은 말을 두 곳에 띄우면 그것대로 소음이다. 길 때만 토스트를 얹는다.
   */
  function trashSay(msg, bad) {
    var f = trashIt && trashIt.file, s = String(msg == null ? '' : msg);
    if (f && typeof f.say === 'function') { try { f.say(s, bad); } catch (e) {} }
    if (s.length > NOTIF_ONE_LINE && OC.ui && typeof OC.ui.toast === 'function') {
      try {
        OC.ui.toast(bad ? '버리지 않았습니다' : '휴지통', s, bad ? 't-urgent' : 't-msg');
      } catch (e2) {}
    }
  }
  /* ── 놓기 판정의 정본 ─────────────────────────────────────────────────────
   * 🔴 **좌표만 보는 순수 함수 하나가 세 경로의 답을 정한다**
   *    (네이티브 `dragover` · 네이티브 `drop` · 포인터 끌기 `pointerup`).
   *    끌고 있는 아이콘이 커서 밑에 있어 `elementFromPoint` 를 쓸 수 없으므로
   *    상자를 직접 잰다. 화면을 모르므로 Node self-test 가 그대로 부른다(S99a).
   * ---------------------------------------------------------------------
   * 🔴 2026-08-16 3차 검수 — **가려진 휴지통을 어떻게 다룰 것인가**
   *    어제는 「창에 가려도 버려진다」로 통일했다(좌표 기준). 그 방향이 부러졌다:
   *    휴지통을 통째로 덮는 창을 열고 휴지통 중심에 파일을 놓으면 `trashed:true`
   *    인데 「받을게요」 강조(`drop-on`)는 창 밑에 깔려 **학생 눈에 안 보인다**.
   *    학생이 겪는 것은 「업무 처리 창 위에 파일을 올려놓았는데 파일이 사라졌다」다.
   *    알림은 상단바 한 줄이고 4초 뒤 사라지며, 되돌리기는 그 휴지통 창 **안**에
   *    있다 — 알림을 놓치면 되돌릴 길을 못 찾는다.
   *
   *    → **ⓐ 가려졌으면 버리지 않는다. 대신 반드시 사유를 말한다.**
   *      판단 근거: 두 실패의 무게가 다르다.
   *        · 안 버려짐 = 아이콘이 그대로 있는 것이 **즉시 눈에 보이고**, 사유
   *          알림이 다음 수단(창 옮기기 · 우클릭 메뉴)을 알려 준다. 되돌릴 것이
   *          없다.
   *        · 잘못 버려짐 = 학생이 몇 시간 쓴 보고서·표가 **소리 없이** 사라진다.
   *          창에 가려 휴지통도 강조도 못 봤으니 「내가 버렸다」는 자각조차 없다.
   *      실수로 보고서를 잃는 쪽이 무겁다. 그래서 안전한 쪽으로 기운다.
   *    🔴 어제 없앤 「조용한 무반응」이 돌아오지 않게 **말은 반드시 한다.**
   *      그래서 `dragover` 에서 `preventDefault()` 는 계속 부른다 — 안 부르면
   *      브라우저가 `drop` 자체를 내지 않아 말할 기회조차 없다. 받아 놓고
   *      거절하고 사유를 말하는 것이 여기서의 답이다.
   *    🔴 강조와 결과는 **항상 같은 답**이다. 가려졌으면 강조도 안 뜨고 버려지지도
   *      않는다(종전의 「강조는 안 보이는데 버려지기는 한다」가 가장 나쁜 조합이었다).
   *    · 반쯤 가려진 휴지통이면 **보이는 픽셀 위에 놓았을 때만** 버려진다.
   *      학생이 보는 것과 판정이 어긋나지 않는 유일한 기준이 그것이다.
   * ------------------------------------------------------------------- */
  /* ── 층 목록의 **정본 한 벌** ────────────────────────────────────────────
     🔴 2026-08-16 4차 검수 — 거의 같은 선택자 목록이 이 파일에 **세 벌** 있었다
        (`COVER_SEL` · `notOurField` · `onCtxMenu`). 새 오버레이(모달·튜토리얼 층)를
        넣을 때 한 곳만 빠뜨리면 「가려졌는데 조용히 버려진다」가 그대로 돌아온다.
        한 벌로 모은다 — 새 층은 아래 한 줄에만 더한다.

       COVER_SEL  휴지통을 **가릴 수 있는** 층. 좌표 판정(dropVerdict)이 쓴다.
       FIELD_SEL  거기에 `#panes` 를 더한 것 = 「우리 밭이 아닌 곳」.
                  끌기(notOurField)·우클릭(onCtxMenu)이 쓴다.

     🔴 `#panes` 가 COVER_SEL 에서 빠지는 이유는 **조상이라서가 아니다.**
        (종전 주석은 「바탕화면 자신의 조상」이라 적었는데 틀렸다 — `game.html`
         에서 `#dtIcons` 와 `#panes` 는 **형제**다.)
        진짜 이유는 **쌓임 순서**다: `#dtIcons{z-index:3}` 가 `#panes{z-index:1}`
        보다 위라(`css/app.css`) 아이콘이 판 **위에** 그려진다. 그래서 판은
        가리개가 아니다. 이유가 틀린 채 남으면 다음 사람이 `#panes` 를 도로
        넣고, 그 순간 바탕화면 전체가 「항상 가려진 것」이 된다. */
  var COVER_SEL = '.win,#taskbar,#topBar,#hostConsole,#ocOverlay,.ctx-menu';
  var FIELD_SEL = COVER_SEL + ',#panes';
  function inRect(x, y, r) {
    return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }
  function inAnyRect(x, y, rects) {
    for (var i = 0; rects && i < rects.length; i++) {
      var r = rects[i];
      if (!r || r.right <= r.left || r.bottom <= r.top) continue;   // 0×0 = 안 보이는 층
      if (inRect(x, y, r)) return true;
    }
    return false;
  }
  /**
   * 놓기 판정. **좌표만** 본다.
   * @param {number} x @param {number} y
   * @param {?Object} tr 휴지통 상자(휴지통이 없으면 null)
   * @param {Array} covers 휴지통을 가릴 수 있는 층들의 상자
   * @returns {'trash'|'covered'|'desk'}
   *   'trash'   버린다 · 'covered' 가려져 있다(버리지 않고 사유를 말한다)
   *   'desk'    휴지통과 무관한 자리 → 칸 옮기기
   */
  function dropVerdict(x, y, tr, covers) {
    if (!inRect(x, y, tr)) return 'desk';
    return inAnyRect(x, y, covers) ? 'covered' : 'trash';
  }
  /** 지금 화면에서 가리개들의 상자를 걷는다(안 보이는 것은 0×0 이라 저절로 빠진다). */
  function coverRects() {
    var out = [], list, i;
    try { list = document.querySelectorAll(COVER_SEL); } catch (e) { return out; }
    for (i = 0; i < list.length; i++) {
      if (!list[i].getClientRects || !list[i].getClientRects().length) continue;
      out.push(list[i].getBoundingClientRect());
    }
    return out;
  }
  /** 지금 화면에서 이 좌표의 판정. 휴지통이 없으면 언제나 'desk'. */
  function verdictAt(x, y) {
    if (!trashIt || !trashIt.el) return 'desk';
    return dropVerdict(x, y, trashIt.el.getBoundingClientRect(), coverRects());
  }
  /** 화면 좌표가 휴지통 아이콘 상자 위인가(가려졌는지는 보지 않는다). */
  function overTrash(x, y) { return verdictAt(x, y) !== 'desk'; }
  /** 지금 여기에 놓으면 **실제로 버려지는가**(= 학생 눈에 휴지통이 보이는가). */
  function trashOpenAt(x, y) { return verdictAt(x, y) === 'trash'; }
  /* 가려진 휴지통에 놓았을 때 하는 말. **반드시 말한다** — 아무 말도 없으면
     학생은 「고장났다」로 읽는다(그것이 어제 없앤 조용한 무반응이다). 우클릭
     메뉴는 창에 가려도 언제나 열리므로 그쪽으로 길을 낸다.
     🔴 두 번째 인자를 true 로 준다 = 경고. `main.js` 의 `notify` 는 경고를
        **4초 뒤에 지우지 않는다** — 학생이 창 뒤를 보느라 눈을 뗐다가 돌아와도
        안내가 남아 있어야 다음 수단을 찾는다. */
  function sayTrashCovered(it) {
    var nm = (it && it.file && it.file.name) || '이 아이콘';
    trashSay('휴지통이 창에 가려 있어 버리지 않았습니다 — 「' + nm + '」. ' +
      '창을 옮기거나, 아이콘을 오른쪽 클릭해 「휴지통으로 이동」을 쓰세요.', true);
  }
  function markTrashHover(on, okToDrop) {
    if (!trashIt || !trashIt.el) return;
    var cl = trashIt.el.classList;
    cl.toggle('drop-on', !!on && !!okToDrop);
    cl.toggle('drop-no', !!on && !okToDrop);
  }
  /**
   * 실제로 버린다(또는 못 버리는 사유를 말한다).
   * @returns {boolean} 버렸으면 true
   */
  function trashItem(it) {
    if (!trashIt || !it || it === trashIt) return false;   // 🗑 휴지통을 휴지통에 버리지 않는다
    var f = it.file || {};
    if (!canTrash(it)) {
      /* 🔴 **앱과 자료 조각은 버릴 수 없다.** 조각을 없앨 수단을 주면 학생이
         업무를 못 하게 된다. 아무 일도 안 일어나면 "고장났다"고 판단하므로
         왜 안 되는지 반드시 말한다. */
      trashSay(f.denyTrash || ('「' + (f.name || '이 아이콘') + '」은(는) 버릴 수 없습니다.'), true);
      return false;
    }
    try { f.onTrash(); } catch (e) { console.warn('[desktop] onTrash 실패', e); }
    return true;
  }

  /* ---- 끌기 배선 (Pointer Events — 마우스·터치·펜이 한 코드) --------------- */
  var ARROW = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  function wireDrag(it) {
    var el = it.el;
    var abortPointer = null;      // 진행 중인 포인터 끌기를 접는 문(네이티브 끌기가 이긴다)

    /* ── dragstart — 🔴 이 한 줄이 「끌어다 메일에 첨부」를 죽이고 있었다 ────────
       종전에는 **모든** 아이콘에서 무조건 `preventDefault()` 였다. 그림(<img>)이나
       글자의 브라우저 기본 끌기가 우리 포인터 끌기를 가로채는 것을 막으려던 것인데,
       나중에 main.js 가 저장 파일 아이콘에 `draggable=true` 와 `setData` 를 얹어도
       **먼저 등록된 이 리스너의 preventDefault 가 네이티브 끌기를 취소**했다.
       학생은 「끌어다 메일에 첨부」를 읽고 시도했다가 아무 일도 겪지 못했다
       (헤드리스 실측: 아이콘에 dragstart 를 쏘면 defaultPrevented === true).

       → **`draggable` 이 켜진 아이콘에서만 네이티브 끌기를 허용한다.** 켜는 것은
         바깥(main.js)이고, 켜는 대상은 학생이 저장한 파일뿐이다. 그 밖의 아이콘
         (앱·자료 조각·휴지통)은 종전 그대로 막아 포인터 끌기를 지킨다.
       🔴 **격자에서 옮기기도 그대로 산다.** 네이티브 끌기가 시작되면 포인터
          이벤트가 취소되므로, 바탕화면 자체(`#deskEnv`)를 놓는 자리로 받아
          `drop` 좌표로 칸을 정한다(아래 wireNativeDrop). 메일 첨부 칸에 놓으면
          그쪽이 먼저 `preventDefault` 하므로 여기로 내려오지 않는다. */
    el.addEventListener('dragstart', function (e) {
      if (!el.draggable) { e.preventDefault(); return; }
      /* 포인터 끌기와 동시에 시작될 수 있다 — 접어 준다(안 접으면 pointerup 이
         오지 않아 리스너가 남는다). */
      if (abortPointer) { try { abortPointer(); } catch (err) {} }
      var r = el.getBoundingClientRect();
      natDrag = it;
      natGrab = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copyMove'; } catch (err2) {}
    });
    /* 어디에 놓였든(창·바탕화면·창 밖) 여기서 끝난다 — 표시를 되돌리는 자리다. */
    el.addEventListener('dragend', function () {
      natDrag = null;
      markTrashHover(false, false);
      lastDragEnd = Date.now();       // 놓은 직후의 클릭은 열기가 아니다
    });

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;   // 오른쪽 버튼은 메뉴 몫
      if (!gridGeo) gridGeo = measure();
      if (!gridGeo) return;
      var sx = e.clientX, sy = e.clientY;
      var l0 = parseFloat(el.style.left) || 0, t0 = parseFloat(el.style.top) || 0;
      var moving = false, lx = sx, ly = sy;

      function onMove(ev) {
        var dx = ev.clientX - sx, dy = ev.clientY - sy;
        lx = ev.clientX; ly = ev.clientY;
        if (!moving) {
          if (Math.abs(dx) < DRAG_SLOP && Math.abs(dy) < DRAG_SLOP) return;  // 아직 클릭이다
          moving = true;
          el.classList.add('dragging');
        }
        el.style.left = (l0 + dx) + 'px';
        el.style.top = (t0 + dy) + 'px';
        /* 🗑 휴지통 위면 휴지통이 반응한다(버릴 수 없는 것이면 「안 됨」으로).
           가려져 있으면 강조하지 않는다 — 강조와 결과는 항상 같은 답이다.
           🔴 **휴지통을 옮기는 중에는 강조하지 않는다.** 자기 상자 위를 자기가
              지나가므로 `trashOpenAt` 이 늘 참이 되어, 옮기는 내내 「여기 버려요」
              라고 거짓말을 한다(2026-08-18 옮길 수 있게 하면서 생긴 자리). */
        if (it !== trashIt) markTrashHover(trashOpenAt(lx, ly), canTrash(it));
      }
      function finish(cancel) {
        abortPointer = null;
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onCancel);
        try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        if (!moving) { markTrashHover(false, false); return; }  // 작은 움직임 = 클릭
        el.classList.remove('dragging');
        markTrashHover(false, false);
        lastDragEnd = Date.now();
        /* 🗑 휴지통 위에서 놓았으면 자리 옮기기가 아니라 **버리기**다.
           못 버리는 것이면 사유를 말하고 제자리로 돌아간다(layout 이 되돌린다).
           창에 가려 있으면 버리지 않고 사유만 말한다(위 dropVerdict 주석). */
        if (!cancel && trashIt && it !== trashIt && overTrash(lx, ly)) {
          if (trashOpenAt(lx, ly)) trashItem(it);
          else sayTrashCovered(it);
          layout();
          return;
        }
        if (!cancel) dropAt(it, parseFloat(el.style.left) || 0, parseFloat(el.style.top) || 0);
        layout();                          // 취소면 제자리로, 아니면 새 칸으로 붙는다
      }
      function onUp() { finish(false); }
      function onCancel() { finish(true); }
      abortPointer = onCancel;

      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onCancel);
    });
  }

  /* ── 네이티브 끌기(HTML5 DnD)로 옮기기 · 버리기 ────────────────────────────
     `draggable` 이 켜진 아이콘은 포인터 끌기가 취소되고 브라우저가 끌기를 몰고
     간다. 그래도 **격자에서 옮기기와 휴지통에 버리기가 죽으면 안 되므로**
     바탕화면(`#deskEnv`)이 그 끌기를 받는 자리가 된다.
     🔴 메일 첨부 칸은 자기 `dragover`/`drop` 에서 이미 `preventDefault` 를 부른다.
        그 이벤트가 여기까지 거슬러 올라오므로 `defaultPrevented` 를 보고 비켜선다
        — 첨부가 붙는 동시에 아이콘이 칸을 옮기는 이중 처리가 없다.
     🔴 새 리스너는 바탕화면 하나에 셋뿐이고 `teardownGrid()` 가 짝을 맞춘다(§5-4).
        RTDB 와 무관하다(추가 읽기·쓰기 0). */
  var natDrag = null;          // 네이티브로 끌고 있는 항목
  var natGrab = { dx: 0, dy: 0 };

  /** 창·독·상단바 위에서 일어난 일인가(우리 밭이 아니다 — onCtxMenu 와 같은 기준). */
  function notOurField(t) {
    return !!(t && t.closest && t.closest(FIELD_SEL));
  }
  /* 🔴 2026-08-16 감사 — 휴지통이 **창에 가려 있으면** 네이티브 끌기가 통째로
     무반응이었다. `notOurField` 가 `dragover` 에서 먼저 비켜서는 바람에
     `preventDefault()` 가 안 불리고, 그러면 브라우저는 `drop` 자체를 내지 않는다.
     그런데 같은 자리에 **포인터 끌기**로 놓으면 좌표만 보고 그대로 버려졌다
     (위 :857) — 같은 동작에 두 경로가 다른 답을 냈고, 파일 아이콘은
     `draggable=true` 라 실제 브라우저에서는 네이티브 경로 하나뿐이다 = 무반응.
     조용한 무반응은 학생이 「고장났다」로 읽는다.
     → **기준을 좌표로 통일한다.** 학생이 겨눈 것은 창이 아니라 그 아래 휴지통이고,
       포인터 경로가 이미 그렇게 판정하고 있었다. 자기 자리를 주장하는 곳
       (메일 첨부 칸)은 스스로 `preventDefault` 하므로 `defaultPrevented` 에서
       먼저 걸러진다 — 첨부와 버리기가 겹쳐 두 번 처리되는 일은 없다.
     🔴 휴지통 **밖**의 창 위는 종전 그대로 비켜선다. 거기 놓는 것은 「이 칸으로
        옮겨라」인데 창 밑 칸은 학생이 보지도 못하는 자리다 — 아이콘이 제자리에
        그대로 남는 것이 답이다(아무 말도 필요 없다).
     🔴 **여기서 받는다 ≠ 여기서 버린다.** 같은 날 3차 검수가 그 다음 층을 잡았다:
        가려진 휴지통 좌표도 이 문은 계속 통과시키지만(그래야 `drop` 이 와서
        말할 기회가 생긴다) `onDeskDrop` 이 `trashOpenAt` 으로 한 번 더 갈라
        **가려졌으면 버리지 않고 사유만 말한다**(위 dropVerdict 주석의 판단 근거). */
  function deskDropBlocked(e) {
    if (e.defaultPrevented) return true;
    if (!notOurField(e.target)) return false;
    return !(trashIt && natDrag !== trashIt && overTrash(e.clientX, e.clientY));
  }
  function onDeskDragOver(e) {
    if (!natDrag) return;
    /* 🔴 비켜설 때도 **지나간 강조를 반드시 지운다.** 종전에는 그냥 return 이라,
       가려진 휴지통 위를 지나며 켜진 `drop-on` 이 같은 창의 다른 자리로 옮겨도
       그대로 남았다(창 밑이라 보이지도 않는 채로). 강조 상태는 마지막으로 지나간
       좌표의 답과 언제나 같아야 한다. */
    if (deskDropBlocked(e)) { markTrashHover(false, false); return; }
    e.preventDefault();                       // 안 부르면 브라우저가 놓기를 거부한다
    try { e.dataTransfer.dropEffect = 'move'; } catch (err) {}
    markTrashHover(trashOpenAt(e.clientX, e.clientY), canTrash(natDrag));
  }
  function onDeskDrop(e) {
    if (!natDrag || deskDropBlocked(e)) return;
    e.preventDefault();
    var it = natDrag;
    natDrag = null;
    markTrashHover(false, false);
    lastDragEnd = Date.now();
    if (trashIt && it !== trashIt && overTrash(e.clientX, e.clientY)) {
      /* 가려져 있으면 버리지 않고 사유를 말한다. 아이콘은 layout() 이 제자리로
         되돌린다 — 창 밑 칸으로 옮겨 두면 학생이 두 번 잃는다. */
      if (trashOpenAt(e.clientX, e.clientY)) trashItem(it);
      else sayTrashCovered(it);
      layout();
      return;
    }
    var box = document.getElementById('dtIcons');
    var r = box ? box.getBoundingClientRect() : null;
    if (r) dropAt(it, e.clientX - r.left - natGrab.dx, e.clientY - r.top - natGrab.dy);
    layout();
  }
  function onDeskDragLeave(e) {
    if (!natDrag) return;
    if (e.relatedTarget) return;              // 자식으로 옮겨간 것뿐이다
    markTrashHover(false, false);
  }

  /* 끌어 놓은 **직후의 클릭은 열기가 아니다.** 이 한 줄이 없으면 아이콘을
     옮길 때마다 창이 같이 열린다. 반대로 조금만 움직였으면(임계값 아래) 이
     함수가 false 를 주고 평소대로 열린다. */
  function mutedByDrag() { return (Date.now() - lastDragEnd) < CLICK_MUTE_MS; }

  /* ---- 「정렬하기」 --------------------------------------------------------
     🔴 반드시 있어야 하는 문이다. 아이콘을 창 뒤나 구석으로 밀어 넣고 못 찾는
        사고는 반드시 난다. 옮긴 기억을 전부 지우고 처음 배치로 되돌린다. */
  function arrangeIcons() {
    pinned = {}; autoCell = {};
    savePinned();
    return layout();
  }

  /* ---- 바탕화면 우클릭 메뉴 (windows.js 의 showCtxMenu 를 그대로 쓴다) ----
     🔴 **누르는 길**이다. 마우스를 못 쓰거나 창이 겹쳐 아이콘을 못 끄는 학생이
        반드시 생긴다 — 끌기만 있는 조작을 이 저장소는 허용하지 않는다. */
  function ctxItems(it) {
    var items = [];
    if (it) {
      items.push({ label: '열기', fn: function () { try { it.file.open(); } catch (e) {} } });
      if (canTrash(it)) {
        /* 메뉴 줄은 글자만(windows.js showCtxMenu 는 textContent) — 옛 그림 문자는 뺐다(2026-09-29). */
        items.push({ label: '휴지통으로 이동', fn: function () { trashItem(it); } });
      } else if (trashIt && it !== trashIt) {
        /* 못 버리는 것도 **왜 안 되는지** 알려 주는 자리를 남긴다. 메뉴에서
           항목이 아예 안 보이면 학생은 자기 화면이 고장난 줄 안다. */
        items.push({ label: '휴지통으로 이동 — 안 됨', fn: function () { trashItem(it); } });
      }
      items.push('-');
    }
    if (trashIt) {
      items.push({ label: '휴지통 열기',
        fn: function () { try { trashIt.file.open(); } catch (e) {} } });
    }
    items.push({ label: '아이콘 정렬하기', fn: function () { arrangeIcons(); } });
    return items;
  }
  function onCtxMenu(e) {
    if (!gridItems.length) return;                       // 격자가 없으면 관여하지 않는다
    var t = e.target, icon = (t && t.closest) ? t.closest('.dt-icon') : null;
    /* 창·독·상단바·관제 화면 위에서는 브라우저 기본 메뉴를 그대로 둔다 — 우리 밭이
       아니다. 목록은 `FIELD_SEL` 한 벌뿐이다(위 정본 주석). */
    if (!icon && t && t.closest && t.closest(FIELD_SEL)) return;
    if (!OC.ui || typeof OC.ui.showCtxMenu !== 'function') return;
    var it = null, i;
    if (icon) { for (i = 0; i < gridItems.length; i++) { if (gridItems[i].el === icon) { it = gridItems[i]; break; } } }
    e.preventDefault();
    OC.ui.showCtxMenu(e.clientX, e.clientY, ctxItems(it));
  }

  /* 배선은 한 번만. RTDB 리스너가 아니다 — 화면 크기 관찰자와 우클릭 하나뿐이고,
     teardownGrid() 가 짝을 맞춰 푼다(CLAUDE.md §5-4 의 등록/해제 규칙). */
  function wireGrid(el) {
    if (gridWired) return;
    gridWired = true;
    var env = document.getElementById('deskEnv') || document;
    env.addEventListener('contextmenu', onCtxMenu);
    env.addEventListener('dragover', onDeskDragOver);
    env.addEventListener('drop', onDeskDrop);
    env.addEventListener('dragleave', onDeskDragLeave);
    if (window.ResizeObserver) {
      try {
        roObs = new window.ResizeObserver(function () { relayoutSoon(); });
        roObs.observe(el);
      } catch (e) { roObs = null; }
    }
    if (!roObs) window.addEventListener('resize', relayoutSoon);
  }
  function teardownGrid() {
    if (!gridWired) return;
    gridWired = false;
    var env0 = document.getElementById('deskEnv') || document;
    env0.removeEventListener('contextmenu', onCtxMenu);
    env0.removeEventListener('dragover', onDeskDragOver);
    env0.removeEventListener('drop', onDeskDrop);
    env0.removeEventListener('dragleave', onDeskDragLeave);
    if (roObs) { try { roObs.disconnect(); } catch (e) {} roObs = null; }
    else window.removeEventListener('resize', relayoutSoon);
    gridItems = []; autoCell = {}; gridGeo = null; trashIt = null; natDrag = null;
    /* 🔴 아이콘 **DOM 도 같이 걷는다.** 종전에는 내부 상태만 비우고 `#dtIcons`
       안의 요소는 남겨 두었다 — 관제 화면으로 넘어가도 그 학생의 **파일 이름이
       DOM 에 그대로 남아 있었다**(지금은 CSS 가 가려 주지만, 가림에 기대는 것은
       유출을 한 줄 수정과 맞바꾸는 것이다). 등록과 해제는 짝을 맞춘다. */
    var box = document.getElementById('dtIcons');
    if (box) { box.innerHTML = ''; box.style.display = 'none'; }
    fileEls = [];
  }

  var fileEls = [];
  /**
   * 바탕화면에 놓을 것들. **입력 형식의 정본은 여기다.**
   * @param {Array<{
   *   icon:string, tile?:string, name:string, note?:string, open:function,
   *   role?:string,          'trash' 면 🗑 휴지통 — 오른쪽 아래 칸에 고정된다
   *   count?:number,         role:'trash' 전용 — 안에 든 개수(배지·빈/찬 구분)
   *   say?:function,         role:'trash' 전용 — 못 버리는 사유를 학생에게 말하는 통로
   *   canTrash?:boolean,     이 아이콘을 휴지통에 버릴 수 있는가(기본 false)
   *   onTrash?:function,     버리기 실행(canTrash 일 때 필수)
   *   denyTrash?:string      못 버리는 사유 한 줄
   * }>} list
   *
   * 그린 아이콘에는 `data-oc-idx`(입력 배열의 첨자)가 붙는다 — 부른 쪽이 **이름이
   * 아니라 자리로** 자기 항목을 되찾는 통로다(main.js 의 makeFilesDraggable).
   */
  function setFiles(list) {
    var el = document.getElementById('dtIcons');
    if (!el) return 0;
    el.innerHTML = '';
    fileEls = [];
    gridItems = [];
    trashIt = null;
    syncStore();                 // 이 방·이 자리에 저장된 배치를 읽는다(RTDB 아님)
    var arr = list || [];
    var nameSeen = {};
    for (var i = 0; i < arr.length; i++) {
      (function (f, idx0) {
        if (!f || !f.name || typeof f.open !== 'function') return;
        var d = document.createElement('div');
        d.className = 'dt-icon';
        d.tabIndex = 0;
        d.setAttribute('role', 'button');
        /* 🔴 **부른 쪽이 자기 항목을 다시 찾을 수 있게** 원래 배열의 자리를 적어 둔다.
           종전에는 main.js 가 아이콘 **이름**으로 짝을 지었다 — 그래서 학생이 파일을
           「문서」·「휴지통」 같은 앱 이름으로 저장하면 **앱 아이콘까지** 학생 파일
           id 를 실어 나르는 사고가 났다(📄 문서를 메일에 끌어다 놓으면 그 파일이
           첨부됐다, 2026-08-15 감사). 이름은 겹칠 수 있고 자리는 겹치지 않는다.
           ⚠️ 이 값은 **입력 배열의 첨자**다 — 그리지 않고 건너뛴 항목이 있어도
              어긋나지 않는다(그래서 accepted 순번이 아니라 i 를 쓴다). */
        d.dataset.ocIdx = String(idx0);
        /* 🔴 2026-08-15 오너: "안보여" — 브라우저 기본 말풍선(title)은 커서 **바로
           아래**에 뜬다. 그 자리가 곧 이름이 적힌 자리라, 아이콘을 가리키는 순간
           말풍선이 이름을 덮었다. 게다가 말풍선에 적힌 내용이 이름과 같아서
           가리면서 아무것도 더 알려주지 못했다.
           → 말풍선에는 **이름 말고 다른 정보만** 남긴다(용도·여는 법).
             note 가 없으면 title 자체를 붙이지 않는다 — 덮을 이유가 없다.
           ⚠️ aria-label 은 그대로 이름을 담는다. 말풍선과 접근성 이름은 다르다:
              스크린리더는 이름을 읽어야 하고, 그건 화면을 가리지 않는다. */
        if (f.note) d.title = f.note + ' · 눌러서 열기';
        d.setAttribute('aria-label', f.name + (f.note ? ' — ' + f.note : '') + ' · 열기');
        var ic = document.createElement('span');
        ic.className = 'ic';
        /* 🔴 타일이 없거나 모르는 종류면 **그림 문자로 떨어진다.** 빈 칸이 뜨면
           학생은 "고장났다"고 판단한다(fail open).
           `.tile` 은 그림 문자와 다른 그림자를 쓴다(app.css) — 타일은 자기 바탕이
           있어 한 겹이면 되고, 그림 문자는 바탕이 없어 두 겹이 필요하다. */
        var A = OC.ui && OC.ui.appicon;
        /* 🗑 휴지통은 **빈 것(17번)과 찬 것(20번)** 그림이 따로 있다(2026-09-29 승인 24종).
           부른 쪽은 여전히 tile:'trash' + count 만 준다 — 찬 그림을 고르는 일은 여기서 한다
           (빈/찬 판정의 정본이 아래 배지·`full` 클래스와 같은 count 한 값이어야 한다). */
        var tk = f.tile;
        if (f.role === 'trash' && tk === 'trash' && Math.floor(Number(f.count) || 0) > 0 &&
            A && A.has('trashFull')) tk = 'trashFull';
        if (tk && A && A.has(tk)) {
          ic.className = 'ic tile';
          A.paint(ic, tk, f.icon || '📄');
        } else {
          ic.textContent = f.icon || '📄';
        }
        d.appendChild(ic);
        /* 🔴 2026-08-15 — 이름을 맨 텍스트 노드로 두면 배경 사진 위에서 읽히지
           않는다. `.nm` 으로 감싸야 app.css 가 글자 뒤에 반투명 판을 깔 수 있다
           (판 없이 그림자만으로는 밝은 사진에서 대비가 4.5:1 아래로 떨어진다).
           ⚠️ 사용자 이름은 textContent 로만 넣는다 — innerHTML 금지(XSS). */
        var nm = document.createElement('span');
        nm.className = 'nm';
        nm.textContent = f.name;
        /* ✏️ 이름 바꾸기 (2026-08-19) — 오너 요청 + 참가자 2명 신고
           (*"문서 이름 변경이 안되는게 아쉬웠습니다"* · *"문서 이름 변경 안됨"*).
           종전에는 파일을 **열고** 이름 칸을 고치고 다시 저장해야 했다.

           🔴 **무엇을 바꿀 수 있는지는 이 파일이 정하지 않는다** — 항목이
              `canRename` · `onRename` 을 들고 온다(`canTrash`/`onTrash` 와 같은 계약).
              그래야 바탕화면은 「그리는 일」만 하고, 규칙(이름 검사·첨부된 파일 보호)은
              그것을 아는 쪽(main.js·vfs)이 갖는다. */
        if (f.canRename && typeof f.onRename === 'function') {
          nm.classList.add('is-editable');
          nm.title = '이름을 누르면 바꿀 수 있습니다';
          nm.onclick = function (ev) {
            ev.stopPropagation();               // 아이콘 열기와 겹치지 않게
            startRename(nm, f);
          };
          /* 🔴 2026-09-03 오너 "바탕화면에서 이름 바꾸기 안 돼" — 아이콘의 끌기(wireDrag)가 pointerdown 을
             잡으면 click 의 목표가 아이콘으로 바뀌어 이름 onclick 이 안 탄다(포인터 캡처). 이름 위에서 시작한
             누름은 끌기로 넘기지 않는다. 더블클릭도 이름에서는 열기가 아니라 고치기다. */
          nm.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
          nm.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
          nm.addEventListener('dblclick', function (ev) { ev.stopPropagation(); ev.preventDefault(); startRename(nm, f); });
        }
        d.appendChild(nm);
        /* 🗑 **빈 상태와 찬 상태가 구분돼야 한다**(맥이 그렇다). 그림(위 trashFull)에
           더해 개수 배지와 클래스로도 가른다. 배지는 눈으로, note→title/aria-label 은
           스크린리더로 같은 것을 말한다 — 그림·색만으로 상태를 말하지 않는다. */
        if (f.role === 'trash') {
          d.classList.add('dt-trash');
          /* 브라우저 기본 끌기(그림 끌림)를 막는 일은 아래 `wireDrag` 의 dragstart 가
             한다 — `draggable` 이 꺼진 아이콘은 거기서 `preventDefault()` 된다.
             종전에는 휴지통에 `wireDrag` 를 안 걸어 여기서 따로 막아야 했다. */
          var n = Math.max(0, Math.floor(Number(f.count) || 0));
          if (n > 0) {
            d.classList.add('full');
            var bg = document.createElement('span');
            bg.className = 'dt-badge';
            bg.textContent = n > 99 ? '99+' : String(n);
            d.appendChild(bg);
          }
        }
        /* 바탕화면 관례대로 더블클릭. 다만 **한 번 클릭으로도 열어 준다** —
           교육 현장에서 더블클릭을 못 해 못 여는 학생이 반드시 나온다.
           두 번 눌러도 창은 하나다(openWin 이 같은 id 를 다시 띄운다).
           🔴 끌어 놓은 직후만 막는다(mutedByDrag). 임계값(DRAG_SLOP) 아래의
              작은 움직임은 끌기로 치지 않으므로 평소 클릭은 그대로 열린다. */
        d.addEventListener('dblclick', function () { if (!mutedByDrag()) f.open(); });
        d.addEventListener('click', function () { if (!mutedByDrag()) f.open(); });

        /* 자리를 정하는 값. 이름이 곧 학생이 보는 정체성이라 이름으로 잡는다
           (같은 이름이 둘이면 뒤엣것에 번호를 붙여 갈라 준다). */
        var key = f.name;
        nameSeen[key] = (nameSeen[key] || 0) + 1;
        if (nameSeen[key] > 1) key = f.name + '#' + nameSeen[key];
        /* 🗑 휴지통도 **다른 아이콘과 같은 항목**이다(2026-08-18). 종전에는
           `fixed:true` 를 달아 배치·끌기·키보드 네 곳에서 통째로 빠져나갔다.
           지금 다른 것은 「기본 자리가 오른쪽 아래 구석」과 「놓는 자리라 빼앗기지
           않는다」 둘뿐이고, 그 둘은 `trashIt` 하나로 판정한다. */
        var item = { key: key, el: d, file: f, cell: null };
        if (f.role === 'trash') trashIt = item;

        /* 🔴 키보드로도 옮길 수 있어야 한다. 끌기만 되면 마우스를 못 쓰는 학생은
           배치를 바꿀 길이 없다. Enter/Space 로 열기는 종전 그대로 살아 있고,
           **Ctrl(또는 Alt/⌘) + 화살표** 로 옆 칸에 옮긴다 — 맨 화살표를 쓰면
           탭으로 지나가던 학생이 실수로 배치를 흐트러뜨린다. */
        d.setAttribute('aria-keyshortcuts',
          'Control+ArrowUp Control+ArrowDown Control+ArrowLeft Control+ArrowRight Delete');
        d.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.open(); return; }
          /* 🗑 **키보드로도 버릴 수 있어야 한다.** 맥의 ⌘⌫ 대신 Delete/Backspace 를
             쓴다 — 이 게임의 다른 단축키가 전부 맨키(F·Esc)이고, ⌘⌫ 는 학생이
             배운 적이 없다. 못 버리는 아이콘이면 사유만 말하고 아무 일도 안 난다. */
          if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!trashIt || item === trashIt) return;     // 🗑 휴지통 자신은 버릴 수 없다
            e.preventDefault();
            if (trashItem(item) && trashIt && trashIt.el) {
              /* 버린 아이콘은 화면에서 사라진다 — 초점이 <body> 로 떨어지면
                 키보드 학생이 길을 잃는다. 방금 버린 것이 들어간 자리로 옮긴다. */
              try { trashIt.el.focus(); } catch (err) {}
            }
            return;
          }
          var dir = ARROW[e.key];
          if (!dir || !(e.ctrlKey || e.metaKey || e.altKey)) return;
          var g = gridGeo || measure();
          if (!g || !item.cell) return;
          e.preventDefault();
          var c = Math.max(0, Math.min(g.cols - 1, item.cell.c + dir[0]));
          var r = Math.max(0, Math.min(g.rows - 1, item.cell.r + dir[1]));
          if (c === item.cell.c && r === item.cell.r) return;
          moveTo(item, c, r);
          layout();
        });

        el.appendChild(d);
        fileEls.push(d);
        gridItems.push(item);
        /* 🗑 휴지통도 **같은 끌기**를 쓴다(2026-08-18 오너: "휴지통은 위치가
           고정되어 있어"). 옮긴 자리는 다른 아이콘과 같은 키에 같이 저장되고,
           끌어다 버리기는 좌표 판정(dropVerdict)이라 자리를 옮겨도 그대로 산다. */
        wireDrag(item);
      })(arr[i], i);
    }
    // 학생 화면에서는 숨겨져 있었다 — 채웠으면 보여 준다. 비었으면 다시 감춘다.
    el.style.display = fileEls.length ? '' : 'none';
    /* 격자 모드는 **아이콘이 있을 때만** 켠다. shell.js 의 데모 아이콘(다른 화면)은
       종전의 한 줄 흐름 그대로 두기 위해서다. */
    if (fileEls.length) {
      el.classList.add(GRID_ON);
      wireGrid(el);
      layout();
      /* 방금 display 를 바꿨다 — 브라우저가 상자를 잡은 다음에 한 번 더 재야
         0×0 을 잡고 넘어가는 일이 없다(같은 결과면 style 값도 그대로다). */
      relayoutSoon();
    } else {
      el.classList.remove(GRID_ON);
    }
    return fileEls.length;
  }

  /* ---- expose ---- */
  OC.ui.desktop = {
    mountStudentDesktop: mountStudentDesktop,
    unmountStudentDesktop: unmountStudentDesktop,
    setFiles: setFiles,
    /* 바깥에서 앱을 여는 문. 예: 강사가 코치 피드백을 풀면 코치 앱이 스스로 뜬다.
       독을 거치지 않으므로 학생이 아이콘을 못 찾아도 화면이 열린다. */
    openApp: openApp,
    setBadge: setBadge,
    hasDockApp: hasDockApp,
    iconKeyOf: iconKeyOf,
    /* 「정렬하기」 — 옮겨 둔 자리를 전부 잊고 처음 배치로 되돌린다.
       상단 「보기」 메뉴(ui/shell.js)와 바탕화면 우클릭 메뉴가 같은 이 문을 쓴다.
       아이콘을 창 뒤로 밀어 넣고 못 찾는 사고의 유일한 탈출구다. */
    arrangeIcons: arrangeIcons,
    /* 🗑 휴지통을 연다 — 상단 「보기」 메뉴(ui/shell.js)가 쓰는 세 번째 길이다.
       아이콘이 창 뒤로 들어가 안 보일 때 학생이 되돌리기에 닿는 유일한 문이 된다.
       휴지통이 없으면(폴백 화면) false. */
    openTrash: function () {
      if (!trashIt || !trashIt.file || typeof trashIt.file.open !== 'function') return false;
      try { trashIt.file.open(); } catch (e) { return false; }
      return true;
    },
    hasTrash: function () { return !!trashIt; },
    /* 🗑 놓기 판정의 정본(순수 함수). 화면 없이 부를 수 있게 밖으로 낸다 —
       self-test(S99a)가 **제품이 실제로 쓰는 이 함수**를 그대로 돌린다.
       하네스가 판정을 다시 구현하면 그 검사는 자기 자신을 검사하게 된다. */
    _dropVerdict: dropVerdict,
    // 격자를 다시 잡는다(밖에서 화면 크기를 바꿨을 때). 화면에 아이콘이 없으면 false.
    relayoutIcons: layout
  };
})();
