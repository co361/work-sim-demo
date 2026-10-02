/* ==========================================================================
   WORK SIM v2 — 미리 받기 (W7)
   --------------------------------------------------------------------------
   전역: window.WS.prefetch = { start, stop, status }

   소개를 읽고 로그인하는 20~30초 동안 게임이 쓸 파일을 뒤에서 받아 둔다.
   받은 것은 서비스 워커(sw.js)가 캐시에 담으므로, play.html 이 열릴 때
   three.js 가 같은 주소를 다시 부르면 네트워크를 타지 않는다.

   두 가지 모드
     full  — 소개 페이지에 3D 사무실이 없다(모바일·저사양·폴백).
             플레이어 → 방 소품 → NPC → 코드·데이터 순으로 전부 받는다.
     light — 소개 페이지 히어로가 이미 office.html 을 띄워 놓았다.
             그 3D 가 캐릭터·소품을 실제로 받고 있으므로 여기서는
             코드·시나리오 데이터만 데운다(같은 파일을 두 번 받지 않는다).

   지키는 것
     - 어떤 실패도 화면을 멈추지 않는다. 못 받은 파일은 세기만 하고 넘어간다.
     - 데이터 절약 모드·2G 에서는 무거운 것을 받지 않는다.
     - 동시 2개까지만 받는다. 사용자가 「시작」을 누르면 stop() 으로 즉시 비킨다.
     - 없을 수도 있는 파일(얼굴 아틀라스)은 assets/ 목록으로 먼저 걸러
       404 가 콘솔에 남지 않게 한다. 목록을 못 읽는 환경(정적 호스팅)에서는 뺀다.
   ========================================================================== */
(function (global) {
  'use strict';

  var WS = global.WS = global.WS || {};

  var PLAYER = 'acnh_25';                                  /* office.html makeSeat('me', …, ch:'acnh_25') */
  var ANIM_ALL = ['idle', 'walk', 'walking', 'sit', 'sitdown', 'standup', 'chat', 'type2'];
  var ANIM_NPC = ['idle', 'sit', 'chat', 'type2'];

  /* 팀별로 방에 앉는 얼굴 — office.html 의 CAST·기본 좌석과 같은 값 */
  var CAST = {
    cs:   ['acnh_30', 'acnh_31', 'acnh_19', 'acnh_33'],
    logi: ['acnh_45', 'acnh_23', 'acnh_18'],
    acct: ['acnh_34', 'acnh_39', 'acnh_20'],
    ga:   ['acnh_24', 'acnh_19', 'acnh_22'],
    rec:  ['acnh_35', 'acnh_26', 'acnh_17'],
    plan: ['acnh_41', 'acnh_42', 'acnh_38'],
    qc:   ['acnh_27', 'acnh_28', 'acnh_32'],
    pr:   ['acnh_40', 'acnh_44', 'acnh_33'],
    edu:  ['acnh_43', 'acnh_46', 'acnh_29'],
    buy:  ['acnh_37', 'acnh_36', 'acnh_21']
  };

  /* play.html 이 실제로 부르는 코드·데이터 */
  var CODE_FILES = [
    'js/backend.js', 'js/desk/appicon.js', 'js/desk/windows.js', 'js/desk/wallpaper.js',
    'js/desk/desktop.js', 'js/desk/msgapp.js', 'js/desk/telapp.js', 'js/desk/deskapp.js', 'js/desk/desk.css',
    'js/backend-url.js', 'js/play/core.js', 'js/play/intro.js', 'js/ncs.js', 'js/ncs_eval.js',
    'js/play/grade.js', 'js/play/cards.js', 'js/play/day.js',
    'js/play/ep7.js', 'js/play/talk.js', 'js/play/pc.js', 'js/play/grader.js', 'js/play/ep7grade.js', 'js/gated.js', 'js/ncs_report.js', 'js/play/result_pdf.js',
    /* data/rulebook.js·data/story 는 배포본에 없다(서버가 토큰 확인 뒤 준다) — 미리 받지 않는다(57차: 받으면 배포본에서 404) */
    /* PC 를 켜는 순간 벽지가 없으면 폴백 그라디언트가 한 번 번쩍인다 —
       기본(lake) 한 장만 미리 받는다. 나머지 셋은 지금 쓰지 않는다. */
    'assets/wall/lake.webp?v=3',
    /* PC 독·바탕화면의 승인 입체 아이콘(2026-09-29) — 이 게임이 실제로 그리는 것만.
       주소는 appicon.js 가 부르는 것과 **글자까지 같아야** 캐시가 맞는다(?v= = ART_VER). */
    'assets/appicon/mail.webp?v=3', 'assets/appicon/messenger.webp?v=3', 'assets/appicon/talk.webp?v=3',
    'assets/appicon/clock.webp?v=3', 'assets/appicon/book.webp?v=3', 'assets/appicon/log.webp?v=3',
    'assets/appicon/note.webp?v=3', 'assets/appicon/org.webp?v=3', 'assets/appicon/memo.webp?v=3',
    'assets/appicon/finish.webp?v=3', 'assets/appicon/sheet.webp?v=3'
  ];

  var S = {
    running: false, mode: '', done: 0, total: 0, failed: 0, bytes: 0,
    label: '', ctl: null, onProgress: null, finishedAt: 0
  };

  function slow() {
    try {
      var c = global.navigator && (global.navigator.connection || global.navigator.mozConnection);
      if (!c) return false;
      if (c.saveData) return true;
      return /^(slow-2g|2g)$/.test(c.effectiveType || '');
    } catch (e) { return false; }
  }

  /* assets/ 디렉터리 목록(serve.py 가 준다). 못 읽으면 null */
  var listCache;
  function assetList() {
    if (listCache !== undefined) return Promise.resolve(listCache);
    return fetch('assets/').then(function (r) {
      if (!r.ok) throw 0;
      return r.text();
    }).then(function (t) {
      var set = {}, m, re = /href="([^"]+)"/g;
      while ((m = re.exec(t))) {
        try { set[decodeURIComponent(m[1])] = 1; } catch (e) { set[m[1]] = 1; }
      }
      listCache = set;
      return set;
    }).catch(function () { listCache = null; return null; });
  }

  function animPaths(ch, kinds, slimSet) {
    var out = [];
    for (var i = 0; i < kinds.length; i++) {
      var f = ch + '_' + kinds[i] + '.glb';
      /* 슬림 애니(메시 없는 클립 전용)가 있으면 그것만 받는다. 없으면 통짜 GLB */
      if (slimSet && slimSet[f]) out.push('assets/anim/' + f);
      else out.push('assets/' + ch + '_anim_' + kinds[i] + '.glb');
    }
    return out;
  }

  function charPaths(ch, kinds, slimSet, list) {
    var out = ['assets/' + ch + '_rigged.glb', 'assets/' + ch + '_noface.jpg'];
    var atlas = 'face_atlas_cells_' + ch + '.png';
    if (list && list[atlas]) out.push('assets/' + atlas);           /* 목록으로 확인될 때만 */
    return out.concat(animPaths(ch, kinds, slimSet));
  }

  function buildList(team, mode) {
    var jobs = [];
    if (mode === 'light') {
      /* 3D 히어로가 캐릭터·소품을 받는 중이다. 코드·데이터만 데운다 */
      jobs = CODE_FILES.slice();
      return Promise.resolve(jobs);
    }

    return Promise.all([
      assetList(),
      fetch('assets/anim/manifest.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetch('assets/props/manifest.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (res) {
      var list = res[0];
      var slimSet = null;
      if (res[1] && res[1].files) {
        slimSet = {};
        for (var i = 0; i < res[1].files.length; i++) slimSet[res[1].files[i]] = 1;
      }
      var props = (res[2] && res[2].types) || [];

      /* ① 플레이어 */
      jobs = jobs.concat(charPaths(PLAYER, ANIM_ALL, slimSet, list));
      /* ② 방 소품 */
      for (var p = 0; p < props.length; p++) jobs.push('assets/props/' + props[p] + '.glb');
      /* ③ NPC */
      var cast = CAST[team] || CAST.cs;
      for (var c = 0; c < cast.length; c++) jobs = jobs.concat(charPaths(cast[c], ANIM_NPC, slimSet, list));
      /* ④ 코드·데이터 */
      jobs = jobs.concat(CODE_FILES);

      /* 같은 파일이 두 번 들어가지 않게(팀에 따라 얼굴이 겹칠 수 있다) */
      var seen = {}, uniq = [];
      for (var k = 0; k < jobs.length; k++) {
        if (seen[jobs[k]]) continue;
        seen[jobs[k]] = 1; uniq.push(jobs[k]);
      }
      return uniq;
    });
  }

  function fetchOne(url) {
    var opt = S.ctl ? {signal: S.ctl.signal} : {};
    return fetch(url, opt).then(function (r) {
      if (!r.ok) throw new Error(String(r.status));
      /* 본문을 읽어야 스트림이 끝나고 서비스 워커가 캐시에 담는다.
         읽은 버퍼는 바로 버린다(길이만 진행률에 쓴다). */
      return r.arrayBuffer();
    }).then(function (buf) {
      S.bytes += (buf && buf.byteLength) || 0;
      S.done++;
      report();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      S.failed++; S.done++;
      report();
    });
  }

  function report() {
    if (typeof S.onProgress === 'function') {
      try { S.onProgress(S.total ? (S.done / S.total) : 0, S.done, S.total, S.bytes); } catch (e) {}
    }
  }

  function runQueue(jobs, conc) {
    var i = 0;
    function next() {
      if (!S.running || i >= jobs.length) return Promise.resolve();
      var url = jobs[i++];
      return fetchOne(url).then(next);
    }
    var lanes = [];
    for (var n = 0; n < conc; n++) lanes.push(next());
    return Promise.all(lanes);
  }

  var Prefetch = {

    /* opts = {team, mode:'full'|'light', onProgress(ratio, done, total, bytes)} */
    start: function (opts) {
      opts = opts || {};
      if (S.running) return Promise.resolve(Prefetch.status());
      var team = (opts.team || 'cs').toLowerCase();
      var mode = opts.mode === 'light' ? 'light' : 'full';
      if (mode === 'full' && slow()) mode = 'light';      /* 데이터 절약·느린 회선이면 가벼운 것만 */

      S.running = true; S.mode = mode; S.done = 0; S.total = 0; S.failed = 0; S.bytes = 0;
      S.onProgress = opts.onProgress || null;
      S.ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;

      return buildList(team, mode).then(function (jobs) {
        if (!S.running) return Prefetch.status();
        S.total = jobs.length;
        report();
        return runQueue(jobs, mode === 'light' ? 3 : 2).then(function () {
          S.running = false; S.finishedAt = Date.now();
          report();
          return Prefetch.status();
        });
      }).catch(function () {
        S.running = false;
        return Prefetch.status();
      });
    },

    /* 사용자가 게임을 시작하면 대역폭을 즉시 비켜 준다 */
    stop: function () {
      S.running = false;
      if (S.ctl) { try { S.ctl.abort(); } catch (e) {} }
      return Prefetch.status();
    },

    status: function () {
      return {
        running: S.running, mode: S.mode, done: S.done, total: S.total,
        failed: S.failed, bytes: S.bytes,
        ratio: S.total ? (S.done / S.total) : 0,
        finishedAt: S.finishedAt
      };
    }
  };

  WS.prefetch = Prefetch;
})(typeof window !== 'undefined' ? window : this);
