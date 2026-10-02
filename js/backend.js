/* ==========================================================================
   WORK SIM v2 — 7일차 1인용 게임 백엔드 클라이언트
   --------------------------------------------------------------------------
   window.Backend = { configure, check, load, save, grade, story, score, issue, flush, isOn }

   - 전송: Google Apps Script 웹앱에 POST, Content-Type 은 text/plain;charset=utf-8.
     (application/json 으로 보내면 브라우저가 프리플라이트를 띄우고 GAS 가 그걸 못 받는다.
      index.html 의 api() 와 같은 관행이다.)
   - 모든 함수는 Promise 를 돌려주고 절대 reject 하지 않는다.
     실패는 {ok:false, reason:'...'} 로 돌아온다 — 호출부는 reason 만 보면 된다.
   - 저장은 2초 디바운스. 마지막으로 넘긴 진행 상태는 반드시 한 번 전송된다
     (전송 중에 또 들어오면 끝난 뒤 이어서 보내고, 탭이 닫히면 sendBeacon 으로 마지막 것을 흘린다).
   - localStorage 폴백은 여기서 하지 않는다. 화면(play.html)이 Backend 결과를 보고 결정한다.
   ========================================================================== */
(function(global){
  'use strict';

  var URL_ = '';
  var TIMEOUT       = 8000;   /* check · load · save · issue */
  var GRADE_TIMEOUT = 8000;   /* AI 첨삭. 자주 시간 초과로 규칙 채점에 떨어지면 configure 로 올린다 */
  var DEBOUNCE      = 2000;   /* 저장 디바운스 */

  var lastCode = '';
  var lastTeam = '';

  function norm(c){ return String(c == null ? '' : c).trim().toUpperCase(); }

  function fail(reason){ return {ok:false, reason:reason}; }

  function post(payload, ms){
    if(!URL_) return Promise.resolve(fail('백엔드가 설정되지 않았습니다'));
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function(){ if(ctl) ctl.abort(); }, ms || TIMEOUT);
    var opt = {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    };
    if(ctl) opt.signal = ctl.signal;
    return fetch(URL_, opt)
      .then(function(res){ return res.text(); })
      .then(function(txt){
        var j;
        try{ j = JSON.parse(txt); }
        catch(e){ return fail('서버 응답 형식 오류'); }
        if(!j || typeof j !== 'object') return fail('서버 응답 형식 오류');
        if(j.ok !== true) return {ok:false, reason: j.reason || j.error || '요청이 거부되었습니다'};
        return j;
      })
      .catch(function(e){
        if(e && e.name === 'AbortError') return fail('응답 시간 초과');
        return fail('서버에 연결하지 못했습니다');
      })
      .then(function(r){ clearTimeout(timer); return r; });
  }

  /* ---------- 저장 큐 (디바운스 + 마지막 것 보장) ---------- */
  var pending = null;    /* 아직 못 보낸 마지막 payload */
  var timer   = null;
  var busy    = false;
  var waiters = [];      /* save() 가 돌려준 Promise 의 resolve 들 */

  function fire(){
    timer = null;
    if(busy){ timer = setTimeout(fire, 300); return; }   /* 앞 요청이 끝난 뒤에 보낸다 */
    if(!pending) return;
    var payload = pending; pending = null;
    var ws = waiters; waiters = [];
    busy = true;
    post({action:'ws7save', code:payload.code, progress:payload.progress}).then(function(r){
      busy = false;
      for(var i=0; i<ws.length; i++){ try{ ws[i](r); }catch(e){} }
      if(pending && !timer) timer = setTimeout(fire, 0);  /* 보내는 동안 새로 들어온 것 */
    });
  }

  /* 탭이 닫히거나 숨겨질 때 남은 마지막 저장을 흘려보낸다 */
  function beacon(){
    if(!URL_ || !pending) return;
    if(!global.navigator || !global.navigator.sendBeacon) return;
    try{
      var b = new Blob([JSON.stringify({action:'ws7save', code:pending.code, progress:pending.progress})],
                       {type:'text/plain;charset=utf-8'});
      if(global.navigator.sendBeacon(URL_, b)) pending = null;
    }catch(e){}
  }
  if(global.addEventListener){
    global.addEventListener('pagehide', beacon);
    if(global.document){
      global.document.addEventListener('visibilitychange', function(){
        if(global.document.visibilityState === 'hidden') beacon();
      });
    }
  }

  var Backend = {

    /* url = GAS 웹앱 /exec 주소. opts = {timeoutMs, gradeTimeoutMs, debounceMs} */
    configure: function(url, opts){
      URL_ = String(url || '').trim();
      opts = opts || {};
      if(opts.timeoutMs)      TIMEOUT       = Math.max(1000, opts.timeoutMs|0);
      if(opts.gradeTimeoutMs) GRADE_TIMEOUT = Math.max(1000, opts.gradeTimeoutMs|0);
      if(opts.debounceMs)     DEBOUNCE      = Math.max(0,    opts.debounceMs|0);
      return URL_;
    },

    isOn: function(){ return !!URL_; },

    /* 개인 코드 확인 → {ok, code, team, name, day, hasProgress} */
    check: function(code){
      var c = norm(code);
      if(!c) return Promise.resolve(fail('개인 코드를 입력하세요'));
      return post({action:'ws7check', code:c}).then(function(r){
        if(r.ok){ lastCode = r.code || c; lastTeam = r.team || ''; }
        return r;
      });
    },

    /* 진행 불러오기 → {ok, progress, updatedAt}. 저장된 것이 없으면 progress 는 null */
    load: function(code){
      var c = norm(code || lastCode);
      if(!c) return Promise.resolve(fail('개인 코드가 없습니다'));
      return post({action:'ws7load', code:c});
    },

    /* 진행 저장. save(progress) 또는 save(code, progress) → {ok, updatedAt}
       2초 디바운스. 같은 코드는 서버에서 덮어쓴다 */
    save: function(a, b){
      var prog = (b === undefined) ? a : b;
      var c = norm((b === undefined) ? ((a && a.code) || lastCode) : a);
      if(!c) return Promise.resolve(fail('개인 코드가 없습니다'));
      if(!prog || typeof prog !== 'object') return Promise.resolve(fail('진행 데이터가 없습니다'));
      pending = {code:c, progress:prog};
      return new Promise(function(res){
        waiters.push(res);
        if(timer) clearTimeout(timer);
        timer = setTimeout(fire, DEBOUNCE);
      });
    },

    /* 대기 중인 저장을 즉시 보낸다 (하루 마감·이탈 직전) */
    flush: function(){
      if(timer){ clearTimeout(timer); timer = null; }
      if(!pending && !busy) return Promise.resolve({ok:true, skipped:true});
      return new Promise(function(res){ waiters.push(res); fire(); });
    },

    /* AI 첨삭 → {ok, score, feedback, elements, missing, forbidHit}
       args = {code?, team, cardId, subj, body, text, compose:{mustInclude,forbid,ruleFacts,model}, ruleFacts?, channel?}
       실패하면 {ok:false, reason} — 화면은 규칙 채점으로 내려가면 된다 */
    grade: function(args){
      args = args || {};
      var c = norm(args.code || lastCode);
      if(!c) return Promise.resolve(fail('개인 코드가 없습니다'));
      var text = String(args.text == null ? '' : args.text);
      if(!text.replace(/\s/g,'')) return Promise.resolve(fail('작성한 내용이 없습니다'));
      return post({
        action:'ws7grade',
        code: c,
        team: args.team || lastTeam || '',
        cardId: args.cardId || '',
        subj: args.subj || '',
        body: args.body || '',
        text: text,
        ep: args.ep || 0,
        channel: args.channel || args.type || ''
        /* compose(필수 값·금지 표현·모범 답안)는 더 보내지 않는다 — 서버가 cardId 로 정본을 찾는다.
           보내면 조작(forbid 를 비우면 감점 없음)이 가능했다. */
      }, GRADE_TIMEOUT);
    },

    /* 화 데이터(문제 본문 · 정답 없음) — 배포본에는 data/story 가 없다. 유효한 개인 코드 · 그 코드의 팀 · 열린 일차까지만 준다.
       → {ok, story:{…, stripped:true}, rulebook:{…}|null} */
    story: function(args){
      args = args || {};
      var c = norm(args.code || lastCode);
      if(!c) return Promise.resolve(fail('개인 코드가 없습니다'));
      return post({action:'ws7story', code:c, team:args.team||lastTeam||'', ep:args.ep||1}, Math.max(TIMEOUT, 20000));
    },

    /* 채점 — 정답은 서버에만 있다. 학생 입력과 카드 번호만 보낸다.
       args = {code?, team, ep, cardId, kind, input} → {ok, result:{…}} (result 모양은 js/play/grade.js Score.<kind> 와 같다) */
    score: function(args){
      args = args || {};
      var c = norm(args.code || lastCode);
      if(!c) return Promise.resolve(fail('개인 코드가 없습니다'));
      var ms = (args.kind === 'text' || args.kind === 'approval') ? Math.max(GRADE_TIMEOUT, 20000) : Math.max(TIMEOUT, 12000);
      return post({action:'ws7score', code:c, team:args.team||lastTeam||'', ep:args.ep||1, cardId:args.cardId||null, kind:args.kind||'', input:args.input||{}}, ms);
    },

    /* 관리자: 개인 코드 발급 → {ok, team, codes:[...]} */
    issue: function(args){
      args = args || {};
      if(!args.adminKey) return Promise.resolve(fail('관리자 비밀번호가 필요합니다'));
      if(!args.team)     return Promise.resolve(fail('팀 코드가 필요합니다'));
      return post({
        action:'ws7issue',
        adminKey: args.adminKey,
        team: args.team,
        count: args.count || 1,
        prefix: args.prefix || 'WS7',
        names: args.names || []
      }, Math.max(TIMEOUT, 15000));
    }
  };

  global.Backend = Backend;
})(typeof window !== 'undefined' ? window : this);
