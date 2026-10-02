/* ======================================================================
   내 결과 PDF — 7일을 마친 학생이 자기 기록을 A4 PDF 파일로 내려받는다(2026-09-28 강승민
   「게임 플레이 마무리하면 ncs 점수랑 플레이하는 동안 뭐 했던 것들 등등이 … pdf로 다운로드」 · 「나의 강점 약점 이런 것도」 ·
   59차 「읽기도 편하고 … NCS면 NCS 점수, 강점이면 강점. 쓸데없이 어떻게 해라 지시문도 넣지 마라」).
   ----------------------------------------------------------------------
   - 계산은 하지 않는다. NCS·강점·보완은 NcsEval.report(P) — 7일 결과 화면(ep7.js renderWeek)과 같은 호출·같은 판정 · 기록 뽑기는 NcsReport.essay/student.
   - 저장본(P)만 있으면 된다 — 새로고침·다른 날 접속 뒤에도(이어 하기와 같은 loadProgress). 카드 제목·팀장 한마디는 화 데이터(loadStory —
     로컬은 파일, 배포본은 서버 공개본)에서 이름만 읽는다.
   - 🔒 정답을 싣지 않는다: 모범 답안(compose.model)·7화 좋은 예(example)·정답 선택지·채점 기준·힌트·코칭 문장(tip)은 읽지도 않는다.
     싣는 것 = 학생이 한 것(고른 처리·쓴 글·답)·점수·결과 화면에 이미 보이는 말(팀장 한마디·NCS 표·강점 판정).
   - 글에는 사실만 — 독자에게 무엇을 하라는 문장·결과지 사용법·「기록이 적어…」류 설명·조언(다음엔 …)을 넣지 않는다. 근거가 없으면 그 줄을 뺀다.
   - 구성(59차): 기본 정보 → NCS 직업공통능력 점수(7영역·21하위능력 표) → 강점 → 보완점 → 일차별 업무 기록 → 내가 쓴 글 → 7일차 보고.
   - 만드는 법(59차): 글이 글자로 남는 PDF — jsPDF 4.2.1(cdnjs · SRI) + 한글 글꼴 Pretendard 1.3.9 Regular TTF(jsdelivr · SRI · OFL)를
     누를 때만 받아 쓰인 글자만 담는다(서브셋). 굵은 글씨는 같은 글꼴에 윤곽선을 더해 그린다(글꼴 한 벌). 못 받으면 같은 내용을 브라우저 인쇄(「PDF로 저장」)로.
   - model()·blocks()·lines()·render() 는 DOM 없이 돈다 — node 검사(tools/result_pdf_check.mjs)가 같은 함수로 PDF 를 만들어 글자를 뽑아 본다.
   ====================================================================== */
var ResultPdf = (function () {
  'use strict';
  var LIB = { key: 'jspdf', src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/4.2.1/jspdf.umd.min.js', sri: 'sha384-qovJwSBbRDPP5cEjCp8S0UP66wrvnjaa60XMOGzTNanrThcrGfXfnZkvgY8N1KT3', ok: function () { return !!(window.jspdf && window.jspdf.jsPDF); } };
  var FONT = { key: 'pretendard', src: 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/alternative/Pretendard-Regular.ttf', sri: 'sha384-hE1S62bS/91v3jB92KL8oMJjktzacumT+AX9XpfKn3MfTcQToerzi5x8jO+E8Opo' };
  var GAME = 'WORK SIM', ORG = '에듀메이커스';
  var TEAM_NAME = { cs: '고객상담팀', logi: '물류팀', acct: '회계팀', ga: '총무팀', rec: '채용팀', plan: '경영기획팀', qc: '품질관리팀', pr: '홍보팀', edu: '교육팀', buy: '구매팀' };
  var DAY_TITLE = { 1: '첫 출근', 2: '사규집', 3: '숫자', 4: '옆 팀', 5: '거절', 6: '위기', 7: '결정' };
  var ACT_DEFAULT = { reply: '회신', hold: '보류', delegate: '전달', confirm: '상신', reject: '거절', approve: '승인', deliver: '직접 전달', ask: '직접 질문', report: '보고', visit: '응대', work: '검산', none: '처리 못 함', timeout: '무응답', pick: '선택' };

  /* 글꼴에 없는 기호 — 뜻이 있는 것은 글로 바꾼다(PDF·인쇄 같은 글). 그 밖에 글꼴에 없는 글자(이모지 등)는 PDF 그릴 때만 뺀다 */
  var SYM = { '\u260E': '(전화)', '\u260F': '(전화)', '\uD83D\uDCDE': '(전화)', '\u2709': '(메일)', '\uD83D\uDCE7': '(메일)', '\uD83D\uDCE8': '(메일)', '\uD83D\uDCE9': '(메일)', '\uD83D\uDCAC': '(메신저)' };
  function tidy(t) { t = t == null ? '' : String(t); for (var k in SYM) if (t.indexOf(k) >= 0) t = t.split(k + ' ').join(SYM[k] + ' ').split(k).join(SYM[k] + ' '); /* ㉠~㉭ 동그라미 자모·가~하 → (ㄱ)·(가) */
    t = t.replace(/[\u3260-\u327B]/g, function (ch) { var i = ch.charCodeAt(0) - 0x3260; var J = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'; var G = '가나다라마바사아자차카타파하'; return '(' + (i < 14 ? J[i] : G[i - 14]) + ')'; });
    t = t.replace(/\u223C/g, '~').replace(/[\u2500\u2501]/g, '-');
    return t.replace(/\t/g, ' ').replace(/[ \u00a0]{2,}/g, ' ').trim(); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function str(x) { return x == null ? '' : String(x); }
  function dep(o, k) { if (o && o[k]) return o[k]; var g = (typeof globalThis !== 'undefined') ? globalThis : (typeof window !== 'undefined' ? window : {}); if (g[k]) return g[k]; throw new Error(k + ' 가 없습니다'); }
  function ymd(iso) { var t = Date.parse(iso || ''); if (!isFinite(t)) return ''; var d = new Date(t); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); }

  /* 화 데이터 → {day: story} (NcsReport 와 같은 모양을 받는다: window.STORY 통째 {'cs-ep1':…}) */
  function storyOf(stories, team, d) { if (!stories) return null; var s = stories[team + '-ep' + d] || stories[String(d)] || null; return isObj(s) ? s : null; }

  /* 팀장 한마디 — 디브리프(day.js buildResult)와 같은 자리: debrief.lead[그날 level]. 「오늘 그만하기」로 끝낸 날은 화면처럼 중립 한마디 */
  function leadLine(story, rec, fill) {
    var deb = (story && story.dialog && story.dialog.debrief) || null; if (!deb || !rec) return '';
    if (rec.ncs2 && rec.ncs2.quit) {
      var lead = ((story.dests || []).filter(function (x) { return x.seat === 'lead'; })[0] || {}).name || '팀장';
      var says = ((story.dialog.briefing || []).filter(function (l) { return l && l.who && (l.who === lead || lead.slice(-l.who.length) === l.who || l.who.slice(-lead.length) === lead); }).map(function (l) { return l.text; }).join(' ')) + ' ' + Object.keys(deb.lead || {}).map(function (k) { return deb.lead[k]; }).join(' ');
      var banmal = says.trim() && !/요[.?!…]|요\s*$/.test(says);
      return banmal ? '오늘은 여기까지네. 못 끝낸 건은 내일 아침에 이어서 보자.' : '오늘은 여기까지네요. 못 끝낸 건은 내일 아침에 이어서 봐요.';
    }
    var t = deb.lead && rec.level ? deb.lead[rec.level] : '';
    return t ? fill(str(t)) : '';
  }
  function leadName(story) { return (((story && story.dests) || []).filter(function (x) { return x.seat === 'lead'; })[0] || {}).name || '팀장'; }
  /* 한마디는 짧게 — 문장 단위로 70자까지(첫 문장은 길어도 통째로) */
  function shortLine(t, max) {
    t = str(t).replace(/\s+/g, ' ').trim(); if (!t) return ''; max = max || 70;
    var ss = t.match(/[^.!?…]+[.!?…]+["'」』”’)]*|[^.!?…]+$/g) || [t]; var out = '';
    for (var i = 0; i < ss.length; i++) { var s = ss[i].trim(); if (!s) continue; if (out && (out + ' ' + s).length > max) break; out = out ? out + ' ' + s : s; }
    return out;
  }

  /* ── 자료 모양(DOM 없음) ───────────────────────────────────────────── */
  function model(P, stories, o) {
    o = o || {};
    var N = dep(o, 'NCS'), E = dep(o, 'NcsEval'), R = dep(o, 'NcsReport');
    var fill = typeof o.fill === 'function' ? o.fill : function (t) { return t; };
    var team = o.team || (P && P.team) || '';
    var name = str(o.name || (P && P.name) || '').trim();
    var es = R.essay(P, stories, { team: team });
    var st = R.student(P, stories, { team: team });
    var teamName = es.teamName || TEAM_NAME[team] || team;
    var done = (P && P.done) || {};
    var ats = Object.keys(done).map(function (k) { return done[k] && done[k].at; }).filter(Boolean).sort();
    var m = { game: GAME, org: ORG, name: name, team: team, teamName: teamName,
      period: { from: ymd(ats[0]), to: ymd(ats[ats.length - 1]) }, made: ymd(o.now || new Date().toISOString()),
      daysDone: st.daysDone.slice(), work: st.work, ncs: null, sw: null, days: [], ep7: null };

    /* 카드 제목 — 화면(ep7.js titleOf)과 같이 이름 자리를 채운다. 화 데이터가 없어 id 만 남으면 id 를 내보내지 않는다 */
    var cardTitle = function (t, id, fallback) { t = str(t); if (!t || t === id) return fallback || '업무'; return fill(t); };
    var essayCard = {}; es.days.forEach(function (day) { day.cards.forEach(function (c) { essayCard[day.d + ':' + c.id] = c; }); });
    var actOf = function (d, card) { var c = essayCard[d + ':' + card]; if (!c) return ''; var a = c.actLabel || ''; return a && a !== c.act ? a : (ACT_DEFAULT[c.act] || ''); };
    /* 근거 한 줄(사실만) — 「3일차 「제목」(회신): 인사부터 다음 행동까지 글의 짜임을 갖췄어요」 · 하루 집계·7일차 칸은 「6일차 우선순위 분류: …」 */
    var fact = function (d, card, ov, what) {
      var meta = ov && N.ov[ov]; var head;
      if (card) { var c = essayCard[d + ':' + card]; var t = c ? cardTitle(c.title, card, '') : ''; var a = actOf(d, card); head = d + '일차 ' + (t ? '「' + t + '」' : '업무') + (a ? '(' + a + ')' : ''); }
      else head = d + '일차 ' + ((meta && meta.label) || '업무');
      return what ? head + ': ' + what : head;
    };

    /* NCS — 7일 결과 화면(ep7.js renderWeek)과 같은 호출 */
    var Rw = null; try { Rw = E.report(P, { team: team }); } catch (e) { Rw = null; }
    var legacyOnly = !Rw || (Rw.legacy.length && !Object.keys(Rw.days).some(function (k) { var v = Rw.days[k]; return v === 'ok' || v === 'part' || v === 'quit'; }));
    if (Rw && !legacyOnly) {
      var areaName = {}; Rw.areas.forEach(function (a) { a.subs.forEach(function (c) { areaName[c] = a.name; }); });
      m.ncs = { std: N.std, levels: (N.levels || []).map(function (L) { return L.name; }),
        areas: Rw.areas.map(function (a) { var on = a.status === 'level'; return { name: a.name, S: on ? a.S : null, levelName: on ? (a.levelName || '') : '' }; }),
        subs: [] };
      Rw.areas.forEach(function (a) { a.subs.forEach(function (c) { var X = Rw.subs[c]; var on = X.status === 'level';
        m.ncs.subs.push({ code: c, area: a.name, name: X.name, S: on ? X.S : null, levelName: on ? (X.levelName || '') : '', status: X.status, n: X.status === 'x' ? 0 : (X.n || 0), ok: X.ok || 0 }); }); });

      /* 강점 · 보완점 — 판정은 화면과 같은 NcsEval 강점 2·보완 2(새 규칙 없음). 근거 = 그 학생의 증거에서 고른 실제 업무 1~2줄.
         강점 = 화면이 짚은 대표 카드 + 자소서용 기록(essay)이 고른 잘한 근거 카드 · 보완 = 화면이 짚은 카드 + 같은 하위능력에서 낮았던 다른 카드.
         조언(tip)은 싣지 않는다 · 수준이 나지 않은 하위능력(관찰 적음)은 보완점에 넣지 않는다 */
      var evOf = function (d, card, sub, good) { return st.evidence.filter(function (e) { return e.d === d && e.card === card && e.sub === sub && (good ? e.s >= 2 : e.s <= 1); }); };
      /* 근거 업무 한 줄(60차 2차) = 일차 · 업무 제목 · 내 처리 · 그 업무 점수(사실만). 카드가 없는 하루 집계·7일차 칸은 「6일차 제때 처리」처럼 그 항목 이름 */
      var evRow = function (d, card, ov) {
        if (card) { var c = essayCard[d + ':' + card]; var t = c ? cardTitle(c.title, card, '') : ''; var act = c ? (c.handled ? (c.actLabel || ACT_DEFAULT[c.act] || '') : '처리 못 함') : '';
          var sc = c && typeof c.score === 'number' ? c.score : null;
          return { d: d, title: t ? '「' + t + '」' : '업무', act: act, score: sc, text: [d + '일차 ' + (t ? '「' + t + '」' : '업무'), act, sc != null ? '업무 점수 ' + sc : ''].filter(Boolean).join(' · ') }; }
        var meta = ov && N.ov[ov]; var L = (meta && meta.label) || '업무'; return { d: d, title: L, act: '', score: null, text: d + '일차 ' + L }; };
      var goodFact = function (d, card, ov, sub) { var e = evOf(d, card, sub, true)[0]; return evRow(d, card, ov || (e && e.ov)); };
      var badFact = function (d, card, ov, sub) { var e = evOf(d, card, sub, false)[0]; return evRow(d, card, ov || (e && e.ov)); };
      var ph = function (ov, sub, k) { try { return E.phrase ? E.phrase(ov, sub, k, { NCS: N }) : ''; } catch (err) { return ''; } };
      var subCards = {}; ((es.ncs && es.ncs.subs) || []).forEach(function (s) { subCards[s.code] = s.cards || []; });
      var strengths = Rw.strengths.map(function (x) {
        var facts = []; var seen = {}; var bst = Rw.subs[x.sub].best;
        if (x.d) { facts.push(goodFact(x.d, x.card, bst && bst.ov, x.sub)); seen[x.d + ':' + (x.card || (bst && bst.ov))] = 1; }
        (subCards[x.sub] || []).forEach(function (c) {
          if (facts.length >= 2) return; var ev = st.evidence.filter(function (e) { return e.d === c.d && e.card === c.card && e.sub === x.sub && e.ovLabel === c.what; })[0];
          var key = c.d + ':' + (c.card || (ev && ev.ov)); if (seen[key]) return; seen[key] = 1; facts.push(goodFact(c.d, c.card, ev && ev.ov, x.sub)); });
        return { sub: x.sub, name: x.name, area: areaName[x.sub] || '', levelName: Rw.subs[x.sub].levelName || '', S: x.S, see: ph(null, x.sub, 'see'), say: (bst && E.native && E.native(bst.ov, x.sub, { NCS: N })) ? ph(bst.ov, x.sub, 'good') : '',   /* 결과 문장은 그 하위능력 항목의 구체 문장일 때만 — 평가 기준과 겹치지 않게 */
          ev: facts, facts: facts.map(function (f) { return f.text; }) };
      });
      var gaps = [];
      Rw.gaps.forEach(function (x) {
        if (x.S == null) return;
        var facts = []; var seen = {}; var wst = Rw.subs[x.sub].worst;
        if (x.d) { facts.push(badFact(x.d, x.card, wst && wst.ov, x.sub)); seen[x.d + ':' + x.card] = 1; }
        st.evidence.filter(function (e) { return e.sub === x.sub && e.s <= 1 && e.m !== 'r'; }).forEach(function (e) {
          if (facts.length >= 2) return; var key = e.d + ':' + e.card; if (seen[key] || (!e.card && seen[e.d + ':null'])) return; seen[key] = 1; facts.push(badFact(e.d, e.card, e.ov, x.sub)); });
        gaps.push({ sub: x.sub, name: x.name, area: areaName[x.sub] || '', levelName: Rw.subs[x.sub].levelName || '', S: x.S, see: ph(null, x.sub, 'see'), say: '',
          ev: facts, facts: facts.map(function (f) { return f.text; }) });
      });
      m.sw = { strengths: strengths, gaps: gaps };
    } else {
      m.ncs = { legacy: true };
    }

    /* 일차별 기록 — 카드마다 증거가 잡힌 하위능력 이름(기록형 제외, 하위능력 번호 순) */
    var cardSubs = {}; (st.evidence || []).forEach(function (e) { if (!e.card || e.m === 'r' || !e.sub) return; var k = e.d + ':' + e.card; (cardSubs[k] = cardSubs[k] || {})[e.sub] = e.subName || ((N.subs[e.sub] || {}).name) || e.sub; });
    es.days.forEach(function (day) {
      var story = storyOf(stories, team, day.d); var rec = done[String(day.d)];
      var cards = day.cards.map(function (c) {
        var act = c.handled ? (c.actLabel || ACT_DEFAULT[c.act] || '') : '처리 못 함';
        var choice = c.choiceText && c.choiceText !== c.actLabel ? fill(c.choiceText) : '';
        var texts = [];
        if (c.text) texts.push({ label: c.text2 ? '첫째 글' : '쓴 글', text: c.text });
        if (c.text2) texts.push({ label: '둘째 글', text: c.text2 });
        if (c.answer) texts.push({ label: '내 답', text: c.answer });
        return { title: cardTitle(c.title, c.id, c.typeLabel || '업무'), type: c.typeLabel || '', from: fill(c.from || ''), branch: !!c.branch,
          subs: Object.keys(cardSubs[day.d + ':' + c.id] || {}).sort().map(function (k) { return cardSubs[day.d + ':' + c.id][k]; }),
          act: act, kind: c.handled ? (ACT_DEFAULT[c.act] || (c.actLabel && c.actLabel.length <= 8 ? c.actLabel : '') || '응답 고르기') : '처리 못 함', choice: choice, score: c.score, late: !!c.late, texts: texts };
      });
      var lead = day.d < 7 ? shortLine(leadLine(story, rec, fill)) : '';
      m.days.push({ d: day.d, title: day.title || DAY_TITLE[day.d] || '', work: day.work, stateLabel: day.state && day.state !== 'ok' ? day.stateLabel : '',
        leadName: leadName(story), lead: lead, cards: cards });
    });

    /* 직무 경험 요약(60차 2차) — 7일 동안 받은 업무를 종류(메일·전화·결재…)별 · 내 처리(회신·전달·상신…)별로 건수와 평균 점수(점수 난 것만 평균) */
    var tally = function (key) { var o = {}, order = []; m.days.forEach(function (d) { d.cards.forEach(function (c) { var k = key(c) || '기타'; if (!o[k]) { o[k] = { label: k, n: 0, sum: 0, sn: 0 }; order.push(k); } o[k].n++; if (typeof c.score === 'number') { o[k].sum += c.score; o[k].sn++; } }); });
      return order.map(function (k) { var x = o[k]; return { label: x.label, n: x.n, avg: x.sn ? Math.round(x.sum / x.sn) : null }; }).sort(function (a, b) { return b.n - a.n; }); };
    m.exp = { total: m.days.reduce(function (a, d) { return a + d.cards.length; }, 0), byType: tally(function (c) { return c.type; }), byAct: tally(function (c) { return c.kind; }) };

    /* 7일차 — 보고서·결정·발표·회고 + 결과(엔딩 이름·보고서 점수·취합/계산 칸·규정 위반). 좋은 예·칸별 채점 문장·놓친 단서는 싣지 않는다 */
    var r7 = done['7'];
    if (r7 && es.ep7) {
      var s7 = storyOf(stories, team, 7); var E7 = (s7 && s7.ep7) || {};
      var en = (E7.endings && E7.endings[r7.ending]) || null;
      m.ep7 = { ending: r7.ending || '', endingName: en && en.name ? fill(en.name) : '', total: num(r7.total), of: (es.ep7.report.length || 5) * 2,
        report: es.ep7.report.map(function (f) { return { title: f.title, text: f.text, score: r7.rubric && r7.rubric[f.key] != null ? r7.rubric[f.key] : null }; }),
        tableOk: num(r7.tableOk), tableAll: (E7.table || []).length || null, calcOk: num(r7.calcOk), calcAll: (E7.criteria || []).length || null,
        violations: (r7.violations || []).map(function (v) { return str(v.text); }).filter(Boolean),
        decision: es.ep7.decision, dropped: es.ep7.dropped, idea: es.ep7.idea,
        questions: es.ep7.questions.map(function (q) { return { q: fill(q.q), answer: fill(q.answer), score: q.score }; }),
        reflection: es.ep7.reflection };
    }
    return m;
  }

  /* ── 쪽에 들어갈 덩이(PDF·인쇄 공통) ────────────────────────────────── */
  /* t: title · h(절) · h3(항목) · note(표 설명 한 줄) · kv(두 칸 표) · table(cols·rows — row.group 은 가로 한 줄 · col.align c/r) · list · text(제목 + 원문)
     60차 3차: 7일 결과 화면과 같은 순서 — 요약 → NCS 7영역 → 강점 → 보완점 → 하위능력 → 직무 경험 요약 → 일차별 업무 기록 → 7일차 보고 → 내가 쓴 글.
     점수는 모두 0~100(보고서 칸만 「n/2」, 보고서 합계 「n/10」) */
  function blocks(m) {
    var B = [];
    var dash = function (v) { return v == null || v === '' ? '-' : String(v); };
    var e = m.ep7;
    B.push({ t: 'title', text: GAME + ' 7일 직무 체험 결과' });
    /* 강점·보완점 한 건 — 하위능력(영역) · 수준 점수 / 평가 기준 · 결과(사실) / 근거 업무(일차 · 제목 · 내 처리 · 업무 점수) */
    var swItem = function (x) { B.push({ t: 'h3', text: x.name + (x.area ? '(' + x.area + ')' : '') + ' · ' + x.levelName + ' ' + x.S });
      var kv = []; if (x.see) kv.push(['평가 기준', x.see]); if (x.say) kv.push(['결과', x.say]); if (kv.length) B.push({ t: 'kv', rows: kv });
      if (x.facts.length) B.push({ t: 'list', items: x.facts }); };
    var swShort = function (L) { return L.map(function (x) { return x.name + '(' + x.levelName + ' ' + x.S + ')'; }).join(', '); };

    B.push({ t: 'h', text: '요약' });
    var per = m.period.from ? (m.period.from === m.period.to ? m.period.from : m.period.from + ' ~ ' + m.period.to) : '-';
    var sum = [['이름', m.name || '-'], ['팀(직무)', m.teamName || '-'], ['기간', per + (m.daysDone.length ? ' (' + m.daysDone.length + '일 완료)' : '')]];
    if (e && e.ending) sum.push(['엔딩', e.ending + (e.endingName ? ' ' + e.endingName : '')]);
    if (e) sum.push(['7일차 보고서', dash(e.total) + '/' + e.of]);
    if (m.work && m.work.avg != null) sum.push(['업무 점수 평균', String(m.work.avg)]);
    if (m.sw && m.sw.strengths.length) sum.push(['강점', swShort(m.sw.strengths)]);
    if (m.sw && m.sw.gaps.length) sum.push(['보완점', swShort(m.sw.gaps)]);
    sum.push(['게임', GAME + ' · ' + ORG]);
    B.push({ t: 'kv', rows: sum });

    B.push({ t: 'h', text: 'NCS 직업공통능력' });
    if (m.ncs.legacy) B.push({ t: 'note', text: '이전 방식 기록이라 NCS 점수 표 없음' });
    else {
      B.push({ t: 'note', text: String(m.ncs.std || '').replace('직업공통능력 ', '') + ' 기준 · 점수 0~100 · 수준 ' + m.ncs.levels.join(' < ') });
      var ar = m.ncs.areas.map(function (a, i) { return { a: a, i: i }; }).sort(function (x, y) { return (y.a.S != null) - (x.a.S != null) || (y.a.S || 0) - (x.a.S || 0) || x.i - y.i; });
      B.push({ t: 'table', cols: [{ label: '영역', w: 3 }, { label: '점수', w: 1, align: 'r' }, { label: '수준', w: 1, align: 'c' }],
        rows: ar.map(function (x) { return { cells: [x.a.name, dash(x.a.S), dash(x.a.levelName)] }; }) });
      if (m.sw.strengths.length) { B.push({ t: 'h', text: '강점' }); m.sw.strengths.forEach(swItem); }
      if (m.sw.gaps.length) { B.push({ t: 'h', text: '보완점' }); m.sw.gaps.forEach(swItem); }
      /* 하위능력 21 — 관찰이 있는 것은 줄마다, 관찰이 없는 것(다루지 않는 것 포함)은 한 줄로 묶어 「-」 */
      B.push({ t: 'h', text: '하위능력 21개' });
      var seen = m.ncs.subs.filter(function (s) { return s.S != null || s.n; }); var none = m.ncs.subs.filter(function (s) { return !(s.S != null || s.n); });
      var prev = null; var sr = seen.map(function (s) { var first = s.area !== prev; prev = s.area; return { cells: [first ? s.area : '', s.name, dash(s.S), dash(s.levelName), dash(s.n), dash(s.n ? s.ok : null)], top: first }; });
      if (none.length) sr.push({ cells: ['', none.map(function (s) { return s.name; }).join(', '), '-', '-', '-', '-'], top: true });
      B.push({ t: 'table', cols: [{ label: '영역', w: 1.5 }, { label: '하위능력', w: 2 }, { label: '점수', w: 0.6, align: 'r' }, { label: '수준', w: 0.6, align: 'c' }, { label: '관찰', w: 0.6, align: 'r' }, { label: '잘함', w: 0.6, align: 'r' }], rows: sr });
    }

    if (m.exp && m.exp.total) {
      B.push({ t: 'h', text: '직무 경험 요약' });
      B.push({ t: 'note', text: m.teamName + ' 7일 동안 받은 업무 ' + m.exp.total + '건' });
      var expRows = function (L) { return L.map(function (x) { return { cells: [x.label, String(x.n), dash(x.avg)] }; }); };
      B.push({ t: 'table', cols: [{ label: '업무 종류', w: 3 }, { label: '건수', w: 1, align: 'r' }, { label: '평균 점수', w: 1, align: 'r' }], rows: expRows(m.exp.byType) });
      B.push({ t: 'table', cols: [{ label: '내 처리', w: 3 }, { label: '건수', w: 1, align: 'r' }, { label: '평균 점수', w: 1, align: 'r' }], rows: expRows(m.exp.byAct) });
    }

    var days = m.days.filter(function (d) { return d.cards.length; });
    if (days.length) {
      B.push({ t: 'h', text: '일차별 업무 기록' });
      if (m.work && m.work.avg != null) B.push({ t: 'note', text: '업무 점수 평균 ' + m.work.avg + ' · 업무마다 점수 0~100' });
      days.forEach(function (d) {
        B.push({ t: 'h3', text: d.d + '일차 「' + d.title + '」' + (d.work != null ? ' · 업무 점수 ' + d.work : '') + (d.stateLabel ? ' · ' + d.stateLabel : '') });
        if (d.lead) B.push({ t: 'note', text: d.leadName + ': ' + d.lead });
        B.push({ t: 'table', cols: [{ label: '업무', w: 2.5 }, { label: '요청자', w: 1.05 }, { label: '내 처리', w: 1.6 }, { label: '하위능력', w: 1.6 }, { label: '점수', w: 0.55, align: 'r' }],
          rows: d.cards.map(function (c) { return { cells: [c.title + (c.branch ? ' (후속)' : ''), c.from || '-', c.act + (c.choice ? ': ' + c.choice : '') + (c.late ? ' (늦음)' : ''), (c.subs || []).join(', ') || '-', dash(c.score)] }; }) });
      });
    }

    if (e) {
      B.push({ t: 'h', text: '7일차 보고' });
      var kv = [];
      if (e.ending) kv.push(['결과', '엔딩 ' + e.ending + (e.endingName ? ' ' + e.endingName : '')]);
      kv.push(['보고서 점수', dash(e.total) + '/' + e.of]);
      if (e.tableOk != null) kv.push(['취합표', e.tableOk + (e.tableAll ? '/' + e.tableAll : '') + '칸 맞음']);
      if (e.calcOk != null) kv.push(['계산', e.calcOk + (e.calcAll ? '/' + e.calcAll : '') + '칸 맞음']);
      if (e.violations.length) kv.push(['규정 위반', e.violations.join(' / ')]);
      B.push({ t: 'kv', rows: kv });
      if (e.report.some(function (f) { return f.score != null; })) B.push({ t: 'table', cols: [{ label: '보고서 칸', w: 4 }, { label: '점수', w: 1, align: 'r' }], rows: e.report.map(function (f) { return { cells: [f.title, f.score != null ? f.score + '/2' : '-'] }; }) });
      var qs = e.questions.filter(function (q) { return q.q; });
      if (qs.length) { B.push({ t: 'h3', text: '발표 질문과 내 답' });
        B.push({ t: 'table', cols: [{ label: '질문', w: 2.6 }, { label: '내 답', w: 2.6 }, { label: '점수', w: 0.55, align: 'r' }], rows: qs.map(function (q) { return { cells: [q.q, q.answer || '-', dash(q.score)] }; }) }); }
      var dk = e.decision.map(function (f) { return [f.field, f.text]; }); if (e.dropped) dk.push(['버린 안', e.dropped]); if (e.idea) dk.push(['아이디어', e.idea]);
      if (dk.length) { B.push({ t: 'h3', text: '결정' }); B.push({ t: 'kv', rows: dk }); }
      if (e.report.some(function (f) { return f.text; })) {
        B.push({ t: 'h3', text: '보고서 원문' });
        e.report.forEach(function (f) { if (f.text) B.push({ t: 'text', label: f.title + (f.score != null ? ' · ' + f.score + '/2' : ''), text: f.text }); });
      }
      if (e.reflection) { B.push({ t: 'h3', text: '회고' }); B.push({ t: 'text', label: '', text: e.reflection }); }
    }

    var wrote = []; m.days.forEach(function (d) { d.cards.forEach(function (c) { c.texts.forEach(function (t) { wrote.push({ d: d.d, title: c.title, label: t.label, text: t.text }); }); }); });
    if (wrote.length) {
      B.push({ t: 'h', text: '내가 쓴 글' });
      wrote.forEach(function (w) { B.push({ t: 'text', label: w.d + '일차 「' + w.title + '」 · ' + w.label, text: w.text }); });
    }
    B.forEach(function (b) { ['text', 'label'].forEach(function (k) { if (b[k] != null) b[k] = tidy(b[k]); });
      if (b.rows) b.rows.forEach(function (r) { if (Array.isArray(r)) { r[0] = tidy(r[0]); r[1] = tidy(r[1]); } else { r.cells = r.cells.map(tidy); if (r.sub) r.sub = tidy(r.sub); } });
      if (b.items) b.items = b.items.map(tidy); });
    return B;
  }

  /* 모든 글(검사용 — 쪽에 들어가는 글과 같다) */
  function lines(m) {
    var L = [];
    blocks(m).forEach(function (b) {
      if (b.t === 'kv') b.rows.forEach(function (r) { L.push(r[0] + ' ' + r[1]); });
      else if (b.t === 'table') { L.push(b.cols.map(function (c) { return c.label; }).join(' ')); b.rows.forEach(function (r) { L.push(r.cells.join(' ')); if (r.sub) L.push(r.sub); }); }
      else if (b.t === 'list') b.items.forEach(function (x) { L.push(x); });
      else if (b.t === 'text') { if (b.label) L.push(b.label); L.push(b.text); }
      else L.push(b.text);
    });
    return L.filter(function (x) { return x != null && x !== ''; });
  }

  /* ── PDF 그리기(jsPDF · pt) ───────────────────────────────────────── */
  var PG = { W: 595.28, H: 841.89, ML: 56, MR: 56, MT: 58, MB: 64 };
  var C = { ink: [27, 36, 48], muted: [91, 102, 117], navy: [20, 55, 102], line: [213, 220, 229], head: [236, 241, 247], group: [246, 248, 251], accent: [31, 78, 140] };
  function render(m, jsPDF, fontB64) {
    var doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
    doc.addFileToVFS('Pretendard-Regular.ttf', fontB64); doc.addFont('Pretendard-Regular.ttf', 'P', 'normal'); doc.setFont('P', 'normal');
    doc.setProperties({ title: GAME + ' 7일 직무 체험 결과 — ' + (m.name || ''), author: ORG, subject: 'NCS 직업공통능력 점수 · 강점 · 보완점 · 업무 기록', keywords: 'NCS, 직업공통능력, ' + (m.teamName || ''), creator: GAME });
    var X0 = PG.ML, CW = PG.W - PG.ML - PG.MR, BOT = PG.H - PG.MB; var y = PG.MT;
    var cmap = covered(doc); var ok = function (t) { var o = ''; Array.from(str(t)).forEach(function (ch) { var cp = ch.codePointAt(0); if (cp === 10 || cp < 0x10000 && cmap[cp] != null) o += ch; else if (cp === 9 || cp === 0xa0) o += ' '; }); return o; };
    var col = function (c) { doc.setTextColor(c[0], c[1], c[2]); };
    var put = function (t, x, yTop, size, o) { o = o || {}; doc.setFontSize(size); col(o.color || C.ink);
      var opt = { baseline: 'alphabetic' }; if (o.align === 'c') opt.align = 'center'; if (o.align === 'r') opt.align = 'right';
      if (o.bold) { opt.renderingMode = 'fillThenStroke'; doc.setLineWidth(size * 0.028); var cc = o.color || C.ink; doc.setDrawColor(cc[0], cc[1], cc[2]); }
      doc.text(ok(t), x, yTop + size * 0.93, opt); };
    var wrap = function (t, w, size) { doc.setFontSize(size); var out = []; str(t).split('\n').forEach(function (p) { if (!p.trim()) { out.push(''); return; } doc.splitTextToSize(ok(p), w).forEach(function (l) { out.push(l); }); }); return out.length ? out : ['']; };
    var newPage = function () { doc.addPage('a4', 'portrait'); y = PG.MT; };
    var need = function (h) { if (y + h > BOT) { newPage(); return true; } return false; };
    var hr = function (x1, x2, yy, c, w) { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w || 0.6); doc.line(x1, yy, x2, yy); };
    var fillRect = function (x, yy, w, h, c) { doc.setFillColor(c[0], c[1], c[2]); doc.rect(x, yy, w, h, 'F'); };

    var FS = 9.5, LH = 14.5;
    function table(b) {
      var tot = b.cols.reduce(function (a, c) { return a + c.w; }, 0); var ws = b.cols.map(function (c) { return CW * c.w / tot; });
      var PX = 5, PY = 4;
      var head = function () { var h = LH + 2 * PY; fillRect(X0, y, CW, h, C.head); var x = X0; b.cols.forEach(function (c, i) { put(c.label, c.align === 'c' ? x + ws[i] / 2 : c.align === 'r' ? x + ws[i] - PX : x + PX, y + PY + (LH - FS) / 2, FS - 0.5, { bold: true, align: c.align, color: C.navy }); x += ws[i]; });
        hr(X0, X0 + CW, y, C.line, 0.8); y += h; hr(X0, X0 + CW, y, C.line, 0.8); };
      var rowLines = function (r) {
        if (r.group) { var g = wrap(r.cells[0], CW - 2 * PX, FS); var s = r.sub ? wrap(r.sub, CW - 2 * PX - 8, FS - 1) : []; return { g: g, s: s, h: g.length * LH + s.length * (LH - 1.5) + 2 * PY }; }
        var cl = r.cells.map(function (t, i) { return wrap(t, ws[i] - 2 * PX, FS); }); return { cl: cl, h: Math.max.apply(null, cl.map(function (l) { return l.length; })) * LH + 2 * PY }; };
      var hh = LH + 2 * PY; var L0 = b.rows.length ? rowLines(b.rows[0]) : { h: 0 };
      need(hh + L0.h + (b.rows[0] && b.rows[0].group && b.rows[1] ? rowLines(b.rows[1]).h : 0)); head();
      b.rows.forEach(function (r, ri) {
        var L = rowLines(r); var nx = (r.group && b.rows[ri + 1]) ? rowLines(b.rows[ri + 1]).h : 0;
        if (y + L.h + nx > BOT) { newPage(); head(); }
        if (r.group) { fillRect(X0, y, CW, L.h, C.group); var yy = y + PY; L.g.forEach(function (l) { put(l, X0 + PX, yy + (LH - FS) / 2, FS, { bold: true }); yy += LH; });
          L.s.forEach(function (l) { put(l, X0 + PX + 8, yy + (LH - 1.5 - (FS - 1)) / 2, FS - 1, { color: C.muted }); yy += LH - 1.5; }); }
        else { var x = X0; L.cl.forEach(function (ls, i) { var c = b.cols[i]; var yy = y + PY; ls.forEach(function (l) { put(l, c.align === 'c' ? x + ws[i] / 2 : c.align === 'r' ? x + ws[i] - PX : x + PX, yy + (LH - FS) / 2, FS, { align: c.align }); yy += LH; }); x += ws[i]; }); }
        y += L.h; hr(X0, X0 + CW, y, r.group || (b.rows[ri + 1] && b.rows[ri + 1].top) ? C.line : [232, 236, 241], r.group ? 0.8 : 0.5);
      });
      y += 10;
    }
    function kv(b) {
      var KW = 92, PX = 5, PY = 4;
      var rows = b.rows.map(function (r) { var v = wrap(r[1], CW - KW - 2 * PX, FS); return { k: r[0], v: v, h: v.length * LH + 2 * PY }; });
      need(rows.length ? rows[0].h : 0); hr(X0, X0 + CW, y, C.line, 0.8);
      rows.forEach(function (r, i) {
        if (y + r.h > BOT) { newPage(); hr(X0, X0 + CW, y, C.line, 0.8); }
        fillRect(X0, y, KW, r.h, C.head); put(r.k, X0 + PX, y + PY + (LH - FS) / 2, FS, { bold: true, color: C.navy });
        var yy = y + PY; r.v.forEach(function (l) { put(l, X0 + KW + PX, yy + (LH - FS) / 2, FS); yy += LH; });
        y += r.h; hr(X0, X0 + CW, y, i === rows.length - 1 ? C.line : [232, 236, 241], i === rows.length - 1 ? 0.8 : 0.5); });
      y += 10;
    }
    function list(b) {
      b.items.forEach(function (t) { var ls = wrap(t, CW - 16, FS); need(Math.min(ls.length, 2) * LH);
        put('·', X0 + 5, y + (LH - FS) / 2, FS, { bold: true, color: C.accent });
        ls.forEach(function (l) { if (y + LH > BOT) newPage(); put(l, X0 + 16, y + (LH - FS) / 2, FS); y += LH; }); y += 2; });
      y += 6;
    }
    function text(b) {
      var ls = wrap(b.text, CW - 14, FS);
      need((b.label ? LH + 2 : 0) + Math.min(ls.length, 3) * LH);
      if (b.label) { put(b.label, X0, y + (LH - FS) / 2, FS, { bold: true, color: C.navy }); y += LH + 2; }
      var y0 = y; var bar = function (a, z) { doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.setLineWidth(2); doc.line(X0 + 2, a, X0 + 2, z); };
      ls.forEach(function (l) { if (y + LH > BOT) { bar(y0, y); newPage(); y0 = y; } put(l, X0 + 14, y + (LH - FS) / 2, FS); y += LH; });
      bar(y0, y); y += 10;
    }

    blocks(m).forEach(function (b, i, all) {
      if (b.t === 'title') { put(b.text, X0, y, 18, { bold: true, color: C.navy }); y += 26; hr(X0, X0 + CW, y, C.accent, 1.4); y += 12; return; }
      if (b.t === 'h') { if (y > PG.MT) y += 10; need(18 + 8 + 3 * LH); put(b.text, X0, y, 13, { bold: true, color: C.navy }); y += 19; hr(X0, X0 + CW, y, C.navy, 0.9); y += 9; return; }
      if (b.t === 'h3') { need(LH + 6 + 3 * LH); put(b.text, X0, y + 1, 10.5, { bold: true }); y += LH + 6; return; }
      if (b.t === 'note') { var ls = wrap(b.text, CW, FS - 1); need(ls.length * (LH - 1)); ls.forEach(function (l) { put(l, X0, y, FS - 1, { color: C.muted }); y += LH - 1; }); y += 6; return; }
      if (b.t === 'kv') return kv(b);
      if (b.t === 'table') return table(b);
      if (b.t === 'list') return list(b);
      if (b.t === 'text') return text(b);
    });

    /* 바닥글 — 게임·이름·쪽 번호 */
    var n = doc.getNumberOfPages();
    for (var p = 1; p <= n; p++) { doc.setPage(p); hr(X0, X0 + CW, PG.H - 44, C.line, 0.5);
      put(GAME + ' · ' + ORG, X0, PG.H - 38, 8, { color: C.muted }); put([m.name, m.teamName].filter(Boolean).join(' · '), X0 + CW / 2, PG.H - 38, 8, { color: C.muted, align: 'c' }); put(p + ' / ' + n, X0 + CW, PG.H - 38, 8, { color: C.muted, align: 'r' }); }
    return doc;
  }

  /* 글꼴이 가진 글자(유니코드 → 글리프) — jsPDF 가 읽은 cmap */
  function covered(doc) { var f = doc.getFont(); return (f && f.metadata && f.metadata.cmap && f.metadata.cmap.unicode && f.metadata.cmap.unicode.codeMap) || {}; }

  /* ── 인쇄 대체(라이브러리·글꼴을 못 받았을 때) — 같은 덩이를 흐르는 HTML 로 ── */
  var CSS = [
    '.rp-root{display:none}',
    '@media print{html,body{height:auto!important;overflow:visible!important;background:#fff!important}body>*:not(.rp-print){display:none!important}',
    '.rp-print{display:block!important;position:static!important;font:10pt/1.55 -apple-system,system-ui,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif;color:#1b2430;word-break:keep-all;overflow-wrap:anywhere}',
    '.rp-print *{box-sizing:border-box}.rp-print h1{font-size:18pt;color:#143766;margin:0 0 10pt;padding-bottom:6pt;border-bottom:1.4pt solid #1f4e8c}',
    '.rp-print h2{font-size:13pt;color:#143766;margin:16pt 0 7pt;padding-bottom:3pt;border-bottom:.9pt solid #143766;break-after:avoid}',
    '.rp-print h3{font-size:10.5pt;margin:8pt 0 4pt;break-after:avoid}.rp-print .note{font-size:9pt;color:#5b6675;margin:0 0 6pt}',
    '.rp-print table{width:100%;border-collapse:collapse;margin:0 0 10pt;font-size:9.5pt}.rp-print th{background:#ecf1f7;color:#143766;text-align:left;padding:3pt 5pt;border-top:.8pt solid #d5dce5;border-bottom:.8pt solid #d5dce5}',
    '.rp-print td{padding:3pt 5pt;border-bottom:.5pt solid #e8ecf1;vertical-align:top}.rp-print .c{text-align:center}.rp-print .r{text-align:right}.rp-print tr{break-inside:avoid}',
    '.rp-print tr.g td{background:#f6f8fb;font-weight:700;border-bottom:.8pt solid #d5dce5}.rp-print tr.g small{display:block;font-weight:400;color:#5b6675;padding-left:8pt}',
    '.rp-print table.kv th{width:92pt;background:#ecf1f7;border:none;border-bottom:.5pt solid #e8ecf1}.rp-print ul{margin:0 0 8pt;padding-left:16pt}',
    '.rp-print .tx{margin:0 0 10pt}.rp-print .tx b{color:#143766;display:block}.rp-print .tx p{margin:2pt 0 0;padding-left:12pt;border-left:2pt solid #d5dce5;white-space:pre-wrap}',
    '@page{size:A4;margin:20mm 20mm 22mm}}'
  ].join('\n');
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function buildHtml(m) {
    var old = document.querySelector('.rp-root'); if (old) old.remove();
    if (!document.getElementById('rpCss')) { var s = el('style'); s.id = 'rpCss'; s.textContent = CSS; document.head.appendChild(s); }
    var root = el('div', 'rp-root'); root.setAttribute('aria-hidden', 'true');
    blocks(m).forEach(function (b) {
      if (b.t === 'title') root.appendChild(el('h1', null, b.text));
      else if (b.t === 'h') root.appendChild(el('h2', null, b.text));
      else if (b.t === 'h3') root.appendChild(el('h3', null, b.text));
      else if (b.t === 'note') root.appendChild(el('p', 'note', b.text));
      else if (b.t === 'kv') { var t = el('table', 'kv'); b.rows.forEach(function (r) { var tr = t.insertRow(); tr.appendChild(el('th', null, r[0])); tr.appendChild(el('td', null, r[1])); }); root.appendChild(t); }
      else if (b.t === 'table') { var tb = el('table'); tb.style.tableLayout = 'fixed'; var tw = b.cols.reduce(function (a, c) { return a + c.w; }, 0); var cg = el('colgroup'); b.cols.forEach(function (c) { var co = el('col'); co.style.width = (100 * c.w / tw).toFixed(1) + '%'; cg.appendChild(co); }); tb.appendChild(cg); var th = el('thead'); var hr = th.insertRow(); b.cols.forEach(function (c) { var x = el('th', c.align === 'c' ? 'c' : c.align === 'r' ? 'r' : null, c.label); hr.appendChild(x); }); tb.appendChild(th); var bd = el('tbody');
        b.rows.forEach(function (r) { var tr = bd.insertRow(); if (r.group) { tr.className = 'g'; var td = el('td', null, r.cells[0]); td.colSpan = b.cols.length; if (r.sub) td.appendChild(el('small', null, r.sub)); tr.appendChild(td); }
          else r.cells.forEach(function (v, i) { tr.appendChild(el('td', b.cols[i].align === 'c' ? 'c' : b.cols[i].align === 'r' ? 'r' : null, v)); }); }); tb.appendChild(bd); root.appendChild(tb); }
      else if (b.t === 'list') { var ul = el('ul'); b.items.forEach(function (x) { ul.appendChild(el('li', null, x)); }); root.appendChild(ul); }
      else if (b.t === 'text') { var d = el('div', 'tx'); if (b.label) d.appendChild(el('b', null, b.label)); d.appendChild(el('p', null, b.text)); root.appendChild(d); }
    });
    document.body.appendChild(root);
    return root;
  }
  function printFallback(m) {
    var root = buildHtml(m); root.className = 'rp-root rp-print';
    var done = function () { window.removeEventListener('afterprint', done); root.remove(); };
    window.addEventListener('afterprint', done); setTimeout(function () { window.print(); }, 50);
    return root;
  }

  /* ── 라이브러리·글꼴(누를 때만 · SRI) ────────────────────────────────── */
  var libP = null, fontP = null;
  function withTimeout(p, ms, what) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(what + ' 시간 초과')); }, ms); })]); }
  function loadLib(timeout) {
    if (LIB.ok()) return Promise.resolve(true);
    if (libP) return libP;
    libP = withTimeout(new Promise(function (res, rej) { var s = document.createElement('script'); s.src = LIB.src; s.integrity = LIB.sri; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = function () { LIB.ok() ? res(true) : rej(new Error('jspdf 없음')); }; s.onerror = function () { rej(new Error('jspdf 받기 실패')); }; document.head.appendChild(s); }), timeout || 20000, 'jspdf')
      .catch(function (e) { libP = null; throw e; });
    return libP;
  }
  function b64(buf) { var u = new Uint8Array(buf), s = '', K = 0x8000; for (var i = 0; i < u.length; i += K) s += String.fromCharCode.apply(null, u.subarray(i, i + K)); return btoa(s); }
  function loadFont(timeout) {
    if (fontP) return fontP;
    fontP = withTimeout(fetch(FONT.src, { integrity: FONT.sri, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (r) { if (!r.ok) throw new Error('글꼴 ' + r.status); return r.arrayBuffer(); }).then(b64), timeout || 30000, '글꼴')
      .catch(function (e) { fontP = null; throw e; });
    return fontP;
  }

  function overlay(text) {
    var o = document.getElementById('rpBusy');
    if (!o) { o = el('div'); o.id = 'rpBusy'; o.setAttribute('role', 'status'); o.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(245,246,248,.94);display:flex;align-items:center;justify-content:center;font:600 15px/1.5 -apple-system,system-ui,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1b2430;text-align:center;padding:20px'; document.body.appendChild(o); }
    o.textContent = text; return o;
  }
  function closeOverlay() { var o = document.getElementById('rpBusy'); if (o) o.remove(); }
  function fileName(m) {
    var safe = function (s) { return str(s).replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 20); };
    var d = new Date(); var day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return ['워크심_결과', safe(m.name) || '이름없음', safe(m.teamName), day].join('_') + '.pdf';
  }

  /* 게임 안에서 부른다 — 전역 P·S·loadStory·fillName(core.js·day.js) */
  var busy = false;
  async function download(opt) {
    opt = opt || {};
    if (busy) return; busy = true;
    var Pg = opt.P || (typeof P !== 'undefined' ? P : null);
    try {
      if (!Pg || !Pg.done || !Object.keys(Pg.done).length) { alert('아직 저장된 기록이 없어요.'); return; }
      var team = Pg.team || (typeof S !== 'undefined' && S.team) || 'cs';
      overlay('결과 PDF를 만드는 중이에요…');
      var days = Object.keys(Pg.done).map(Number).filter(function (d) { return d >= 1 && d <= 7; });
      var libs = Promise.all([loadLib(), loadFont()]).then(function (r) { return r[1]; }, function (e) { console.info('PDF 라이브러리·글꼴을 받지 못해 인쇄로 대신해요:', e && e.message); return null; });
      /* 화 데이터(제목·팀장 한마디만 읽는다) — 받지 못한 날은 「업무」로 적는다 */
      await Promise.all(days.map(function (d) { if (window.STORY && window.STORY[team + '-ep' + d]) return null; return (typeof loadStory === 'function' ? loadStory(team, d) : Promise.reject(new Error('loadStory 없음'))).catch(function (e) { console.info('결과 PDF: ' + d + '일차 제목을 불러오지 못함', e && e.message); }); }));
      var nm = (typeof S !== 'undefined' && S.name) || Pg.name || '';
      var fill = (typeof fillName === 'function') ? function (t) { return fillName(t); } : function (t) { return t; };
      var m = model(Pg, window.STORY || {}, { team: team, name: nm, fill: fill });
      var font = await libs;
      if (!font) { closeOverlay(); printFallback(m); return; }
      try { var doc = render(m, window.jspdf.jsPDF, font); doc.save(fileName(m)); }
      catch (e) { console.warn('PDF 만들기 실패 — 인쇄로 대신해요', e); closeOverlay(); printFallback(m); return; }
    } catch (e) { console.warn('결과 PDF 실패', e); alert('결과 PDF를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요.'); }
    finally { busy = false; closeOverlay(); }
  }
  function button(cls) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (cls ? ' ' + cls : ''); b.textContent = '내 결과 PDF 내려받기';
    b.title = '7일 기록(NCS 점수·강점·보완점·날마다 한 일과 쓴 글)을 PDF 파일로 저장해요';
    b.onclick = function () { download(); }; return b;
  }

  return { model: model, blocks: blocks, lines: lines, render: render, tidy: tidy, covered: covered, download: download, button: button, fileName: fileName, _html: buildHtml, _loadLib: loadLib, _loadFont: loadFont, LIB: LIB, FONT: FONT };
})();
if (typeof module !== 'undefined' && module && module.exports) module.exports = ResultPdf;
if (typeof window !== 'undefined' && window) window.ResultPdf = ResultPdf;
