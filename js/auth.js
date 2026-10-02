/* ==========================================================================
   WORK SIM v2 — 소개 페이지의 계정·토큰 (W7)
   --------------------------------------------------------------------------
   전역: window.WS.fb    Firebase 초기화 결과 { app, auth, db, ... }
         window.WS.auth  화면이 쓰는 얇은 껍데기 { signUp, signIn, ... }

   먼저 로드돼 있어야 하는 것(home.html 이 이 순서로 넣는다):
     https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js
     https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js
     https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js
     js/firebase-config.js               (프로젝트 work-sim-7day · window.WS.fb 를 만든다)
     js/backend-url.js · js/backend.js   (토큰 검증에 GAS ws7check 를 쓴다)

   흐름 (38차 — 계정은 선택이다)
     ① 기본: 소개 → 개인 토큰 WS7-XXXX-XXXX → GAS ws7check 검증 → play.html?code=… 로 이동.
        진행 저장·불러오기(ws7save·ws7load)는 **코드 기준**이라 계정이 없어도 이어 하기가 된다.
        확인된 토큰은 localStorage 에 남아 다음 방문 때 「이어 하기 N일차」로 바로 들어간다.
     ② 선택: 회원가입/로그인 → 같은 토큰 등록 → RTDB ws7/users/{uid}·ws7/tokens/{code} 기록.
        계정이 하는 일은 관리자 화면에 사람 이름을 띄우고 기기를 옮겨도 이름이 따라오게 하는 것뿐이다.

   설계 판단 세 가지
     1) Firebase 프로젝트는 **work-sim-7day** 다(co-work-sim 의 team-work-sim 과 별개).
        무료 한도를 나눠 쓰지 않으려고 대표 지시로 분리했다. 초기화는
        js/firebase-config.js 한 곳에서만 한다 — 이 파일은 initializeApp 을 부르지 않고
        거기서 만든 window.WS.fb 에 함수만 얹는다.
     2) 진실의 근거는 GAS 다. 토큰이 유효한지, 몇 일차인지는 ws7check 가 정한다.
        RTDB 기록은 관리자 화면(W8)이 실시간으로 보기 위한 거울이다.
        그래서 RTDB 쓰기가 규칙에 막혀도 학생은 그대로 게임에 들어간다(등록은 로컬에 남긴다).
     3) 이메일/비밀번호 로그인이 콘솔에서 아직 켜지지 않았으면
        auth/configuration-not-found · auth/operation-not-allowed 가 온다.
        그때는 「관리자가 로그인 기능을 켜는 중입니다」로 안내하고,
        소개 화면과 미리 받기는 그대로 돌아간다.
   ========================================================================== */
(function (global) {
  'use strict';

  var WS = global.WS = global.WS || {};

  /* ------------------------------------------------------------------------
     2) 로컬 기록 — 서버가 막혀도 「이어 하기」가 되게 하는 최소한의 메모
     ---------------------------------------------------------------------- */
  var LS = 'ws7.portal';

  function loadLocal() {
    try { return JSON.parse(global.localStorage.getItem(LS) || '{}') || {}; }
    catch (e) { return {}; }
  }

  function saveLocal(patch) {
    var cur = loadLocal();
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) cur[k] = patch[k];
    cur.at = Date.now();
    try { global.localStorage.setItem(LS, JSON.stringify(cur)); } catch (e) {}
    /* play.html(js/play/day.js)이 코드 없이 열려도 이어 하도록 같은 열쇠를 심는다 */
    try { if (cur.code) global.localStorage.setItem('ws7.code', cur.code); } catch (e) {}
    return cur;
  }

  function clearLocal() {
    try { global.localStorage.removeItem(LS); global.localStorage.removeItem('ws7.code'); } catch (e) {}
  }

  /* ------------------------------------------------------------------------
     3) 초기화 — js/firebase-config.js 가 만든 window.WS.fb 를 그대로 받는다
     ---------------------------------------------------------------------- */
  var fb = WS.fb || null;
  var auth = fb && fb.auth, db = fb && fb.db;
  var ready = !!(fb && auth && db);
  var initError = ready ? '' : 'Firebase 설정을 불러오지 못했습니다(js/firebase-config.js 확인)';

  /* 새로고침해도 로그인이 유지되게 LOCAL(IndexedDB). 이 화면에는 익명 세션이 없어
     co-work-sim 처럼 탭 단위로 격리할 이유가 없다. */
  function persist() {
    try {
      var P = global.firebase.auth.Auth.Persistence;
      return auth.setPersistence(P.LOCAL);
    } catch (e) { return Promise.resolve(); }
  }

  /* firebase-config.js 가 만든 객체에 함수만 얹는다(덮어쓰지 않는다) */
  if (fb) {
    fb.ready = function () { return ready; };
    fb.error = function () { return initError; };
    fb.uid = function () { return (auth && auth.currentUser) ? auth.currentUser.uid : null; };
    fb.onAuthState = function (cb) { return ready ? auth.onAuthStateChanged(cb) : function () {}; };
    fb.signOut = function () { return ready ? auth.signOut() : Promise.resolve(); };
  } else {
    WS.fb = {
      ready: function () { return false; },
      error: function () { return initError; },
      uid: function () { return null; },
      onAuthState: function () { return function () {}; },
      signOut: function () { return Promise.resolve(); }
    };
  }

  /* ------------------------------------------------------------------------
     4) 사람이 읽는 오류 문구 — Firebase 코드를 그대로 보여 주지 않는다
     ---------------------------------------------------------------------- */
  var MSG = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인해 주세요.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/weak-password': '비밀번호는 6자 이상이어야 합니다.',
    'auth/wrong-password': '비밀번호가 맞지 않습니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/invalid-login-credentials': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/too-many-requests': '시도가 너무 잦습니다. 잠시 뒤에 다시 해 주세요.',
    'auth/network-request-failed': '네트워크에 연결하지 못했습니다.',
    'auth/operation-not-allowed': '관리자가 로그인 기능을 켜는 중입니다. 잠시 뒤 다시 시도해 주세요.',
    'auth/configuration-not-found': '관리자가 로그인 기능을 켜는 중입니다. 잠시 뒤 다시 시도해 주세요.',
    'auth/admin-restricted-operation': '관리자가 로그인 기능을 켜는 중입니다. 잠시 뒤 다시 시도해 주세요.'
  };

  var SETUP = /configuration-not-found|operation-not-allowed|admin-restricted-operation/;
  var authOff = false;          /* 콘솔에서 이메일 로그인을 아직 안 켰다 */

  function human(e) {
    if (!e) return '알 수 없는 오류입니다';
    if (e.code && SETUP.test(e.code)) authOff = true;
    return MSG[e.code] || e.message || '알 수 없는 오류입니다';
  }

  /* ------------------------------------------------------------------------
     5) 입력 검사 — 화면과 같은 규칙을 여기서 한 번 더 센다
        (개발자 도구로 maxlength 를 지워도 계정만 만들어지고 기록이 없는 일이 없게)
     ---------------------------------------------------------------------- */
  function vName(v) {
    v = String(v || '').trim();
    if (!v) return '이름을 입력해 주세요';
    if (v.length > 40) return '이름은 40자까지입니다';
    return '';
  }

  function vOrg(v) {
    v = String(v || '').trim();
    if (!v) return '소속을 입력해 주세요';
    if (v.length > 120) return '소속은 120자까지입니다';
    return '';
  }

  function vEmail(v) {
    v = String(v || '').trim();
    if (!v) return '이메일을 입력해 주세요';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return '이메일 형식이 올바르지 않습니다';
    return '';
  }

  function vPw(v) {
    v = String(v || '');
    if (!v) return '비밀번호를 입력해 주세요';
    if (v.length < 8) return '비밀번호는 8자 이상으로 해 주세요';
    if (v.length > 100) return '비밀번호가 너무 깁니다';
    return '';
  }

  /* 개인 토큰 WS7-XXXX-XXXX. 소문자로 쳐도, 하이픈을 빠뜨려도 받아 준다 */
  function normCode(v) {
    v = String(v || '').trim().toUpperCase().replace(/\s+/g, '');
    var bare = v.replace(/-/g, '');
    if (/^WS7[A-Z0-9]{8}$/.test(bare)) {
      return bare.slice(0, 3) + '-' + bare.slice(3, 7) + '-' + bare.slice(7, 11);
    }
    return v;
  }

  function vCode(v) {
    if (!v) return '개인 토큰을 입력해 주세요';
    if (!/^[A-Z0-9]{2,6}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v)) return '토큰 형식이 달라요. 예: WS7-ZBK6-NA73';
    return '';
  }

  /* ------------------------------------------------------------------------
     6) RTDB 거울 — 실패해도 흐름을 멈추지 않는다
     ---------------------------------------------------------------------- */
  var RTDB_MS = 5000;

  /* 규칙에 ws7 가 없으면 모든 읽기·쓰기가 permission_denied 로 돌아온다.
     한 번 막힌 것을 확인하면 그 뒤로는 부르지 않는다 — 콘솔 경고가 쌓이고
     화면이 매번 기다리기만 하기 때문이다. 규칙이 게시되면 새로고침으로 풀린다. */
  var rtdbBlocked = false;

  function markBlocked(reason) {
    if (/permission|denied|권한/i.test(String(reason || ''))) rtdbBlocked = true;
    return reason;
  }

  function withTimeout(p, ms) {
    return new Promise(function (res) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; res({ok: false, reason: '응답 시간 초과'}); } }, ms);
      p.then(function (v) { if (!done) { done = true; clearTimeout(t); res({ok: true, value: v}); } },
             function (e) { if (!done) { done = true; clearTimeout(t); res({ok: false, reason: human(e)}); } });
    });
  }

  /* block=false 로 부르면 한 경로가 막혀도 전체를 끄지 않는다.
     ws7/tokens 쓰기는 규칙이 「이미 주인이 있는 토큰」을 막는 정상 동작일 수 있어
     그것 하나로 ws7/users 읽기까지 죽이면 안 된다. 전체를 끄는 신호는
     내 프로필(ws7/users/{uid}) 접근이 막힐 때뿐이다. */
  function rtdbSet(path, value, block) {
    if (!ready) return Promise.resolve({ok: false, reason: 'Firebase 가 준비되지 않았습니다'});
    if (rtdbBlocked) return Promise.resolve({ok: false, reason: 'RTDB 규칙에 ws7 가 없어 기록을 건너뜁니다'});
    try {
      return withTimeout(db.ref(path).update(value), RTDB_MS).then(function (r) {
        if (!r.ok && block !== false) markBlocked(r.reason);
        return r;
      });
    } catch (e) { return Promise.resolve({ok: false, reason: human(e)}); }
  }

  function rtdbGet(path, block) {
    if (!ready) return Promise.resolve({ok: false, reason: 'Firebase 가 준비되지 않았습니다'});
    if (rtdbBlocked) return Promise.resolve({ok: false, reason: 'RTDB 규칙에 ws7 가 없어 읽기를 건너뜁니다'});
    try {
      return withTimeout(db.ref(path).once('value'), RTDB_MS).then(function (r) {
        if (!r.ok) { if (block !== false) markBlocked(r.reason); return r; }
        return {ok: true, value: r.value && r.value.val ? r.value.val() : null};
      });
    } catch (e) { return Promise.resolve({ok: false, reason: human(e)}); }
  }

  /* ------------------------------------------------------------------------
     7) 화면이 쓰는 껍데기
     ---------------------------------------------------------------------- */
  var profileCache = null;    /* 마지막으로 읽은 ws7/users/{uid} (또는 로컬 기록) */

  var Auth = {

    normCode: normCode,
    validate: {name: vName, org: vOrg, email: vEmail, pw: vPw, code: vCode},
    local: loadLocal,

    /* 로그인 상태 구독. cb(user|null) */
    watch: function (cb) {
      if (!ready) { setTimeout(function () { cb(null); }, 0); return function () {}; }
      return auth.onAuthStateChanged(cb);
    },

    user: function () { return (ready && auth.currentUser) ? auth.currentUser : null; },

    /* 가입 → {ok, user} 또는 {ok:false, reason} */
    signUp: function (a) {
      a = a || {};
      var bad = vName(a.name) || vOrg(a.org) || vEmail(a.email) || vPw(a.pw);
      if (bad) return Promise.resolve({ok: false, reason: bad});
      if (String(a.pw) !== String(a.pw2 === undefined ? a.pw : a.pw2)) {
        return Promise.resolve({ok: false, reason: '비밀번호 두 칸이 서로 다릅니다'});
      }
      if (!ready) return Promise.resolve({ok: false, reason: initError || 'Firebase 를 쓸 수 없습니다'});

      return persist()
        .then(function () { return auth.createUserWithEmailAndPassword(String(a.email).trim(), String(a.pw)); })
        .then(function (cred) {
          var u = cred.user;
          var prof = {
            name: String(a.name).trim(),
            org: String(a.org).trim(),
            email: String(a.email).trim(),
            joinedAt: Date.now()
          };
          saveLocal({uid: u.uid, email: prof.email, name: prof.name, org: prof.org});
          /* 프로필 이름은 RTDB 가 막혀도 남게 Auth 쪽에도 적어 둔다 */
          var p1 = u.updateProfile ? u.updateProfile({displayName: prof.name}).catch(function () {}) : Promise.resolve();
          return p1.then(function () { return rtdbSet('ws7/users/' + u.uid, prof); })
                   .then(function (r) {
                     profileCache = prof;
                     return {ok: true, user: u, profile: prof, mirrored: !!(r && r.ok), mirrorReason: r && r.reason};
                   });
        })
        .catch(function (e) { return {ok: false, reason: human(e)}; });
    },

    /* 로그인 → {ok, user} */
    signIn: function (a) {
      a = a || {};
      var bad = vEmail(a.email) || (String(a.pw || '') ? '' : '비밀번호를 입력해 주세요');
      if (bad) return Promise.resolve({ok: false, reason: bad});
      if (!ready) return Promise.resolve({ok: false, reason: initError || 'Firebase 를 쓸 수 없습니다'});

      return persist()
        .then(function () { return auth.signInWithEmailAndPassword(String(a.email).trim(), String(a.pw)); })
        .then(function (cred) {
          saveLocal({uid: cred.user.uid, email: String(a.email).trim()});
          return {ok: true, user: cred.user};
        })
        .catch(function (e) { return {ok: false, reason: human(e)}; });
    },

    signOut: function () {
      profileCache = null;
      return ready ? auth.signOut().catch(function () {}) : Promise.resolve();
    },

    /* 비밀번호 재설정 메일 */
    reset: function (email) {
      var bad = vEmail(email);
      if (bad) return Promise.resolve({ok: false, reason: bad});
      if (!ready) return Promise.resolve({ok: false, reason: initError || 'Firebase 를 쓸 수 없습니다'});
      return auth.sendPasswordResetEmail(String(email).trim())
        .then(function () { return {ok: true}; })
        .catch(function (e) { return {ok: false, reason: human(e)}; });
    },

    /* 로그인한 사람의 프로필 — RTDB 를 먼저 보고, 막히면 로컬 기록을 쓴다.
       반환 {name, org, email, code, team, day, source:'rtdb'|'local'} */
    profile: function () {
      var u = Auth.user();
      var lo = loadLocal();
      if (!u) return Promise.resolve(null);
      return rtdbGet('ws7/users/' + u.uid).then(function (r) {
        var v = (r.ok && r.value) ? r.value : null;
        var p = {
          name: (v && v.name) || lo.name || u.displayName || '',
          org: (v && v.org) || lo.org || '',
          email: (v && v.email) || u.email || lo.email || '',
          code: (v && v.code) || ((lo.uid === u.uid) ? (lo.code || '') : ''),
          team: (v && v.team) || ((lo.uid === u.uid) ? (lo.team || '') : ''),
          day: (v && v.day) || ((lo.uid === u.uid) ? (lo.day || 0) : 0),
          source: v ? 'rtdb' : 'local'
        };
        profileCache = p;
        return p;
      });
    },

    cached: function () { return profileCache; },

    /* RTDB 거울이 막혀 있는지(규칙 미게시) */
    mirrorBlocked: function () { return rtdbBlocked; },

    /* 콘솔에서 이메일/비밀번호 로그인을 아직 안 켰는지 */
    authOff: function () { return authOff; },

    /* 개인 토큰 확인·등록.
       ① GAS ws7check 로 실제로 존재하는 코드인지 확인 — 여기가 진짜 관문이다
       ② 로그인 상태가 아니면 여기서 끝난다(계정 없이 토큰만으로 시작하는 길)
       ③ 로그인 상태면 RTDB ws7/tokens/{code} 를 보고 남이 쓴 토큰이면 거절하고,
          ws7/users/{uid}.code · ws7/tokens/{code}.usedBy 를 기록한다(막히면 조용히 넘어간다)
       반환 {ok, code, team, day, name, anon, mirrored, mirrorReason} */
    registerToken: function (raw) {
      var code = normCode(raw);
      var bad = vCode(code);
      if (bad) return Promise.resolve({ok: false, reason: bad});

      var B = global.Backend;
      if (!B || typeof B.check !== 'function' || !B.isOn || !B.isOn()) {
        return Promise.resolve({ok: false, reason: '토큰 확인 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.'});
      }

      var u = Auth.user();

      /* 계정 없이 토큰만으로 — 진행은 GAS 가 code 기준으로 저장하므로 계정이 필요 없다.
         관리자 화면에 이름이 뜨지 않을 뿐이고, 뒤에 로그인하면 그때 거울이 채워진다. */
      if (!u) {
        return B.check(code).then(function (r) {
          if (!r || !r.ok) return {ok: false, reason: (r && r.reason) || '등록되지 않은 토큰입니다'};
          var info = {code: r.code || code, team: r.team || '', day: r.day || 1, name: r.name || ''};
          saveLocal({code: info.code, team: info.team, day: info.day, name: info.name || loadLocal().name || ''});
          return {
            ok: true, code: info.code, team: info.team, day: info.day, name: info.name,
            anon: true, mirrored: false, mirrorReason: '계정 없이 토큰으로 시작 — 거울 기록을 건너뜁니다'
          };
        }).catch(function (e) { return {ok: false, reason: human(e)}; });
      }

      return B.check(code).then(function (r) {
        if (!r || !r.ok) return {ok: false, reason: (r && r.reason) || '등록되지 않은 토큰입니다'};
        var info = {code: r.code || code, team: r.team || '', day: r.day || 1, name: r.name || ''};

        /* ② 남이 쓴 토큰인지 — RTDB 를 읽을 수 있을 때만 본다 */
        return rtdbGet('ws7/tokens/' + info.code, false).then(function (t) {
          if (t.ok && t.value && t.value.usedBy && t.value.usedBy !== u.uid) {
            return {ok: false, reason: '이미 다른 계정이 쓰고 있는 토큰입니다. 담당 선생님께 문의해 주세요.'};
          }
          /* ③ 거울 기록 */
          var now = Date.now();
          /* 규칙이 users/$uid 에 name 을 요구한다(hasChildren(['name'])).
             가입 때 기록이 막혔을 수도 있으므로 여기서도 같이 넣는다. */
          var nm = (profileCache && profileCache.name) || loadLocal().name || u.displayName || '';
          return rtdbSet('ws7/users/' + u.uid, {name: nm, code: info.code, team: info.team, day: info.day})
            .then(function (a) {
              return rtdbSet('ws7/tokens/' + info.code, {
                team: info.team, status: 'active', usedBy: u.uid, usedAt: now
              }, false).then(function (b) {
                var mirrored = !!(a && a.ok) && !!(b && b.ok);
                saveLocal({uid: u.uid, code: info.code, team: info.team, day: info.day});
                return {
                  ok: true, code: info.code, team: info.team, day: info.day, name: info.name,
                  anon: false, mirrored: mirrored,
                  mirrorReason: mirrored ? '' : ((a && a.reason) || (b && b.reason) || '')
                };
              });
            });
        });
      }).catch(function (e) {
        return {ok: false, reason: human(e)};
      });
    },

    /* 진행 일차만 다시 물어본다(소개 페이지 「이어 하기」 라벨용) */
    refreshDay: function (code) {
      var B = global.Backend;
      if (!code || !B || !B.isOn || !B.isOn()) return Promise.resolve(0);
      return B.check(code).then(function (r) {
        if (r && r.ok) {
          var d = r.day || 1;
          saveLocal({code: r.code || code, team: r.team || '', day: d});
          return d;
        }
        return 0;
      }).catch(function () { return 0; });
    },

    /* 게임으로 가는 주소 */
    playUrl: function (code) {
      var c = normCode(code || (loadLocal().code || ''));
      return c ? ('play.html?code=' + encodeURIComponent(c)) : 'play.html';
    },

    /* 이 기기에 기억해 둔 토큰만 지운다(계정 로그인은 건드리지 않는다).
       「다른 토큰 넣기」가 부른다. */
    forgetCode: function () {
      var cur = loadLocal();
      delete cur.code; delete cur.team; delete cur.day;
      try { global.localStorage.setItem(LS, JSON.stringify(cur)); } catch (e) {}
      try { global.localStorage.removeItem('ws7.code'); } catch (e) {}
    },

    forget: clearLocal
  };

  WS.auth = Auth;
})(typeof window !== 'undefined' ? window : this);
