/* ======================================================================
   7일차 「결정」 — 아침 분기 카드 → 단서 취합표(자동) → 팀장 자료 6조각 → 결정 칸(취합표 12·계산 3·아이디어·결정) → 보고서 5칸 → 발표 → 루브릭 → 엔딩 A/B/C → 7일 역량
   ====================================================================== */
window.EP7=(function(){
  let E=null; const F={table:{},calc:{},idea:'',decision:{},dropped:'',report:{},reflection:'',key:'p3',q:{}}; let preRes={}; let result=null;
  /* 채점·단서표는 js/play/ep7grade.js(순수 공용부)에 있다 — 여기서는 화면 상태를 넘겨 부른다 */
  const G=()=>EP7Grade.make(E,F,{P,clues:S.clues,preRes,cards:D.cards});
  const rename=(s)=>G().rename(s); const dayLabel=(d)=>G().dayLabel(d); const nums=(t)=>(String(t||'').match(/\d[\d,\.]*/g)||[]).filter(x=>x.replace(/[,\.]/g,'').length>0);
  const rowFilled=(row)=>G().rowFilled(row); const missingRows=()=>G().missingRows(); const missName=(r)=>G().missName(r); const gradeReport=()=>G().gradeReport();
  function reportOf(k){ return (E.report||[]).find(r=>r.key===k)||{}; }
  /* 화면에 내부 용어(카드 아이디·행동 키)를 내보내지 않는다 */
  const ACT_WORD=/(^|[^가-힣A-Za-z])(hold|reply|reply2|delegate|confirm|reject|approve|deliver|ask|report|visit|work|pick|none|timeout|verify|notify|promise|refuse|accept|dismiss|refund)(?![가-힣A-Za-z])/g;
  const humanize=(s)=>String(s==null?'':s).replace(ACT_WORD,(m,a,k)=>a+actLabel(k));
  /* 빈 칸 줄(k 없음)은 그날만 — 데이터 label 에 단서 값이 든 팀이 있어 빈 칸인데 값이 보였다(57차 E1 후속 · QA W-5) */
  const srcName=(r,k)=>{ if(!k) return dayLabel(r.day)+' 업무'; const c=CARD(k.card); if(c&&c.subj) return c.subj;
    if(r.label) return rename(r.label);
    if(k&&k.note) return rename(String(k.note).split(/[·\n]/)[0].trim());
    return dayLabel(r.day)+' 업무'; };
  /* 빈 칸 이름 — 화면에 나가므로 카드 아이디(source) 대신 일차 + 단서 첫 조각 */

  /* 45차: 브리핑·마무리도 1~6일차(day.js startBriefing·callWrap)처럼 **부르기**다 — 팀장 머리 위 표시 + 알림 → 가서 T 로 듣기.
     듣기 전에는 결정 화면이 열리지 않는다. ?stage=0(3D 없음)·이어 하기는 예전처럼 곧바로 화면.
     자동 플레이(EP7.auto)·__play.skip·skipBriefing 은 들은 것으로 친다(endBriefing 을 여기서 감싼다). */
  let briefCallE=null, wrapCallE=null;
  const byT=()=>typeof talkByT==='function'&&talkByT();
  const leadName=()=>(D.dests.find(x=>x.seat==='lead')||{}).name||'';
  function openPanel(){ S.phase='ep7'; $('ep7').classList.add('open'); render(); go(D.cards.length&&!Object.keys(preRes).length?'pre':'clue'); saveProgress(); }
  function start(){ E=D.ep7; S.phase='ep7'; S.running=false; ['inbox','card','side','endbar'].forEach(id=>{ const e=$(id); if(e) e.style.display='none'; });
    for(const c of D.cards) S.cards[c.id]=S.cards[c.id]||{arrived:true,arrivedAt:0,status:'new'};
    const cur=P.cur; let resumed=false; if(cur&&cur.day===7&&cur.ep7&&Q.get('fresh')!=='1'){ Object.assign(F,cur.ep7.form||{}); preRes=cur.ep7.pre||{}; resumed=true; toast('이어서 합니다'); }
    const L=(D.dialog&&D.dialog.briefing)||[];
    const gate=(!resumed&&L.length&&byT()&&typeof briefGate==='function')?briefGate(L):null;
    if(gate){ S.phase='briefing'; S.briefT=true;
      /* 45차 후속: 말하는 사람들이 팀장 둘레로 모이고(day.js briefGatherStart), 대화창이 줄마다 그 사람 얼굴을 잡는다 */
      const gathered=(typeof briefGatherStart==='function')?briefGatherStart(L,gate):[];
      briefCallE=Talk.call(gate,L.map(l=>({who:l.who,text:l.text,role:l.role})),{ gathered,
        notice:`${gate}님이 부르세요. 자리로 가서 T 로 이야기를 들어요. (들어야 결정 화면이 열려요)`, remind:30000,
        onHeard:()=>{ briefCallE=null; if(typeof ungatherBrief==='function') ungatherBrief(); if(S.phase==='briefing') openPanel(); } });
      return; }
    openPanel(); }
  function heardBrief(){ if(briefCallE){ briefCallE.cancel(); briefCallE=null; } if(typeof ungatherBrief==='function') ungatherBrief(); if(S.phase==='briefing'&&E) openPanel(); }
  function snapshot(){ return {form:JSON.parse(JSON.stringify(F)),pre:preRes}; }
  /* 칸을 채울 때마다(0.8초 뒤) 진행을 저장한다 — 탭을 옮기지 않고 새로고침해도 쓴 것이 남게 */
  let bumpTm=null; function bump(){ clearTimeout(bumpTm); bumpTm=setTimeout(()=>{ try{ saveProgress(); }catch(e){} },800); }
  const STEPS=[['pre','아침 메일'],['clue','1 단서 모음'],['frag','2 팀장 자료'],['decide','3 결정'],['report','4 보고서'],['present','5 발표']];
  function render(){ const w=$('ep7Wrap'); w.innerHTML=''; w.className='wrap'; $('ep7').classList.remove('rsPage'); w.appendChild(h('h1',null,`${D.teamName} 7일차 「${D.title}」`)); w.appendChild(h('div','sub',`${D.date||''} · 10시 회의 전에 한 장.`));
    const bl=h('div','brief'); for(const l of (D.dialog.briefing||[])){ const d=h('div','say'); d.appendChild(h('div','who',l.who)); d.appendChild(h('div','tx '+(l.role==='동기'?'msg':''),(l.text||'').replace(/○○씨/g,(S.name||'○○')+'씨'))); bl.appendChild(d); } w.appendChild(bl);
    const tabs=h('div','steps'); for(const [k,l] of STEPS){ if(k==='pre'&&!D.cards.length) continue; const b=mkBtn(l,'stepb',()=>go(k)); b.dataset.k=k; tabs.appendChild(b); } w.appendChild(tabs);
    const body=h('div','stepbody'); body.id='ep7Body'; w.appendChild(body); }
  function go(k){ document.querySelectorAll('#ep7 .stepb').forEach(b=>b.classList.toggle('cur',b.dataset.k===k)); const body=$('ep7Body'); body.innerHTML=''; ({pre:renderPre,clue:renderClue,frag:renderFrag,decide:renderDecide,report:renderReport,present:renderPresent})[k](body); window.scrollTo(0,0); saveProgress(); }
  /* 0) 아침 분기 카드 — 57차 E2: 1~6일차 글 카드와 같은 처리 선택지(회신 쓰기·상신하기·전달하기·보류)를 같은 모양으로.
     정답 단추 강조·「거절 회신 쓰기」 같은 이름을 쓰지 않는다(거절 카드의 회신은 key=reject · D11).
     전화로 온 아침 카드(rec_ep7_branch_badge)는 선택지 문장을 단추로 — 예전에는 act 키(apologize…)가 영어 그대로 떴다(E2-14) */
  /* 선택지 순서 — 카드·질문마다 처음 보일 때 한 번 섞어 F 에 둔다(이어 하기 때 같은 순서 · E2-6) */
  function ordKeys(bag,id,keys){ F[bag]=F[bag]||{}; const o=F[bag][id]; if(Array.isArray(o)&&o.length===keys.length&&keys.every(k=>o.includes(k))) return o.slice();
    const a=keys.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=a[i]; a[i]=a[j]; a[j]=t; } F[bag][id]=a; bump(); return a.slice(); }
  const preName=(c,k)=>{ const t=c.choices&&c.choices[k]; if(t) return t.length>26?t.slice(0,25)+'…':t; return actLabel(k); };
  function renderPre(box){ box.appendChild(h('h3',null,'08:50 — 회의 전에 먼저 온 것')); box.appendChild(h('p','muted','어제의 선택이 오늘 아침을 바꿨어요. 발표 준비 시간이 그만큼 줄어요.'));
    for(const c of D.cards){ const card=h('div','box precard'); card.appendChild(h('div','from',`${c.from}${c.role?' ('+c.role+')':''} · 소요 ${c.cost||3}분`)); card.appendChild(h('div','subj',c.subj)); card.appendChild(h('pre','body',c.body));
      if(preRes[c.id]){ const r=preRes[c.id]; card.appendChild(h('div','res',`${preName(c,r.act)} · ${r.score}점 — ${r.comment||''}`)); box.appendChild(card); continue; }
      const acts=h('div','acts');
      if(c.choices&&Object.keys(c.choices).length){
        for(const k of ordKeys('po',c.id,c.choiceOrder||Object.keys(c.choices))) acts.appendChild(mkBtn(c.choices[k],'wide',()=>submitPre(c,k,null)));
        card.appendChild(acts); box.appendChild(card); continue; }
      const ta=document.createElement('textarea'); ta.placeholder='회신 내용'; ta.style.display='none'; card.appendChild(ta);
      let mode='reply'; const send=mkBtn('보내기','',()=>submitPre(c,mode==='confirm'?'confirm':replyKey(c),ta.value)); send.style.display='none';
      const write=(m,ph)=>{ mode=m; ta.placeholder=ph; ta.style.display='block'; send.style.display=''; ta.focus(); };
      acts.appendChild(mkBtn('회신 쓰기','',()=>write('reply','회신 내용')));
      /* 상신 글은 팀장(결재자) 앞 보고다(57차 E2후속 F12). 7화 아침 카드에는 둘째 글이 없다 — 요청자에게 알릴 방법은 보고 안에(데이터가 그렇게 맞춤) */
      acts.appendChild(mkBtn('상신하기','',()=>write('confirm',`${confirmTo(c)}에게 올리는 보고 — 무슨 건인지, 판단받을 것과 그 근거`)));
      acts.appendChild(mkBtn('전달하기','',()=>submitPre(c,'delegate',null)));
      acts.appendChild(mkBtn('보류','',()=>submitPre(c,'hold',null)));
      acts.appendChild(send);
      card.appendChild(acts); box.appendChild(card); }
    box.appendChild(mkBtn('단서 모음으로 →','pri',()=>go('clue'))); }
  async function submitPre(c,k,text){ const st=S.cards[c.id]; if(preRes[c.id]) return; if(text!=null&&text.replace(/\s/g,'').length<8){ toast('내용이 너무 짧아요.'); return; }
    /* act 에 없는 기본 키(데이터 누락 대비 · E2-2 — act 최저점 + 공통 코멘트)도 서버가 한 번에 정한다(57차 E1 후속 — grade.js Score.pre7 · 예전에는 키마다 물어 최저점을 골랐다) */
    let r; try{ r=await Grader.run('pre7',c,{key:k,text:text!=null?text:null}); }catch(e){ toast('채점 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return; } if(preRes[c.id]) return;
    if(text!=null) st.text=text; if(r.forbidHit) st.forbidHit=true; const score=r.score, comment=r.comment; if(r.key) k=r.key;   /* 처리 키는 서버가 정한다(거절 키·수락 글 — 57차 E1) */
    preRes[c.id]={act:k,score,comment,text:text||null,forbidHit:!!st.forbidHit}; if(r.evv&&Array.isArray(r.ev)) preRes[c.id].ev=Ev.str(r.ev); else if(!Grader.local()&&!r.synth) S.evPart=1;
    if(r.sl&&typeof r.sl.g==='string'){ preRes[c.id].sg=r.sl.g; if(r.sl.s) preRes[c.id].ss=r.sl.s; }   /* 57차 E1 후속(B2) — 서버 서명 */ st.status='done'; st.act=k; st.score=score; runBranch(c.id,r.branch); toast(`${preName(c,k)} · ${score}점`); go('pre'); }
  /* 1) 단서 취합표 */
  function renderClue(box){ box.appendChild(h('h3',null,'단서 모음 — 6일 동안 내가 처리한 것에서 자동으로 뽑았어요')); const t=document.createElement('table'); t.className='sheet'; const hd=t.insertRow(); for(const x of ['일차','출처','단서','숫자']) hd.appendChild(h('th',null,x));
    for(const r of E.clueRows){ const k=rowFilled(r); const tr=t.insertRow(); tr.className=k?'':'gap'; tr.appendChild(h('td',null,dayLabel(r.day)));
      tr.appendChild(h('td',null,srcName(r,k))); tr.appendChild(h('td',null,k?rename(k.note):`(비었음 — ${humanize(r.empty)})`)); tr.appendChild(h('td',null,k?(k.value||r.value):'—')); }
    box.appendChild(t); const m=missingRows(); box.appendChild(h('p',m.length>=2?'bad':'muted',m.length?`빈 칸 ${m.length}개. ${E.clueNote||''}`:'빈 칸이 없어요. 6일을 잘 모았어요.'));
    box.appendChild(mkBtn('팀장 자료 보기 →','pri',()=>go('frag'))); }
  /* 2) 팀장 자료 */
  function renderFrag(box){ box.appendChild(h('h3',null,`팀장 자료 6조각 — ${rename(E.fragTitle||'')}`)); for(const f of E.fragments){ const d=document.createElement('details'); d.open=true; d.appendChild(h('summary',null,`${'①②③④⑤⑥'[f.n-1]||f.n} ${f.title}`)); d.appendChild(h('pre','body',rename(f.body))); box.appendChild(d); } box.appendChild(mkBtn('결정 칸으로 →','pri',()=>go('decide'))); }
  /* 3) 결정 칸 */
  function inputRow(label,unit,val,onch,hint,locked){ const row=h('div','irow'); row.appendChild(h('label',null,label)); const inp=document.createElement('input'); inp.type='text'; inp.value=val||''; inp.placeholder=hint||''; if(locked){ inp.readOnly=true; inp.disabled=true; } inp.oninput=()=>{ onch(inp.value); bump(); }; row.appendChild(inp); if(unit) row.appendChild(h('span','unit',unit)); return row; }
  /* 57차 E2-10(D22): 취합표·계산 칸은 칸마다 ✅/✗ 를 보이지 않고 서버에도 묻지 않는다 — 시행착오로 맞히게 되고 요청이 쌓였다(B3 E6 · W8).
     〔보고서로 →〕에서 한 번에 제출해 잠그고, 맞았는지는 발표가 끝난 뒤 결과 화면(엔딩)에서 본다 */
  function renderDecide(box){ const locked=!!F.lock; box.appendChild(h('h3',null,'① 취합표 12칸 — 자료 조각의 숫자를 옮겨 적어요')); const g=h('div','grid2');
    for(const t of E.table){ g.appendChild(inputRow(`${'①②③④⑤⑥'[t.frag-1]||''} ${t.label}`,t.unit,F.table[t.key],v=>{ F.table[t.key]=v; },'',locked)); }
    box.appendChild(g);
    box.appendChild(h('h3',null,'② 계산 3칸 — 답은 어디에도 인쇄돼 있지 않아요')); for(const c of E.criteria){ box.appendChild(inputRow(c.label,c.unit,F.calc[c.key],v=>{ F.calc[c.key]=v; },c.hint,locked)); }
    box.appendChild(h('p','muted',locked?'취합표·계산 칸은 제출했어요. 맞았는지는 발표가 끝난 뒤 결과 화면에서 알려 줘요.':'취합표·계산 칸은 〔보고서로 →〕를 누를 때 한 번에 제출돼요. 그 뒤로는 고칠 수 없어요.'));
    box.appendChild(h('h3',null,'③ 아이디어 1장 — 취합표의 숫자 하나를 이렇게 바꾸자 (얼마에서 얼마로)')); const ta=document.createElement('textarea'); ta.value=F.idea; ta.placeholder='취합표의 숫자 하나를 골라 무엇을 얼마에서 얼마로 바꿀지, 그러면 무엇이 달라지는지';   /* 57차 E1 후속(QA W-4) — 예전에는 데이터 모범 아이디어(만점 예시)를 그대로 보였다 */ ta.oninput=()=>{ F.idea=ta.value; bump(); }; box.appendChild(ta);
    box.appendChild(h('h3',null,'④ 결정')); for(const f of E.decisionFields){ const r=inputRow(f,'',F.decision[f],v=>{ F.decision[f]=v; },''); r.classList.add('wide'); box.appendChild(r); }   /* 결정 칸은 글이라 넓게(QA W-12) */ const td=document.createElement('textarea'); td.value=F.dropped; td.placeholder='버린 안 1개와 이유'; td.oninput=()=>{ F.dropped=td.value; bump(); }; box.appendChild(h('label','lbl','버린 안과 이유')); box.appendChild(td);
    box.appendChild(mkBtn('보고서로 →','pri',()=>{ if(!F.lock){ if(!confirm('취합표 12칸·계산 3칸을 제출하고 보고서로 넘어갈까요? 제출한 칸은 더 고칠 수 없어요.')) return; F.lock=1; } go('report'); })); }
  /* 4) 보고서 */
  function renderReport(box){ box.appendChild(h('h3',null,'보고서 1장 — 5칸 (각 0/1/2점)')); for(const r of E.report){ const d=h('div','rfield'); d.appendChild(h('label','lbl',r.title)); d.appendChild(h('div','muted',r.desc)); const ta=document.createElement('textarea'); ta.value=F.report[r.key]||''; ta.placeholder='쓰는 법: '+(r.desc||'');   /* 60차: 결과 화면에 좋은 예(모범 답안)를 싣지 않는다 — 약속 문구도 뺐다 */ ta.oninput=()=>{ F.report[r.key]=ta.value; bump(); }; d.appendChild(ta); box.appendChild(d); }
    box.appendChild(h('h3',null,'회고 (참고 · 점수에는 넣지 않습니다)')); const tr=document.createElement('textarea'); tr.value=F.reflection; tr.placeholder=E.reflection; tr.oninput=()=>{ F.reflection=tr.value; bump(); }; box.appendChild(tr);
    box.appendChild(mkBtn('발표로 →','pri',()=>go('present'))); }
  /* 5) 발표 */
  function renderPresent(box){ box.appendChild(h('h3',null,'발표 — 핵심 문장 하나를 골라 읽고, 팀장 질문 3개에 답해요')); const sel=document.createElement('select'); for(const r of E.report){ const o=document.createElement('option'); o.value=r.key; o.textContent=`${r.title}: ${(F.report[r.key]||'(비어 있음)').split('\n')[0].slice(0,50)}`; sel.appendChild(o); } sel.value=F.key; sel.onchange=()=>{ F.key=sel.value; bump(); }; box.appendChild(sel);
    /* 답 선택지는 질문마다 섞인 순서로(E2-6) — 고른 값(F.q[i])은 데이터 원래 번호 그대로라 채점은 바뀌지 않는다 */
    E.questions.forEach((q,i)=>{ const d=h('div','qbox'); d.appendChild(h('div','q',`팀장: "${q.q}"`)); for(const j of ordKeys('qo',String(i),q.choices.map((_,x)=>x))){ const c=q.choices[j]; const l=document.createElement('label'); l.className='opt'; const r=document.createElement('input'); r.type='radio'; r.name='q'+i; r.checked=F.q[i]===j; r.onchange=()=>{ F.q[i]=j; bump(); }; l.appendChild(r); l.appendChild(document.createTextNode(' '+c.label)); d.appendChild(l); } box.appendChild(d); });
    box.appendChild(mkBtn('발표 끝 — 팀장 판단 듣기','pri',()=>submit())); }
  /* 채점 — 팀마다 사건이 달라서 낱말·위반 판정은 전부 ep7 데이터에서 읽는다(45차: 고객상담팀 낱말 고정을 걷어냄).
     report[i].keywords  : [[낱말…],[낱말…]] 묶음 목록 — 묶음 안 낱말 하나만 있어도 그 묶음을 채운 것
     report[i].keywordsNeed : 2점에 필요한 묶음 수(기본 ①·③은 전부, ④는 2)
     report[3].dropWords : 「버린 안」으로 볼 낱말을 더한다(기본 낱말은 아래 DROP) */
  /* 최종 채점 — 로컬(정본)은 EP7Grade 를 바로, 배포본(정답 없음)은 서버가 같은 코드로. 서버는 엔딩 대사·칸별 좋은 예도 함께 돌려주므로 E 에 얹는다 */
  async function finalGrade(){ if(Grader.local()){ const g=EP7Grade.grade(E,F,{P,clues:S.clues,preRes,cards:D.cards}); return g; }
    const flushed=window.Backend&&typeof window.Backend.flush==='function'?window.Backend.flush():null; if(flushed) await withTimeout(Promise.resolve(flushed),8000).catch(()=>{});   /* 서버가 저장된 진행(단서·앞 날 결과)으로 채점한다 */
    const g=await Grader.run('ep7',null,{form:JSON.parse(JSON.stringify(F)),pre:preRes,clues:S.clues});
    if(g.endings) E.endings=g.endings; if(g.examples) for(const r of (E.report||[])) if(g.examples[r.key]) r.example=g.examples[r.key]; return g; }
  async function submit(){ const empty=E.report.filter(r=>!(F.report[r.key]||'').trim()); if(empty.length&&!confirm(`보고서 ${empty.length}칸이 비어 있어요. 그대로 발표할까요?`)) return; if(Object.keys(F.q).length<E.questions.length&&!confirm('답하지 않은 질문이 있어요. 그대로 발표할까요?')) return;
    const O=office(); const lead=(D.dests.find(x=>x.seat==='lead')||{}).name; F.lock=1;
    let g; try{ g=await finalGrade(); }catch(e){ toast('채점 서버에 연결하지 못했어요. 잠시 뒤 「발표 끝」을 다시 눌러 주세요.'); return; } result=g;
    const res={team:S.team,ep:7,day:7,at:new Date().toISOString(),ending:g.ending,rubric:g.rubric,total:g.total,feedback:g.feedback,violations:g.violations,missingClues:g.missingClues,report:F.report,decision:F.decision,dropped:F.dropped,idea:F.idea,table:F.table,calc:F.calc,reflection:F.reflection,questions:g.qs,cards:preRes,counts:{done:E.report.length-empty.length,all:E.report.length},tableOk:g.tableOk,calcOk:g.calcOk,ncs2:ep7Ncs2(g),sg:(g&&g.sl&&typeof g.sl.g==='string')?g.sl.g:null,p2why:g.p2why||null};
    P.done['7']=storedEp7(res); P.day=8; P.cur=null; for(const [n,v] of Object.entries(S.trust)) P.trust[n]=(P.trust[n]||0)+v; saveProgress(true);
    /* 45차: 3D 가 있으면 결정 화면을 접고 팀장이 부른다 — 가서 T 로 판단을 들은 뒤 엔딩 화면이 열린다(1~6일차 퇴근 마무리와 같은 방식) */
    const ld=leadName(); if(byT()&&ld&&typeof seatByName==='function'&&seatByName(ld)){ callWrap7(res,ld); return; }
    renderEnding(res); }
  function callWrap7(res,lead){ const leadText=endingLeadText(res);
    /* 팀장 말투 — 브리핑·판단 대사에 「~요」가 없으면 반말(day.js callWrap 과 같은 규칙) */
    const leadSays=((D.dialog&&D.dialog.briefing)||[]).filter(l=>l&&l.who&&(l.who===lead||lead.endsWith(l.who)||l.who.endsWith(lead))).map(l=>l.text).join(' ')+' '+leadText;
    const banmal=leadSays.trim()&&!/요[.?!…]|요\s*$/.test(leadSays);
    const lines=[{who:lead,text:banmal?'○○씨, 발표 잘 들었어. 내 판단 말할게.':'○○씨, 발표 잘 들었어요. 제 판단을 말할게요.'}]; if(leadText) lines.push({who:lead,text:leadText});
    $('ep7').classList.remove('open'); S.phase='wrap';
    wrapCallE=Talk.call(lead,lines,{ notice:`${lead}님이 부르세요. 자리로 가서 T 로 발표 결과를 들어요.`, remind:30000,
      onHeard:()=>{ wrapCallE=null; showEnding(res); } });
    $('enTitle').textContent='발표를 마쳤습니다'; $('enSub').textContent=`${lead}님이 부르세요 — 가서 T 로 판단을 들어요.`;
    $('endNotice').classList.add('open'); setTimeout(()=>$('endNotice').classList.remove('open'),2600); }
  function showEnding(res){ if(wrapCallE){ wrapCallE.cancel(); wrapCallE=null; } if(window.Talk&&Talk.isOpen&&Talk.isOpen()) Talk.close(); $('endNotice').classList.remove('open'); S.phase='ep7'; $('ep7').classList.add('open'); renderEnding(res); }
  /* 엔딩 팀장 대사 — B 는 ② 점수에 따라 둘 중 하나, C 는 위반 조항을 읽어 준다 */
  function endingLeadText(res){ const en=E.endings[res.ending]||{};
    let leadText=en.lead||''; if(res.ending==='B'){ const parts=leadText.split(/\s*\/\s*\[②[^\]]*\]\s*/); const noNums=res.p2why!=null?res.p2why!=='miss':res.rubric.p2<=1; leadText=(noNums&&parts[1])?parts[1]:parts[0];   /* 57차 E1 후속(QA Y-4⑤) — 「숫자가 없어요」는 ② 가 숫자·계산 때문에 낮을 때만 */ leadText=leadText.replace(/\[빈 칸 이름[^\]]*\]/,res.missingClues.length?res.missingClues.join(', '):'근거'); }
    if(res.ending==='C'){ const RB=window.OC&&OC.data&&OC.data.RULEBOOK; const reads=[]; for(const v of res.violations){ if(v.say){ reads.push(v.say); continue; } for(const id of (v.rules||[]).slice(0,1)){ let art=null; if(RB) for(const b of RB.books) for(const a of b.articles) if(a.id===id) art=a; reads.push(art?`"${art.body.split('. ')[0]}." ${id}.`:id); } if(!v.rules||!v.rules.length) reads.push(v.text); } leadText=leadText.replace(/^\[위반 항목[^\]]*\][^\n]*/,reads.join(' ')); }
    return leadText; }
  /* 7일 결과(엔딩) — 60차 3차(사용자 「조금 더 상세하면서도 가독성 좋게」): 결과 PDF(ResultPdf.blocks)와 같은 정보·순서, 섹션은 접지 않고 차례로.
     요약(이름·팀·기간·엔딩·보고서·업무 점수·강점 2·보완점 2) → NCS 7영역 막대 → 강점 → 보완점 → 하위능력 21 → 직무 경험 요약 → 일차별 업무 기록 → 7일차 보고 → 내가 쓴 글(접기).
     넓은 화면(1200px~)은 왼쪽에 섹션 목차가 붙어 있다. 판정·숫자는 ResultPdf.model(= NcsEval.report) 그대로. 좋은 예·칸별 채점 문장·조언 문장은 싣지 않는다 */
  function renderEnding(res){ rsFont(); const w=$('ep7Wrap'); w.innerHTML=''; w.className='wrap rs rsWide'; $('ep7').classList.add('rsPage');
    const nav=h('nav','rsNav'); nav.setAttribute('aria-label','결과 목차'); const body=h('div','rsBody'); body.id='ep7Body'; w.appendChild(nav); w.appendChild(body); fillEnding(body,res,nav); $('ep7').scrollTop=0;
    /* 1~6일차 카드 제목(화 데이터)을 받으면 근거 줄·일차별 기록을 다시 그린다 — 펼친 접기·스크롤은 그대로 */
    loadTitles().then(n=>{ if(!n||!body.isConnected) return; const st=$('ep7').scrollTop; const open=[...body.querySelectorAll('details')].map(d=>d.open);
      body.innerHTML=''; nav.innerHTML=''; fillEnding(body,res,nav); body.querySelectorAll('details').forEach((d,i)=>{ if(open[i]) d.open=true; }); $('ep7').scrollTop=st; }); }
  function fillEnding(body,res,nav){ const en=E.endings[res.ending]||{}; const nm=String(S.name||(P&&P.name)||'').trim();
    let m=null; try{ if(window.ResultPdf) m=ResultPdf.model(P,window.STORY||{},{team:S.team,name:nm,fill:(t)=>fillName(t)}); }catch(e){ console.info('결과 자료 건너뜀',e&&e.message); m=null; }
    /* 섹션 하나 + 목차 한 줄 */
    const secs=[]; const sec=(title,navLabel)=>{ const s=rsSec(body,title); secs.push([s,navLabel||title]); return s; };
    const hd=h('header','rsHead'); hd.appendChild(h('h1',null,nm?`${nm}님의 7일 결과`:'7일 결과'));
    const per=m&&m.period&&m.period.from?(m.period.from===m.period.to?m.period.from:`${m.period.from} ~ ${m.period.to}`):'';
    const nDone=m?m.daysDone.length:Object.keys(P.done||{}).length;
    hd.appendChild(h('p','rsMeta',[D.teamName,per,nDone?`${nDone}일 완료`:''].filter(Boolean).join(' · '))); body.appendChild(hd); secs.push([hd,'요약']);
    /* 요약 — 숫자 셋 + 강점·보완점 이름 */
    const st=h('div','rsStats'); const stat=(k,v,small)=>{ const d=h('div'); d.appendChild(h('span',null,k)); const b=h('b',null,v); if(small) b.appendChild(h('small',null,small)); d.appendChild(b); st.appendChild(d); };
    stat('엔딩',res.ending||'-',fillName(en.name||'')); stat('7일차 보고서',`${res.total!=null?res.total:'-'}/${(E.report||[]).length*2||10}`); if(m&&m.work&&m.work.avg!=null) stat('업무 점수 평균',String(m.work.avg)); body.appendChild(st);
    renderWeek(body,m,sec);
    /* 버튼 */
    const ft=h('div','foot'); if(window.ResultPdf) ft.appendChild(ResultPdf.button('pri'));   /* 내 결과 PDF — 방금 저장한 P 로 만든다 */
    ft.appendChild(mkBtn('홈으로','',()=>goHome(false))); body.appendChild(ft);
    const rs=h('div','rsRestart'); const sel=document.createElement('select'); sel.setAttribute('aria-label','다시 시작할 팀'); for(const k of TEAM_ORDER){ if(k===S.team) continue; const o=document.createElement('option'); o.value=k; o.textContent=TEAM_NAMES[k]; sel.appendChild(o); } rs.appendChild(sel);
    rs.appendChild(mkBtn((E.restart&&E.restart.label)||'다른 직무로 다시 시작','',()=>{ const u=new URL(location.href); u.search=`?team=${sel.value}&ep=1&fresh=1${S.code?'&code='+S.code:''}`; location.href=u.toString(); }));
    if(E.restart&&E.restart.text) rs.appendChild(h('p','rsNote',E.restart.text.replace(/\*\*/g,''))); body.appendChild(rs);
    /* 맨 아래 작은 글 — 기록이 빠진 날(사실) · NCS 고정 문구(spec Q2) */
    const fine=h('div','rsFine'); const R0=body._R;
    if(R0){ if(R0.legacy.length) fine.appendChild(h('p',null,`이전 방식으로 기록된 날(역량 표에 없음): ${R0.legacy.join('·')}일차`)); if(R0.part.length) fine.appendChild(h('p',null,`역량 기록이 일부 빠진 날: ${R0.part.join('·')}일차`)); if(R0.quit.length) fine.appendChild(h('p',null,`중간에 끝낸 날: ${R0.quit.join('·')}일차`)); }
    if(typeof NcsEval!=='undefined'&&NcsEval.STATEMENT) fine.appendChild(h('p',null,NcsEval.STATEMENT)); if(fine.childNodes.length) body.appendChild(fine);
    rsNav(nav,secs); }
  /* 왼쪽 목차 — 누르면 그 섹션으로, 지금 보는 섹션은 굵게(넓은 화면에서만 보인다 · play.html .rsNav) */
  function rsNav(nav,secs){ if(!nav) return; const ul=h('ul'); const items=[];
    for(const [el,label] of secs){ const li=h('li'); const b=h('button',null,label); b.type='button'; b.onclick=()=>{ const red=matchMedia('(prefers-reduced-motion: reduce)').matches; el.scrollIntoView({behavior:red?'auto':'smooth',block:'start'}); }; li.appendChild(b); ul.appendChild(li); items.push([el,b]); }
    nav.appendChild(ul);
    try{ const io=new IntersectionObserver((ents)=>{ for(const en of ents) if(en.isIntersecting){ for(const [el,b] of items) b.classList.toggle('on',el===en.target); } },{root:$('ep7'),rootMargin:'-10% 0px -80% 0px'}); for(const [el] of items) io.observe(el); }catch(e){} }
  /* 7화 칸 증거(57차 E1) — 채점 결과(EP7Grade · 배포본은 서버)가 낸 ev 를 하루 문자열로. 서버가 옛 번들이라 없으면 part */
  function ep7Ncs2(g){ if(typeof Ev==='undefined'||!Ev.on()) return null; const o={v:1,day:(g&&g.evv&&Array.isArray(g.ev))?Ev.str(g.ev):''}; if(!(g&&g.evv)||S.evPart) o.part=1; return o; }
  /* 저장할 7일차 기록 — 57차 E1(spec D28 · §3-6). 화면(엔딩)이 쓰는 파생값(칸별 피드백 문장·발표 반응·선택지 문장·아침 카드 코멘트·위반의 팀장 대사)은 빼고
     학생이 쓴 것(보고서·결정·버린 안·아이디어·회고·표·계산)·고른 것(발표 답 번호)·채점 결과만 남긴다 — 자소서용 기록(U8)은 이것으로 다시 읽는다 */
  function storedEp7(r){ const o={at:r.at,ending:r.ending,rubric:r.rubric,total:r.total,violations:(r.violations||[]).map(v=>({text:v.text,rules:v.rules||[]})),missingClues:r.missingClues||[],
      report:r.report,decision:r.decision,dropped:r.dropped,idea:r.idea,table:r.table,calc:r.calc,reflection:r.reflection,questions:(r.questions||[]).map(q=>({i:q.i,j:q.j,score:q.score})),
      tableOk:r.tableOk,calcOk:r.calcOk,counts:r.counts,cards:{}};
    for(const [id,x] of Object.entries(r.cards||{})){ const c={act:x.act,score:x.score}; if(x.text) c.text=x.text; if(x.forbidHit) c.forbidHit=true; if(x.ev) c.ev=x.ev; if(x.sg){ c.sg=x.sg; if(x.ss) c.ss=x.ss; } o.cards[id]=c; }
    if(r.ncs2) o.ncs2=r.ncs2; if(r.sg) o.sg=r.sg; if(r.p2why) o.p2why=r.p2why; return o; }
  const TITLES={};
  function titleOf(d,id){ if(!id) return ''; if(+d===7){ const c=CARD(id); return c?c.subj:''; } const k=`${S.team}-ep${d}`; if(TITLES[k]) return TITLES[k][id]||'';
    const st=window.STORY&&window.STORY[k]; if(st&&Array.isArray(st.cards)){ TITLES[k]={}; for(const c of st.cards) TITLES[k][c.id]=fillName(c.subj||''); return TITLES[k][id]||''; } return ''; }
  /* 1~6일차 화 데이터(제목만 쓴다) — 로컬은 파일, 배포본은 서버(공개본). 실패해도 화면은 「n일차 업무」로 둔다 */
  async function loadTitles(){ let n=0; for(let d=1; d<=6; d++){ const k=`${S.team}-ep${d}`; if(window.STORY&&window.STORY[k]) continue; if(!(P&&P.done&&P.done[String(d)])) continue;
      try{ await loadStory(S.team,d); n++; }catch(e){ console.info('제목 불러오기 건너뜀',k,e&&e.message); } } return n; }
  /* 대표 근거 이름 — 카드면 「제목」(길면 줄임), 하루 집계·7화 칸이면 그 항목 이름(「6일차 제때 처리」·「7일차 계산 칸」) */
  const cut=(t,n)=>t.length>n?t.slice(0,n-1)+'…':t;
  const cardName=(d,id,ov)=>{ if(!id){ const L=ov&&NCS.ov[ov]&&NCS.ov[ov].label; return d?`${d}일차 ${L||'업무'}`:''; } const t=titleOf(d,id); return t?`${d}일차 「${cut(t,30)}」`:`${d}일차 업무`; };
  /* ---------- 7일 역량 — NCS 직업공통능력 7영역(57차 E1 · spec §2-10 · 60차 화면) ----------
     영역: 점수 순 가로 막대 · 점수·수준 열 · 강점이 나온 영역만 강조색. 100점 종합 점수는 없다(U3).
     계산은 NcsEval.report(P) — 로컬 관리자·보고 도구(E4)·결과 PDF 와 같은 숫자다. 카드 제목은 그날 화 데이터에서(1~6일차는 필요할 때 불러온다) */
  function renderWeek(body,m,sec){ sec=sec||((t)=>rsSec(body,t)); const s0=sec('NCS 직업공통능력');
    if(typeof ncsReady!=='function'||!ncsReady()){ s0.appendChild(h('p','rsNote','역량 표를 불러오지 못했어요.')); return; }
    const R=NcsEval.report(P,{team:S.team}); body._R=R;
    if(R.legacy.length&&!Object.values(R.days).some(v=>v==='ok'||v==='part'||v==='quit')){ s0.appendChild(h('p','rsNote','이전 방식으로만 기록된 7일이라 역량 표를 낼 수 없어요.')); return; }
    const lv=(NCS.levels||[]).map(L=>L.name); s0.appendChild(h('p','rsMeta',`${String(NCS.std||'').replace('직업공통능력 ','')} 기준, 점수 0~100${lv.length?`, 수준은 ${lv.join(' < ')}`:''}`));
    const strongA=new Set(R.strengths.map(x=>NCS.subs[x.sub]&&NCS.subs[x.sub].area));
    /* 수준이 난 영역만 막대로 — 점수 없는 영역은 아래 하위능력 표에만 */
    const lvA=R.areas.filter(a=>a.status==='level');
    if(lvA.length){ const bars=rsBars(rsRank(lvA.map(a=>({name:a.name,S:a.S,level:a.levelName||'',mark:strongA.has(a.id)?'강점':''})))); bars.style.marginTop='20px'; s0.appendChild(bars); }
    /* 강점 · 보완점 — 결과 PDF 자료(m.sw)가 있으면 그것(근거 업무 = 실제 카드), 없으면 NcsEval 판정 + 대표 카드 */
    const areaOf=(c)=>{ const a=NCS.areas.find(A=>A.subs.includes(c)); return a?a.name:''; };
    const evFb=(d,card,ov)=>{ const t=card?titleOf(d,card):''; return {d,title:t?`「${cut(t,40)}」`:(ov&&NCS.ov[ov]?NCS.ov[ov].label:'업무'),act:'',score:null}; };
    const strengths=m&&m.sw?m.sw.strengths:R.strengths.map(x=>({name:x.name,area:areaOf(x.sub),levelName:R.subs[x.sub].levelName||'',S:x.S,see:NCS.subs[x.sub].see||'',say:'',ev:x.d?[evFb(x.d,x.card,(R.subs[x.sub].best||{}).ov)]:[]}));
    const gaps=m&&m.sw?m.sw.gaps:R.gaps.filter(x=>x.S!=null).map(x=>({name:x.name,area:areaOf(x.sub),levelName:R.subs[x.sub].levelName||'',S:x.S,see:NCS.subs[x.sub].see||'',say:'',ev:x.d?[evFb(x.d,x.card,(R.subs[x.sub].worst||{}).ov)]:[]}));
    /* 요약 블록에 강점·보완점 이름(머리 아래 숫자 줄 다음) */
    const sumL=(L)=>{ const f=document.createDocumentFragment(); L.forEach(x=>{ const p=h('span','ln'); p.appendChild(h('b',null,x.name)); p.appendChild(document.createTextNode(` ${x.levelName} ${x.S}`)); f.appendChild(p); }); return f; };
    const sumIt=[]; if(strengths.length) sumIt.push(['강점',sumL(strengths)]); if(gaps.length) sumIt.push(['보완점',sumL(gaps)]);
    if(sumIt.length){ const dl=rsDl(sumIt); dl.classList.add('rsSumDl'); body.insertBefore(dl,s0); }
    const item=(x)=>rsItem({name:x.name,area:x.area,pre:'점수',S:x.S,level:x.levelName,say:x.say,see:x.see,ev:(x.ev||[]).slice(0,2)});
    if(strengths.length){ const s=sec('강점'); for(const x of strengths) s.appendChild(item(x)); }
    if(gaps.length){ const s=sec('보완점'); for(const x of gaps) s.appendChild(item(x)); }
    /* 하위능력 21 — 영역별로 묶는다. 관찰이 있는 것은 줄마다(점수 · 수준 · 관찰 · 잘함), 관찰이 없는 것(다루지 않는 것 포함)은 맨 아래 한 줄로 묶어 「-」 */
    const s21=sec('하위능력 21개','하위능력'); const rows=[]; const none=[];
    for(const a of R.areas){ const on=a.subs.filter(c=>{ const X=R.subs[c]; return X.status==='level'||(X.status!=='x'&&X.n); }); none.push(...a.subs.filter(c=>!on.includes(c)));
      if(!on.length) continue; rows.push({cls:'grp',cells:[{t:a.name,span:5}]});
      for(const c of on){ const X=R.subs[c]; const lvl=X.status==='level'; rows.push({cls:lvl?'':'off',cells:[X.name,lvl?String(X.S):'-',lvl?X.levelName:'-',String(X.n),String(X.ok)]}); } }
    if(none.length) rows.push({cls:'off none',cells:[none.map(c=>R.subs[c].name).join(', '),'-','-','-','-']});
    s21.appendChild(rsTable([{t:'하위능력',w:'46%'},{t:'점수',num:true,w:'12%'},{t:'수준',w:'16%'},{t:'관찰',num:true,w:'13%'},{t:'잘함',num:true,w:'13%'}],rows));
    if(!m) return;
    /* 직무 경험 요약 — 업무 종류별 · 내 처리별 건수와 평균 점수 */
    if(m.exp&&m.exp.total){ const s=sec('직무 경험 요약','직무 경험'); s.appendChild(h('p','rsMeta',`${D.teamName} 7일 동안 받은 업무 ${m.exp.total}건, 평균 점수는 0~100`));
      const g=h('div','rsTwo'); const tb=(k,L)=>rsTable([{t:k,w:'56%'},{t:'건수',num:true,w:'20%'},{t:'평균 점수',num:true,w:'24%'}],L.map(x=>[x.label,String(x.n),x.avg==null?'-':String(x.avg)]));
      g.appendChild(tb('업무 종류',m.exp.byType)); g.appendChild(tb('내 처리',m.exp.byAct)); s.appendChild(g); }
    /* 일차별 업무 기록 — 날마다 소제목 · 팀장 한마디 · 표(업무 · 요청자 · 내 처리 · 하위능력 · 점수) */
    if(m.days.some(d=>d.cards.length)){ const s=sec('일차별 업무 기록','일차별 기록'); if(m.work&&m.work.avg!=null) s.appendChild(h('p','rsMeta',`업무 점수 평균 ${m.work.avg}, 업무마다 점수 0~100`));
      for(const d of m.days){ if(!d.cards.length) continue; const dh=h('h3','rsDay',`${d.d}일차 「${d.title}」`); const sm=[d.work!=null?`업무 점수 ${d.work}`:'',d.stateLabel||''].filter(Boolean).join(', '); if(sm){ dh.appendChild(document.createTextNode(' ')); dh.appendChild(h('small',null,sm)); } s.appendChild(dh);
        if(d.lead) s.appendChild(h('p','rsNote',`${d.leadName}: ${d.lead}`));
        s.appendChild(rsTable([{t:'업무',w:'33%'},{t:'요청자',w:'15%'},{t:'내 처리',w:'19%'},{t:'하위능력',w:'23%'},{t:'점수',num:true,w:'10%'}],
          d.cards.map(c=>{ const sc=c.score; return [c.title+(c.branch?' (후속)':''),c.from||'-',{t:c.act+(c.choice?`: ${c.choice}`:'')+(c.late?' (늦음)':''),cls:'st'+(c.act==='처리 못 함'?' bad':'')},{t:(c.subs||[]).join(', ')||'-',cls:'st'},{t:sc==null?'-':String(sc),cls:sc===0?'bad':sc!=null&&sc<60?'warn':''}]; }))); } }
    /* 7일차 보고 — 결과 · 보고서 칸별 점수 · 발표 질문 · (접기) 결정 · 보고서 원문 · 회고 */
    const e7=m.ep7; if(e7){ const s=sec('7일차 보고'); const kv=[];
      if(e7.ending) kv.push(['결과',`엔딩 ${e7.ending}${e7.endingName?' '+e7.endingName:''}`]); kv.push(['보고서',`${e7.total!=null?e7.total:'-'}/${e7.of}`]);
      if(e7.tableOk!=null) kv.push(['취합표',`${e7.tableOk}${e7.tableAll?'/'+e7.tableAll:''}칸 맞음`]); if(e7.calcOk!=null) kv.push(['계산',`${e7.calcOk}${e7.calcAll?'/'+e7.calcAll:''}칸 맞음`]);
      if(e7.violations.length) kv.push(['규정 위반',e7.violations.join(' / '),'bad']); s.appendChild(rsDl(kv));
      if(e7.report.some(f=>f.score!=null)) s.appendChild(rsTable([{t:'보고서 칸',w:'80%'},{t:'점수',num:true,w:'20%'}],e7.report.map(f=>[f.title,f.score!=null?`${f.score}/2`:'-'])));
      const qs=e7.questions.filter(q=>q.q); if(qs.length){ const t=h('h3','rsDay','발표 질문과 내 답'); s.appendChild(t); s.appendChild(rsTable([{t:'질문',w:'40%'},{t:'내 답',w:'48%'},{t:'점수',num:true,w:'12%'}],qs.map(q=>[q.q,q.answer||'-',q.score==null?'-':String(q.score)]))); }
      const dk=e7.decision.filter(f=>f.text).map(f=>[f.field,f.text]); if(e7.dropped) dk.push(['버린 안',e7.dropped]); if(e7.idea) dk.push(['아이디어',e7.idea]);
      const txt=e7.report.filter(f=>f.text);
      if(dk.length||txt.length||e7.reflection){ const inn=rsFold(s,'결정과 보고서 원문'); if(dk.length) inn.appendChild(rsDl(dk));
        for(const f of txt) inn.appendChild(rsText(`${f.title}${f.score!=null?` (${f.score}/2)`:''}`,f.text)); if(e7.reflection) inn.appendChild(rsText('회고',e7.reflection)); } }
    /* 내가 쓴 글(접기) */
    const wrote=[]; m.days.forEach(d=>d.cards.forEach(c=>c.texts.forEach(t=>wrote.push({d:d.d,title:c.title,label:t.label,text:t.text}))));
    if(wrote.length){ const s=sec('내가 쓴 글'); const inn=rsFold(s,`쓴 글 ${wrote.length}편 보기`); for(const x of wrote) inn.appendChild(rsText(`${x.d}일차 「${x.title}」 · ${x.label}`,x.text)); } }
  /* 자동 플레이(스모크) */
  async function auto(opts={}){ const fail=opts.path==='fail'; heardBrief(); if(wrapCallE){ wrapCallE.cancel(); wrapCallE=null; } if(S.phase==='wrap') S.phase='ep7'; if(!$('ep7').classList.contains('open')){ $('ep7').classList.add('open'); if(!$('ep7Body')) render(); }
    for(const c of D.cards){ if(preRes[c.id]) continue; const k=c.best; const textual=(k===c.best&&c.compose)||k==='reply'; await submitPre(c,k,textual?(c.compose&&c.compose.model)||'확인했습니다. 보고하겠습니다. 죄송합니다.':null); }
    for(const t of E.table) F.table[t.key]=t.answer; for(const c of E.criteria) F.calc[c.key]=c.answer; F.idea=(E.ideaExamples&&E.ideaExamples[0])||'숫자 하나를 바꾸자'; for(const f of E.decisionFields) F.decision[f]=f+': 정함';
    /* 버린 안은 그 팀 ④칸 「좋은 예」에서 가져온다(45차: 고객상담팀 문장 고정을 걷어냄) */
    const ex4=String((reportOf('p4').example)||'').replace(/^"|"$/g,''); const mDrop=ex4.match(/버린 안[\s\S]*$/); F.dropped=mDrop?mDrop[0]:'버린 안: 현재 방식 — 근거가 약해 접었다.';
    for(const r of E.report) F.report[r.key]=r.example.replace(/^"|"$/g,''); F.reflection='3일차를 다시 하고 싶다. 표를 먼저 세는 습관을 들이고 싶어서.'; F.key='p3'; F.lock=1;
    E.questions.forEach((q,i)=>{ let bi=0; q.choices.forEach((c,j)=>{ if(c.score>q.choices[bi].score) bi=j; }); if(fail&&i===2){ const w=q.choices.findIndex(c=>c.score===0); bi=w>=0?w:bi; } F.q[i]=bi; });
    const g=await finalGrade(); result=g;
    const res={team:S.team,ep:7,day:7,at:new Date().toISOString(),ending:g.ending,rubric:g.rubric,total:g.total,feedback:g.feedback,violations:g.violations,missingClues:g.missingClues,report:F.report,decision:F.decision,dropped:F.dropped,idea:F.idea,table:F.table,calc:F.calc,reflection:F.reflection,questions:g.qs,cards:preRes,counts:{done:5,all:5},tableOk:g.tableOk,calcOk:g.calcOk,ncs2:ep7Ncs2(g),sg:(g&&g.sl&&typeof g.sl.g==='string')?g.sl.g:null,p2why:g.p2why||null};
    P.done['7']=storedEp7(res); P.day=8; P.cur=null; saveProgress(true); renderEnding(res); return P.done['7']; }
  /* 검사용(tools/ep7_grade_test.mjs) — 화면 없이 데이터만 얹어 채점한다 */
  function _test(ep7){ E=ep7; preRes={}; for(const k of Object.keys(F)) if(F[k]&&typeof F[k]==='object') F[k]={}; else F[k]=''; F.key='p3'; return {form:F,grade:()=>gradeReport()}; }
  return {start,snapshot,auto,heardBrief,grade:()=>gradeReport(),form:F,result:()=>result,_test};
})();
/* 7일차에 __play.skip·skipBriefing 이 부르는 endBriefing(day.js) 은 카드 하루를 시작한다 — 7일차는 「브리핑을 들은 것으로 치고 결정 화면」으로 돌린다 */
(function(){ const _eb=window.endBriefing; if(typeof _eb!=='function') return;
  window.endBriefing=function(){ if(typeof D!=='undefined'&&D&&D.kind==='ep7'){ return EP7.heardBrief(); } return _eb.apply(this,arguments); }; })();
