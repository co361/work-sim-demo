/* ==========================================================================
   사내 메신저 — PC 바탕화면 안의 앱 하나.

   대표 지적 두 번
     ① "컴퓨터에서 볼 수 있게 해줘. 그냥 이렇게 뜨는 거 어색하잖아"
        → 전자 메시지는 3D 위에 띄우지 않고 전부 이 창으로 모은다.
     ② "너무 산만해. 메신저와 이메일은 분리된 창에서 떴으면 좋겠고."
        "메신저는 카톡처럼 그냥 화면 채워지는 막대로 있고, 누르면 창 바로 뜨면 될 것
         같아. 「열어 보기」 이런 건 의미 없을 듯."
        → 대화 목록은 창을 가득 채우는 가로 막대, 줄을 누르면 곧바로 대화가 열린다.
          말풍선이 위아래로 쌓이고(상대 왼쪽 · 나 오른쪽), 답할 것이 있으면 창 아래에
          선택지나 짧은 입력칸이 붙는다. 말풍선 안의 「열어 보기」 단추는 없앴다.

   경계선 하나만 지킨다
     전자 메시지(메신저 카드·자리에 없는 사람의 한 줄) → **여기, 컴퓨터 안**
     대면 대화(브리핑·디브리프·걸어가서 하는 이야기)  → **3D 대화 모드**
     전화                                              → 전화 벨 · 전화 메모 앱

   57차 대화별 대기열(logi 3차 발견 · done-logi 3-4 ①)
     예전에는 대화(보낸 사람)마다 답할 카드를 **하나만** 잡았다(pending). 같은 사람의 새 메신저 카드가
     앞 카드를 끝내기 전에 오면 앞 카드는 대화에서 빠져 답할 길이 없었고(whoOf=null), 메신저 말고는 열 곳이
     없어 하루 끝에 미처리로 남았다(logi 5화 lg23·lg38 등 10팀 23쌍 — docs/ncs57/msg-queue-done.md).
     이제 대화마다 온 카드를 차례대로 모아 두고(cards) 끝나지 않은 건은 모두 답할 수 있다.
       · 대화 아래 행동은 **고른 건** 하나에 붙는다. 따로 고르지 않으면 먼저 온 건부터(끝내면 다음 건).
       · 한 대화에 카드가 둘 이상이면 아래 칸 맨 위에 「남은 일 N건」과 건마다 단추(도착 시각 · 제목)가 붙는다.
         단추나 그 건의 말풍선을 누르면 그 건을 고른다. 고른 건의 말풍선에는 테두리가 붙는다.
         이 표시는 **어느 건인지**만 알린다 — 처리 단추 강조·할 일 안내는 없다(정답 노출 금지 원칙).
       · 끝난 건은 단추에서 빠진다(다시 답하지 않는다). 쓰던 글은 건마다 따로 보관한다.
     W-7(QA-human) 배지
       · 열어 둔 대화에 새 줄이 와도 메신저 창이 **맨 앞(활성)** 이 아니면 안 읽음으로 센다(독 배지 · PC 단추 점).
         창을 닫아 둔 때(판이 보관함 #stash 에 있다)·PC 를 끈 때도 마찬가지다.
         메신저 창을 누르거나 앞으로 가져오면(판이 다시 보이면) 그 대화를 읽은 것으로 한다.
       · 앞 건이 아직 열려 있을 때 온 건은 고를 때까지 그 단추에 빨간 점(새 건).
       · 스크롤 자리는 대화마다 기억한다 — 판이 숨었다 다시 보여도(PC 끄고 켜기 · 창 닫았다 열기) 보던 자리로.
       · 새로고침(이어 하기) 뒤에도 대화가 그대로 — 이 기기에 대화 기록을 남겨 두고(store) 이어 하기 때 되살린다.
         기록이 없거나 카드·끝난 건이 어긋나면(다른 기기 등) 카드로 다시 쌓는다. 어느 쪽이든 끝난 건은 읽은 것으로 한다.

   채점은 하지 않는다. 창 아래 행동은 `window.msgActions(cardId, footEl)`(js/play/cards.js)가
   그리고, 실제 채점은 엔진의 기존 함수(sendCompose · doButton · doAsk)가 그대로 한다.
   카드가 아직 열려 있는지(답할 수 있는지)는 `window.msgOpen(cardId)`(cards.js)에 묻는다.

   바깥에 내는 것
     Msg.push(who, text, {team, mine, note, cls, card})   대화에 한 줄 넣기
     Msg.card(card)                                  메신저 카드 도착(본문이 그대로 쌓인다 · 그 대화의 대기열 끝에)
     Msg.mine(who, text, cardId?)                    내가 보낸 말
     Msg.note(who, text, cls?, cardId?)              가운데 한 줄(결과 등 — 카드가 둘 이상인 대화에서는 그 건 제목이 앞에 붙는다)
     Msg.open(who, cardId?) · Msg.pick(who, cardId) · Msg.list() · Msg.unread() · Msg.reset() · Msg.refresh()
     Msg.whoOf(cardId)                               그 카드가 쌓인 대화(끝난 카드도)
     Msg.draft(who, v?, cardId?)                     쓰던 답장(cardId 를 주면 그 건 것)
     Msg.seen(cardId)                                그 카드의 줄을 읽은 것으로
     Msg.store(keyFn, dayFn) · Msg.hold(on) · Msg.restore()   이 기기 대화 기록(이어 하기 — js/play/pc.js 가 잇는다)
     Msg.onOpen(fn)  창을 앞으로 가져와야 할 때
     Msg.onPick(fn)  보고 있는 대화의 고른 건이 바뀔 때 (who, cardId) — 사수 메모를 그 건 것으로
     Msg.onChange(fn) 안 읽은 개수가 바뀔 때(독 배지 · PC 단추 점)
   ========================================================================== */
(function (global) {
  'use strict';

  /* who -> {who, team, items:[], cards:[카드 id — 온 차례], sel:고른 건|null, fresh:{카드:1 — 줄 선 새 건},
             subj:{카드:제목}, drafts:{카드:쓰던 글}, draft:카드 없이 쓰던 글} */
  var THREADS = {};
  var ORDER = [];         /* 최근 온 사람이 앞 */
  var cur = null;         /* 지금 열어 둔 대화(없으면 목록 화면) */
  var root = null;        /* 창 안에 그려 둔 판(창을 닫아도 살아 있다) */
  var changed = [];
  var picked = [];
  var wantOpen = null;
  var shown = '';         /* 마지막으로 알린 「대화|고른 건」 — 바뀔 때만 onPick */
  var scrollTo = null;    /* 다음 그림에서 이 건의 첫 말풍선이 보이게 */
  var wantScroll = null, scrollTimer = null;   /* 아직 안 한 스크롤 {who, card | end | top} — 한 틱에 여러 번 그려도 의도를 잃지 않게 */
  var scrollMem = {};     /* 대화마다 마지막 스크롤 {card | end | top} — 사람이 굴리거나 우리가 옮길 때 적는다.
                             창이 숨었다 다시 보이면(PC 끄고 켜기·최소화·닫았다 열기) 목록 DOM 은 맨 위로 돌아가 있어 DOM 에서 읽으면 안 된다 */
  var drawnLen = {};      /* 대화마다 마지막으로 그린 줄 수 — 새 줄이 왔을 때만 맨 아래로 */
  var drawnWho = null;    /* 지금 판에 그려져 있는 대화 */
  var winEl = null, winObs = null;
  var tabAt = 0;          /* 마지막으로 Tab 을 누른 때 — 그 직후의 포커스만 「사람이 키보드로 들어옴」(코드가 옮긴 포커스는 거른다) */
  var storeKey = null, storeDay = null, holding = false;
  var own = Object.prototype.hasOwnProperty;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  /* 게임 시각(분)을 시계로. play.html 의 fmtClock 이 있으면 그것을 쓴다 */
  function clock() {
    try { if (typeof global.fmtClock === 'function' && global.S) return global.fmtClock(global.S.t); }
    catch (e) {}
    return '';
  }
  /* 카드가 온 시각 — 게임이 적어 둔 도착 시각(메일함 목록과 같은 값 · 이어 하기로 다시 쌓을 때도 제 시각. 예전에는 다시 쌓은 시각으로 전부 같아졌다) */
  function arrivedClock(id) {
    try { var st = global.S && global.S.cards && global.S.cards[id]; if (st && st.arrivedAt != null && typeof global.fmtClock === 'function') return global.fmtClock(st.arrivedAt); }
    catch (e) {}
    return '';
  }
  /* 「윤하린 (물류팀)」 처럼 팀이 괄호 안에 붙어 오는 이름을 나눈다.
     괄호가 겹친 이름(「김기사 ((주)한빛방재)」 — ga 6화)은 끝 괄호의 짝을 거꾸로 세어 찾는다(예전에는 통째로 한 이름이 됐다) */
  function split(from) {
    var s = String(from == null ? '' : from).trim();
    var m = s.match(/^(.+?)\s*\(([^()]+)\)$/);
    if (m) return { who: m[1].trim(), team: m[2].trim() };
    if (s.charAt(s.length - 1) === ')') {
      for (var i = s.length - 1, d = 0; i >= 0; i--) {
        var ch = s.charAt(i);
        if (ch === ')') d++;
        else if (ch === '(' && --d === 0) { var w = s.slice(0, i).trim(); if (w) return { who: w, team: s.slice(i + 1, -1).trim() }; break; }
      }
    }
    return { who: s || '동료', team: '' };
  }
  function info(who) {
    try { return (typeof global.npcInfo === 'function' && global.npcInfo(who)) || null; } catch (e) { return null; }
  }
  function faceEl(who) {
    var box = el('span', 'fa');
    var v = info(who);
    var src = '';
    try { if (v && v.ch && typeof global.avatarPic === 'function') src = global.avatarPic(v.ch); } catch (e) {}
    if (src) { var im = document.createElement('img'); im.src = src; im.alt = ''; box.appendChild(im); return box; }
    box.textContent = emoji(who, v);
    return box;
  }
  /* 얼굴 그림이 없을 때의 자리표시 — 2026-09-29 그림 문자(🧑‍💼·🙋·🧑‍💻·💬)를 빼고 **이름 첫 글자**로.
     (사용자: 뜻이 맞는 승인 그림이 없는 그림 문자는 빼고 글자만) */
  function emoji(who) {
    var s = String(who || '').replace(/^[\s(（]+/, '');
    return s ? s.charAt(0) : '·';
  }

  function thread(who, team) {
    var t = THREADS[who];
    if (!t) t = THREADS[who] = { who: who, team: team || '', items: [], cards: [], sel: null, fresh: {}, subj: {}, drafts: {}, draft: '' };
    if (team && !t.team) t.team = team;
    return t;
  }
  function unreadOf(t) {
    var n = 0;
    for (var i = 0; i < t.items.length; i++) if (!t.items[i].read && !t.items[i].mine && !t.items[i].note) n++;
    return n;
  }
  function unread() {
    var n = 0;
    for (var k in THREADS) if (own.call(THREADS, k)) n += unreadOf(THREADS[k]);
    return n;
  }
  function fire() { for (var i = 0; i < changed.length; i++) { try { changed[i](unread()); } catch (e) {} } }
  function bump(who) {
    var i = ORDER.indexOf(who);
    if (i >= 0) ORDER.splice(i, 1);
    ORDER.unshift(who);
  }

  /* ---------- 대기열 ---------- */
  /* 이 카드에 아직 답할 수 있는가 — 게임의 판정(cards.js msgOpen: 도착했고 끝나지 않음)을 쓴다.
     없으면(옛 판) 행동을 한 번 그려 보고 판단한다 */
  function isOpen(id) {
    if (!id) return false;
    if (typeof global.msgOpen === 'function') { try { return !!global.msgOpen(id); } catch (e) { return false; } }
    if (typeof global.msgActions === 'function') { try { return !!global.msgActions(id, document.createElement('div')); } catch (e2) { return false; } }
    return false;
  }
  function openCards(t) {
    var out = [];
    for (var i = 0; i < t.cards.length; i++) if (isOpen(t.cards[i])) out.push(t.cards[i]);
    return out;
  }
  /* 대화 아래 행동이 붙는 건 — 고른 건이 아직 열려 있으면 그것, 아니면 먼저 온 건부터 */
  function selOf(t) {
    var open = openCards(t);
    if (!(t.sel && open.indexOf(t.sel) >= 0)) t.sel = open.length ? open[0] : null;
    return t.sel;
  }
  function firstItem(t, id) {
    for (var i = 0; i < t.items.length; i++) if (t.items[i].card === id && !t.items[i].mine && !t.items[i].note) return t.items[i];
    return null;
  }

  /* ---------- 넣기 ---------- */
  function add(who, item, team) {
    var t = thread(who, team);
    item.at = item.at || clock();
    /* 보고 있는 대화(열려 있고 메신저 창이 맨 앞)에 온 줄만 곧바로 읽은 것 — 창이 뒤에 있으면 배지로 센다(W-7) */
    item.read = !!(item.mine || item.note) || looking(who);
    t.items.push(item);
    bump(who);
    render(); fire(); save();
    return t;
  }
  function push(who, text, opts) {
    opts = opts || {};
    var s = split(who);
    return add(s.who, { text: String(text == null ? '' : text), mine: !!opts.mine, note: !!opts.note, cls: opts.cls || '', card: opts.card || null },
      opts.team || s.team);
  }
  function mine(who, text, cardId) { var s = split(who); return add(s.who, { text: String(text || ''), mine: true, card: cardId || null }, s.team); }
  function note(who, text, cls, cardId) { var s = split(who); return add(s.who, { text: String(text || ''), note: true, cls: cls || '', card: cardId || null }, s.team); }

  /* 메신저 카드가 도착했다 — 제목이 아니라 **본문이 그대로** 대화에 쌓인다. 앞 건이 아직 열려 있으면 줄을 선다(새 건 표시) */
  function card(c) {
    if (!c) return;
    var s = split(c.from);
    var t = thread(s.who, s.team || c.teamName || '');
    if (t.cards.indexOf(c.id) >= 0) return t;              /* 같은 카드를 두 번 쌓지 않는다 */
    if (openCards(t).length) t.fresh[c.id] = 1;
    t.cards.push(c.id);
    t.subj[c.id] = String(c.subj || '').trim();
    var body = String(c.body || '').trim(), at = arrivedClock(c.id);
    if (c.subj && body.indexOf(c.subj) < 0) add(s.who, { text: c.subj, card: c.id, at: at }, t.team);
    if (body) add(s.who, { text: body, card: c.id, at: at }, t.team);
    else if (!c.subj) add(s.who, { text: '(내용 없음)', card: c.id, at: at }, t.team);
    return t;
  }

  function markRead(who) {
    var t = THREADS[who];
    if (!t) return;
    for (var i = 0; i < t.items.length; i++) t.items[i].read = true;
  }
  /* 그 카드의 줄을 읽은 것으로 — 끝난 건(이어 하기로 다시 쌓을 때 등) */
  function seen(cardId) {
    var w = whoOf(cardId);
    if (!w) return;
    var t = THREADS[w], n = 0;
    for (var i = 0; i < t.items.length; i++) { var it = t.items[i]; if (it.card === cardId && !it.read) { it.read = true; n++; } }
    delete t.fresh[cardId];
    if (n) { render(); fire(); save(); }
  }
  /* 창이 화면에 실제로 보이는가 — 창을 닫아 두면 읽은 것으로 치면 안 된다.
     창을 닫으면 판은 보관함(#stash)으로 간다 — display 가 아니라 화면 밖 위치로 숨겨 offsetParent 가 살아 있다(예전에는 닫힌 창도 「보임」이었다) */
  function visible() {
    if (!root || !root.isConnected) return false;
    if (root.closest && root.closest('#stash')) return false;
    return !!root.offsetParent;
  }
  /* 메신저 창이 맨 앞(활성)인가 — windows.js 가 활성 창에 is-active 를 붙인다. 창 관리자가 없는 판(시험)만 보이면 앞으로 본다 */
  function active() {
    var w = root && root.closest ? root.closest('.win') : null;
    if (w) return w.classList.contains('is-active');
    return !document.getElementById('winLayer');
  }
  function looking(who) { return !!who && cur === who && visible() && active(); }
  /* 메신저 창을 누르거나 앞으로 가져오면 — 열린 대화를 읽은 것으로(W-7: 예전에는 대화가 열려 있기만 하면 뒤에 있어도 곧바로 읽음이라 배지가 안 떴다) */
  function touch() {
    if (!cur || !THREADS[cur] || !visible() || !active()) return;   /* 코드가 옮긴 포커스(검산 칸 자동 포커스 등)로 뒤에 있는 창이 읽음이 되지 않게 — 창을 누르면 is-active 가 붙은 뒤 다시 온다 */
    if (unreadOf(THREADS[cur])) { markRead(cur); fire(); save(); }
    notePick();
  }
  function watchWin() {
    var w = root && root.closest ? root.closest('.win') : null;
    if (w === winEl) return;
    if (winObs) { try { winObs.disconnect(); } catch (e) {} winObs = null; }
    winEl = w;
    if (w && typeof MutationObserver === 'function') {
      winObs = new MutationObserver(function () { if (w.classList.contains('is-active')) touch(); });
      winObs.observe(w, { attributes: true, attributeFilter: ['class'] });
    }
  }
  /* 보고 있는 대화의 고른 건이 바뀌었으면 알린다(pc.js — 사수 메모를 그 건 것으로) */
  function notePick() {
    if (!cur || !THREADS[cur] || !looking(cur)) return;
    var id = THREADS[cur].sel, k = cur + '|' + (id || '');
    if (k === shown) return;
    shown = k;
    if (id) for (var i = 0; i < picked.length; i++) { try { picked[i](cur, id); } catch (e) {} }
  }

  /* ---------- 화면 ---------- */
  function mount(container) {
    container.classList.add('msgApp');
    root = container;
    container.addEventListener('mousedown', touch, true);
    /* 키보드로(Tab) 메신저 창에 들어오면 그 창을 앞으로 — windows.js 는 누르기·독으로만 창을 앞으로 가져온다 */
    document.addEventListener('keydown', function (e) { if (e && e.key === 'Tab') tabAt = Date.now(); }, true);
    container.addEventListener('focusin', function () { if (Date.now() - tabAt < 400) raise(); touch(); });
    /* 판이 다시 화면에 나오면(PC 켜기 · 창 되살리기 · 닫았다 열기) 보던 스크롤 자리로 되돌리고, 맨 앞 창이면 읽은 것으로 */
    if (typeof global.IntersectionObserver === 'function') {
      try { new global.IntersectionObserver(function (es) { for (var i = 0; i < es.length; i++) if (es[i].isIntersecting) { reshow(); break; } }).observe(container); } catch (e) {}
    }
    render();
    return root;
  }
  function raise() {
    var w = root && root.closest ? root.closest('.win') : null;
    if (!w || w.classList.contains('is-active')) return;
    try { w.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); } catch (e) {}   /* 창 요소의 mousedown → focusWin(windows.js) — 창 id 를 몰라도 된다 */
  }
  function reshow() {
    var body = root && root.querySelector('.msgBody');
    if (body && drawnWho) placeScroll(body, scrollMem[drawnWho] || { end: true });
    touch();
  }
  /* 대화창 아래 입력칸은 창을 다시 그릴 때마다 새로 만들어진다. 쓰던 글과 커서 자리를
     지키지 않으면 상대가 한 줄 보낼 때마다 내가 쓰던 답장이 사라진다 — 실제로 그랬다.
     (글은 건마다 draft 로 보관하고, 여기서는 포커스·커서만 — 같은 건을 그릴 때만 되돌린다) */
  function render() {
    if (!root) return;
    var a = document.activeElement, keep = null;
    var f0 = root.querySelector('.msgFoot');
    if (a && f0 && f0.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName)) {
      keep = { card: f0.getAttribute('data-card'), i: [].indexOf.call(f0.querySelectorAll('textarea, input'), a), s: a.selectionStart, e: a.selectionEnd };
    }
    /* 건 단추에 포커스가 있었으면(키보드로 고름) 같은 단추로 되돌린다 */
    var chipKeep = (a && root.contains(a) && a.classList && a.classList.contains('ch')) ? a.getAttribute('data-card') : null;
    root.innerHTML = '';
    root.appendChild(el('div', 'msgHd', '대화'));
    var list = el('div', 'msgList');
    root.appendChild(list);
    if (!ORDER.length) {
      list.appendChild(el('div', 'msgEmpty', '아직 온 메시지가 없어요.\n동료가 보내면 여기에 쌓입니다.'));
    }
    ORDER.forEach(function (who) {
      var t = THREADS[who];
      var last = t.items[t.items.length - 1] || { text: '' };
      var n = unreadOf(t);
      var b = el('button', 'msgBar' + (n ? ' un' : ''));
      b.type = 'button';
      b.appendChild(faceEl(who));
      var mid = el('span', 'mid');
      var nm = el('span', 'nm');
      nm.appendChild(el('b', null, who));
      if (t.team) nm.appendChild(el('small', null, t.team));
      mid.appendChild(nm);
      mid.appendChild(el('span', 'ls', (last.mine ? '나: ' : '') + last.text));
      b.appendChild(mid);
      var rt = el('span', 'rt');
      rt.appendChild(el('span', 'tm', last.at || ''));
      if (n) rt.appendChild(el('span', 'nb', String(n)));
      b.appendChild(rt);
      b.onclick = function () { open(who); };
      list.appendChild(b);
    });
    drawnWho = null;
    if (cur && THREADS[cur]) { root.appendChild(conv(cur)); drawnWho = cur; }
    if (keep && keep.i >= 0) {
      var f1 = root.querySelector('.msgFoot');
      var x = f1 && f1.getAttribute('data-card') === keep.card ? f1.querySelectorAll('textarea, input')[keep.i] : null;
      if (x) { try { x.focus(); if (keep.s != null && x.setSelectionRange) x.setSelectionRange(keep.s, keep.e); } catch (e) {} }
    }
    if (chipKeep) {
      var chs = root.querySelectorAll('.msgPick .ch');
      for (var j = 0; j < chs.length; j++) if (chs[j].getAttribute('data-card') === chipKeep) { try { chs[j].focus(); } catch (e) {} break; }
    }
    watchWin();
    notePick();
  }
  function conv(who) {
    var t = THREADS[who];
    var open = openCards(t);
    var sel = selOf(t);
    var multi = t.cards.length > 1;
    if (sel && t.fresh[sel] && looking(who)) delete t.fresh[sel];   /* 보고 있는 대화에서 차례가 온 건은 더 이상 새 건이 아니다 */
    var box = el('div', 'msgConv');
    var top = el('div', 'msgTop');
    var back = el('button', 'back', '‹ 목록');
    back.type = 'button';
    back.onclick = function () { cur = null; render(); };
    top.appendChild(back);
    top.appendChild(faceEl(who));
    var nm = el('span');
    nm.appendChild(el('b', null, who));
    if (t.team) nm.appendChild(el('small', null, t.team));
    top.appendChild(nm);
    box.appendChild(top);

    var body = el('div', 'msgBody');
    /* 사람이 굴린 자리를 적어 둔다(보일 때만 — 숨은 판은 DOM 스크롤이 0 으로 돌아가 있다) */
    body.addEventListener('scroll', function () {
      if (!body.isConnected || drawnWho !== who || !visible()) return;   /* 다시 그려 떨어져 나간 옛 목록의 늦은 이벤트(치수 0 — 「맨 아래」로 잘못 적힘)는 버린다 */
      scrollMem[who] = (body.scrollHeight - body.scrollTop - body.clientHeight < 6) ? { end: true } : { top: body.scrollTop };
    });
    var firstRow = {};   /* 카드마다 첫 말풍선이 있는지(스크롤 대상) */
    t.items.forEach(function (it) {
      if (it.note) {
        /* 카드가 둘 이상인 대화 — 결과 한 줄이 어느 건 것인지 제목을 앞에 붙인다 */
        var tx = (multi && it.card && t.subj[it.card]) ? '「' + clip(t.subj[it.card], 20) + '」 ' + it.text : it.text;
        body.appendChild(el('div', 'msgNote ' + (it.cls || ''), tx));
        return;
      }
      var cls = 'msgRow' + (it.mine ? ' me' : '');
      var can = false;
      if (multi && it.card && !it.mine) {
        if (it.card === sel) cls += ' pick';
        else if (open.indexOf(it.card) >= 0) { cls += ' can'; can = true; }
      }
      var row = el('div', cls);
      if (it.card) row.setAttribute('data-card', it.card);
      row.appendChild(el('div', 'bub', it.text));
      if (it.at) row.appendChild(el('span', 'at', it.at));
      /* 다른 열린 건의 말풍선을 누르면 그 건을 고른다(글자를 끌어 고르는 중이면 넘어간다 — 본문의 숫자를 옮겨 적을 수 있게) */
      if (can) { row.title = '이 건 고르기'; row.onclick = function () { try { if (String(global.getSelection ? global.getSelection() : '')) return; } catch (e) {} pick(who, it.card); }; }
      if (it.card && !it.mine && !firstRow[it.card]) firstRow[it.card] = row;
      body.appendChild(row);
    });
    box.appendChild(body);

    var foot = el('div', 'msgFoot');
    foot.setAttribute('data-card', sel || '');
    if (multi && open.length) foot.appendChild(pickRow(who, t, open, sel));
    var drew = false;
    if (sel && typeof global.msgActions === 'function') {
      try { drew = !!global.msgActions(sel, foot); } catch (e) { console.warn('메신저 행동 그리기 오류', e); }
    }
    if (!drew) foot.appendChild(el('div', 'tip', '답할 것은 없어요.'));
    box.appendChild(foot);

    /* 스크롤 — 고른 건이 있으면 그 건 첫 말풍선으로 · 새 줄이 왔으면 맨 아래로 · 아니면 보던 자리 그대로.
       같은 틱에 다시 그리면(결과 한 줄 → 새로 그림) 아직 안 한 스크롤을 그대로 잇는다(예전에는 두 번째 그림이 맨 위로 되돌렸다) */
    var grew = drawnLen[who] !== t.items.length; drawnLen[who] = t.items.length;
    var target = scrollTo && firstRow[scrollTo] ? scrollTo : null; scrollTo = null;
    if (target) wantScroll = { who: who, card: target };
    else if (grew) wantScroll = { who: who, end: true };
    else if (!(wantScroll && wantScroll.who === who)) { var m = scrollMem[who]; wantScroll = m ? { who: who, card: m.card, end: m.end, top: m.top } : { who: who, end: true }; }
    if (!scrollTimer) scrollTimer = setTimeout(applyScroll, 0);
    return box;
  }
  function applyScroll() {
    scrollTimer = null;
    var w = wantScroll; wantScroll = null;
    if (!w) return;
    scrollMem[w.who] = { card: w.card, end: w.end, top: w.top };   /* 의도를 적어 둔다 — 판이 숨어 있어 지금 못 옮겨도 다시 보일 때 옮긴다 */
    var body = root ? root.querySelector('.msgBody') : null;
    if (body && w.who === drawnWho) placeScroll(body, w);
  }
  function placeScroll(body, w) {
    if (w.card) {
      var rows = body.querySelectorAll('.msgRow');
      for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute('data-card') === w.card && !/\bme\b/.test(rows[i].className)) { body.scrollTop = Math.max(0, rows[i].offsetTop - body.offsetTop - 8); return; }
    }
    body.scrollTop = (w.end || w.top == null) ? body.scrollHeight : w.top;
  }
  /* 「남은 일 N건」 + 건마다 단추(도착 시각 · 제목). 고른 건은 on, 줄 선 새 건은 new(빨간 점) */
  function pickRow(who, t, open, sel) {
    var row = el('div', 'msgPick');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', '이 대화에서 처리할 건 고르기');
    row.appendChild(el('span', 'lb', '남은 일 ' + open.length + '건'));
    open.forEach(function (id) {
      var it = firstItem(t, id);
      var subj = t.subj[id] || (it ? it.text : '');
      var b = el('button', 'ch' + (id === sel ? ' on' : '') + (t.fresh[id] ? ' new' : ''));
      b.type = 'button';
      b.title = subj;
      b.setAttribute('data-card', id);
      b.setAttribute('aria-pressed', id === sel ? 'true' : 'false');
      if (it && it.at) b.appendChild(el('span', 'tm', it.at));
      b.appendChild(el('span', 'sj', subj));
      b.onclick = function () { pick(who, id); };
      row.appendChild(b);
    });
    return row;
  }
  function clip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; }

  /* 이 건에 답한다 — 대화 아래 행동을 이 건으로(끝난 건은 고를 수 없다) */
  function pick(who, id) {
    var t = THREADS[who];
    if (!t || t.cards.indexOf(id) < 0 || !isOpen(id)) return false;
    t.sel = id; delete t.fresh[id]; scrollTo = id;
    render();
    return true;
  }
  function open(who, cardId) {
    if (!who && cardId) who = whoOf(cardId);
    if (who && THREADS[who]) cur = who;
    else if (!cur && ORDER.length) cur = ORDER[0];
    if (cur) {
      var t = THREADS[cur];
      if (cardId && t.cards.indexOf(cardId) >= 0 && isOpen(cardId)) { t.sel = cardId; delete t.fresh[cardId]; scrollTo = cardId; }
      /* 남은 건이 둘 이상이면 대화를 열 때 답할 건(먼저 온 건)의 말풍선부터 보이게 — 맨 아래(나중 건)를 읽고 앞 건에 답하지 않게 */
      else if (openCards(t).length > 1) scrollTo = selOf(t);
    }
    if (cur) markRead(cur);
    render(); fire(); save();
    if (wantOpen) { try { wantOpen(cur); } catch (e) {} }
  }
  /* 목록 화면으로 — 앱을 열면 카톡처럼 대화 목록부터 보인다 */
  function list() { cur = null; render(); }
  /* 카드 상태가 바뀌면 대화창 아래를 다시 그린다 — 끝난 건이 바뀌었을 수 있으니 기록도(되살리기 대조용) */
  function refresh() { if (root) render(); save(); }
  function reset() { THREADS = {}; ORDER = []; cur = null; shown = ''; scrollTo = null; wantScroll = null; scrollMem = {}; drawnLen = {}; drawnWho = null; render(); fire(); }
  /* 쓰던 답장은 대화에 보관한다(창을 다시 그려도, 목록으로 나갔다 와도 남는다) — cardId 를 주면 그 건 것(건마다 따로) */
  function draft(who, v, cardId) {
    var t = THREADS[who] || (cardId ? THREADS[whoOf(cardId)] : null);
    if (!t) return '';
    if (cardId) { if (v === undefined) return t.drafts[cardId] || ''; t.drafts[cardId] = v; return v; }
    if (v === undefined) return t.draft || '';
    t.draft = v; return v;
  }
  /* 어느 사람의 대화에 이 카드가 쌓였나(끝난 카드도 — 결과 한 줄을 같은 대화에 붙인다) */
  function whoOf(cardId) {
    if (!cardId) return null;
    for (var k in THREADS) if (own.call(THREADS, k) && THREADS[k].cards.indexOf(cardId) >= 0) return k;
    return null;
  }

  /* ---------- 이 기기 대화 기록(이어 하기 · W-7) ----------
     진행 저장본(P.cur)에는 카드 상태만 있어, 새로고침하면 카드로 대화를 다시 쌓았다 — 내가 보낸 글·카드 아닌 한 줄
     (사람의 말 msgLine)이 사라지고 끝낸 대화가 다시 안 읽음으로 떴다. 대화를 이 기기(localStorage)에만 남기고
     이어 하기 때 **다시 쌓은 카드와 기록의 카드가 같고 끝난 건도 같을 때만** 기록으로 바꾼다(다른 기기·지난 판 기록은 안 쓴다).
     서버 저장본은 늘리지 않는다(GAS 상한). */
  function skey() { try { return storeKey ? storeKey() : null; } catch (e) { return null; } }
  function sday() { try { return storeDay ? storeDay() : null; } catch (e) { return null; } }
  function save() {
    if (holding) return;
    var k = skey(); if (!k) return;
    try {
      var th = {};
      for (var w in THREADS) if (own.call(THREADS, w)) {
        var t = THREADS[w];
        th[w] = { team: t.team, cards: t.cards, subj: t.subj, items: t.items.map(function (it) {
          var o = { t: it.text, a: it.at || '' };
          if (it.read) o.r = 1; if (it.mine) o.m = 1; if (it.note) o.n = 1; if (it.cls) o.c = it.cls; if (it.card) o.k = it.card;
          return o; }) };
      }
      global.localStorage.setItem(k, JSON.stringify({ v: 1, day: sday(), order: ORDER, threads: th, done: doneNow() }));
    } catch (e) {}
  }
  function cardsNow() {
    var a = [];
    for (var w in THREADS) if (own.call(THREADS, w)) a = a.concat(THREADS[w].cards);
    return a.sort().join('|');
  }
  /* 끝난 건(열려 있지 않은 카드) — 다른 기기에서 더 끝낸 뒤 돌아오면 카드 집합은 같아도 이것이 달라 기록을 쓰지 않는다 */
  function doneNow() {
    var a = [];
    for (var w in THREADS) if (own.call(THREADS, w)) for (var i = 0; i < THREADS[w].cards.length; i++) if (!isOpen(THREADS[w].cards[i])) a.push(THREADS[w].cards[i]);
    return a.sort().join('|');
  }
  function restore() {
    var k = skey(); if (!k) return false;
    var o = null;
    try { o = JSON.parse(global.localStorage.getItem(k) || 'null'); } catch (e) { o = null; }
    var ok = !!(o && o.v === 1 && o.threads && String(o.day) === String(sday()));
    if (ok) {
      var got = [];
      for (var w in o.threads) if (own.call(o.threads, w)) got = got.concat(o.threads[w].cards || []);
      ok = got.sort().join('|') === cardsNow() && String(o.done == null ? '' : o.done) === doneNow();
    }
    if (ok) {
      var T = {};
      for (var w2 in o.threads) if (own.call(o.threads, w2)) {
        var s = o.threads[w2];
        T[w2] = { who: w2, team: s.team || '', cards: (s.cards || []).slice(), sel: null, fresh: {}, subj: s.subj || {}, drafts: {}, draft: '',
          items: (s.items || []).map(function (x) { return { text: String(x.t == null ? '' : x.t), at: x.a || '', read: !!x.r, mine: !!x.m, note: !!x.n, cls: x.c || '', card: x.k || null }; }) };
      }
      THREADS = T;
      ORDER = (o.order || []).filter(function (w3) { return own.call(T, w3); });
      for (var w4 in T) if (own.call(T, w4) && ORDER.indexOf(w4) < 0) ORDER.push(w4);
      cur = null; shown = ''; scrollTo = null; wantScroll = null; scrollMem = {}; drawnLen = {};
    }
    /* 어느 쪽이든 끝난 건은 읽은 것으로 — 할 일이 없는 대화에 배지가 남지 않게 */
    for (var w5 in THREADS) if (own.call(THREADS, w5)) {
      var t5 = THREADS[w5];
      for (var i = 0; i < t5.items.length; i++) { var it = t5.items[i]; if (it.card && !it.read && !isOpen(it.card)) it.read = true; }
    }
    render(); fire(); save();
    return ok;
  }

  global.Msg = {
    mount: mount,
    push: push,
    mine: mine,
    note: note,
    card: card,
    open: open,
    pick: pick,
    list: list,
    refresh: refresh,
    reset: reset,
    unread: unread,
    draft: draft,
    whoOf: whoOf,
    seen: seen,
    store: function (keyFn, dayFn) { storeKey = keyFn || null; storeDay = dayFn || null; },
    hold: function (on) { holding = !!on; },
    restore: restore,
    cur: function () { return cur; },
    threads: function () {
      return ORDER.map(function (w) { var t = THREADS[w]; return { who: w, n: t.items.length, unread: unreadOf(t), pending: selOf(t), open: openCards(t), cards: t.cards.slice() }; });
    },
    onOpen: function (fn) { wantOpen = fn; },
    onPick: function (fn) { picked.push(fn); },
    onChange: function (fn) { changed.push(fn); }
  };
})(window);
