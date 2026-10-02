/* ======================================================================
   하루 — 입장(개인 코드·홈) · 화 데이터 적재(전날 결과 반영) · 무대 · 브리핑 · 09:30 · 디브리프 · 저장 · 스모크 API
   ====================================================================== */

/* ---------- 데이터 적재 ---------- */
/* 화 데이터 — 로컬(개발·검사)은 data/story/<팀>-ep<n>.js(정답 포함 정본)를 그대로 싣고,
   배포본에는 그 파일이 없어(tools/deploy_build.py) 서버(GAS ws7story)에서 **정답이 빠진 공개본**을 받는다.
   서버는 유효한 개인 토큰 · 그 토큰의 팀 · 열린 일차까지만 준다. 토큰 없이는(데모) 배포본에서 시작할 수 없다 — 의도한 것이다(대표 「토큰 없이 못 하도록」). */
function loadStory(team,ep){ return new Promise((res,rej)=>{ const key=`${team}-ep${ep}`; if(window.STORY&&window.STORY[key]) return res(window.STORY[key]); if(window.WS7_GATED){ loadStoryFromServer(team,ep).then(res,rej); return; } const s=document.createElement('script'); s.src=`data/story/${key}.js?v=${Date.now()}`; s.onload=()=>{ const d=(window.STORY||{})[key]; d?res(d):rej(new Error('스토리 데이터가 비어 있어요')); }; s.onerror=()=>{ loadStoryFromServer(team,ep).then(res,rej); }; document.head.appendChild(s); }); }
async function loadStoryFromServer(team,ep){ const key=`${team}-ep${ep}`;
  if(!S.code) throw new Error(`${ep}일차 데이터가 없어요 (${key}.js).`+(backendOn()?' 이 배포본은 개인 토큰으로 들어와야 시작할 수 있어요.':''));
  if(!backendOn()||typeof window.Backend.story!=='function') throw new Error('서버가 설정되지 않아 화 데이터를 받을 수 없어요.');
  const r=await withTimeout(window.Backend.story({code:S.code,team,ep}),25000);
  if(!r||!r.ok||!r.story) throw new Error((r&&r.reason)||'서버에서 화 데이터를 받지 못했어요.');
  window.STORY=window.STORY||{}; window.STORY[key]=r.story;
  if(r.rulebook){ window.OC=window.OC||{}; OC.data=OC.data||{}; if(!OC.data.RULEBOOK) OC.data.RULEBOOK=r.rulebook; }
  return r.story; }
/* ---------- 이름 자리표시자(45차) ----------
   데이터는 학생 이름 자리에 「○○씨」(NPC 대사)·「○○○님」(메일 인사)·「○○○입니다」(모범 답안 서명)를 쓴다.
   예전에는 대사 몇 군데에서만 `S.name||'○○'` 로 바꿔 이름이 없으면(데모) 「○○씨」가 그대로 보였다.
   하루 데이터를 불러올 때 **한 번에** 바꾼다 — 대화창·전화·방문·연출·메일·메신저·디브리프가 전부 이 사본을 쓴다.
   이름이 없을 때: 부르는 말은 「신입 씨」, 메일 인사 「○○○님」은 「담당자님」, 모범 답안 서명 「○○○입니다」는 그대로(서식 칸이다).
   가린 번호(010-○○○○-2231)·가린 이름(김○정)·「○○은행」·「○○mm」 같은 서식 자리는 앞뒤 글자로 걸러 건드리지 않는다. */
const NAME_B='(^|[^가-힣0-9A-Za-z\\-「○*])';
/* 「○○씨」(낫표 안에서 부르는 말)는 늘 학생이다 — 씨 규칙만 「 뒤도 바꾼다(57차 E2후속 F6: 7화 아침 카드에서 보고된 미치환은 이 꼴뿐이었다 · 1~6화도 같음) */
const NAME_B_SSI='(^|[^가-힣0-9A-Za-z\\-○*])';
const NAME_RX=[
  [new RegExp(NAME_B+'○{2,3}(?=입니)','g'),(nm)=>nm||'○○○'],
  [new RegExp(NAME_B_SSI+'○{2,3}\\s?씨','g'),(nm)=>nm?nm+' 씨':'신입 씨'],
  [new RegExp(NAME_B+'○{3}\\s?님','g'),(nm)=>nm?nm+' 님':'담당자님'],
  [new RegExp(NAME_B+'○{3}(?=[,，\\s])','g'),(nm)=>nm||'신입 씨']];
function fillName(t){ if(typeof t!=='string'||t.indexOf('○')<0) return t; const nm=String((S&&S.name)||'').trim();
  let out=t; for(const [rx,f] of NAME_RX){ rx.lastIndex=0; out=out.replace(rx,(m,pre)=>pre+f(nm)); } return out; }
function fillNames(o,depth){ depth=depth||0; if(!o||typeof o!=='object'||depth>14) return o;
  for(const k of Object.keys(o)){ const v=o[k]; if(typeof v==='string'){ if(v.indexOf('○')>=0) o[k]=fillName(v); } else if(v&&typeof v==='object') fillNames(v,depth+1); }
  return o; }
/* 분기 카드 조건: 전날 저장된 카드 결과와 대조. 전날 결과가 없으면 미등장.
   규칙은 grade.js branchTriggerMet 한 벌이다(7일차 아침 카드·서버 7일차 채점과 같은 함수 — 57차 E2, D-fixes §5-4) */
function triggerMet(tr,prev){ return branchTriggerMet(tr,prev); }
function prepareDay(){ const prev=P.done[String(S.ep-1)]||null;
  /* 어제까지 만난 팀의 규정 편은 계속 열려 있다(56차 사규집 잠금) */
  S.rbOpen=[S.team].concat(((P&&P.rbOpen)||[]).filter(k=>k&&k!==S.team));
  D.cards=D.cards.filter(c=>!c.trigger||triggerMet(c.trigger,prev));
  for(const c of D.cards){ if(c.chain&&c.step>1&&!c.requires){ const first=D.cards.filter(x=>x.chain===c.chain&&x.step<c.step&&x.deliver).sort((a,b)=>a.step-b.step)[0]; if(first) c.requires={card:first.id,delivered:true}; } if(c.alsoReply===true&&!c.deliver&&!c.alsoReplyTo&&c.compose&&c.compose.model){ const m=c.compose.model.match(/^([가-힣]{2,4}) 님/); if(m) c.alsoReplyTo=m[1]; } }
  D.cards.sort((a,b)=>(a.pre?0:1)-(b.pre?0:1)||a.arrive-b.arrive);
  for(const c of D.cards) S.cards[c.id]={arrived:false,status:'wait'};
  leadOpenBrief(); }
/* 아침 분기 카드(pre)의 leadOpen — 팀장이 브리핑 첫 대사 앞에서 어제 일을 짚는다. 받은 분기 카드의 것만(trigger 로 걸러진 뒤), 카드 순서대로 한 번씩.
   57차 E2후속 F10: 7화는 prepareDay 를 거치지 않아(EP7.start 로 바로) 7화 아침 카드의 leadOpen(cs_ep7_branch_refund·edu 2장)이 무시됐다 — 같은 함수를 7화 시작에서도 부른다.
   (예전 2~6화는 첫 카드 하나만 넣었다 — 두 장이 같이 오면 둘 다 짚는다) */
function leadOpenBrief(){ if(!D||!D.dialog||!Array.isArray(D.dialog.briefing)) return; const lead=((D.dests||[]).find(x=>x.seat==='lead')||{}).name||'팀장';
  const lines=[]; for(const c of D.cards) if(c.pre&&c.leadOpen){ const t=String(c.leadOpen).replace(/^\(.*?\)\s*/,'').trim(); if(t&&!lines.includes(t)) lines.push(t); }
  for(const t of lines.reverse()) D.dialog.briefing.unshift({who:lead,role:'팀장',text:t,view:'lead'}); }

/* ---------- 입장 ---------- */
async function boot(){ const code=(Q.get('code')||'').trim(); const team=(Q.get('team')||'').toLowerCase(); const ep=+(Q.get('ep')||0);
  try{ const saved=localStorage.getItem('ws7.code'); if(!code&&saved&&!team) S.code=saved; }catch(e){}
  if(code){ await enterWithCode(code,ep||null); return; }
  if(team&&ep){ S.team=team; S.ep=ep; S.demo=true; S.code=null; P=await loadProgress(); S.name=P.name||''; await startDay(ep); return; }
  showHome(); }
async function enterWithCode(code,ep){ code=code.toUpperCase().replace(/\s/g,''); S.code=code; let info=null;
  if(backendOn()&&typeof window.Backend.check==='function'){ try{ const r=await withTimeout(window.Backend.check(code),9000); if(r&&r.ok){ info=r; } else { homeMsg((r&&r.reason)||'등록되지 않은 코드예요. 다시 확인해 주세요.'); showHome(); return; } }catch(e){ homeMsg('서버에 연결하지 못했어요. 잠시 뒤 다시 시도하거나 데모로 시작하세요.'); showHome(); return; } }
  S.demo=!info; if(info){ S.team=(info.team||'cs').toLowerCase(); S.name=info.name||''; } else { S.team=(Q.get('team')||$('homeTeam').value||'cs').toLowerCase(); }
  try{ localStorage.setItem('ws7.code',code); }catch(e){}
  P=await loadProgress(); if(info&&info.day) P.day=info.day; if(!S.name) S.name=P.name||'';   /* F13: 서버가 센 날(done 의 최댓값+1)을 그대로 — 예전에는 올리기만 해 「오늘 다시」 뒤 다른 기기에서 어긋났다 */
  const day=ep||P.day||1; if(day>7){ showHome(); return; } await startDay(day); }
function homeMsg(t){ const e=$('homeMsg'); if(e) e.textContent=t||''; }
async function showHome(){ S.phase='home'; $('loading').classList.add('off'); $('home').classList.add('open'); const sel=$('homeTeam'); if(!sel.options.length) for(const k of TEAM_ORDER){ const o=document.createElement('option'); o.value=k; o.textContent=TEAM_NAMES[k]; sel.appendChild(o); }
  $('homeCode').value=S.code||''; $('homeBackend').textContent=hasBackend()?'서버 연결됨 — 코드로 진행이 저장되고, 메일은 AI 첨삭을 받아요':'서버 없음 — 이 기기에만 저장되고, 메일은 규칙 채점으로 봐 드려요';
  if(S.code){ S.team=(Q.get('team')||S.team); P=await loadProgress(); S.team=P.team||S.team; sel.value=S.team; } else { P=null; }
  renderHomeDays();paintHomeAvatar(); }
function renderHomeDays(){ const box=$('homeDays'); box.innerHTML=''; const day=P?P.day:1; const team=P?(P.team||S.team):($('homeTeam').value||'cs');
  for(let d=1; d<=7; d++){ const done=P&&P.done&&P.done[String(d)]; const cur=!done&&d===day; const b=document.createElement('button'); b.type='button'; b.className='dayc '+(done?'done':cur?'cur':'lock'); const ws=done&&typeof NcsEval!=='undefined'?NcsEval.dayScore(done):null;   /* 57차 E1(A Y10): 일차 칸 = 업무 점수(카드 평균 — 관리자·CSV 와 같은 NcsEval.dayScore). 예전에는 옛 NCS 축 평균이었다 */
    b.innerHTML=`<b>${d}일차</b><span>${escapeHtml(DAY_TITLES[d]||'')}</span><i>${done?'✓ '+(done.ending?('엔딩 '+done.ending):(ws!=null?ws+'점':'끝')):cur?(P&&P.cur&&P.cur.day===d?'이어 하기':'오늘'):'잠김'}</i>`;
    b.onclick=()=>{ if(!done&&!cur&&!Q.get('debug')){ toast(`${d-1}일차를 마치면 열려요.`); return; } goDay(team,d); }; box.appendChild(b); }
  /* 7일을 마친 학생 — 내 결과 PDF(js/play/result_pdf.js · 저장본만으로 만든다) */
  const pdf=$('homePdf'); if(pdf){ pdf.innerHTML=''; const fin=!!(P&&P.done&&P.done['7']); pdf.style.display=(fin&&window.ResultPdf)?'':'none'; if(fin&&window.ResultPdf){ pdf.appendChild(ResultPdf.button('pri')); pdf.appendChild(h('span','muted','7일 기록 — NCS 결과 · 강점과 보완할 점 · 날마다 한 일과 쓴 글')); } } }
function goDay(team,d){ const u=new URL(location.href); u.searchParams.set('team',team); u.searchParams.set('ep',String(d)); if(S.code) u.searchParams.set('code',S.code); else u.searchParams.delete('code'); u.searchParams.delete('fresh'); u.searchParams.delete('home'); location.href=u.toString(); }   /* fresh 는 그 화 한 번만(QA W-13 — 다음 날로 물려주면 그날 새로고침이 처음부터였다) */
$('homeGo').onclick=async()=>{ const code=$('homeCode').value.trim(); if(code){ $('home').classList.remove('open'); $('loading').classList.remove('off'); await enterWithCode(code,null); } else { const team=$('homeTeam').value||'cs'; S.demo=true; S.code=null; try{ localStorage.removeItem('ws7.code'); }catch(e){} S.team=team; P=await loadProgress(); goDay(team,P.day||1); } };
$('homeDemo').onclick=async()=>{ const team=$('homeTeam').value||'cs'; S.demo=true; S.code=null; try{ localStorage.removeItem('ws7.code'); }catch(e){} S.team=team; P=await loadProgress(); goDay(team,P.day||1); };
$('homeTeam').onchange=()=>{if(!S.code)renderHomeDays();paintHomeAvatar();};
/* 홈 화면에서도 언제든 바꾼다 — 여기서 고른 값은 하루를 열 때 그대로 쓰인다 */
function paintHomeAvatar(){const team=$('homeTeam').value||S.team;for(const [id,g,label] of [['homeAvF','f','여성'],['homeAvM','m','남성']]){const row=WorkSimRoster.player(team,g);if(row)$(id).textContent=row.display_name+' · '+label;} const g=avatarPref(); $('homeAvF').setAttribute('aria-pressed',String(g==='f')); $('homeAvM').setAttribute('aria-pressed',String(g==='m'));
  $('homeAvF').classList.toggle('pri',g==='f'); $('homeAvM').classList.toggle('pri',g==='m'); }
$('homeAvF').onclick=()=>{ setAvatarPref('f'); if(P) P.avatar='f'; paintHomeAvatar(); };
$('homeAvM').onclick=()=>{ setAvatarPref('m'); if(P) P.avatar='m'; paintHomeAvatar(); };
paintHomeAvatar();
$('homeReset').onclick=()=>{ if(!confirm('이 기기에 저장된 진행을 지울까요? (서버 저장은 그대로예요)')) return; try{ localStorage.removeItem(LS_KEY()); }catch(e){} P=null; showHome(); };

/* 캐릭터 고르기 — 고를 때까지 기다린다. 얼굴 미리보기는 실제로 배정될 번호로 그린다 */
function askAvatar(again){
  /* 헤드리스 검사·촬영은 ?avatar=f|m 로 고정한다 — 누를 사람이 없어 여기서 멈춘다 */
  const q=(Q.get('avatar')||'').toLowerCase(); if(!again&&(q==='f'||q==='m')) return Promise.resolve(q);
  return new Promise(res=>{
  const put=(id,ch)=>{ const box=$(id); box.innerHTML=''; const src=avatarPic(ch);
    if(src){ const im=document.createElement('img'); im.alt=''; im.onerror=()=>{ if(im.parentNode===box) box.textContent='🙂'; }; im.src=src; box.appendChild(im); }
    else box.textContent='🙂'; };
  put('avFPic',playerChar('f'));put('avMPic',playerChar('m'));for(const [id,g] of [['avF','f'],['avM','m']]){const row=WorkSimRoster.player(S.team,g);if(row)$(id).querySelector('b').textContent=row.display_name;}
  if(!again) $('loading').classList.add('off');
  $('avatar').classList.add('open');
  const keep=$('avKeep'); keep.hidden=!again;
  const close=g=>{ $('avatar').classList.remove('open'); if(!again) $('loading').classList.remove('off'); res(g); };
  $('avF').onclick=()=>close('f'); $('avM').onclick=()=>close('m'); keep.onclick=()=>close(null); }); }

/* ---------- 하루 시작 ---------- */
async function startDay(ep){ S.ep=ep; S.phase='loading'; $('home').classList.remove('open'); $('loading').classList.remove('off');
  try{ D=await loadStory(S.team,ep); }catch(e){ $('loadMsg').textContent=e.message; $('loadBack').style.display='inline-block'; return; }
  D=JSON.parse(JSON.stringify(D));            /* 전날 결과에 따라 카드가 빠지므로 사본 */
  /* Names are filled after final avatar selection below. */                               /* 「○○씨」 등 이름 자리 — 모든 출력 경로가 이 사본을 쓴다(45차) */
  /* 소개 페이지에서 바꾼 것이 있으면 그것을 따르고, 아직 고른 적이 없으면 한 번 묻는다 */
  { const pref=avatarPref();
    if(pref&&pref!==P.avatar){ P.avatar=pref; saveProgress(true); }
    if(!P.avatar){ P.avatar=await askAvatar(); setAvatarPref(P.avatar); saveProgress(true); } }
  D=adaptStoryToRoster(D,S.team,P.avatar);fillNames(D);
  document.title=`${D.teamName} ${D.ep}화 「${D.title}」`; $('title').innerHTML=''; $('title').appendChild(document.createTextNode(`${D.teamName} ${D.ep}일차`)); const sm=h('small',null,`「${D.title}」 · ${D.date||''}`); $('title').appendChild(sm);
  /* 44차: 첫 진입 로딩은 「로딩 중」 대신 조작법 카드로 채운다(js/play/intro.js).
     카드를 다 보거나 건너뛴 뒤에야 Intro.ready() 가 풀린다 — 방 이동·캐릭터 교체 로딩은 그대로다. */
  Intro.start();
  if(D.kind==='ep7'){
    /* 아침에 오는 「어제 그거」 분기 카드는 6일차에 실제로 그 선택을 한 학생에게만 온다.
       7화는 prepareDay() 를 거치지 않고 EP7.start() 로 바로 가느라 trigger 필터가 걸리지 않아,
       선택과 무관하게 분기 카드가 전부 떴다(56차). 여기서 한 번 걸러 준다. */
    D.cards=ep7PreCards(D.cards,P);   /* 6일차 기록으로 거른다 — 서버 7일차 채점과 같은 함수(grade.js · 57차 R1) */
    leadOpenBrief();                     /* 받은 아침 카드의 팀장 첫마디(leadOpen) — 2~6화 prepareDay 와 같게(F10) */
    await stageUp(); await Intro.ready(); $('loading').classList.add('off'); window.__playReady=true; return EP7.start(); }   /* 7일차 브리핑 부르기는 ep7.js start 가 한다(모이기는 briefGatherStart 를 같이 쓴다) */
  prepareDay(); renderUnlocks(); initRulebook(); initOrg();
  await stageUp(); await Intro.ready(); $('loading').classList.add('off'); renderClock(); renderCounts(); window.__playReady=true;
  const cur=P.cur; if(cur&&cur.day===ep&&(cur.phase==='work'||cur.phase==='triage')&&Q.get('fresh')!=='1'){ restoreDay(cur); return; }
  P.cur=null; startBriefing(); }
async function stageUp(){ if(NO_STAGE){ $('stage').style.display='none'; return; } const extra=Object.values(D.npcs||{}).filter(n=>n.seat&&!['lead','senior','chief','staff'].includes(n.seat)).map(n=>`${n.seat}:${n.ch}`).join(',');
  const seats=Object.values(D.npcs||{}).filter(n=>n.seat&&['chief','staff'].includes(n.seat)).map(n=>`${n.seat}:${n.ch}`).join(',');
  const me=playerChar(P&&P.avatar);
  /* 캐릭터 교체로 무대를 다시 세울 때, 새 문서가 뜨기 전에는 contentWindow.__office 가 **옛 무대**다 —
     그것의 ready() 가 참이라 곧바로 넘어가던 것을 막는다(45차) */
  let oldO=null; try{ oldO=($('stage').contentWindow&&$('stage').contentWindow.__office)||null; }catch(e){}
  /* 고른 성별을 3D 로 넘긴다 — 대표 "여자로 설정해도 남자로 나온다".
     정본은 `?player=`(39차 제공). `&me=` 는 그 전 이름이라 함께 붙여 둔다. */
  $('stage').src=`office_fixed_roster.html?embed=1&team=${S.team}${extra?'&extra='+extra:''}${seats?'&seats='+seats:''}&player=${me}&me=${me}`;
  await new Promise(res=>{ const t0=Date.now(); const iv=setInterval(()=>{ let O=null; try{ O=$('stage').contentWindow&&$('stage').contentWindow.__office; }catch(e){} if(O===oldO) O=null; if(O){ /* 3D 쪽 진행 문구(「NPC 불러오는 중…」)는 화면에 옮기지 않는다 — 로딩은 「로딩 중」 한 줄이다 */
        try{ for(const [n,v] of Object.entries(D.npcs||{})) if(v.seat) O.setLabel(v.seat,n); const doc=$('stage').contentDocument; const st=doc&&doc.getElementById('status'); if(st) console.info('[사무실]',st.textContent); }catch(e){} if(O.ready&&O.ready()){ clearInterval(iv); res(); } } if(Date.now()-t0>150000){ clearInterval(iv); toast('사무실을 불러오지 못해 글로 진행해요'); res(); } },250); });
  await warmWait(oldO);
  const O=office(); if(O){ try{ if(typeof O.setPlayerChar==='function') O.setPlayerChar(me); }catch(e){}
    try{ for(const [n,v] of Object.entries(D.npcs||{})) if(v.seat) O.setLabel(v.seat,n); O.camFollow(true); O.view('default'); }catch(e){}
    /* 말을 걸면 대화 모드가 열린다 — 대표 "말을 걸었으면 말을 할 수 있게 해줘, 이야기를." */
    try{ if(typeof O.onTalk==='function') O.onTalk((info)=>{ if(window.Talk) Talk.onNpc(info); }); }catch(e){}
    /* 45차: 연출 대사·선택지는 말풍선·3D 패널이 아니라 대화창으로(js/play/talk.js). onChoose·sayWaits 는 45차에 3D 가 제공 — 옛 무대면 talk.js 가 iframe #choice 를 옮긴다 */
    try{ if(typeof O.onSay==='function') O.onSay((p)=>window.Talk?Talk.onSay(p):undefined); }catch(e){}
    try{ if(typeof O.onChoose==='function') O.onChoose((p)=>window.Talk?Talk.onChoose(p):Promise.resolve(-1)); }catch(e){}
    refreshTalkHints(); } }
/* ---------- 워밍업 대기(45차) ----------
   대표 「렉 걸리는 거 렉 걸리지 않도록 렉 다 풀릴 때까지 로딩창 띄워. 게임 캐릭터가 보일 때는 렉이 걸리지 않도록」.
   내 캐릭터가 준비된 뒤(ready)에도 셰이더 컴파일·텍스처 업로드로 한동안 끊겼다. 3D 가 그 일을 로딩 화면 뒤에서 끝내고
   `warmupInfo().ready` 를 참으로 올릴 때까지 로딩 화면(조작법 카드면 「시작하기」)을 열어 두지 않는다.
   함수가 없는 옛 무대면 동료까지 앉을 때(full)까지 기다린다. 어느 쪽이든 상한을 넘기면 들어간다(갇히지 않게). */
async function warmWait(oldO){ if(NO_STAGE) return; const t0=Date.now(); const LIMIT=240000;
  const lb=$('loading'), ls=$('loadStage'); let first=true;
  lb.classList.remove('det'); lb.style.removeProperty('--pct'); if(ls) ls.textContent='';
  {
    for(;;){ let O=null; try{ O=$('stage').contentWindow&&$('stage').contentWindow.__office; }catch(e){}
      if(!O||O===oldO) break;                              /* 무대가 없으면(불러오기 실패) 기다릴 것이 없다 */
      let w=null; try{ if(typeof O.warmupInfo==='function') w=O.warmupInfo(); }catch(e){}
      if(w){ const p=(window.Intro&&Intro.warmPct)?Intro.warmPct(w,first):(w.ready?1:0); first=false;
        lb.classList.add('det'); lb.style.setProperty('--pct',Math.round(p*100)+'%');
        if(ls) ls.textContent=(window.Intro&&Intro.warmText)?Intro.warmText(w):(w.stage||'');
        if(w.ready){ if(w.timedOut) console.info('[사무실] 워밍업 안정 조건 시간 초과로 입장',w.ms+'ms'); break; } }
      else { let full=false; try{ full=!!(O.full&&O.full()); }catch(e){}
        if(ls) ls.textContent=full?'':'동료들이 자리에 앉는 중…';
        if(full||Date.now()-t0>120000) break; }
      if(Date.now()-t0>LIMIT){ console.warn('[사무실] 워밍업 대기 상한 — 그대로 입장'); break; }
      await sleep(250); }
  } }   /* 끝난 뒤에도 막대(100%)와 문구는 로딩 화면이 닫힐 때까지 그대로 둔다 — 지우면 닫히기 직전 한 번 깜빡인다 */
/* 머리 위 안내 문구 — 그 사람이 **먼저 할 말**이 있거나(Talk.hear 로 쌓인 것) 오늘 그 사람에게 할 일이 있으면 적는다.
   문구가 있는 자리에만 3D 가 머리 위 표시를 띄운다(없으면 기본 「T · 이름에게 말 걸기」).
   45차: 말풍선이 없어졌으므로 이 표시가 「가서 들어라」의 유일한 신호다 — 전달 상대(dests)만이 아니라 자리 있는 사람 전부를 본다. */
function refreshTalkHints(){ const O=office(); if(!O||typeof O.setTalkHint!=='function'||!D) return;
  const seats={}; for(const [n,v] of Object.entries(D.npcs||{})) if(v&&v.seat&&!seats[v.seat]) seats[v.seat]=n;
  for(const d of (D.dests||[])) if(d.seat&&!seats[d.seat]) seats[d.seat]=d.name;
  for(const [seat,name] of Object.entries(seats)){ let tx='';
    try{ if(window.Talk&&Talk.hasPending&&Talk.hasPending(name)) tx='T — 이야기 듣기';
      else { const t=(window.Talk&&Talk.tasks)?Talk.tasks(name,{mark:true}):[]; if(t.length) tx=t[0].hint||''; } }catch(e){}
    try{ O.setTalkHint(seat,tx); }catch(e){} } }
function restoreDay(cur){ Object.assign(S,{t:cur.t,cards:cur.cards,order:cur.order,extra:cur.extra||[],trust:cur.trust||{},counts:Object.assign(S.counts,cur.counts||{}),nexts:cur.nexts||[],mistakes:cur.mistakes||[],triage:cur.triage||null,clues:cur.clues||[]});
  /* 57차 E1 — 역량 증거: 「일부만 기록」 표시를 잇는다. 옛 진행(cur.v 없음 — 증거 없이 끝낸 카드가 있음)을 이어 하면 그날은 part(spec §3-7) */
  S.evPart=(cur.ev&&cur.ev.part)?1:0; if(cur.v!==2&&Object.values(cur.cards||{}).some(st=>st&&st.status==='done')) S.evPart=1;
  for(const c of D.cards) if(!S.cards[c.id]) S.cards[c.id]={arrived:false,status:'wait'};
  /* 방문객이 소파에 앉아 있던 표시는 3D 가 새로 떴으니 무효다(45차) */
  for(const st of Object.values(S.cards)){ if(st){ delete st.visitorHere; delete st.visitorComing; } }
  S.phase=cur.phase==='triage'?'triage':'work'; S.running=S.phase==='work'; lastTick=0; renderClock(); rehydrateBoxes(); renderInbox(); renderCounts(); toast(`이어서 합니다 — ${fmtClock(S.t)}부터`); if(S.phase==='triage'){ $('triage').classList.add('open'); renderTriage(); } }

/* ---------- 다음 업무까지 넘기기(45차 · 대표 승인) ----------
   할 일이 하나도 없을 때 다음 카드가 올 때까지 멍하니 기다리지 않게 한다. 누르면 게임 시계가 **다음 카드 도착 시각에 딱 맞춰** 넘어가고,
   더 올 카드가 없으면 퇴근 시각까지 넘어가 팀장이 부른다(callWrap).
   보이는 조건 — 전부 0 이어야 한다: 도착했는데 안 끝난 카드 · 쌓인 T 대화(Talk.hear/부르기) · 떠 있는 대화창 · 3D 연출(busy) ·
   답장 작성 중 · 브리핑 전/분류/퇴근 뒤/일시정지.
   점수 보호 — 마감 판정(core.js checkLate)은 **안 끝난 카드**만 본다. 넘길 수 있을 때는 안 끝난 카드가 0 이므로 늦음이 생기지 않고,
   새로 오는 카드는 도착 시각(arrivedAt=카드의 arrive)부터 마감을 세므로 도착 시각을 넘어서 건너뛰지 않는 한 창이 줄지 않는다(그래서 정확히 그 시각으로).
   기록 — S.counts.skipN(넘긴 횟수) · skipMin(넘긴 게임 분, 표시 분 = ×DISP_MUL). 저장·결과(counts)에 함께 남는다. 채점에는 쓰지 않는다. */
function nextArrivalMin(){ if(!D) return null; let next=null;
  for(const c of D.cards.concat(S.extra)){ const st=S.cards[c.id]; if(!st||st.arrived) continue;
    if(c.requires&&!requireMet(c)) continue;                 /* 조건이 안 찬 체인 카드는 시간이 가도 오지 않는다 */
    const at=+((c.requires&&st.readyAt!=null)?st.readyAt:c.arrive); if(!isFinite(at)) continue;
    if(next==null||at<next) next=at; }
  return next; }
function skipBlock(){
  if(!D||D.kind==='ep7'||S.phase!=='work'||!S.running||S.ended||S.paused) return 'phase';
  if(S.composing) return 'compose';
  if(window.Talk&&(Talk.isOpen()||(Talk.anyPending&&Talk.anyPending()))) return 'talk';
  const O=office(); if(O&&O.busy) return 'busy';
  if(D.cards.concat(S.extra).some(c=>{ const st=S.cards[c.id]; return st&&st.arrived&&st.status!=='done'&&st.status!=='skipped'; })) return 'cards';
  for(const id of ['endNotice','triage','avatar','debrief']){ const e=$(id); if(e&&e.classList.contains('open')) return 'overlay'; }
  if(dayEndMin()-S.t<=0.01) return 'end';
  return ''; }
function skipNext(){ const why=skipBlock(); if(why) return {ok:false,why};
  const end=dayEndMin(), nx=nextArrivalMin(); const toEnd=!(nx!=null&&nx<end); const target=toEnd?end:nx;
  const min=Math.max(0,target-S.t); if(min<=0) return {ok:false,why:'now'};
  S.counts.skipN=(S.counts.skipN||0)+1; S.counts.skipMin=Math.round(((S.counts.skipMin||0)+min)*100)/100;
  lastTick=0; advance(min+1e-6);                              /* 도착 판정은 at<=S.t — 부동소수 오차로 한 틱 늦지 않게 아주 조금 더 */
  renderSkip(); saveProgress();
  return {ok:true,to:fmtClock(S.t),toEnd,min:Math.round(min*100)/100}; }
function renderSkip(){ const why=skipBlock(); const end=dayEndMin(), nx=D?nextArrivalMin():null; const toEnd=!(nx!=null&&nx<end);
  const label=toEnd?'퇴근까지 넘기기':'다음 업무까지 넘기기';
  /* 상단 바는 자리가 좁다(1280px 에서 「홈으로」가 밀려났다) — 「넘기기」를 떼고 전체 이름은 title·aria-label 로 */
  for(const id of ['skipBtn','pcSkip']){ const b=$(id); if(!b) continue; const hide=!!why; if(b.hidden!==hide) b.hidden=hide;
    const tx=id==='skipBtn'?label.replace(/\s*넘기기$/,' ⏵'):label;
    if(!hide&&b.textContent!==tx){ b.textContent=tx; b.setAttribute('aria-label',label); b.title=`${label} — 지금 할 일이 없을 때만 떠요`; } } }
for(const id of ['skipBtn','pcSkip']){ const b=$(id); if(b) b.onclick=(ev)=>{ ev.stopPropagation(); const r=skipNext(); if(!r.ok) renderSkip(); }; }
setInterval(()=>{ try{ renderSkip(); }catch(e){} },400);

/* ---------- 권한 · 사규집 · 조직도 ---------- */
function renderUnlocks(){ const box=$('unlocks'); box.innerHTML=''; for(const k of ['rulebook','approval','orgchart','report','decide']){ const on=(D.unlock||[]).includes(k); const s=h('span','chip '+(on?'on':''),(on?'':'🔒 ')+UNLOCK_LABEL[k]); s.title=on?'열림':`${UNLOCK_DAY[k]}일차에 열립니다`; box.appendChild(s); }
  $('tabRule').classList.toggle('lock',!(D.unlock||[]).includes('rulebook')); $('tabOrg').classList.toggle('lock',!(D.unlock||[]).includes('orgchart')); }
function showTab(name){ for(const t of ['hint','rule','org','prog']){ $('tab_'+t).style.display=t===name?'block':'none'; $('tab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('cur',t===name); } if(name==='prog') renderProgTab(); if(name==='rule') renderRulebook(); }
$('tabHint').onclick=()=>showTab('hint'); $('tabProg').onclick=()=>showTab('prog');
$('tabRule').onclick=()=>{ if(!(D&&(D.unlock||[]).includes('rulebook'))){ toast('사규집은 2일차에 받아요.'); return; } showTab('rule'); };
$('tabOrg').onclick=()=>{ if(!(D&&(D.unlock||[]).includes('orgchart'))){ toast('조직도는 4일차에 열려요.'); return; } showTab('org'); };
let RB_BOOK=null;
/* 사규집 편 잠금(56차) — 내 팀 편만 전문이 보이고, 다른 팀 편은 조항 번호·제목까지만 보인다.
   본문은 그 팀 사람을 실제로 만나야 열린다(js/play/core.js travel 래퍼가 rbUnlock 을 부른다).
   협동판에서는 다른 팀 학생에게 물어야 얻던 것이다 — 1인용에서는 「누구에게 가야 하나」가 그 자리를 대신한다. */
function rbOpenSet(){ if(!S.rbOpen) S.rbOpen=[S.team]; return S.rbOpen; }
function rbIsOpen(key){ return key===S.team || rbOpenSet().indexOf(key)>=0; }
function rbUnlock(key){ if(!key||rbIsOpen(key)) return; rbOpenSet().push(key);
  const nm=(typeof TEAM_NAMES!=='undefined'&&TEAM_NAMES[key])||key;
  toast(`${nm} 규정 편이 열렸어요 — 사규집에서 볼 수 있어요`); try{ renderRulebook(); }catch(e){} }
function initRulebook(){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; const sel=$('rbBook'); sel.innerHTML=''; if(!RB){ $('rbList').textContent='사규집 데이터가 없어요.'; return; } const books=RB.books.slice().sort((a,b)=>(a.key===S.team?-1:b.key===S.team?1:0)); for(const b of books){ const o=document.createElement('option'); o.value=b.key; o.textContent=b.title+(rbIsOpen(b.key)?'':' 🔒'); sel.appendChild(o); } RB_BOOK=books[0].key; sel.value=RB_BOOK; renderRulebook(); }
/* 조문 한 덩이를 문장 단위로 끊는다. 마침표 뒤에서 자르되 「3.5」 같은 소수는 붙여 둔다 */
function ruleLines(body){ const out=[]; let cur=''; const s=String(body||'');
  for(let i=0;i<s.length;i++){ const ch=s[i]; cur+=ch;
    if((ch==='.'||ch==='。')&&!/\d/.test(s[i+1]||'')){ const t=cur.trim(); if(t) out.push(t); cur=''; } }
  const t=cur.trim(); if(t) out.push(t); return out; }
/* 숫자·기한·금액은 굵게 — 조문에서 학생이 실제로 옮겨 적는 것이 그것이다 */
const RULE_NUM=/\d[\d,.]*\s*(?:원|일|시간|분|개월|년|주|%|퍼센트|영업일|건|회|배|명)?/g;
function ruleLine(text){ const p=h('p'); let last=0; let m;
  RULE_NUM.lastIndex=0;
  while((m=RULE_NUM.exec(text))){ if(m.index>last) p.appendChild(document.createTextNode(text.slice(last,m.index)));
    p.appendChild(h('em',null,m[0])); last=m.index+m[0].length; }
  if(last<text.length) p.appendChild(document.createTextNode(text.slice(last)));
  return p; }
/* 57차 E2(D21): 지금 쓰는 카드의 관련 조항을 맨 위로 끌어 올려 펼치던 것(relatedRuleIds)과 「번호 넣기」 단추를 없앴다 —
   그것이 곧 정답 조항이었다. 규정은 목차(편 고르기)와 검색으로 찾는다 */
function ruleItem(a,locked){ const it=document.createElement('details'); it.className='art'+(locked?' locked':'');
  const sm=document.createElement('summary'); sm.appendChild(h('b',null,a.id)); sm.appendChild(h('span','t',a.title)); it.appendChild(sm);
  const bd=h('div','abody');
  if(locked){ const nm=(typeof TEAM_NAMES!=='undefined'&&TEAM_NAMES[locked])||locked;
    bd.appendChild(h('p','lockmsg',`본문은 ${nm}이 가지고 있어요. 그 팀에 가서 물어보면 열려요.`)); }
  else for(const ln of ruleLines(a.body)) bd.appendChild(ruleLine(ln));
  it.appendChild(bd);
  it.addEventListener('toggle',()=>{ if(it.open) rbNote(a.id); });
  return it; }
function renderRulebook(){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; if(!RB) return; const q=($('rbSearch').value||'').trim().toLowerCase(); const list=$('rbList'); list.innerHTML='';
  let n=0;
  for(const b of RB.books){ if(!q&&b.key!==RB_BOOK) continue;
    for(const a of b.articles){
      if(q&&!(a.id.toLowerCase().includes(q)||a.title.includes(q)||(rbIsOpen(b.key)&&a.body.includes(q)))) continue;
      list.appendChild(ruleItem(a,rbIsOpen(b.key)?null:b.key)); n++; if(n>=60) break; }
    if(n>=60) break; }
  if(!n) list.appendChild(h('div','empty-msg',q?'찾는 조항이 없어요':'')); }
/* 사규집을 어떻게 찾았나 — 지금 다루는 카드의 상태에 검색어(?낱말)·열어 본 조항 번호를 남긴다(관리자 참고 · spec §7 E2-9).
   쓰지 않으면 필드를 만들지 않는다(저장 크기). 같은 것은 한 번만, 카드당 24개까지 */
function rbCardState(){ const id=(S.composing&&S.composing.id)||S.cur||(typeof HINT_CARD!=='undefined'?HINT_CARD:null); const st=id&&S.cards[id]; return st&&st.arrived&&st.status!=='done'?st:null; }
function rbNote(x){ if(!x||(S.phase!=='work'&&S.phase!=='triage')) return; const st=rbCardState(); if(!st) return; const rb=st.rb||(st.rb=[]); if(rb.includes(x)||rb.length>=24) return; rb.push(x); }
let rbTypeTm=null;
$('rbBook').onchange=()=>{ RB_BOOK=$('rbBook').value; $('rbSearch').value=''; renderRulebook(); };
$('rbSearch').addEventListener('input',()=>{ renderRulebook(); clearTimeout(rbTypeTm); rbTypeTm=setTimeout(()=>{ const q=($('rbSearch').value||'').trim(); if(q.length>=2) rbNote('?'+q.slice(0,20)); },900); });
/* 조직도는 **팀 이름 + 사람 셋**이 전부다(50차, 대표 「그걸 찾는 것도 의사결정 연습이다」).
   47차에 내가 붙였던 「지금 이 방 / 오늘 찾아갈 사람」 꼬리표를 뗀다 — 오늘 찾아갈 사람이 사실상 **정답표**여서
   메일을 열기도 전에 누구에게 갈 일인지 다 알게 됐다(타 팀 등장 131건 중 128건이 그날 카드 상대).
   「지금 이 방」도 같은 이유 — 내 팀 사람은 늘 있어 정보가 없고, 타 팀 손님이 뜨면 그게 또 누설이다.
   팀 이름과 사람 셋은 남긴다. 「세금계산서 → 회계팀 → 거기 사람」을 학생이 **스스로** 잇는 근거다. */
function initOrg(){ const box=$('orgList'); box.innerHTML=''; for(const k of TEAM_ORDER){ const o=ORG[k]; const row=h('div','orgrow'+(k===S.team?' me':'')); row.appendChild(h('b',null,TEAM_NAMES[k]));
  row.appendChild(h('span',null,[o.lead,o.senior,o.chief].concat(o.more||[]).join(' · '))); box.appendChild(row); } }   /* more — 늘 있는 조력자(core.js ORG · F8) */
function renderProgTab(){ const box=$('tab_prog'); box.innerHTML=''; box.appendChild(h('h4',null,`${S.name?S.name+' · ':''}${S.code||'데모'}`)); const ul=h('div','progdays'); for(let d=1; d<=7; d++){ const done=P&&P.done[String(d)]; const cur=d===S.ep; const e=h('div','pd '+(done?'done':cur?'cur':'lock'),`${d}일차 ${DAY_TITLES[d]||''} ${done?'✓':cur?'(오늘)':''}`); ul.appendChild(e); } box.appendChild(ul);
  const tr=Object.entries(Object.assign({},P&&P.trust||{})); for(const [n,v] of Object.entries(S.trust||{})){ const i=tr.findIndex(x=>x[0]===n); if(i>=0) tr[i][1]+=v; else tr.push([n,v]); } if(tr.length) box.appendChild(h('div','muted','신뢰: '+tr.map(([n,v])=>`${n} ${v>0?'+':''}${v}`).join(', ')));
  const cl=S.clues.length+((P&&P.clues&&Object.values(P.clues).reduce((a,b)=>a+b.length,0))||0); box.appendChild(h('div','muted',`모은 단서 ${cl}개`)); const ft=h('div','paneFoot'); box.appendChild(ft); ft.appendChild(mkBtn('홈으로','',()=>goHome(true))); }

/* ---------- 브리핑 ----------
   45차(대표 「말풍선 없애고 직접 가서 대화로 모든 것들을 듣게 해」): 3D 사무실이 있으면 컷신이 아니라 **부르기**다.
   팀장(팀장이 말하지 않는 날은 먼저 말하는 자리 있는 사람) 머리 위에 「T — 이야기 듣기」가 뜨고 알림이 한 줄 온다.
   가서 T 를 누르면 브리핑 대사가 얼굴 카메라 대화창으로 나오고, 다 들은 뒤에야 시계가 가고 카드가 온다
   (phase 가 'briefing' 인 동안 clockTick·arrivals 가 돌지 않는다). 다른 사람의 대사는 그 사람 이름표로 같은 판에 나온다.
   3D 가 없으면(?stage=0) 예전 대사 창. 자동 플레이·__play.skip 은 endBriefing() 을 바로 불러 들은 것으로 친다. */
let briefCall=null, wrapCall=null;
function talkByT(){ return !NO_STAGE&&!!office()&&!!(window.Talk&&Talk.call); }
/* 「김민아 팀장」→「김민아 팀장님이」 · 「박선임」→「박선임님이」 */
const calledBy=(n)=>`${n}님이`;
function briefGate(L){ const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'';
  const seated=(who)=>{ const k=Talk.norm?Talk.norm(who):who; return seatByName(k)?k:null; };
  if(lead&&seatByName(lead)&&(L.some(l=>seated(l.who)===lead)||!L.some(l=>seated(l.who)))) return lead;
  for(const l of L){ const k=seated(l.who); if(k) return k; }
  return lead&&seatByName(lead)?lead:null; }
/* 브리핑 부르기 — 여러 사람이 말하면 그 사람들이 먼저 부르는 사람 둘레로 걸어와 선다(3D gather). 대화창은 줄마다 말하는 사람 얼굴을 잡는다(talk.js aimAt).
   자동화(webdriver)는 사람이 안 보므로 모이지 않는다 — 걸어가는 동안 3D 연출 상대가 자리에 없어 자동 플레이가 멈추지 않게. */
let briefGathered=[];
/* 브리핑에서 말하는 사람(부르는 사람 빼고, 이 방 자리에 있는 사람)을 부르는 사람 둘레로 모은다 — 7일차(ep7.js)도 같이 쓴다 */
function briefGatherStart(L,gate){ const gateSeat=seatByName(gate); const O=office();
  const seats=uniq((L||[]).map(l=>seatByName(Talk.norm(l.who))).filter(x=>x&&x!==gateSeat));
  ungatherBrief();
  if(seats.length&&O&&typeof O.gather==='function'&&!navigator.webdriver){ briefGathered=seats; try{ O.gather(seats,gateSeat); }catch(e){ console.warn('모이기 실패',e); briefGathered=[]; } }
  return briefGathered.slice(); }
/* ══ 48차 — 1일차 「사원증 전달」(9팀 ep1 브리핑 첫 줄, 총무팀 최주임) ════════════════════
   47차에 타 팀 조력자의 내 방 좌석을 없애면서 최주임도 자리가 사라져 **대사만 나오고 3D 로는 안 보였다**
   (briefGatherStart 가 자리 있는 사람만 모은다). 원래도 9팀 중 5팀만 3D 였다 — 자리가 있던 팀만.
   이제 9팀 모두 **문으로 들어와 사원증을 주고 나간다**(office visitorIn({stand})/visitorOut).

   왜 소파가 아니라 팀장 자리 둘레인가 — 지문은 「입구에서, 사원증을 건네며」다.
   ① 브리핑은 팀장 자리에서 듣는다. 문 앞(6~7m 밖)에 세우면 카메라만 멀리 날아가고
      「건네며」인데 받을 사람이 화면에 같이 안 잡힌다.
   ② 소파에 앉히면(기본 visitorIn) 브리핑 내내 남의 팀 방에 앉아 있게 된다 — 47차에 없앤 바로 그 모양이다.
   그래서 **들어오는 길**로 「입구에서」를 살리고, 건네는 것은 눈앞에서 하고, 그 줄이 끝나는 즉시 나간다.
   최주임은 총무팀 사수다 — 나간 뒤 총무팀으로 찾아가면 거기 앉아 있다(같은 사람이 두 군데 동시에 보이지 않는다).

   **1일차 첫 줄에만** 건다. 자기 팀 사람은 손님이 아니다 —
   qc 6일차 도주임·pr 6일차 표주임은 **내 팀 주임**인데 한때 npcs 에 없어 자리 없는 화자로 잡혔다
   (HANDOFF 47차 「남은 것」 3번. 48차에 npcs 에 chief 로 들어가 지금은 앉아 있다).
   7일차 셋째 줄(동기)은 3D 모델이 없어 어차피 해당 없다(Talk.chOf 가 ''를 돌려준다). */
let briefVisit=null;
function briefVisitorPick(L){
  if(NO_STAGE||Number(S.ep)!==1||!L||!L.length) return null;   /* 홈에서 고른 날짜가 글자로 올 수도 있다 */
  const O=office(); if(!O||typeof O.visitorIn!=='function'||!window.Talk||!Talk.chOf) return null;
  const l=L[0]; if(!l||!l.who) return null;
  const who=Talk.norm?Talk.norm(l.who):l.who;
  if(!who||seatByName(who)) return null;            /* 이 방에 자리가 있으면 그대로 앉아 있다(총무팀 ga 의 최주임 = 사수) */
  const ch=Talk.chOf(l.who)||'';
  if(!ch) return null;                              /* 3D 모델이 없는 사람(회계팀 동기 임도윤 등)은 예전처럼 대사만 */
  return {who,ch};
}
/* 48차 후속(대표 「09:00 에 문 쪽 컷 0.8초」) — 손님이 문지방을 넘는 0.8초만 카메라가 그를 잡는다(office doorCut).
   자동화(webdriver)는 볼 사람이 없고 카메라를 빌리면 검사 도구의 시점 조작과 엉킨다 → 컷 없음(모이기 gather 와 같은 규칙).
   컷은 **걸어 들어오기와 따로** 돌아, 있든 없든 들어오는 시간은 같다. */
const BRIEF_CUT_SEC=0.8;
function briefVisitorIn(L,gate){
  briefVisit=briefVisitorPick(L); if(!briefVisit) return null;
  const O=office(); const seat=seatByName(gate)||'lead';
  const cut=(Q.get('cut')==='0'||navigator.webdriver)?0:BRIEF_CUT_SEC;   /* ?cut=0 — 컷만 꺼서 앞뒤를 견준다(들어오는 시간이 늘었는지) */
  try{ Promise.resolve(O.visitorIn({name:briefVisit.who,ch:briefVisit.ch,stand:seat,noTalk:true,cut}))
        .catch(e=>console.warn('사원증 손님 들어오기 실패',e)); }
  catch(e){ console.warn('사원증 손님 들어오기 실패',e); briefVisit=null; }
  return briefVisit;
}
function briefVisitorOut(){ if(!briefVisit) return; briefVisit=null;
  const O=office(); if(!O||typeof O.visitorOut!=='function') return;
  try{ Promise.resolve(O.visitorOut()).catch(()=>{}); }catch(e){}
}
function callBriefing(onHeard){ const L=(D.dialog&&D.dialog.briefing)||[];
  const gate=L.length&&talkByT()?briefGate(L):null; if(!gate) return false;
  S.phase='briefing'; S.briefT=true;
  briefGatherStart(L,gate);
  const bv=briefVisitorIn(L,gate);
  briefCall=Talk.call(gate,L.map(l=>{ const o={who:l.who,text:l.text,role:l.role};
    if(bv&&Talk.norm(l.who)===bv.who) o.onSaid=briefVisitorOut;   /* 사원증을 건넨 줄이 끝나면 곧바로 나간다 */
    return o; }),{ gathered:briefGathered.slice(),
    notice:`${calledBy(gate)} 부르세요. 자리로 가서 T 로 이야기를 들어요. (들어야 하루가 시작돼요)`, remind:30000,
    onHeard:()=>{ briefCall=null; onHeard(); } });
  return true; }
function ungatherBrief(){ if(!briefGathered.length) return; briefGathered=[]; const O=office(); if(O&&typeof O.ungather==='function'){ try{ O.ungather(); }catch(e){} } }
function startBriefing(){ S.phase='briefing'; S.briefI=0; S.briefT=false;
  if(callBriefing(()=>{ if(S.phase==='briefing') endBriefing(); })) return;
  $('dialog').classList.add('open'); showBrief(); }
function showBrief(){ const L=D.dialog.briefing||[]; const l=L[S.briefI]; if(!l){ endBriefing(); return; } $('dWho').textContent=`${l.who}${l.role?' ('+l.role+')':''}`; $('dTx').textContent=fillName(l.text||''); $('dNext').textContent=S.briefI===L.length-1?'업무 시작':'다음';
  /* 45차: 말풍선을 띄우지 않는다 — 대사는 이 대사 창에만 나온다 */
  const O=office(); if(O){ try{ if(l.view) O.view(l.view); }catch(e){} } }
$('dNext').onclick=()=>{ if(S.phase!=='briefing') return; S.briefI++; showBrief(); }; $('dSkip').onclick=()=>{ if(S.phase==='briefing') endBriefing(); };
function endBriefing(){ if(briefCall){ briefCall.cancel(); briefCall=null; } ungatherBrief(); briefVisitorOut();   /* 48차: 건너뛰거나 자동 플레이로 왔으면 여기서 내보낸다 */
  $('dialog').classList.remove('open'); const O=office(); if(O&&!S.briefT){ try{ O.hush(); O.view('default'); }catch(e){} } S.phase='work'; S.running=true; lastTick=0; arrivals();
  if(D.triage&&!(S.triage&&S.triage.done)){ startTriage(); return; }
  /* 「답할 것 / 넘길 것 / 물어볼 것을 나눠 보세요」는 1일차 연습 안내로만(57차 E2 — 칸 이름이 처리 방식을 알려 준다) */
  const L=D.todoLabels||['답할 것','넘길 것','물어볼 것']; toast(Number(S.ep)<=1?`메일함이 열렸어요. ${L.join(' / ')}을 나눠 보세요.`:'메일함이 열렸어요.'); saveProgress(); }
$('triageGo').onclick=()=>finishTriage();

/* ---------- 09:30 · 마무리 · 디브리프 ---------- */
/* 퇴근 시각. 상시 배너를 세워 두고 학생이 아무 때나 누르게 하지 않는다 —
   팀장이 자리로 와서 하루가 닫힌다(「일어나는 일」). 3D 쪽 연출 훅이 붙으면
   그것을 기다리고, 아직 없으면 안내를 2초 띄우고 그대로 디브리프로 넘어간다.
   필요한 API 는 docs/office-api-requests.md 「leadVisit」에 적어 두었다. */
async function onDayEnd(){ S.running=false; closeComposer(); $('endbar').classList.remove('open');
  const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장';
  if(talkByT()&&seatByName(lead)){ callWrap('time'); return; }
  /* 45차: 말풍선·알림으로 흘리지 않는다 — 가운데 안내 한 장이 전부다 */
  $('enTitle').textContent='퇴근 시간입니다'; $('enSub').textContent=`${lead}이 결과를 보러 옵니다.`;
  $('endNotice').classList.add('open');
  const O=office(); if(O&&typeof O.leadVisit==='function'){ try{ await O.leadVisit(); }catch(e){} }
  await sleep(NO_STAGE?300:2000);
  $('endNotice').classList.remove('open'); finish(); }
/* 하루가 끝나기 전에 남은 일이 없으면 그때는 끝낼 자격이 생긴 것이라 버튼을 보인다 */
function checkAllDone(){ if(!D||S.phase!=='work'||S.ended) return;
  const main=D.cards.filter(c=>!c.pre);
  if(!main.length||main.some(c=>{ const st=S.cards[c.id]; return !st||st.status!=='done'; })) { $('endbar').classList.remove('open'); return; }
  const un=D.cards.concat(S.extra).filter(c=>{ const st=S.cards[c.id]; return st&&st.arrived&&st.status!=='done'; });
  if(un.length){ $('endbar').classList.remove('open'); return; }
  $('endbarTx').textContent='오늘 할 일을 다 했습니다.'; $('endbar').classList.add('open'); }
$('finishBtn').onclick=()=>{ const lead=(D&&D.dests.find(x=>x.seat==='lead')||{}).name||'';
  if(talkByT()&&lead&&seatByName(lead)){ S.running=false; closeComposer(); $('endbar').classList.remove('open'); callWrap('done'); } else finish(); };
/* 45차: 퇴근 마무리도 **부르기**다. 결과는 먼저 계산해 저장해 두고(finish defer), 팀장 머리 위 표시 + 알림 →
   가서 T → 팀장이 오늘 평가 한마디(debrief lead 줄)를 한 뒤 결과 화면이 열린다.
   자동 플레이·「오늘 그만하기」가 finish() 를 부르면 그 자리에서 결과 화면으로 넘어간다(들은 것으로 친다). */
async function callWrap(why){ if(S.phase==='wrap'||S.phase==='debrief'||S.phase==='finishing') return; const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장';
  const res=await finish({defer:true}); if(!res||S.phase!=='wrap') return;
  /* 팀장 말투를 맞춘다 — 반말 쓰는 팀장(물류팀 등)이 이 한 줄만 존댓말이면 어색하다. 오늘 그 팀장의 대사에 「~요」가 없으면 반말 */
  const leadSays=((D.dialog&&D.dialog.briefing)||[]).filter(l=>l&&l.who&&(l.who===lead||lead.endsWith(l.who)||l.who.endsWith(lead))).map(l=>l.text).join(' ')+' '+(res.leadLine||'');
  const banmal=leadSays.trim()&&!/요[.?!…]|요\s*$/.test(leadSays);
  const first=why==='done'
    ?(banmal?'○○씨, 오늘 할 일 다 했다며? 수고했어. 같이 한번 보자.':'○○씨, 오늘 할 일 다 했다며요? 수고했어요. 같이 한번 볼까요?')
    :(banmal?'○○씨, 퇴근 시간이야. 오늘 한 거 같이 보자.':'○○씨, 퇴근 시간이에요. 오늘 한 거 같이 볼까요?');
  const lines=[{who:lead,text:first}]; if(res.leadLine) lines.push({who:lead,text:res.leadLine});
  wrapCall=Talk.call(lead,lines,{ notice:`${calledBy(lead)} 부르세요. 자리로 가서 T 로 오늘 마무리를 들어요.`, remind:30000,
    onHeard:()=>{ wrapCall=null; showDebrief(res); } });
  $('enTitle').textContent=why==='done'?'오늘 할 일을 다 했습니다':'퇴근 시간입니다'; $('enSub').textContent=`${calledBy(lead)} 부르세요 — 가서 T 로 마무리를 들어요.`;
  $('endNotice').classList.add('open'); setTimeout(()=>$('endNotice').classList.remove('open'),2600); } $('moreBtn').onclick=()=>{ $('endbar').classList.remove('open'); toast('더 보고 있어도 됩니다. 다 봤으면 일시정지 메뉴에서 「오늘 그만하기」를 누르세요.'); };
/* 하루 마감 — 57차 E1: 끝내지 않은 카드의 D12 증거를 서버에 물어야 해서(배포본 · B4) 비동기다. 여러 곳(퇴근·「오늘 그만하기」·자동 플레이·팀장 부르기)이 불러도
   마감은 한 번만 하고(S.finishP) 모두 같은 결과를 기다린다. 기다리는 동안 단계는 'finishing'(시계·저장·T 대화가 멈춘다).
   opt.defer — 결과만 만들어 두고 화면은 팀장 부르기(callWrap)가 연다 */
function finish(opt){ opt=opt||{};
  if(S.finishP) return S.finishP.then(res=>afterFinish(res,opt));
  if(S.phase==='debrief') return Promise.resolve(null);
  S.phase='finishing'; S.running=false; closeComposer(); $('endbar').classList.remove('open');
  S.finishP=doFinish().catch(e=>{ console.error('하루 마감 오류',e); return null; });
  return S.finishP.then(res=>afterFinish(res,opt)); }
function afterFinish(res,opt){ if(!res) return res;
  if(opt.defer){ if(S.phase==='finishing'){ S.phase='wrap'; S.wrapRes=res; } return S.phase==='wrap'?res:null; }
  if(S.phase!=='debrief') showDebrief(res); return res; }
/* 끝내지 않은 카드 — 57차 E1(D12 ② · C12 · E2f §8-3):
   · 단계를 하나라도 했으면 **단계 평균(빠진 단계 0)** — 전달만·보고만·첫 글만(예전 규칙과 같은 값)에 더해, 예전에 0 이던 「전달 전 회신만」·「두 글 카드의 둘째 글만」도 같은 규칙으로(비대칭 해소)
   · 아무것도 안 했으면 0(미처리) · 둘 다 늦음(ontime 에서 제때가 아님)
   · 증거: 주 항목 0!(이미 관찰한 것은 그대로) · 단계를 시작했으면 끝까지(follow) 0 · 상대를 찾다 못 찾았으면 route 0 — Score.dayEnd(배포본은 서버) */
function partialEnd(c,st){ const steps=st.steps||{}; const req=requiredSteps(c); const did=req.filter(k=>steps[k]&&!steps[k].skipped); if(!did.length) return null;
  const score=Math.round(did.reduce((a,k)=>a+(typeof steps[k].score==='number'?steps[k].score:0),0)/req.length);
  const replyWho=c.replyTo||msgWho(c)||'요청한 사람'; const alsoWho=(typeof c.alsoReply==='object'&&c.alsoReply.to)||c.alsoReplyTo||'안내할 사람'; const dnpc=(c.deliver&&c.deliver.npc)||'';
  const has=(k)=>did.includes(k); let act='reply', comment='', branch=null;
  if(has('work')){ act='work'; comment=`검산은 맞았지만 ${dnpc||'팀장'}에게 가져가지 않았어요.`; }
  else if(has('deliver')){ act='deliver'; comment=`전달은 했지만 ${replyWho}에게 어디로 넘어갔는지 알리지 않았어요.`; branch='noReply'; }
  else if(has('report')){ act='report'; comment=`보고는 했지만 ${replyWho}에게 회신하지 않았어요.`; }
  else if(has('reply')&&req.includes('deliver')){ act=steps.reply.key||'reply'; comment=`회신은 보냈지만 ${dnpc||'맡을 사람'}에게 전달하지 않았어요.`; }
  else if(has('reply')&&req.includes('report')){ act=steps.reply.key||'reply'; comment=`회신은 보냈지만 ${c.npc||(c.report&&c.report.npc)||leadOfDay()}에게 보고하지 않았어요.`; }
  else if(has('reply')){ act=steps.reply.key||'reply'; comment=`${alsoWho}에게 보낼 안내 회신이 빠졌어요.`; }   /* 행동 이름은 그 글의 키로 — 상신만 하고 끝난 두 글 카드는 「상신」(rec 2차) */
  else if(has('reply2')){ act='reply'; comment=`회신은 보냈지만 ${confirmTo(c)}에게 올리지 않았어요.`; }
  return {act,score,comment,branch}; }
async function doFinish(){
  const pending={};
  if(!Grader.local()) await Grader.settle();   /* 57차 E1 후속(B2) — 날아가는 카드 채점이 다 붙은 뒤에 마감한다(봉인이 갈라지지 않게) */
  for(const c of D.cards.concat(S.extra)){ const st=S.cards[c.id]; if(!st||st.status==='done') continue;
    if(!st.arrived){ st.status='skipped'; st.act='none'; st.score=null; continue; }
    st.dayEnd=1;   /* 하루 끝에 닫힌 카드(57차 E1 후속 2) — 디브리프 추가 대사 조건 done 이 「학생이 끝낸 카드」와 가른다. 저장하지 않는다(cardRecord 밖) */
    if(c.followup){ st.status='done'; st.act='none'; st.score=null; continue; }
    if(c.scored===false&&c.mode==='story'&&!c.alsoReply){ runBranch(c.id,'none'); st.status='done'; st.score=null; st.act='none'; continue; }
    if(c.unscored||c.axis==='self'){ runBranch(c.id,'blank'); st.status='done'; st.score=null; st.act='none'; evLocal(c.id,'note',0); continue; }
    const steps=st.steps||{};
    pending[c.id]={have:(typeof Ev!=='undefined')?Ev.parse(st.ev).map(e=>e.i):[],started:Object.keys(steps).length>0||!!st.ask,tries:st.tries||0};
    if(!Grader.local()) pending[c.id].sl=sealIn(c.id);   /* 57차 E1 후속(B2) — 서버가 이 카드 봉인을 이어서 서명한다 */
    /* 코멘트는 그 카드의 받는 사람 기준(57차 E2후속 F5) */
    const pe=partialEnd(c,st);
    if(pe){ st.late=true; record(c.id,{act:pe.act,score:pe.score,comment:pe.comment}); if(pe.branch) runBranch(c.id,pe.branch); continue; }
    st.status='done'; st.act='none'; st.score=0; st.comment='처리하지 못했어요.'; st.late=true; if(c.clue&&(D.branches[c.id]||{}).other&&D.branches[c.id].other.clueGap) st.clueGap=true; }
  /* D12 ② 증거 — 배포본 브라우저는 주 항목을 모른다(공개본 ncs2 는 route·follow 만) → 서버 Score.dayEnd(로컬은 같은 함수를 바로) */
  if(Object.keys(pending).length){ try{ const r=await Grader.run('dayEnd',null,{cards:pending}); if(r&&r.evv&&r.cards){ for(const [id,list] of Object.entries(r.cards)){ addEv(id,list); if(r.sl&&r.sl[id]) takeSeal(id,{sl:r.sl[id]}); } } else if(!Grader.local()) S.evPart=1; }catch(e){ console.warn('하루 끝 증거 실패:',e&&e.message); S.evPart=1; } }
  /* 디브리프 추가 대사(예: 조력자가 먼저 연락 — 신뢰 조건)와 그 단서 */
  for(const ex of ((D.dialog.debrief||{}).extra||[])){ if(!extraCondMet(ex)) continue; if(ex.clue&&!S.clues.some(k=>k.card===(ex.clue.card||'extra'))) S.clues.push({caseId:ex.clue.caseId,day:S.ep,card:ex.clue.card||'extra',note:ex.clue.note,value:ex.clue.value||null,label:ex.clue.day||null}); }
  const res=buildResult(); res.ncs2=dayNcs2();
  P.done[String(S.ep)]=storedDay(res); P.day=Math.max(P.day||1,S.ep+1); P.cur=null;
  P.rbOpen=Array.from(new Set(((P.rbOpen)||[]).concat(S.rbOpen||[]))).filter(k=>k&&k!==S.team);   /* 오늘 열린 규정 편을 내일로 넘긴다 */ for(const [n,v] of Object.entries(S.trust)) P.trust[n]=(P.trust[n]||0)+v; for(const k of S.clues){ (P.clues[k.caseId]=P.clues[k.caseId]||[]); if(!P.clues[k.caseId].some(x=>x.card===k.card&&x.day===k.day)) P.clues[k.caseId].push(storedClue(k)); } P.unlocked=uniq((P.unlocked||[]).concat(D.unlock||[]));
  saveProgress(true);
  return res; }
/* 하루 집계 증거(57차 E1 · spec §2-2 ontime·own·triage) — 브라우저가 만든다(공개본 화 ncs2 에 요소가 있다) · 6화 분류는 서버가 낸 것
   · 제때(ontime) = 채점 카드 중 제때 끝낸 비율(보류도 처리) — 「오늘 그만하기」로 끝낸 날은 안 온 채점 카드도 분모(D12 ③)
   · 직접 처리(own) = 정답이 회신인 회신형 카드 가운데 회신으로 끝낸 비율 — 그런 카드가 2장 이상인 날만(D3) */
function dayNcs2(){ const o={v:1,day:''}; if(typeof Ev==='undefined'||!Ev.on()){ return null; } const items=(D.ncs2&&Array.isArray(D.ncs2.items))?D.ncs2.items:[]; const out=[];
  const scored=D.cards.concat(S.extra).filter(c=>!c.followup&&c.scored!==false&&!c.unscored&&c.axis!=='self');
  const arrived=scored.filter(c=>S.cards[c.id]&&S.cards[c.id].arrived);
  for(const it of items){
    if(it.ov==='ontime'){ const den=S.quit?scored.length:arrived.length; if(!den) continue; const ok=arrived.filter(c=>{ const st=S.cards[c.id]; return st.status==='done'&&st.act!=='none'&&!st.late; }).length; out.push(Ev.item(null,it,Ev.band(ok/den,'rate'))); }
    else if(it.ov==='own'){ const L=arrived.filter(c=>c.best==='reply'&&flowOf(c)[0]==='reply'); if(L.length<2) continue; const ok=L.filter(c=>{ const st=S.cards[c.id]; return st.status==='done'&&st.act==='reply'&&!st.off; }).length; out.push(Ev.item(null,it,Ev.band(ok/L.length,'rate'))); }
    else if(it.ov==='triage'&&S.triage&&S.triage.ev) out.push(...Ev.parse(S.triage.ev)); }
  o.day=Ev.str(out.filter(Boolean)); if(S.evPart) o.part=1; if(S.quit) o.quit=1; return o; }
function showDebrief(res){ if(wrapCall){ wrapCall.cancel(); wrapCall=null; } if(window.Talk&&Talk.isOpen()) Talk.close();   /* 결과 화면 밑에 남은 대화창·줄 선 대사를 걷는다 */
  S.phase='debrief'; $('endNotice').classList.remove('open'); renderDebrief(res); $('debrief').classList.add('open'); }
/* 디브리프 추가 대사의 조건 — 신뢰(trustMin · npc)에 더해 57차 E1 후속 2(done-cs 14): **그날 그 카드를 실제로 어떻게 처리했나**(cond.card …).
   예전에는 신뢰만 봐서 「주차 건 잘 끝났어요」가 그 건을 전달하지 않아도 나왔다(1~3일차·대화 인사로 쌓인 신뢰). 카드 조건의 낱말은 다음 날 분기 trigger(branchTriggerMet)와 같고
   오늘 카드 기록(cardRecord — 저장본과 같은 모양)으로 판정한다: act(키 또는 목록) · choice · report · forbidHit · replyBanHit · delivered · partial · miss · anyMiss.
   더해서 done(그날 학생이 끝냈다 — 하루 끝 자동 마감·미처리가 아님) · asked(맞는 상대에게 물었다) · got(직접 묻기에서 들은 조각 key 전부) · workOk(결과값이 맞았다) · scoreMin(카드 점수 하한).
   카드 여럿은 allOf:[{card,…},…](전부) · anyOf:[{card?,…},…](하나라도 — card 를 물려받는다). 모든 조건이 맞아야 대사가 나온다(대사에 달린 단서도 같이) */
const CARD_COND_KEYS=['act','choice','report','forbidHit','replyBanHit','delivered','partial','miss','anyMiss','done','asked','got','workOk','scoreMin'];
function extraCondMet(ex){ const cd=ex&&ex.cond; if(!cd) return true; const who=cd.npc||ex.who; if(cd.trustMin!=null&&trustOf(who)<cd.trustMin) return false; return cardCondMet(cd,null); }
function cardCondMet(cd,inherit){ const id=cd.card||inherit;
  if(Array.isArray(cd.allOf)&&!cd.allOf.every(x=>cardCondMet(x||{},id))) return false;
  if(Array.isArray(cd.anyOf)&&!cd.anyOf.some(x=>cardCondMet(x||{},id))) return false;
  if(!CARD_COND_KEYS.some(k=>cd[k]!=null)) return true;
  const st=id&&S.cards[id]; if(!st) return false; const rec=cardRecord(st);
  if(cd.act!=null&&![].concat(cd.act).includes(rec.act)) return false;
  if(cd.done!=null&&(st.status==='done'&&rec.act!=='none'&&!st.dayEnd)!==!!cd.done) return false;
  if(cd.asked!=null&&!!st.ask!==!!cd.asked) return false;
  if(cd.got!=null){ const g=(st.ask&&st.ask.got)||[]; if(![].concat(cd.got).every(k=>g.includes(k))) return false; }
  if(cd.workOk!=null&&(rec.workOk===true)!==!!cd.workOk) return false;
  if(cd.scoreMin!=null&&!(typeof rec.score==='number'&&rec.score>=+cd.scoreMin)) return false;
  const tr={card:id}; for(const k of ['choice','report','forbidHit','replyBanHit','delivered','partial','miss','anyMiss']) if(cd[k]!=null) tr[k]=cd[k];
  return branchTriggerMet(tr,{cards:{[id]:rec}}); }
function metricValue(rule){ const m=(rule&&rule.metric)||'done'; const c=S.counts; if(m==='cite') return c.cite; if(m==='calc') return c.calc; if(m==='rightNpc') return c.rightNpc; if(m==='rejectRight') return c.reject; if(m==='deadline') return c.promise; return c.done; }
function leadLevel(rule){ const v=metricValue(rule); const hi=(rule&&rule.hi)!=null?rule.hi:11, mid=(rule&&rule.mid)!=null?rule.mid:8; if(rule&&rule.metric==='deadline'){ if(v===0&&S.counts.done>=Math.max(1,Math.min(8,Math.round(D.cards.filter(c=>!c.pre&&c.scored!==false).length*0.7)))) return 'hi'; if(v>=1) return 'mid'; return 'low'; } if(rule&&rule.metric==='rightNpc'){ return v>=hi?'hi':v>=mid?'mid':'low'; } return v>=hi?'hi':v>=mid?'mid':'low'; }
/* 저장용 카드 기록 — 57차 E1(spec D28 · §3-6): **값이 있는 필드만** 싣는다(false·null·빈 문자열을 쓰지 않는다 — 7일 저장본이 GAS 상한 45,000자에 닿았다).
   읽는 쪽은 없는 필드를 기본값으로 본다: 분기 trigger(branchTriggerMet)는 !! 로, 7화 과거 위반(pastHit)은 값이 있는 조건만 쓴다.
   status 는 도착하지 않은 카드('skipped')만 적는다(끝낸 카드는 늘 done) · AI 첨삭은 ai:1 · 빠진 필수 값은 miss(AI 첨삭이어도 — trigger 용) ·
   쓴 글(text·text2)·고른 행동(act·choice)·결과값(answer)은 그대로 둔다 — 저장본만으로 자소서용 기록을 다시 읽는다(U8) */
function cardRecord(s){ const o={act:s.act||'none'};
  if(typeof s.score==='number') o.score=s.score;
  if(s.doneAt!=null) o.at=Math.round(s.doneAt*100)/100;
  if(s.late) o.late=true; if(s.branch) o.branch=s.branch; if(s.choice) o.choice=s.choice;
  for(const k of ['forbidHit','replyBanHit','partial','delivered']) if(s[k]) o[k]=true;
  if(s.workOk!=null) o.workOk=!!s.workOk;
  if(Array.isArray(s.miss)&&s.miss.length) o.miss=s.miss.slice();
  if(s.text) o.text=s.text; if(s.text2) o.text2=s.text2; if(s.answer) o.answer=s.answer;
  if(s.status==='skipped') o.status='skipped';
  if(s.source==='AI 첨삭') o.ai=1; if(typeof s.aiq==='number') o.aiq=s.aiq;
  /* 57차 E2 — 사수 메모를 열어 봄(hint) · 사규집 검색어·열어 본 조항(rb) · 정답이 아닌 처리로 끝냄(off — D12 판정용) */
  if(s.hint) o.hint=1; if(s.rb&&s.rb.length) o.rb=s.rb.slice(); if(s.off) o.off=1;
  if(s.ev) o.ev=s.ev;
  /* 57차 E1 후속(B2) — 서버 서명(sg)과 봉인된 단계 점수(ss). 저장 때 서버가 ev·점수를 이것으로 대조한다(docs/ncs57/E1-api.md §5) */
  if(s.sl&&s.sl.g){ o.sg=s.sl.g; if(s.sl.s) o.ss=s.sl.s; }
  return o; }
/* 0 이 아닌 셈만(저장 크기) */
function nonzero(o){ const out={}; for(const [k,v] of Object.entries(o||{})) if(v) out[k]=v; return out; }
/* 저장할 하루 기록 — 화면(디브리프)에만 쓰는 파생값(팀장 한마디·실수 대사·예고·단서 목록·빈 단서·끝나지 않은 건·그날 신뢰)은 빼고,
   화 데이터로 다시 만들 수 없는 것(카드 기록·셈·분류 결과·역량 증거)만 남긴다. 단서는 P.clues 에 한 벌(7화 채점이 그것을 읽는다) */
function storedDay(r){ const o={at:r.at,level:r.level,counts:nonzero(r.counts),cards:r.cards};
  if(r.mistake) o.mistake=r.mistake; if(r.triage) o.triage=r.triage; if(r.ncs2) o.ncs2=r.ncs2; return o; }
/* P.clues 에 넣는 단서 한 줄 — caseId 는 키라 빼고, 값이 없는 칸은 쓰지 않는다(7화 EP7Grade 는 card·label·note·value 만 읽는다) */
function storedClue(k){ const o={day:k.day,card:k.card,note:k.note}; if(k.value!=null) o.value=k.value; if(k.label) o.label=k.label; return o; }
function buildResult(){ const cards={}; const scoredIds=[]; for(const c of D.cards.concat(S.extra)){ const s=S.cards[c.id]; if(!s) continue; cards[c.id]=cardRecord(s);
    if(c.scored!==false&&!c.followup&&s.arrived&&!c.unscored&&c.axis!=='self') scoredIds.push(c.id); }
  const mainIds=scoredIds.filter(id=>!(CARD(id)||{}).pre);   /* 전날 분기로 끼어든 카드는 「처리 n/전체」 셈에서 뺀다 */
  const done=mainIds.filter(id=>S.cards[id].status==='done'&&S.cards[id].act!=='none').length; S.counts.done=done;
  let mistake=null; const pri=scoredIds.filter(id=>S.mistakes.includes(id)); const pool=(pri.length?pri:scoredIds).slice().sort((a,b)=>(S.cards[a].score??0)-(S.cards[b].score??0)); if(pool.length&&(S.cards[pool[0]].score??0)<100) mistake=pool[0];
  const deb=D.dialog.debrief||{}; const level=leadLevel(deb.leadRule); let lead=(deb.lead&&deb.lead[level])||'';
  /* 「오늘 그만하기」로 끝낸 날 — 셈 기준 한마디(「사규집 열어 봤어요?」 등)는 한 일이 적어서 낮게 나온 것이라 맞지 않는다(57차 E1 후속 · QA Y-4⑥). 팀장 말투에 맞춘 중립 한마디 */
  if(S.quit){ const nm=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장'; const says=((D.dialog&&D.dialog.briefing)||[]).filter(l=>l&&l.who&&(l.who===nm||nm.endsWith(l.who)||l.who.endsWith(nm))).map(l=>l.text).join(' ')+' '+Object.values(deb.lead||{}).join(' ');
    const banmal=says.trim()&&!/요[.?!…]|요\s*$/.test(says); lead=banmal?'오늘은 여기까지네. 못 끝낸 건은 내일 아침에 이어서 보자.':'오늘은 여기까지네요. 못 끝낸 건은 내일 아침에 이어서 봐요.'; }
  let mline=''; if(mistake){ const s=S.cards[mistake]; const ml=deb.mistakeLines&&deb.mistakeLines[mistake]; if(ml&&(typeof ml==='string')) mline=ml; else if(ml&&ml.text&&mistakeWhenMet(ml,CARD(mistake),s,mistake)) mline=ml.text; else { const c=CARD(mistake); mline=s.comment||(c.act&&c.act[s.act]?c.act[s.act][1]:''); } }
  /* 「끝나지 않은 건」 = 도착했는데 손대지 못한 건만(제목) · 오지 않은 업무는 수만(57차 E1 후속 · QA W-2 — 예전에는 안 온 카드 제목을 「끝나지 않은 건」으로 다 보여
     「오늘 다시」 전에 그날 카드 목록이 미리 드러났다) */
  const skipped=D.cards.concat(S.extra).filter(c=>{ const st=S.cards[c.id]; return st&&st.status==='done'&&st.act==='none'&&!c.followup&&c.scored!==false&&!c.unscored&&c.axis!=='self'; }).map(c=>c.subj);
  const notArrived=D.cards.filter(c=>S.cards[c.id]&&S.cards[c.id].status==='skipped'&&!c.followup&&c.scored!==false).length;
  return {team:S.team,ep:S.ep,day:D.day,at:new Date().toISOString(),cards,trust:Object.assign({},S.trust),clues:S.clues.slice(),mistake,mistakeLine:mline,leadLine:lead,level,counts:Object.assign({},S.counts,{done,all:mainIds.length}),nexts:S.nexts.slice(),triage:S.triage?Object.assign({score:S.triage.score,hit:S.triage.hit,total:S.triage.total},S.triage.sg?{sg:S.triage.sg}:{}):null,skipped,notArrived,clueGaps:D.cards.filter(c=>S.cards[c.id]&&S.cards[c.id].clueGap).map(c=>c.subj)}; }
/* 디브리프 「오늘의 실수」 대사의 조건(when) — 57차 E2후속 F9. 예전에는 조건을 보지 않아(`||true`) 그 카드에서 다른 실수를 했거나
   형식에서만 깎였어도 그 대사가 떴다. 데이터의 when 은 사람 말이다(「ac30 에서 거래처에 "면제해 드리겠다"고 썼다면」 · 「카드 8을 메일로 상신했다면」 ·
   「전화에서 ㉠을 골랐다면」 · 「by13 을 받았다면(reply·hold)」 · 「○○ 건이 오늘 가장 낮은 점수일 때」). 읽을 수 있는 꼴만 읽는다:
     ① 「가장 낮은 점수일 때」 → 늘(그 카드가 뽑힌 이유) ② 「(reply·hold)」처럼 행동 키가 적혀 있으면 그 행동 ③ 「메일로 상신」 → 메일로 상신
     ④ 「㉠을 골랐다면」 → 가장 나쁜 선택지(데이터에서 ㉠ 은 늘 최저점 10~20 — 배포본은 선택지 점수를 몰라 받은 점수 30 이하로 본다)
     ⑤ 결재 카드의 「"이상 없음"·"확인했습니다"로 넘겼다」「승인했다」 → 승인 ⑥ 따옴표 속 말 → 쓴 글·고른 선택지에 그 말이 있거나 금지 표현을 밟음
     ⑦ 그 밖 → 그 카드에서 틀린 처리가 있었나(흐름 밖 처리·금지 표현·빠진 값·틀린 결과값·실수 분기·틀린 상대·정답 아닌 보고 선택).
   맞지 않으면 대사 대신 그 카드의 코멘트(학생이 실제로 한 것에 맞는 말)를 쓴다. 손대지 않은 카드는 「처리하지 못했어요」 쪽 */
function mistakeWhenMet(ml,c,s,id){ const w=String((ml&&ml.when)||'').trim(); if(!w||!c||!s) return true;
  if(/가장 낮은 점수일 때/.test(w)) return true;
  if(!s.act||s.act==='none') return false;
  const acts=(w.match(/\(([a-z]+(?:\s*[·,]\s*[a-z]+)*)\)/)||[])[1]; if(acts) return acts.split(/\s*[·,]\s*/).includes(s.act);
  if(/메일로 상신/.test(w)) return s.choice==='mailConfirm';
  if(/[㉠㉡㉢㉣]/.test(w)) return s.score!=null&&s.score<=30;
  if(flowOf(c).includes('approval')&&/"(이상 없음|확인했습니다)"|승인했/.test(w)) return s.act==='approve';
  const q=[...w.matchAll(/"([^"]+)"/g)].map(m=>m[1].replace(/\s/g,'')).filter(x=>x.length>=2);
  if(q.length){ const pool=Object.assign({},c.choices||{},(c.report&&c.report.choices)||{},(c.deliver&&c.deliver.choices)||{});
    const said=String((s.text||'')+(s.text2||'')+(s.choice&&pool[s.choice]?pool[s.choice]:'')).replace(/\s/g,''); if(q.some(x=>said.includes(x))) return true; return !!(s.forbidHit||s.replyBanHit); }
  return !!(s.off||s.forbidHit||s.replyBanHit||s.partial||s.workOk===false||s.choice==='mailConfirm'||s.act==='timeout'||(S.mistakes||[]).includes(id)||s.reportBest===false||(s.tries>0)||(s.act==='approve'&&c.best&&c.best!=='approve')||(s.act==='hold'&&c.best&&c.best!=='hold')); }
/* 누가 한 말인지 색으로 가른다 — 흰 상자만 늘어놓으면 벽으로 읽힌다(대표 확정 스펙 §4) */
function roleHue(who){ const v=npcInfo(who); const r=(v&&v.role)||'';
  if(/팀장/.test(who+r)) return ROLE_HUE['팀장'];
  if(/사수|선임/.test(r)) return ROLE_HUE['사수'];
  if(r==='동기'||who===peerName()) return ROLE_HUE['동기'];
  return '#5b6675'; }
/* ---------- 60차 결과 화면 공용 부품(하루 마무리 · 7일 결과 ep7.js) ----------
   사용자 「내용도 내용인데 가독성도 너무 안좋고 디자인도 너무 이상해」(2026-09-28). 한 단 읽기 · 상자 대신 간격 · 막대는 회색 + 강조색 하나 ·
   범례 대신 막대 끝 라벨 · 영역은 점수 순 가로 막대. 모양은 play.html 「60차 결과 화면」 CSS(.rs) */
/* 글꼴 Pretendard(OFL) — 결과 화면을 열 때만 받는다(jsdelivr · SRI). 못 받으면 시스템 글꼴 그대로 */
const RS_FONT={href:'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css',sri:'sha384-uR1wgObmx89ZQ4VVXHdzjbDJZ1PvBK01K+E3GebmaBKdZ87qRJvBWPoPbzWeEd5T'};
function rsFont(){ try{ if(document.getElementById('rsFont')) return; const l=document.createElement('link'); l.id='rsFont'; l.rel='stylesheet'; l.href=RS_FONT.href; l.integrity=RS_FONT.sri; l.crossOrigin='anonymous'; l.referrerPolicy='no-referrer'; document.head.appendChild(l); }catch(e){} }
/* 절 하나 — h2(+ 작은 부제). 돌려준 section 에 내용을 붙인다 */
function rsSec(host,title,sub){ const s=h('section','rsSec'); const t=h('h2',null,title); if(sub) t.appendChild(h('small',null,sub)); s.appendChild(t); host.appendChild(s); return s; }
/* 가로 막대 — rows: {name, S(0~100|null), level, note(막대 없을 때), mark(강조 라벨)} · mark 가 있는 줄만 강조색, 나머지는 회색 */
function rsBars(rows){ const wrap=h('div','ncs rsBars');
  for(const r of rows){ const row=h('div','ncsRow'+(r.S==null?' nob':'')+(r.mark?' hi':'')); row.appendChild(h('span','nm',r.name)); const bw=h('div','bw');
    if(r.S!=null){ const bar=h('i','bar'); bar.style.setProperty('--s',String(Math.max(0,Math.min(100,r.S)))); bw.appendChild(bar);
      const lab=h('span','lab'); lab.appendChild(h('b',null,String(r.S))); if(r.level){ lab.appendChild(document.createTextNode(' ')); lab.appendChild(h('span','lvl',r.level)); }
      if(r.mark){ lab.appendChild(document.createTextNode(' ')); lab.appendChild(h('span','mk',r.mark)); } bw.appendChild(lab); }
    else bw.appendChild(h('span','nt',r.note||''));
    row.appendChild(bw); wrap.appendChild(row); }
  return wrap; }
/* 점수 순(막대 있는 줄 먼저 · 같으면 원래 순서) */
const rsRank=(rows)=>rows.map((r,i)=>Object.assign({i},r)).sort((x,y)=>(y.S!=null)-(x.S!=null)||(y.S||0)-(x.S||0)||x.i-y.i);
/* 이름표 줄 — items: [이름표, 내용(글 또는 노드), 'bad'?] */
function rsDl(items){ const dl=h('dl','rsDl'); for(const [k,v,cls] of items){ dl.appendChild(h('dt',cls||null,k)); const dd=h('dd',cls||null); if(v instanceof Node) dd.appendChild(v); else dd.textContent=String(v); dl.appendChild(dd); } return dl; }
/* 「하위능력 이름(굵게) 문장」 + 아래 회색 한 줄(근거 업무) */
function rsLine(name,text,src){ const f=document.createDocumentFragment(); if(name){ f.appendChild(h('b',null,name)); f.appendChild(document.createTextNode(' ')); } f.appendChild(document.createTextNode(text||'')); if(src) f.appendChild(h('span','src',src)); return f; }
/* 표 — cols: [머리 | {t, num, w}] · rows: [칸…] 또는 {cls, cells:[칸…]} (칸 = 글 | {t, cls, span}) */
function rsTable(cols,rows){ const t=h('table','rsTbl');
  if(cols.some(c=>c&&c.w)){ t.classList.add('fixed'); const cg=document.createElement('colgroup'); for(const c of cols){ const col=document.createElement('col'); if(c&&c.w) col.style.width=c.w; cg.appendChild(col); } t.appendChild(cg); }   /* 칸 폭(w)을 주면 고정 폭 — 긴 글 칸이 옆 칸을 밀어내지 않게 */
  const hd=t.createTHead().insertRow();
  for(const c of cols){ const o=typeof c==='string'?{t:c}:c; hd.appendChild(h('th',o.num?'num':null,o.t)); }
  const bd=t.createTBody();
  for(const r of rows){ const R=Array.isArray(r)?{cells:r}:r; const tr=bd.insertRow(); if(R.cls) tr.className=R.cls;
    R.cells.forEach((c,i)=>{ const o=(c&&typeof c==='object'&&!(c instanceof Node))?c:{t:c}; const col=cols[i]; const num=col&&typeof col==='object'&&col.num;
      const td=h('td',[num?'num':'',o.cls||''].filter(Boolean).join(' ')||null); if(o.t instanceof Node) td.appendChild(o.t); else td.textContent=o.t==null?'':String(o.t); if(o.span) td.colSpan=o.span; tr.appendChild(td); }); }
  const w=h('div','rsTblWrap'); w.appendChild(t); return w; }
/* 접기 — 요약 줄(+ 작은 설명) · 돌려준 .in 에 내용을 붙인다 */
function rsFold(host,title,small){ const d=document.createElement('details'); d.className='rsFold'; const s=h('summary',null,title); if(small){ s.appendChild(h('small',null,small)); } d.appendChild(s); const inn=h('div','in'); d.appendChild(inn); host.appendChild(d); return inn; }
/* 대사 한 줄 — 말한 사람 · 말. 메신저로 온 말(cls 'msg')은 이름 아래 「메신저」 */
function sayRow(host,who,text,cls){ if(!text) return; const d=h('div','rsSay'); const w2=h('div','who',who); if(cls==='msg') w2.appendChild(h('small',null,'메신저'));
  d.appendChild(w2); d.appendChild(h('div','tx',fillName(text))); host.appendChild(d); }
/* 하루 마무리(1~6일차) — 제목 → 팀장 한마디 → 오늘 드러난 역량(막대 · 잘한 점 · 다음엔) → 오늘 한 일(숫자 · 업무 표) → 오늘의 실수 → 들은 말 → 내일로 이어지는 것 → 단추 */
function renderDebrief(r){ rsFont(); const w=$('dbWrap'); w.innerHTML=''; w.className='wrap rs';
  const hd=h('header','rsHead'); hd.appendChild(h('h1',null,`${D.ep}일차 「${D.title}」 끝`)); hd.appendChild(h('p','rsMeta',`${D.teamName} · ${fmtClock(D.minutes)} 퇴근`)); w.appendChild(hd);
  const lead=(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장'; const t0=h('div','rsTalk'); sayRow(t0,lead,r.leadLine); if(t0.childNodes.length) w.appendChild(t0);
  const s1=rsSec(w,'오늘 드러난 역량','NCS 직업공통능력'); ncsDaily(s1);
  const s2=rsSec(w,'오늘 한 일');
  const items=[['처리',`${r.counts.done}/${r.counts.all}`],['넘김',r.counts.pass],['물어봄',r.counts.ask]]; if(r.counts.cite) items.push(['조항 인용',r.counts.cite]); if(r.counts.calcAll) items.push(['계산 정확',`${r.counts.calc}/${r.counts.calcAll}`]); if(r.counts.rightNpc||r.counts.wrongNpc) items.push(['맞는 상대',`${r.counts.rightNpc}/${r.counts.rightNpc+r.counts.wrongNpc}`]); if(r.counts.rejectAll) items.push(['거절·상신',`${r.counts.reject}/${r.counts.rejectAll}`]); if(r.triage) items.push(['분류 맞음',`${r.triage.hit}/${r.triage.total}`]); if(r.counts.follow) items.push(['재문의',r.counts.follow]); if(r.counts.askNeed) items.push(['직접 물어 얻은 답',`${r.counts.askHit||0}/${r.counts.askNeed}`]);
  const st=h('div','rsStats'); for(const [n,v] of items){ const d=h('div'); d.appendChild(h('span',null,n)); d.appendChild(h('b',null,String(v))); st.appendChild(d); } s2.appendChild(st);
  /* 업무 · 처리 · 점수 — 처리는 글자로(못 한 것은 빨강 · 늦은 것은 주황), 점수는 오른쪽 정렬 */
  const rows=[]; for(const c of D.cards){ const s=S.cards[c.id]; if(!s||c.scored===false&&c.mode==='story'||s.status==='skipped') continue;
    const scored=s.score!=null; let label=scored?actLabel(s.act):(c.unscored||c.axis==='self'?(s.text?'기록함':'기록 없음'):'-');
    if(scored&&s.late&&s.act!=='none') label+=' · 늦음';
    const k=chipKind(s,label); const stc='st'+(k==='k-none'?' bad':k==='k-late'?' warn':'');
    const vc=scored?(s.score===0?'bad':s.score<60?'warn':''):''; rows.push([c.subj,{t:label,cls:stc},{t:scored?String(s.score):'',cls:vc}]); }
  if(rows.length) s2.appendChild(rsTable([{t:'업무',w:'64%'},{t:'처리',w:'24%'},{t:'점수',num:true,w:'12%'}],rows));
  const nt=[]; if(r.skipped.length) nt.push(['끝나지 않은 건',r.skipped.join(', ')]); if(r.notArrived) nt.push(['오지 않은 업무',`${r.notArrived}건${S.quit?'(중간에 끝내 받지 못했어요)':''}`]); if(nt.length) s2.appendChild(rsDl(nt));
  const s3=rsSec(w,'오늘의 실수');
  if(r.mistake){ const c=CARD(r.mistake); s3.appendChild(h('p','rsLeadIn',c.subj)); const ml=(D.dialog.debrief.mistakeLines||{})[r.mistake]; const who=(ml&&ml.who)||(D.dests.find(x=>x.seat==='senior')||{}).name||'사수'; const tk=h('div','rsTalk'); sayRow(tk,who,r.mistakeLine); if(tk.childNodes.length) s3.appendChild(tk); }
  else s3.appendChild(h('p',null,'눈에 띄는 실수가 없었어요. 드문 일이에요.'));
  const tk=h('div','rsTalk'); const senior=(D.dests.find(x=>x.seat==='senior')||{}).name||'사수'; sayRow(tk,senior,D.dialog.debrief.senior);
  const saidEx=new Set(); for(const ex of (D.dialog.debrief.extra||[])){ if(extraCondMet(ex)){ sayRow(tk,ex.who,ex.text,ex.msg?'msg':''); saidEx.add(ex.who+'\n'+ex.text); } }
  /* 같은 사람이 추가 대사로 방금 한 말은 동기 대사로 다시 하지 않는다(57차 E1 후속 2 — buy 6일차: 단서가 달린 추가 대사와 동기 대사가 같은 말이라 두 번 떴다) */
  if(!saidEx.has(peerName()+'\n'+D.dialog.debrief.peer)) sayRow(tk,peerName(),D.dialog.debrief.peer,'msg');
  if(tk.childNodes.length) rsSec(w,'오늘 들은 말').appendChild(tk);
  const nx=[]; if(r.nexts.length){
    /* 겹치는 예고를 걷어낸다. 글자가 똑같은 것만 걸러서는 부족했다 — 「물류팀 오대리가 이름을 기억한다 · 다시 가면 "또 오셨네요"」와
       「그 자리에 다시 가면 "또 오셨네요"」처럼 한쪽이 다른 쪽에 통째로 담긴 경우가 남아 같은 말이 두 번 떴다. 짧은 쪽을 버리고 긴 쪽만 남긴다. */
    const norm=(s)=>String(s||'').replace(/[\s"'"「」·—-]/g,'');
    const named=(s)=>/(팀|님|과장|차장|부장|대리|주임|선임)/.test(s);   /* 사람·팀을 짚었으면 구체적인 줄이다 */
    const tail=(a,b)=>{ let i=0; while(i<a.length&&i<b.length&&a[a.length-1-i]===b[b.length-1-i]) i++; return i; };
    const its=[]; for(const n of r.nexts){ const k=norm(n.text); if(!k) continue;
      /* ① 한쪽이 다른 쪽에 통째로 담겼거나 ② 결과 문구를 12자 넘게 공유하는데 한쪽만 사람·팀을 짚었으면 같은 예고로 본다 */
      const dup=its.findIndex(x=> x.k.includes(k)||k.includes(x.k)
        || (tail(x.k,k)>=12 && named(x.text)!==named(n.text)) );
      if(dup<0){ its.push({k,text:n.text}); continue; }
      if(named(n.text)&&!named(its[dup].text)) its[dup]={k,text:n.text};
      else if(named(n.text)===named(its[dup].text)&&k.length>its[dup].k.length) its[dup]={k,text:n.text}; }
    for(const it of its) nx.push(it.text); }
  const tr=Object.entries(r.trust); const dl=[]; if(tr.length) dl.push(['신뢰',tr.map(([n,v])=>`${n} ${v>0?'+':''}${v}`).join(', ')]);
  if(r.clues.length) dl.push(['모은 단서',r.clues.map(k=>k.note).join(' / ')]);
  if(r.clueGaps.length) dl.push(['빈 단서',`${r.clueGaps.join(', ')} (7일차 취합표에서 빈 칸이 돼요)`,'bad']);
  if(nx.length||dl.length||D.dialog.debrief.nextEp){ const s5=rsSec(w,'내일로 이어지는 것');
    if(nx.length){ const ul=h('ul','rsList'); for(const t of nx) ul.appendChild(h('li',null,t)); s5.appendChild(ul); }
    if(dl.length) s5.appendChild(rsDl(dl));
    if(D.dialog.debrief.nextEp) s5.appendChild(h('p','rsNote',D.dialog.debrief.nextEp)); }
  const ft=h('div','foot'); if(S.ep<7) ft.appendChild(mkBtn(`${S.ep+1}일차로`,'pri',()=>goDay(S.team,S.ep+1))); ft.appendChild(mkBtn('홈으로','',()=>goHome(false))); ft.appendChild(mkBtn('오늘 다시','',()=>{ delete P.done[String(S.ep)]; P.cur=null; P.day=S.ep; saveProgress(true); goDay(S.team,S.ep); }));   /* F13: 서버도 그날로 낮춘다(ws7ProgNext) — 클라이언트 P.day 를 같게 */ ft.appendChild(mkBtn('사무실 보기','',()=>$('debrief').classList.remove('open'))); w.appendChild(ft); }
function peerName(){const self=WorkSimRoster.player(S.team,P?.avatar||avatarPref()||'m');const peer=WorkSimRoster.team(S.team).find(c=>c.player_selectable&&c.model_id!==self.model_id);if(peer)return peer.display_name; const m=(D.dialog.briefing||[]).find(l=>l.role==='동기'); if(m) return m.who; const org=ORG[S.team]; return org?({cs:'윤하린',logi:'정수빈',acct:'임도윤',ga:'백하은',rec:'송민재',plan:'안예린',qc:'유하늘',pr:'곽민서',edu:'차은우',buy:'하지원'}[S.team]||'동기'):'동기'; }
/* 「무엇을 했나」를 한 낱말로 갈라 칩 색을 정한다 */
function chipKind(st,label){ if(st.act==='none'||label==='미처리'||label==='기록 없음') return 'k-none';
  if(st.late) return 'k-late';
  if(['delegate','deliver','hold'].includes(st.act)) return 'k-pass';
  if(['ask','confirm'].includes(st.act)) return 'k-ask';
  return 'k-done'; }
/* 막대·목록 아래에 붙는 딸림 줄. 이름표를 굵게 앞세우고 위에 선을 그어 본문과 끊는다 */
/* ---------- 57차 E1 — 역량 화면(NCS 직업공통능력 2025.12 · spec §2-10) ----------
   계산은 js/ncs_eval.js(NcsEval) 한 곳 — 여기서는 그리기만 한다. 60차: 막대는 점수 순 · 회색 하나 + 「잘한 점」 영역만 강조색(영역 고유색은 쓰지 않는다).
   수준 이름(초보·준비·적응·숙련)은 일일 화면에 내지 않는다 — 하루치 근거로는 얇다(§2-10). 화면 문장에 내부 용어(항목 id·요소 코드·행동 키)를 쓰지 않는다 */
const ncsReady=()=>typeof NcsEval!=='undefined'&&typeof NCS!=='undefined'&&!!NCS&&!!NCS.areas;
/* 디브리프 「오늘 드러난 역량」 — 그날 영역 막대(실효 가중 ≥ 2 또는 하루 집계가 있는 영역만) · 잘한 점 1줄 · 다음엔 1줄 · 하위능력 보기(접기)
   다음엔(60차): 앞선 날에 보인 문장은 되풀이하지 않는다 — NcsEval.dailySeen 이 저장본으로 앞날의 선택을 다시 돌려 키를 넘긴다 */
function ncsDaily(box){ if(!ncsReady()) return; const rec=P&&P.done&&P.done[String(S.ep)];
  if(!rec||!rec.ncs2){ box.appendChild(h('p','rsNote','이 날은 역량 기록이 없어요.')); return; }
  const list=NcsEval.fromProgress({team:S.team,done:{[String(S.ep)]:rec}}).list;
  let seen=[]; try{ if(typeof NcsEval.dailySeen==='function') seen=NcsEval.dailySeen(P,S.ep,{team:S.team}); }catch(e){ seen=[]; }
  const dy=NcsEval.daily(list,S.ep,{tips:S.evTip||{},exclude:[rec.mistake].concat(S.mistakes||[]).filter(Boolean),seen});
  const strongArea=dy.strong&&NCS.subs[dy.strong.sub]?NCS.subs[dy.strong.sub].area:null;
  box.appendChild(rsBars(rsRank(dy.areas.map(a=>({name:a.name,S:a.show?a.S:null,note:a.n?`오늘 관찰 ${a.n}건`:'관찰 없음',mark:a.show&&a.id===strongArea?'잘한 점':''})))));
  const title=(id)=>{ const c=id&&CARD(id); return c?`「${c.subj}」`:''; };
  const it=[]; if(dy.strong) it.push(['잘한 점',rsLine(NCS.subs[dy.strong.sub].name,dy.strong.text,title(dy.strong.card))]);
  if(dy.weak) it.push(['다음엔',rsLine(NCS.subs[dy.weak.sub].name,dy.weak.tip,title(dy.weak.card))]);
  if(it.length) box.appendChild(rsDl(it));
  const subs=Object.keys(dy.subs).sort(); if(subs.length){ const inn=rsFold(box,'하위능력 보기'); inn.appendChild(rsTable(['하위능력',{t:'관찰',num:true},{t:'잘함',num:true}],subs.map(c=>[NCS.subs[c].name,String(dy.subs[c].n),String(dy.subs[c].ok)]))); }
  if(rec.ncs2.part) box.appendChild(h('p','rsNote','이 날은 역량 기록이 일부만 남아, 남은 기록으로 막대를 그렸어요.'));
  if(rec.ncs2.quit) box.appendChild(h('p','rsNote','중간에 끝낸 날이라 오지 않은 업무도 제때 처리한 비율에 들어가요.')); }
/* ---------- 일시정지 · 모바일 ---------- */
/* 일시정지는 메뉴다 — 「오늘 그만하기」를 이 안에 넣어 눈에 띄지 않게 둔다 */
function setPaused(on){ S.paused=!!on; $('pause').classList.toggle('on',S.paused); $('pause').textContent=S.paused?'계속하기':'일시정지';
  const O=office(); if(O){ try{ O.freeze(S.paused); }catch(e){} } }
function pauseMenu(on){ $('pauseMenu').hidden=!on; $('pause').setAttribute('aria-expanded',String(!!on)); }
$('pause').onclick=(ev)=>{ ev.stopPropagation(); if($('pauseMenu').hidden){ setPaused(true); pauseMenu(true); toast('일시정지. 시계와 사무실이 멈췄어요.'); } else { pauseMenu(false); setPaused(false); } };
$('pmResume').onclick=()=>{ pauseMenu(false); setPaused(false); };
/* 대표 "성별 어떻게 골라?" — 홈 화면과 이 메뉴에서 언제든 바꾼다 */
$('pmAvatar').onclick=async()=>{ pauseMenu(false); const g=await askAvatar(true); setPaused(false); if(g) await changeAvatar(g); };
/* 고른 성별을 지금 화면에 반영한다. 3D 가 갈아 끼우기를 지원하면 그것으로, 아니면 무대를 다시 세운다. */
async function changeAvatar(g){ if(!P||P.avatar===g) return; P.avatar=g; setAvatarPref(g); saveProgress(true);
  const me=playerChar(g); const O=office();
  if(O&&typeof O.setPlayerChar==='function'){ try{ O.setPlayerChar(me); toast('캐릭터를 바꿨어요.'); return; }catch(e){} }
  if(NO_STAGE){ toast('캐릭터를 바꿨어요.'); return; }
  $('loading').classList.remove('off'); await stageUp(); $('loading').classList.add('off'); toast('캐릭터를 바꿨어요.'); }
$('pmQuit').onclick=()=>{ const left=D?D.cards.concat(S.extra).filter(c=>{ const st=S.cards[c.id]; return st&&st.status!=='done'; }).length:0;
  if(!confirm(`남은 업무 ${left}건은 미처리로 기록됩니다. 그만할까요?`)) return;
  pauseMenu(false); setPaused(false); S.quit=true; finish(); };
document.addEventListener('click',(ev)=>{ if($('pauseMenu').hidden) return; if($('pauseWrap').contains(ev.target)) return; pauseMenu(false); setPaused(false); });
$('inboxHd').onclick=()=>{ if(window.innerWidth<=760) $('inbox').classList.toggle('up'); };
/* 홈(소개 페이지)으로 나가는 길은 한 곳에서만 만든다 — 화면마다 문구와 동작이
   달라지지 않게. 하루 도중이면 물어보고, 저장이 실제로 끝난 뒤에 옮긴다. */
async function goHome(ask){
  const mid=(S.phase==='work'||S.phase==='triage'||S.phase==='ep7');
  if(ask&&mid&&!confirm('진행은 저장됩니다. 홈으로 나갈까요?')) return;
  if(mid){ try{ saveProgress(true); }catch(e){}
    setStatus('저장하는 중…');
    const B=window.Backend;
    if(B&&typeof B.flush==='function'){ try{ await withTimeout(Promise.resolve(B.flush()),6000); }catch(e){} }
    else await sleep(250); }
  location.href='home.html';
}
$('homeBtn').onclick=()=>goHome(true);
const pcHomeBtn=$('pcHome'); if(pcHomeBtn) pcHomeBtn.onclick=()=>goHome(true);
$('loadBack').onclick=()=>goHome(false);
$('cClose').onclick=closeCard;
(async()=>{ try{ await (window.__backendReady||Promise.resolve()); }catch(e){} if(window.Backend&&typeof window.Backend.configure==='function'&&Q.get('api')){ try{ window.Backend.configure(Q.get('api')); }catch(e){} }
  if(Q.get('home')==='1'){ const c=(Q.get('code')||'').trim(); if(c){ S.code=c.toUpperCase(); try{ localStorage.setItem('ws7.code',S.code); }catch(e){} } showHome(); } else boot(); })();

/* ---------- 스모크·자동 플레이용 ----------
   조작 API(자동 플레이·카드 처리·시계 넘기기·하루 끝내기)는 로컬(localhost·127.0.0.1·[::1]·파일)에서만, 또는 토큰 모드가 아닐 때 ?qa=1 로만 만든다(57차 E2-15 · A Y6).
   57차 E2후속(B3): 예전에는 ?qa=1 만 붙이면 어디서든 열렸다 — 배포본(토큰 모드)에서 주소에 qa=1 을 붙여 __play.act·skip 을 쓸 수 있었다.
   토큰 모드 = core.js Q 와 같은 조건(배포본 WS7_GATED · 주소 ?code= · 이 기기에 저장된 코드로 들어옴(?team= 없음)) — 그때는 ?qa=1 을 보지 않는다.
   검사 도구(gate_smoke 배포본 흉내)는 127.0.0.1 에서 돌므로 로컬 판정으로 열린다(qa=1 에 기대지 않는다).
   배포본에는 바탕화면 아이콘 잠금(js/desk/deskapp.js)이 읽는 오늘 열린 도구 목록만 남긴다 — 화 데이터 자체도 내주지 않는다 */
const QA_API=(()=>{ try{ const hn=location.hostname; if(location.protocol==='file:'||hn==='localhost'||hn==='127.0.0.1'||hn==='[::1]'||hn==='') return true;
  const q=new URLSearchParams(location.search); if(q.get('qa')!=='1') return false;
  let token=!!window.WS7_GATED||!!(q.get('code')||'').trim(); if(!token){ try{ token=!!localStorage.getItem('ws7.code')&&!q.get('team'); }catch(e){} }
  return !token; }catch(e){ return false; } })();
if(!QA_API) window.__play={ get ready(){ return !!window.__playReady; }, data:()=>D?{unlock:(D.unlock||[]).slice(),kind:D.kind}:null };   /* 하루를 불러오기 전에는 null — 예전 __play.data() 와 같게(deskapp 이 그때는 잠그지 않는다) */
else window.__play={ qa:true, get ready(){ return !!window.__playReady; }, state:()=>({t:S.t,clock:fmtClock(S.t),phase:S.phase,ended:S.ended,paused:S.paused,ep:S.ep,team:S.team,cards:JSON.parse(JSON.stringify(S.cards)),ev:Object.fromEntries(Object.entries(S.cards).filter(([,x])=>x&&x.ev).map(([k,x])=>[k,x.ev])),trust:S.trust,counts:S.counts,nexts:S.nexts,mistakes:S.mistakes,order:S.order,clues:S.clues,triage:S.triage}),
  skip:(min)=>{ if(S.phase==='briefing') endBriefing(); advance(+min||0); return fmtClock(S.t); }, skipNext:()=>skipNext(), skipBlock:()=>skipBlock(), skipBriefing:()=>{ if(S.phase==='briefing') endBriefing(); }, open:(id)=>openCard(id), office, finish, data:()=>D, progress:()=>P, save:()=>P&&P.done[String(S.ep)], triage:async(assign)=>{ if(!S.triage) return null; Object.assign(S.triage.assign,assign); await finishTriage(); return S.triage; },
  async act(id,key,p={}){ const c=CARD(id); if(!c) throw new Error('없는 카드: '+id); if(!S.cards[id].arrived) throw new Error('아직 도착 안 함: '+id); openCard(id);
    if(key==='reply'||key==='reply2'||key==='reject'||key==='confirm'){ if(c.mode==='reflect'){ await doPick(id,p.id); return S.cards[id]; } openComposer(id,key==='reply2'?'reply2':'reply',key==='reply2'?'reply':key); $('composeText').value=p.text||''; $('composeText').dispatchEvent(new Event('input')); await sendCompose(id,p.text||'',key==='reply2'?'reply2':'reply',key==='reply2'?'reply':key,p.answer!=null?String(p.answer):null); return S.cards[id]; }
    if(key==='approval'){ openComposer(id,'approval'); await sendCompose(id,p.text||'',"approval",'reject',p.answer!=null?String(p.answer):null); return S.cards[id]; }
    if(key==='approve'){ await doApprove(id); return S.cards[id]; }
    if(key==='work'){ await doWork(id,(p.answer&&typeof p.answer==='object')?p.answer:String(p.answer)); return S.cards[id]; }
    if(key==='sheetDeliver'){ await doSheetDeliver(id,p.auto); return S.cards[id]; }
    if(c.mode==='phone'&&c.act[key]){ await doPhone(id,key); return S.cards[id]; }
    if(key==='deliver'){ const d=D.dests.find(x=>x.name===p.to||x.seat===p.to||x.key===p.to)||{name:p.to,seat:seatByName(p.to),key:(npcInfo(p.to)||{}).teamKey,team:(npcInfo(p.to)||{}).team}; await doDeliver(id,d,p.auto); return S.cards[id]; }
    if(key==='ask'){ const d=D.dests.find(x=>x.name===p.to||x.seat===p.to||x.key===p.to)||{name:p.to,seat:seatByName(p.to),key:(npcInfo(p.to)||{}).teamKey,team:(npcInfo(p.to)||{}).team}; await doAsk(id,d,p.q==null?0:p.q); return S.cards[id]; }
    if(key==='report'){ await doReport(id,p.auto); return S.cards[id]; }
    if(key==='visit'){ await doVisit(id,p.auto); return S.cards[id]; }
    if(key==='pick'){ await doPick(id,p.id); return S.cards[id]; }
    if(key==='lookup'){ S.cards[id].lookup=true; renderCardActs(id); return S.cards[id]; }
    await doButton(id,key); return S.cards[id]; } };
