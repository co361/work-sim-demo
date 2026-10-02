/* WORK SIM v2(7일차 직무 게임) 전용 Firebase — 2026-09-07.
   co-work-sim(team-work-sim)과 **다른 프로젝트**다. 무료 한도를 나눠 쓰지 않으려고 분리했다.
   웹 설정값은 공개 정보라 그대로 두어도 된다(권한은 database.rules.json 이 정한다).
   전역: window.WS.fb = { app, auth, db }  — co-work-sim 의 window.OC 와 섞이지 않게 이름을 나눴다.
   앞서 아래 스크립트가 실려 있어야 한다(전역 firebase):
     https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js
     https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js
     https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js */
(function () {
  'use strict';
  window.WS = window.WS || {};
  var cfg = {
    apiKey: 'AIzaSyDrNtHJbe2IdjPpLPl4hUwwrYmQafjWEPQ',
    authDomain: 'work-sim-7day.firebaseapp.com',
    databaseURL: 'https://work-sim-7day-default-rtdb.firebaseio.com',
    projectId: 'work-sim-7day',
    storageBucket: 'work-sim-7day.firebasestorage.app',
    messagingSenderId: '944444295316',
    appId: '1:944444295316:web:e9a4c7b12693c4535f8c81'
  };
  if (typeof firebase === 'undefined') { window.WS.fb = null; return; }
  var app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
  window.WS.fb = { app: app, auth: firebase.auth(), db: firebase.database(), config: cfg };
})();
