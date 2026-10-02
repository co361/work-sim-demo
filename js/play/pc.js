/* ======================================================================
   내 자리 컴퓨터 — 3D 사무실과 PC 바탕화면(js/desk/*)을 잇는다.

   규칙 하나: **컴퓨터는 내 자리에 앉아야만 열린다.**
   대표 "본인 자리로 돌아가서 컴퓨터를 열 수 있어야 하지 않을까?" — 아무 데서나 열리면
   걸어 다닐 이유가 없어진다. 그래서 상단 「PC」 단추와 안내 띠는 앉아 있을 때만 살고,
   자리를 뜨면 화면이 따라 꺼진다. 메일·메신저가 와도 자리에 없으면 열리지 않고 빨간
   점만 찍힌다 — 그것이 「걸어 다니는 이유」다.

   종류마다 창이 다르다(대표 "너무 산만해"): 메일함 · 사내 메신저 · 전화 메모 · 업무 노트.
   ====================================================================== */
(function(){
  const D2 = window.Desk;
  if(!D2){ return; }

  /* 패널을 창 안으로 옮겨 둔다 — 이 시점부터 3D 화면에는 안 보인다 */
  try{ D2.mount(); }catch(e){ console.warn('PC 바탕화면 준비 실패:',e.message); }

  const seated=()=>D2.isSeated();
  function pcOn(){ return !!(D2.isOpen && D2.isOpen()); }

  /* ── 3D 조작 잠그기 ──────────────────────────────────────────────────
     PC 를 켜거나 대화 중일 때 W 를 치면 3D 가 걸어간다. 잠근 사람이 둘일 수 있으니
     세어서 마지막 하나가 풀 때만 되돌린다. */
  let locks=0;
  function control(on){ const O=office(); if(!O||typeof O.setControl!=='function') return;
    locks=Math.max(0,locks+(on?-1:1)); try{ O.setControl(locks===0); }catch(e){} }

  /* ── 화면 켜고 끄기 ───────────────────────────────────────────────── */
  function openPc(force){ const was=pcOn(); const ok=D2.open(force); if(ok){ if(!was) control(false); hideHint();   /* 45차 배포 검사: 켜진 채로 카드를 열 때마다 잠금이 쌓여 PC 를 꺼도 3D 조작(E·T)이 안 돌아와 퇴근 T 를 못 했다 — 꺼짐→켜짐일 때만 잠근다 */ const d=$('pcDot'); if(d) d.hidden=true; } syncBtn(); return ok; }
  function closePc(){ if(pcOn()) control(true); D2.close(); syncBtn(); showHint(); }

  /* ── 상단 단추 · 안내 띠 ───────────────────────────────────────────── */
  function syncBtn(){ const b=$('pcBtn'); if(b){ b.classList.toggle('on',pcOn());
      const can=seated()||pcOn(); b.classList.toggle('lock',!can);
      b.title=can?'내 자리 컴퓨터':'내 자리에 앉아야 컴퓨터를 쓸 수 있어요'; }
    const s=$('seatBtn'); if(s) s.hidden=seated()||S.phase!=='work'; }
  function showHint(){ const el=$('pcHint'); if(!el) return;
    if(pcOn()||(S.phase!=='work'&&S.phase!=='triage')){ el.classList.remove('on'); return; }
    const tx=$('pcHintTx'), go=$('pcHintGo');
    if(seated()){ if(tx) tx.textContent='내 자리 모니터를 누르면 컴퓨터가 켜져요.'; if(go) go.textContent='PC 켜기'; }
    else { if(tx) tx.textContent='컴퓨터는 내 자리에서만 씁니다.'; if(go) go.textContent='내 자리로'; }
    el.classList.add('on'); }
  function hideHint(){ const el=$('pcHint'); if(el) el.classList.remove('on'); }

  const pb=$('pcBtn'); if(pb) pb.onclick=()=>{ if(pcOn()){ closePc(); return; }
    if(!seated()){ toast('내 자리에 앉아야 컴퓨터를 쓸 수 있어요.','',3600,'cust'); goSeat(); return; }
    const had=window.Msg?Msg.unread():0; openPc(); if(had){ D2.openApp(D2.MSG); Msg.open(); } };
  const po=$('pcOff'); if(po) po.onclick=()=>closePc();
  const ph=$('pcHintGo'); if(ph) ph.onclick=()=>{ if(seated()) openPc(); else goSeat(); };

  /* ── 내 자리로 걸어가 앉기 ──────────────────────────────────────────
     3D 에 이 길이 아직 없으면(요청은 docs/office-api-requests.md §8) 어디로 가야
     하는지 말해 주고 카메라만 내 자리로 돌린다. */
  function goSeat(){ const O=office();
    if(!O){ D2.setSeated(true); openPc(true); return; }
    for(const name of ['goSeat','goMySeat','sitMe']){
      if(typeof O[name]==='function'){ try{ Promise.resolve(O[name]()).then(()=>{ D2.setSeated(true); },()=>{}); return; }catch(e){} } }
    if(typeof O.goTo==='function'){ try{ Promise.resolve(O.goTo('me')).then(()=>{ D2.setSeated(true); },()=>{}); return; }catch(e){} }
    try{ O.view('default'); }catch(e){}
    toast('내 자리로 걸어가서 의자 앞에서 E 를 누르세요.','',4200,'cust');   /* 🖥·🪑 그림 문자는 뺐다(2026-09-29 — 뜻 맞는 승인 그림 없음) */ }
  const sb=$('seatBtn'); if(sb) sb.onclick=goSeat;

  /* ── 앉았는가 ────────────────────────────────────────────────────────
     ① 3D 의 onSit 이 참을 알려 준다(deskapp.js 가 등록).
     ② 걸어가는 순간(travel·대화·이동 키)에는 거짓으로 둔다.
     ③ 3D 가 나중에 isSeated()·seated 를 내주면 그것이 이긴다(방어적 폴링). */
  window.onSeatChange=function(){ syncBtn(); showHint(); };
  function askOffice(){ const O=office(); if(!O) return null;
    try{ if(typeof O.isSeated==='function') return !!O.isSeated(); }catch(e){}
    if(O.seated!=null) return !!O.seated;
    return null; }
  setInterval(()=>{ const v=askOffice(); if(v!=null) D2.setSeated(v); },700);
  /* 3D 창에서 이동 키를 누르면 일어선 것이다(같은 출처라 그 창의 키를 들을 수 있다) */
  const MOVE=/^(KeyW|KeyA|KeyS|KeyD|Arrow(Up|Down|Left|Right))$/;
  let keyBound=false;
  setInterval(()=>{ if(keyBound||NO_STAGE) return; let w=null;
    try{ w=$('stage').contentWindow; }catch(e){}
    if(!w||!w.document) return; keyBound=true;
    try{ w.addEventListener('keydown',(ev)=>{ if(MOVE.test(ev.code)&&D2.isSeated()) D2.setSeated(false); },true); }catch(e){}
  },1000);
  /* 이동 연출이 시작되면 자리를 뜬 것이고, 끝나면 3D 가 자리로 돌려놓는다 */
  const _travel=window.travel;
  window.travel=async function(){ D2.setSeated(false);
    try{ return await _travel.apply(this,arguments); }
    finally{ const v=askOffice(); D2.setSeated(v==null?true:v); } };

  /* ── 카드 열기 — 종류마다 다른 창으로 ─────────────────────────────── */
  const _openCard=window.openCard;
  /* 메신저·전화 카드는 원래 openCard 를 거치지 않는다 — 사수 메모만은 그 카드의 것으로 바꿔 둔다(57차 E2-8:
     예전에는 직전 메일 카드의 메모가 남아 엉뚱한 안내가 됐다 · B-ga-logi E2) */
  const hintFor=(id)=>{ try{ if(typeof renderHint==='function') renderHint(id); }catch(e){} };
  window.openCard=function(id){ const c=CARD(id), st=S.cards[id];
    if(c&&st&&st.arrived){
      /* 메신저 카드는 그 카드가 쌓인 대화를 열고 **그 건을 고른다**(57차 대기열 — 같은 사람의 카드가 여럿이어도 이 건에 답한다).
         컴퓨터가 안 켜져도(3D 에서 T 로 물어보고 선 채 — talk.js 가 openCard 로 올림) 고른 건은 먼저 바꿔 둔다 — 나중에 켜면 그 건이 대화 아래에 있다 */
      if(c.type==='msg'){ hintFor(id); const mw=(window.Msg&&Msg.whoOf)?Msg.whoOf(id):null; if(mw&&Msg.pick) Msg.pick(mw,id);
        if(openPc()){ D2.openApp(D2.MSG); if(window.Msg) Msg.open(mw||msgWho(c),id); } return; }
      /* 전화는 창이 아니라 「그 자리에서 받는 화면」이다 — 벨을 다시 울린다.
         여기서 곧바로 받게 하면 자동 플레이가 doPhone 을 따로 부를 때 대화창이 남는다. */
      if(c.type==='phone'){ hintFor(id); if(typeof phoneRing==='function') phoneRing(id); return; }
      if(openPc()) D2.openApp(D2.MAIL);
    }
    return _openCard.apply(this,arguments); };

  /* 사규집·조직도·진행은 「업무 노트」 창 안의 탭이다 — 창이 닫혀 있으면 열어 준다. */
  const NOTEWIN='app-'+D2.NOTE;
  const _showTab=window.showTab;
  window.showTab=function(name){ if(['rule','org','prog'].includes(name)&&!(window.OC&&OC.ui.winExists&&OC.ui.winExists(NOTEWIN))){ if(openPc()) D2.openApp(D2.NOTE); } return _showTab.apply(this,arguments); };

  /* ── 독 배지 — 창마다 따로 센다 ───────────────────────────────────── */
  const _renderInbox=window.renderInbox;
  window.renderInbox=function(){ const r=_renderInbox.apply(this,arguments);
    try{ const left=S.order.filter(i=>{ const c=CARD(i); const st=S.cards[i];
      return c&&st&&c.type!=='msg'&&c.type!=='phone'&&st.status!=='done'&&st.status!=='skipped'; }).length;
      D2.setBadge(D2.MAIL,left); }catch(e){}
    try{ if(window.Tel) D2.setBadge(D2.TEL,Tel.missed()); }catch(e){}
    return r; };

  /* 독 시계 */
  const _renderClock=window.renderClock;
  window.renderClock=function(){ const r=_renderClock.apply(this,arguments); const t=$('tbClock'); if(t) t.textContent=fmtClock(S.t); return r; };

  /* 업무가 시작되면 안내 띠를 띄운다 */
  const _endBriefing=window.endBriefing;
  /* 45차: 3D 가 있으면 브리핑은 컷신이 아니라 「팀장에게 가서 T」다 — 그때는 조작을 잠그지 않는다(S.briefT). 잠금은 대화창이 알아서 한다 */
  window.endBriefing=function(){ const legacy=!S.briefT; const r=_endBriefing.apply(this,arguments); if(legacy) talkEnd(); syncBtn(); showHint(); return r; };
  const _restoreDay=window.restoreDay;
  if(_restoreDay) window.restoreDay=function(){ const r=_restoreDay.apply(this,arguments); syncBtn(); showHint(); return r; };
  /* 하루가 끝나면 컴퓨터를 끄고 사무실로 — 디브리프는 사무실 위에서 본다 */
  const _finish=window.finish;
  window.finish=function(){ backAfterTalk=false; const r=_finish.apply(this,arguments); if(pcOn()) control(true); D2.close(); syncBtn(); hideHint(); return r; };

  /* ── ESC 두 단계 ──────────────────────────────────────────────────────
     창이 떠 있으면 먼저 그 창을 닫고, 창이 없을 때 ESC 가 컴퓨터를 끈다.
     PC 를 닫아도 **앉은 자세는 그대로**다 — 다시 열 때는 모니터 클릭이나 「PC」 단추.
     글을 쓰는 중(입력 칸에 포커스)에는 가로채지 않는다. */
  function topWinEl(){
    const layer=document.getElementById('winLayer'); if(!layer) return null;
    let best=null,bz=-1;
    for(const w of layer.querySelectorAll('.win')){
      /* 최소화된 창은 windows.js 가 style.display='none' 으로 접는다(클래스가 아니다) */
      const st=getComputedStyle(w); if(st.display==='none'||st.visibility==='hidden') continue;
      const z=+st.zIndex||0; if(z>=bz){ bz=z; best=w; } }
    return best; }
  function typing(){ const a=document.activeElement; if(!a) return false;
    const t=(a.tagName||'').toUpperCase();
    return t==='TEXTAREA'||t==='INPUT'||t==='SELECT'||a.isContentEditable; }
  /* 🔴 **가로채기 단계(capture)로 듣는다.** windows.js 도 document 에서 Escape 를 받아
     맨 위 창을 닫는데, 그것이 먼저 돌면 우리 차례에는 창이 이미 없어 PC 까지 같이
     꺼진다 — ESC 한 번에 두 단계가 함께 일어났다(실제로 그랬다). 가로채기 단계에서
     먼저 보고, **창이 있으면 아무것도 하지 않는다**(창 닫기는 windows.js 의 일이다). */
  document.addEventListener('keydown',(ev)=>{
    if(ev.key!=='Escape'||ev.defaultPrevented) return;
    if(window.Talk&&Talk.isOpen()){ ev.preventDefault(); ev.stopImmediatePropagation(); Talk.close(); return; }
    if(!pcOn()) return;
    if(typing()) return;
    if(document.querySelector('.ctx-menu')) return;     /* 우클릭 메뉴가 먼저 닫힌다 */
    if(topWinEl()) return;                              /* 1단계 — 창 닫기는 windows.js 가 한다 */
    ev.preventDefault(); ev.stopImmediatePropagation(); closePc(); },true);   /* 2단계 — PC 끄기 */

  /* ── 사람의 말은 사무실에서 ───────────────────────────────────────────
     ① 브리핑·대화 모드처럼 마주 보고 하는 대사는 컴퓨터를 잠깐 접고 3D 에서 한다.
     ② 지나가는 한 줄은 말풍선 대신 컴퓨터 안의 알림 카드로 온다. */
  let backAfterTalk=false;
  function talkStart(){ control(false); if(pcOn()){ backAfterTalk=true; control(true); D2.close(); syncBtn(); } }
  function talkEnd(){ control(true); if(!backAfterTalk) return; backAfterTalk=false;
    if((S.phase==='work'||S.phase==='triage')&&seated()) openPc(); else { syncBtn(); showHint(); } }
  window.__pcTalk=function(on){ on?talkStart():talkEnd(); };

  const _startBriefing=window.startBriefing;
  if(_startBriefing) window.startBriefing=function(){ const r=_startBriefing.apply(this,arguments); if(!S.briefT) talkStart(); return r; };

  function pcNoti(who,text,ms){
    const box=$('pcNotis'); if(!box) return false;
    while(box.children.length>=3) box.firstChild.remove();
    const el=h('div','pcNoti');
    /* 머리 그림 = 승인 그림 2번(메신저 · 2026-09-29) — 옛 💬 자리 */
    const hd=h('div','hd'); const A=window.OC&&OC.ui&&OC.ui.appicon; if(A&&A.inline) hd.insertAdjacentHTML('beforeend',A.inline('messenger')); hd.appendChild(document.createTextNode('알림 · ')); hd.appendChild(h('b',null,who));
    el.appendChild(hd); el.appendChild(h('div','tx',text));
    box.appendChild(el); setTimeout(()=>el.remove(),ms);
    return true; }
  const _toast=window.toast;
  window.toast=function(text,who,ms,cls){
    if(pcOn()&&cls==='cust'&&who&&pcNoti(who,String(text==null?'':text),ms||4600)) return;
    return _toast.apply(this,arguments); };

  /* ── 사내 메신저 ──────────────────────────────────────────────────────
     3D 화면에는 내용을 띄우지 않는다. 상단 「PC」 단추에 빨간 점과 개수만 붙이고,
     자리에 앉아 컴퓨터를 켜야 읽을 수 있다. */
  if(window.Msg){
    /* 앱을 열면 카톡처럼 **대화 목록**부터 보인다(줄을 누르면 그 대화가 열린다).
       🔴 여기서 Msg.open() 을 부르면 안 된다 — Msg 가 「창을 앞으로」를 되부르며
          openApp ↔ open 이 서로를 불러 스택이 넘친다(실제로 그랬다). */
    const _openApp=D2.openApp;
    D2.openApp=function(id){ const r=_openApp.apply(this,arguments); if(id===D2.MSG){ try{ Msg.list(); }catch(e){} } return r; };
    /* 대화 목록에서 줄을 눌러 연 대화도 — 그 대화에 걸린 카드의 사수 메모로(57차 E2-8) */
    Msg.onOpen(function(who){ try{ const t=(Msg.threads()||[]).find(x=>x.who===who); if(t&&t.pending&&CARD(t.pending)) hintFor(t.pending); }catch(e){} });
    /* 한 대화 안에서 다른 건을 고르거나 앞 건을 끝내 다음 건으로 넘어가도 — 그 건의 사수 메모로(57차 대기열) */
    if(Msg.onPick) Msg.onPick(function(who,id){ try{ if(id&&CARD(id)) hintFor(id); }catch(e){} });
    /* 이어 하기(W-7) — 대화를 이 기기에 남겨 두고(진행 저장 키 옆 ws7.msglog.*, 서버 저장본은 늘리지 않는다), 카드로 다시 쌓는 동안은 덮어쓰지 않다가
       다 쌓은 뒤 되살린다. 기록의 카드가 다시 쌓은 카드와 다르면(다른 기기·지난 판) 기록은 쓰지 않는다 — msgapp.js restore */
    if(Msg.store) Msg.store(()=>{ try{ return (typeof LS_KEY==='function'&&S&&S.team)?LS_KEY().replace(/^ws7\.progress\./,'ws7.msglog.'):null; }catch(e){ return null; } },()=>S.ep);
    const _reh=window.rehydrateBoxes;
    if(_reh&&Msg.hold&&Msg.restore) window.rehydrateBoxes=function(){ Msg.hold(true); let r; try{ r=_reh.apply(this,arguments); } finally{ Msg.hold(false); }
      try{ Msg.restore(); }catch(e){ console.warn('메신저 대화 되살리기 실패:',e&&e.message); } return r; };
    Msg.onChange(n=>{
      try{ D2.setBadge(D2.MSG,n); }catch(e){}
      const d=$('pcDot'); if(d){ d.textContent=n>9?'9+':String(n); d.hidden=!n||pcOn(); }
    });
    /* 하루가 바뀌면 지난 대화를 지운다 */
    const _startDay=window.startDay;
    if(_startDay) window.startDay=function(){ try{ Msg.reset(); }catch(e){} return _startDay.apply(this,arguments); };
  }
  if(window.Tel) Tel.onChange(n=>{ try{ D2.setBadge(D2.TEL,n); }catch(e){} });

  /* 3D 쪽 모니터 클릭·착석 신호를 받는다 */
  try{ D2.bindScreen(()=>office()); }catch(e){}
  syncBtn();
})();
