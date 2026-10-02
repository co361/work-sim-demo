/* ======================================================================
   WORK SIM 7일차 1인용 직무 게임 — 엔진 v2 · 공통부 (docs/plan-play-v2.md W1)
   순서: core.js → grade.js → cards.js → day.js → ep7.js → auto.js (모듈 아님, 전역 공유)
   ====================================================================== */
/* 주소 인자. 57차 Y6 — 토큰 모드에서는 검사·시연용 인자 ?speed=(시계 배속)·?api=(백엔드 주소)·?fresh=1(이어 하기 무시)를 없는 것으로 읽는다.
   토큰 모드 = 배포본(js/gated.js 의 WS7_GATED) · 주소에 ?code= · 이 기기에 저장된 코드로 들어옴(day.js boot 과 같은 조건: ?team= 없음) · 들어온 뒤 S.code(데모 아님).
   읽는 곳(아래 SPEED · day.js ?api=·?fresh= · ep7.js ?fresh=)은 그대로 두고 여기 한 곳에서 막는다 — 학생이 주소창을 고쳐
   시계를 늦추거나(시간관리 점수) 채점 서버를 바꾸거나 기록 없이 하루를 처음부터 다시 하지 못하게. 토큰 없는 로컬(개발·검사·시연)은 그대로다 */
const Q=(()=>{ const q=new URLSearchParams(location.search); const get=q.get.bind(q), has=q.has.bind(q); const TEST_ARGS=['speed','api','fresh'];
  const tokenMode=()=>{ if(window.WS7_GATED) return true; if((get('code')||'').trim()) return true;
    try{ if(localStorage.getItem('ws7.code')&&!get('team')) return true; }catch(e){}
    const s=window.S; return !!(s&&s.code&&!s.demo); };
  q.get=(k)=>(TEST_ARGS.includes(k)&&tokenMode())?null:get(k);
  q.has=(k)=>(TEST_ARGS.includes(k)&&tokenMode())?false:has(k);
  return q; })();
const $=(id)=>document.getElementById(id);
/* 57차 E1 — 옛 NCS 직업기초능력 10축(AXES·CIRC·NCS_NAMES·NCS_HUE·S.ncs)은 걷었다. 역량은 NCS 직업공통능력 2025.12(7영역·21하위·63요소) —
   이름·코드·영역 색은 js/ncs.js(NCS 레지스트리), 계산은 js/ncs_eval.js(NcsEval), 증거는 채점 결과의 ev(grade.js Ev). 영역 색도 막대·점·칩에만 쓴다 */
/* 섹션 색 머리 · 화자 색 — 같은 표를 두 곳에 적지 않으려고 여기 모아 둔다 */
const BOX_HUE={summary:'#2563a8',ncs:'#7a3fa8',mistake:'#b3261e',next:'#1b7a3e',gap:'#b4530a'};
const ROLE_HUE={팀장:'#b4530a',사수:'#2563a8',동기:'#0f7b6c'};
const TEAM_NAMES={cs:'고객상담팀',logi:'물류팀',acct:'회계팀',ga:'총무팀',rec:'채용팀',plan:'경영기획팀',qc:'품질관리팀',pr:'홍보팀',edu:'교육팀',buy:'구매팀'};
const TEAM_ORDER=['cs','logi','acct','ga','rec','plan','qc','pr','edu','buy'];
/* 조직도(집필 지침 §5 명부): 팀장·사수·주임 + more(늘 조직도에 있는 조력자 — 57차 E2후속 F8).
   more 는 화 데이터에서 전달·질문의 정답 상대로 나오는 조직도 밖 사람이다(명부 tools/story_extract.py HELPERS · qc 검사대 조반장).
   예전에는 그 사람이 나오는 날에만 목록(cards.js orgTeams — 비 3D 전달·질문·메신저)의 그 팀 줄 끝에 붙어 그날의 정답 상대가 튀었다(cs 4화 유대리·감주임, qc 3화 조반장).
   🔴 새 조력자를 정답 상대로 쓰면 여기 more 에도 넣는다(안 넣으면 그날만 줄 끝에 붙는다 — 닿기는 한다) */
const ORG=Object.fromEntries(TEAM_ORDER.map(t=>[t,({...Object.fromEntries(WorkSimRoster.team(t).map(c=>[c.seat_id,c.display_name])),more:WorkSimRoster.team(t).filter(c=>c.player_selectable).map(c=>c.display_name)})]));
const UNLOCK_LABEL={rulebook:'사규집',approval:'결재 검토',orgchart:'조직도',report:'대면 보고',decide:'결정'};
const UNLOCK_DAY={rulebook:2,approval:3,orgchart:4,report:5,decide:7};
const DAY_TITLES={1:'첫 출근',2:'사규집',3:'숫자',4:'옆 팀',5:'거절',6:'위기',7:'결정'};
const SPEED=Math.max(0.1,+(Q.get('speed')||1));
/* 게임 1분 = 실시간 80초/speed → 하루 30분이 실시간 40분이다(소개 페이지 「하루 40분씩」과 같다).
   38차 12초(=6분) → 22초(=11분) → 45차 80초. 대표 「하루 플레이타임을 늘리는게 좋을 것 같아」 —
   시나리오 검토(docs/review-scenario-playtime-45.md): 보통 학생이 22초에서는 하루 업무의 32%, 80초에서는 99%를 끝낸다.
   `?speed=` 로 조절하는 구조는 그대로다(검사·시연은 ?speed=N — 토큰 모드에서는 무시, 57차 Y6 · 위 Q). 자동 플레이(auto.js)는 advance(게임 분)로 건너뛰므로 이 값과 무관하다.
   실제 초로 적힌 것(방문·전화 응답 제한 timeLimit, 알림 표시 시간)은 게임 분이 아니라 반응 시간이라 그대로 둔다. */
const SEC_PER_MIN=80/SPEED;
const NO_STAGE=Q.get('stage')==='0';             /* 3D 사무실 없이(저사양·검사용) — 이동 연출은 글로 대신한다 */
const ACT_LABELS_DEFAULT={reply:'회신',hold:'보류',delegate:'전달',confirm:'상신',reject:'거절',approve:'승인',verify:'본인 확인',mail:'메일로 안내',tell:'바로 알려 줌',deliver:'직접 전달',ask:'직접 질문',report:'보고',visit:'응대',work:'검산',none:'미처리',pick:'선택',stopShip:'출고 중지',timeout:'무응답',accept:'접수·보고',dismiss:'돌려보냄',refund:'즉시 환불',notify:'접수·회신 시점 안내',promise:'시한 약속',refuse:'규정상 불가'};

/* ---------- 상태 ---------- */
let D=null;                                  /* 오늘 화 데이터 */
let P=null;                                  /* 진행(7일) */
const S={ team:'cs', ep:1, code:null, name:'', demo:true, phase:'home', t:0, running:false, paused:false, ended:false,
  cards:{}, order:[], extra:[], trust:{}, nexts:[], mistakes:[], counts:{done:0,pass:0,ask:0,follow:0,wrongNpc:0,rightNpc:0,promise:0,cite:0,calc:0,calcAll:0,reject:0,rejectAll:0}, cur:null, composing:null, briefI:0, triage:null, clues:[], visitTimer:null,
  /* 57차 E1 — 역량 증거: evTip(카드.항목 → 코칭 문장, 저장 안 함) · evPart(서버가 증거를 안 준 채점이 있었음 → 그날 ncs2.part) · quit(「오늘 그만하기」) · finishP(하루 마감 한 번) */
  evTip:{}, evPart:0, quit:false, finishP:null };
const CARD=(id)=>(D&&D.cards.find(c=>c.id===id))||S.extra.find(c=>c.id===id);
/* ---------- 표시 시각 ----------
   내부 타임라인은 그대로 0~30분이다(카드 arrive·마감·채점 전부 이 분을 쓴다).
   화면에 적는 시각만 하루 전체로 편다 — 내부 1분 = 표시 18분, 30분 = 540분 = 09:00~18:00.
   대표 "하루가 09시 30분에 끝나는 게 어색해". 데이터·채점 로직은 손대지 않는다. */
const DISP_MUL=18;
const dispMin=(m)=>Math.round((+m||0)*DISP_MUL);
/* 45차: 마지막 카드가 늦게 오는 날은 dayEndMin 이 30 을 넘겨 「18:18」처럼 보였다 — 데이터에서 도착을 당겨 고쳤고(tools/arrive45.py), 표시만 18:00 을 넘지 않게 막아 둔다(내부 분·채점은 그대로) */
const fmtClock=(m)=>{ const t=Math.min(18*60,9*60+dispMin(m)); return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0'); };
/* 점심(표시상 12:00~13:00) — 데이터는 그대로 흐르고 상단에 표시만 잠깐 붙는다 */
const isLunch=(m)=>{ const t=9*60+dispMin(m); return t>=12*60&&t<13*60; };
const escapeHtml=(s)=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const actLabel=(k)=>(D&&D.actLabels&&D.actLabels[k])||ACT_LABELS_DEFAULT[k]||k;
const h=(tag,cls,text)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(text!=null) e.textContent=text; return e; };
const mkBtn=(label,cls,fn)=>{ const b=document.createElement('button'); b.type='button'; b.className='btn '+(cls||''); b.textContent=label; b.onclick=fn; return b; };
const npcInfo=(name)=>{
 const authored=D?.npcs?.[name];if(authored)return authored;
 const row=WorkSimRoster.data.characters.find(c=>c.display_name===name||c.full_name===name);
 if(!row)return null;return {ch:row.model_id,teamKey:row.team_code,team:row.team_name,role:row.title,seat:row.team_code===S.team?row.seat_id:undefined};
};
const seatByName=(name)=>{ const v=npcInfo(name); return v?v.seat:null; };
const npcBySeat=(seat)=>{
 if(seat==='me')return WorkSimRoster.player(S.team,P?.avatar||avatarPref()||'m')?.display_name;
 if(seat==='staff'){const p=WorkSimRoster.player(S.team,P?.avatar||avatarPref()||'m');seat=p?.seat_id==='staff_m'?'staff_f':'staff_m';}
 const row=WorkSimRoster.team(S.team).find(c=>c.seat_id===seat);return row?.display_name||null;
};
const npcByTeam=(key)=>{ if(!D) return null; for(const [n,v] of Object.entries(D.npcs)) if(v.teamKey===key) return n; return null; };
const trustOf=(name)=>((P&&P.trust&&P.trust[name])||0)+((S.trust&&S.trust[name])||0);
const uniq=(a)=>Array.from(new Set(a));
/* 받침에 맞는 조사(은/는 · 을/를 · 이/가) — 끝 글자가 한글이 아니면 받침 없음으로 본다 */
const josa=(w,a,b)=>{ const s=String(w||''); const c=s.charCodeAt(s.length-1)-0xAC00; return (c>=0&&c<=11171&&c%28!==0)?a:b; };
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
const withTimeout=(p,ms)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error('시간 초과')),ms))]);

/* ---------- 알림 · 말풍선 ---------- */
function toast(text,who,ms=4200,cls=''){ const box=$('toasts'); if(!box) return; while(box.children.length>=3) box.firstChild.remove(); const el=h('div','toast '+cls); if(who){ el.appendChild(h('b',null,who)); } el.appendChild(document.createTextNode(text)); box.appendChild(el); setTimeout(()=>el.remove(),ms); }
const stage=()=>$('stage');
function office(){ if(NO_STAGE) return null; try{ const w=stage().contentWindow; const O=w&&w.__office&&w.__office.ready&&w.__office.ready()?w.__office:null; if(O&&!checkOfficeCast.done) checkOfficeCast(O); return O; }catch(e){ return null; } }
function bubble(who,text,ttl=4){ const seat=seatByName(who); const O=office(); if(seat&&O){ try{ const c=O.npcAt(seat); if(c){ O.say(c,text,{ttl}); return true; } }catch(e){} } return false; }
function sayNpc(who,text,ttl=4){ const shown=bubble(who,text,ttl);
  /* 이 방에 자리가 있는 사람은 3D 말풍선(대면), 자리가 없는 사람은 사내 메신저(전자) */
  if(seatByName(who)) toast(text,who,4200,''); else msgLine(who,text);
  return shown; }
/* 전자 메시지 한 줄 — 컴퓨터 안 메신저로 간다. 메신저가 아직 없으면 알림으로 떨어진다.
   대표 지적 "컴퓨터에서 볼 수 있게 해줘. 그냥 이렇게 뜨는 거 어색하잖아". */
function msgLine(who,text,opts){ opts=opts||{};
  if(window.Msg&&window.Msg.push){ window.Msg.push(who,text,opts); return true; }
  toast(text,who,4600,'cust'); return false; }
function npcLabel(who){ return who==='@npc'?'상대':who; }

/* ---------- 진행 저장 ---------- */
const LS_KEY=()=>`ws7.progress.${(S.code||('demo-'+S.team)).toLowerCase()}`;
function emptyProgress(){ return {v:2,code:S.code,team:S.team,name:S.name||'',day:1,avatar:null,done:{},clues:{},trust:{},unlocked:[],rbOpen:[],cur:null,updatedAt:null}; }

/* ---------- 플레이어 캐릭터(여성·남성) ----------
   남성은 3D 의 기본값(acnh_25 — 어느 팀에도 없는 전용 모델) 그대로다.
   45차(대표 「신입사원 여성으로 선택했을 때 동일한 인물이 앉아 있음」): 원인은 둘이었다.
     ① 아래 OFFICE_CAST 가 office.html CAST 의 **낡은 사본**이었다(44차에 구매팀·고객지원팀 배역이 바뀌었는데 안 고쳐짐).
     ② 고르는 규칙이 「지금 팀만」 피해서 다른 팀 방에 가면 같은 사람이 앉아 있었다 — 서른한 명이 전부 배역이라 피할 수가 없다.
   그래서 여성은 **전용 모델 한 명**을 쓴다 — PLAYER_F = acnh_49(09-13 결정, 새로 만드는 중). 무조건 이것을 넘긴다.
   파일이 아직 없으면 office.html 이 스스로 FEMALE_FALLBACK 규칙(acnh_17, 내 팀이 인사팀이면 acnh_33)으로 대체하고
   그 모델을 쓰는 NPC 에게 겉모습 변형(TWIN_LOOK)을 입힌다. PLAYER_F 를 null 로 두면 여기서 바로 대체 모델을 넘긴다.
   ⚠ 소개·아바타 미리보기 그림(assets/home/w/av_c49.png)은 아직 없다 — 생기면 아래 AVATAR_HAVE_MAX 를 49 로 올린다. 없는 동안은 🙂.
   🔴 PLAYER_F 는 office.html 의 RESERVED.playerF 와 **같이 고친다.**
   🔴 OFFICE_CAST 는 office.html CAST 를 옮겨 적은 것이다(게임이 3D 를 띄우기 전에 알아야 해서 읽어 올 수가 없다).
      배역을 바꾸면 **양쪽을 같이** 고친다. 어긋나면 3D 가 준비될 때 콘솔에 경고한다(checkOfficeCast). */
const OFFICE_CAST=Object.fromEntries(TEAM_ORDER.map(t=>[t,WorkSimRoster.residents(t)]));
function playerChar(g){return WorkSimRoster.player(S.team,g)?.model_id||'';}
function checkOfficeCast(O){if(!O?.CAST)return;for(const t of TEAM_ORDER){
 if(O.CAST[t].map(c=>c[0]).join(',')!==OFFICE_CAST[t].join(','))throw new Error('Fixed roster mismatch: '+t);
}}
function avatarPic(ch){const m=/^acnh_(\d+)$/.exec(String(ch||''));
 if(!m||!WorkSimRoster.byId(ch))return '';return 'assets/native_staff50/portraits/'+ch+'.png'+(WorkSimRoster.byId(ch).model_url.match(/\?v=.*/)?.[0]||'');}
/* 이 기기에 남는 선호값 — 소개 페이지에서 바꾼 것을 게임이 따라간다 */
function avatarPref(){ try{ return localStorage.getItem('ws7.avatar')||''; }catch(e){ return ''; } }
function setAvatarPref(g){ try{ localStorage.setItem('ws7.avatar',g); }catch(e){} }
/* 백엔드는 js/backend.js 가 실려 있고 configure(url) 로 주소가 잡힌 뒤에만 쓴다.
   configure 안 된 상태는 「서버 없음」과 같게 취급한다 — 저장은 localStorage, 채점은 규칙 채점. */
function backendOn(){ const B=window.Backend; if(!B) return false; if(typeof B.isOn==='function') return !!B.isOn(); return typeof B.save==='function'; }
function hasBackend(){ return backendOn()&&typeof window.Backend.save==='function'; }
/* AI 첨삭을 쓸 수 있는 상태인가 — 데모(코드 없이 들어온 경우)는 ?ai=1 일 때만 */
function aiOn(){ return backendOn()&&typeof window.Backend.grade==='function'&&(!S.demo||!!Q.get('ai')); }
async function loadProgress(){ let p=null;
  try{ const raw=localStorage.getItem(LS_KEY()); if(raw) p=JSON.parse(raw); }catch(e){}
  if(hasBackend()&&S.code&&!S.demo){ try{ const r=await withTimeout(window.Backend.load(S.code),9000); if(r&&r.ok&&r.progress){ const rp=(typeof r.progress==='string')?JSON.parse(r.progress):r.progress; if(!p||(rp.updatedAt||'')>=(p.updatedAt||'')) p=rp; } }catch(e){ console.warn('진행 불러오기 실패(서버):',e.message); } }
  if(!p) p=emptyProgress(); p.code=S.code; p.team=p.team||S.team; p.done=p.done||{}; p.clues=p.clues||{}; p.trust=p.trust||{}; p.unlocked=p.unlocked||[]; p.rbOpen=p.rbOpen||[]; p.day=p.day||1; return p; }
let saveTimer=null, saveSeq=0;
/* 진행 중인 날(P.cur)의 카드 상태 — 이어 하기에 필요한 것만(57차 E1 · spec D28). 하루 도중 저장본이 GAS 상한(45,000자)을 넘었다(cs·qc 6일차 오후 45.8천 자).
   · 끝낸 카드: 결과 화면 전용(요소 판정 상세 detail·AI 총평 feedback·모범 답안 model·정답 코멘트 bestComment)·단계 기록(steps — 안 끝난 카드만 읽는다)·
     걸어간 기록(lastNpc·lastSeat·ask·wrong …)을 뺀다. 디브리프·저장 기록(cardRecord)·「오늘의 실수」 조건(mistakeWhenMet)이 읽는 것은 남긴다.
   · 안 끝난 카드: 모범 답안만 빼고, 단계 기록 안의 글(steps.*.text — st.text·text2 와 같은 글)을 뺀다.
   이어 한 뒤 끝낸 카드를 다시 열면 점수·코멘트·쓴 글은 그대로이고 요소 칩·모범 답안(배포본)만 안 보인다 */
const CUR_DONE_DROP=['steps','model','bestComment','detail','detail2','feedback','ask','order','qorder','workDraft','workWrong','workTries','lastNpc','lastSeat','deliveredAt','readyAt','reportChoice','wrong','visitorHere','visitorComing','go','onTime'];
function curCards(cards){ const out={}; for(const [id,st] of Object.entries(cards||{})){ if(!st||typeof st!=='object'){ out[id]=st; continue; } const o=Object.assign({},st);
    if(o.status==='done'||o.status==='skipped'){ for(const k of CUR_DONE_DROP) delete o[k]; }
    else { delete o.model; if(o.steps){ const s2={}; for(const [k,v] of Object.entries(o.steps)){ const v2=Object.assign({},v); delete v2.text; s2[k]=v2; } o.steps=s2; } }
    for(const [k,v] of Object.entries(o)) if(v==null||v===''||(v===false&&k!=='workOk'&&k!=='reportBest')) delete o[k];   /* workOk·reportBest 의 false 는 뜻이 있다(실수 대사 조건·단서) */
    out[id]=o; }
  return out; }
function nonzeroCounts(o){ const out={}; for(const [k,v] of Object.entries(o||{})) if(v) out[k]=v; return out; }
/* 진행 중 사본(P.cur)을 지금 상태로 — saveProgress 와 이 기기 주기 저장(snapLocal)이 같이 쓴다 */
function fillCur(){ if(!P) return false; P.updatedAt=new Date().toISOString(); P.team=S.team; P.name=S.name||P.name||''; P.v=2;
  /* 7일차는 발표를 마쳐 결과(P.done['7'])를 적은 뒤에는 진행 중이 아니다 — 예전에는 끝난 뒤에도 결정 칸 사본(cur)이 남아 1.6천 자를 더 썼다 */
  const ep7Done=S.phase==='ep7'&&window.EP7&&typeof window.EP7.result==='function'&&!!window.EP7.result();
  if((S.phase==='work'||S.phase==='triage'||S.phase==='ep7')&&!ep7Done){ P.cur={v:2,day:S.ep,phase:S.phase,t:S.t,cards:curCards(S.cards),order:S.order,extra:S.extra,trust:S.trust,counts:nonzeroCounts(S.counts),nexts:S.nexts,mistakes:S.mistakes,triage:S.triage,clues:S.clues,ev:S.evPart?{part:1}:undefined,ep7:(window.EP7&&window.EP7.snapshot)?window.EP7.snapshot():null}; return true; }
  return false; }
/* 하루 도중 이 기기에 자주 남긴다(57차 E1 후속 · QA Y-5) — 저장은 동작 때만이라 오래 기다린 뒤 새로고침하면 시계가 마지막 동작 시각으로 되감겼다(늦음 판정도 되돌아감).
   이 기기(localStorage)에만 — 서버 저장은 동작 때 그대로(주기 저장을 서버로 보내면 반 전체가 GAS 시트를 몇 초마다 쓴다) */
function snapLocal(){ if(!P||S.phase!=='work'||!S.running) return; try{ if(fillCur()) localStorage.setItem(LS_KEY(),JSON.stringify(P)); }catch(e){} }
setInterval(snapLocal,10000); window.addEventListener('pagehide',snapLocal);
function saveProgress(now){ if(!P) return; fillCur();
  try{ localStorage.setItem(LS_KEY(),JSON.stringify(P)); }catch(e){}
  if(hasBackend()&&S.code&&!S.demo){ const seq=++saveSeq; const go=()=>{ if(seq!==saveSeq&&!now) return; window.Backend.save(P).then(r=>{ if(!r||!r.ok) setStatus('서버 저장 실패 — 이 기기에는 저장됨'); else setStatus('저장됨'); }).catch(()=>setStatus('서버 저장 실패 — 이 기기에는 저장됨')); }; clearTimeout(saveTimer); if(now) go(); else saveTimer=setTimeout(go,1500); }
  else setStatus('이 기기에 저장됨'); }
function setStatus(t){ const e=$('saveStat'); if(e){ e.textContent=t; clearTimeout(e._tm); e._tm=setTimeout(()=>{ e.textContent=''; },3000); } }

/* ---------- 시계 ---------- */
let lastTick=0;
function clockTick(){ const now=performance.now(); const dt=lastTick?(now-lastTick)/1000:0; lastTick=now; if(!S.running||S.paused||S.phase!=='work') return; const slow=S.composing?1/3:1; advance(dt/SEC_PER_MIN*slow); }
/* 하루가 끝나는 시각. 마지막 카드가 도착하기도 전에 하루가 닫히면 학생은 손도
   못 댄 건으로 점수를 잃는다 — 마지막 도착 + 3분까지는 하루를 끝내지 않는다. */
function dayEndMin(){ if(!D) return 0; let last=0;
  for(const c of D.cards.concat(S.extra)){ const a=+c.arrive; if(isFinite(a)&&a>last) last=a; }
  return Math.max(D.minutes||0,last+3); }
function advance(min){ if(min<=0||!D) return; S.t+=min; const end=dayEndMin(); if(S.t>=end&&!S.ended){ S.t=end; S.ended=true; onDayEnd(); } arrivals(); checkLate(); renderClock(); }
function renderClock(){ const el=$('clock'); if(!el) return; el.textContent=fmtClock(S.t); el.classList.toggle('late',!!S.ended);
  const lu=$('lunch'); if(lu) lu.hidden=!(D&&!S.ended&&isLunch(S.t));
  const lf=$('clockLeft'); if(!lf) return;
  if(!D){ lf.textContent=''; return; }
  /* 남은 것은 **실제 시간**으로 적는다 — 표시 시각(하루)과 남은 시간(세션)은 단위가 다르다.
     게임 1분 = 실시간 SEC_PER_MIN 초이므로 하루 30분은 speed 1 에서 40분이다. */
  const sec=Math.max(0,Math.ceil((dayEndMin()-S.t)*SEC_PER_MIN));
  lf.textContent=S.ended?'퇴근 시간':(sec>=60?`남은 ${Math.ceil(sec/60)}분`:`남은 ${sec}초`);
  lf.classList.toggle('over',!!S.ended); }
function arrivals(){ if(!D) return; const fresh=[]; const all=D.cards.concat(S.extra);
  for(const c of all){ const st=S.cards[c.id]; if(!st||st.arrived) continue; if(c.requires&&!requireMet(c)) continue; const at=(c.requires&&st.readyAt!=null)?st.readyAt:c.arrive; if(at<=S.t){ st.arrived=true; st.arrivedAt=Math.max(at,0); st.status='new'; S.order.push(c.id); fresh.push(c); if(c.trustDelta){ for(const [n,d] of Object.entries(c.trustDelta)) S.trust[n]=(S.trust[n]||0)+d; } } }
  if(fresh.length){
    /* 메신저·전화는 **한꺼번에 와도 반드시** 제 창으로 보낸다 — 앞서는 동시 도착일 때
       「N건이 동시에 도착했어요」만 띄우고 넘어가 메신저가 텅 비어 있었다. */
    const mails=[]; for(const c of fresh){ if(c.type==='msg'||c.type==='phone') notifyArrive(c); else mails.push(c); }
    if(mails.length===1) notifyArrive(mails[0]);
    else if(mails.length&&S.phase==='work') toast(`${mails.length}건이 동시에 도착했어요`,'메일함',3000,'cust');
    for(const c of fresh){ if(c.npcArrives) npcArrive(c); } renderInbox(); renderCounts(); } }
function requireMet(c){ const r=c.requires; const st=S.cards[r.card]; if(!st) return false; if(r.delivered&&!st.delivered) return false; if(r.done&&st.status!=='done') return false; return true; }
function notifyArrive(c){
  /* 종류마다 가는 곳이 다르다 — 한 창에 섞지 않는다(대표 "너무 산만해").
       메신저 → 컴퓨터 안 사내 메신저 대화에 본문이 그대로 쌓인다
       전화   → 그 자리에서 울리는 전화 띠(안 받으면 「전화 메모」 앱)
       그 밖   → 메일함 + 알림 한 줄 */
  if(c.type==='msg'){ if(window.Msg&&window.Msg.card) window.Msg.card(c); else msgLine(c.from,c.subj,{team:c.teamName||TEAM_NAMES[c.to]||''}); return; }
  if(c.type==='phone'){ if(typeof phoneRing==='function'){ phoneRing(c.id); return; } }
  if(S.phase!=='work') return;
  const kind=c.type==='visit'?'방문':c.npcArrives?'대면':'메일';
  toast(`${kind} 도착: ${c.subj}`,c.from,3000,'cust'); }
/* 이어 하기·되돌리기 뒤에 메신저와 전화 목록을 다시 채운다 — 저장된 것은 카드 상태뿐이라
   대화와 전화 벨은 이 함수가 없으면 빈 채로 남는다. */
function rehydrateBoxes(){ if(!D) return;
  if(window.Msg&&window.Msg.reset) Msg.reset();
  for(const id of S.order){ const c=CARD(id), st=S.cards[id]; if(!c||!st) continue;
    if(c.type==='msg'&&window.Msg&&window.Msg.card){ Msg.card(c);
      if(st.status==='done'&&typeof msgResultNote==='function') msgResultNote(id); }
    else if(c.type==='phone'&&st.status!=='done'&&typeof phoneRing==='function') phoneRing(id); }
  if(window.Tel&&window.Tel.refresh) Tel.refresh(); }
function checkLate(){ for(const id of S.order){ const c=CARD(id), st=S.cards[id]; if(!c||st.status==='done'||st.late) continue; const dl=(c.deadline!=null?c.deadline:10); if(S.t>st.arrivedAt+dl) st.late=true; } }
setInterval(clockTick,200);

/* ---------- 조력자가 찾아오는 카드(체인 후속 스텝) ----------
   50차(대표 「그 사람이 실제로 찾아오게 한다」). 카드에 「👋 대면」이라 적힌 `npcArrives` 29장은
   47차로 그 사람들이 내 방에 자리가 없어져 **사내 메신저로만** 떨어졌다 — 대면이라 써 놓고 아무도 안 나타났다.
   이제 48차 사원증과 **같은 틀**로 문으로 들어와 **내 자리 옆**에 서서 그 줄을 말하고 나간다.

   정해 둔 것
   · **글은 늘 남긴다** — 3D 가 없든(?stage=0) 있든 `sayNpc` 가 먼저 돌아 메신저에 기록이 남는다.
     플레이어가 컴퓨터를 보고 있거나 다른 방에 있어 장면을 못 봐도 내용이 사라지지 않게.
   · **이미 손님이 있으면 줄을 선다** — 6일차 방문 카드 손님(소파)과 겹칠 수 있다(방문 10~12분 · 대면 22.5~25분).
     나갈 때까지 최대 90초 기다렸다 들어가고, 그래도 안 비면 **메모만 남기고 만다**(하루가 밀리지 않게).
   · **문 쪽 컷은 넣지 않는다** — 손님이 **내 자리 옆**으로 오므로 카메라가 이미 그쪽을 본다.
     1일차 사원증은 팀장 자리(멀다)라 컷이 필요했지만, 여기서 0.8초씩 카메라를 빼앗으면
     한 판에 세 번(4·5·6일차) 업무 중에 끊긴다. 필요하면 `cut` 값만 넘기면 된다(office doorCut).
   · 29장 모두 **타 팀 사람**이라 이 방에 자리가 없다. 자리가 있는 사람이면 예전대로 말풍선이다. */
function npcArrive(c){ const who=(c.from||'').replace(/\s*\(.*?\)\s*/g,'').trim(); const line=(c.npcLine||'').replace(/○○씨/g,(S.name||'○○')+'씨');
  if(!who||!line) return;
  setTimeout(()=>{ if(!sayNpc(who,line,6)) toast(line,who,5000,'cust'); },300);   /* 기록(메신저·말풍선) — 예전 그대로 */
  try{ Promise.resolve(npcArriveStage(who,line)).catch(e=>console.warn('대면 손님 오류',e)); }
  catch(e){ console.warn('대면 손님 오류',e); } }   /* 3D: 문으로 들어와 말하고 나간다 — 글과 따로 돌고, 실패해도 하루를 막지 않는다 */
async function npcArriveStage(who,line){
  if(NO_STAGE||!window.Talk||!Talk.chOf) return false;
  const O=office(); if(!O||typeof O.visitorIn!=='function'||typeof O.visitorState!=='function') return false;
  if(seatByName(who)) return false;                     /* 이 방에 자리가 있으면 원래 길(말풍선) */
  const ch=Talk.chOf(who)||''; if(!ch) return false;    /* 3D 모델이 없는 사람은 글로만 */
  try{
    for(let i=0;i<180;i++){ if(S.phase!=='work') return false;
      const v=O.visitorState(); if(!v||v.state==='none') break; await sleep(500); }   /* 손님이 나갈 때까지(최대 90초) */
    const v0=O.visitorState(); if(v0&&v0.state!=='none') return false;
    if(S.phase!=='work') return false;
    const ok=await O.visitorIn({name:who,ch,stand:'me',noTalk:true,faceCam:true});   /* faceCam — 대화 카메라를 안 켜므로 얼굴이 보이는 자리에 세운다 */
    if(!ok) return false;
    if(Talk.reply) Talk.reply(who,line);
    if(Talk.idle) await Talk.idle(); else await sleep(4500);
    await O.visitorOut(); return true;
  }catch(e){ console.warn('대면 손님 오류',e); try{ O.visitorOut(); }catch(e2){} return false; } }

/* ---------- 이동(전달·질문·보고): 사무실이 있으면 연출, 없으면 글 ---------- */
/* 사규집 편 잠금(56차) — 협동판은 「본문은 ○○팀이 가지고 있습니다」로 막고 그 팀 학생에게 묻게 한다.
   1인용에는 물을 사람이 없어 10편이 통째로 열려 있었고, 타 팀 소관 카드 95장을 혼자 읽고 끝냈다.
   그 팀 사람과 실제로 만나야 그 편이 열리도록 travel 을 한 겹 감싼다(만나지 못하면 present:false 라 안 열린다). */
async function travel(mode,opts){ const r=await travelRaw(mode,opts);
  try{ if(r&&r.present!==false&&opts&&opts.teamKey) rbUnlock(opts.teamKey); }catch(e){}
  return r; }
async function travelRaw(mode,opts){ const O=office(); const who=opts.who||''; const seat=opts.seat||null;
  /* 다른 팀 상대는 복도 경로가 우선. 사무실이 아직 복도를 모르면(goToTeam 없음·null) 같은 방 임시 좌석으로 떨어진다 */
  if(O&&!O.busy&&typeof O.goToTeam==='function'&&opts.teamKey&&opts.teamKey!==S.team){ try{ const r=await O.goToTeam(opts.teamKey,Object.assign({mode},opts)); if(r) return r; }catch(e){ console.warn('복도 이동 오류',e); } }
  if(O&&!O.busy&&seat&&O.npcAt&&O.npcAt(seat)){ try{ const r=await O.interact(mode,Object.assign({},opts,{to:seat})); return r||{present:false}; }catch(e){ console.warn('연출 오류',e); } }
  /* 대체 연출: 화면 안내 + 짧은 대기 */
  const label=opts.teamName?`${opts.teamName} ${who}`:who; setStatusLine(`${label} 자리로 가는 중…`); await sleep(NO_STAGE?300:1200);
  if(mode==='ask'){ const qs=opts.questions||[]; let i=opts.auto!=null?opts.auto:await choosePanel(`${who}에게 무엇을 물어볼까요?`,qs,null,{who,seat,role:opts.teamName||''}); const ans=(opts.answers&&opts.answers[i])||opts.answer||'그건 저도 잘 모르겠는데요.'; toast(ans,who,5000,'cust'); await sleep(NO_STAGE?100:900); setStatusLine(''); return {choice:i,answer:ans,present:true}; }
  if(mode==='report'){ const ch=opts.choices||[]; toast(opts.ask||'근거가 뭐야?',who,3000,'cust'); let i=opts.auto!=null?opts.auto:await choosePanel(opts.prompt||'어떻게 보고할까요?',ch,null,{who,seat,role:opts.teamName||''}); const line=(opts.lines&&opts.lines[i])||''; if(line) toast(line,who,5000,'cust'); await sleep(NO_STAGE?100:900); setStatusLine(''); return {choice:i,present:true}; }
  if(mode==='visit'){ const ch=opts.choices||[]; toast(opts.lines&&opts.lines.open||'',opts.name||'방문객',5000,'cust'); let i=opts.auto!=null?opts.auto:await choosePanel(opts.prompt||'어떻게 응대할까요?',ch,opts.timeLimit,{who:opts.name||who,role:'방문'}); const re=(opts.reacts&&opts.reacts[i])||''; if(re) toast(re,opts.name||'방문객',4000,'cust'); await sleep(NO_STAGE?100:600); setStatusLine(''); return {choice:i,present:true}; }
  const line=opts.npcLine||(opts.ok===false?'그건 다른 팀인데요.':'네, 처리할게요.'); toast(line,who,4500,'cust'); await sleep(NO_STAGE?100:800); setStatusLine(''); return {ok:opts.ok!==false,present:true,line}; }
function setStatusLine(t){ const e=$('stat'); if(e) e.textContent=t||''; }
/* 화면 선택지 — 대화 모드(js/play/talk.js)의 대화창에서 고른다. timeLimit(초) 지나면 -1.
   전화·방문 응대·NPC 대화가 **한 부품**을 쓰게 하려고 옛 `#choice` 패널을 걷어냈다. */
function choosePanel(title,items,timeLimit,opts){
  if(window.Talk&&window.Talk.choose) return window.Talk.choose(title,items,timeLimit,opts||{});
  console.error('대화 모드(js/play/talk.js)가 실리지 않았습니다'); return Promise.resolve(-1); }

/* ---------- js/desk/* 로 내어 주는 것 ----------
   `js/desk/` 넷은 우리 스크립트와 별개의 파일이고 `global.X` 로 값을 찾는다. 그런데
   classic script 의 최상위 `const` 는 **window 에 얹히지 않는다**(전역 렉시컬 환경에만 산다).
   그래서 `function` 으로 선언한 것(office·toast·renderInbox…)은 저절로 보이는데
   `const` 로 선언한 것(S·CARD·fmtClock…)은 조용히 undefined 였다 — 얼굴도 시각도 비었다.
   필요한 것만 이름 그대로 내어 준다. 같은 객체라 두 벌이 되지 않는다. */
Object.assign(window,{S,CARD,fmtClock,dispMin,isLunch,npcInfo,seatByName,npcBySeat,
  avatarPic,playerChar,actLabel,escapeHtml,uniq,h,mkBtn,TEAM_NAMES});
