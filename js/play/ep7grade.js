/* ======================================================================
   7일차 「결정」 순수 채점 — 서버(backend/ws7_grade.gs 번들)와 클라이언트(js/play/ep7.js)가 같은 코드를 돈다.
   EP7Grade.make(E,F,ctx) → {gradeReport, missingRows, missName, rowFilled, violations, clues}
   E = 화 데이터의 ep7(정답·루브릭·위반 판정식 포함 정본) · F = 학생이 채운 칸 · ctx = {P(진행: done·clues), clues(오늘 모은 단서), preRes(아침 카드 결과), cards(아침 카드)}
   아침 카드는 P 의 6일차 기록으로 그 학생이 실제로 받은 것만 남긴다(grade.js ep7PreCards · 57차 R1) — 서버는 화의 카드 전부를, 클라이언트는 이미 거른 D.cards 를 넘긴다.
   DOM·S·D 를 만지지 않는다. 화면용 이름(카드 제목)은 ep7.js 가 따로 붙인다.
   ====================================================================== */
const EP7Grade=(function(){
  function make(E,F,ctx){ ctx=ctx||{}; const P=ctx.P||{done:{},clues:{}}; const preRes=ctx.preRes||{}; const cards=ep7PreCards(ctx.cards,P);
  const rename=(s)=>{ if(!E||!E.rename||typeof s!=='string') return s; let t=s; for(const [a,b] of Object.entries(E.rename)) t=t.split(a).join(b); return t; };
  const nums=(t)=>(String(t||'').match(/\d[\d,\.]*/g)||[]).filter(x=>x.replace(/[,\.]/g,'').length>0);
  function clues(){ return ((P&&P.clues&&P.clues[E.caseId])||[]).concat((ctx.clues||[]).filter(k=>k.caseId===E.caseId)); }
  const dayLabel=(d)=>/^\d+$/.test(String(d))?String(d)+'일차':String(d).replace(/^(\d+)\s+/,'$1일차 ');
  function rowFilled(row){ const ks=clues(); return ks.find(k=>(row.cards||[]).includes(k.card)||(k.label&&row.day===k.label)||(k.card==='evening'&&/저녁/.test(row.day))); }
  function missingRows(){ return E.clueRows.filter(r=>!rowFilled(r)); }
  const missName=(r)=>`${dayLabel(r.day)} 「${rename(String(r.label||'').split(/\s*·\s*/)[0])}」`;
  const groupsOf=(r)=>(r&&Array.isArray(r.keywords)&&r.keywords.length)?r.keywords.map(g=>[].concat(g).filter(Boolean)).filter(g=>g.length):null;
  const groupHits=(text,groups)=>groups.filter(g=>g.some(w=>text.includes(w))).length;
  const DROP=/버린|대신|접었|검토했지만|하지 않은 이유|안 한 이유|반대/;
  function reportOf(k){ return (E.report||[]).find(r=>r.key===k)||{}; }
  function gradeReport(){ const R=E.report.map(r=>r.key); const T={}; for(const k of R) T[k]=F.report[k]||''; for(const k of ['p1','p2','p3','p4','p5']) if(T[k]==null) T[k]=''; const all=Object.values(T).join('\n')+'\n'+Object.values(F.decision).join('\n')+'\n'+F.dropped;
    const rub={}, fb={}; const miss=missingRows();
    /* 57차 E1(C7): 칸 대조는 grade.js cellOk — 정답·대체 표기(alt)·수로 읽어 같은 값(「1040」·「1천40」 = 「1,040」). 칸마다 맞았는지(cellsOk)는 증거(e7.table·e7.calc 의 of)용 */
    const cellsOk={table:{},calc:{}}; for(const t of E.table) cellsOk.table[t.key]=cellOk(F.table[t.key],t); for(const c of E.criteria) cellsOk.calc[c.key]=cellOk(F.calc[c.key],c);
    const calcOk=E.criteria.filter(c=>cellsOk.calc[c.key]).length; const tableOk=E.table.filter(t=>cellsOk.table[t.key]).length;
    const cl=clues(); const clueHits=cl.filter(k=>{ const ns=nums(k.note+' '+(k.value||'')); return ns.some(n=>T.p2.includes(n)); }).length;
    const p1=T.p1; const g1=groupsOf(reportOf('p1')); const k1=g1?groupHits(p1,g1)>=(reportOf('p1').keywordsNeed||g1.length):p1.length>=40; rub.p1=(nums(p1).length>=1&&k1)?2:(nums(p1).length>=1||p1.length>=30)?1:0;
    const p2=T.p2; const calcIn=E.criteria.some(c=>p2.includes(String(c.answer))); rub.p2=(clueHits>=3&&nums(p2).length>=5&&calcIn)?2:(nums(p2).length>=2||clueHits>=1)?1:0;
    /* ② 가 낮은 까닭 — 엔딩 B 팀장 말(「숫자가 없어요」 ↔ 「빈 칸 이름」)을 실제 까닭에 맞춘다(57차 E1 후속 · QA Y-4⑤: 보고서에 숫자·계산이 있는데 빈 칸 때문에 ② 가 깎이면 「숫자가 없어요」가 나왔다) */
    let p2why=rub.p2<=1?'nums':''; if(miss.length>=2){ if(rub.p2>1) p2why='miss'; rub.p2=Math.min(rub.p2,1); }
    const p3=T.p3; const hasWhen=/\d+월|\d+일|부터|뒤|이후|주\b/.test(p3); const hasRevert=/되돌|재검토|철회|다시 검토|원래대로|유지,|아니면/.test(p3); const hasCond=/조건|초과|이상|이면|경우|넘기면|넘으면/.test(p3); const g3=groupsOf(reportOf('p3')); const k3=g3?groupHits(p3,g3)>=(reportOf('p3').keywordsNeed||g3.length):true; rub.p3=(p3.length>=20&&hasWhen&&hasRevert&&k3)?2:(p3.length>=10&&(hasWhen||hasCond))?1:0;
    const p4=T.p4+' '+F.dropped; const r4=reportOf('p4'); const g4=groupsOf(r4); const imp=g4?groupHits(p4,g4):(nums(p4).length>=2?2:nums(p4).length); const dropped=DROP.test(p4)||(r4.dropWords||[]).some(w=>w&&p4.includes(w)); rub.p4=(imp>=(r4.keywordsNeed||2)&&dropped)?2:(imp>=1||dropped)?1:0;
    const cr=citedRules(T.p5+' '+T.p3); const viol=violations(all,T); rub.p5=viol.length?0:(cr.ids.length>=2&&!cr.unknown.length)?2:cr.ids.length>=1?1:0;
    let total=0; for(const k of R){ total+=rub[k]; fb[k]=(E.feedback[k]&&E.feedback[k][String(rub[k])])||''; if(k==='p2'&&rub[k]===1&&miss.length) fb[k]+=' 빈 칸: '+miss.map(missName).join(', '); }
    const qs=E.questions.map((q,i)=>{ const j=F.q[i]; const c=q.choices[j]; return {i,j,score:c?c.score:0,react:c?c.react:'(답하지 않음)',label:c?c.label:''}; }); const qAvg=Math.round(qs.reduce((a,b)=>a+b.score,0)/Math.max(1,qs.length));
    /* 발표 답변 위반 — 선택지에 violation(위반 번호 또는 {text,rules})이 달린 것을 고르면 */
    E.questions.forEach((q,i)=>{ const c=q.choices[F.q[i]]; if(!c||c.violation==null) return; const V=E.violations||[]; const v=typeof c.violation==='number'?V[c.violation]:c.violation; if(!v) return; const text=`${visibleText(v.text)} (발표 답변 「${c.label}」)`; if(!viol.some(x=>x.text===text)) viol.push({text,rules:v.rules||[],say:v.say||null}); });
    /* NCS 증거용 루브릭(57차 E1 · C8·§2-6): 카드 점수(엔딩)의 규칙은 그대로 두고(D33), 역량 증거에서는 겹쳐 세지 않는다 —
       ② 근거는 발표 1번 답의 상한 전 값(발표 답은 e7.q1 이 잰다) · ⑤ 규정은 보고서 글의 위반만(과거 카드 위반 past·아침 카드 위반 후보는 그 카드 증거로 이미 셌다 · 발표 답 위반은 e7.q) */
    const rubEv=Object.assign({},rub); const violText=violationsText(all,T); rubEv.p5=violText.length?0:(cr.ids.length>=2&&!cr.unknown.length)?2:cr.ids.length>=1?1:0;
    if(qs[0]&&qs[0].score===0){ if(rub.p2>1&&!p2why) p2why='q1'; rub.p2=Math.min(rub.p2,1); }
    if(rub.p4>0&&qs[1]&&qs[1].score<=10&&/그대로 두/.test(qs[1].label)&&/현상 유지|그대로/.test(F.dropped)) rub.p4-=1;
    rubEv.p4=rub.p4;
    if(viol.length){ rub.p5=0; fb.p5=((E.feedback.p5||{})['0']||'').replace('[위반 항목]',viol.map(v=>v.text).join(' / ')); }
    total=R.reduce((a,k)=>a+rub[k],0);
    let ending='B'; if(viol.length) ending='C'; else if(total>=8&&rub.p5>=1&&miss.length<2&&rub.p2>=2) ending='A';
    const idea=ideaScore(F.idea);
    const out={rubric:rub,total,feedback:fb,violations:viol,missing:miss,calcOk,tableOk,qs,qAvg,ending,idea}; if(p2why) out.p2why=p2why;
    const ev=ep7Ev(rubEv,cellsOk,qs,idea); if(ev){ out.evv=1; out.ev=ev; }
    return out; }
  /* 7화 아이디어 칸(57차 E1 · B cs-acct E9 · spec §2-2 e7.idea): 숫자 2개 이상 · 「A → B」/「…에서 …로」 · 비용·효과 낱말(원·만·%·건·일·절감·단축 …)
     셋 다 3 · 숫자 2개 이상 + 나머지 하나 2 · 숫자 1개 이상 1 · 없음 0 — 카드 점수에는 쓰지 않는다(증거만) */
  function ideaScore(t){ t=String(t||''); const n=nums(t).length; const arrow=/→|->|⇒|➔|에서\s*\S{0,16}?\s*(으로|로)(?![가-힣])/.test(t); const eff=/(원|만|억|%|퍼센트|건|개|명|일|주|개월|시간|분|비용|원가|절감|단축|감소|증가|줄|늘|낮|높|아끼|아낄|효과|개선|향상|방지|이득|손실|위약금|예산)/.test(t);
    return n>=2&&arrow&&eff?3:(n>=2&&(arrow||eff))?2:n>=1?1:0; }
  /* 7화 항목 증거 — 화 ep7.ncs2 의 항목(요소는 정답이 아니라 공개본에도 있다). 레지스트리(Ev)가 없으면 null */
  function ep7Ev(rubEv,cellsOk,qs,idea){ if(typeof Ev==='undefined'||!Ev.on()) return null; const L=(E.ncs2&&Array.isArray(E.ncs2.items))?E.ncs2.items:[]; const out=[]; const RB={0:0,1:1.5,2:3};
    for(const it of L){ let s=null; const o=it.ov;
      if(o==='e7.table'){ const ks=(it.of&&it.of.length)?it.of:E.table.map(t=>t.key); const k=ks.filter(x=>cellsOk.table[x]).length; s=(it.of&&it.of.length)?(Ev.ratioS(k,ks.length)||0):Ev.band(k,'table'); }
      else if(o==='e7.calc'){ const ks=(it.of&&it.of.length)?it.of:E.criteria.map(t=>t.key); s=Ev.ratioS(ks.filter(x=>cellsOk.calc[x]).length,ks.length)||0; }
      else if(/^e7\.p[1-5]$/.test(o)){ const k=o.slice(3); if(rubEv[k]!=null) s=RB[rubEv[k]]!=null?RB[rubEv[k]]:0; }
      else if(/^e7\.q[1-3]$/.test(o)){ const i=+o.slice(4)-1; const q=E.questions[i]; const a=qs[i]; if(q&&a){ const top=Math.max(...q.choices.map(c=>+c.score||0)); s=Ev.gradeS(a.score,a.j!=null&&(+a.score||0)>=top&&top>0,String(a.j),it); } }
      else if(o==='e7.idea') s=idea;
      else if(o==='e7.note') s=String(F.reflection||'').trim()?3:0;
      if(s!=null){ const e=Ev.item(null,it,s,{ep:7}); if(e) out.push(e); } }
    return out; }
  /* 위반 판정 — ep7.violations[i] = {text, rules,
       match:[정규식…]   한 문장 안에서 전부 맞아야 한다(문장 = 줄바꿈·마침표·물음표·세미콜론으로 나눈 조각)
       except:정규식      같은 문장에 있으면 위반이 아니다(예: "고지", "결재")
       negate:false       기본(true)은 맞은 곳 바로 뒤 부정("…하지 않는다·안 한다·금지")이면 넘어간다. 부정 자체가 위반인 항목만 false
       where:"text"       문장 단위가 아니라 보고서 전체에서 match 를 보고, except 도 전체에서 본다
       field:"p5"         그 칸(p1~p5·decision·dropped)만 본다
       amountOver:30000   같은 문장에 이 금액(원)을 넘는 돈이 있어야 한다
       past:[{day,card,act?,choice?,forbidHit?,replyBanHit?,delivered?}]  1~6일차 그 카드에서 그렇게 했으면 글과 무관하게 위반
       pastUnless:정규식   past 에 걸렸어도 보고서에 이 정규식이 있으면(바로잡는 내용을 썼으면) 위반으로 보지 않는다
       say:"…"          엔딩 C 에서 팀장이 읽어 줄 문장(없으면 rules[0] 조항의 첫 문장) }
     match 가 없고 past 도 없는 항목은 판정하지 않는다(이름표만). 발표 답변 위반은 questions[].choices[].violation. */
  const NEG=/^[^.\n]{0,14}?(하지 않|지 않|않는다|않고|않음|않습니다|않겠|안 한다|안 합니다|안 함|안 하고|안 하며|말 것|말고|금지|불가|못 한다|하지 말)/;
  const reCache={}; const RX=(s)=>{ if(s instanceof RegExp) return s; try{ return reCache[s]||(reCache[s]=new RegExp(s)); }catch(e){ console.warn('위반 판정식 오류',s); return /$^/; } };
  const splitSent=(t)=>String(t||'').split(/\n|[.。!?;](?!\d)|\s\/\s/).map(x=>x.trim()).filter(Boolean);
  const wonIn=(t)=>{ const out=[]; const re=/(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(억|만\s*원|만|원)/g; let m; while((m=re.exec(t))){ const n=parseFloat(m[1].replace(/,/g,'')+(m[2]?'.'+m[2]:'')); const u=m[3].replace(/\s/g,''); out.push(u==='억'?n*1e8:u.startsWith('만')?n*1e4:n); } return out; };
  /* 화면에 내보내는 위반 이름 — 괄호 속 제작 메모(「…면 자동」 등)는 뺀다 */
  const visibleText=(s)=>String(s||'').replace(/\s*[—-]\s*[^—()]*(자동|취합표에 자동 표시)[^()]*$/,'').replace(/\s{2,}/g,' ').trim();
  function pastHit(conds){ for(const c of [].concat(conds||[])){ const r=P&&P.done&&P.done[String(c.day)]; const st=r&&r.cards&&r.cards[c.card]; if(!st) continue;
      const ok=Object.entries(c).every(([k,v])=>{ if(k==='day'||k==='card') return true; const got=st[k]; return Array.isArray(v)?v.includes(got):got===v; }); if(ok) return true; } return false; }
  function violationHit(v,all,T){ if(v.past&&pastHit(v.past)&&!(v.pastUnless&&RX(v.pastUnless).test(all))) return true; const m=[].concat(v.match||[]).filter(Boolean); if(!m.length) return false;
    const src=v.field?(v.field==='decision'?Object.values(F.decision).join('\n'):v.field==='dropped'?F.dropped:(T[v.field]||'')):all;
    if(v.where==='text'){ if(!m.every(p=>RX(p).test(src))) return false; if(v.except&&RX(v.except).test(src)) return false; return true; }
    for(const s of splitSent(src)){ if(!m.every(p=>RX(p).test(s))) continue; if(v.except&&RX(v.except).test(s)) continue;
      if(v.amountOver!=null&&!wonIn(s).some(n=>n>v.amountOver)) continue;
      if(v.negate!==false&&m.some(p=>{ const mm=RX(p).exec(s); return mm&&NEG.test(s.slice(mm.index+mm[0].length)); })) continue;
      return true; }
    return false; }
  /* 보고서 글만으로 걸리는 위반(past 조건 빼고) — NCS e7.p5 증거용(57차 E1) */
  function violationsText(all,T){ const out=[]; for(const v of (E.violations||[])){ const m=[].concat(v.match||[]).filter(Boolean); if(!m.length) continue; if(violationHit(Object.assign({},v,{past:null}),all,T)) out.push(visibleText(v.text)); } return out; }
  function violations(all,T){ const V=E.violations||[]; const out=[];
    for(const v of V){ if(violationHit(v,all,T)) out.push({text:visibleText(v.text),rules:v.rules||[],say:v.say||null}); }
    for(const c of cards){ const hint=c.violationHint||''; const ids=hint.match(/[A-Z]{2,4}-\d{2}/g)||[]; if(!ids.length) continue; const pr=preRes[c.id]; if(pr&&pr.act===c.best) continue; if(!ids.some(i=>(T.p5||'').includes(i))) out.push({text:hint.replace(/^7화 C 위반 후보\s*/,''),rules:ids}); }
    return out; }
    return {gradeReport,missingRows,missName,rowFilled,violations,clues,rename,dayLabel}; }
  /* 서버가 부르는 한 줄 — 빈 칸 이름까지 붙여 준다(화면은 카드 제목을 모른다) */
  function grade(E,F,ctx){ const m=make(E,F,ctx); const g=m.gradeReport(); g.missingClues=g.missing.map(m.missName); return g; }
  return {make,grade};
})();
if(typeof window!=='undefined') window.EP7Grade=EP7Grade;
