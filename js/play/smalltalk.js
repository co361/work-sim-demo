/* ======================================================================
   스몰토크(일상 대화) 데이터 · 고르기 — 2026-09-30
   사용자 「이어서 대화하기 하면 각 캐릭터의 특성별로 그냥 오늘 아침밥 뭐 먹었다 이런 식으로 일상대화를 할 수 있으면 좋겠어」

   · 주소에 ?smalltalk=1 이 있을 때만 js/play/talk.js 가 이 파일을 싣는다. 기본 화면에는 단추도 요청도 없다.
   · 데이터: data/smalltalk/ (personas.json + smalltalk_<팀>.json — README.md 「연결 담당에게」).
   · 고르기 규칙은 tools/smalltalk_check.mjs 의 pickTopic·eligible·slotOf 를 그대로 옮겼다(고치면 양쪽 같이).
   · 채점·신뢰 없음 — S.trust · S.counts · P(서버 저장본) 어디에도 쓰지 않는다.
     나눈 주제와 「오늘 이 사람과 나눈 수」만 localStorage 별도 칸(ws7.smalltalk.<코드 또는 demo-팀>)에 둔다.
     지워져도 같은 주제가 한 번 더 나올 뿐이다.
   흐름(첫마디 → 선택지 → 반응 → 마무리 → 기존 선택지로)은 talk.js smallTalk() 가 한다.
   ====================================================================== */
(function (global) {
  'use strict';
  const DIR = 'data/smalltalk/';
  const VER = '20260930a';
  const DAILY_CAP = 2;
  const TEAMS = ['cs', 'logi', 'acct', 'ga', 'rec', 'plan', 'qc', 'pr', 'edu', 'buy'];

  /* ---------- 불러오기(실패하면 단추만 숨긴다 — 기존 잡담은 그대로) ---------- */
  let personasP = null; const teamP = {};
  const getJSON = (f) => fetch(DIR + f + '?v=' + VER, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  function personas() {
    return personasP || (personasP = getJSON('personas.json').catch((e) => { console.warn('스몰토크 personas 불러오기 실패', e); personasP = null; return null; }));
  }
  function teamData(code) {
    if (!TEAMS.includes(code)) return Promise.resolve(null);
    return teamP[code] || (teamP[code] = getJSON('smalltalk_' + code + '.json').catch((e) => { console.warn('스몰토크 팀 파일 불러오기 실패', code, e); delete teamP[code]; return null; }));
  }

  /* ---------- 누구인가 ---------- */
  const R = () => global.WorkSimRoster;
  function idOf(name) {
    if (!name || !R()) return null;
    const row = R().data.characters.find((c) => c.display_name === name || c.full_name === name);
    if (row) return row.character_id;
    try { const n = (typeof D !== 'undefined' && D && D.npcs) ? D.npcs[name] : null; if (n && n.ch && R().byId(n.ch)) return n.ch; } catch (e) {}
    try { const ch = global.Talk && global.Talk.chOf ? global.Talk.chOf(name) : ''; if (ch && R().byId(ch)) return ch; } catch (e) {}
    return null;
  }
  function playerId() {
    try {
      const g = (typeof P !== 'undefined' && P && P.avatar) || (typeof avatarPref === 'function' && avatarPref()) || 'm';
      const row = R() && R().player(S.team, g); return row ? row.character_id : null;
    } catch (e) { return null; }
  }

  /* ---------- 이 브라우저에만 남는 기억 ---------- */
  const KEY = () => 'ws7.smalltalk.' + String((S && S.code) || ('demo-' + ((S && S.team) || 'cs'))).toLowerCase();
  function mem() {
    try { const v = JSON.parse(localStorage.getItem(KEY()) || 'null'); if (v && v.v === 1 && Array.isArray(v.used) && v.days) return v; } catch (e) {}
    return { v: 1, used: [], days: {} };
  }
  function save(m) { try { localStorage.setItem(KEY(), JSON.stringify(m)); } catch (e) {} }

  /* ---------- 고르기(tools/smalltalk_check.mjs 기준 구현과 같다) ---------- */
  function eligible(topic, ctx) {
    const w = topic.when || {};
    if (w.days && !w.days.includes(ctx.day)) return false;
    if (w.weekdays && !w.weekdays.includes(ctx.weekday)) return false;
    if (w.slots && !w.slots.includes(ctx.slot)) return false;
    if (w.exclude_days && w.exclude_days.includes(ctx.day)) return false;
    if (ctx.playerId && (topic.mentions || []).includes(ctx.playerId)) return false;
    if (ctx.used && ctx.used.has(topic.id)) return false;
    return true;
  }
  function topicScore(topic) { const w = topic.when || {}; return (w.days ? 4 : 0) + (w.weekdays ? 3 : 0) + (w.slots ? 2 : 0); }
  function hashStr(s) { let n = 0; for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 9973; return n; }
  function pickTopic(charId, entry, ctx) {
    if (entry.skip_if_player && ctx.playerId === charId) return { kind: 'none' };
    const fb = () => ({ kind: 'fallback', line: (entry.fallback || [])[(ctx.day + (ctx.todayCount || 0)) % Math.max(1, (entry.fallback || []).length)] || '' });
    if ((ctx.todayCount || 0) >= DAILY_CAP) return fb();
    const cands = (entry.topics || []).map((t, i) => ({ t, i, k: hashStr(charId + '|' + t.id) })).filter((x) => eligible(x.t, ctx));
    if (!cands.length) return fb();
    cands.sort((a, b) => topicScore(b.t) - topicScore(a.t) || a.k - b.k || a.i - b.i);
    return { kind: 'topic', topic: cands[0].t };
  }
  function slotOf(hhmm, slots) {
    const m = (s) => { const [h, mi] = String(s).split(':').map(Number); return h * 60 + mi; };
    const t = m(hhmm);
    for (const s of slots) if (t >= m(s.from) && t <= m(s.to)) return s.id;
    return t < m(slots[0].from) ? slots[0].id : slots[slots.length - 1].id;
  }
  async function ctxFor(id) {
    const ps = await personas();
    const day = +((S && S.ep) || 1);
    const cal = (ps && ps.calendar && ps.calendar.days) || [];
    const slots = (ps && ps.time_slots && ps.time_slots.slots) || [];
    const clock = (typeof fmtClock === 'function') ? fmtClock((S && S.t) || 0) : '09:00';
    const m = mem();
    return { day, weekday: (cal.find((d) => d.day === day) || {}).weekday || null, slot: slots.length ? slotOf(clock, slots) : null, clock,
      playerId: playerId(), used: new Set(m.used), todayCount: ((m.days[String(day)] || {})[id]) || 0 };
  }

  /* ---------- talk.js 가 부르는 것 ---------- */
  /* 이 사람에게 「이어서 대화하기」를 띄울까 — 방문객·명단 밖 사람·플레이어 자신이면 null */
  async function prep(name, seat) {
    if (seat === 'visitor') return null;
    const id = idOf(name); if (!id) return null;
    const row = R().byId(id); if (!row) return null;
    const me = playerId(); if (id === me) return null;
    const [ps, td] = await Promise.all([personas(), teamData(row.team_code)]);
    const entry = ps && td && td.characters && td.characters[id];
    if (!entry || !Array.isArray(entry.topics) || !entry.topics.length) return null;
    if (entry.skip_if_player && id === me) return null;
    return { id, name, entry };
  }
  async function pick(st) {
    const ctx = await ctxFor(st.id);
    const r = pickTopic(st.id, st.entry, ctx);
    r.ctx = { day: ctx.day, weekday: ctx.weekday, slot: ctx.slot, clock: ctx.clock, playerId: ctx.playerId, todayCount: ctx.todayCount };
    LAST = { who: st.id, kind: r.kind, topic: r.topic ? r.topic.id : null, ctx: r.ctx };
    return r;
  }
  /* 주제를 꺼낸 순간 기억한다(끝까지 안 들어도 같은 주제는 다시 안 나온다) */
  function mark(st, topic) {
    const m = mem(); const day = String(+((S && S.ep) || 1));
    if (!m.used.includes(topic.id)) m.used.push(topic.id);
    m.days[day] = m.days[day] || {}; m.days[day][st.id] = (m.days[day][st.id] || 0) + 1;
    save(m);
  }
  let LAST = null;

  /* 팀 파일은 첫 말 걸기 전에 미리 받아 둔다(내 팀만 — 다른 팀은 그 사람에게 처음 말을 걸 때) */
  personas();
  setTimeout(() => { try { if (S && S.team) teamData(S.team); } catch (e) {} }, 1500);

  global.SmallTalk = { prep, pick, mark, idOf, playerId, pickTopic, slotOf,
    /* 검사용 */
    state: () => ({ key: KEY(), mem: mem(), last: LAST, loaded: Object.keys(teamP) }) };
})(window);
