/* co-work sim — 배경화면 배정
   ════════════════════════════════════════════════════════════════
   같은 사람은 항상 같은 배경, 사람마다는 다른 배경.
   무작위로 하면 새로고침마다 바뀌어 "다른 방인가?" 싶어집니다.

   ⚠ ES 모듈이 아닙니다
     이 프로젝트는 빌드 도구가 없고 모든 모듈이 window.OC 아래에 붙습니다
     (CLAUDE.md §5-6). export 를 쓰지 않고 OC.wall 로 노출합니다.

   ⚠ 대상 요소는 #wallpaper 입니다
     UI 계약서 §1 · §2 기준. #deskEnv 나 .desk 가 아닙니다.
     #wallpaper 는 z-index 0 이고 그 위에 #panes(1) · #dtIcons(3) 가 올라갑니다.
     그래서 이 파일은 background 계열 속성만 씁니다 —
     position · inset · z-index · display 는 건드리지 않습니다.
     (계약서 §4: 그 속성들은 JS 가 인라인으로 관리합니다)

   넣는 방법
     <script src="js/wallpaper.js"></script>     ← 의존성 없음, 순서 무관
     OC.wall.mount({ pid: myPid });              ← 학생
     OC.wall.mount({ isHost: true });            ← 강사(진행자)
   ════════════════════════════════════════════════════════════════ */

window.OC = window.OC || {};

(function () {
  'use strict';

  /* avg 는 이미지 로딩 전에 먼저 칠해 흰 화면 번쩍임을 막는 용도입니다. */
  /* tone — **상단 28px(메뉴바가 앉는 자리)** 이 밝은가 어두운가.
     상단바는 이 값으로 자기 글자색을 고른다(theme.css `:root[data-wall-tone]`).
     🔴 새 사진을 추가하면 tone 을 **반드시** 같이 정해라. 빠지면 'dark' 로
        떨어져 밝은 사진에서 흰 글자가 사라진다. S70 이 이걸 막는다.
        정하는 법: 사진 위쪽 28px 의 평균색을 뽑아 흰 글자 대비를 계산한다.
        4.5 미만이면 'light'(밝은 메뉴바 + 검은 글자)다.

     🔴 2026-08-09 오너: "밝은톤 배경을 없애자 / 사막 이런거 맘에 안들어
        / 호수는 놔둬 맘에 드니까"
        dunes·coast·highland·snow 를 뺐다. (git 에 남아 있어 되살릴 수 있다)
     🔴 2026-08-09 오너가 새 사진 3장을 줬다. 전부 밤 하늘이라 tone 은 dark 다.
        상단 28px 평균색으로 잰 흰 글자 대비:
          aurora 18.46 · galaxy 18.18 · fjord 11.16 · lake 9.78   ← 전부 통과
        avg 토큰도 실측값으로 갱신했다(로딩 전 첫 칠이 사진과 어긋나지 않게).
     ⚠️ fjord 는 원본이 800x533 이라 2560 으로 **확대**했다. 다른 셋은 원본이
        충분히 크다(3000x2004 · 7360x4912). 더 큰 파일을 받으면 교체할 것.

     ⚠️ tone 의 사정거리는 **상단 28px 뿐**이다 (2026-08-15).
        바탕화면 아이콘(#dtIcons)은 상단바 아래 60px 부터 시작하므로 tone 으로
        글자색을 고르면 틀린다 — 같은 사진에서도 위는 어둡고 아래는 밝다(lake·
        fjord 가 그렇다). 그래서 아이콘 이름은 tone 을 보지 않고 **배경과 무관하게
        성립하는 검은 반투명 판**(app.css `#dtIcons .dt-icon .nm`)을 깐다.
        새 규칙을 tone 으로 분기시키려면 그 영역의 밝기를 따로 재고 나서 하라. */
  /* 🔴 파일 내용을 바꾸면 이 숫자를 반드시 올린다 (2026-08-18).
     firebase.json 이 이미지에 `public, max-age=604800, immutable` 을 건다.
     `immutable` 은 "만료 전에는 서버에 묻지도 말라"는 뜻이라, 같은 URL 로
     파일만 갈아끼우면 이미 받아 간 브라우저는 7일 동안 옛 사진을 계속 쓴다.
     실제로 23차에서 화질을 되살려 배포했는데 오너 화면이 그대로였다.
     URL 이 달라져야 뚫린다 — 그 역할을 하는 것이 이 쿼리스트링이다. */
  var VER = '3';

  var WALLS = {
    lake:   { src: 'assets/wall/lake.webp?v='   + VER, avg: '#035eab', tone: 'dark' },
    aurora: { src: 'assets/wall/aurora.webp?v=' + VER, avg: '#051d2c', tone: 'dark' },
    galaxy: { src: 'assets/wall/galaxy.webp?v=' + VER, avg: '#121d33', tone: 'dark' },
    fjord:  { src: 'assets/wall/fjord.webp?v='  + VER, avg: '#1f528d', tone: 'dark' }
  };
  var KEYS = Object.keys(WALLS);

  /* 강사 화면은 프로젝터에 띄우므로 고정합니다.
     🔴 2026-08-09 오너: "저 사막 너무 안이쁘다".
     dunes 는 평균색이 #e5cbb9 — 옅은 베이지다. 그 위에 흰 창이 뜨니 경계가
     흐려져 창이 배경에 잠겨 보였다. lake 는 짙은 파랑(#4288b6)이라 흰 창이
     또렷하게 떠오르고, 프로젝터에서도 대비가 산다. */
  var HOST_WALL = 'lake';

  /* 학생도 강사와 같은 배경을 쓴다(위 forPid 주석 참고). 한 곳에서만 바꾸면 된다. */
  var UNIFIED = HOST_WALL;

  /* pid(자리 번호)로 계산합니다.
     uid 로 하면 익명 인증이 갱신될 때 배경이 바뀝니다 — pid 는 방 안에서 고정입니다.
     CLAUDE.md §5-1: 사람 단위 표시 데이터는 pid 로 키잉합니다. */
  function forPid(pid) {
    /* 🔴 2026-08-18 — 전원 같은 배경으로 통일했다.
       오너: *"배경화면도 좀 뭐 막 계속 깨지고 안이쁘게 나오고 할거면 그냥
       강사화면이랑 똑같은 이거 호수인지 바다인지 이걸로 통일해버려"*

       왜 자리마다 다르게 주던 것을 접었나
         · `fjord` 는 원본이 160KB 뿐이라 **화질을 고칠 방법이 없다**(0.037 B/px).
           네 장 중 그 한 장을 받은 학생만 흐린 화면을 본다 — 수업에서 그건
           "누구는 되고 누구는 안 되는" 문제로 보인다.
         · 배경이 자리마다 다른 것에 학습상 이유가 없었다. 그냥 보기 좋으라고 한 것이다.
         · 전송량도 준다: 평균 497KB → 322KB(수업당 24.3MB → 16.1MB).

       ⚠️ 되돌리려면 이 함수만 원래대로(pid 해시 → KEYS) 돌리면 된다. WALLS·KEYS 는
          그대로 두었다 — 파일도 넷 다 남아 있어 404 가 날 일이 없다.
       ⚠️ 인자를 그대로 받는다. 부르는 쪽(desktop.js·main.js)은 한 글자도 안 고쳤다. */
    return UNIFIED;
  }

  /* el 을 생략하면 #wallpaper 를 씁니다. */
  function apply(key, el) {
    el = el || document.getElementById('wallpaper');
    if (!el) return null;                       // 부팅 전이면 조용히 넘깁니다
    var w = WALLS[key] || WALLS.lake;
    el.dataset.wall = key;
    /* 상단바가 자기 글자색을 고를 수 있게 배경의 밝기를 루트에 알린다.
       (#wallpaper 는 #topBar 의 조상이 아니라 CSS 로는 닿지 않는다) */
    try {
      if (document.documentElement) {
        document.documentElement.setAttribute('data-wall-tone', w.tone || 'dark');
      }
    } catch (e) { /* 부팅 전이면 넘긴다 */ }
    /* background 계열만 씁니다 — 계약서 §2 · §3 을 건드리지 않기 위해서입니다 */
    el.style.backgroundColor = w.avg;
    el.style.backgroundImage = "url('" + w.src + "')";
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.backgroundRepeat = 'no-repeat';
    return key;
  }

  /* 이미지를 미리 받아 둡니다 — 배경이 늦게 뜨는 것보다 낫습니다. */
  function preload(key) {
    var w = WALLS[key]; if (!w) return;
    var img = new Image(); img.src = w.src;
  }

  OC.wall = {
    KEYS: KEYS,
    HOST_WALL: HOST_WALL,
    forPid: forPid,
    UNIFIED: UNIFIED,
    apply: apply,

    /**
     * @param {{pid?:string|number, isHost?:boolean, el?:HTMLElement}} opts
     * @returns {string|null} 적용된 배경 키
     */
    mount: function (opts) {
      opts = opts || {};
      var key = opts.isHost ? HOST_WALL : forPid(opts.pid);
      preload(key);
      return apply(key, opts.el);
    }
  };
})();

/* 어디서 부르나
   ────────────────────────────────────────────────────────────────
   자리(pid)가 확정된 직후입니다. 부팅 중에는 body.oc-booting 이 붙어
   #deskEnv 가 visibility:hidden 이므로(계약서 §5), 그전에 불러도 보이지
   않습니다. pid 를 받는 지점에서 한 번 부르면 충분합니다.

   재접속해도 pid 가 같으면 같은 배경이 나옵니다 — 의도한 동작입니다.  */
