/* =====================================================
   OC.ui — 데스크톱 창(window) 관리자 (pure WM core)
   Ported from office-sim/index.html lines 5163-5335.
   Public API on OC.ui: openWin, focusWin, minimizeWin, toggleMax,
     closeWin, refreshTaskbar, showCtxMenu, hideCtxMenu, setWinTitle.
   Internal (closure-scoped, NOT leaked as globals): zTop, WINS,
     updateMaxBtn, snap helpers (_snapEl, snapRect, snapHint, hideSnap,
     applySnap), ctx-menu (_ctxEl).
   Stubbed / guarded:
     - drainFeedbackQueue()  -> already typeof-guarded in closeWin (game hook).
     - $('stash') / $('tbWins') existence guarded so file loads clean if
       Agent C hasn't mounted those ids yet ($('winLayer') is required).
   Omitted (data-bound, owned by Agent C desktop bootstrap):
     renderDesktop, deleteDesktopFile, renameDesktopFile, openMail, etc.
   DOM ids expected from index.html: #winLayer (required), #tbWins (taskbar
     buttons container), #stash (optional, for keep:true windows).
     #snapPreview is created dynamically inside #winLayer.
===================================================== */
window.OC = window.OC || {}; OC.ui = OC.ui || {};

(function(){
  const $ = id => document.getElementById(id);

  let zTop = 20; const WINS = {};

  /* 🔴 창을 키우면 글자도 같은 비율로 커진다 (2026-08-14 오너: "크게 보고 싶어서
     화면 늘렸을 때 같은 비율로 글씨도 커질 수 있게 해줘").

     종전엔 창을 키워도 글자는 그대로라, 넓힌 만큼 **여백만 늘고 읽기는 그대로**였다.
     학생이 창을 키우는 이유는 공간이 아니라 **글자가 잘 안 보여서**다.

     방식: 창 폭에 비례해 크기 토큰(--t-body/--t-sm/--t-xs)만 다시 준다.
     후손이 전부 `var(--t-body,16px)` 꼴로 그 토큰을 쓰므로 한 곳만 바꾸면 따라온다.
     ⚠️ CSS 컨테이너 쿼리(cqw)를 쓰지 않은 이유 — `container-type:inline-size` 는
        크기 격리를 걸어서 높이를 부모에 의존하는 자식(스크롤 상자·flex 자식)이
        찌부러진다. 이 저장소에서 이미 그 사고를 겪었다(본문 1083px → 2px).
     ⚠️ 상·하한을 둔다. 좁힐 때 하한(--t-xs 13.5px) 아래로 내려가면 안 되고,
        넓힐 때 무한정 커지면 버튼 라벨이 두 줄로 접힌다.
     기준 폭 760px 에서 배율 1.0 이다(코치 앱 기본 폭). */
  const TYPE_BASE_W = 760, TYPE_MIN = 1, TYPE_MAX = 1.5;
  function scaleType(w){
    const apply = () => {
      const k = Math.max(TYPE_MIN, Math.min(TYPE_MAX, w.offsetWidth / TYPE_BASE_W));
      if (k === 1) {           // 기본 배율이면 토큰을 지워 :root 값을 그대로 쓴다
        w.style.removeProperty('--t-body');
        w.style.removeProperty('--t-sm');
        w.style.removeProperty('--t-xs');
        return;
      }
      const r = n => Math.round(n * k * 10) / 10 + 'px';
      w.style.setProperty('--t-body', r(16));
      w.style.setProperty('--t-sm',   r(14.5));
      w.style.setProperty('--t-xs',   r(13.5));
    };
    apply();
    w._typeApply = apply;      /* 최대화·스냅·드래그 종료에서도 부른다 */
    if (typeof ResizeObserver === 'function') {
      const ro = new ResizeObserver(apply);
      ro.observe(w);
      w._typeRO = ro;          /* closeWin 이 끊는다 */
    }
    /* 🔴 CSS `resize` 로 모서리를 끌어 늘리는 것은 **JS 이벤트를 내지 않는다.**
       그래서 ResizeObserver 가 정공법이지만, 탭이 백그라운드면 브라우저가 관찰자를
       멈춘다(2026-08-14 실측: hidden 탭에서 콜백 0회). 돌아왔을 때 크기가 이미
       달라져 있으면 글자만 옛 배율로 남는다. 손이 떨어질 때 한 번 더 맞춘다. */
    w.addEventListener('mouseup', apply);
  }

  /* ==========================================================================
   * 창 크기 조절 — 네 꼭지점 + 네 변
   * --------------------------------------------------------------------------
   * 🔴 2026-08-15 오너: 「이 표시 없애고 꼭지점 4개 다 이용해서 늘렸다 줄였다」
   *    종전에는 CSS `resize:both` 였다. 그건 **오른쪽 아래 한 곳**만 되고,
   *    거기에 ◢ 글리프를 그려 두고 있었다.
   *
   * 🔴 덤으로 오래된 문제 하나가 같이 풀린다: CSS resize 는 **JS 이벤트를 안 낸다.**
   *    그래서 글자 배율(scaleType)이 ResizeObserver 에 기대야 했고, 탭이 백그라운드면
   *    관찰자가 멈춰 배율이 옛 값으로 남았다. 여기서는 우리가 직접 크기를 바꾸므로
   *    끝날 때 retype 을 부르면 된다.
   *
   * 왼쪽·위 손잡이는 **left/top 도 같이 움직여야** 반대편이 제자리에 있는 것처럼 보인다.
   * 최소 크기(CSS min-width/min-height)에 닿으면 그 축은 더 이상 움직이지 않는다 —
   * 안 그러면 창이 최소 크기에 붙은 채 위치만 밀려 사라지는 것처럼 보인다.
   * ======================================================================== */
  const RZ_MIN_W = 340, RZ_MIN_H = 180;   /* app.css .win 의 min-width/min-height 와 같은 값 */
  const RZ_SIDES = ['nw','ne','sw','se','n','s','w','e'];

  function addResizers(id, w){
    RZ_SIDES.forEach(side=>{
      const h = document.createElement('div');
      h.className = 'win-rz ' + side;
      h.addEventListener('mousedown', e=>{
        const wi = WINS[id];
        if(!wi || wi.max) return;            /* 최대화 중에는 손잡이를 숨긴다(CSS) */
        e.preventDefault(); e.stopPropagation();   /* 제목줄 드래그와 겹치지 않게 */
        focusWin(id);
        const box = layerBox();
        const sx = e.clientX, sy = e.clientY;
        const ow = w.offsetWidth, oh = w.offsetHeight;
        const ol = w.offsetLeft, ot = w.offsetTop;
        const mv = ev=>{
          const dx = ev.clientX - sx, dy = ev.clientY - sy;
          let nl = ol, nt = ot, nw2 = ow, nh = oh;
          if(side.indexOf('e') >= 0) nw2 = ow + dx;
          if(side.indexOf('s') >= 0) nh = oh + dy;
          if(side.indexOf('w') >= 0){ nw2 = ow - dx; nl = ol + dx; }
          if(side.indexOf('n') >= 0){ nh = oh - dy; nt = ot + dy; }
          /* 최소 크기에 닿으면 **위치도 되돌린다** — 왼쪽/위를 끌 때 크기는 안 줄고
             위치만 밀리면 창이 화면 밖으로 걸어 나간다. */
          if(nw2 < RZ_MIN_W){ if(side.indexOf('w') >= 0) nl = ol + (ow - RZ_MIN_W); nw2 = RZ_MIN_W; }
          if(nh  < RZ_MIN_H){ if(side.indexOf('n') >= 0) nt = ot + (oh - RZ_MIN_H); nh  = RZ_MIN_H; }
          /* 창 레이어(= 독을 이미 피한 상자) 밖으로 나가지 않는다 */
          if(nl < 0){ nw2 += nl; nl = 0; }
          if(nt < 0){ nh  += nt; nt = 0; }
          if(nl + nw2 > box.w) nw2 = Math.max(RZ_MIN_W, box.w - nl);
          if(nt + nh  > box.h) nh  = Math.max(RZ_MIN_H, box.h - nt);
          w.style.left = nl + 'px'; w.style.top = nt + 'px';
          w.style.width = nw2 + 'px'; w.style.height = nh + 'px';
        };
        const up = ()=>{
          removeEventListener('mousemove', mv); removeEventListener('mouseup', up);
          retype(id);                         /* 글자 배율을 새 크기에 맞춘다 */
        };
        addEventListener('mousemove', mv); addEventListener('mouseup', up);
      });
      w.appendChild(h);
    });
  }

  /* ==========================================================================
   * 접근성 — 창은 대화상자다 (2026-08-17 6차 검수)
   * --------------------------------------------------------------------------
   * 🔴 종전: `openWin` 이 새 창에 포커스를 옮기지 않고 `role`/`aria-label` 도 없었다
   *    (`public/` 전체에 `role="dialog"` 0건). 닫기·최소화·최대화 버튼은 `title` 만
   *    있어 스크린리더가 **「✕」·「–」** 를 그대로 읽었다. 같은 파일 아래 작업표시줄
   *    버튼(:refreshTaskbar)은 `aria-label` 을 제대로 주고 있었다 — **한 파일 안에
   *    기준이 두 벌**이었다.
   *    결과: 창이 열릴 때마다 데스크톱 전체를 다시 Tab 해야 했다. 메일·문서·보고서
   *    **전부**가 이 한 함수를 탄다.
   *
   * 어디에 포커스를 주는가 (판단 근거)
   *   ① 본문(.win-bd) 안의 **첫 조작 요소**. 창을 연 목적이 거기 있다.
   *      — 닫기 버튼에 주지 않는다. 키보드 사용자가 관성으로 Enter/Space 를 치면
   *        연 창이 곧바로 닫힌다.
   *   ② 조작 요소가 없으면 **창 상자 자체**(tabindex="-1"). 스크린리더가 대화상자
   *      이름(제목)을 읽어 주고, 거기서부터 Tab 이 창 안으로 들어간다.
   *
   * 언제 옮기지 않는가 (연속 입력 보호)
   *   · `opts.autoFocus === false` — 호출부가 명시적으로 사양한 경우
   *   · 지금 **글자를 입력 중**인데(input/textarea/contenteditable) 그 칸이 새 창
   *     밖에 있는 경우. 게임 도중 자동으로 열리는 창(종료 보고서 등)이 타이핑을
   *     끊지 않게 한다. 이때도 role/aria-label 은 그대로 붙으므로 스크린리더
   *     사용자가 스스로 찾아 들어갈 수 있다.
   * ======================================================================== */
  const FOCUSABLE_SEL = 'button:not([disabled]),[href],input:not([disabled]):not([type="hidden"]),' +
    'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  /* PURE(주입 가능) — root.querySelector 만 쓴다. 검사에서 그대로 부른다. */
  function firstFocusable(root){
    if(!root || typeof root.querySelector !== 'function') return null;
    return root.querySelector(FOCUSABLE_SEL) || null;
  }
  /* 지금 글자를 치고 있는가. 새 창이 그 입력을 가로채면 안 된다. */
  function isTypingIn(el){
    if(!el) return false;
    const tag = String(el.tagName || '').toUpperCase();
    if(tag === 'INPUT' || tag === 'TEXTAREA') return true;
    return el.isContentEditable === true;
  }
  /* 창 본문으로 들여보낸다 — 새로 열 때와 **이미 열린 것을 다시 열 때**가 같아야 한다.
     🔴 2026-08-17 7차 검수 7: 6차는 `openWin` 의 **새로 여는 경로에만** 이 일을 넣었다.
        `if(WINS[id]){ focusWin(id); return … }` 로 빠지는 두 번째 호출은 z-index 와
        클래스만 만져, 같은 메일을 두 번째로 여는 키보드 사용자에게는 **아무 일도
        안 일어난 것으로** 보였다(화면에서 창 위치도 안 변한다 — 이미 맨 위였다면). */
  function focusInto(w, prevFocus){
    if(!w) return;
    if(isTypingIn(prevFocus) && !w.contains(prevFocus)) return;   // 연속 입력 보호(위 머리말)
    const target = firstFocusable(w.querySelector('.win-bd')) || w;
    try { target.focus(); } catch(e){ /* 포커스 실패가 창을 깨지 않는다 */ }
  }

  /* ==========================================================================
   * ⌨️ Escape 로 닫는다 · 포커스가 창 뒤로 새지 않는다 (2026-08-17 7차 검수 D)
   * --------------------------------------------------------------------------
   * 🔴 종전: 창에 `role="dialog"` 를 붙여 놓고 **Escape 핸들러가 없었다.**
   *    키보드만 쓰는 학생이 카드 창을 열면 닫는 방법이 ✕ 까지 Tab 으로 걸어가는
   *    것뿐이었다. 같은 저장소의 rulebook·coach·vfs·sheet 는 전부 Escape 를
   *    갖고 있다 — **한 제품 안에 기준이 두 벌**이었다.
   * 🔴 그리고 창 안에서 Tab 을 돌리면 **창 뒤의 인박스 카드로 새어 나갔다**(실측).
   *    그 카드는 6차가 `tabindex=0` 을 준 자리라, 거기서 Enter 를 치면 창이 하나
   *    더 열렸다. 「지금 이 창을 처리하는 중」이라는 맥락이 통째로 깨진다.
   *
   * 어디까지 가두는가 — **열린 창 전체(`#winLayer`)** 이지 창 하나가 아니다.
   *   업무 카드 창에서 📊 표를 열면 창이 둘이 된다. 창 하나에 가두면 그 표에
   *   키보드로 갈 수 없다. 그래서 Tab 은 열린 창들 사이를 자유롭게 돌되
   *   **바탕(인박스·독)으로는 넘어가지 않는다.** 나가는 문은 Escape 다.
   *
   * `aria-modal` 은 **일부러 안 붙인다.** 이 창들은 진짜 모달이 아니다 — 마우스로는
   *   바탕과 독을 그대로 쓸 수 있고, 창도 여러 개가 동시에 산다. `aria-modal="true"`
   *   를 붙이면 스크린리더에게 「이 창 말고는 아무것도 없다」고 **거짓말**을 하게 되고,
   *   창이 둘일 때는 그 말이 서로 모순된다. 대신 위의 가두기로 실제 동작을 맞춘다.
   * ======================================================================== */
  function visibleFocusables(){
    const layer = $('winLayer');
    if(!layer || typeof layer.querySelectorAll !== 'function') return [];
    return Array.prototype.filter.call(layer.querySelectorAll(FOCUSABLE_SEL), el => {
      if(el.disabled) return false;
      // 최소화된 창은 display:none 이라 offsetParent 가 없다 — Tab 대상이 아니다.
      return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    });
  }
  /* ==========================================================================
   * 🔴 가두는 것은 **대화상자**뿐이다 (2026-08-17 9차 QA-C)
   * --------------------------------------------------------------------------
   * 7차 D 의 가두기는 옳았지만 **끝나는 조건이 없었다.** 이 게임의 「📥 받은
   * 메일함」은 `default:true` 라 입장하는 순간 열리고 수업 내내 안 닫힌다
   * (desktop.js). 그래서 Tab 트랩이 **영구화**됐다 — QA 실측:
   *     ✕ → – → ⤢ → 받은 메일함 → 처리 완료 → [업무 카드] → 다시 ✕ (60번 눌러도 같다)
   * 독의 📕 사규집·💬 메신저·📮 코치 피드백, 상단바의 「업무 마치기」·메뉴,
   * 바탕화면 파일에 **키보드로는 한 번도 닿지 못했다.** 유일한 탈출구가 「주
   * 화면인 인박스를 닫는 것」이라면 그건 탈출구가 아니다. 「기준을 스스로
   * 찾아보게 한다」가 이 게임 학습 골격의 절반인데, 마우스를 못 쓰는 학생은
   * 코치 피드백을 한 번도 못 읽고 자기 하루를 마칠 수도 없었다.
   *
   * 가름의 기준은 `opts.keep` 이다. desktop.js 는 **독에 사는 앱 창**에만 그것을
   * 준다(닫아도 노드를 #stash 에 보관해 상태를 살리려고). 즉 `keep` 은 이미
   * 「이 창은 늘 떠 있는 바탕 같은 것」을 뜻한다 — 새 플래그를 만들지 않는다.
   *   · keep 창만 열려 있다 → **가두지 않는다.** 독·상단바·바탕까지 Tab 이 돈다.
   *   · 대화상자(업무 처리·전달·📊 표·자료 창)가 하나라도 열려 있다 → 종전대로
   *     `#winLayer` 안에 가둔다. 7차 D 가 막은 「창 뒤 카드에서 Enter」는 진짜
   *     사고였고, 그 맥락은 대화상자가 열려 있는 동안만 유효하다. 나가는 문은
   *     Escape 다(위 참고).
   * ======================================================================== */
  function hasDialogWin(){
    return Object.keys(WINS).some(function(id){
      const w = WINS[id];
      return !!(w && w.el && !w.min && !w.keep);
    });
  }

  /** 지금 맨 위에 있는(최소화 안 된) 창의 id. 없으면 null. */
  function topWinId(){
    let top = null, topZ = -1;
    Object.entries(WINS).forEach(([wid, w]) => {
      if(!w.el || w.min) return;
      const z = parseInt(w.el.style.zIndex || '0', 10) || 0;
      if(z >= topZ){ topZ = z; top = wid; }
    });
    return top;
  }
  /* ==========================================================================
   * 🔴 창을 닫으면 **그 카드로** 돌아간다 (2026-08-17 7차 검수 E)
   * --------------------------------------------------------------------------
   * 6차는 열기 전 노드를 `prevFocus` 에 담아 두고 닫을 때 `focus()` 했다.
   * 실측하면 **거의 항상 실패한다**: `ui/inbox.js` 의 `render()` 가 tasks·mailbox·
   * config 스냅샷마다(= host 틱마다) 목록을 `innerHTML` 로 다시 만들어,
   * 담아 둔 노드가 문서에서 빠진다(`document.body.contains(prevFocus) === false`).
   * 그러면 복원을 포기하고 포커스가 `<body>` 로 떨어졌다 —
   * 6차의 복원은 **아무 일도 안 일어나는 정지 화면에서만** 동작했다.
   *
   * 고침: 노드와 **함께 신원(선택자)** 을 적어 둔다. 노드가 살아 있으면 그것을,
   *   바뀌었으면 신원으로 **다시 찾아** 돌아간다. `data-key`(업무 카드)·
   *   `data-mail`(코치 메일)·`id` 는 다시 그려도 같은 값으로 돌아오는 이름이다.
   *   ui/inbox.js 의 `paintList` 복원(7차 1)과 **같은 규칙**이다.
   * ======================================================================== */
  const FOCUS_KEY_ATTRS = ['data-key', 'data-mail', 'data-folder', 'data-goapp'];
  function focusSigOf(el){
    if(!el || typeof el.getAttribute !== 'function') return null;
    for(const a of FOCUS_KEY_ATTRS){
      if(el.hasAttribute && el.hasAttribute(a)){
        const v = String(el.getAttribute(a)).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
        return '[' + a + '="' + v + '"]';
      }
    }
    if(el.id) return '#' + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id);
    return null;
  }

  /** 이 칸에 학생이 **쓴 것이 남아 있는가**(비어 있으면 잃을 것이 없다). */
  function hasTypedText(el){
    if(!el) return false;
    const tag = String(el.tagName || '').toUpperCase();
    if(tag === 'INPUT' || tag === 'TEXTAREA') return String(el.value || '').trim() !== '';
    if(el.isContentEditable === true) return String(el.textContent || '').trim() !== '';
    return false;
  }
  /* 문서 하나에 하나만 건다 — 창마다 걸면 창을 여닫을 때마다 쌓인다(§5-4).
     **버블 단계**로 받는다. 창 안 컴포넌트(📊 표의 셀 편집 취소, 📕 규정집의
     검색어 지우기, 🗂 저장 줄 닫기)가 자기 Escape·Tab 을 먼저 쓰고
     `preventDefault()`·`stopPropagation()` 하면 그쪽이 이긴다. 그것이 맞다 —
     안쪽의 뜻이 항상 더 구체적이다. */
  function onWinKey(e){
    if(!e || e.defaultPrevented) return;
    const key = e.key || e.code;
    if(key === 'Escape' || key === 'Esc'){
      const id = topWinId();
      if(id == null) return;
      const wi = WINS[id];
      let cur = null;
      try { cur = document.activeElement; } catch(err){ cur = null; }
      /* 🔴 **쓰던 글을 Escape 한 번에 날리지 않는다.** 업무 처리 창은 `keep` 이
         아니라, 닫는 순간 답안이 사라진다. 칸에 쓴 것이 있으면 첫 Escape 는
         포커스를 ✕ 로 옮기기만 한다 — 닫기 단추에 초점 테두리가 서므로
         「한 번 더 누르면(또는 Enter) 닫힌다」가 화면에 보인다. 두 번째
         Escape 는 그 자리가 버튼이라 아래 경로로 곧장 닫는다. */
      if(wi && wi.el && wi.el.contains(cur) && hasTypedText(cur)){
        e.preventDefault();
        const x = wi.el.querySelector('.win-x');
        if(x){ try { x.focus(); } catch(err){} }
        return;
      }
      e.preventDefault();
      closeWin(id);
      return;
    }
    if(key !== 'Tab') return;
    /* 늘 떠 있는 앱 창만 열려 있으면 **가두지 않는다**(위 hasDialogWin 머리말).
       독·상단바·바탕화면으로 Tab 이 나갈 수 있어야 키보드만 쓰는 학생이
       📕 사규집·📮 코치 피드백·업무 마치기에 닿는다. */
    if(!hasDialogWin()) return;
    const list = visibleFocusables();
    if(!list.length) return;                       // 열린 창이 없다 — 바탕 Tab 그대로
    let cur = null;
    try { cur = document.activeElement; } catch(err){ cur = null; }
    const layer = $('winLayer');
    const inside = !!(cur && layer && layer.contains(cur));
    const first = list[0], last = list[list.length - 1];
    if(!inside){
      /* 바탕에 있다가 Tab 을 쳤다 — 창으로 들여보낸다. 바탕을 그냥 돌게 두면
         「창 뒤 카드에서 Enter」 사고가 그대로 남는다. */
      e.preventDefault();
      try { (e.shiftKey ? last : first).focus(); } catch(err){}
      return;
    }
    if(!e.shiftKey && cur === last){ e.preventDefault(); try { first.focus(); }catch(err){} }
    else if(e.shiftKey && cur === first){ e.preventDefault(); try { last.focus(); }catch(err){} }
  }
  /* ⚠️ 문서가 이벤트를 받을 수 있을 때만 건다. 검사용 최소 DOM(tools/testdom.js)
     에는 문서 단위 리스너가 없다 — 없는 것을 부르면 모듈 로드 자체가 터져
     이 파일을 쓰는 **모든** 검사가 같이 죽는다(2026-08-17 실측).
     실제 동작은 헤드리스 크롬(tools/vfs-e2e.js E31~E33)이 눌러서 잰다. */
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('keydown', onWinKey);
  }
  /* 창 조작 버튼 — `title`(마우스 말풍선)과 `aria-label`(스크린리더)을 같이 준다.
     PURE — 문자열만 만든다(검사가 그대로 부른다). */
  function ctrlsHTML(){
    return '<span class="win-ctrls">' +
      '<button class="win-x" type="button" title="닫기" aria-label="창 닫기">✕</button>' +
      '<button class="win-min" type="button" title="최소화" aria-label="창 최소화">–</button>' +
      '<button class="win-max" type="button" title="최대화" aria-label="창 최대화">⤢</button>' +
      '</span>';
  }

  function openWin(id, title, node, opts={}){
    if(WINS[id]){
      /* 🔴 이미 열려 있는 창을 다시 열었다 (2026-08-17 7차 검수 7).
         `focusWin` 은 z-index 와 활성 클래스만 만진다 — DOM 포커스는 안 옮긴다.
         그래서 같은 메일을 두 번째로 여는 키보드 사용자에게는 **아무 일도 안
         일어난 것**이었다. 새로 여는 경로와 **같은 규칙**으로 들여보낸다. */
      focusWin(id);
      let pf0 = null;
      try { pf0 = document.activeElement || null; } catch(e){ pf0 = null; }
      if(opts.autoFocus !== false) focusInto(WINS[id].el, pf0);
      return WINS[id];
    }
    // 제목 없이 열면 독 라벨이 'undefined' 가 되고 학생이 창을 되찾을 수 없다.
    // 화면에는 대체 문자열을 쓰고, 호출자 실수는 콘솔에 남긴다.
    if(title == null || title === ''){
      console.warn('[windows] openWin(' + id + ') 제목 없음 — 독 라벨을 id 로 대체');
      title = String(id);
    }
    const w = document.createElement('div');
    w.className='win';
    const vw = innerWidth, vh = innerHeight;
    const ww = Math.min(opts.w||620, vw-24), wh = Math.min(opts.h||520, vh-84);
    w.style.width=ww+'px'; w.style.height=wh+'px';
    const off = (Object.keys(WINS).length%6)*28;
    w.style.left = Math.max(6,(opts.x!=null?opts.x:(vw-ww)/2-100+off))+'px';
    w.style.top  = Math.max(4,(opts.y!=null?opts.y:(vh-wh)/2-46+off))+'px';
    /* 이 창은 대화상자다 — 이름은 제목과 같다(setWinTitle 이 함께 갱신한다).
       tabindex="-1" 은 「Tab 순서에는 안 들어가지만 프로그램이 포커스를 줄 수는 있다」 */
    w.setAttribute('role','dialog');
    w.setAttribute('aria-label', String(title));
    w.setAttribute('tabindex','-1');
    w.innerHTML = '<div class="win-tt">' + ctrlsHTML() + '<span class="win-title"></span></div><div class="win-bd"></div>';
    /* XSS 방지: 제목 글자는 textContent 로만 넣는다(paintTitle · setWinTitle 과 동일).
       제목 앞 그림 문자는 독·바탕화면과 같은 그림으로 바뀐다(paintTitle 머리말). */
    paintTitle(w.querySelector('.win-title'), id, title, { iconKey: opts.iconKey || null });
    w.querySelector('.win-bd').appendChild(node);
    /* 창을 열기 **전에** 어디에 있었는지 적어 둔다 — closeWin 이 그 자리로 돌려준다.
       노드 참조 하나만으로는 부족하다(7차 검수 E) — `prevFocusSel` 머리말 참고. */
    let prevFocus = null;
    try { prevFocus = document.activeElement || null; } catch(e){ prevFocus = null; }
    const prevFocusSel = focusSigOf(prevFocus);
    /* 🔴 **어느 앱 안에서** 열었는지도 같이 적어 둔다 (2026-08-17 8차 검수 6).
       `data-key` 는 인박스 카드의 이름이지 문서 전체의 이름이 아니다 — 같은 값이
       두 곳에 있으면(목록 + 다른 앱) `document.querySelector` 는 먼저 나오는
       **엉뚱한 카드**로 포커스를 보낸다. 짝인 `ui/inbox.js` 의 복원(`restoreFocus`)
       은 이미 `c.querySelector` 로 **컨테이너 안**만 본다. 규칙을 맞춘다.
       담아 두는 것은 앱 컨테이너 노드다 — 창을 닫아도 desktop.js 가 붙들고 있어
       (`appNode`) 문서에서 빠지지 않는다.
       🔴 기준은 **`data-app-id` 속성**이지 `.app-body` 클래스가 아니다.
          desktop.js 는 둘 다 붙이지만, 인박스는 첫 렌더에서 컨테이너의
          `className` 을 통째로 덮어쓴다(`ui/inbox.js` render 의
          `c.className = 'oc-inbox' …`). 클래스로 찾으면 정작 이 고침이 겨냥한
          그 컨테이너에서만 조용히 안 걸린다(하네스 Q8-6a 가 잡았다).
          속성은 아무도 지우지 않는다. 클래스는 옛 화면을 위한 보조로만 둔다. */
    const prevFocusRoot = (prevFocus && typeof prevFocus.closest === 'function')
      ? prevFocus.closest('[data-app-id],.app-body') : null;
    $('winLayer').appendChild(w);
    scaleType(w);   /* 창 크기에 맞춰 글자 크기를 따라 키운다 — 아래 주석 참고 */
    WINS[id] = {el:w, node, title, keep:!!opts.keep, onClose:opts.onClose, min:false, max:false, natural:null,
                prevFocus, prevFocusSel, prevFocusRoot, iconKey: opts.iconKey || null};
    const tt = w.querySelector('.win-tt');
    tt.addEventListener('mousedown', e=>{
      if(e.target.closest('.win-ctrls')) return;
      focusWin(id);
      const wi = WINS[id];
      if(wi.max){ toggleMax(id); const nw=w.offsetWidth; w.style.left=Math.max(6,e.clientX-nw/2)+'px'; w.style.top='2px'; }
      const sx=e.clientX-w.offsetLeft, sy=e.clientY-w.offsetTop;
      let snapZone=null;
      const mv=ev=>{ w.style.left=Math.max(-w.offsetWidth+90,Math.min(innerWidth-70,ev.clientX-sx))+'px';
                     w.style.top =Math.max(0,Math.min(innerHeight-70,ev.clientY-sy))+'px';
                     snapZone = snapHint(ev.clientX, ev.clientY); };
      const up=()=>{ removeEventListener('mousemove',mv); removeEventListener('mouseup',up);
                     hideSnap(); if(snapZone) applySnap(id, snapZone); };
      addEventListener('mousemove',mv); addEventListener('mouseup',up);
    });
    tt.addEventListener('dblclick', e=>{ if(e.target.closest('.win-ctrls')) return; toggleMax(id); });
    w.addEventListener('mousedown', ()=>focusWin(id));
    w.querySelector('.win-x').onclick = ()=>closeWin(id);
    w.querySelector('.win-min').onclick = ()=>minimizeWin(id);
    w.querySelector('.win-max').onclick = ()=>toggleMax(id);
    addResizers(id, w);
    focusWin(id);
    /* 키보드·스크린리더 사용자를 창 안으로 들여보낸다(위 접근성 주석 참고). */
    if(opts.autoFocus !== false) focusInto(w, prevFocus);
    return WINS[id];
  }
  /* 활성 창 표시. theme.css 가 `.win:not(.is-active)` 로 신호등을 회색으로
     내리고 제목을 흐리게 한다(macOS 와 같다). 이 클래스를 아무도 안 붙이면
     `:not()` 이 **항상** 걸려 모든 창의 신호등이 영영 회색으로 남는다.
     2026-08-01 이전이 그 상태였다 — 빨강·노랑·초록이 한 번도 안 보였다. */
  function markActive(id){
    Object.entries(WINS).forEach(([wid,w])=>{
      if(!w.el) return;
      w.el.classList.toggle('is-active', wid === id && !w.min);
    });
  }
  function focusWin(id){ const wi=WINS[id]; if(!wi) return;
    if(wi.min){ wi.min=false; wi.el.style.display=''; }
    wi.el.style.zIndex = ++zTop; markActive(id); refreshTaskbar(id); }
  /* 창이 내려가거나 닫히면 활성 표시를 남은 창 중 맨 위로 넘긴다.
     안 넘기면 화면에 보이는 창이 있는데도 전부 회색(비활성)으로 남는다. */
  function activateTopmost(){
    let top=null, topZ=-1;
    Object.entries(WINS).forEach(([wid,w])=>{
      if(!w.el || w.min) return;
      const z = parseInt(w.el.style.zIndex||'0',10) || 0;
      if(z >= topZ){ topZ=z; top=wid; }
    });
    markActive(top);
  }
  function minimizeWin(id){ const wi=WINS[id]; if(!wi) return; wi.min=true; wi.el.style.display='none';
    activateTopmost(); refreshTaskbar(); }
  function updateMaxBtn(id){ const wi=WINS[id]; if(!wi) return; const b=wi.el.querySelector('.win-max');
    // ⤡ 복귀 / ⤢ 확대. `❐`·`▢` 는 획이 굵어 12px 점 안에서 뭉친다.
    // 스크린리더는 글리프가 아니라 aria-label 을 읽는다 — 말도 같이 바꾼다.
    if(b){ const lb = wi.max ? '이전 크기로' : '최대화';
      b.textContent = wi.max ? '⤡' : '⤢'; b.title = lb;
      b.setAttribute('aria-label', wi.max ? '창을 이전 크기로' : '창 최대화'); } }
  /* 최대화·스냅의 기준 크기 — 뷰포트가 아니라 **창 레이어의 실제 상자**를 쓴다.
     .win 의 좌표 원점이 #winLayer 이므로 innerWidth/innerHeight 로 재면
     상단바(학생)나 조작 스트립(관제 데스크톱) 높이만큼 아래로 삐져나간다.
     #winLayer 는 inset 으로 독(44px)을 이미 피하고 있어 clientHeight 가 곧
     쓸 수 있는 전부다. 레이어가 없으면 종전 값으로 폴백한다. */
  function layerBox(){
    const l = $('winLayer');
    if(l && l.clientWidth) return {w:l.clientWidth, h:l.clientHeight};
    return {w:innerWidth, h:innerHeight-44};
  }
  /* 크기를 바꾸는 경로에서는 글자 배율도 같이 맞춘다(scaleType 주석 참고) */
  function retype(id){ const wi = WINS[id]; if(wi && wi.el && wi.el._typeApply) wi.el._typeApply(); }

  function toggleMax(id){
    const wi=WINS[id]; if(!wi) return; const el=wi.el;
    if(wi.max){ if(wi.natural) Object.assign(el.style, wi.natural); wi.max=false; el.classList.remove('maxed'); }
    else { wi.natural={left:el.style.left, top:el.style.top, width:el.style.width, height:el.style.height};
      const b=layerBox();
      el.style.left='0px'; el.style.top='0px'; el.style.width=b.w+'px'; el.style.height=b.h+'px';
      wi.max=true; el.classList.add('maxed'); }
    updateMaxBtn(id); focusWin(id);
      retype(id);
  }
  /* ==========================================================================
   * 뷰포트가 바뀌면 열린 창을 상자 안으로 되돌린다 (2026-08-15, 전체화면 대응)
   * --------------------------------------------------------------------------
   * layerBox() 는 #winLayer 의 실제 상자를 매번 재므로 **새로 여는** 창은 알아서
   * 따라온다. 문제는 **이미 열려 있던** 창이다:
   *   · 전체화면을 켜면 최대화해 둔 창이 옛 크기 그대로라 오른쪽·아래에 빈 띠
   *   · 전체화면을 끄면(ESC 포함) 넓은 화면에서 놓아둔 창이 상자 밖으로 나가
   *     제목줄을 잡을 수 없고, 아래로 삐져나온 창은 독을 침범한다
   * 위치·크기를 상자 안으로 도로 접고, 글자 배율(retype)까지 같이 맞춘다.
   * 🔴 RTDB 읽기·쓰기 0. 새로 다는 리스너는 창 매니저의 resize 하나뿐이다.
   * ======================================================================== */
  function reflowWins(){
    const b = layerBox();
    const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
    /* 최대화를 풀 때 돌아갈 크기(natural)도 같이 접는다. 안 접으면 전체화면을
       끈 뒤 복귀 버튼을 눌렀을 때 창이 다시 화면 밖으로 걸어 나간다. */
    const fitNatural = n => {
      if(!n) return;
      const nw = Math.max(RZ_MIN_W, Math.min(num(n.width)  || RZ_MIN_W, b.w));
      const nh = Math.max(RZ_MIN_H, Math.min(num(n.height) || RZ_MIN_H, b.h));
      n.width  = nw + 'px'; n.height = nh + 'px';
      n.left = Math.max(0, Math.min(num(n.left), b.w - nw)) + 'px';
      n.top  = Math.max(0, Math.min(num(n.top),  b.h - nh)) + 'px';
    };
    Object.keys(WINS).forEach(id=>{
      const wi = WINS[id]; if(!wi || !wi.el) return;
      const el = wi.el;
      fitNatural(wi.natural);
      if(wi.max){
        el.style.left='0px'; el.style.top='0px';
        el.style.width=b.w+'px'; el.style.height=b.h+'px';
      } else {
        /* 최소화한 창은 display:none 이라 offset* 이 전부 0 이다 → style 값을 본다. */
        const cw = Math.max(RZ_MIN_W, Math.min(num(el.style.width)  || el.offsetWidth  || RZ_MIN_W, b.w));
        const ch = Math.max(RZ_MIN_H, Math.min(num(el.style.height) || el.offsetHeight || RZ_MIN_H, b.h));
        el.style.width = cw + 'px'; el.style.height = ch + 'px';
        el.style.left = Math.max(0, Math.min(num(el.style.left), b.w - cw)) + 'px';
        el.style.top  = Math.max(0, Math.min(num(el.style.top),  b.h - ch)) + 'px';
      }
      retype(id);
    });
  }
  /* resize 는 창 크기 조절 중 연달아 온다. 프레임당 한 번으로 묶는다. */
  let _reflowRaf = 0;
  addEventListener('resize', ()=>{
    if(_reflowRaf) return;
    _reflowRaf = requestAnimationFrame(()=>{ _reflowRaf = 0; reflowWins(); });
  });

  /* ---- 가장자리 스냅(윈도우식): 위=최대화, 좌/우=반쪽 ---- */
  let _snapEl=null;
  function snapRect(zone){
    const b = layerBox();
    if(zone==='max')   return {left:0, top:0, width:b.w, height:b.h};
    if(zone==='left')  return {left:0, top:0, width:Math.round(b.w/2), height:b.h};
    if(zone==='right') return {left:Math.round(b.w/2), top:0, width:Math.round(b.w/2), height:b.h};
    return null;
  }
  function snapHint(x,y){
    let zone = y<=6 ? 'max' : x<=6 ? 'left' : x>=innerWidth-6 ? 'right' : null;
    if(!zone){ hideSnap(); return null; }
    const r = snapRect(zone);
    if(!_snapEl){ _snapEl=document.createElement('div'); _snapEl.id='snapPreview'; $('winLayer').appendChild(_snapEl); }
    _snapEl.style.display='block';
    _snapEl.style.left=r.left+'px'; _snapEl.style.top=r.top+'px';
    _snapEl.style.width=r.width+'px'; _snapEl.style.height=r.height+'px';
    return zone;
  }
  function hideSnap(){ if(_snapEl) _snapEl.style.display='none'; }
  function applySnap(id, zone){
    const wi=WINS[id]; if(!wi) return; const el=wi.el; const r=snapRect(zone); if(!r) return;
    if(zone==='max'){ if(!wi.max) wi.natural={left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height};
      wi.max=true; el.classList.add('maxed'); }
    else { wi.max=false; el.classList.remove('maxed'); }
    el.style.left=r.left+'px'; el.style.top=r.top+'px'; el.style.width=r.width+'px'; el.style.height=r.height+'px';
    updateMaxBtn(id);
      retype(id);
  }
  /* 창이 아닌 **전체 화면 페이지**(2026-09-29 — 개인 성과 리포트가 창 대신 화면 전체를 쓴다)도
     같은 id 로 닫히게 한다. 부르는 쪽(main.js 「업무 마치기」·report.js 자동 열기·검사)은
     `closeWin('report-personal')` 한 줄 그대로다 — 닫는 문을 둘로 늘리지 않는다. */
  const PAGES = {};
  function registerPage(id, closer){ if(typeof closer === 'function') PAGES[id] = closer; else delete PAGES[id]; }
  function closeWin(id){
    const wi = WINS[id];
    if(!wi){ const pc = PAGES[id]; if(pc){ delete PAGES[id]; try{ pc(); }catch(e){} } return; }
    /* 🔴 글자 스케일 관찰자를 끊는다. 안 끊으면 창을 여닫을 때마다 ResizeObserver 가
       쌓여, 3시간 수업에서 죽은 노드를 붙든 관찰자가 계속 늘어난다. */
    if(wi.el && wi.el._typeRO){ try{ wi.el._typeRO.disconnect(); }catch(e){} wi.el._typeRO = null; }
    if(wi.keep){ const s=$('stash'); if(s) s.appendChild(wi.node); }   // guard: #stash optional
    wi.el.remove(); delete WINS[id];
    /* 🔴 포커스를 창을 열기 전 자리로 돌려준다(2026-08-17 6차 검수 · 7차 검수 E).
       안 돌려주면 창을 닫는 순간 포커스가 <body> 로 떨어져, 키보드 사용자는
       **데스크톱 처음부터 다시 Tab** 해야 한다. 카드 한 장을 처리할 때마다 그랬다.
       ① 담아 둔 노드가 아직 문서에 있으면 그것. ② 없으면(= 목록이 다시 그려졌다 —
          host 틱마다 일어난다) **신원으로 다시 찾아** 그 카드로. ③ 그래도 없으면
          아무것도 하지 않는다 — 엉뚱한 곳으로 튀는 것보다 낫다. */
    try {
      const pf = wi.prevFocus;
      let back = (pf && typeof pf.focus === 'function' &&
                  document.body && document.body.contains(pf)) ? pf : null;
      if(!back && wi.prevFocusSel){
        /* 열었던 앱 안에서만 찾는다(위 prevFocusRoot 주석). 그 앱이 사라졌으면
           문서 전체로 넓히지 않는다 — 엉뚱한 카드로 튀느니 아무 데도 안 간다. */
        const scope = (wi.prevFocusRoot && document.body && document.body.contains(wi.prevFocusRoot))
          ? wi.prevFocusRoot : (wi.prevFocusRoot ? null : document);
        const again = scope ? scope.querySelector(wi.prevFocusSel) : null;
        if(again && typeof again.focus === 'function') back = again;
      }
      /* 🔴 `preventScroll:true` — 인박스가 일부러 살려 둔 **목록 스크롤 위치**를
         창을 닫을 때마다 무너뜨리지 않는다(`ui/inbox.js` restoreFocus 와 같은 규칙).
         옛 브라우저는 인자를 무시할 뿐 예외를 던지지 않는다. */
      if(back) back.focus({ preventScroll: true });
    } catch(e){ /* 포커스 복원 실패는 무시 */ }
    if(wi.onClose) wi.onClose();
    activateTopmost();
    refreshTaskbar();
    if((id==='compose'||id==='work') && typeof drainFeedbackQueue==='function') setTimeout(drainFeedbackQueue, 250);
  }
  /* 제목 앞머리의 그림 문자를 아이콘으로 쓴다. 예: "📥 받은 메일함" → "📥"
     macOS 독처럼 아이콘만 두고 이름은 올려놓았을 때만 띄우기 위해서다.
     제목에 그림 문자가 없으면 창 모양을 기본 아이콘으로 쓴다. */
  function iconOf(title){
    const s = String(title || '').trim();
    // ⚠ `\P{ASCII}` 로 잡으면 한글도 걸린다("보고서" → "보"). 그림 문자만 본다.
    //   변형 선택자(️)·피부색·ZWJ 결합까지 한 덩어리로 자른다.
    const m = /^(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*)/u.exec(s);
    return (m && m[1]) ? m[1] : '🪟';
  }

  /* 창 id → `ui/appicon.js` 타일 키.
     🔴 2026-08-15 오너가 독 아이콘을 직접 지목해 바꾸라고 했다. 독은 왼쪽 「앱 칸」과
        오른쪽 「열린 창 칸」이 한 알약을 나눠 쓰므로, 앱 칸만 타일로 바꾸고 창 칸을
        그림 문자로 두면 **한 독 안에 두 언어**가 남는다(2026-08-08 오너: "강사아이콘은
        아직도 이상해"가 정확히 그 상태였다).
     학생 앱 창 id 는 desktop.js 가 'app-' 접두사로 만든다(app-inbox …).
     관제 앱 창 id 는 main.js 가 'host-' 접두사로 만들고, 그 표는 main.js 가 쥔다. */
  const WIN_ICON_KEY = {
    inbox: 'mail', coach: 'coach', messenger: 'messenger', rulebook: 'book'
  };
  /* 앱이 아닌 창 중 **승인 아이콘에 그 뜻의 그림이 있는 것**만(2026-09-29).
     [창 id 또는 접두사(-로 끝남), 키]. 표에 없는 창은 그림 없이 글자만 선다(paintTitle).
     부르는 쪽이 더 정확히 알면 openWin 의 opts.iconKey · setWinIcon 으로 덮는다
     (팀 자료의 비용/데이터 · 휴지통의 빈/찬 것 — main.js). */
  const WIN_ICON_PREFIX = [
    ['help', 'help'],                  // 22 ❓ 사용법 (ui/shell.js)
    ['handoff-', 'handoff'],           // 21 📤 업무 전달 (ui/handoff.js)
    ['present-view', 'present'],       // 23 📣 발표 보기 (ui/present.js)
    ['present-host', 'present'],       // 23 🎤 결과 보고회 (ui/present-host.js)
    ['inbox-mail-', 'mail'],           //  1 📮 받은 메일 (ui/inbox.js)
    ['inbox-task-', 'mail'],           //  1 📨·🔁 업무 처리 = 메일 회신 (ui/inbox.js)
    ['inbox-sheet-', 'sheet'],         // 10 업무 카드의 실무 시트 (ui/inbox.js)
    ['desk-sheet', 'sheet'],           // 10 바탕화면 「표 계산」 새 표 (main.js)
    ['deskdoc', 'doc'],                // 11 바탕화면 「문서」 새 문서 (main.js)
    ['teamdoc-', 'data'],              // 13 팀 자료 — 비용 자료는 main.js 가 setWinIcon('cost')
    ['file-', 'docFile'],              // 19 옛 문서 창 (ui/doc.js)
    ['desk-trash', 'trash']            // 17 휴지통 — 찬 것이면 main.js 가 setWinIcon('trashFull')
  ];
  /* 제목이 그림 문자로 시작하면 떼고 글자만 돌려준다. */
  function labelOf(title){
    const s = String(title == null ? '' : title);
    const ico = iconOf(s);
    return (ico !== '🪟' && s.indexOf(ico) === 0) ? s.slice(ico.length).trim() : s;
  }
  function iconKeyOf(id, title){
    const k = String(id || '');
    if (k.indexOf('app-') === 0) {
      /* 독이 그 앱에 쓴 키가 먼저다(desktop.js) — 독 버튼과 창 칸이 같은 그림이어야 한다. */
      const D = OC.ui.desktop;
      const own = (D && typeof D.iconKeyOf === 'function') ? D.iconKeyOf(k) : null;
      return own || WIN_ICON_KEY[k.slice(4)] || null;
    }
    /* 내가 저장한 파일(vfs-) — 표면 18번, 문서면 19번. 제목의 그림 문자가 종류를 말한다(ui/sheet.js 📊 · ui/doc.js 📄). */
    if (k.indexOf('vfs-') === 0) return /^📊/.test(String(title || '').trim()) ? 'sheetFile' : 'docFile';
    /* 자료 조각(frag-) — 바탕화면 아이콘과 **같은 규칙**(appicon.fragKey)으로 고른다. */
    if (k.indexOf('frag-') === 0) {
      const A = OC.ui.appicon;
      return (A && typeof A.fragKey === 'function') ? A.fragKey(labelOf(title)) : 'frag';
    }
    for (const [p, key] of WIN_ICON_PREFIX) {
      if (p.slice(-1) === '-' ? k.indexOf(p) === 0 : k === p) return key;
    }
    // 관제 앱은 main.js 가 답한다 — 표를 두 곳에 두지 않는다.
    return (OC.app && typeof OC.app.dockIconKeyFor === 'function')
      ? OC.app.dockIconKeyFor(k) : null;
  }

  /* ---- 창 제목 표시줄 아이콘 (2026-09-29 · 사용자 요청) -----------------------
     「📥 메일함」·「❓ 사용법」처럼 제목 앞에 그림 문자가 서 있었다. 독·바탕화면이 승인 입체
     아이콘으로 바뀌면서 **같은 창이 독에서는 그림, 제목 줄에서는 그림 문자**가 됐다.
     → 제목 줄도 독과 **같은 키**(iconKeyOf · opts.iconKey)의 그림을 18px 로 세운다.
       뜻이 맞는 그림이 없는 창은 그림 문자를 떼고 글자만 둔다(한 줄에 두 언어를 섞지 않는다).
     🔴 창의 제목 **문자열**(wi.title · aria-label · 독 말풍선)은 그대로다 — 그림 문자를 떼는 것은
        화면에 그리는 이 한 곳뿐이다(부르는 쪽·검사는 제목 글자를 그대로 쓴다).
     🔴 글자는 textContent(텍스트 노드)로만 넣는다 — 제목에는 학생이 지은 파일 이름이 들어온다. */
  function paintTitle(t, id, title, wi){
    if(!t) return;
    const s = String(title == null ? '' : title);
    t.textContent = '';
    const A = OC.ui.appicon;
    const key = (wi && wi.iconKey) || iconKeyOf(id, s);
    if (key && A && typeof A.has === 'function' && A.has(key)) {
      const ic = document.createElement('span');
      ic.className = 'win-ico';
      ic.setAttribute('aria-hidden', 'true');
      if (A.paint(ic, key, '')) t.appendChild(ic);
    }
    t.appendChild(document.createTextNode(labelOf(s) || s));
  }
  /* 부르는 쪽이 창 아이콘을 바꾼다 — 휴지통이 찼다/비었다 같은 상태가 바뀔 때. */
  function setWinIcon(id, key){
    const wi = WINS[id]; if(!wi) return;
    if (wi.iconKey === (key || null)) return;
    wi.iconKey = key || null;
    paintTitle(wi.el.querySelector('.win-title'), id, wi.title, wi);
    refreshTaskbar();
  }

  function refreshTaskbar(active){
    const tb = $('tbWins'); if(!tb) return;                            // guard: #tbWins may not be mounted
    tb.innerHTML='';
    Object.entries(WINS).forEach(([id,wi])=>{
      /* 🔴 2026-08-09 오너: 독에 같은 아이콘이 두 번 나왔다.
         왼쪽 앱 칸에 「상황판(실행 중 점)」이 있는데, 구분선 오른쪽 창 칸에
         「상황판」이 **또** 떴다. macOS 는 그러지 않는다 — 앱이 이미 자기
         아이콘으로 서 있으면 그 창을 따로 세우지 않고, 오른쪽에는 **최소화한
         창**만 둔다. 최소화는 "아이콘으로 접어 둔 것"이라 자리가 필요하다.
         그래서 독 앱이 대표하는 창은 최소화됐을 때만 여기 남긴다. */
      /* ⚠️ 아이콘 유무로 판정하지 않는다. 관제 독을 그림 문자로 통일하면서
         HOST_DOCK_ICONS 가 비었고, dockIconFor 로 보던 종전 판정은 그 순간
         항상 false 가 되어 **중복 방지가 조용히 풀렸다.** 등록 여부를 본다. */
      /* 🔴 2026-08-14 오너 스크린샷: **학생 화면에서도** 같은 중복이 났다.
         위의 OC.app.hasDockApp 은 `host-` 접두사(강사 관제 앱)만 본다. 학생 독
         (#dockApps)은 ui/desktop.js 가 따로 그리므로 저 판정에 걸릴 수가 없었고,
         학생이 앱을 열 때마다 왼쪽 앱 칸과 오른쪽 창 칸에 같은 아이콘이 두 번
         섰다. 독은 하나이므로 **두 등록처에 모두 물어야** 중복이 막힌다. */
      const hasDockApp = !!(OC.app && typeof OC.app.hasDockApp === 'function'
        && OC.app.hasDockApp(id))
        || !!(OC.ui.desktop && typeof OC.ui.desktop.hasDockApp === 'function'
        && OC.ui.desktop.hasDockApp(id));
      if (hasDockApp && !wi.min) return;
      const b=document.createElement('button');
      const title = wi.title || id;     // 제목이 없어도 'undefined' 를 찍지 않는다
      b.type = 'button';
      b.className = 'tb-win';
      const ico = iconOf(title);
      /* 🔴 2026-08-08 오너: "강사아이콘은 아직도 이상해"
         독에 컬러 앱 아이콘(관제 5개)과 그림 문자(열린 창)가 **섞여** 있었다.
         같은 독 안에서 두 종류가 보이면 그것부터 어긋나 보인다.
         학생·관제·열린 창이 **같은 한 곳**(OC.ui.appicon)을 거친다.
         표에 없는 창(빈 표·새 문서·결과 보고서 등)은 종전대로 그림 문자다. */
      const A = OC.ui.appicon;
      const key = wi.iconKey || iconKeyOf(id, title);
      if (A && typeof A.paint === 'function' && key) A.paint(b, key, ico);
      else b.textContent = ico;
      // 말풍선에는 아이콘을 빼고 이름만. 아이콘은 바로 아래에 이미 보인다.
      const label = (title.indexOf(ico) === 0) ? title.slice(ico.length).trim() : title;
      // 이름은 CSS 말풍선으로 띄운다. title 속성을 같이 주면 브라우저 기본
      // 툴팁이 겹쳐 두 개가 뜬다 → aria-label 만 남긴다.
      b.setAttribute('data-label', label || title);
      b.setAttribute('aria-label', label || title);
      if(wi.min) b.classList.add('min');
      if(id===active && !wi.min) b.classList.add('on');
      b.onclick = ()=>focusWin(id);
      tb.appendChild(b);
    });
  }

  /* Title accessor for sheet.js/doc.js rename handlers (WINS stays internal). */
  function setWinTitle(id, title){
    const wi = WINS[id]; if(!wi) return;
    wi.title = title;
    paintTitle(wi.el.querySelector('.win-title'), id, title, wi);
    // 대화상자 이름도 같이 바꾼다 — 안 바꾸면 스크린리더가 옛 제목을 계속 읽는다.
    wi.el.setAttribute('aria-label', String(title));
    refreshTaskbar();
  }

  /* ---- 데스크톱 우클릭 메뉴 ---- */
  let _ctxEl=null;
  function showCtxMenu(x, y, items){
    hideCtxMenu();
    const el=document.createElement('div'); el.className='ctx-menu';
    items.forEach(it=>{
      if(it==='-'){ const s=document.createElement('div'); s.className='sep'; el.appendChild(s); return; }
      const b=document.createElement('button'); b.textContent=it.label;
      if(it.danger) b.classList.add('danger');
      b.onclick=()=>{ hideCtxMenu(); it.fn(); };
      el.appendChild(b);
    });
    document.body.appendChild(el);
    const r=el.getBoundingClientRect();
    el.style.left=Math.min(x, innerWidth-r.width-6)+'px';
    el.style.top =Math.min(y, innerHeight-r.height-6)+'px';
    _ctxEl=el;
  }
  function hideCtxMenu(){ if(_ctxEl){ _ctxEl.remove(); _ctxEl=null; } }
  addEventListener('mousedown', e=>{ if(_ctxEl && !_ctxEl.contains(e.target)) hideCtxMenu(); });

  /* ---- expose public API ---- */
  OC.ui.openWin = openWin;
  OC.ui.focusWin = focusWin;
  OC.ui.minimizeWin = minimizeWin;
  OC.ui.closeWin = closeWin;
  OC.ui.registerPage = registerPage;
  OC.ui.refreshTaskbar = refreshTaskbar;
  OC.ui.setWinIcon = setWinIcon;
  OC.ui.showCtxMenu = showCtxMenu;
  OC.ui.setWinTitle = setWinTitle;
  /* 🔴 `toggleMax` · `hideCtxMenu` 는 여기서 내리지 않는다(2026-08-17 6차 검수).
     저장소 전체에서 밖에서 부르는 곳이 **0건**이었다(제목줄 더블클릭·⤢ 버튼·
     바탕 클릭이 전부 이 파일 안에서 부른다). 「공개 API」라고 적어 두면 다음
     사람이 그 말을 믿고 계약으로 여긴다 — 안 쓰는 문은 닫아 둔다.
     다시 필요해지면 그때 한 줄 되살리면 된다. */
  /* 접근성 회귀 검사용 PURE 노출 — DOM 없이 그대로 부른다(join-chat-rules.test.js). */
  OC.ui._winCtrlsHTML = ctrlsHTML;
  OC.ui._firstFocusable = firstFocusable;
  OC.ui._FOCUSABLE_SEL = FOCUSABLE_SEL;
  /* 뷰포트가 바뀌었을 때 열린 창을 상자 안으로 되돌린다(전체화면 진입·이탈).
     shell.js 의 fullscreenchange 가 부른다. */
  OC.ui.reflowWins = reflowWins;
  /* 열린 창 목록 — 상단바 「보기」 메뉴가 쓴다. WINS 자체는 계속 내부에 둔다
     (밖에서 직접 고치면 독·z-index 가 어긋난다). 복사본만 넘긴다. */
  OC.ui.listWins = function(){
    return Object.entries(WINS).map(([id,wi]) => ({
      id: id, title: wi.title || id, min: !!wi.min, max: !!wi.max
    }));
  };
  /* 🔴 「이 id 로 창이 이미 열려 있는가」 — 창을 만드는 쪽이 **만들기 전에** 묻는 문.
     `openWin` 은 이미 열린 id 를 만나면 `focusWin` 만 하고 돌아간다(위 :131).
     그 말은 그때 넘긴 `opts.onClose` 를 **저장하지 않는다**는 뜻이다. 그래서
     호출부가 창을 만들면서 구독(vfs.onChange · 전역 keydown …)을 걸어 두고
     해제를 onClose 에 실어 보내면, 같은 카드를 다시 클릭하는 것만으로 해제가
     통째로 버려지고 구독만 쌓인다(2026-08-16 3차 검수).
     → 알맹이를 만들기 **전에** 여기서 묻고, 이미 있으면 focusWin 만 한다.
     ⚠️ 밖에서 WINS 를 만지지 못하게 boolean 만 돌려준다. */
  OC.ui.winExists = function(id){ return !!WINS[id]; };
})();
