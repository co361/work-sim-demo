/* ======================================================================
   WORK SIM — 첫 진입 조작법 카드 (44차)
   대표 "로딩이 길잖아. 로딩하는 동안 로딩중이라고 띄우지 말고 차라리 그때
   게임 플레이 방법 단축키를 하나씩 설명하는 페이지를 띄워. 그리고 나서도
   로딩이 필요하면 로딩중을 하고. 처음 시작할 때 로딩을 말하는 거야."

   그래서 이 파일이 맡는 것은 **첫 진입 로딩 한 번**뿐이다.
     · 방을 옮길 때(office.html 안의 복도 연출)와 캐릭터를 바꿀 때(day.js changeAvatar)의
       로딩은 손대지 않는다 — 그 둘은 그대로 「로딩 중」 한 줄이다.
     · 카드를 다 봤는데 3D 가 아직 안 왔으면 그때 「로딩 중」으로 돌아간다(대표 지시 2).
     · 3D 가 먼저 오면 마지막 카드에 「시작하기」가 뜬다(지시 3). 「건너뛰기」는 항상 있다.

   붙는 자리: day.js startDay() 의 stageUp() 앞뒤 — Intro.start() … await Intro.ready().
   카드 문구는 office.html 의 실제 키 처리에서 옮겼다(고칠 때 반드시 대조할 것):
     KEYMAP(WASD·방향키) · CTRL.fast=e.shiftKey · KeyE=ctrlAct(앉기/일어서기·문·내 자리 컴퓨터) ·
     KeyT=ctrlTalk(사람에게 하는 모든 것) · KeyQ/KeyR=rigTurn(90°) · KeyZ=rigZoom · SCREEN.cb(모니터 클릭=PC)

   45차(대표 「렉 다 풀릴 때까지 로딩창 띄워. 게임 캐릭터가 보일 때는 렉이 걸리지 않도록」):
     「시작하기」는 3D 의 `warmupInfo().ready` 가 참이 된 뒤에만 뜬다(day.js warmWait 가 기다린 뒤 Intro.ready()).
     아래 진행 줄은 warmupInfo 의 stage 문구와 진행 막대를 그대로 보여 준다. 함수가 없으면 ready()/full() 로 짐작.
     E/T 카드 문구는 대표 확정 「E = 앉기·문·PC, T = 사람에게 하는 모든 것」에 맞췄다.
   ====================================================================== */
window.Intro=(function(){
'use strict';

/* 한 장이 머무는 시간(ms) — 여섯 장이면 31초, 첫 진입 로딩과 얼추 맞다.
   ?tutms= 로 바꿀 수 있다(검사에서 자동 넘김을 멈춰 두거나 빨리 돌리려고 쓴다) */
const DWELL=Math.max(400,+(Q.get('tutms')||5200));
const TICK=250;

const CARDS=[
  { keys:'<kbd class="k">W</kbd><kbd class="k">A</kbd><kbd class="k">S</kbd><kbd class="k">D</kbd>'
        +'<span class="sep">또는</span><kbd class="k">↑</kbd><kbd class="k">←</kbd><kbd class="k">↓</kbd><kbd class="k">→</kbd>'
        +'<span class="sep">+</span><kbd class="k wide">Shift</kbd>',
    h:'사무실을 걸어 다녀요',
    p:'<b>WASD</b> 나 <b>방향키</b>로 걷습니다. <b>Shift</b>를 같이 누르고 있으면 빠르게 걸어요.<br>'
     +'가고 싶은 <b>바닥을 클릭</b>하면 그 자리까지 알아서 걸어갑니다.' },

  { keys:'<kbd class="k acc">E</kbd>',
    h:'E — 앉기 · 문 · 컴퓨터',
    p:'<b>E</b>는 <b>자리와 물건</b>에 씁니다. 내 자리 앞에서 앉고 일어서기, 문 앞에서 드나들기, 내 자리 컴퓨터 켜기.<br>'
     +'사람에게는 E 를 쓰지 않아요. 지금 누를 수 있는 것은 <b>화면에 떠 있어요</b> — 「E · 내 자리에 앉기」처럼.' },

  { keys:'<kbd class="k acc">T</kbd>',
    h:'T — 사람에게 하는 모든 것',
    p:'말 걸기 · 질문 · 보고 · 서류 제출 · 업무 지시 듣기는 전부 <b>T</b>예요. 가까이 가서 누르면 <b>얼굴을 보며 대화</b>합니다.<br>'
     +'머리 위에 <b>표시</b>가 뜬 사람은 <b>할 말이나 볼일이 있는 사람</b>이에요. 말풍선은 없으니 직접 찾아가 들어 보세요.' },

  { keys:'<kbd class="k acc">Q</kbd><kbd class="k acc">R</kbd><kbd class="k acc">Z</kbd>',
    h:'Q · R · Z — 카메라',
    p:'<b>Q</b>와 <b>R</b>로 카메라를 <b>90°씩</b> 돌리고, <b>Z</b>로 가까이 당겨 봅니다.<br>'
     +'책상이나 기둥에 가려 안 보일 때는 카메라를 한 번 돌려 보세요.' },

  { keys:'<kbd class="k wide acc">마우스 클릭</kbd>',
    h:'컴퓨터는 내 자리에서',
    p:'내 자리에서 책상 위 <b>모니터를 클릭</b>하면 컴퓨터가 켜집니다(자리 앞에 서서 <b>E</b>를 눌러도 돼요).<br>'
     +'<b>메일과 문서는 전부 컴퓨터 안</b>에 있어요. 오늘 할 일도 메일로 들어옵니다.' },

  { keys:'<kbd class="k wide acc">09:00</kbd><span class="sep">→</span><kbd class="k wide">18:00</kbd>',
    h:'하루는 09:00에 시작해 18:00에 끝나요',
    p:'메일에는 <b>마감</b>이 있습니다. 급한 것부터 처리하고, 모르는 것은 옆자리에 물어보세요.<br>'
     +'퇴근하면 오늘 한 일을 <b>정리해서 보여 드립니다</b>.' }
];

/* 검사·촬영 도구는 누를 사람이 없다 — 자동화(webdriver)와 ?stage=0 에서는 통째로 건너뛴다.
   ?tut=1 이면 자동화에서도 켜서 눈으로 확인할 수 있고, ?tut=0 이면 언제나 끈다. */
const FORCE=Q.get('tut')==='1';
const OFF=FORCE?false:(Q.get('tut')==='0'||(typeof NO_STAGE!=='undefined'&&NO_STAGE)||!!navigator.webdriver);

let started=false, phase='off', i=0, t0=0, timer=null, loaded=false, waitP=null, done=null;

function el(id){ return document.getElementById(id); }

/* 카드 한 장 그리기 + 아래 단추·점 상태 맞추기 */
function paint(){
  const c=CARDS[i], box=el('tutCard'); if(!box) return;
  box.innerHTML=`<div class="tutKeys">${c.keys}</div><h3>${c.h}</h3><p>${c.p}</p>`;
  box.classList.remove('tutIn'); void box.offsetWidth; box.classList.add('tutIn');
  el('tutNo').textContent=String(i+1); el('tutAll').textContent=String(CARDS.length);
  const last=i===CARDS.length-1, hold=last&&loaded;
  const dots=el('tutDots'); dots.innerHTML=''; dots.classList.toggle('noauto',hold);
  dots.style.setProperty('--tutms',DWELL+'ms');
  for(let n=0;n<CARDS.length;n++){ const d=document.createElement('i');
    d.className=n===i?'on':(n<i?'seen':''); dots.appendChild(d); }
  el('tutNext').textContent=hold?'시작하기':(last?'다 봤어요':'다음');
}

/* ---------- 워밍업 진행(45차) ----------
   3D 의 warmupInfo() → {ready, done, total, stage}. 단계마다 done/total 의 뜻이 달라(사람 수 → 텍스처 → 안정 프레임)
   막대가 단계마다 0 으로 떨어지면 뒤로 가는 것처럼 보인다. 알려진 단계는 전체 막대의 구간으로 옮기고, 절대 줄지 않게 붙잡는다. */
const WARM_SPAN={'캐릭터 준비 중':[0,.45],'그래픽 준비 중':[.45,.8],'마무리 중':[.8,1],'준비 완료':[1,1]};
let warmTop=0;
function officeOf(){ try{ const f=el('stage'); return f&&f.contentWindow&&f.contentWindow.__office||null; }catch(e){ return null; } }
function warmInfo(O){ O=O||officeOf(); try{ return (O&&typeof O.warmupInfo==='function')?O.warmupInfo():null; }catch(e){ return null; } }
/* 0~1 전체 진행. 새 무대(캐릭터 교체)로 다시 셀 때는 reset */
function warmPct(w,reset){ if(reset){ warmTop=0; } if(!w) return warmTop;
  if(w.ready) return (warmTop=1);
  const part=w.total>0?Math.max(0,Math.min(1,w.done/w.total)):0;
  const sp=WARM_SPAN[w.stage]; const v=sp?sp[0]+(sp[1]-sp[0])*part:Math.max(warmTop,part*.95);
  warmTop=Math.max(warmTop,Math.min(.99,v)); return warmTop; }
function warmText(w){ if(!w) return ''; const n=w.total>1&&w.stage!=='마무리 중'?` ${Math.min(w.done,w.total)}/${w.total}`:'';
  return `${w.stage||'준비 중'}…${n}`; }
function setTutBar(p){ const b=el('tutBarFill'); if(b) b.style.width=Math.round(p*100)+'%'; }

/* 아래 진행 문구 — 3D 쪽 신호(warmupInfo, 없으면 ready / full)를 그대로 옮긴다 */
function stat(){
  const box=el('tutLoad'), tx=el('tutLoadTx'); if(!box) return;
  const O=officeOf();
  if(loaded){ box.classList.add('ok'); setTutBar(1);
    tx.textContent='준비 끝 — 이제 끊기지 않고 들어갈 수 있어요';
    return; }
  box.classList.remove('ok');
  if(!O){ tx.textContent='사무실을 여는 중…'; return; }
  const w=warmInfo(O);
  if(w){ tx.textContent=warmText(w); setTutBar(warmPct(w)); return; }
  let rdy=false, full=false; try{ rdy=!!(O.ready&&O.ready()); full=!!(O.full&&O.full()); }catch(e){}
  tx.textContent=!rdy?'내 캐릭터를 준비하는 중…':!full?'동료들이 자리에 앉는 중…':'거의 다 됐어요…';
}

function go(n){ if(phase!=='cards') return; i=Math.max(0,Math.min(CARDS.length-1,n)); t0=Date.now(); paint(); }

/* 카드를 다 봤는데 아직 덜 받았을 때 — 여기서부터는 원래의 「로딩 중」 한 줄이다 */
function toLoad(){
  if(phase!=='cards') return;
  phase='load'; stop(); el('tut').hidden=true; el('loading').classList.remove('tut');
  if(loaded) fin();
}
function fin(){ if(phase==='done') return; phase='done'; stop(); removeEventListener('keydown',onKey);
  el('tut').hidden=true; el('loading').classList.remove('tut'); if(done) done(); }

function next(){ if(phase!=='cards') return;
  if(i<CARDS.length-1){ go(i+1); return; }
  if(loaded) fin(); else toLoad(); }

function skip(){ if(phase==='cards'){ if(loaded) fin(); else toLoad(); } else if(phase==='load'&&loaded) fin(); }

function stop(){ if(timer){ clearInterval(timer); timer=null; } }

function beat(){
  if(phase!=='cards') return;
  stat();
  const last=i===CARDS.length-1;
  if(last&&loaded) return;                       /* 「시작하기」를 누를 때까지 기다린다 */
  if(Date.now()-t0>=DWELL){ if(last) toLoad(); else go(i+1); }
}

/* 화살표·Enter·Space 로도 넘긴다. #tut 안의 단추를 누른 경우는 그 단추가 처리한다 */
function onKey(e){
  if(phase!=='cards'||e.repeat) return;
  const t=e.target; if(t&&t.closest&&t.closest('#tut button')) return;
  if(e.code==='ArrowRight'||e.code==='Enter'||e.code==='NumpadEnter'||e.code==='Space'){ e.preventDefault(); next(); return; }
  if(e.code==='ArrowLeft'&&i>0){ e.preventDefault(); go(i-1); } }

/* ---------- 바깥에서 쓰는 것 ---------- */

/* 첫 진입 로딩이 시작될 때 한 번. 두 번째부터는 아무 일도 하지 않는다 */
function start(){
  if(OFF||started) return;
  const box=el('tut'); if(!box) return;
  started=true; phase='cards'; loaded=false;
  waitP=new Promise(r=>{ done=r; });
  el('loading').classList.add('tut'); el('loading').classList.remove('off'); box.hidden=false;
  el('tutNext').onclick=next; el('tutSkip').onclick=skip;
  addEventListener('keydown',onKey);
  go(0); stat();
  stop(); timer=setInterval(beat,TICK);
}

/* 3D 가 준비되면 부른다. 들어가도 좋을 때 풀리는 약속을 돌려준다 */
function ready(){
  loaded=true;
  if(!started||phase==='done') return Promise.resolve();
  if(phase==='load'){ fin(); return Promise.resolve(); }
  paint(); stat();                                /* 마지막 카드면 여기서 「시작하기」로 바뀐다 */
  return waitP||Promise.resolve();
}

function state(){ return {on:started&&phase!=='done',phase,card:i+1,total:CARDS.length,loaded,off:OFF}; }

/* 스모크·촬영용 */
window.__intro={ state, next, skip, go, cards:()=>CARDS.length };

return { start, ready, state, skip, off:OFF, warmInfo, warmPct, warmText };
})();
