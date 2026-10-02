/* ==========================================================================
   전화 메모 — PC 바탕화면 안의 앱 하나.

   대표 "전화(type:'phone')는 메일함·메신저 어디에도 넣지 말고, 전화가 오면 그 자리에서
   받는 화면으로 처리한다. 놓친 전화는 「전화 메모」 앱이나 알림으로."

   그래서 이 창은 **받은 전화와 놓친 전화의 목록**만 보여 준다. 줄을 누르면 다시 건다 —
   실제 응대는 대화 모드(js/play/talk.js)가 하고 채점은 doPhone 이 한다. 여기는 목록이다.
   ========================================================================== */
(function (global) {
  'use strict';

  var root = null;
  var changed = [];

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function rows() {
    try {
      if (typeof global.phoneMissed !== 'function') return [];
      return global.phoneMissed();
    } catch (e) { return []; }
  }
  function open() {
    var n = 0;
    rows().forEach(function (id) { var st = global.S.cards[id]; if (st && st.status !== 'done') n++; });
    return n;
  }
  function mount(container) {
    container.classList.add('telApp');
    root = container;
    render();
    return root;
  }
  function render() {
    if (!root) return;
    root.innerHTML = '';
    root.appendChild(el('div', 'msgHd', '전화 메모'));
    var list = rows();
    if (!list.length) { root.appendChild(el('div', 'msgEmpty', '온 전화가 없어요.')); fire(); return; }
    list.forEach(function (id) {
      var c = global.CARD(id), st = global.S.cards[id];
      if (!c || !st) return;
      var done = st.status === 'done';
      var b = el('button', 'telRow' + (done ? ' done' : ''));
      b.type = 'button';
      /* 받은 전화 = 승인 그림 15번(통화 · 2026-09-29) · 응대한 것 = ✓(상태 기호라 그대로) */
      var fa = el('span', 'fa', done ? '✓' : '');
      var A = global.OC && global.OC.ui && global.OC.ui.appicon;
      if (!done) { var im = (A && A.inline) ? A.inline('talk') : ''; if (im) fa.innerHTML = im; else fa.textContent = '☎'; }
      b.appendChild(fa);
      var mid = el('span', 'mid');
      mid.appendChild(el('b', null, c.from + (c.role ? ' (' + c.role + ')' : '')));
      mid.appendChild(el('span', null, done
        ? (st.score == null ? '응대함' : global.actLabel(st.act) + ' · ' + st.score + '점')
        : '못 받은 전화 — 누르면 다시 겁니다'));
      b.appendChild(mid);
      b.appendChild(el('span', 'tm', global.fmtClock(st.arrivedAt || 0)));
      b.onclick = function () { if (!done && typeof global.answerPhone === 'function') global.answerPhone(id); };
      root.appendChild(b);
    });
    fire();
  }
  function fire() { var n = open(); for (var i = 0; i < changed.length; i++) { try { changed[i](n); } catch (e) {} } }

  global.Tel = {
    mount: mount,
    refresh: render,
    missed: open,
    onChange: function (fn) { changed.push(fn); }
  };
})(window);
