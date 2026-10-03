/* ======================================================================
   카드 — 메일함 · 카드 창 · 카드 종류별 행동(회신·작성·전화·전달·질문·보고·방문·양식·결재·체인·분기·반성) · 분기 · 기록
   ====================================================================== */

/* ---------- 카드 흐름(단계) ---------- */
/* hasCompose · isTextCard · flowOf 는 grade.js(순수 채점 공용부)에 있다 — 서버 번들이 같은 함수를 쓴다 */
function requiredSteps(c){ return flowOf(c).filter(s=>s!=='ask'); }   /* 질문은 안 하고 답해도 되지만 상한이 걸린다 */
function stepsLeft(id){ const c=CARD(id), st=S.cards[id]; return requiredSteps(c).filter(s=>!(st.steps&&st.steps[s])); }
function markStep(id,name,data){ const st=S.cards[id]; st.steps=st.steps||{}; st.steps[name]=Object.assign({at:S.t},data||{}); st.status='read'; if(!stepsLeft(id).length) finalize(id); else { renderInbox(); renderCounts(); if(S.cur===id) renderCardActs(id); saveProgress(); } }
/* rightQ · askAnswers · askCap 은 grade.js 로 옮겼다(정답 조회 = 채점 공용부) */

/* ---------- 57차 E2 — 정답이 화면에 드러나지 않게(spec §7 E2 · D10·D11·D18·D19·D21·D23) ----------
   1일차는 연습일이다 — 흐름별 단추와 「할 일」 안내·펼친 사수 메모·할 일 3칸을 남긴다(D10).
   2일차부터 채점 글 카드(메일·메신저·댓글)는 흐름과 상관없이 늘 같은 「공통 처리 선택지」를 보인다(D11):
     회신 쓰기 · 상신하기(팀장에게 글) · 가서 전달하기 · 가서 묻기 · 보류 (+ 그날 열린 도구: 대면 보고)
   흐름에 없는 경로를 고르면 그 act 점수로 끝난다. 「거절」 단추는 없다 — best=reject 카드의 회신은 key=reject 로 채점한다.
   안내 문장은 사실만(「○○에게 전달 완료」·들은 답) — 할 일을 정해 주는 문장·정답 단추 강조·행동 이름이 붙은 보내기 단추를 쓰지 않는다. */
function practiceDay(){ return Number(S.ep)<=1; }
function commonCard(c){ if(!c||practiceDay()||!isTextCard(c)||c.followup) return false; if(c.unscored||c.axis==='self'||c.scored===false) return false; return ['reply','ask','deliver','report'].includes(flowOf(c)[0]); }
/* 회신의 채점 키 — 거절은 처리 방식이 아니라 회신의 내용이다(D11). 단 회신이 그 카드의 흐름 안일 때만(57차 E2후속 C10):
   회신 단계가 없는 전달 흐름(qc_ep5_cert1·ga_ep5_badge1 — best=reject)에 쓴 회신은 흐름 밖 「회신」이다 → act.reply 점수·branches.reply.
   예전에는 늘 reject 로 잡혀 「최선보다 낮은 것 중 최고」(40·45)를 받고 기록이 「거절」이 됐다 */
function replyKey(c){ return c&&c.best==='reject'&&flowOf(c).includes('reply')?'reject':'reply'; }
function toolOpen(k){ return !!(D&&(D.unlock||[]).includes(k)); }
function leadOfDay(){ return (((D&&D.dests)||[]).find(d=>d.seat==='lead')||{}).name||'팀장'; }
const hasAct=(c,k)=>!!(c&&c.act&&Object.prototype.hasOwnProperty.call(c.act,k));
/* 〔상신하기〕 글을 받는 사람 — 팀장, 또는 카드의 결재자(57차 E2후속 F12 · 메인 결정: 상신 글은 팀장·결재자 앞 보고다).
   결재자 = 데이터 confirmTo(팀장이 아닌 결재자가 있는 카드만) → 대면 보고 카드면 보고 대상(npc·report.npc) → 그날 팀장.
   요청자·고객에게 알릴 것은 두 번째 글(alsoReply.to)이다 — 예전에는 replyTo 가 있으면 상신 글도 그 사람에게 갔다 */
function confirmTo(c){ if(c&&c.confirmTo) return c.confirmTo; if(c&&(c.mode==='report'||c.type==='report')){ const w=c.npc||(c.report&&c.report.npc); if(w) return w; } return leadOfDay(); }
/* 글 두 개 카드(첫 글 + alsoReply 둘째 글)에서 고른 처리가 어느 칸에 쓰는가 — 57차 E2후속(F12 묶음 · cs·buy·logi 2차 발견)
   〔상신하기〕 = 첫 글. 〔회신 쓰기〕 = 첫 글, 첫 글을 보냈으면 둘째 글 — 단 **첫 글이 상신인 카드(best=confirm)는 회신 = 요청자 앞 둘째 글**이고 순서는 자유다
   (예전에는 〔회신 쓰기〕를 먼저 고르면 흐름 밖 회신으로 곧바로 끝나 상신할 기회가 없었다 — by10·cs_ep5_wrongship3·ga10).
   이미 보낸 칸은 다시 쓰지 않는다(예전에는 〔상신하기〕를 다시 누르면 첫 글을 덮어썼다 — lg33) → {done:사실 문장}.
   흐름 밖 처리(회신형에 상신 · 전달 흐름에 회신 등)는 그대로 writeRoute 가 act 점수로 끝낸다. 할 일을 알려 주는 안내는 붙이지 않는다 */
function composeTarget(c,st,ch){ const steps=(st&&st.steps)||{}, flow=flowOf(c); const upFirst=c.best==='confirm'&&flow[0]==='reply';
  if(ch==='confirm'){ if(upFirst&&steps.reply) return {done:'이미 올렸어요.'}; return {which:'reply',key:'confirm'}; }
  let which='reply'; if(flow.includes('reply2')&&(upFirst||steps.reply)) which='reply2';
  if(steps[which]) return {done:'이미 답장했어요.'};
  return {which,key:which==='reply2'?'reply':replyKey(c)}; }
/* 기록 조회(recordLookup) — 메일 카드 창·메신저가 같은 것을 부른다(F3) */
function lookupRecord(id){ const st=S.cards[id]; if(!st||st.lookup) return; st.lookup=true; saveProgress(); }
/* ---------- 57차 E1 — 역량 증거(ev) 모으기 ----------
   채점 창구(Grader — 로컬은 grade.js, 배포본은 서버)가 결과에 붙여 준 ev 를 카드 상태 st.ev(저장 문자열 — docs/ncs57/E1-api.md §2-3)에 합친다(같은 항목 id 는 뒤가 이긴다).
   서버가 옛 번들이라 ev 를 안 주면(evv 없음) 그날을 「일부만 기록」(ncs2.part)으로 적는다. 코칭 문장(tip)은 저장하지 않고 디브리프용으로만 둔다.
   브라우저가 직접 판정하는 항목(전달·질문 상대 route · 끝까지 follow)은 공개본에도 남는 매핑으로 같은 모양(Ev.item)을 만든다 */
function takeEv(id,r,need){ const st=S.cards[id]; if(!st||!r) return;
  takeSeal(id,r);   /* 57차 E1 후속(B2) — 결과를 붙이는 곳이 서버 서명도 받는다 */
  if(r.evv&&Array.isArray(r.ev)){ addEv(id,r.ev); return; }
  if(need!==false&&!Grader.local()) S.evPart=1; }
function addEv(id,list){ const st=S.cards[id]; if(!st||!list||!list.length||typeof Ev==='undefined') return; st.ev=Ev.str(Ev.merge(Ev.parse(st.ev),list));
  for(const e of list) if(e&&e.tip) (S.evTip=S.evTip||{})[id+'.'+e.i]=e.tip; }
function evLocal(id,ov,s){ const c=CARD(id); if(!c||typeof Ev==='undefined'||!Ev.on()) return; const L=Ev.items(c).filter(it=>it.ov===ov).map(it=>Ev.item(c,it,s)).filter(Boolean); if(L.length) addEv(id,L); }
/* 상대 찾기(route) — 첫 번에 맞음 3 · 한 번 헤맴 2 · 두 번 이상 1(사수에게 방향을 묻는 것은 헤맴이 아니다) */
function evRoute(id){ const st=S.cards[id]; const n=(st&&st.tries)||0; evLocal(id,'route',n<=0?3:n===1?2:1); }
/* 3D 가 있을 때 「가서 ~」는 고른 것만 적어 두고 사람에게 걸어가 T 로 한다(45차) — 그 안내는 어느 카드나 같다 */
const GO_NOTE={deliver:'전달할 사람 자리로 가서 T 를 누르세요. 다른 팀 사무실은 문 앞에서 E.',ask:'물어볼 사람 자리로 가서 T 를 누르세요. 다른 팀 사무실은 문 앞에서 E.',report:'팀장 자리로 가서 T 를 누르세요.'};

/* ---------- 선택지 순서(E2-6 · D18) ----------
   전화·방문·대면 보고·검산 전달·반성 — 카드마다 처음 보일 때 한 번 섞어 카드 상태(order)에 둔다. 이어 하기 때 같은 순서다.
   자동 플레이·검사는 번호가 아니라 키로 고른다(autoIndex). 데이터의 choiceOrder 는 섞기 전 기본 순서로만 쓴다 */
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function orderOf(id,keys){ const st=S.cards[id]; keys=keys.slice(); if(!st||keys.length<2) return keys;
  const o=st.order; if(Array.isArray(o)&&o.length===keys.length&&keys.every(k=>o.includes(k))) return o.slice();
  st.order=shuffle(keys).slice(); return st.order.slice(); }
/* 결과값 칸 자리표시자 — 값 없는 중립 안내(57차 E1 후속 · QA Y-2: 예전 「예: 39일, 62,000원」은 cs_ep5_wrongship3 결과값 39일·다른 카드 62,000원과 같았다) */
const RESULT_PH='결과값 — 숫자와 단위를 함께(일·원·건·%)';
/* 팀장 앞 보고 첫마디 — 카드 제목이 이미 「… 건 보고」·「… 건」으로 끝나면 겹치지 않게(57차 E1 후속 · QA W-8: 「전화 건 보고 건 보고드립니다」) */
function reportLine(who,subj){ const t=String(subj||'').replace(/^\(대면\)\s*/,'').replace(/\s*(건\s*)?보고(드립니다|합니다)?\s*$/,'').replace(/\s*건\s*$/,''); return `${String(who||'').replace(' 팀장','')} 팀장님, ${t} 건 보고드립니다.`; }
/* 가서 묻기의 질문 3택 — 카드마다 처음 물을 때 한 번 섞어 카드 상태(qorder = 데이터 번호 순서)에 둔다(57차 E1 후속 · QA R-2:
   예전에는 데이터 순서 그대로라 정답 질문이 63장 중 60장 첫째였다). 채점·분기·기록은 데이터 번호로(qorder 로 되돌린다) */
function qOrder(id,n){ const st=S.cards[id]; const base=Array.from({length:n},(_,i)=>i); if(!st||n<2) return base;
  const o=st.qorder; if(Array.isArray(o)&&o.length===n&&base.every(i=>o.includes(i))) return o.slice();
  st.qorder=shuffle(base).slice(); return st.qorder.slice(); }
/* 반성 카드 — 후보(오늘 처리한 카드)가 늘어나도 이미 보인 순서는 지키고 새 후보만 아무 자리에 끼운다 */
function pickOrder(id,cands){ const st=S.cards[id]; if(!st) return cands; const o=Array.isArray(st.order)?st.order.filter(x=>cands.includes(x)):[];
  for(const x of cands){ if(o.includes(x)) continue; o.splice(Math.floor(Math.random()*(o.length+1)),0,x); } if(o.length>1) st.order=o.slice(); return o; }
/* 자동 플레이 인자 — 키(문자열)면 그 키, 숫자면 데이터 원래 순서의 그 칸 → 지금 보이는(섞인) 순서의 번호 */
function autoIndex(auto,shown,orig){ if(auto==null) return undefined; const k=typeof auto==='string'?auto:orig[+auto]; const i=shown.indexOf(k); return i<0?0:i; }

/* ---------- 사수 메모(힌트) — D19 ----------
   2일차부터 접어 두고 「사수 메모 보기」를 누르면 보인다(감점 없음 · 카드 상태에 hint=1 만 남긴다). 1일차는 펼친 채(D10).
   어느 카드를 열든(메일·메신저·전화) 그 카드의 메모로 바뀐다 — 예전에는 PC 모드의 메신저·전화 카드가 이 칸을 거치지 않아
   직전 메일 카드의 메모가 그대로 남았다(B-ga-logi E2). */
let HINT_CARD=null; const HINT_OPEN=new Set();
function renderHint(id){ if(id!==undefined) HINT_CARD=id||null; const tx=$('hintTx'); if(!tx) return; const old=$('hintShow'); if(old) old.remove();
  const c=HINT_CARD?CARD(HINT_CARD):null, st=c?S.cards[HINT_CARD]:null;
  if(!c){ tx.textContent='메일이 오면 여기서 한 줄 알려 줄게요.'; return; }
  const text=c.hint||'이건 힌트 없이 해 봐요.';
  if(practiceDay()||HINT_OPEN.has(HINT_CARD)||(st&&st.hint)){ tx.textContent=text; return; }
  tx.textContent='';
  const b=mkBtn('사수 메모 보기','',()=>{ const k=HINT_CARD; if(!k) return; HINT_OPEN.add(k); const s=S.cards[k], cc=CARD(k); if(s&&cc&&cc.hint&&!s.hint){ s.hint=1; saveProgress(); } renderHint(); });
  b.id='hintShow'; tx.parentNode.appendChild(b); }

/* ---------- 메일함 ----------
   대표 "너무 산만해. 메신저와 이메일은 분리된 창에서 떴으면 좋겠고."
   메일함에는 **메일만** 남긴다. 메신저(💬)는 사내 메신저 창, 전화(☎)는 전화 벨과
   전화 메모 앱으로 간다. 한 창 안에서 종류를 섞지 않는 것이 그 지적의 핵심이다. */
const inMail=(c)=>!!c&&c.type!=='msg'&&c.type!=='phone';
function renderInbox(){ const list=$('list'); if(!list) return; list.innerHTML=''; const ids=S.order.slice().reverse().filter(i=>inMail(CARD(i))); const left=ids.filter(i=>S.cards[i].status!=='done'&&S.cards[i].status!=='skipped').length; $('inboxN').textContent=ids.length?`${left}건 남음`:'';
  if(window.Msg&&window.Msg.refresh) window.Msg.refresh();
  if(window.Tel&&window.Tel.refresh) window.Tel.refresh();
  if(typeof renderPhoneBar==='function') renderPhoneBar();
  if(!ids.length){ list.appendChild(h('div','empty-msg','아직 도착한 메일이 없어요')); return; }
  for(const id of ids){ const c=CARD(id), st=S.cards[id]; if(!c) continue; const b=document.createElement('button'); b.type='button'; b.className='mail '+(st.status==='new'?'new':'')+(st.status==='done'?' done':'')+(S.cur===id?' cur':'')+(c.pre?' pre':''); b.onclick=()=>openCard(id);
    const r1=h('div','r1'); const u=h('span','u u'+Math.min(4,c.urgent||1)); const f=h('span','from',c.from);
    /* 2026-09-29 — 종류 그림 문자(🚪·👋·📋·📊·🗨)를 뺐다. 뜻이 맞는 승인 그림은 표(📊 → 10번 sheet) 하나뿐이다 */
    if(c.type==='sheet'){ const A=window.OC&&OC.ui&&OC.ui.appicon; if(A&&A.inline) f.insertAdjacentHTML('afterbegin',A.inline('sheet')); } const at=h('span','at',fmtClock(st.arrivedAt||0)); r1.append(u,f,at);
    const sj=h('div','sj',c.subj); b.append(r1,sj);
    if(st.status==='done'){ const sc=h('div','sc'+(st.score==null?'':st.score>=80?' hi':st.score<50?' lo':'')); sc.textContent=st.score==null?'답장함':`${actLabel(st.act)} · ${st.score}점`; b.appendChild(sc); }
    /* 남은 단계 이름(「전달·회신 남음」)은 흐름을 알려 주므로 1일차에만 */
    else if(st.steps&&Object.keys(st.steps).length){ b.appendChild(h('div','sc',practiceDay()?'진행 중 · '+stepsLeft(id).map(stepLabel).join('·')+' 남음':'진행 중')); }
    else if(st.late){ b.appendChild(h('div','sc lo','마감 지남')); }
    list.appendChild(b); } }
function stepLabel(s){ return {reply:'회신',reply2:'안내 회신',deliver:'전달',ask:'질문',work:'검산',report:'보고',phone:'전화',visit:'응대',approval:'검토',pick:'선택',confirm:'확인'}[s]||s; }
function renderCounts(){ if(!D) return; const main=D.cards.filter(c=>!c.pre); const done=main.filter(c=>S.cards[c.id]&&S.cards[c.id].status==='done'&&S.cards[c.id].act!=='none').length; $('cDone').textContent=done; $('cAll').textContent=main.length; $('cPass').textContent=S.counts.pass; $('cAsk').textContent=S.counts.ask;
  /* 남은 일이 없으면 퇴근 시각 전에도 마무리할 수 있게 한다(day.js) */
  try{ if(typeof checkAllDone==='function') checkAllDone(); }catch(e){}
  /* 머리 위 「E — 서류 전달하기」 안내를 오늘 남은 일에 맞춰 갈아 끼운다 */
  try{ if(typeof refreshTalkHints==='function') refreshTalkHints(); }catch(e){}
  if(practiceDay()){ const arrived=(ids)=>(ids||[]).filter(i=>S.cards[i]&&S.cards[i].arrived&&S.cards[i].status!=='done').length; const L=D.todoLabels||['답할 것','넘길 것','물어볼 것']; $('tAnsL').textContent=L[0]; $('tPassL').textContent=L[1]; $('tAskL').textContent=L[2]; $('tAns').textContent=arrived(D.todo.answer); $('tPass').textContent=arrived(D.todo.pass); $('tAsk').textContent=arrived(D.todo.ask); return; }
  /* 2일차부터 중립 셈(D23) — 「답할 것·넘길 것·물어볼 것」은 칸 이름이 처리 방식을 알려 준다 */
  const got=D.cards.concat(S.extra).filter(c=>S.cards[c.id]&&S.cards[c.id].arrived); const fin=got.filter(c=>S.cards[c.id].status==='done').length;
  $('tAnsL').textContent='받은 일'; $('tPassL').textContent='처리'; $('tAskL').textContent='남은 일'; $('tAns').textContent=got.length; $('tPass').textContent=fin; $('tAsk').textContent=got.length-fin; }

/* ---------- 카드 창 ---------- */
function openCard(id){ const c=CARD(id), st=S.cards[id]; if(!c||!st.arrived) return; if(S.composing&&S.composing.id!==id) closeComposer(); S.cur=id; if(st.status==='new') st.status='read';
  $('card').classList.add('open'); $('card').classList.remove('min'); const kind=c.type==='phone'?'전화':c.type==='msg'?'메신저':c.type==='visit'?'방문':c.type==='approval'?'결재 검토':c.type==='sheet'?'양식':c.type==='report'?'대면 보고':c.type==='comment'?'댓글':c.npcArrives?'대면':'메일'; $('cFrom').textContent=kind+' · '+c.from+(c.role?` (${c.role})`:''); $('cSubj').textContent=c.subj;
  renderBody(c); renderHint(id); renderCardActs(id); renderInbox(); if(window.innerWidth<=760) $('inbox').classList.remove('up'); showTab('hint'); }
function renderBody(c){ const bd=$('cBody'); bd.className='bd'+(c.type==='phone'?' phone':c.type==='sheet'||c.type==='approval'?' doc':''); bd.innerHTML='';
  const body=c.body||''; if(c.type==='sheet'&&/\n.*\|.*\|/.test(body)){ /* 파이프 표를 HTML 표로 */ const lines=body.split('\n'); let tbl=null; for(const ln of lines){ if(ln.includes('|')){ if(!tbl){ tbl=document.createElement('table'); tbl.className='sheet'; bd.appendChild(tbl); } const tr=document.createElement('tr'); ln.split('|').forEach(x=>{ const td=document.createElement(tbl.rows.length===0?'th':'td'); td.textContent=x.trim(); tr.appendChild(td); }); tbl.appendChild(tr); } else { tbl=null; const p=h('div',null,ln); bd.appendChild(p); } } }
  else bd.textContent=body; }
function closeCard(){ $('card').classList.remove('open'); S.cur=null; closeComposer(); renderInbox(); }
function note(html){ const n=$('cNote'); if(!html){ n.style.display='none'; n.textContent=''; return; } n.style.display='block'; n.innerHTML=html; }
function lockBtn(acts){ if(!D) return; for(const k of ['approval','report']){ if((D.unlock||[]).includes(k)) continue; acts.appendChild(mkBtn('🔒 '+UNLOCK_LABEL[k],'lock',()=>toast(`${UNLOCK_DAY[k]}일차에 열립니다.`))); } }
/* 45차(대표 「말·질문·서류 제출은 T로만」): 사람에게 가는 일은 컴퓨터 카드에서 누르는 단추가 아니다.
   3D 사무실이 있으면 「누구에게 가서 T」 안내만 적고, 실제 대화는 그 사람 앞에서 T 를 눌렀을 때 시작한다(js/play/talk.js).
   3D 가 없을 때(?stage=0 · 불러오기 실패)만 예전 단추로 글 연출을 한다. */
function walkT(){ return !NO_STAGE&&!!office(); }
const T_KEY='<b>T</b>';
/* 사실만 적는 안내(2일차부터) — 내가 한 일의 결과·들은 말. plain 이면 메신저용 글자 */
function factNotes(id,plain){ const c=CARD(id), st=S.cards[id], steps=st.steps||{}; const out=[]; const E=plain?(s)=>String(s==null?'':s):escapeHtml; const B=plain?(s)=>s:(s)=>`<b>${s}</b>`;
  if(st.ask) out.push(`${B(E(c.npc||st.lastNpc||'담당자')+' 답:')} “${E(st.ask.answer)}”`);
  if(steps.deliver) out.push(`${B(E((c.deliver&&c.deliver.npc)||st.lastNpc||'')+'에게 전달 완료.')} ${E(steps.deliver.line||'')}`.trim());
  if(steps.report) out.push(`${B('보고 끝.')} ${E(steps.report.line||'')}`.trim());
  /* 첫 글이 상신이면 「상신 완료」 — 두 글 카드는 순서가 자유라(composeTarget) 둘째 글만 먼저 보냈을 수도 있다 */
  if(steps.reply) out.push(B(steps.reply.key==='confirm'?E(confirmTo(c))+'에게 상신 완료.':'답장 완료.'));
  if(steps.reply2) out.push(B('답장 완료.'));
  if(st.mailTried) out.push(B('메일로는 안 받았어요.'));
  if(st.wrong) out.push(`${B(E(st.lastNpc||'상대')+':')} “${E(st.wrong)}”`);
  /* 한 단계라도 했는데 카드가 안 끝났으면 그 사실만 — 무엇이 남았는지는 말하지 않는다(메일함 「진행 중」·셈 「남은 일」과 같은 정보 · pr 2차: 상신 뒤 「답장 완료」만 보여 끝난 줄 알았다) */
  if(Object.keys(steps).length&&st.status!=='done') out.push(E('아직 끝나지 않은 건이에요.'));
  return out; }
function renderCardActs(id){ const c=CARD(id), st=S.cards[id]; const acts=$('cActs'); acts.innerHTML=''; $('composer').style.display='none'; note('');
  if(st.status==='done'){ showResult(id); return; } $('cResult').style.display='none';
  const steps=st.steps||{}; const flow=flowOf(c); const notes=[]; const P1=practiceDay();
  /* 45차: 머리말을 조회 종류에서 딴다 — 「배송 조회」→「배송 조회 결과」, 「해든소재 검사 기록 조회」→ 그대로 + 결과.
     예전에는 팀과 상관없이 「상담 기록:」이 붙어 회계·품질 카드에서도 상담 기록처럼 보였다. label 이 없으면 「조회 결과」 */
  if(c.recordLookup){ const rl=c.recordLookup; const lkHead=rl.label?`${rl.label} 결과`:'조회 결과';
    if(st.lookup) notes.push(`<b>${escapeHtml(lkHead)}:</b> ${escapeHtml(rl.result)}`); else acts.appendChild(mkBtn(rl.label||'기록 조회','',()=>{ lookupRecord(id); renderCardActs(id); })); }
  /* 57차 E2-11: 정답 행동 전용 토글(actions.stopShip 「출고 중지」)은 없앴다 — 그 카드에만 뜨는 단추가 곧 정답이었다(D24) */
  if(c.followup){ notes.push('재문의예요. 읽고 확인을 누르면 됩니다. (채점 없음)'); acts.appendChild(mkBtn('확인했어요','',()=>record(id,{act:'confirm',score:null,comment:''}))); note(notes.join('<br>')); return; }
  if(c.mode==='phone'){ notes.push('전화입니다. 어떻게 응대할까요?'); for(const k of orderOf(id,c.choiceOrder||Object.keys(c.choices||{}))) acts.appendChild(mkBtn(c.choices[k],'wide',()=>doPhone(id,k))); note(notes.join('<br>')); return; }
  if(c.mode==='visit'){ const lim=c.timeLimit?` 말을 걸면 ${c.timeLimit}초 안에 답해야 해요.`:'';
    if(walkT()&&st.visitorHere){ notes.push(`방문객 <b>${escapeHtml(c.visitorName||c.from)}</b> 님이 소파에 앉아 기다려요. 가서 ${T_KEY}로 응대하세요.${lim}`); }
    else if(walkT()&&st.visitorComing){ notes.push(`방문객이 들어오는 중이에요. 소파에 앉으면 가서 ${T_KEY}로 응대하세요.${lim}`); }
    else { notes.push('방문객이 와 있어요. 응대하러 갑니다.'+(c.timeLimit?` (${c.timeLimit}초 안에 답해야 해요)`:'')); acts.appendChild(mkBtn('응대하러 가기','',()=>doVisit(id))); }
    note(notes.join('<br>')); return; }
  if(c.mode==='reflect'){ notes.push('오늘 처리한 카드 중 하나를 골라 답장합니다.'); acts.appendChild(mkBtn('답장할 카드 고르기','',()=>renderPick(id))); note(notes.join('<br>')); return; }
  if(flow.includes('work')&&!steps.work){ notes.push(workCells(c)?`답 칸 ${workCells(c).length}개를 채워 제출하세요.`:('답 칸에 검산 결과를 적어 제출하세요.'+((c.workUnit||(c.workAnswer&&/원|건|일|%/.test(c.workAnswer)))?' 단위까지 적어요.':''))); renderWorkInput(id,acts); if(st.workTries) notes.push(`<b>다시 세어 보세요.</b> (${st.workTries}번째)`); note(notes.join('<br>')); return; }
  if(flow.includes('work')&&steps.work&&!steps.deliver){ const to=c.deliver.npc||'팀장';
    /* 「이제 ○○에게 직접 가져가세요」는 1일차 연습 안내로만 — 가져갈 곳은 카드 본문이 말한다 */
    notes.push(`<b>검산 결과 ${escapeHtml(steps.work.answer)}.</b>`+(P1?(walkT()?` 이제 ${escapeHtml(to)}에게 직접 가져가세요 — 자리로 걸어가 ${T_KEY}를 누르면 됩니다.`:` 이제 ${escapeHtml(to)}에게 직접 가져가세요.`):''));
    if(!walkT()) acts.appendChild(mkBtn(P1?`${to}에게 가져가기`:'검산 결과 가져가기','',()=>doSheetDeliver(id)));
    note(notes.join('<br>')); return; }
  if(flow.includes('approval')){ notes.push('결재 문서예요. 숫자와 규정이 맞으면 승인, 어긋나면 반려하면서 의견을 적어요.'); acts.appendChild(mkBtn('반려 의견 쓰기','',()=>openComposer(id,'approval'))); acts.appendChild(mkBtn('이상 없음(승인)','',()=>doApprove(id))); for(const k of Object.keys(c.act||{})){ if(['reply','reject','approve'].includes(k)) continue; acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); } lockBtn(acts); note(notes.join('<br>')); return; }
  /* 2일차부터 글 카드 — 공통 처리 선택지 */
  if(commonCard(c)) return renderCommon(id,acts,notes);
  /* ── 여기부터는 1일차(연습)의 흐름별 단추와 글 카드가 아닌 대면 보고 카드. 강조(pri)는 쓰지 않는다(E2-1) ── */
  if(flow.includes('report')&&!steps.report){ const who=c.npc||(c.report&&c.report.npc)||leadOfDay();
    if(!P1) notes.push('대면 보고 건이에요.');
    else if(walkT()) notes.push(`팀장에게 직접 보고하는 건이에요. 근거를 들고 <b>${escapeHtml(who)}</b> 자리로 가서 ${T_KEY}로 보고하세요.`);
    else notes.push(`팀장에게 직접 보고하는 건이에요. 근거를 들고 가세요.`);
    if(!walkT()) acts.appendChild(mkBtn(P1?`${who}에게 보고하러 가기`:'보고하러 가기','',()=>doReport(id)));
    if(st.mailTried) notes.push(`<b>메일로는 안 받았어요.</b>`+(P1?` ${escapeHtml(who)} 자리로 가서 직접 보고하세요.`:''));
    /* 46차 35: 최선 행동(보고 카드의 confirm·reject 등)은 대면 보고 + 회신으로만 닿는다 — 단추 한 번으로 최선 점수를 주지 않는다 */
    if(c.mode!=='report'||c.type!=='report'){ for(const k of Object.keys(c.act||{})){ if(k==='confirm'||k==='reply'||k==='reject'||k===c.best) continue; acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); } if(c.act&&c.act.confirm&&!st.mailTried) acts.appendChild(mkBtn('메일로 상신','',()=>doMailConfirm(id))); } lockBtn(acts); note(notes.join('<br>')); return; }
  if(flow.includes('report')&&steps.report&&!steps.reply){ notes.push(`<b>보고 끝.</b> ${escapeHtml(steps.report.line||'')}`+(P1?'<br>이제 고객에게 회신하세요 — 결론은 아직 쓰지 않아요.':'')); acts.appendChild(mkBtn(P1?'고객에게 회신':'회신 쓰기','',()=>openComposer(id,'reply',replyKey(c)))); note(notes.join('<br>')); return; }
  /* 전달 · 질문 */
  if(flow.includes('deliver')||flow.includes('ask')){ const isAsk=flow.includes('ask'); const d=c.deliver||{}; const who=isAsk?c.npc:d.npc;
    if(st.ask){ notes.push(`<b>${escapeHtml(who)} 답:</b> "${escapeHtml(st.ask.answer)}"<br>받은 답을 회신에 옮겨 적으세요.`+(st.ask.open&&st.ask.cap<100?' <b>다 못 물어본 것이 있어요</b> — 회신 점수에 상한이 걸려요.':'')); }
    else if(isAsk&&!steps.reply){ if(st.wrong) notes.push(`<b>다시 가 볼 수 있어요.</b> ${escapeHtml(st.wrong)}`);
      /* 누구에게 물을지 고르는 것이 이 카드의 일이다 — 이름을 알려 주지 않는다 */
      if(walkT()) notes.push(`이 일을 맡은 사람을 찾아가 ${T_KEY}로 여쭤보세요. 누구 소관인지는 ${toolOpen('orgchart')?'카드 내용과 조직도를':'카드 내용을'} 보고 판단해요.`+(c.askOpen?' <b>무엇을 물을지는 직접 정해요</b> — 회신에 무엇이 들어가야 하는지부터 생각해요.':''));
      else acts.appendChild(mkBtn('가서 물어보기','',()=>renderDest(id,'ask'))); }
    if(!isAsk){ if(steps.deliver){ notes.push(`<b>${escapeHtml(who)}에게 전달 완료.</b> ${escapeHtml(steps.deliver.line||'')}`+(flow.includes('reply')&&!steps.reply?`<br>이제 ${c.alsoReply===true&&c.alsoReplyTo?escapeHtml(c.alsoReplyTo):'고객'}에게 어디로 넘어갔는지 안내 회신을 보내세요.`:'')); }
      else { if(st.wrong) notes.push(`<b>다시 가 볼 수 있어요.</b> ${escapeHtml(st.wrong)}`);
        if(walkT()) notes.push(`맞는 팀 사람에게 직접 전달하는 건이에요. 그 사람 자리로 가서 ${T_KEY}를 누르세요(다른 팀 사무실은 문 앞에서 <b>E</b>).`);
        else acts.appendChild(mkBtn('가서 전달하기','',()=>renderDest(id,'deliver'))); } }
    if(flow.includes('reply')&&!steps.reply){ acts.appendChild(mkBtn(st.ask||steps.deliver?'회신 쓰기':(isAsk?'묻지 않고 회신 쓰기':'회신 쓰기'),'',()=>openComposer(id,'reply',replyKey(c)))); }
    for(const k of Object.keys(c.act||{})){ if(k==='delegate'||k==='reply'||k==='reject'||(c.best===k&&k!=='hold')) continue; acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); }
    lockBtn(acts); note(notes.join('<br>')); return; }
  /* 회신형 · 작성형 · 메신저 · 상신 · 기록 — 「거절」 단추는 없다(D11: 거절은 회신의 내용 · 회신 키가 reject) */
  if(c.unscored||c.axis==='self') notes.push('기록용이에요. 점수에는 넣지 않습니다.');
  if(typeof c.alsoReply==='object'&&steps.reply&&!steps.reply2) notes.push(`<b>${escapeHtml(c.from)}에게 답장 완료.</b>`+(P1?` 이제 ${escapeHtml(c.alsoReply.to)}에게 정정 안내를 보내세요.`:''));
  else if(c.alsoReply===true&&steps.reply&&!steps.reply2) notes.push(`<b>답장 완료.</b>`+(P1?` 이제 ${escapeHtml(c.alsoReplyTo||'고객')}에게 안내 회신을 보내세요.`:''));
  if(steps.reply&&flow.includes('reply2')&&!steps.reply2){ acts.appendChild(mkBtn(P1?`${c.alsoReplyTo||(typeof c.alsoReply==='object'?c.alsoReply.to:'고객')}에게 안내 회신`:'회신 쓰기','',()=>openComposer(id,'reply2','reply'))); note(notes.join('<br>')); return; }
  const keys=Object.keys(c.act||{}).filter(k=>k!=='reject'); if(!keys.includes('reply')&&c.scored!==false&&isTextCard(c)) keys.unshift('reply');
  for(const k of keys){ const textual=(k==='reply')||(k===c.best&&k==='confirm'&&(hasCompose(c)||c.alsoReply)); if(textual) acts.appendChild(mkBtn(k==='reply'?(c.type==='msg'?'답장 쓰기':'회신 쓰기'):actLabel(k),'',()=>openComposer(id,'reply',k==='reply'?replyKey(c):k))); else acts.appendChild(mkBtn(actLabel(k),'',()=>doButton(id,k))); }
  if(c.scored!==false) lockBtn(acts); note(notes.join('<br>')); }
/* 2일차부터 채점 글 카드 — 흐름과 상관없이 같은 단추, 같은 모양(강조 없음) */
function renderCommon(id,acts,notes){ const c=CARD(id), st=S.cards[id];
  for(const t of factNotes(id)) notes.push(t);
  if(st.go&&walkT()) notes.push(escapeHtml(GO_NOTE[st.go]||''));
  const add=(label,fn)=>acts.appendChild(mkBtn(label,'',fn));
  add(c.type==='msg'?'답장 쓰기':'회신 쓰기',()=>pickCommon(id,'reply'));
  add('상신하기',()=>pickCommon(id,'confirm'));
  add('가서 전달하기',()=>pickCommon(id,'deliver'));
  add('가서 묻기',()=>pickCommon(id,'ask'));
  add('보류',()=>pickCommon(id,'hold'));
  if(toolOpen('report')) add(UNLOCK_LABEL.report,()=>pickCommon(id,'report'));
  lockBtn(acts); note(notes.join('<br>')); }
/* 공통 처리 선택지 하나를 골랐다 */
function pickCommon(id,ch){ const c=CARD(id), st=S.cards[id]; if(!c||!st||st.status==='done') return;
  const steps=st.steps||{}, flow=flowOf(c);
  if(ch==='reply'||ch==='confirm'){
    if(ch==='confirm'&&st.mailTried&&(c.mode==='report'||c.type==='report')){ toast('메일로는 안 받았어요.'); return; }
    const t=composeTarget(c,st,ch); if(t.done){ toast(t.done); return; }
    return openComposer(id,t.which,t.key); }
  if(ch==='hold'){ delete st.go; return actEnd(id,'hold',{flowSkip:flow[0]!=='reply'}); }
  return goChoice(id,ch); }
/* 가서 전달하기 · 가서 묻기 · 대면 보고 — 3D 가 있으면 고른 것만 적어 두고(그 사람에게 가서 T · talk.js tasksFor), 없으면 사람을 고른다 */
async function goChoice(id,kind){ const c=CARD(id), st=S.cards[id]; if(!c||!st||st.status==='done') return; const steps=st.steps||{};
  if(kind==='deliver'&&steps.deliver){ toast('이미 전달했어요.'); return; }
  if(kind==='ask'&&st.ask){ toast('이미 물어봤어요.'); return; }
  if(kind==='report'&&steps.report){ toast('이미 보고했어요.'); return; }
  if(walkT()){ st.go=kind; toast(GO_NOTE[kind]); try{ if(typeof refreshTalkHints==='function') refreshTalkHints(); }catch(e){}
    if(S.cur===id) renderCardActs(id); if(c.type==='msg'&&window.Msg) Msg.refresh(); saveProgress(); return; }
  if(kind==='report'){ await doReport(id); if(c.type==='msg') msgResultNote(id); return; }
  if(c.type==='msg') return msgGo(id,kind);
  renderDest(id,kind); }
function renderWorkInput(id,acts){ const c=CARD(id); const cells=workCells(c); const wrap=h('div','work'+(cells?' multi':'')); const st=S.cards[id]||{};
  if(cells){ const box=h('div','wcells'); const ins={};
    /* 틀린 제출 뒤에는 맞은 칸의 값을 그대로 둔다 — 예전에는 전부 비워져 틀린 칸만 고친 두 번째 제출도 실패했다(57차 E1 후속 · QA Y-9) */
    const draft=st.workDraft||null, wrongL=st.workWrong||[];
    for(const cell of cells){ const row=h('div','wrow'); row.appendChild(h('label',null,cell.label||cell.key)); const inp=document.createElement('input'); inp.type='text'; inp.autocomplete='off'; inp.placeholder=cell.hint||'';
      if(draft&&draft[cell.key]!=null&&!wrongL.includes(cell.label||cell.key)) inp.value=String(draft[cell.key]);
      ins[cell.key]=inp; row.appendChild(inp); if(cell.unit) row.appendChild(h('span','unit',cell.unit)); box.appendChild(row); }
    wrap.appendChild(box); wrap.appendChild(mkBtn('검산 제출','pri',()=>{ const got={}; for(const k of Object.keys(ins)) got[k]=ins[k].value.trim(); doWork(id,got); }));
    acts.appendChild(wrap); setTimeout(()=>{ const f=ins[cells[0].key]; if(f) f.focus(); },50); return; }
  const inp=document.createElement('input'); inp.type='text'; inp.id='workAns'; inp.placeholder=c.workHint||'답 — 숫자와 단위를 함께(일·원·건·%)'; inp.autocomplete='off'; wrap.appendChild(inp); wrap.appendChild(mkBtn('검산 제출','pri',()=>doWork(id,inp.value))); acts.appendChild(wrap); setTimeout(()=>inp.focus(),50); }
/* 누구에게 갈지 — 조직도 전체(팀 → 사람). 오늘 카드의 상대만 모은 목록(D.dests)은 그 자체가 정답표라 쓰지 않는다
   (예전에는 팀장이 그 건의 상대일 때만 목록에 뜨고, 상대가 목록에 없으면 맨 끝에 붙였다 — A Y5) */
function orgTeams(){ const out=[]; const seen=new Set(); const order=[S.team].concat(TEAM_ORDER.filter(k=>k!==S.team));
  const add=(k,name,seat)=>{ if(!k||!name||seen.has(name)) return; seen.add(name); let t=out.find(x=>x.key===k); if(!t){ t={key:k,team:TEAM_NAMES[k]||k,people:[]}; out.push(t); } const v=npcInfo(name); t.people.push({seat:(v&&v.seat)||seat||null,name,team:TEAM_NAMES[k]||(v&&v.team)||'',key:k}); };
  /* ORG.more — 늘 조직도에 있는 조력자(57차 E2후속 F8 · core.js). 예전에는 그날 화에 나오는 날에만 줄 끝에 붙어 그날의 정답 상대가 튀었다 */
  for(const k of order){ const o=ORG[k]; if(!o) continue; if(k===S.team){ add(k,o.lead,'lead'); add(k,o.senior,'senior'); add(k,o.chief,'chief'); } else { add(k,o.senior,null); add(k,o.chief,null); } for(const n of (o.more||[])) add(k,n,null); }
  /* 오늘 화에만 이름이 있는 사람도 제 팀 줄에(닿지 못하는 상대가 없게) — 새 조력자를 데이터에 넣으면 core.js ORG.more 에도 넣어야 그날만 튀지 않는다 */
  const keyOfTeam=(tn)=>Object.keys(TEAM_NAMES).find(x=>TEAM_NAMES[x]===tn)||null;
  for(const [n,v] of Object.entries((D&&D.npcs)||{})) add(v.teamKey||keyOfTeam(v.team),n,v.seat);
  for(const d of ((D&&D.dests)||[])) add(d.key,d.name,d.seat);
  return out.sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key)); }
const teamBtnLabel=(t)=>t.team+(t.key===S.team?' (우리 팀)':'');
function renderDest(id,kind,teamKey){ const acts=$('cActs'); acts.innerHTML=''; const teams=orgTeams();
  if(!teamKey){ note(kind==='ask'?'누구에게 물어볼까요? 먼저 팀을 고르세요.':'누구에게 전달할까요? 먼저 팀을 고르세요.');
    for(const t of teams) acts.appendChild(mkBtn(teamBtnLabel(t),'wide',()=>renderDest(id,kind,t.key)));
    acts.appendChild(mkBtn('돌아가기','',()=>renderCardActs(id))); return; }
  const t=teams.find(x=>x.key===teamKey)||{team:'',people:[]}; note(`${escapeHtml(t.team)} — 누구에게 갈까요?`);
  for(const d of t.people) acts.appendChild(mkBtn(`${d.name} · ${d.team}`,'wide',()=>kind==='ask'?doAsk(id,d):doDeliver(id,d)));
  acts.appendChild(mkBtn('팀 다시 고르기','',()=>renderDest(id,kind))); acts.appendChild(mkBtn('돌아가기','',()=>renderCardActs(id))); }
function renderPick(id){ const c=CARD(id); const acts=$('cActs'); acts.innerHTML=''; note('규정에 근거가 있을 것 같은 건 어느 것이었나요?');
  const cands=S.order.filter(i=>i!==id&&CARD(i)&&!CARD(i).followup&&CARD(i).scored!==false); for(const i of pickOrder(id,cands)){ acts.appendChild(mkBtn(CARD(i).subj,'wide',()=>doPick(id,i))); } acts.appendChild(mkBtn('돌아가기','',()=>renderCardActs(id))); }
function showResult(id){ const c=CARD(id), st=S.cards[id]; const r=$('cResult'); r.style.display='block'; r.innerHTML=''; $('cActs').innerHTML='';
  const sc=h('div','score',st.score==null?(st.act==='none'?'미처리':'답장함'):String(st.score)); if(st.score!=null){ sc.appendChild(h('small',null,`${actLabel(st.act)}${st.late?' · 마감 지남':' · 제때'}`)); } if(st.source) sc.appendChild(h('span','src '+(st.source==='AI 첨삭'?'ai':''),st.source)); r.appendChild(sc);
  if(st.comment) r.appendChild(h('div','cm',st.comment));
  for(const d of [st.detail,st.detail2]){ if(!d||!d.els) continue; const els=h('div','els'); for(const [k,v] of Object.entries(d.els)) els.appendChild(h('span','el '+(v?'on':''),k)); if(d.cited===false) els.appendChild(h('span','el bad','조항 인용 없음')); for(const m of (d.missing||[])) els.appendChild(h('span','el bad','빠짐: '+m)); for(const f of (d.forbid||[])) els.appendChild(h('span','el bad','금지 표현: '+f)); if(d.partial) els.appendChild(h('span','el bad','답이 절반')); r.appendChild(els); }
  if(st.feedback){ r.appendChild(h('div','fb',st.feedback)); }
  for(const [label,txt] of [['내가 쓴 답장',st.text],['내가 쓴 안내 회신',st.text2]]){ if(!txt) continue; const d=document.createElement('details'); d.appendChild(h('summary',null,label)); d.appendChild(h('pre',null,txt)); r.appendChild(d); }
  const model=composeSpec(c).model||st.model; if(model&&(st.text!=null||st.text2!=null)){ const d=document.createElement('details'); d.appendChild(h('summary',null,'모범 답안 보기')); d.appendChild(h('pre',null,model)); r.appendChild(d); } }

/* ---------- 작성기 ---------- */
/* key: reply · reject(D11 — best=reject 카드의 회신) · confirm(상신하기 — 2일차부터 팀장에게 쓰는 글) */
function openComposer(id,which,key){ const c=CARD(id); which=which||'reply'; key=key||(which==='reply'?replyKey(c):'reply'); S.composing={id,which,key}; const box=$('composer'); box.style.display='block';
  /* 받는 사람(E2-13 · 57차 E2후속 F12): 회신은 replyTo(있으면) → 보낸 사람 · 둘째 글은 alsoReply.to.
     〔상신하기〕는 팀장(또는 카드의 결재자 — confirmTo) 앞 보고다. 요청자·고객에게 알릴 것은 둘째 글로 따로 쓴다(예전에는 replyTo 가 있으면 상신도 그 사람에게) */
  const up=key==='confirm'&&which==='reply'&&commonCard(c);
  const to=which==='reply2'?(typeof c.alsoReply==='object'?c.alsoReply.to:(c.alsoReplyTo||'고객')):(which==='approval'?c.from:up?confirmTo(c):(c.replyTo||c.from||'')); $('cpTo').textContent=to; $('cpSubj').textContent=(which==='approval'?'[반려] ':up?'[상신] ':'RE: ')+c.subj;
  /* 자리표시자·안내는 고른 처리(회신·상신)로만 달라진다 — 카드의 정답(거절 등)으로 달라지면 그게 곧 답이다.
     상신 자리표시자는 「한 글로 두 사람에게」 쓰게 하던 것을 규칙(상신 = 팀장·결재자 앞 보고, 요청자 안내는 따로)에 맞게 — 모든 상신에 같은 문장 */
  const ta=$('composeText'); ta.value=''; $('cpLen').textContent='0자'; ta.placeholder=which==='approval'?'반려 사유와 맞는 값을 적어 주세요.':up?`${to}에게 올리는 보고예요. 무슨 건인지, 판단받을 것과 그 근거를 적어요. 요청한 사람에게 알릴 것이 있으면 따로 보내요.`:c.type==='msg'?'메신저는 짧게, 용건과 다음 행동만.':'고객이 무엇을 원하는지 한 줄로 먼저 적고, 답장을 써 보세요.';
  /* 결과값 칸은 결과값을 적는 첫 글에만(두 번째 글 alsoReply 에는 없다 — cs 2차: 비워 보내면 되돌려져 39일을 또 적어야 끝났다) */
  const needWork=which!=='reply2'&&!!(c.workAnswer||c.hasWork)&&!(flowOf(c).includes('work')); const wa=$('cpWork'); wa.style.display=needWork?'flex':'none'; $('cpWorkIn').value=''; if(needWork) $('cpWorkIn').placeholder=c.workHint||RESULT_PH;
  const meta=specMeta(c,which==='reply2'?'second':null); $('cActs').innerHTML='';
  /* 「반드시 들어갈 값 N가지」「근거 조항 번호」는 1일차 연습 안내로만(D21) — 2일차부터는 규정을 스스로 찾는다 */
  const tips=[]; if(practiceDay()){ if(meta.must) tips.push(`반드시 들어갈 값 ${meta.must}가지`); if(meta.rules&&toolOpen('rulebook')) tips.push('근거 조항 번호를 붙여요(오른쪽 사규집)'); } if(!tips.length) tips.push('인사 · 확인 · 답 · 다음 행동 · 맺음, 다섯 가지를 담아 보세요.');
  note(escapeHtml(tips.join(' · ')));
  const md=aiOn()?'AI 첨삭':'규칙 채점'; $('cpMode').textContent=md; $('cpMode').className='mode'+(aiOn()?' ai':''); setTimeout(()=>ta.focus(),50); }
function closeComposer(){ S.composing=null; $('composer').style.display='none'; }
$('composeText').addEventListener('input',e=>{ $('cpLen').textContent=e.target.value.length+'자'; });
$('composeCancel').onclick=()=>{ const cp=S.composing; closeComposer(); if(cp) renderCardActs(cp.id); };
$('composeSend').onclick=()=>{ const cp=S.composing; if(!cp) return; const text=$('composeText').value.trim(); if(text.replace(/\s/g,'').length<8){ toast('내용이 너무 짧아요. 한 줄이라도 용건을 적어 주세요.'); return; } const ans=$('cpWork').style.display!=='none'?$('cpWorkIn').value.trim():null;
  /* 결과값 칸을 비운 채 보내면 보내지 않는다 — 예전에는 서버가 틀린 값으로 세어 두 번째 제출이 최종(0점)이 됐다(57차 E1 후속 · QA Y-10) */
  if(ans!=null&&!ans){ toast('결과값 칸을 채워 주세요. 글과 따로 숫자를 적는 칸이에요.'); const w=$('cpWorkIn'); if(w) w.focus(); return; } sendCompose(cp.id,text,cp.which,cp.key,ans); };

/* 쓴 글이 어디로 가나(2일차부터 공통 처리 선택지 — spec §7 E2-2)
     step  흐름 안의 회신(또는 안내 회신) 단계 → 채점 뒤 단계 기록
     end   회신형 카드에서 정답이 아닌 처리(상신·회신)로 씀 → 채점(act 상한은 Score.text) 뒤 그대로 끝
     act   회신 단계가 없는 흐름(전달·질문·보고)에 쓴 글 · act 에 없는 키 → act 점수로 끝(actEnd)
     mail  대면 보고 카드의 상신 → 메일로 상신(데이터 분기 점수) */
function writeRoute(c,which,key){ if(!commonCard(c)||which==='reply2') return 'step';
  const flow=flowOf(c);
  if(key==='confirm'&&(c.mode==='report'||c.type==='report')) return 'mail';
  if(!flow.includes('reply')) return 'act';
  if(flow[0]!=='reply') return key==='confirm'?'act':'step';
  if(key===c.best) return 'step';
  /* 흐름 밖 상신(회신형에 〔상신하기〕)도 act 로 — 상신 글은 팀장 앞 보고라 요청자 회신 규격으로 채점하지 않는다(actEnd · 57차 E2후속 F12 cs 2차) */
  if(key==='confirm') return 'act';
  return hasAct(c,key)?'end':'act'; }
/* 작성 제출: 채점(Grader — 로컬은 규칙+AI, 배포본은 서버) → 분기·셈·상태 반영 → 단계 기록. 채점 계산은 grade.js Score.text 에 있다 */
async function sendCompose(id,text,which,key,ans){ const c=CARD(id), st=S.cards[id]; which=which||'reply'; key=key||'reply'; closeComposer(); $('composeSend').disabled=true;
  if(key==='reject'&&which==='reply'&&commonCard(c)&&!flowOf(c).includes('reply')) key='reply';   /* D11 의 reject 키는 회신이 흐름 안일 때만(C10 — 검사 API 가 reject 를 넘겨도 화면과 같게) */
  try{
    if(which==='approval') return await sendApproval(id,text,ans);
    const route=writeRoute(c,which,key);
    if(route==='mail') return await doMailConfirm(id,text);
    if(route==='act') return await actEnd(id,key,{flowSkip:true,text});
    const isSecond=which==='reply2'; if(isSecond) st.text2=text; else st.text=text;
    let r; try{ r=await Grader.text(c,{text,which,key,ans,st:{workTries:st.workTries||0,ask:st.ask?{cap:st.ask.cap}:null}}); }catch(e){ gradeFail(id,e); return; }
    /* 무채점(동기 메신저·기록용) */
    if(r.unscored){ st.source=null; takeEv(id,r,false); if(c.clue&&c.clue.requiresReply) captureClue(c,st,true); markStep(id,which,{text}); for(const k of r.branches) runBranch(id,k); return; }
    applyFlags(st,r.flags);
    if(r.retry){ retryWork(id,which,key,text,ans); return {retry:true}; }
    applyCounts(r.counts);   /* 셈은 끝난 결과만 — 결과값 재시도 응답까지 더해 「계산 정확 0/2」가 됐다(57차 E1 후속 · QA W-1) */
    /* 처리 키는 서버가 정한다(57차 E1 B5 — D11 거절 키 · 수락 글이면 reply) */
    if(r.key) key=r.key; takeEv(id,r); if(r.aiq!=null) st.aiq=r.aiq;
    /* 모범 답안·정답 코멘트는 최종 결과에서만 남긴다 — 재시도 응답에 실려 와도(옛 서버 번들) 카드 상태·저장에 넣지 않는다(57차 R3) */
    if(r.bestComment) st.bestComment=r.bestComment; if(r.model) st.model=r.model;
    for(const k of r.branches) runBranch(id,k);
    if(isSecond) st.detail2=r.detail; else st.detail=r.detail; st.source=r.source; if(r.feedback) st.feedback=r.feedback;
    if(route==='end'){ st.off=1; record(id,{act:key,score:r.score,comment:r.comment,text}); return; }
    markStep(id,which,{text,score:r.score,comment:r.comment,key}); }
  finally{ $('composeSend').disabled=false; } }
/* 결과값 첫 오답 — 쓴 글·결과값을 그대로 두고 다시 쓰게 한다(메신저는 메신저 칸에서 · D-fixes §5-3) */
const MSG_ANS={};
function retryMsg(c){ const u=String(c.workAnswer||c.workUnit||c.workHint||'');
  if(/%|퍼센트|율|비중/.test(u)) return '결과값이 맞지 않아요. 비율을 다시 계산해 보고 보내 주세요.';
  if(/원|금액|예산|비용/.test(u)) return '결과값이 맞지 않아요. 금액을 다시 계산해 보고 보내 주세요.';
  if(/건|개|명|곳|장|박스|권|대|수량/.test(u)) return '결과값이 맞지 않아요. 다시 세어 보고 보내 주세요.';
  if(/일|요일|주|월|날짜|시간|분/.test(u)) return '결과값이 맞지 않아요. 날짜·기간을 다시 따져 보고 보내 주세요.';
  return '결과값이 맞지 않아요. 계산을 다시 확인하고 보내 주세요.'; }
function retryWork(id,which,key,text,ans){ const c=CARD(id); toast(retryMsg(c)); $('composeSend').disabled=false;
  if(c.type==='msg'){ const who=(window.Msg&&Msg.whoOf(id))||msgWho(c); if(window.Msg){ Msg.draft(who,text,id); Msg.refresh(); } MSG_ANS[id]=ans==null?'':ans; return; }
  openComposer(id,which,key); $('composeText').value=text; $('cpLen').textContent=text.length+'자'; $('cpWorkIn').value=ans==null?'':ans; }
async function sendApproval(id,text,ans){ const c=CARD(id), st=S.cards[id]; st.text=text;
  let r; try{ r=await Grader.approval(c,{text,ans}); }catch(e){ gradeFail(id,e); return; }
  if(r.approve) return doApprove(id);
  applyFlags(st,r.flags); applyCounts(r.counts); takeEv(id,r); if(r.aiq!=null) st.aiq=r.aiq; if(r.bestComment) st.bestComment=r.bestComment; if(r.model) st.model=r.model; for(const k of r.branches) runBranch(id,k);
  st.detail=r.detail; st.source=r.source; if(r.feedback) st.feedback=r.feedback; markStep(id,'approval',{text,score:r.score,comment:r.comment,key:'reject'}); }
async function doApprove(id){ const c=CARD(id); let r; try{ r=await Grader.run('approve',c,{}); }catch(e){ return gradeFail(id,e); } S.counts.rejectAll++; takeEv(id,r); if(r.bestComment) S.cards[id].bestComment=r.bestComment; markStep(id,'approval',{score:r.score,comment:r.comment,key:'approve'}); if(r.branch) runBranch(id,r.branch); }

/* ---------- 흐름 밖 처리로 끝내기(spec §7 E2-2) ----------
   고른 처리로 카드를 끝낸다. 57차 E1(B5 · E2f §8-1): 점수 규칙(① act 에 없는 키 = 최저점 · ② 흐름을 건너뛴 최선 키 · ③ 만점 키가 둘 → 최선보다 낮은 것 중 최고, 50 상한 ·
   글을 쓴 처리는 그 글도 채점해 둘 중 낮은 쪽 · 〔상신하기〕 글은 보고의 꼴 upForm)은 grade.js Score.offFlow 한 곳에 있다 — 배포본은 서버에 **한 번** 묻는다(예전 2~6건).
   증거도 그 결과에 붙어 온다(D12 ① — 주 항목 0! · 처리 판단은 고른 처리 · 글이면 글 짜임 · 단계를 하나라도 했으면 끝까지 0) */
async function actEnd(id,key,opt){ opt=opt||{}; const c=CARD(id), st=S.cards[id]; if(!c||!st||st.status==='done') return;
  const have=(typeof Ev!=='undefined')?Ev.parse(st.ev).map(e=>e.i):[]; const started=!!(st.steps&&Object.keys(st.steps).length);
  let r; try{ r=await Grader.offFlow(c,{key,flowSkip:!!opt.flowSkip,text:opt.text!=null?opt.text:null,st:{ask:st.ask?{cap:st.ask.cap}:null},have,started,tries:st.tries||0}); }catch(e){ return gradeFail(id,e); }
  if(st.status==='done'||!r) return;
  applyFlags(st,r.flags); applyCounts(r.counts); if(r.detail) st.detail=r.detail; if(r.source) st.source=r.source; if(r.feedback) st.feedback=r.feedback; if(r.aiq!=null) st.aiq=r.aiq;
  if(key==='delegate') S.counts.pass++; if(key==='confirm') S.counts.ask++; if(r.bestRC){ S.counts.rejectAll++; if(r.isBest) S.counts.reject++; }
  st.choice=key; if(r.bestComment) st.bestComment=r.bestComment; if(!r.isBest) st.off=1;
  takeEv(id,r);
  record(id,{act:key,score:r.score,comment:r.comment,text:opt.text});
  for(const b of (r.branches||[])) runBranch(id,b); }

/* ---------- 버튼 · 전화 · 반성 · 검산 ---------- */
async function doButton(id,k,branchKey){ const c=CARD(id); const st=S.cards[id]; if(!(c.act&&c.act[k])||st.status==='done') return; let r; try{ r=await Grader.run('act',c,{key:k}); }catch(e){ return gradeFail(id,e); } if(!r.ok||st.status==='done') return;
  if(k==='delegate') S.counts.pass++; if(k==='confirm') S.counts.ask++; if(r.bestRC){ S.counts.rejectAll++; if(r.isBest) S.counts.reject++; }
  st.choice=k; if(r.bestComment) st.bestComment=r.bestComment; takeEv(id,r); record(id,{act:k,score:r.score,comment:r.comment}); if(!r.isBest){ runBranch(id,branchKey||k)||runBranch(id,'other'); } else runBranch(id,branchKey||'ok'); }
/* 46차 35(메인 「메일로 온 대면 보고 카드를 「메일로 상신」만 눌러도 100점」): 메일·메신저로 온 보고 카드(mode report)를
   자리로 안 가고 글로 올린 경우. 예전에는 doButton('confirm') 이 act.confirm(최선 100)을 그대로 적고 7일차 단서까지 챙겼다.
   정본은 데이터 분기 branches[id].mailConfirm.today(각 팀 5화 md 선택 분기 표 「메일로 상신」 행) —
   cs10·lg10·rc12·acct·ga·plan 60 · pr 50 · qc12 45 · edu 30. 점수가 없으면(buy by12 「시간 −1.5분 뒤 대면으로」) 끝내지 않고
   팀장 한마디만 듣고 대면 보고로 돌아간다. 어느 쪽이든 단서는 챙기지 않는다(reportBest=false · 분기 clueGap). */
/* mailConfirmBranch 는 grade.js 에 있다 */
async function doMailConfirm(id,text){ const c=CARD(id), st=S.cards[id]; if(!c||!st||st.status==='done') return;
  let r; try{ r=await Grader.run('mailConfirm',c,{}); }catch(e){ return gradeFail(id,e); } if(st.status==='done') return;
  if(r.mode==='act'){ /* 분기 표에 「메일로 상신」 행이 없는 카드는 act.confirm 이 데이터 점수다 */
    if(!r.ok) return;
    if(r.isBest&&commonCard(c)) return actEnd(id,'confirm',{flowSkip:true,text});   /* 대면 보고를 건너뛴 상신 — 최선 점수를 주지 않는다 */
    S.counts.ask++; if(r.bestRC){ S.counts.rejectAll++; if(r.isBest) S.counts.reject++; } st.choice='confirm'; if(r.bestComment) st.bestComment=r.bestComment; if(!r.isBest&&commonCard(c)) st.off=1; takeEv(id,r); record(id,{act:'confirm',score:r.score,comment:r.comment,text}); if(!r.isBest){ runBranch(id,'mailConfirm')||runBranch(id,'other'); } else runBranch(id,'mailConfirm'); return; }
  st.lastNpc=c.npc||st.lastNpc; st.lastSeat='lead';
  if(r.mode==='line'){ st.mailTried=true; runBranch(id,'mailConfirm'); if(S.cur===id) renderCardActs(id); if(c.type==='msg'&&window.Msg) Msg.refresh(); renderInbox(); saveProgress(); return; }
  S.counts.ask++; if(r.bestRC) S.counts.rejectAll++;
  st.choice='mailConfirm'; st.reportBest=false; if(commonCard(c)) st.off=1; takeEv(id,r);
  record(id,{act:'confirm',score:r.score,comment:'메일로만 올렸어요. 이 건은 근거를 들고 팀장 자리로 가서 직접 보고해야 해요.',text}); runBranch(id,'mailConfirm'); }
/* 전화·방문 무응답 — 증거(pick 0)는 서버가 낸다(배포본은 선택 항목을 모른다). 실패해도 하루는 막지 않는다 */
async function timeoutEv(id){ try{ const r=await Grader.run('act',CARD(id),{key:'timeout'}); takeEv(id,r); }catch(e){ S.evPart=1; } }
async function doPhone(id,k,keepAfter){ const c=CARD(id); const st=S.cards[id]; if(!(c.act&&c.act[k])||st.status==='done') return null; let r; try{ r=await Grader.run('act',c,{key:k}); }catch(e){ gradeFail(id,e); return null; } if(!r.ok||st.status==='done') return null;
  st.choice=k; if(k==='promise') S.counts.promise++; if(r.bestComment) st.bestComment=r.bestComment; takeEv(id,r); record(id,{act:k,score:r.score,comment:r.comment});
  /* 전화 너머 상대의 반응은 곧바로 — 통화 창이 열려 있으면 그 안에 이어진다(Talk.reply) */
  runBranch(id,r.branch,{toastOnly:true})||runBranch(id,k,{toastOnly:true}); const after=r.after;
  /* 전화 너머의 한마디는 **통화 대화창 안에서** 듣는다(45차 — 말풍선·알림 없음).
     받기 화면(answerPhone)에서 부르면 keepAfter 로 돌려받아 같은 창에 잇고, 그 밖(자동 플레이·카드 단추)에서는
     잠깐 대화창을 띄워 읽힌다. 메신저 대화방은 새로 파지 않는다(대표 "너무 산만해"). */
  /* 끊은 뒤 한마디가 **옆자리 동료**(사수 등)의 말이면 그 사람에게 쌓아 두고 T 로 듣게 한다(말풍선 없음) */
  if(after&&seatByName(after.who)&&window.Talk&&Talk.hear){ Talk.hear(after.who,after.text); return null; }
  if(after&&!keepAfter){ if(window.Talk&&Talk.say) Talk.say(after.who,after.text,{role:'전화',sess:null}); else toast(after.text,after.who,5000,'cust'); }
  return after||null; }
async function doPick(id,pick){ const c=CARD(id); const pc=CARD(pick); let r; try{ r=await Grader.run('pick',c,{pick}); }catch(e){ return gradeFail(id,e); } takeEv(id,r); S.cards[id].text=`"${pc.subj}" 건이요.`; record(id,{act:'reply',score:r.ok?100:60,comment:r.comment||'',text:S.cards[id].text}); runBranch(id,r.ok?'ok':'fallback'); }
async function doWork(id,ans){ const c=CARD(id), st=S.cards[id]; if(st.status==='done'||(st.steps&&st.steps.work)) return; let w; try{ w=await Grader.run('work',c,{ans,st:{workTries:st.workTries||0}}); }catch(e){ return gradeFail(id,e); } const shown=workText(c,ans); st.answer=shown; S.counts.calcAll++; if(w.bestComment) st.bestComment=w.bestComment;
  /* 증거(work)는 끝났을 때만 온다 — 맞음·함정·세 번째 오답(앞선 오답 수는 st.workTries — 배포본은 서버가 센 값과 큰 쪽) */
  if(w.ok||w.trap||(st.workTries||0)>=2) takeEv(id,w);
  if(w.ok){ S.counts.calc++; st.workOk=true; toast('검산 결과가 맞아요.'); markStep(id,'work',{answer:shown,score:100}); return; }
  st.workTries=(st.workTries||0)+1; if(w.trap){ st.workOk=false; runBranch(id,'trap'); markStep(id,'work',{answer:shown,score:20,comment:'표의 숫자를 그대로 믿었어요.'}); if(c.deliver){ /* 전달 단계는 열리지 않는다 */ st.steps.deliver={at:S.t,score:0,skipped:true}; finalize(id); } return; }
  if(st.workTries>=3){ st.workOk=false; runBranch(id,'wrong'); markStep(id,'work',{answer:shown,score:0,comment:'세 번 틀렸어요.'}); if(c.deliver){ st.steps.deliver={at:S.t,score:0,skipped:true}; finalize(id); } return; }
  if(workCells(c)&&ans&&typeof ans==='object'){ st.workDraft=Object.assign({},ans); st.workWrong=(w.wrong||[]).slice(); }
  toast(w.wrong&&w.wrong.length?`아직 맞지 않은 칸: ${w.wrong.join(', ')}`:'답이 맞지 않아요. 사유별로 다시 세어 보세요.'); if(S.cur===id) renderCardActs(id); if(c.type==='msg'&&window.Msg) Msg.refresh(); saveProgress(); }

/* ---------- 방문객 도착(45차) ----------
   「응대하러 가기」 단추 대신 방문객이 **먼저 들어와 소파에 앉는다** → 머리 위 표시 → 가서 T.
   3D 계약 `visitorIn({visitor,name,gender}) → Promise<boolean>` · `visitorOut()` 이 있을 때만. 없으면 카드의 예전 단추로 한다. */
function visitArrive(c){ const O=office(); const st=S.cards[c.id]; if(!O||NO_STAGE||!st||typeof O.visitorIn!=='function'||st.visitorComing||st.visitorHere) return;
  const name=c.visitorName||c.from; st.visitorComing=true; if(S.cur===c.id) renderCardActs(c.id);
  const vo={name}; if(c.visitor) vo.visitor=c.visitor; if(c.visitorGender) vo.gender=c.visitorGender;
  Promise.resolve().then(()=>O.visitorIn(vo)).then(ok=>{ st.visitorComing=false;
    if(ok&&st.status!=='done'){ st.visitorHere=true; try{ O.setTalkHint('visitor','T — 응대하기'); }catch(e){} }
    if(S.cur===c.id) renderCardActs(c.id); },()=>{ st.visitorComing=false; if(S.cur===c.id) renderCardActs(c.id); }); }
{ const _na=window.notifyArrive; if(typeof _na==='function') window.notifyArrive=function(c){ const r=_na.apply(this,arguments); try{ if(c&&c.mode==='visit') visitArrive(c); }catch(e){} return r; }; }

/* ---------- 전달 · 질문 · 보고 · 방문 ---------- */
function destOk(c,d,kind){ const target=kind==='ask'?{npc:c.npc,to:c.to}:{npc:c.deliver.npc,to:c.deliver.to}; if(target.npc&&d.name===target.npc) return true; if(target.to&&d.key&&d.key===target.to&&(!target.npc||!npcInfo(target.npc))) return true; return false; }
/* 틀린 상대의 말 — 정답 팀을 말하지 않는다(spec §4-3-3 · 예전 기본값 「그건 ○○팀이요」) */
function neutralWrong(d){ return d&&d.key===S.team?'그건 제가 맡는 일이 아니에요.':'그건 저희 소관이 아니에요.'; }
/* 맞는 팀의 다른 사람인가(57차 E1 후속 · QA Y-3) — 정답 상대(npc)가 있고 그 사람의 팀에 갔지만 사람이 다를 때. 그 사람은 자기 팀을 부정하지 않는다 */
function sameTeamWrong(c,d,kind){ const t=kind==='ask'?{npc:c.npc,to:c.to}:{npc:(c.deliver||{}).npc,to:(c.deliver||{}).to}; if(!t.npc||!d||d.name===t.npc) return false;
  const k=t.to||orgKeyOf(t.npc); return !!k&&d.key===k; }
function wrongLine(c,d,kind){ if(sameTeamWrong(c,d,kind)) return '그건 제 담당이 아니에요. 저희 팀에 맡는 분이 따로 있어요.';
  const w=kind==='ask'?c.wrongNpcLine:(c.deliver&&c.deliver.wrongNpcLine); if(typeof w==='string') return w; if(w&&d.key&&w[d.key]) return w[d.key]; return neutralWrong(d); }
/* 사수의 기본 대사 — 정답 팀·담당자를 말하지 않는다(D20 · E2-7). 우리 팀 일인 질문도 있어 「우리 팀 일이 아니에요」라고 단정하지 않는다 */
function sasuLine(){ return toolOpen('orgchart')?'그건 제가 답할 게 아니에요. 누가 맡는 일인지 카드 내용과 조직도를 다시 봐요.':'그건 제가 답할 게 아니에요. 누가 맡는 일인지 카드 내용을 다시 봐요.'; }
async function doDeliver(id,d,auto){ const c=CARD(id), st=S.cards[id]; const O=office(); if(O&&(O.busy||O.walking)){ toast('지금은 이동할 수 없어요'); return; }
  if(!flowOf(c).includes('deliver')) return deliverOff(id,d,auto);
  const dl=c.deliver||{}; const ok=destOk(c,d,'deliver'); const who=d.name; const trust=trustOf(dl.npc);
  const line=ok?((dl.npcLineTrust&&(trust>=2?dl.npcLineTrust.high:dl.npcLineTrust.low))||dl.okLine||'네, 처리할게요.').replace(/○○씨/g,(S.name||'○○')+'씨'):wrongLine(c,d,'deliver');
  const text=dl.text||dl.deliverText||(dl.handoff?`${c.subj} 건이에요. ${dl.handoff.join(', ')} 전달드려요.`:'이거 전달드리러 왔어요.');
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('deliver',{seat:d.seat,who,teamKey:d.key,teamName:d.team,text,npcLine:line,ok,auto});
  $('card').classList.remove('min'); setStatusLine('');
  if(!r||!r.present){ toast('자리에 안 계셔서 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
  st.lastSeat=d.seat; st.lastNpc=who;
  if(ok){ st.delivered=true; st.deliveredAt=S.t; delete st.go; delete st.wrong; S.counts.pass++; S.counts.rightNpc++; evRoute(id); const okBr=(D.branches[id]||{}).ok; if(dl.npc&&!c.pre&&!(okBr&&okBr.trust)) S.trust[dl.npc]=(S.trust[dl.npc]||0)+1; runBranch(id,'ok',{toastOnly:true}); scheduleChain(c);
    /* 배포본은 act 표가 비어 있다 — 이 전달로 카드가 끝나면 정답 코멘트를 서버에서 받아 둔다(로컬과 같은 결과 화면 · D-fixes §5-5) */
    if(!Grader.local()&&!st.bestComment&&c.best&&!requiredSteps(c).some(s=>s!=='deliver'&&!(st.steps&&st.steps[s]))){ try{ const b=await Grader.run('act',c,{key:c.best,commentOnly:true}); if(b&&b.bestComment) st.bestComment=b.bestComment; }catch(e){} }
    markStep(id,'deliver',{seat:d.seat,line:r.line||line,score:100}); if(practiceDay()&&stepsLeft(id).length) toast('전달했어요. 고객에게도 안내 회신을 보내야 완료예요.'); }
  else { st.wrong=line; st.tries=(st.tries||0)+1; S.counts.wrongNpc++; if(!sameTeamWrong(c,d,'deliver')) runBranch(id,'wrongNpc',{toastOnly:true}); if(S.cur===id) renderCardActs(id); } }
/* 전달 흐름이 없는 카드를 넘겼다 — 받은 사람은 받아 두고, 카드는 전달(delegate) act 점수로 끝난다 */
async function deliverOff(id,d,auto){ const c=CARD(id), st=S.cards[id]; const who=d.name;
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('deliver',{seat:d.seat,who,teamKey:d.key,teamName:d.team,text:`${c.subj} 건이에요. 전달드려요.`,npcLine:'네, 두고 가세요. 확인해 볼게요.',ok:true,auto});
  $('card').classList.remove('min'); setStatusLine('');
  if(!r||!r.present){ toast('자리에 안 계셔서 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
  st.lastSeat=d.seat; st.lastNpc=who; delete st.go;
  await actEnd(id,'delegate',{flowSkip:flowOf(c)[0]!=='reply'}); }
async function doAsk(id,d,auto){ const c=CARD(id), st=S.cards[id]; const O=office(); if(O&&(O.busy||O.walking)){ toast('지금은 이동할 수 없어요'); return; }
  if(!flowOf(c).includes('ask')) return askOff(id,d,auto);
  const who=d.name; const senior=D.dests.find(x=>x.seat==='senior'); const isSenior=senior&&d.name===senior.name; const ok=destOk(c,d,'ask');
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  if(ok){ let r, cap;
    if(c.askOpen){
      /* 직접 묻기(docs/plan-interaction-design.md §3-A) — 준비된 질문 3개 대신 학생이 한 줄로 묻는다. 채점(어느 조각을 건드렸나)은 Grader 가 한 질문마다 한다(배포본은 서버) */
      let meta; try{ meta=await Grader.run('askOpenAnswer',c,{got:[]}); }catch(e){ $('card').classList.remove('min'); setStatusLine(''); return gradeFail(id,e); }
      /* 모범 질문은 자동 플레이(검사) 전용이다. 서버에 물으면 「무엇을 물어야 하는지」가 그대로 나가므로 절대 Grader 로 보내지 않는다.
         배포본에서도 안전하다 — askOpenSpec(grade.js)이 facts 없는 공개본 카드에는 null 을 주어 q 가 빈 문자열이 된다. */
      let model=''; if(auto!=null){ try{ model=(typeof Score!=='undefined'&&Score.askOpenModel?Score.askOpenModel(c).q:'')||''; }catch(e){} }
      const open={greet:meta.greet,tries:meta.tries,model,classify:(text,got,n)=>Grader.run('askOpen',c,{text,got,n})};
      r=await travel('ask',{seat:d.seat,who,teamKey:d.key,teamName:d.team,open,auto}); $('card').classList.remove('min'); setStatusLine('');
      if(!r||!r.present||!r.open||!(r.asked&&r.asked.length)){ toast('답을 못 듣고 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
      let ans; try{ ans=await Grader.run('askOpenAnswer',c,{got:r.got||[],final:true}); }catch(e){ return gradeFail(id,e); } takeEv(id,ans);
      cap=r.cap!=null?r.cap:40; const got=r.got||[];
      st.ask={open:true,asked:r.asked.slice(),got:got.slice(),answer:ans.answer||'(필요한 답을 얻지 못했어요)',cap};
      S.counts.askQ=(S.counts.askQ||0)+r.asked.length; S.counts.askHit=(S.counts.askHit||0)+got.length; S.counts.askNeed=(S.counts.askNeed||0)+(+r.need||0);
    }
    else {
      let answers; try{ answers=(await Grader.run('askAnswers',c,{})).answers||[]; }catch(e){ $('card').classList.remove('min'); setStatusLine(''); return gradeFail(id,e); }
      /* 보이는 순서는 섞은 순서(qOrder) · 자동 플레이는 데이터 번호(rightQ)를 주므로 보이는 자리로 바꿔 넘긴다 */
      const qs=c.question||[]; const qo=qOrder(id,qs.length); const autoAt=auto!=null?qo.indexOf(auto):-1;
      r=await travel('ask',{seat:d.seat,who,teamKey:d.key,teamName:d.team,questions:qo.map(i=>qs[i]),answers:qo.map(i=>answers[i]),answer:c.answer||answers[0],auto:auto!=null?(autoAt>=0?autoAt:auto):auto}); $('card').classList.remove('min'); setStatusLine('');
      if(!r||!r.present||r.choice==null||r.choice<0){ toast('답을 못 듣고 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
      r.choice=qo[r.choice]!=null?qo[r.choice]:r.choice;   /* 여기부터 데이터 번호 */
      let ra; try{ ra=await Grader.run('ask',c,{choice:r.choice}); cap=ra.cap; }catch(e){ return gradeFail(id,e); } takeEv(id,ra); st.ask={choice:r.choice,answer:r.answer,cap}; }
    delete st.go; delete st.wrong; evRoute(id);
    S.counts.ask++; st.lastSeat=d.seat; st.lastNpc=who; if(cap>=100){ S.counts.rightNpc++; const okBr=(D.branches[id]||{}).ok; if(c.npc&&!c.pre&&!(okBr&&okBr.trust)) S.trust[c.npc]=(S.trust[c.npc]||0)+1; }
    runBranch(id,cap>=100?'ok':(c.askOpen?'askPartial':('q'+(r.choice+1))),{toastOnly:true}); st.steps=st.steps||{}; st.steps.ask=c.askOpen?{at:S.t,open:true,n:r.asked.length,got:(r.got||[]).length}:{at:S.t,choice:r.choice};
    /* 메신저 카드는 별도 작성 창을 띄우지 않는다 — 대화창 아래에서 짧게 답한다(대표 지시) */
    if(c.type==='msg'){ if(window.Msg) Msg.refresh(); return; }
    /* T 로 물어본 경우 컴퓨터에는 다른 메일(쓰던 회신)이 열려 있을 수 있다 — 그때는 작성 칸을 덮어쓰지 않는다(45차).
       물은 뒤 작성 칸을 저절로 여는 것은 1일차 연습에만 — 2일차부터는 다음 처리도 스스로 고른다 */
    if(S.cur===id){ renderCardActs(id); if(practiceDay()) openComposer(id,'reply',replyKey(c)); } return; }
  const line=isSenior?(c.sasuLine||c.wrongNpcLine&&typeof c.wrongNpcLine==='string'&&c.wrongNpcLine||sasuLine()):wrongLine(c,d,'ask');
  /* 내 대사는 중립 — 예전에는 첫 질문(대개 정답 질문 · lg42 는 정답 팀 이름까지)이 그대로 나갔다(57차 E1 후속 · QA Y-1) */
  const r=await travel('deliver',{seat:d.seat,who,teamKey:d.key,teamName:d.team,text:'여쭤볼 게 있는데요.',npcLine:line,ok:false,auto}); $('card').classList.remove('min'); setStatusLine('');
  st.wrong=line; st.lastSeat=d.seat; st.lastNpc=who; if(isSenior){ S.counts.sasu=(S.counts.sasu||0)+1; runBranch(id,'senior',{toastOnly:true}); } else { st.tries=(st.tries||0)+1; S.counts.wrongNpc++; if(!sameTeamWrong(c,d,'ask')) runBranch(id,'wrongNpc',{toastOnly:true}); } if(S.cur===id) renderCardActs(id); if(c.type==='msg'&&window.Msg) Msg.refresh(); }
/* 물어볼 흐름이 없는 카드를 물으러 갔다 — 답해 줄 사람이 없다. 카드는 그대로(끝나지 않는다) */
async function askOff(id,d,auto){ const c=CARD(id), st=S.cards[id]; const who=d.name; const senior=D.dests.find(x=>x.seat==='senior'); const isSenior=senior&&who===senior.name;
  const line=isSenior?sasuLine():neutralWrong(d);
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('deliver',{seat:d.seat,who,teamKey:d.key,teamName:d.team,text:'여쭤볼 게 있는데요.',npcLine:line,ok:false,auto});
  $('card').classList.remove('min'); setStatusLine('');
  if(!r||!r.present){ toast('자리에 안 계셔서 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
  st.wrong=line; st.lastSeat=d.seat; st.lastNpc=who; if(isSenior) S.counts.sasu=(S.counts.sasu||0)+1;
  if(S.cur===id) renderCardActs(id); if(c.type==='msg'&&window.Msg) Msg.refresh(); saveProgress(); }
async function doReport(id,auto){ const c=CARD(id), st=S.cards[id]; const O=office(); if(O&&(O.busy||O.walking)){ toast('지금은 이동할 수 없어요'); return; }
  if(!flowOf(c).includes('report')) return reportOff(id,auto);
  const rp=c.report||c; const orig=Object.keys(rp.choices||{}); const keys=orderOf(id,orig); const labels=keys.map(k=>rp.choices[k]); const best=keys.indexOf(c.best in (rp.score||{})?c.best:(rp.best||orig[0]));
  const lead=D.dests.find(x=>x.seat==='lead'); const who=c.npc||rp.npc||(lead&&lead.name); const lines=keys.map(k=>(rp.leadAfter&&rp.leadAfter[k])||((D.branches[id]||{})[k]&&(D.branches[id][k].now||{}).text)||'');
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('report',{seat:'lead',who,text:reportLine(who,c.subj),ask:rp.leadAsk||'근거가 뭐야?',choices:labels,lines,best:best<0?0:best,auto:autoIndex(auto,keys,orig)});
  $('card').classList.remove('min'); setStatusLine(''); if(!r||r.choice==null||r.choice<0){ toast('보고를 못 하고 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
  const k=keys[r.choice]; let sc; try{ sc=await Grader.run('report',c,{key:k}); }catch(e){ return gradeFail(id,e); } takeEv(id,sc); const score=sc.score; st.choice=k; st.reportChoice=k; st.lastNpc=who; st.lastSeat='lead'; delete st.go;   /* 분기 반응의 「@npc」가 「상대」로 뜨지 않게 */ const isBest=!!sc.isBest; if(sc.bestComment) st.bestComment=sc.bestComment;
  st.reportBest=isBest; if(sc.bestRC){ S.counts.rejectAll++; if(isBest) S.counts.reject++; }
  /* 팀장의 답(lines[i] — leadAfter 또는 분기 now)은 연출 안에서 이미 대화창으로 나왔다. 분기의 now 가 같은 사람(보고받은 사람)의 말이면
     다시 흘리지 않는다 — 데이터는 leadAfter 와 분기 now·ok now 에 같은(또는 거의 같은) 대사를 둘 다 둔다(57차 E2후속 F2 · plan 2차) */
  const after=lines[r.choice]; const said={toastOnly:true,said:after,saidBy:who};
  if(isBest){ S.trust[who]=(S.trust[who]||0)+1; S.counts.rightNpc++; } runBranch(id,k,said); if(isBest) runBranch(id,'ok',said);
  markStep(id,'report',{choice:k,score,line:after,comment:isBest?'':'근거가 약했어요.'}); }
/* 보고 흐름이 없는 카드를 들고 팀장에게 갔다 — 팀장이 받아 두고, 카드는 상신(confirm) act 점수로 끝난다 */
async function reportOff(id,auto){ const c=CARD(id), st=S.cards[id]; const who=leadOfDay();
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('deliver',{seat:'lead',who,text:reportLine(who,c.subj),npcLine:'알겠어요. 놓고 가요, 보고 판단할게요.',ok:true,auto});
  $('card').classList.remove('min'); setStatusLine('');
  if(!r||!r.present){ toast('보고를 못 하고 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
  st.lastNpc=who; st.lastSeat='lead'; delete st.go;
  await actEnd(id,'confirm',{flowSkip:true}); }
async function doVisit(id,auto){ const c=CARD(id), st=S.cards[id]; const orig=c.choiceOrder||Object.keys(c.choices||{}); const keys=orderOf(id,orig); const labels=keys.map(k=>c.choices[k]); const best=keys.indexOf(c.best); const open=(c.body.match(/"([^"]+)"/)||[])[1]||c.subj;
  const reacts=keys.map(k=>(c.reacts&&c.reacts[k])||((D.branches[id]||{})[k]&&(D.branches[id][k].now||{}).text)||'…알겠어요.'); const name=c.visitorName||c.from; const ai=autoIndex(auto,keys,orig);
  $('card').classList.add('min'); $('cActs').innerHTML=''; note('방문객을 응대하러 갑니다…');
  let r=null; const O=office();
  const here=!!(window.Talk&&Talk.here&&Talk.here(name,'visitor'));
  if(here){ r=await travel('visit',{who:name,name,seat:'visitor',lines:{open},choices:labels,reacts,timeLimit:ai==null?(c.timeLimit||null):null,auto:ai}); }
  else if(O&&!O.busy&&!NO_STAGE){ let timer=null; if(c.timeLimit&&ai==null){ timer=setTimeout(()=>{ try{ if(O.busy) O.choose(-1); }catch(e){} },c.timeLimit*1000); }
    /* 45차: 방문객 모델은 3D 가 사내 인물과 겹치지 않는 전용 변형으로 고른다 — 기본값(acnh_29=홍주임)을 넘기지 않는다.
       대사·선택지는 대화창으로 온다(Talk.stage 가 3D 선택 패널을 옮긴다) */
    const vo={name,lines:{open},choices:labels,reacts,best:best<0?0:best,auto:ai,timeLimit:ai==null?(c.timeLimit||null):null}; if(c.visitor) vo.visitor=c.visitor;
    try{ const go=()=>O.interact('visit',vo); r=await ((window.Talk&&Talk.stage)?Talk.stage(vo,go):go()); }catch(e){} clearTimeout(timer); if(r&&r.choice==null) r=null; }
  if(!r){ r=await travel('visit',{who:name,name,lines:{open},choices:labels,reacts,timeLimit:ai==null?c.timeLimit:null,auto:ai}); }
  $('card').classList.remove('min'); setStatusLine('');
  /* 소파에 앉아 있던 방문객은 응대가 끝나면 나간다 */
  if(st.visitorHere){ st.visitorHere=false; try{ if(O&&typeof O.setTalkHint==='function') O.setTalkHint('visitor',''); if(O&&typeof O.visitorOut==='function') O.visitorOut(); }catch(e){} }
  /* 연출이 길어 자동 플레이(pump)가 기다리다 다른 길로 먼저 끝낸 경우 — 두 번 기록하지 않는다(분기·예고가 겹친다) */
  if(st.status==='done') return;
  let k=(r&&r.choice!=null&&r.choice>=0)?keys[r.choice]:null; if(!k){ st.choice='timeout'; await timeoutEv(id); record(id,{act:'timeout',score:10,comment:'말없이 시간을 넘겼어요. 접수·회신 시점·보고, 셋 중 하나라도 말해야 해요.'}); runBranch(id,'timeout'); return; }
  let a; try{ a=await Grader.run('act',c,{key:k}); }catch(e){ return gradeFail(id,e); } if(!a.ok) a={score:30,comment:'',branch:k,sl:a.sl};   /* 서버 봉인도 같은 30(grade.js Seal.step) */ if(st.status==='done') return; st.choice=k; if(k==='refund') S.counts.promise++; if(a.bestComment) st.bestComment=a.bestComment; takeEv(id,a); record(id,{act:k,score:a.score,comment:a.comment});
  /* 방문객의 반응은 응대한 그 대화창에 곧바로 잇는다 */
  runBranch(id,a.branch,{toastOnly:true})||runBranch(id,k,{toastOnly:true}); }
/* 이름으로 사람의 팀 — 조직도(ORG · 늘 있는 조력자 more 포함)에서 */
function orgKeyOf(name){ for(const [k,o] of Object.entries(ORG)){ if([o.lead,o.senior,o.chief].concat(o.more||[]).includes(name)) return k; } return null; }
/* 검산 결과를 가져간다 — 57차 E2후속 F1:
   ① 받는 사람 자리 = 전달(doDeliver)과 같은 목적지(오늘 목적지 목록 → 자리·팀). 다른 팀 사람이면 그 팀 사무실로 간다.
      예전에는 자리가 없으면 팀장 자리('lead')로 걸어가 그 사람 이름으로 말했다(ga 4화 한주임 → 이재훈 팀장 자리)
   ② 가져가면 delivered·체인 예약(scheduleChain) — 전달과 같게. 예전에는 둘 다 안 해 requires.delivered 로 기다리는 체인 다음 카드가 영영 안 왔다
   ③ 상대의 반응(lines[i])은 연출 안에서 이미 나왔다 — 같은 사람의 분기 now 를 다시 흘리지 않는다(F2) */
async function doSheetDeliver(id,auto){ const c=CARD(id), st=S.cards[id]; const d=c.deliver; const orig=Object.keys(d.choices||{}); const keys=orderOf(id,orig); const labels=keys.map(k=>d.choices[k]); const bestK=Object.entries(d.score||{}).sort((a,b)=>b[1]-a[1])[0]; const best=bestK?Math.max(0,keys.indexOf(bestK[0])):0; const who=d.npc||leadOfDay();
  const lines=keys.map(k=>((D.branches[id]||{})[k]&&(D.branches[id][k].now||{}).text)||(k===(bestK&&bestK[0])?((D.branches[id]||{}).ok&&(D.branches[id].ok.now||{}).text)||'…괜찮네.':''));
  const v=npcInfo(who)||{}; const dd=((D.dests||[]).find(x=>x.name===who))||{name:who,seat:v.seat||null,key:v.teamKey||orgKeyOf(who),team:v.team||''};
  const seat=dd.seat||(who===leadOfDay()?'lead':null); const teamKey=dd.key||null; const teamName=dd.team||(teamKey&&TEAM_NAMES[teamKey])||'';
  $('card').classList.add('min'); $('cActs').innerHTML=''; note(`${escapeHtml(who)} 자리로 가는 중…`);
  const r=await travel('report',{seat,who,teamKey,teamName,text:`${c.subj.replace(/^\[.*?\]\s*/,'')} 검산 결과 가져왔습니다. ${st.answer}입니다.`,ask:d.leadLine||'근거는?',choices:labels,lines,best,auto:autoIndex(auto,keys,orig)});
  $('card').classList.remove('min'); setStatusLine(''); if(!r||r.choice==null||r.choice<0){ toast('전달을 못 하고 돌아왔어요'); if(S.cur===id) renderCardActs(id); return; }
  const k=keys[r.choice]; let sc; try{ sc=await Grader.run('sheetDeliver',c,{key:k}); }catch(e){ return gradeFail(id,e); } if(st.status==='done') return; takeEv(id,sc); const score=sc.score; st.choice=k; st.lastNpc=who; st.lastSeat=seat; const isBest=!!sc.isBest; if(sc.bestComment) st.bestComment=sc.bestComment; if(isBest){ S.trust[who]=(S.trust[who]||0)+1; S.counts.rightNpc++; }
  st.delivered=true; st.deliveredAt=S.t; delete st.go;
  runBranch(id,isBest?'ok':k,{toastOnly:true,said:lines[r.choice],saidBy:who}); scheduleChain(c);
  markStep(id,'deliver',{choice:k,score,line:lines[r.choice]}); }

/* ======================================================================
   사내 메신저 — 대화창 아래에 붙는 행동
   대표 "답장이 필요한 메시지(채점 대상)는 대화창 아래에 선택지 또는 짧은 입력칸으로
   처리한다. 메일처럼 별도 작성 창을 띄우지 마라 — 메신저는 짧게 주고받는 자리다."
   채점은 메일과 **같은 함수**(sendCompose · doButton · doAsk)를 그대로 쓴다.
   js/desk/msgapp.js 가 이 함수를 부른다(그 파일은 채점을 모른다).
   ====================================================================== */
function msgWho(c){ return (c.from||'').replace(/\s*\(.*?\)\s*/g,'').trim(); }
/* 메신저 대기열(57차 · logi 3차 발견) — 이 카드에 아직 답할 수 있는가(도착했고 끝나지 않음). js/desk/msgapp.js 가 대화마다 남은 건을 셀 때 부른다.
   예전에는 대화마다 답할 카드가 하나(pending)라, 같은 사람의 새 카드가 오면 앞 카드는 답할 길이 없어져 하루 끝에 미처리로 남았다 */
function msgOpen(id){ const c=CARD(id), st=S.cards[id]; return !!(c&&st&&st.arrived&&st.status!=='done'&&st.status!=='skipped'); }
/* 결과 한 줄은 그 카드가 쌓인 대화에(카드 id 를 붙여 — 한 대화에 카드가 둘 이상이면 어느 건 결과인지 제목이 앞에 붙는다). 끝난 건은 읽은 것으로(이어 하기 뒤 배지 — W-7) */
function msgResultNote(id){ const st=S.cards[id]; const c=CARD(id); if(!window.Msg||!st||!c) return;
  const who=Msg.whoOf(id)||msgWho(c);
  if(st.status==='done'){ const cls=st.score==null?'':st.score>=80?'hi':st.score<50?'lo':'';
    const head=c.followup?'확인함':st.score==null?actLabel(st.act):`${actLabel(st.act)} · ${st.score}점`;   /* 재문의 〔확인했어요〕는 「확인함」 — actLabel('confirm') 은 「상신」이라 처리 선택지로 잘못 보였다 */
    Msg.note(who,head+(st.comment?' — '+st.comment:''),cls,id); if(Msg.seen) Msg.seen(id); }
  Msg.refresh(); }
/* 누구에게 갈지 고르고 실제로 걸어간다 — 팀 → 사람 두 번 고른다(조직도 전체 · renderDest 와 같은 목록) */
async function msgGo(id,kind){ const teams=orgTeams();
  const ti=await choosePanel(kind==='ask'?'누구에게 물어볼까요? 먼저 팀을 고르세요.':'누구에게 전달할까요? 먼저 팀을 고르세요.',teams.map(teamBtnLabel));
  if(ti==null||ti<0) return; const t=teams[ti];
  const pi=await choosePanel(`${t.team} — 누구에게 갈까요?`,t.people.map(d=>`${d.name} · ${d.team}`));
  if(pi==null||pi<0) return;
  if(kind==='ask') await doAsk(id,t.people[pi]); else await doDeliver(id,t.people[pi]);
  msgResultNote(id); }
function msgActions(id,foot){ const c=CARD(id), st=S.cards[id];
  if(!c||!st||!st.arrived||st.status==='done'||st.status==='skipped') return false;
  /* 대화 이름은 그 카드가 쌓인 대화(msgapp split — 「김기사 ((주)한빛방재)」 같은 겹친 괄호도 같은 대화) */
  const flow=flowOf(c), steps=st.steps||{}; const who=(window.Msg&&Msg.whoOf&&Msg.whoOf(id))||msgWho(c); const common=commonCard(c); const P1=practiceDay();
  const btns=h('div','btns'); const tip=(t)=>{ if(t) foot.appendChild(h('div','tip',t)); };
  let drew=false;
  /* 재문의(분기가 만든 카드 — 채점 없음)는 메일 카드 창과 같은 〔확인했어요〕. 예전에는 그릴 것이 없어 대화에서 빠졌다(대기열에서 막히지 않게) */
  if(c.followup){ tip('재문의예요. 읽고 확인을 누르면 됩니다. (채점 없음)'); btns.appendChild(mkBtn('확인했어요','',()=>{ record(id,{act:'confirm',score:null,comment:''}); msgResultNote(id); })); foot.appendChild(btns); return true; }
  /* 기록 조회 — 메일 카드 창과 같은 단추(57차 E2후속 F3 · 예전에는 renderCardActs 에만 있어 PC 메신저에서 qc19 「입고검사 대장 조회」가 안 보였다) */
  if(c.recordLookup){ const rl=c.recordLookup;
    if(st.lookup) tip(`${rl.label?rl.label+' 결과':'조회 결과'}: ${rl.result}`);
    else { const lk=h('div','btns'); lk.appendChild(mkBtn(rl.label||'기록 조회','',()=>{ lookupRecord(id); if(window.Msg) Msg.refresh(); })); foot.appendChild(lk); drew=true; } }
  /* 검산(workAnswers·sheet) — 메신저로 온 검산 카드도 여기서 답 칸을 채운다(F4 · 예전에는 흐름이 검산뿐이라 「답할 것은 없어요」로 끝낼 수 없었다).
     가져가기는 메일 카드와 같다(3D 면 그 사람 자리로 걸어가 T · 없으면 단추). 안내는 1일차에만 */
  if(flow.includes('work')){
    if(!steps.work){ const cells=workCells(c); tip(cells?`답 칸 ${cells.length}개를 채워 제출하세요.`:'답 칸에 검산 결과를 적어 제출하세요.'); if(st.workTries) tip(`다시 세어 보세요. (${st.workTries}번째)`);
      const box=h('div','btns'); renderWorkInput(id,box); foot.appendChild(box); return true; }
    if(c.deliver&&!steps.deliver){ const to=c.deliver.npc||leadOfDay(); tip(`검산 결과 ${steps.work.answer}.`+(P1?` 이제 ${to}에게 직접 가져가세요${walkT()?' — 자리로 걸어가 T 를 누르면 됩니다':''}.`:''));
      if(!walkT()){ btns.appendChild(mkBtn(P1?`${to}에게 가져가기`:'검산 결과 가져가기','',async()=>{ await doSheetDeliver(id); msgResultNote(id); })); foot.appendChild(btns); }
      return true; }
    return drew; }
  if(common){ for(const t of factNotes(id,true)) tip(t); if(st.go&&walkT()) tip(GO_NOTE[st.go]); }
  else {
    if(flow.includes('ask')&&!st.ask&&!steps.reply){
      /* 물을 상대의 이름은 적지 않는다(E2-7) — 누구에게 물을지 고르는 것이 이 카드의 일이다 */
      tip('이 일을 맡은 사람에게 먼저 물어보고 답해야 만점이 나와요.');
      if(walkT()) tip('자리로 걸어가 T 로 여쭤보세요. 들은 답은 여기 대화에 옮겨 적어요.');
      else btns.appendChild(mkBtn('자리로 가서 물어보기','',()=>msgGo(id,'ask')));
      drew=true; }
    else if(st.ask){ tip(`${c.npc} 답: “${st.ask.answer}”`); }
    if(flow.includes('deliver')&&!steps.deliver){
      tip('직접 전달해야 하는 건이에요.');
      if(walkT()) tip('맞는 사람 자리로 걸어가 T 로 전달하세요.');
      else btns.appendChild(mkBtn('자리로 가서 전달하기','',()=>msgGo(id,'deliver')));
      drew=true; } }
  /* 어느 칸에 쓰나 — 공통 선택지는 composeTarget(두 글 카드는 순서 무관 · 이미 보낸 칸은 다시 안 씀 · F12 묶음), 1일차는 흐름 순서대로 */
  const tgt=common?composeTarget(c,st,'reply'):null;
  const which=common?(tgt.which||'reply'):((steps.reply&&flow.includes('reply2')&&!steps.reply2)?'reply2':'reply');
  if(common||(flow.includes(which)&&!steps[which]&&isTextCard(c)&&!(flow.includes('deliver')&&!steps.deliver))){
    const key=common?(tgt.key||'reply'):(which==='reply2'?'reply':((c.best==='confirm'&&(hasCompose(c)||c.alsoReply)&&!flow.includes('report'))?'confirm':replyKey(c)));
    const meta=specMeta(c,which==='reply2'?'second':null); const t=[];
    if(P1){ if(meta.must) t.push(`반드시 들어갈 값 ${meta.must}가지`); if(meta.rules&&toolOpen('rulebook')) t.push('근거 조항 번호를 붙여요'); }
    t.push(aiOn()?'AI 첨삭':'규칙 채점'); tip(t.join(' · '));
    /* 〔보내기〕가 이 대화 상대가 아닌 사람에게 가면(두 글 카드의 둘째 글 — 고객 안내 등) 받는 사람을 적는다. 메일 작성기는 받는 사람이 보이는데
       메신저는 안 보여 둘째 글을 어디로 보내는지 몰랐다(57차 E1 후속 · QA Y-8) — 받는 사람은 사실 정보(정답 처리를 말하지 않는다) */
    { const aTo=typeof c.alsoReply==='object'?c.alsoReply.to:(c.alsoReplyTo||null); const sendTo=(which==='reply2'&&aTo)?aTo:who; if(sendTo&&sendTo!==who) tip(`〔보내기〕로 보내는 글은 ${sendTo}에게 가요.`); }
    const len=h('span','len','0자');
    const ta=document.createElement('textarea');
    /* 상신은 팀장(결재자) 앞 보고다(F12) — 입력 칸은 하나라 누구에게 가는 글인지 모든 공통 카드에 같은 문장으로 적는다 */
    ta.placeholder=common?`메신저는 짧게 — 용건과 다음 행동만. 〔상신하기〕로 보내면 ${confirmTo(c)}에게 올리는 보고가 돼요.`:'메신저는 짧게 — 용건과 다음 행동만.';
    /* 쓰던 글은 건마다 따로(같은 대화의 다른 건을 골라도 섞이지 않게) */
    ta.value=(window.Msg&&Msg.draft(who,undefined,id))||'';
    ta.addEventListener('input',()=>{ if(window.Msg) Msg.draft(who,ta.value,id); len.textContent=ta.value.length+'자'; });
    ta.addEventListener('focus',()=>{ S.composing={id,which,key}; });
    len.textContent=ta.value.length+'자'; foot.appendChild(ta);
    /* 결과값 칸 — 메일 작성기와 같다(E2-12). 결과값을 적는 첫 글을 아직 안 보냈을 때만(F12: 둘째 글에는 없다) */
    let wi=null;
    if(!steps.reply&&!!(c.workAnswer||c.hasWork)&&!flow.includes('work')){ const w=h('div','work'); w.appendChild(h('span','tip','결과값')); wi=document.createElement('input'); wi.type='text'; wi.autocomplete='off'; wi.placeholder=c.workHint||RESULT_PH; wi.value=MSG_ANS[id]||''; wi.addEventListener('input',()=>{ MSG_ANS[id]=wi.value; }); w.appendChild(wi); foot.appendChild(w); }
    /* 보내기 단추 이름은 늘 「보내기」 — 「거절 답장 보내기」「상신하고 답장 보내기」는 정답을 말한다(E2-3) */
    const alsoTo=typeof c.alsoReply==='object'?c.alsoReply.to:(c.alsoReplyTo||null);
    const go=async(k,wh,btn)=>{ const text=ta.value.trim();
      if(text.replace(/\s/g,'').length<8){ toast(k==='confirm'?'올릴 내용을 먼저 적어 주세요.':'내용이 너무 짧아요. 한 줄이라도 용건을 적어 주세요.'); return; }
      if(wh==='reply'&&wi&&!wi.value.trim()){ toast('결과값 칸을 채워 주세요. 글과 따로 숫자를 적는 칸이에요.'); wi.focus(); return; }   /* QA Y-10 — 빈 결과값은 보내지 않는다 */
      btn.disabled=true;
      /* 누구에게 간 글인지 대화에 남긴다 — 상신은 팀장(결재자) 대화에, 둘째 글은 그 받는 사람 대화에, 요청자 대화에는 사실 한 줄(logi 2차: 상신 글이 요청자 대화에 찍혔다) */
      const up=k==='confirm'&&wh==='reply'&&common; const dest=up?confirmTo(c):(wh==='reply2'&&alsoTo)?alsoTo:who;
      if(window.Msg){ Msg.draft(who,'',id); Msg.mine(dest,text,id); if(dest!==who) Msg.note(who,up?`〔상신〕 ${dest}에게 올렸어요.`:`${dest}에게 보냈어요.`,'',id); }
      let res=null; try{ res=await sendCompose(id,text,wh,k,(wh==='reply'&&wi)?wi.value.trim():null); } finally{ btn.disabled=false; }
      if(!(res&&res.retry)) delete MSG_ANS[id];
      msgResultNote(id); };
    const send=mkBtn('보내기','',()=>{ if(tgt&&tgt.done){ toast(tgt.done); return; } go(key,which,send); }); btns.appendChild(send);
    if(common){
      const up=mkBtn('상신하기','',()=>{ const t2=composeTarget(c,st,'confirm'); if(t2.done){ toast(t2.done); return; } go('confirm','reply',up); }); btns.appendChild(up);
      btns.appendChild(mkBtn('가서 전달하기','',()=>pickCommon(id,'deliver')));
      btns.appendChild(mkBtn('가서 묻기','',()=>pickCommon(id,'ask')));
      btns.appendChild(mkBtn('보류','',async()=>{ await pickCommon(id,'hold'); msgResultNote(id); }));
      if(toolOpen('report')) btns.appendChild(mkBtn(UNLOCK_LABEL.report,'',()=>pickCommon(id,'report'))); }
    else for(const k of Object.keys(c.act||{})){ if(k==='reply'||k==='reject') continue;
      /* 46차 35: 보고 카드의 「상신」은 자리로 안 가고 글로 올리는 것 — 데이터 mailConfirm 점수(doMailConfirm) */
      if(k==='confirm'&&mailConfirmBranch(c)){ if(!st.mailTried) btns.appendChild(mkBtn('메일로 상신','',async()=>{ await doMailConfirm(id); msgResultNote(id); })); continue; }
      if(k===key||(flow.includes('report')&&k===c.best)) continue;
      btns.appendChild(mkBtn(actLabel(k),'',async()=>{ await doButton(id,k); msgResultNote(id); })); }
    btns.appendChild(len); drew=true; }
  if(btns.childElementCount){ foot.appendChild(btns); drew=true; }
  return drew; }

/* ======================================================================
   전화 — 메일함에도 메신저에도 넣지 않는다
   대표 "전화는 메일함·메신저 어디에도 넣지 말고, 전화가 오면 그 자리에서 받는
   화면으로 처리한다. 놓친 전화는 「전화 메모」 앱이나 알림으로."
   ====================================================================== */
let phoneQ=[];
function phoneRing(id){ if(!CARD(id)) return; if(phoneQ.indexOf(id)<0) phoneQ.push(id); renderPhoneBar(); }
function phoneMissed(){ return S.order.filter(i=>{ const c=CARD(i); return c&&c.type==='phone'&&S.cards[i]&&S.cards[i].arrived; }); }
function renderPhoneBar(){ const bar=$('phoneBar'); if(!bar) return;
  phoneQ=phoneQ.filter(i=>S.cards[i]&&S.cards[i].status!=='done');
  const id=phoneQ[0];
  if(!id||S.phase!=='work'||S.paused){ bar.classList.remove('open'); document.body.classList.remove('phone-on'); return; }
  const c=CARD(id); $('phoneTx').textContent=`${/님$|고객$/.test(String(c.from||''))?c.from:c.from+' 님'}에게서 전화`+(phoneQ.length>1?` (외 ${phoneQ.length-1}통)`:'');
  bar.classList.add('open'); document.body.classList.add('phone-on'); }
async function answerPhone(id){ const c=CARD(id), st=S.cards[id];
  if(!c||!st||!st.arrived||st.status==='done') return;
  renderHint(id);   /* 받는 전화의 사수 메모로(E2-8) */
  $('phoneBar').classList.remove('open'); document.body.classList.remove('phone-on');
  const keys=orderOf(id,c.choiceOrder||Object.keys(c.choices||{}));
  /* 통화 한 판 — 고르고 나서 상대의 답까지 같은 대화창에서 듣고 끊는다 */
  const T5=window.Talk&&Talk.begin?Talk:null; const s=T5?T5.begin({name:c.from,hold:true,role:'전화 · '+(c.role||'')}):null;
  try{
    const i=await choosePanel(c.body||c.subj,keys.map(k=>c.choices[k]),c.timeLimit||null,{who:c.from,role:'전화 · '+(c.role||'')});
    phoneQ=phoneQ.filter(x=>x!==id);
    if(i==null||i<0){ if(c.timeLimit){ st.choice='timeout'; await timeoutEv(id); record(id,{act:'timeout',score:10,comment:'말없이 시간을 넘겼어요.'}); runBranch(id,'timeout'); } }
    else { const after=await doPhone(id,keys[i],!!T5); if(after&&T5) await T5.say(after.who,after.text,{role:'전화 · '+(c.role||''),sess:s}); }
  } finally { if(s) await T5.end(s); }   /* end 가 줄 선 대사(상대의 반응)를 다 들려준 뒤 닫는다 */
  renderPhoneBar(); if(window.Tel) Tel.refresh(); }
{ const tk=$('phoneTake'); if(tk) tk.onclick=()=>{ const id=phoneQ[0]; if(id) answerPhone(id); };
  const lt=$('phoneLater'); if(lt) lt.onclick=()=>{ const id=phoneQ.shift(); renderPhoneBar();
    if(id){ toast('전화 메모에 남겼어요. 컴퓨터에서 다시 걸 수 있어요.','',3800,'cust');
      /* 알림 머리 = 승인 그림 15번(통화 · 2026-09-29) — 옛 ☎ 자리. toast(core.js)는 글자 머리만 받으므로 방금 뜬 알림에 붙인다 */
      { const A=window.OC&&OC.ui&&OC.ui.appicon, bx=$('toasts'), t=bx&&bx.lastElementChild; if(A&&A.inline&&t) t.insertAdjacentHTML('afterbegin',A.inline('talk')); }
      if(window.Tel) Tel.refresh(); } }; }

/* 체인: 우리 스텝을 전달하면 후속 스텝(조력자가 찾아오는 카드)이 게임시간 몇 분 뒤 도착한다 */
function scheduleChain(c){ if(!c.chain) return; for(const n of D.cards.concat(S.extra)){ if(n.chain===c.chain&&n.step>c.step&&n.requires&&n.requires.card===c.id){ const st=S.cards[n.id]; st.readyAt=Math.max(n.arrive,S.t+(n.delayMin!=null?n.delayMin:5)); } } }

/* ---------- 마무리 · 기록 · NCS · 단서 ---------- */
function finalize(id){ const c=CARD(id), st=S.cards[id]; const steps=st.steps||{}; const parts=[]; let comment=[]; let act='reply';
  for(const [k,v] of Object.entries(steps)){ if(v.skipped||k==='ask') continue; if(typeof v.score==='number') parts.push(v.score); if(v.comment) comment.push(v.comment); }
  if(steps.deliver) act=steps.work?'work':'deliver'; else if(steps.report) act='report'; else if(steps.approval) act=steps.approval.key||'reject'; else if(steps.reply) act=steps.reply.key||'reply'; else if(steps.work) act='work';   /* 검산만 있는 카드(메신저 검산 — E2f §8-5)의 행동 이름 */
  let score=parts.length?Math.round(parts.reduce((a,b)=>a+b,0)/parts.length):null;
  /* 정답 코멘트 — 로컬(act 표)과 배포본(서버가 준 bestComment)이 같은 문장을 쓴다. 공개본 act[best] 는 빈 배열이라
     예전 배포본은 이 자리에 늘 빈 문장을 썼다(D-fixes §5-5) */
  { const a=c.act&&c.act[c.best]; const bc=(Array.isArray(a)&&a.length>1&&a[1])||st.bestComment||''; if(!comment.length&&score!=null&&bc&&score>=80) comment.push(bc); }
  if((c.scored===false&&c.mode==='story')||c.unscored||c.axis==='self') score=null;
  /* 끝까지 마침(follow) — 단계를 다 했으면 3, 건너뛴 단계(검산 함정·세 번 틀림 뒤 가져가기 없음)가 있으면 0(브라우저 판정 · 57차 E1) */
  evLocal(id,'follow',Object.values(steps).some(v=>v&&v.skipped)?0:3);
  record(id,{act,score,comment:uniq(comment.filter(Boolean)).join(' '),text:st.text,text2:st.text2}); }
function record(id,{act,score,comment,text,text2,detail}){ const c=CARD(id), st=S.cards[id]; st.status='done'; st.act=act; st.score=score; st.comment=comment||''; if(text!==undefined) st.text=text; if(text2!==undefined) st.text2=text2; if(detail) st.detail=detail; st.doneAt=S.t; st.onTime=!st.late; delete st.go;
  if(c.followup){ S.counts.follow++; }   /* 57차 E1: 옛 10축(S.ncs)에 카드 점수를 복사하던 것은 걷었다 — 역량은 채점 결과의 증거(st.ev)로만 */
  captureClue(c,st); renderInbox(); renderCounts(); if(S.cur===id) renderCardActs(id); saveProgress(); }
function captureClue(c,st,force){ if(!c.clue) return; const cl=c.clue; let ok=force||false; let extra='';
  if(!ok){ if(cl.requiresReply) ok=!!(st.text||st.act==='reply'); else if(c.mode==='phone'){ ok=!!st.choice; if(st.choice==='promise') extra=' · 시한 약속함'; } else if(c.mode==='report'||c.type==='report') ok=st.reportBest!=null?!!st.reportBest:st.choice===c.best; else if(c.type==='sheet'||c.mode==='sheet') ok=!!st.workOk; else ok=st.act!=='none'&&st.act!=='hold'&&st.act!=='delegate'&&st.act!=='reject'&&st.act!=='timeout'&&(st.score==null||st.score>=45); }
  if(!ok) return; if(S.clues.some(k=>k.card===c.id)) return; S.clues.push({caseId:cl.caseId,day:S.ep,card:c.id,note:cl.note+extra,value:cl.value||null,at:S.t}); }
/* 같은 사람인가 — 「강태호」·「강태호 팀장」·「강태호 팀장님」을 같게 본다(분기 now 의 who 는 이름만 적기도 한다) */
function sameWho(a,b){ const n=(x)=>String(x||'').replace(/\s+/g,'').replace(/님$/,'').replace(/팀장$/,''); return !!a&&!!b&&n(a)===n(b); }
/* opt.said·saidBy — 방금 연출 안에서 그 사람이 한 말(검산 전달·대면 보고). 분기 now 가 그 말과 같거나 같은 사람의 말이면 다시 흘리지 않는다(F2) — 신뢰·예고·실수 표시는 그대로 */
function runBranch(id,key,opt={}){ const all=(D.branches||{})[id]||{}; let br=all[key]; if(!br&&key&&(key.startsWith('forbid:')||key.startsWith('forbid#'))) br=all.forbid; if(!br) return false; const c=CARD(id)||{}; const st=S.cards[id];
  if(br.now&&br.now.text){ const who=br.now.who==='@npc'?((st&&(st.lastNpc||npcBySeat(st.lastSeat)))||((c.mode==='phone'||c.mode==='visit')?(c.visitorName||msgWho(c)):'')||'상대'):br.now.who==='팀장'?(D.dests.find(x=>x.seat==='lead')||{}).name||'팀장':br.now.who==='고객'?(c.from||'고객'):br.now.who;
    const heard=opt.said!=null&&(br.now.text===opt.said||sameWho(who,opt.saidBy));
    if(heard){} else if(opt.toastOnly) { if(window.Talk&&Talk.reply) Talk.reply(who,br.now.text); else if(seatByName(who)) toast(br.now.text,who,4200,''); else msgLine(who,br.now.text); } else setTimeout(()=>sayNpc(who,br.now.text,4.5),400); }
  if(br.trust) for(const [n,d] of Object.entries(br.trust)){ const nm=n==='팀장'?(D.dests.find(x=>x.seat==='lead')||{}).name||n:n; S.trust[nm]=(S.trust[nm]||0)+d; }
  if(br.followup&&br.now&&br.now.text){ const fid=`fu_${id}_${S.extra.length}`; const fc={id:fid,type:c.type==='msg'?'msg':'email',from:br.now.who==='고객'?c.from:br.now.who,role:'재문의',subj:'RE: '+c.subj,body:br.now.text,arrive:S.t+1,followup:true,scored:false,act:{confirm:[0,'']},urgent:c.urgent||2,hint:'재문의는 1분 손실이에요. 처음 답장에 값을 다 넣으면 안 와요.'}; S.extra.push(fc); S.cards[fid]={arrived:false,status:'wait'}; }
  if(br.next&&br.next!=='없음'&&!/^없음/.test(br.next)) S.nexts.push({card:c.subj,text:br.next}); if(br.mistake) S.mistakes.push(id); if(st){ if(br.clueGap) st.clueGap=true; st.branch=key; } return true; }   /* 카드가 아닌 분기(6화 분류 triage.partial)는 카드 상태가 없다 — 예전에는 여기서 멈춰 분류 창이 안 닫혔다(57차 E1 후속) */

/* ---------- 분류(6화 triage) ---------- */
/* 57차 E1(C11): 분류 목록은 화 데이터 triage.cards 가운데 도착한 것만 — 예전에는 09:00 에 온 분기 카드(pre)까지 넣어 「지금」으로 셌다(md: 「triage 대상 아님」) */
function startTriage(){ const T=D.triage; const ids=uniq(T.cards||[]).filter(i=>S.cards[i]&&S.cards[i].arrived&&!(CARD(i)||{}).pre); S.triage={ids,assign:{},done:false}; S.phase='triage'; S.running=false; renderTriage(); $('triage').classList.add('open'); }
function renderTriage(){ const box=$('triageList'); box.innerHTML=''; const B=[['now','지금'],['morning','오전 중'],['today','오늘 중']];
  for(const id of S.triage.ids){ const c=CARD(id); const row=h('div','trow'); const tsj=h('div','tsj',c.from+' — '+c.subj); if(c.type==='phone'){ const A=window.OC&&OC.ui&&OC.ui.appicon; if(A&&A.inline) tsj.insertAdjacentHTML('afterbegin',A.inline('talk')); } row.appendChild(tsj);   /* ☎ → 승인 그림 15번(2026-09-29) */ const g=h('div','tbtns'); for(const [k,l] of B){ const b=mkBtn(l,S.triage.assign[id]===k?'on':'',()=>{ S.triage.assign[id]=k; renderTriage(); }); g.appendChild(b); } row.appendChild(g); box.appendChild(row); }
  $('triageGo').disabled=Object.keys(S.triage.assign).length<S.triage.ids.length; }
async function finishTriage(){ if(!S.triage||S.triage.done) return; const A=S.triage.assign; let r; try{ r=await Grader.run('triage',null,{ids:S.triage.ids,assign:A}); }catch(e){ toast('채점 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return; } const hit=r.hit, total=r.total, sc=r.score;
  S.triage.done=true; S.triage.score=sc; S.triage.hit=hit; S.triage.total=total; if(r.sl&&typeof r.sl.g==='string') S.triage.sg=r.sl.g;   /* 57차 E1 후속(B2) — 서버 서명 */
  /* 증거(triage — 칸 일치 비율 띠)는 서버가 낸다(정답 칸은 공개본에 없다). 하루 집계 문자열(ncs2.day)에 들어간다 */
  if(r.evv&&Array.isArray(r.ev)) S.triage.ev=Ev.str(r.ev); else if(!Grader.local()) S.evPart=1;
  if(hit<total) runBranch('triage','partial'); $('triage').classList.remove('open'); S.phase='work'; S.running=true; lastTick=0; toast(hit>=total?`순서를 잘 잡았어요. ${hit}/${total}건을 맞는 칸에 넣었어요.`:`${hit}/${total}건이 맞는 칸이에요. 시한과 영향이 큰 것부터예요.`); renderInbox(); saveProgress(); }
