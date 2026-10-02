/* ======================================================================
   NCS 보고 함수 — 57차 E4 (docs/ncs57/spec.md §7 E4 · §2-9·2-10 · §3-6 · §3-7)
   ----------------------------------------------------------------------
   학생 한 명의 저장본(P, ws7load 로 받은 진행) → NCS 요약·근거 목록 / CSV 줄 두 벌(요약·상세) /
   반 요약 / 일차 점수(업무 점수) / 자소서용 기록 뽑기.
   - DOM·window 없이 돈다(node·브라우저 겸용). 네트워크를 쓰지 않는다.
   - **계산은 전부 NcsEval(js/ncs_eval.js — E1)을 부른다.** 이 파일은 이름 붙이기·카드 제목 찾기·
     표 모양(CSV·줄)만 한다 — 하위능력 점수·수준·영역·포괄도·일차 점수를 다시 셈하지 않는다.
   - 싣는 순서: js/ncs.js(레지스트리 NCS) → js/ncs_eval.js(NcsEval) → 이 파일.
     node 는 tools/ncs_report.mjs 가 vm 으로 셋을 싣는다. 따로 쓸 때는 NcsReport.use({NCS, NcsEval}).
   - 옛 저장본(P.v 가 2 가 아님 · 날 기록에 ncs2 없음)은 재계산하지 않는다(사용자 결정 — spec D5·§3-7):
     「이전 방식으로 기록된 날」로 요약(완료 일수·시도·업무 점수)만 낸다.
   - 기관 보고 고정 문구는 spec §0-3 Q2 — 「공인 인증·등급이 아니다」 류 문장은 쓰지 않는다.
   입출력 모양: docs/ncs57/E4-api.md
   ====================================================================== */
var NcsReport = (function () {
  'use strict';

  var V = 1;
  /* spec §0-3 Q2(사용자 확정 2026-09-23). 레지스트리(NcsEval.STATEMENT·NCS.statement)에 같은 뜻의 문구가 들어오면 그것을 쓰고,
     금지 문구(공인·인증·등급)가 든 옛 문구면 이것을 쓴다 — check() 가 알린다 */
  var Q2 = '본 결과는 NCS 직업공통능력(2025.12) 21개 하위능력 가운데 이 과정에서 관찰하는 하위능력의 게임 속 행동을 집계한 것이다' +
    '(다루지 않는 하위능력은 표에 「이 과정에서 다루지 않음」으로 표시).';
  var BAD_STATEMENT = /공인|인증|등급이 아니/;
  var STATUS = { level: '수준', thin: '근거 부족(참고)', ref: '참고 지표', x: '이 과정에서 다루지 않음' };
  var STATUS_SHORT = { level: '', thin: '근거 부족', ref: '참고', x: '다루지 않음' };
  var MODE = { 'new': '새 방식', mixed: '일부 이전 방식', legacy: '이전 방식', empty: '기록 없음' };
  var DAY_STATE = { ok: '기록', legacy: '이전 방식', part: '일부만 기록', quit: '중간에 끝냄', none: '기록 없음' };
  /* 팀 이름 — 화 데이터(teamName)가 있으면 그것, 없을 때만 이 표(관리자 화면 admin.js TEAMS 와 같은 이름) */
  var TEAM_NAME = { cs: '고객상담팀', logi: '물류팀', acct: '회계팀', ga: '총무팀', rec: '채용팀', plan: '경영기획팀', qc: '품질관리팀', pr: '홍보팀', edu: '교육팀', buy: '구매팀' };
  var TYPE_LABEL = { email: '메일', msg: '메신저', phone: '전화', visit: '방문', approval: '결재', sheet: '검산', report: '대면 보고', comment: '댓글' };
  var ACT_LABEL = { reply: '회신', hold: '보류', delegate: '전달', confirm: '상신', reject: '거절', approve: '승인', deliver: '직접 전달', ask: '직접 질문',
    report: '보고', work: '검산', none: '처리 못 함', timeout: '무응답' };
  /* 게임 시계 표시(core.js fmtClock 과 같은 눈금: 게임 1분 = 사무실 18분, 09:00 시작·18:00 끝) — 자소서용 기록의 시각 표시에만 쓴다 */
  var CLOCK_MUL = 18;
  /* 서명·검증(B2 — E1-api §5). 서버가 저장 때 서명을 대조해 걸린 기록은 nv(날 ncs2.nv·카드 nv·분류 nv·7화 nv — 그 증거는 서버가 이미 뺐고
     점수는 낮췄다). 서명이 아예 없는 날(서명 키를 켜기 전·옛 화면·로컬 개발본)은 서버가 대조하지 않았다. 이 파일은 서명을 다시 셈하지 않는다(키가 없다) */
  var VERIFY = { signed: '서명 있음', unsigned: '서명 없음', unverified: '검증 안 됨', none: '—' };
  var BROWSER_OV = { route: 1, follow: 1 };   /* 서명 밖 카드 항목(브라우저가 판정 — grade.js Seal.BROWSER) */

  /* ── 의존성 ─────────────────────────────────────────────────────────── */
  var DEP = { NCS: null, NcsEval: null };
  function use(d) { if (d) { if (d.NCS) DEP.NCS = d.NCS; if (d.NcsEval) DEP.NcsEval = d.NcsEval; } return api; }
  function deps(o) {
    var G = (typeof globalThis !== 'undefined') ? globalThis : ((typeof window !== 'undefined') ? window : {});
    var N = (o && o.NCS) || DEP.NCS || (typeof NCS !== 'undefined' ? NCS : null) || G.NCS || null;
    var E = (o && o.NcsEval) || DEP.NcsEval || (typeof NcsEval !== 'undefined' ? NcsEval : null) || G.NcsEval || null;
    if (!N) throw new Error('NcsReport: 레지스트리(NCS)가 없습니다 — js/ncs.js 를 먼저 싣거나 NcsReport.use({NCS, NcsEval})');
    if (!E) throw new Error('NcsReport: 집계 모듈(NcsEval)이 없습니다 — js/ncs_eval.js(E1)를 먼저 싣거나 NcsReport.use({NCS, NcsEval})');
    return { N: N, E: E };
  }
  /* NcsEval.STATEMENT 는 전역 NCS 를 읽는 게터일 수 있다(레지스트리를 use() 로만 넘긴 경우 던진다) — 그때는 레지스트리의 statement */
  function regStatement(dp) {
    var s = '';
    try { s = (dp.E && typeof dp.E.STATEMENT === 'string') ? dp.E.STATEMENT : ''; } catch (e) { s = ''; }
    return s || ((dp.N && typeof dp.N.statement === 'string') ? dp.N.statement : '');
  }
  function statementOf(dp) { var s = regStatement(dp); return (!s || BAD_STATEMENT.test(s)) ? Q2 : s; }
  /* NcsEval 함수에 넘길 옵션 — 레지스트리를 늘 같이 넘긴다(전역 NCS 가 없어도 돌게) */
  function eo(dp, o) { var r = { NCS: dp.N }; for (var k in (o || {})) r[k] = o[k]; return r; }
  /* 쓰기 전에 한 번 — 모듈·레지스트리가 이 파일이 기대하는 모양인지(CLI 가 stderr 로 알린다) */
  function check(o) {
    var out = [], dp;
    try { dp = deps(o); } catch (e) { return [String(e.message || e)]; }
    ['fromProgress', 'report', 'workScores'].forEach(function (k) { if (typeof dp.E[k] !== 'function') out.push('NcsEval.' + k + ' 가 없습니다(E1-api.md §3)'); });
    var s = regStatement(dp);
    if (!s) out.push('보고 고정 문구(NcsEval.STATEMENT·NCS.statement)가 없어 spec §0-3 Q2 문구를 씁니다');
    else if (BAD_STATEMENT.test(s)) out.push('레지스트리 보고 문구에 「공인·인증·등급」이 있어 쓰지 않고 spec §0-3 Q2 문구를 씁니다(사용자 결정)');
    else if (s !== Q2) out.push('레지스트리 보고 문구가 spec §0-3 Q2 와 글자가 다릅니다 — 레지스트리 문구를 씁니다');
    if (!dp.N.subs || !dp.N.areas || !dp.N.els) out.push('레지스트리에 areas·subs·els 가 없습니다');
    return out;
  }

  /* ── 작은 도구 ─────────────────────────────────────────────────────── */
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(x) { return (typeof x === 'number' && isFinite(x)) ? x : null; }
  function rnd(x) { x = num(x); return x == null ? null : Math.round(x); }
  function r2(x) { x = num(x); return x == null ? null : Math.round(x * 100) / 100; }
  function pct(x) { x = num(x); return x == null ? null : Math.round(x * 100); }
  function subOf(el) { return String(el || '').split('.')[0]; }
  function dayKeys(P) { return Object.keys((P && P.done) || {}).map(Number).filter(function (d) { return d >= 1 && d <= 7 && isObj(P.done[String(d)]); }).sort(function (a, b) { return a - b; }); }
  /* ws7load 응답({ok, progress}) · {progress} · 진행 그대로 — 셋 다 받는다 */
  function normP(x) {
    if (!isObj(x)) return null;
    if (('progress' in x) && !('done' in x) && !('v' in x)) return isObj(x.progress) ? x.progress : null;
    return x;
  }
  function isStudent(x) { return isObj(x) && x.kind === 'ncs-student'; }
  function clock(at) {
    at = num(at); if (at == null) return '';
    var t = Math.min(18 * 60, 9 * 60 + Math.round(at * CLOCK_MUL));
    return (t < 600 ? '0' : '') + Math.floor(t / 60) + ':' + (t % 60 < 10 ? '0' : '') + (t % 60);
  }

  /* ── 화 데이터(카드 제목·행동 이름) ───────────────────────────────── */
  /* stories: window.STORY 모양({'cs-ep1':…}) · {1:…,…} · 배열 — 그 팀 것만 쓴다 */
  function storyIndex(stories, team) {
    var by = {};
    if (!stories) return by;
    var put = function (s, ep) { if (isObj(s) && ep >= 1 && ep <= 7 && (!team || !s.team || s.team === team)) by[String(ep)] = s; };
    if (Array.isArray(stories)) stories.forEach(function (s) { if (isObj(s)) put(s, +s.ep || +s.day); });
    else Object.keys(stories).forEach(function (k) {
      var s = stories[k], m = /^([a-z]+)-ep(\d)$/.exec(k);
      if (m) { if (!team || m[1] === team) put(s, +m[2]); }
      else if (/^\d$/.test(k)) put(s, +k);
      else if (isObj(s)) put(s, +s.ep || +s.day);
    });
    return by;
  }
  function cardIndex(by) {
    var idx = {};
    Object.keys(by).sort().forEach(function (ep) {
      (by[ep].cards || []).forEach(function (c, i) { if (c && c.id && !idx[c.id]) idx[c.id] = { c: c, ep: +ep, i: i }; });
    });
    return idx;
  }
  /* 되묻기 카드(엔진이 만드는 fu_<원래카드>_<n>)는 원래 카드 제목에 「RE:」 */
  function cardInfo(idx, id) {
    if (!id) return null;
    if (idx[id]) return idx[id];
    var m = /^fu_(.+)_\d+$/.exec(id);
    if (m && idx[m[1]]) { var b = idx[m[1]]; return { c: { id: id, subj: 'RE: ' + (b.c.subj || ''), type: b.c.type, from: b.c.from, followup: true }, ep: b.ep, i: b.i + 0.5 }; }
    return null;
  }
  function teamNameOf(team, by) {
    for (var k in by) if (by[k] && by[k].teamName) return by[k].teamName;
    return TEAM_NAME[team] || team || '';
  }
  function choiceText(c, key) {
    if (!c || !key) return '';
    var pools = [c.choices, c.report && c.report.choices, c.deliver && c.deliver.choices];
    for (var i = 0; i < pools.length; i++) {
      var p = pools[i]; if (!isObj(p) || !(key in p)) continue;
      var v = p[key]; return typeof v === 'string' ? v : (isObj(v) ? String(v.label || v.text || '') : '');
    }
    return '';
  }
  function actLabel(act, story, c) {
    if (!act) return '';
    var t = choiceText(c, act); if (t) return t;
    var L = (story && story.actLabels) || {};
    return L[act] || ACT_LABEL[act] || act;
  }
  function isBranchId(id, c) { return /_branch_/.test(String(id || '')) || !!(c && c.mode === 'branch'); }

  /* ── 근거 한 줄 ─────────────────────────────────────────────────────── */
  /* 근거의 이름 — 카드면 카드 제목, 7일차 칸이면 칸 이름(「보고서 ① 문제 정의」), 하루 집계면 「하루 집계 — 제때 처리」 */
  function ovLabel(N, ov, id) { var meta = (ov && N.ov && N.ov[ov]) || null; return meta ? meta.label : String(id || ''); }
  function itemTitle(N, idx, card, ov, id) {
    if (card) { var ci = cardInfo(idx, card); return ci ? (ci.c.subj || card) : card; }
    return /^e7\./.test(ov || '') ? ovLabel(N, ov, id) : '하루 집계 — ' + ovLabel(N, ov, id);
  }
  function evRow(N, x, idx) {
    var ov = x.ov || null, sub = subOf(x.el), label = ovLabel(N, ov, x.id);
    var ci = x.card ? cardInfo(idx, x.card) : null;
    var title = itemTitle(N, idx, x.card, ov, x.id);
    return {
      d: +x.d, task: x.task || '', card: x.card || null, title: title, id: x.id, ov: ov, ovLabel: label,
      el: x.el, elName: ((N.els || {})[x.el] || {}).name || '', sub: sub, subName: ((N.subs || {})[sub] || {}).name || '',
      s: x.s, x: !!x.x, m: x.m, mName: ((N.methods || {})[x.m] || {}).name || x.m || '', cx: x.cx, wv: x.wv,
      ai: !!x.ai, branch: !!x.branch || isBranchId(x.card, ci && ci.c)
    };
  }
  function withTitle(o, idx, N) {
    if (!isObj(o)) return null;
    var r = {}; for (var k in o) r[k] = o[k];
    r.title = (o.card || o.ov || o.id) ? itemTitle(N, idx, o.card, o.ov, o.id) : '';
    return r;
  }

  /* ── 학생 한 명 ─────────────────────────────────────────────────────── */
  function student(P0, stories, opts) {
    opts = opts || {};
    var dp = deps(opts), N = dp.N, E = dp.E;
    var P = normP(P0);
    var out = { kind: 'ncs-student', v: V, std: N.std || '직업공통능력 2025.12', provisional: !!N.provisional, statement: statementOf(dp),
      code: '', name: '', team: '', teamName: '', day: null, updatedAt: '', mode: 'empty', modeLabel: MODE.empty,
      days: {}, daysDone: [], legacyDays: [], partDays: [], quitDays: [], att: {}, attKnown: false, work: { days: {}, avg: null },
      verify: { state: 'none', label: VERIFY.none, unverified: {}, unverifiedN: 0, unverifiedDays: [], unsignedDays: [], signedDays: [] },
      areas: [], subs: [], evidence: [], strengths: [], gaps: [], growth: [], ref: null, levelled: 0, avgS: null, notes: [] };
    if (!P) { out.notes.push('저장된 진행이 없습니다'); return out; }
    var team = opts.team || P.team || '';
    var by = storyIndex(stories, team), idx = cardIndex(by);
    out.code = P.code || opts.code || ''; out.name = P.name || ''; out.team = team; out.teamName = teamNameOf(team, by);
    out.day = P.day || null; out.updatedAt = P.updatedAt || opts.updatedAt || '';

    var done = dayKeys(P);
    out.daysDone = done;
    out.attKnown = isObj(P.att);   /* 시도 횟수(D34) — 서버가 날을 새로 시작할 때 센다. 진행 중인 날도 있다 */
    for (var ad = 1; ad <= 7 && out.attKnown; ad++) { var a = Math.floor(+P.att[String(ad)] || 0); if (a > 0) out.att[String(ad)] = Math.min(a, 999); }
    var ws = E.workScores(P) || {};
    out.work = { days: isObj(ws.days) ? ws.days : {}, avg: num(ws.avg) };

    var fp = E.fromProgress(P, eo(dp, { team: team })) || {};
    out.days = isObj(fp.days) ? fp.days : {};
    out.legacyDays = (fp.legacy || []).map(Number).filter(function (d) { return done.indexOf(d) >= 0; });
    out.partDays = (fp.part || []).map(Number);
    out.quitDays = (fp.quit || []).map(Number);
    var fresh = done.filter(function (d) { return out.legacyDays.indexOf(d) < 0; });
    out.mode = !done.length ? 'empty' : !fresh.length ? 'legacy' : out.legacyDays.length ? 'mixed' : 'new';
    out.modeLabel = MODE[out.mode];
    out.verify = verifyOf(P, fp, done, dp);
    notesOf(out);
    if (out.mode === 'empty' || out.mode === 'legacy') return out;

    var sm = E.report(P, eo(dp, { team: team })) || {};
    var subsIn = isObj(sm.subs) ? sm.subs : {};
    out.areas = (sm.areas || []).map(function (a) {
      return { id: String(a.id), name: a.name, hue: a.hue || '', status: a.status, statusLabel: a.status === 'level' ? (a.levelName || '') : (STATUS_SHORT[a.status] || a.status || ''),
        S: num(a.S), level: a.level || null, levelName: a.levelName || null, k: a.k || 0, of: a.of || 3, subs: a.subs || [] };
    });
    (N.areas || []).forEach(function (A) {
      (A.subs || []).forEach(function (code) {
        var s = subsIn[code] || {}, meta = N.subs[code] || {};
        out.subs.push({ code: code, name: s.name || meta.name || code, area: String(A.id), areaName: A.name,
          status: s.status || 'thin', statusLabel: s.status === 'level' ? (s.levelName || '') : (STATUS[s.status] || s.status || ''),
          S: num(s.S), level: s.level || null, levelName: s.levelName || null,
          w: num(s.w) == null ? 0 : s.w, n: s.n || 0, ok: s.ok || 0, zero: s.zero || 0, tasks: s.tasks || 0, days: s.days || [],
          dir: num(s.dir), sel: num(s.sel), judge: !!s.judge, ai: num(s.ai), gate: s.gate || null,
          els: s.els || {}, elsK: s.elsK || 0, byDay: s.byDay || {},
          best: withTitle(s.best, idx, N), worst: withTitle(s.worst, idx, N) });
      });
    });
    out.evidence = (fp.list || []).map(function (x) { return evRow(N, x, idx); })
      .sort(function (a, b) { return a.d - b.d; });
    out.strengths = (sm.strengths || []).map(function (x) { return withTitle(x, idx, N); });
    out.gaps = (sm.gaps || []).map(function (x) { return withTitle(x, idx, N); });
    out.growth = (sm.growth || []).slice();
    out.ref = isObj(sm.ref) ? sm.ref : null;
    out.levelled = (sm.levelled || []).length;
    out.avgS = out.ref ? num(out.ref.avgS) : null;
    /* 판단(선택) 위주 꼬리표(spec §2-9) — 숙련에 못 미친 것이 있을 때만 「왜 숙련이 아닌지」 설명을 붙인다 */
    var judged = out.subs.filter(function (s) { return s.judge && s.status === 'level'; });
    if (judged.length) out.notes.push('판단(선택) 위주 근거: ' + judged.map(function (s) { return s.name + '(선택형 ' + pct(s.sel) + '%)'; }).join('·') +
      (judged.some(function (s) { return s.level < 4; }) ? ' — 선택형 근거만으로는 숙련이 나지 않음(직접 써 보는 과제에서 확인돼야 숙련)' : ''));
    return out;
  }
  /* 날마다: 걸린 기록 수(NcsEval.fromProgress 의 unverified = ncs2.nv · ncs2 가 없는 새 기록은 날 nv — 서버가 옛 화면 기록으로 날 전체를 걸었다) ·
     서명이 있는 날 · 서명해야 할 기록(서버 판정 증거·봉인 단계·분류·7화 결과)이 있는데 서명이 하나도 없는 날 */
  function verifyOf(P, fp, done, dp) {
    var fu = isObj(fp.unverified) ? fp.unverified : {}, un = {}, unDays = [], signed = [], unsigned = [];
    done.forEach(function (d) {
      var rec = P.done[String(d)], n = Math.floor(+fu[d] || +fu[String(d)] || 0);
      if (!n && rec.nv && !isObj(rec.ncs2)) n = Math.floor(+rec.nv) || 1;
      if (n) { un[String(d)] = n; unDays.push(d); return; }
      if (!isObj(rec.ncs2)) return;   /* 이전 방식 날 — 서명 대상이 아니다 */
      var cards = isObj(rec.cards) ? rec.cards : {}, need = false, has = !!rec.sg || !!(isObj(rec.triage) && rec.triage.sg);
      Object.keys(cards).forEach(function (id) {
        var c = cards[id]; if (!isObj(c)) return;
        if (c.sg) has = true;
        if (c.ss || (c.ev && dp.E.parse(c.ev, eo(dp)).some(function (e) { return !BROWSER_OV[e.ov]; }))) need = true;
      });
      if (+d === 7 && (rec.ending != null || rec.total != null)) need = true;
      if (isObj(rec.triage) && typeof rec.triage.score === 'number') need = true;
      if (has) signed.push(d); else if (need) unsigned.push(d);
    });
    var N = unDays.reduce(function (a, d) { return a + un[String(d)]; }, 0);
    var state = N ? 'unverified' : unsigned.length ? 'unsigned' : signed.length ? 'signed' : 'none';
    return { state: state, label: VERIFY[state], unverified: un, unverifiedN: N, unverifiedDays: unDays, unsignedDays: unsigned, signedDays: signed };
  }
  function daysText(list) { return list.map(function (d) { return d + '일차'; }).join('·'); }
  function notesOf(o) {
    var v = o.verify;
    if (v.unverifiedN) o.notes.push('검증 안 됨(서버 서명 대조에서 걸린 기록 — 그 증거는 빠지고 점수는 낮춰짐): ' +
      v.unverifiedDays.map(function (d) { return d + '일차 ' + v.unverified[String(d)] + '건'; }).join('·'));
    if (v.unsignedDays.length) o.notes.push('서명 없음: ' + daysText(v.unsignedDays) + '(서명 키를 켜기 전·옛 화면·로컬에서 한 날 — 서버가 대조하지 않음)');
    if (o.quitDays.length) o.notes.push(o.quitDays.map(function (d) { return d + '일차'; }).join('·') + '는 중간에 끝냄');
    var partOnly = o.partDays.filter(function (d) { return !v.unverified[String(d)]; });   /* 검증 안 된 날은 위 줄이 까닭을 말한다 */
    if (partOnly.length) o.notes.push(daysText(partOnly) + '는 역량 기록이 일부 빠짐');
    if (o.mode === 'legacy') o.notes.push('이전 방식으로만 기록된 학생(새 역량 표에 없음 — 재계산하지 않음)');
    else if (o.legacyDays.length) o.notes.push('이전 방식으로 기록된 날(새 역량 표에 없음): ' + o.legacyDays.map(function (d) { return d + '일차'; }).join('·'));
    var re = Object.keys(o.att).filter(function (d) { return o.att[d] > 1; });
    if (re.length) o.notes.push('다시 한 날: ' + re.map(function (d) { return d + '일차 ' + o.att[d] + '회'; }).join('·'));
  }

  /* ── 일차 점수(업무 점수 = 그날 카드 점수 평균) — 홈 일차 칸·관리자·CSV 공통 정의(A Y10) ── */
  function workScores(P0, opts) { var dp = deps(opts); var P = normP(P0); return P ? dp.E.workScores(P) : { days: {}, avg: null }; }
  function dayScore(dayRec, opts) { var dp = deps(opts); return dp.E.dayScore(dayRec); }

  /* ── 여러 학생 ─────────────────────────────────────────────────────── */
  /* list 의 원소: student() 결과 · 저장본(P) · ws7load 응답 · {P, stories}. 저장본이면 여기서 student() 를 돈다(stories 는 opts.stories — 팀별 {cs:{…}} 또는 한 팀) */
  function toStudents(list, opts) {
    opts = opts || {};
    return (list || []).map(function (x) {
      if (isStudent(x)) return x;
      var P = normP(x && x.P ? x.P : x);
      return student(P, (x && x.stories) || storiesFor(opts.stories, P && P.team), opts);
    });
  }
  /* opts.stories 가 팀별 묶음({cs:{'cs-ep1':…}, logi:{…}})이면 그 팀 것, 아니면 그대로(storyIndex 가 팀으로 거른다) */
  function storiesFor(all, team) {
    if (!all || !team) return all || null;
    var t = all[team];
    return (isObj(t) && !t.cards && !t.ep) ? t : all;
  }

  /* ── CSV ─────────────────────────────────────────────────────────── */
  function cell(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? '예' : '';
    var s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;   /* 스프레드시트 수식 주입 막기(이름·글은 학생 입력) */
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function attCompact(st) {
    var a = [];
    for (var d = 1; d <= 7; d++) { var n = st.att[String(d)]; a.push(n ? String(n) : (st.daysDone.indexOf(d) >= 0 ? '?' : '0')); }
    return a.join('·');
  }
  function evShort(x) { return x ? (x.d ? x.d + '일차 ' : '') + (x.title || x.card || '') : ''; }
  function summaryHead(N) {
    var h = ['토큰', '이름', '팀', '기록 방식', '서명·검증', '검증 안 된 날 수', '검증 안 됨(건)', '완료 일수', '시도 횟수(1~7일차)', '업무 점수(평균)'];
    for (var d = 1; d <= 7; d++) h.push(d + '일차 업무 점수');
    (N.areas || []).forEach(function (A) { h.push(A.name + ' 점수', A.name + ' 수준', A.name + ' 포괄도(/3)'); });
    h.push('수준 난 하위능력 수', '측정 하위능력 평균(참고)', '비고', '마지막 저장');
    return h;
  }
  function summaryRow(N, st) {
    var v = st.verify || {};
    var r = [st.code, st.name, st.teamName || st.team, st.modeLabel, v.label || '', (v.unverifiedDays || []).length, v.unverifiedN || 0, st.daysDone.length, attCompact(st), rnd(st.work.avg)];
    for (var d = 1; d <= 7; d++) r.push(rnd(st.work.days[String(d)]));
    var byId = {}; st.areas.forEach(function (a) { byId[a.id] = a; });
    (N.areas || []).forEach(function (A) {
      var a = byId[String(A.id)];
      if (!a) { r.push(null, null, null); return; }
      r.push(a.status === 'level' ? rnd(a.S) : null, a.status === 'level' ? a.levelName : (STATUS_SHORT[a.status] || a.status || ''), a.k);
    });
    var hasNcs = st.mode === 'new' || st.mode === 'mixed';
    r.push(hasNcs ? st.levelled : null, hasNcs ? rnd(st.avgS) : null, st.notes.join(' · '), st.updatedAt || '');
    return r;
  }
  var DETAIL_HEAD = ['토큰', '이름', '팀', '서명·검증', '영역', '하위능력', '상태', '수준', '점수', '근거량(실효 가중)', '관찰 수', '✓ 수(s≥2)', '하지 않음(0)',
    '과제 수', '날 수', '선택형 비율(%)', '판단 위주', '요소 포괄도(/3)', 'AI 첨삭 비율(%)', '대표 근거', '보완 근거'];
  function detailRows(st) {
    var id = [st.code, st.name, st.teamName || st.team, (st.verify && st.verify.label) || ''];
    if (st.mode === 'empty' || st.mode === 'legacy')
      return [id.concat(['', '', st.mode === 'legacy' ? '이전 방식으로만 기록된 학생' : '기록 없음'])];
    return st.subs.map(function (s) {
      var ref = s.status === 'ref';
      return id.concat([s.areaName, s.code + ' ' + s.name, ref ? '참고 지표' : (s.status === 'level' ? '수준' : STATUS_SHORT[s.status] || s.status),
        s.status === 'level' ? s.levelName : null, s.status === 'level' ? rnd(s.S) : null,
        s.status === 'x' ? null : r2(s.w), s.status === 'x' ? null : s.n, s.status === 'x' ? null : s.ok, s.status === 'x' ? null : s.zero,
        s.status === 'x' ? null : s.tasks, s.status === 'x' ? null : (s.days || []).length,
        s.status === 'x' || !s.n ? null : pct(s.sel), s.judge, s.status === 'x' ? null : s.elsK, s.status === 'x' || !s.n ? null : pct(s.ai),
        evShort(s.best), evShort(s.worst)]);
    });
  }
  /* 머리(또는 꼬리)에 고정 문구 한 줄 — opts.statement: 'tail'(기본) | 'head' | false */
  function csvRows(list, kind, opts) {
    opts = opts || {};
    var dp = deps(opts), N = dp.N;
    var sel = pickVerified(toStudents(list, opts), opts), sts = sel.kept;
    var rows;
    if (kind === 'detail') { rows = [DETAIL_HEAD.slice()]; sts.forEach(function (st) { rows = rows.concat(detailRows(st)); }); }
    else if (!kind || kind === 'summary') { rows = [summaryHead(N)]; sts.forEach(function (st) { rows.push(summaryRow(N, st)); }); }
    else throw new Error("NcsReport.csvRows: kind 는 'summary' 또는 'detail'");
    var where = opts.statement == null ? 'tail' : opts.statement;
    var line = ['※ ' + statementOf(dp)];
    var vline = opts.verifiedOnly ? ['※ ' + excludedText(sel.excluded)] : null;
    if (where === 'head') { if (vline) rows.unshift(vline); rows.unshift(line); }
    else if (where) { rows.push([]); rows.push(line); if (vline) rows.push(vline); }
    else if (vline) { rows.push([]); rows.push(vline); }
    return rows;
  }
  /* 기관 보고용 「검증된 기록만」(opts.verifiedOnly) — 서명이 있고 서버 대조에서 걸린 기록이 없는 학생만 남긴다(서명 없음·검증 안 됨·이전 방식·기록 없음은 뺀다) */
  function pickVerified(sts, opts) {
    if (!opts || !opts.verifiedOnly) return { kept: sts, excluded: [] };
    var kept = [], ex = [];
    sts.forEach(function (st) { if (st.verify && st.verify.state === 'signed') kept.push(st); else ex.push({ code: st.code, name: st.name, team: st.team, state: (st.verify && st.verify.state) || 'none', mode: st.mode }); });
    return { kept: kept, excluded: ex };
  }
  function excludedText(ex) {
    if (!ex.length) return '검증된 기록만 — 뺀 학생 없음';
    var c = { unverified: 0, unsigned: 0, none: 0 }; ex.forEach(function (x) { c[x.state === 'unverified' || x.state === 'unsigned' ? x.state : 'none']++; });
    var parts = []; if (c.unverified) parts.push('검증 안 됨 ' + c.unverified); if (c.unsigned) parts.push('서명 없음 ' + c.unsigned); if (c.none) parts.push('이전 방식·기록 없음 ' + c.none);
    return '검증된 기록만 — 뺀 학생 ' + ex.length + '명(' + parts.join(' · ') + ')';
  }
  function csv(list, kind, opts) {
    return csvRows(list, kind, opts).map(function (r) { return r.map(cell).join(','); }).join('\n') + '\n';
  }

  /* ── 반 요약 — 하위능력별 수준 분포(팀이 섞인 반은 공통 11개만, 팀 특화는 팀별로) ── */
  var DIST_KEYS = ['4', '3', '2', '1', 'thin', 'ref', 'x'];
  var DIST_LABEL = { '4': '숙련', '3': '적응', '2': '준비', '1': '초보', thin: '근거 부족', ref: '참고', x: '다루지 않음' };
  function distOf(N, sts, codes) {
    return codes.map(function (code) {
      var d = {}; DIST_KEYS.forEach(function (k) { d[k] = 0; });
      var S = [];
      sts.forEach(function (st) {
        var s = null; for (var i = 0; i < st.subs.length; i++) if (st.subs[i].code === code) { s = st.subs[i]; break; }
        if (!s) return;
        if (s.status === 'level' && s.level) { d[String(s.level)]++; if (num(s.S) != null) S.push(s.S); }
        else if (d[s.status] != null) d[s.status]++;
      });
      var meta = N.subs[code] || {};
      var mean = S.length ? Math.round(S.reduce(function (a, b) { return a + b; }, 0) / S.length) : null;
      return { code: code, name: meta.name || code, area: String(meta.area || ''), dist: d, levelled: S.length, meanS: mean };
    });
  }
  function classSummary(list, opts) {
    opts = opts || {};
    var dp = deps(opts), N = dp.N;
    var every = toStudents(list, opts), sel = pickVerified(every, opts), all = sel.kept;
    var sts = all.filter(function (st) { return st.mode === 'new' || st.mode === 'mixed'; });
    var vc = { signed: 0, unsigned: 0, unverified: 0, none: 0 }; every.forEach(function (st) { var k = (st.verify && st.verify.state) || 'none'; vc[k] = (vc[k] || 0) + 1; });
    var teams = {}; all.forEach(function (st) { var t = st.team || '?'; teams[t] = (teams[t] || 0) + 1; });
    var ncsTeams = {}; sts.forEach(function (st) { ncsTeams[st.team || '?'] = 1; });
    var mixed = Object.keys(ncsTeams).length > 1;
    var allCodes = []; (N.areas || []).forEach(function (A) { allCodes = allCodes.concat(A.subs || []); });
    var common = (N.common || []).slice();
    var out = { kind: 'ncs-class', v: V, n: all.length, withNcs: sts.length, teams: teams, mixed: mixed,
      verify: vc, unverified: every.filter(function (st) { return st.verify && st.verify.state === 'unverified'; }).map(function (st) { return st.code; }),
      unsigned: every.filter(function (st) { return st.verify && st.verify.state === 'unsigned'; }).map(function (st) { return st.code; }),
      verifiedOnly: !!opts.verifiedOnly, excluded: sel.excluded,
      legacy: all.filter(function (st) { return st.mode === 'legacy'; }).map(function (st) { return st.code; }),
      empty: all.filter(function (st) { return st.mode === 'empty'; }).map(function (st) { return st.code; }),
      scope: mixed ? 'common' : 'all', labels: DIST_LABEL, subs: distOf(N, sts, mixed ? common : allCodes), byTeam: null,
      statement: statementOf(dp) };
    if (mixed) {
      out.byTeam = {};
      Object.keys(ncsTeams).forEach(function (t) {
        var mine = sts.filter(function (st) { return (st.team || '?') === t; });
        var extra = allCodes.filter(function (c) { return common.indexOf(c) < 0; });
        /* 그 팀 전원이 「다루지 않음」·「참고」인 하위능력은 뺀다(4-1·4-2 와 그 팀 설계 X) */
        out.byTeam[t] = { n: mine.length, teamName: (mine[0] && mine[0].teamName) || TEAM_NAME[t] || t,
          subs: distOf(N, mine, extra).filter(function (r) { return r.dist.x + r.dist.ref < mine.length; }) };
      });
    }
    return out;
  }

  /* ── 자소서용 기록 뽑기(U8) — 날짜순: 처리한 업무·고른 행동·쓴 글(원문)·7일차 보고서·회고·NCS 수준과 근거 카드 ── */
  function essay(P0, stories, opts) {
    opts = opts || {};
    var dp = deps(opts), N = dp.N;
    var P = normP(P0);
    var st = student(P, stories, opts);
    var out = { kind: 'ncs-essay', v: V, code: st.code, name: st.name, team: st.team, teamName: st.teamName, mode: st.mode, modeLabel: st.modeLabel,
      verify: st.verify, days: [], ep7: null, ncs: null, statement: st.statement };
    if (!P) return out;
    var by = storyIndex(stories, st.team), idx = cardIndex(by);
    st.daysDone.forEach(function (d) {
      var rec = P.done[String(d)], story = by[String(d)] || null;
      var cards = Object.keys(rec.cards || {}).map(function (id) {
        var r = rec.cards[id] || {};
        if (r.status === 'skipped') return null;   /* 도착하지 않은 카드 */
        var ci = cardInfo(idx, id), c = ci ? ci.c : null;
        var ev = st.evidence.filter(function (e) { return e.d === d && e.card === id; })
          .map(function (e) { return { sub: e.sub, subName: e.subName, what: e.ovLabel, s: e.s, x: e.x }; });
        return { id: id, title: c ? (c.subj || id) : id, from: (c && c.from) || '', type: (c && c.type) || '', typeLabel: TYPE_LABEL[(c && c.type) || ''] || '',
          branch: isBranchId(id, c), followup: /^fu_/.test(id),
          act: r.act || 'none', actLabel: actLabel(r.act || 'none', story, c), handled: !!r.act && r.act !== 'none',
          choice: r.choice || '', choiceText: choiceText(c, r.choice), score: num(r.score), at: num(r.at), clock: clock(r.at), late: !!r.late,
          text: r.text || '', text2: r.text2 || '', answer: r.answer || '', ev: ev, _o: ci ? ci.i : 999 };
      }).filter(Boolean).sort(function (a, b) {
        var x = a.at == null ? 1e9 : a.at, y = b.at == null ? 1e9 : b.at;
        return (x - y) || (a._o - b._o);
      });
      cards.forEach(function (c) { delete c._o; });
      var day = { d: d, title: (story && story.title) || '', date: (story && story.date) || '', state: st.days[String(d)] || '', stateLabel: DAY_STATE[st.days[String(d)]] || '',
        unverified: st.verify.unverified[String(d)] || 0,
        attempts: st.att[String(d)] || null, work: num(st.work.days[String(d)]), cards: cards };
      out.days.push(day);
      if (d === 7) out.ep7 = ep7Record(rec, story);
    });
    if (st.mode === 'new' || st.mode === 'mixed') {
      out.ncs = { areas: st.areas.map(function (a) { return { name: a.name, status: a.status, levelName: a.levelName, S: a.S, k: a.k, of: a.of }; }),
        /* 근거 카드 — 잘한(s≥2) 직접 증거를 어려운 것(cx)부터 3개. 하루 집계·7일차 칸(카드 없음)은 항목 종류마다 하나 */
        subs: st.subs.filter(function (s) { return s.status === 'level'; }).map(function (s) {
          var cards = st.evidence.filter(function (e) { return e.sub === s.code && e.s >= 2 && e.m !== 'r'; })
            .sort(function (a, b) { return (b.cx - a.cx) || (b.s - a.s) || (a.d - b.d); });
          var seen = {}, pick = [];
          cards.forEach(function (e) { var k = e.card || ('day:' + e.ovLabel);
            if (pick.length < 3 && !seen[k]) { seen[k] = 1; pick.push({ d: e.d, card: e.card, title: e.title, what: e.ovLabel, s: e.s }); } });
          return { code: s.code, name: s.name, levelName: s.levelName, S: s.S, best: s.best, cards: pick };
        }),
        strengths: st.strengths, growth: st.growth, notes: st.notes };
    }
    return out;
  }
  function ep7Record(rec, story) {
    var E7 = (story && story.ep7) || {};
    var rep = (E7.report || []).map(function (f) { return { key: f.key, title: f.title || f.key, text: (rec.report || {})[f.key] || '' }; });
    Object.keys(rec.report || {}).forEach(function (k) { if (!rep.some(function (f) { return f.key === k; })) rep.push({ key: k, title: k, text: rec.report[k] }); });
    var fields = (E7.decisionFields || []).slice();
    Object.keys(rec.decision || {}).forEach(function (k) { if (fields.indexOf(k) < 0) fields.push(k); });
    var qs = (rec.questions || []).map(function (q) {
      var Q = (E7.questions || [])[q.i] || {}, ch = (Q.choices || [])[q.j] || {};
      return { i: q.i, q: Q.q || '', answer: ch.label || '', score: num(q.score) };
    });
    return { report: rep, decision: fields.map(function (f) { return { field: f, text: (rec.decision || {})[f] || '' }; }).filter(function (x) { return x.text; }),
      dropped: rec.dropped || '', idea: rec.idea || '', reflection: rec.reflection || '', questions: qs,
      ending: rec.ending || '', rubric: rec.rubric || null };
  }

  /* ── 줄(CLI·폰 보고용 글) ───────────────────────────────────────────── */
  function verifyText(v) {
    if (v.state === 'unverified') return '검증 안 됨 ' + v.unverifiedN + '건(' + daysText(v.unverifiedDays) + ')' + (v.unsignedDays.length ? ' · 서명 없음 ' + daysText(v.unsignedDays) : '');
    if (v.state === 'unsigned') return '서명 없음(' + (v.signedDays.length ? daysText(v.unsignedDays) : '전체') + ')';
    return v.label;
  }
  function areaLine(a) {
    if (a.status === 'level') return a.name + ': ' + a.levelName + ' ' + rnd(a.S) + ' · 포괄도 ' + a.k + '/' + (a.of || 3);
    return a.name + ': ' + (STATUS_SHORT[a.status] || a.status) + (a.status === 'x' ? '' : ' · 포괄도 ' + a.k + '/' + (a.of || 3));
  }
  function subLine(s, ref) {
    var head = s.code + ' ' + s.name + ': ';
    if (s.status === 'x') return head + STATUS.x;
    if (s.status === 'ref') return head + '참고 지표' + (ref && ref.text ? ' — ' + ref.text : (ref && ref.n ? ' — 반영 ' + ref.k + '/' + ref.n : ''));
    if (s.status === 'thin') return head + STATUS.thin + ' · 관찰 ' + s.n + '건(✓' + s.ok + ')';
    return head + s.levelName + ' ' + rnd(s.S) + ' · 가중 ' + r2(s.w) + ' · 관찰 ' + s.n + '(✓' + s.ok + (s.zero ? ' · 안 함 ' + s.zero : '') + ')' +
      ' · 과제 ' + s.tasks + ' · ' + (s.days || []).length + '일 · 선택형 ' + pct(s.sel) + '%' + (s.judge ? '(판단 위주)' : '') +
      ' · 요소 ' + s.elsK + '/3' + (pct(s.ai) ? ' · AI 첨삭 ' + pct(s.ai) + '%' : '');
  }
  function lines(st, opts) {
    opts = opts || {};
    var L = [];
    L.push((st.name || '이름 없음') + ' · ' + (st.teamName || st.team || '팀 미상') + (st.code ? ' · ' + st.code : ''));
    L.push('기록: ' + st.modeLabel + ' · 완료 ' + st.daysDone.length + '일' + (st.daysDone.length ? '(' + st.daysDone.join('·') + '일차)' : '') + (st.day ? ' · 현재 ' + st.day + '일차' : ''));
    if (st.verify && st.verify.state !== 'none') L.push('서명·검증: ' + verifyText(st.verify));
    if (st.attKnown) L.push('시도 횟수(1~7일차): ' + attCompact(st));
    var wd = []; for (var d = 1; d <= 7; d++) { var w = st.work.days[String(d)]; if (w != null) wd.push(d + '일 ' + rnd(w)); }
    L.push('업무 점수(카드 평균): ' + (st.work.avg == null ? '—' : '평균 ' + rnd(st.work.avg)) + (wd.length ? ' · ' + wd.join(' · ') : ''));
    if (st.mode === 'new' || st.mode === 'mixed') {
      L.push('— NCS ' + st.std + ' 7영역' + (st.provisional ? '(수준 기준은 임시값)' : ''));
      st.areas.forEach(function (a) { L.push('· ' + areaLine(a)); });
      L.push('— 하위능력 21');
      var ref = st.ref && st.ref['4-2'];
      st.subs.forEach(function (s) { L.push('· ' + subLine(s, ref)); });
      var why = function (x, t) { return (x.name || x.sub) + (x.S != null ? ' ' + rnd(x.S) : '') + (t ? ' — ' + t : '') + (x.title ? ' 「' + (x.d ? x.d + '일차 ' : '') + x.title + '」' : ''); };
      if (st.strengths.length) L.push('— 강점: ' + st.strengths.map(function (x) { return why(x, x.text); }).join(' / '));
      if (st.gaps.length) L.push('— 보완: ' + st.gaps.map(function (x) { return why(x, x.tip); }).join(' / '));
      if (st.growth.length) L.push('— 성장: ' + st.growth.map(function (g) { return g.text || g.label; }).join(' / '));
      L.push('— 측정 하위능력 평균(참고·관리자용): ' + (st.avgS == null ? '— (수준 난 하위능력 ' + st.levelled + '개 — 8개 이상일 때만)' : rnd(st.avgS) + ' (수준 난 하위능력 ' + st.levelled + '개)'));
      if (opts.evidence) {
        L.push('— 근거 ' + st.evidence.length + '건');
        st.evidence.forEach(function (e) {
          L.push('  ' + e.d + '일차 · ' + e.title + ' · ' + e.ovLabel + ' → ' + e.sub + ' ' + e.subName + '(' + e.elName + ') · s=' + e.s + (e.x ? '(안 함)' : '') +
            ' · ' + e.mName + ' · 가중 ' + e.wv + (e.branch ? ' · 분기' : '') + (e.ai ? ' · AI 첨삭 카드' : ''));
        });
      } else L.push('— 근거 ' + st.evidence.length + '건(--ev 로 목록)');
    }
    if (st.notes.length) L.push('— 비고: ' + st.notes.join(' · '));
    L.push('※ ' + st.statement);
    return L;
  }
  function classLines(cs) {
    var L = [];
    var tn = Object.keys(cs.teams).map(function (t) { return (TEAM_NAME[t] || t) + ' ' + cs.teams[t]; }).join(' · ');
    L.push('반 요약 — ' + cs.n + '명(' + tn + ') · 새 역량 표 ' + cs.withNcs + '명' + (cs.legacy.length ? ' · 이전 방식만 ' + cs.legacy.length + '명' : '') + (cs.empty.length ? ' · 기록 없음 ' + cs.empty.length + '명' : ''));
    L.push(cs.scope === 'common' ? '범위: 팀이 섞인 반 — 공통 비교 11개 하위능력만(팀 특화는 아래 팀별)' : '범위: 한 팀 — 하위능력 21개');
    var vc = cs.verify || {}, vp = [];
    if (vc.signed) vp.push('서명 있음 ' + vc.signed); if (vc.unsigned) vp.push('서명 없음 ' + vc.unsigned); if (vc.unverified) vp.push('검증 안 됨 ' + vc.unverified);
    if (vp.length) L.push('서명·검증: ' + vp.join(' · ') + '명' + (cs.verifiedOnly ? ' → ' + excludedText(cs.excluded || []) : (vc.unverified || vc.unsigned ? ' (기관 보고는 --verified-only)' : '')));
    var row = function (r) {
      var parts = []; ['4', '3', '2', '1', 'thin', 'ref', 'x'].forEach(function (k) { if (r.dist[k]) parts.push(DIST_LABEL[k] + ' ' + r.dist[k]); });
      return '· ' + r.code + ' ' + r.name + ': ' + (parts.join(' · ') || '—') + (r.meanS == null ? '' : ' (수준 난 ' + r.levelled + '명 평균 ' + r.meanS + ')');
    };
    cs.subs.forEach(function (r) { L.push(row(r)); });
    if (cs.byTeam) Object.keys(cs.byTeam).forEach(function (t) {
      var b = cs.byTeam[t]; L.push('— ' + b.teamName + ' ' + b.n + '명(공통 밖)');
      b.subs.forEach(function (r) { L.push(row(r)); });
    });
    L.push('※ ' + cs.statement);
    return L;
  }
  function essayLines(es) {
    var L = [];
    L.push('[자소서용 기록] ' + (es.name || '이름 없음') + ' · ' + (es.teamName || es.team || '') + (es.code ? ' · ' + es.code : '') + ' · ' + es.modeLabel +
      (es.verify && es.verify.state !== 'none' ? ' · ' + verifyText(es.verify) : ''));
    es.days.forEach(function (day) {
      L.push('');
      L.push(day.d + '일차' + (day.title ? ' 「' + day.title + '」' : '') + (day.date ? ' ' + day.date : '') + (day.work != null ? ' · 업무 점수 ' + day.work : '') +
        (day.attempts > 1 ? ' · ' + day.attempts + '번째 시도' : '') + (day.state && day.state !== 'ok' ? ' · ' + day.stateLabel : '') +
        (day.unverified ? ' · 검증 안 됨 ' + day.unverified + '건' : ''));
      day.cards.forEach(function (c) {
        L.push('· ' + (c.clock ? c.clock + ' ' : '') + (c.typeLabel ? '[' + c.typeLabel + '] ' : '') + c.title + (c.from ? ' — ' + c.from : '') + (c.branch ? ' (전날 일의 후속)' : ''));
        L.push('  한 일: ' + c.actLabel + (c.choiceText && c.choiceText !== c.actLabel ? ' — 「' + c.choiceText + '」' : '') + (c.score != null ? ' · ' + c.score + '점' : '') + (c.late ? ' · 늦음' : ''));
        if (c.text) L.push('  쓴 글: ' + c.text.replace(/\s*\n\s*/g, ' / '));
        if (c.text2) L.push('  둘째 글: ' + c.text2.replace(/\s*\n\s*/g, ' / '));
        if (c.answer) L.push('  답: ' + c.answer);
        var ok = c.ev.filter(function (e) { return e.s >= 2; }).map(function (e) { return e.subName; });
        if (ok.length) L.push('  드러난 역량: ' + ok.filter(function (x, i) { return ok.indexOf(x) === i; }).join('·'));
      });
      if (day.d === 7 && es.ep7) {
        var e = es.ep7;
        e.report.forEach(function (f) { if (f.text) L.push('· 보고서 ' + f.title + ': ' + f.text.replace(/\s*\n\s*/g, ' / ')); });
        e.decision.forEach(function (f) { L.push('· 결정 — ' + f.field + ': ' + f.text); });
        if (e.dropped) L.push('· 버린 안: ' + e.dropped);
        if (e.idea) L.push('· 아이디어: ' + e.idea);
        e.questions.forEach(function (q) { L.push('· 발표 질문 「' + q.q + '」 → 「' + q.answer + '」' + (q.score != null ? ' (' + q.score + ')' : '')); });
        if (e.reflection) L.push('· 회고: ' + e.reflection.replace(/\s*\n\s*/g, ' / '));
      }
    });
    if (es.ncs) {
      L.push('');
      L.push('NCS 직업공통능력 — 7영역: ' + es.ncs.areas.map(function (a) { return a.name + ' ' + (a.status === 'level' ? a.levelName : (STATUS_SHORT[a.status] || a.status)); }).join(' · '));
      es.ncs.subs.forEach(function (s) {
        L.push('· ' + s.name + ' ' + s.levelName + ' — ' + (s.cards.map(function (c) { return c.d + '일차 「' + c.title + '」'; }).join(', ') || '대표 카드 없음'));
      });
    }
    L.push('');
    L.push('※ ' + es.statement);
    return L;
  }

  var api = {
    v: V, STATEMENT: Q2, use: use, check: check,
    student: student, csvRows: csvRows, csv: csv, classSummary: classSummary, essay: essay,
    workScores: workScores, dayScore: dayScore,
    lines: lines, classLines: classLines, essayLines: essayLines,
    _normP: normP
  };
  return api;
})();
if (typeof module !== 'undefined' && module && module.exports) module.exports = NcsReport;
if (typeof window !== 'undefined' && window) window.NcsReport = NcsReport;
