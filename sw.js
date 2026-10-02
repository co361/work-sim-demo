/* ==========================================================================
   WORK SIM v2 — 서비스 워커 (W7 소개·로그인 포털)
   --------------------------------------------------------------------------
   두 가지만 한다.
     1) assets/ 아래 3D 파일(GLB·텍스처)  → cache-first. 한 번 받으면 두 번째 방문은 0초.
     2) 그 밖의 같은 출처 파일(html·js·json) → network-first, 실패하면 캐시.
        코드와 시나리오 데이터는 바뀌므로 항상 새것을 먼저 본다.
   무효화는 CACHE 이름의 버전 문자열 하나로 한다. 에셋을 갈아 끼우면 v 를 올린다.

   지키는 것
     - 같은 출처 GET 만 가로챈다. GAS(POST)·Firebase(웹소켓)·CDN 은 손대지 않는다.
     - 디렉터리 목록(`assets/` 처럼 / 로 끝나는 주소)은 캐시하지 않는다
       — office.html 이 파일 존재 확인에 쓰는 목록이라 낡으면 안 된다.
     - 등록이 실패하거나 이 파일이 없어도 페이지는 그대로 돈다(home.html 이 try 로 감싼다).
   ========================================================================== */
'use strict';

/* 색·레이아웃을 바꿀 때마다 올린다. 올리지 않으면 대표 화면에 옛 금색 판이 그대로 남는다.
   40차(하루 시계·대화 모드·메일/메신저/전화 분리·디브리프 색)에서 v5 로 올렸다.
   화면에 싣는 CSS·JS 에는 ?v=20260907g 도 함께 붙어 있다. */
var CACHE = 'ws7demo-v1-20261002';   /* 데모 사이트(co361/work-sim-demo) — 라이브 캐시와 이름이 겹치지 않게 ws7demo- 로 시작 */ /* 원래: 'ws7-v20-pdftext-20260928';   /* 59차 결과 PDF 글자 PDF(jsPDF + Pretendard 서브셋 · 구성 재편 — js/play/result_pdf.js) · 옛 판 ws7-v19-pdf-20260928 */
/* 옛 판 v19 = 내 결과 PDF(js/play/result_pdf.js · js/ncs_report.js 싣기 · day.js·ep7.js 단추) · 옛 판 ws7-v18-ncs57-20260927 */
/* 옛 판 v18 = 57차 NCS 전환 배포 + 관리자 화면(admin.html·js/admin.js) 제거 — networkFirst 가 404 를 캐시로 폴백하므로 올린다 · 옛 판 ws7-v17-gate-20260921 */

/* 캐시에 담아 둘 값어치가 있는 무거운 것 — 확장자로 판단한다 */
var HEAVY = /\.(glb|gltf|bin|png|jpg|jpeg|webp|ktx2|woff2?)$/i;

self.addEventListener('install', function (e) {
  /* 미리 담아 두는 것은 없다. 소개 페이지가 실제로 받는 것만 캐시에 쌓인다. */
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return (k === CACHE || k.indexOf('ws7demo-') !== 0) ? null : caches.delete(k);   /* 데모: 같은 출처의 라이브 캐시는 지우지 않는다 */
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 캐시 우선 — 있으면 그대로 주고, 없으면 받아서 담는다 */
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return res;
    });
  });
}

/* 네트워크 우선 — 받으면 담고, 못 받으면 캐시에서 꺼낸다 */
function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) return hit;
      return new Response('오프라인입니다', {status: 503, headers: {'Content-Type': 'text/plain;charset=utf-8'}});
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;                       /* GAS 저장·채점(POST)은 그대로 */

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;        /* Firebase SDK·CDN 은 그대로 */
  if (url.pathname.charAt(url.pathname.length - 1) === '/') return;   /* 디렉터리 목록은 그대로 */

  if (url.pathname.indexOf('/assets/') >= 0 && HEAVY.test(url.pathname)) {
    e.respondWith(cacheFirst(req));
  } else {
    e.respondWith(networkFirst(req));
  }
});

/* 소개 페이지가 「캐시 비우기」를 부를 수 있게 열어 둔다(검사·문제 대응용) */
self.addEventListener('message', function (e) {
  var d = e.data || {};
  if (d.type === 'ws7-purge') {
    e.waitUntil(caches.delete(CACHE).then(function () {
      if (e.source && e.source.postMessage) e.source.postMessage({type: 'ws7-purged'});
    }));
  }
});
