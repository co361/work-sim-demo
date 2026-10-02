/* ======================================================================
   NCS 직업공통능력(2025.12) 집계 — 57차 E1 · docs/ncs57/E1-api.md §3 · spec §2-8~§2-11
   증거 목록(ev) → 하위능력(S·수준·게이트·꼬리표) → 영역(평균·수준·포괄도) → 일일 막대·강점/보완·성장·참고 지표(4-2 피드백 반영률).
   DOM·window 없이 돈다 — 게임 화면(play.html)·서버 번들(ws7_grade.gs)·node(로컬 관리자 G·보고 도구 E4·자소서 페이지)가 같은 파일을 싣는다.
   레지스트리는 전역 NCS(js/ncs.js) 또는 opts.NCS. 계산 규칙은 여기 한 곳이다 — 같은 표를 다른 곳에 다시 구현하지 않는다.
   ====================================================================== */
var NcsEval = (function () {
  'use strict';
  /* 결과 문장(60차 2차) — 항목(ov) 문장은 그 항목의 기본 요소가 이 하위능력일 때만(native), 아니면 하위능력 문장(NCS.subs[sub].see·good·weak·tip·alt).
     예: 「필요한 값」 항목이 협업능력(5-1) 증거로 잡혔으면 「필요한 값을 빠짐없이 담았어요」가 아니라 협업능력 문장 */
  function native(N, ov, sub) { const m = ov && N.ov[ov]; return !!(m && m.el && N.els && N.els[m.el] && N.els[m.el].sub === sub); }
  function phrase(ov, sub, kind, o) { const N = REG(o); const S = N.subs[sub] || {}; const m = native(N, ov, sub) ? N.ov[ov] : null;
    if (kind === 'tips') return m ? [m.tip || ''].concat(m.alt || []) : [S.tip || ''].concat(S.alt || []);
    return (m && m[kind]) || S[kind] || (kind === 'good' ? S.act || '' : ''); }
  function REG(o) { const N = (o && o.NCS) || (typeof NCS !== 'undefined' ? NCS : null); if (!N || !N.ov || !N.subs) throw new Error('NCS 레지스트리(js/ncs.js)가 없습니다'); return N; }
  let ovMap = null;
  /* 저장 문자열 7번째 칸(짧은 이름) → 항목 종류(긴 이름) */
  function ovName(N, code) { if (!code) return null; if (N.ov[code]) return code; if (!ovMap || ovMap.N !== N) { ovMap = { N, m: {} }; for (const k of Object.keys(N.ovCode || {})) ovMap.m[N.ovCode[k]] = k; } return ovMap.m[code] || null; }
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ── 문자열 ↔ 목록 — 항목 = id:el:s:m:cx:wv:ov (s 뒤 ! = D12 「하지 않음」 0) · 6칸 옛 문자열도 읽는다(ov 없음) ── */
  function parse(str, o) { const N = REG(o); const out = [];
    for (const p of String(str || '').split('|')) { if (!p) continue; const a = p.split(':'); if (a.length < 6) continue; const s = parseFloat(a[2]); if (!isFinite(s)) continue;
      out.push({ id: a[0], el: a[1], s, x: /!$/.test(a[2]), m: a[3], cx: +a[4] || 1, wv: parseFloat(a[5]) || 0, ov: ovName(N, a[6] || '') }); }
    return out; }
  const numStr = (v) => { const s = String(Math.round((+v || 0) * 1000) / 1000); return s.indexOf('0.') === 0 ? s.slice(1) : s; };
  function format(list, o) { const N = REG(o); return (list || []).map(e => [e.id || e.i, e.el, numStr(e.s) + (e.x ? '!' : ''), e.m, e.cx, numStr(e.wv), e.ov ? ((N.ovCode || {})[e.ov] || e.ov) : ''].join(':')).join('|'); }

  /* ── 저장본 → 증거 목록 ── */
  function fromProgress(P, o) { const N = REG(o); const out = { team: (P && P.team) || '', list: [], days: {}, legacy: [], part: [], quit: [], unverified: {} };
    const done = (P && P.done) || {};
    for (let d = 1; d <= 7; d++) { const r = done[String(d)]; if (!r) { out.days[d] = 'none'; continue; }
      if (!r.ncs2) { out.days[d] = 'legacy'; out.legacy.push(d); continue; }   /* 이전 방식으로 기록된 날 — 읽지 않는다(환산 없음, spec §3-7) */
      /* 57차 E1 후속(B2): 서버가 서명 대조에서 뺀 기록이 있는 날(ncs2.nv) — 증거는 이미 빠졌다. 그날은 「일부만 기록」으로 · 건수는 unverified 로(관리자 표) */
      const nv = +r.ncs2.nv || 0; if (nv) out.unverified[d] = nv;
      const part = !!(r.ncs2.part || nv);
      out.days[d] = r.ncs2.quit ? 'quit' : part ? 'part' : 'ok'; if (part) out.part.push(d); if (r.ncs2.quit) out.quit.push(d);
      const cards = r.cards || {};
      for (const id of Object.keys(cards)) { const c = cards[id]; if (!c || !c.ev) continue;
        for (const e of parse(c.ev, o)) { e.d = d; e.card = id; e.task = d + ':' + id; e.ai = !!c.ai; e.branch = /_branch_/.test(id); out.list.push(e); } }
      for (const e of parse(r.ncs2.day, o)) { e.d = d; e.card = null; const g = (N.taskGroups || {})[e.ov]; e.task = d === 7 ? ('7:ep7:' + (g || e.id)) : (d + ':day:' + e.id); e.ai = false; e.branch = false; out.list.push(e); } }
    return out; }

  /* 카드 상한 — 한 과제가 한 하위능력에 주는 실효 가중 합이 cardCap 을 넘으면 비례 축소(spec §2-1 ③). 각 항목에 w(상한 뒤)를 단다 */
  function capped(N, list) { const sum = {}; for (const e of list) { const el = N.els[e.el]; if (!el || !(e.wv > 0)) continue; const k = e.task + '|' + el.sub; sum[k] = (sum[k] || 0) + e.wv; }
    return list.filter(e => N.els[e.el]).map(e => { const sub = N.els[e.el].sub; const tot = sum[e.task + '|' + sub] || 0; const k = tot > N.cardCap ? N.cardCap / tot : 1; return Object.assign({}, e, { sub, w: e.wv > 0 ? e.wv * k : 0 }); }); }
  function levelOf(S, gatePass, o) { const N = REG(o); if (S == null) return null; let n = 1; for (const L of N.levels) if (S >= L.min - 1e-9) n = L.n; if (n === 4 && !gatePass) n = 3; const L = N.levels.find(x => x.n === n); return { n, name: L ? L.name : '' }; }
  const isDir = (m) => m === 'p' || m === 't'; const isSel = (m) => m === 's' || m === 'd';
  const floorS = (x) => Math.floor(x + 1e-9);   /* 수준과 같이 보이는 점수 — 버림(컷 비교와 어긋나지 않게) */

  /* ── 7일 요약 ── */
  function summary(list, o) { o = o || {}; const N = REG(o); const team = o.team || ''; const T = (N.teams && N.teams[team]) || null;
    const X = new Set([].concat(T ? T.X : [], N.notCovered || [])); const REF = new Set(N.refOnly || []);
    const L = capped(N, list || []); const M = N.minEvidence, G = N.master;
    const subs = {};
    for (const code of Object.keys(N.subs)) { const meta = N.subs[code]; const E = L.filter(e => e.sub === code); const W = E.filter(e => e.w > 0);
      /* 수준은 반올림 전 값으로 컷과 비교하고, 수준과 같이 보이는 S 는 버림한다(57차 E1 후속 · QA Y-11 — 84.62 가 85 로 올라가 「숙련」이 났다 ·
         반올림해 보이면 「85 적응」처럼 컷과 어긋나 보인다) */
      const w = W.reduce((a, e) => a + e.w, 0); const num = W.reduce((a, e) => a + e.w * e.s, 0); const Sraw = w > 0 ? 100 * num / (3 * w) : null; const S = Sraw != null ? floorS(Sraw) : null;
      const tasks = new Set(W.map(e => e.task)).size; const days = [...new Set(W.map(e => e.d))].sort((a, b) => a - b);
      const D0 = W.filter(e => isDir(e.m)); const dir = D0.reduce((a, e) => a + e.w, 0); const sel = w > 0 ? W.filter(e => isSel(e.m)).reduce((a, e) => a + e.w, 0) / w : 0;
      const ps = dir > 0 ? D0.reduce((a, e) => a + e.w * e.s, 0) / dir : 0; const cx = D0.some(e => e.cx >= G.cx && e.s >= 3);
      const gate = { pw: r1(dir), ps: Math.round(ps * 100) / 100, cx, pass: dir >= G.pw - 1e-9 && ps >= G.ps - 1e-9 && cx };
      let status; if (REF.has(code)) status = 'ref'; else if (w >= M.w - 1e-9 && tasks >= M.tasks && days.length >= M.days) status = 'level'; else if (X.has(code) && !W.length) status = 'x'; else if (!T && !W.length) status = 'x'; else status = 'thin';
      const lv = status === 'level' ? levelOf(Sraw, gate.pass, o) : null;
      const els = {}; for (const e of W) els[e.el] = (els[e.el] || 0) + 1;
      const byDay = {}; for (const d of days) { const Wd = W.filter(e => e.d === d); const wd = Wd.reduce((a, e) => a + e.w, 0); byDay[d] = { S: wd > 0 ? Math.round(100 * Wd.reduce((a, e) => a + e.w * e.s, 0) / (3 * wd)) : null, w: r1(wd), n: Wd.length }; }
      const bestC = W.filter(e => isDir(e.m) && e.s >= 3).sort((a, b) => b.cx - a.cx || b.w - a.w)[0] || W.filter(e => e.s >= 3).sort((a, b) => b.cx - a.cx)[0] || null;
      const fails = W.filter(e => e.s <= 1); let worst = null;
      if (fails.length) { const byOv = {}; for (const e of fails) { const k = e.ov || '?'; (byOv[k] = byOv[k] || []).push(e); }
        const k = Object.keys(byOv).sort((a, b) => byOv[b].length - byOv[a].length || byOv[b].reduce((s, e) => s + e.w, 0) - byOv[a].reduce((s, e) => s + e.w, 0))[0]; const e = byOv[k][byOv[k].length - 1];
        worst = { d: e.d, card: e.card, id: e.id, ov: e.ov, s: e.s, tip: phrase(e.ov, code, 'tip', o) }; }
      subs[code] = { code, name: meta.name, area: meta.area, status, S: status === 'ref' ? null : S, Sraw: status === 'ref' ? null : Sraw, level: lv ? lv.n : null, levelName: lv ? lv.name : null,
        w: r1(w), n: W.length, ok: W.filter(e => e.s >= 2).length, zero: W.filter(e => e.x).length, tasks, days, dir: r1(dir), sel: Math.round(sel * 100) / 100, judge: w > 0 && sel >= N.judgeTag,
        ai: w > 0 ? Math.round(100 * W.filter(e => e.ai).reduce((a, e) => a + e.w, 0) / w) / 100 : 0, gate, els, elsK: Object.keys(els).length, byDay,
        best: bestC ? { d: bestC.d, card: bestC.card, id: bestC.id, ov: bestC.ov, s: bestC.s, cx: bestC.cx } : null, worst, ev: E }; }
    /* 영역 — 수준이 난 하위능력 S 의 단순 평균 · 숙련은 그 영역에 숙련 하위능력이 있을 때만 · 포괄도 k/3 */
    const areas = N.areas.map(A => { const lv = A.subs.map(c => subs[c]).filter(x => x.status === 'level'); const k = lv.length;
      const Sraw = k ? lv.reduce((a, x) => a + x.Sraw, 0) / k : null; const S = Sraw != null ? floorS(Sraw) : null; let L0 = Sraw != null ? levelOf(Sraw, lv.some(x => x.level === 4), o) : null;
      const allX = A.subs.every(c => subs[c].status === 'x' || subs[c].status === 'ref');
      return { id: A.id, name: A.name, hue: A.hue, status: k ? 'level' : allX ? 'x' : 'thin', S, level: L0 ? L0.n : null, levelName: L0 ? L0.name : null, k, of: A.subs.length, subs: A.subs.slice() }; });
    const levelled = Object.keys(subs).filter(c => subs[c].status === 'level');
    /* 강점 2 — 수준 난 하위능력 중 S 상위(S ≥ 65, 같으면 직접 수행 근거가 많은 쪽) · 대표 근거 = 가장 어려운 s=3 직접 수행 */
    const strengths = levelled.map(c => subs[c]).filter(x => x.S >= 65).sort((a, b) => b.S - a.S || b.dir - a.dir).slice(0, 2)
      .map(x => ({ sub: x.code, name: x.name, S: x.S, text: phrase(x.best && x.best.ov, x.code, 'good', o), card: x.best ? x.best.card : null, d: x.best ? x.best.d : null }));
    /* 보완 2 — S 하위(S < 85) · 가장 자주 실패한 항목 종류의 보완 문장 + 실패한 카드. 모두 85 이상이면 근거가 적은 하위능력을 더 보여 줄 기회 */
    let gaps = levelled.map(c => subs[c]).filter(x => x.S < 85).sort((a, b) => a.S - b.S).slice(0, 2)
      .map(x => ({ sub: x.code, name: x.name, S: x.S, tip: x.worst ? x.worst.tip : N.subs[x.code].act, card: x.worst ? x.worst.card : null, d: x.worst ? x.worst.d : null }));
    if (!gaps.length) gaps = Object.keys(subs).filter(c => subs[c].status === 'thin').slice(0, 2).map(c => ({ sub: c, name: subs[c].name, S: null, tip: '관찰이 적었어요. 「' + N.subs[c].act + '」를 보여 줄 기회를 더 찾아봐요', card: null, d: null }));
    /* 성장(§2-11) — 같은 항목 종류가 3일 이상·3번 이상 나온 것만, 앞 절반 → 뒤 절반 평균 s(오른 것만, 최대 3) */
    const gcfg = N.growth || { days: 3, n: 3, max: 3 }; const byOv = {};
    for (const e of L) { if (!e.ov || !(e.w > 0)) continue; (byOv[e.ov] = byOv[e.ov] || []).push(e); }
    const growth = [];
    for (const ov of Object.keys(byOv)) { const E = byOv[ov].slice().sort((a, b) => a.d - b.d); if (E.length < gcfg.n || new Set(E.map(e => e.d)).size < gcfg.days) continue;
      const h = Math.floor(E.length / 2); const A0 = E.slice(0, h), B0 = E.slice(E.length - h); const fa = A0.reduce((a, e) => a + e.s, 0) / A0.length, fb = B0.reduce((a, e) => a + e.s, 0) / B0.length;
      /* 앞 절반·뒤 절반 평균이라 날은 범위로 적는다(57차 E1 후속 · QA W-9 — 예전 「1일차 2/3」은 1~3일차 평균이었다) */
      const rng = (X) => { const a = X[0].d, b = X[X.length - 1].d; return a === b ? `${a}일차` : `${a}~${b}일차`; };
      if (fb - fa >= 0.5) growth.push({ ov, label: (N.ov[ov] || {}).label || ov, from: { d: A0[0].d, d2: A0[A0.length - 1].d, s: r1(fa) }, to: { d: B0[B0.length - 1].d, d1: B0[0].d, s: r1(fb) }, text: `${(N.ov[ov] || {}).label || ov} ${rng(A0)} ${r1(fa)}/3 → ${rng(B0)} ${r1(fb)}/3`, delta: fb - fa }); }
    growth.sort((a, b) => b.delta - a.delta); growth.splice(gcfg.max || 3);
    /* 4-2 참고 지표 — 피드백 반영률: 어떤 종류에서 s ≤ 1 이었던 뒤 같은 종류의 다음 기회에서 s ≥ 2 가 된 비율(점수 없음) */
    let rn = 0, rk = 0; for (const ov of Object.keys(byOv)) { const E = byOv[ov].slice().sort((a, b) => a.d - b.d); for (let i = 0; i < E.length - 1; i++) if (E[i].s <= 1) { rn++; if (E[i + 1].s >= 2) rk++; } }
    const ref = { '4-2': { n: rn, k: rk, rate: rn ? Math.round(100 * rk / rn) / 100 : null, text: rn ? `피드백 반영률 ${rk}/${rn}(참고). 부족했던 행동을 다음 기회에 해낸 비율이에요` : '피드백 반영률(참고): 부족했다가 다시 해 볼 기회가 없었어요' },
      avgS: levelled.length >= N.refAvgMin ? Math.round(levelled.reduce((a, c) => a + subs[c].S, 0) / levelled.length) : null, avgN: levelled.length };
    return { v: 1, team, std: N.std, provisional: !!N.provisional, subs, areas, strengths, gaps, growth, ref, levelled,
      thin: Object.keys(subs).filter(c => subs[c].status === 'thin'), notCovered: Object.keys(subs).filter(c => subs[c].status === 'x') }; }

  function report(P, o) { o = o || {}; const f = fromProgress(P, o); const s = summary(f.list, Object.assign({}, o, { team: o.team || (P && P.team) || '' }));
    s.days = f.days; s.legacy = f.legacy; s.part = f.part; s.quit = f.quit; s.unverified = f.unverified; return s; }

  /* ── 일일 — 그날 항목만. 영역 값 = 그날 그 영역 항목의 가중 평균(카드 상한 뒤) · 막대는 가중 ≥ daily.w 또는 하루 집계 항목이 있을 때만(§2-10) ──
     강점 = 그날 성공(s ≥ 2) 2회 이상인 항목 종류 가운데 가중이 큰 것 · 다음엔 = 실패(s ≤ 1)한 항목 종류 가운데 가중이 큰 것(opts.tips[카드.항목] 이 있으면 그 문장) */
  function daily(list, d, o) { o = o || {}; const N = REG(o); const L = capped(N, (list || []).filter(e => +e.d === +d)); const W = L.filter(e => e.w > 0);
    const areas = N.areas.map(A => { const E = W.filter(e => A.subs.includes(e.sub)); const w = E.reduce((a, e) => a + e.w, 0);
      const S = w > 0 ? Math.round(100 * E.reduce((a, e) => a + e.w * e.s, 0) / (3 * w)) : null; const hasDay = E.some(e => !e.card);
      return { id: A.id, name: A.name, hue: A.hue, S, w: r1(w), n: E.length, ok: E.filter(e => e.s >= 2).length, show: S != null && (w >= N.daily.w - 1e-9 || hasDay) }; });
    const subs = {}; for (const e of W) { const x = subs[e.sub] || (subs[e.sub] = { n: 0, ok: 0, w: 0, num: 0 }); x.n++; if (e.s >= 2) x.ok++; x.w += e.w; x.num += e.w * e.s; }
    for (const c of Object.keys(subs)) { const x = subs[c]; subs[c] = { n: x.n, ok: x.ok, S: x.w > 0 ? Math.round(100 * x.num / (3 * x.w)) : null }; }
    const pickKind = (E) => { const by = {}; for (const e of E) { const k = e.ov || '?'; const b = by[k] || (by[k] = { n: 0, w: 0, list: [] }); b.n++; b.w += e.w; b.list.push(e); } return by; };
    /* 잘한 점의 근거 카드는 그날 흠 없는 카드에서만 — 낮은 항목(s≤1)이 있는 카드·그날 「오늘의 실수」 카드(o.exclude)는 빼고 고른다(57차 E1 후속 · QA Y-4③) */
    const flawed = new Set(W.filter(e => e.card && e.s <= 1).map(e => e.card).concat(o.exclude || []));
    const good = pickKind(W.filter(e => e.s >= 2 && !(e.card && flawed.has(e.card)))); const gk = Object.keys(good).filter(k => good[k].n >= 2 && k !== '?').sort((a, b) => good[b].w - good[a].w)[0];
    let strong = null; if (gk) { const e = good[gk].list.slice().sort((a, b) => b.cx - a.cx)[0]; strong = { sub: e.sub, ov: gk, text: phrase(gk, e.sub, 'good', o), card: e.card }; }
    const bad = pickKind(W.filter(e => e.s <= 1)); const ks = Object.keys(bad).sort((a, b) => bad[b].w - bad[a].w);
    /* 「다음엔」 문장 고르기(60차) — o.seen = 앞선 날에 이미 보인 문장 키(「종류#번호」 · 0 = 기본 tip, 1~ = alt). 없으면 예전과 같다(가중이 가장 큰 종류의 기본 문장).
       ① 아직 안 보인 종류의 기본 문장 → ② 가중 순으로 그 종류의 다른 말(alt) → ③ 모두 보였으면 가중이 가장 큰 종류의 기본 문장 */
    let weak = null; if (ks.length) { const seen = new Set(o.seen || []); const tips = o.tips || {};
      /* 문장 묶음은 (항목, 하위능력)마다 — 항목 문장이 그 하위능력 것이면 항목 문장들, 아니면 하위능력 문장들(60차 2차). 키도 그 묶음 이름으로 */
      const ex = (k) => bad[k].list[0]; const grp = (k) => native(N, k, ex(k).sub) ? k : 's' + ex(k).sub; const phr = (k) => phrase(k, ex(k).sub, 'tips', o);
      let pk = ks.find(k => !seen.has(grp(k) + '#0')); let pi = 0;
      if (!pk) for (const k of ks) { const i = phr(k).findIndex((t, j) => j > 0 && t && !seen.has(grp(k) + '#' + j)); if (i > 0) { pk = k; pi = i; break; } }
      if (!pk) pk = ks[0];
      /* 카드 코칭 문장(evTip)은 그 카드에만 있는 문장일 때 · 항목 공통 문장이 하위능력과 어긋나면 쓰지 않는다 */
      const e = ex(pk); const ct = pi === 0 && e.card && tips[e.card + '.' + e.id]; const useCt = ct && (native(N, pk, e.sub) || ct !== (N.ov[pk] || {}).tip);
      weak = { sub: e.sub, ov: pk === '?' ? null : pk, tip: (useCt ? ct : '') || phr(pk)[pi] || '', card: e.card, key: grp(pk) + '#' + pi }; }
    return { d: +d, n: W.length, areas, subs, strong, weak }; }
  /* 앞선 날(1 ~ d-1)의 「다음엔」 문장 키 — 저장본만으로 날마다 같은 규칙을 차례로 다시 돌린다(저장 칸을 새로 두지 않는다) */
  function dailySeen(P, d, o) { o = o || {}; const seen = []; const done = (P && P.done) || {};
    for (let k = 1; k < +d; k++) { const rec = done[String(k)]; if (!rec || !rec.ncs2) continue;
      const list = fromProgress({ team: (P && P.team) || o.team || '', done: { [String(k)]: rec } }, o).list;
      const w = daily(list, k, Object.assign({}, o, { seen })).weak; if (w && w.key) seen.push(w.key); }
    return seen; }

  /* ── 업무 점수(카드 평균 — 홈 일차 칸·관리자·CSV 공통, A Y10) ── */
  function dayScore(rec) { if (!rec || !rec.cards) return null; let sum = 0, n = 0; for (const id of Object.keys(rec.cards)) { const s = rec.cards[id] && rec.cards[id].score; if (typeof s === 'number' && isFinite(s)) { sum += s; n++; } } return n ? Math.round(sum / n) : null; }
  function workScores(P) { const days = {}; let sum = 0, n = 0; for (let d = 1; d <= 7; d++) { const r = P && P.done && P.done[String(d)]; const s = r ? dayScore(r) : null; days[d] = s; if (s != null) { sum += s; n++; } } return { days, avg: n ? Math.round(sum / n) : null }; }

  return { parse, format, fromProgress, summary, report, daily, dailySeen, phrase, native: (ov, sub, o) => native(REG(o), ov, sub), dayScore, workScores, levelOf,
    get STATEMENT() { return REG().statement; } };
})();
if (typeof module !== 'undefined' && module && module.exports) module.exports = NcsEval;
if (typeof window !== 'undefined' && window) window.NcsEval = NcsEval;
