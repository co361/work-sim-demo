/* ======================================================================
   채점 — 규칙 채점(30차 §4 확장: 조항 인용·값·금지어·계산값·지적 항목) + AI 첨삭 훅(Backend.grade)
   57차 E1 — 순수 공용부가 카드 점수와 함께 **NCS 역량 증거(ev)** 를 낸다(아래 Ev · docs/ncs57/E1-api.md · spec §2·§3-5).
   ====================================================================== */
const RULE_ID=/\b[A-Z]{2,4}-\d{2}\b/g;
const RULE_ID1=/^[A-Z]{2,4}-\d{2}$/;
function normNum(s){ return String(s==null?'':s).replace(/[\s,원건일회%]/g,'').replace(/만$/,''); }
/* 57차 E1(C7) — 한글 단위가 섞인 수(「1천40」·「3.5만」·「1억 2천만」·「8.0」)를 값으로. 못 읽으면 null. 7화 취합표·계산 칸의 대체 표기용 */
function numSmall(t){ if(t==='') return 0; let v=0, cur=t; for(const [u,m] of [['천',1000],['백',100]]){ const i=cur.indexOf(u); if(i>=0){ const a=cur.slice(0,i); const n=a===''?1:(/^\d+(\.\d+)?$/.test(a)?+a:NaN); if(!isFinite(n)) return null; v+=n*m; cur=cur.slice(i+1); } }
  if(cur){ if(!/^\d+(\.\d+)?$/.test(cur)) return null; v+=+cur; } return v; }
function numVal(s){ const t=String(s==null?'':s).replace(/[\s,]/g,'').replace(/(원|건|일|회|개|명|%|퍼센트)+$/,''); if(!t) return null; if(/^[-+]?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  let total=0, rest=t, any=false; for(const [u,m] of [['억',1e8],['만',1e4]]){ const i=rest.indexOf(u); if(i>=0){ const v=numSmall(rest.slice(0,i)); if(v==null) return null; total+=(rest.slice(0,i)===''?1:v)*m; rest=rest.slice(i+1); any=true; } }
  const v=numSmall(rest); if(v==null) return null; if(!any&&!/[천백]/.test(t)) return null; return total+v; }
/* 7화 칸 하나가 맞았나 — 정답·대체 표기(alt)의 normNum 이 같거나, 수로 읽어 같으면(「1040」·「1천40」 = 「1,040」) */
function cellOk(val,t){ const v=String(val==null?'':val); if(!v.trim()||!t) return false; const cands=[t.answer].concat(t.alt||[]).filter(x=>x!=null&&String(x)!=='');
  if(cands.some(a=>normNum(v)===normNum(a))) return true; const n=numVal(v); return n!=null&&cands.some(a=>{ const m=numVal(a); return m!=null&&Math.abs(m-n)<1e-9; }); }
function includesAny(text,arr){ return (arr||[]).some(k=>k&&text.includes(k)); }
/* 금지 표현(45차: 「어렵습니다·불가합니다·곤란합니다」도 부정으로 본다): 바로 뒤에 부정("…이 아니라", "…지 않", "…수 없", "…지 마세요")이 오면 안내문으로 보고 넘어간다.
   57차 E1(C1): 「아닙니다·틀려요·틀렸·다르·달라·위반·잘못·오류」도 부정 — 금지 표현을 인용해 바로잡거나 거절한 글(「가족 연락처는 제공 대상이 아닙니다」·「챗봇 초안의 2~3일은 틀렸어요」)이 −20 을 받았다 */
const FORBID_NEG=/^(?:[^.。\n]{0,26})?(아니|아닙|않|없|마세요|말고|금지|안 |못 |어렵|어려|불가|곤란|틀리|틀렸|틀려|다르|달라|다릅|위반|잘못|오류)/;
/* 57차 E1 후속 2(done-cs 15) — 조건부 약속. **약속꼴** 금지 표현(-겠·드리·드릴·할게 …) 앞 같은 절에 절차 조건이 있으면 무조건 약속이 아니다 — 금지로 보지 않는다
   (「7일 안에 신청해 주시면 바로 접수해 드리겠습니다」 · 「예외가 승인되면 반품 접수해 드리겠습니다」 · 「결재가 난 뒤 지급해 드리겠습니다」 · 「입고되는 대로 보내 드리겠습니다」).
   거짓 음성을 막는 겹:
   ① 조건은 **절차·사건**이다(COND_EVENT — 승인·결재·확인·판정·접수·신청·제출·입고·도착·회수·완료 …). 조건 낱말 자체에 있거나(「승인되면」「신청하시면」「확인 후」),
      조건 낱말이 보조·가벼운 말(「주시면·되면·나면·경우·뒤·대로·시」)이면 바로 앞 두 낱말에 있어야 한다(「서류를 보내 주시면」「결재가 나면」「승인이 된 경우」).
      「원하시면·필요하시면·급하시면·괜찮으시면」 같은 바람·사정, 「대면·서면·측면·화면 …」 같은 이름씨, 「말씀드리면·보시면」 같은 말버릇은 조건이 아니다
   ② 조건과 금지 표현 사이가 한 절 — 40자 안 · 대조·전환 이음말(「지만·는데·으나·다만·하지만·그런데·반면·대신·또한·그리고」)·마침표 없이 끝난 문장(「…주세요 」「…습니다 」) 없음
   ③ 약속꼴이 아닌 금지 표현(단정·탓·지시·허락·지난 일 — 「문제없습니다」「고객님 잘못」「보내셔도 됩니다」「접수해 드렸」)과 값·일정·예외를 말하는 금지 표현
      (수 · 오늘·내일·요일·오전 … · 이번·예외·그냥·없이·조용히·먼저·일단·대신 …)은 조건이 있어도 금지 — 조건이 그 말을 맞게 만들지 않는다(예전과 같은 판정)
   ④ 카드가 조건절 허용을 끈다(strict) — compose.forbidStrict(없으면 replyCheck.forbidStrict) = 첫 글 · alsoReply.forbidStrict = 둘째 글: true 면 그 글의 금지 표현 전부, 목록이면 그 표현만
      (「확인되면 바로 환불해 드리겠습니다」처럼 조건이 있어도 규정상 해 주면 안 되는·남이 정할 약속 — composeSpec · strictOf)
   ⑤ 선택지를 안내하는 카드는 바람 조건(「원하시면·고르시면·선택하시면」)도 조건으로 본다 — compose.forbidWish(없으면 replyCheck.forbidWish) · alsoReply.forbidWish = true
      (cs_ep4_ask_soldout 「원하시면 베이지로 보내 드리겠습니다」는 대체 발송 안내 — 무조건 「베이지로 보내 드리겠습니다」와 같은 낱말이라 데이터로 가를 수 없었다) */
const FORBID_PROMISE=/겠|드리|드릴|드립|할게|줄게|해 ?줄|해 ?두|하겠/;
const FORBID_ABS=/\d|오늘|내일|모레|익일|당일|이번|다음 ?주|다음 ?달|이달|주말|오전|오후|[월화수목금토일]요일|예외|그냥|없이|조용히|몰래|모른 ?척|먼저|일단|미리|대신/;
const COND_EVENT=/승인|결재|발주|확인|판정|검토|검수|검사|확정|결정|접수|신청|제출|첨부|작성|주문|방문|도착|입고|출고|회수|반품|완료|처리|등록|발급|반납|수령|입금|정산|보완|서명|동의|인증|대조|협의|합의|허가|통과|수리|교체|점검|복구|해결|마감|심사|평가|배정|조회|허락|상신|서류|증빙|영수증|사본|보내|알려|올려|올리|가져|갖추|갖춰|채워|채우|끝나|끝내|나오|들어오|거치|거쳐|연락|말씀해/;
const COND_END=/(?:[가-힣]+면|[가-힣]+ 경우(?:에는|에|엔)?|[가-힣]+ (?:뒤|후|다음)(?:에는|에야|에|부터|로)?|[가-힣]+[는은] 대로|[가-힣]+ 시(?:에는|에)?|[가-힣]+야만?|[가-힣]+거든)(?=[\s,]|$)/g;
const COND_WISH=/원하|바라|고르|선택|희망/;
const COND_LIGHT=/^(?:주시|주|되|돼|되시|나|나시|오|오시|이|하시|하|받으시|받으|거치|거치시|내시|내|계시|가시|가)(?:면|야만?|거든)$|^[가-힣]{1,3}야만?$/;
const COND_NOT=/^(?:대|서|측|화|전|양|표|장|방|국|지|수|가|정|단|내|외|평|곡|안|체|당|직|반|일|후|면)면$|(?:말씀드리|말하|정리하|요약하|종합하|보시|보|생각하)면$|^(?:아니|그|이|저)야$/;
const COND_BREAK=/지만|는데|은데|인데|으나|다만|하지만|그러나|그런데|반면|한편|대신|또한|그리고|아울러|더불어|[;:]|(?:습니다|니다|세요|어요|아요|예요|에요|까요|지요|죠)(?=[\s,(])/;   /* 마침표 없이 끝난 문장(「…정리해 주세요 …」)도 절의 끝 */
/* 문장 머리(같은 문장 안 금지 표현 앞) — 「5.0%」·「1.5배」의 점은 문장 끝이 아니다 */
function sentHead(text,i){ let j=i-1; for(;j>=0;j--){ const ch=text[j]; if(ch==='\n'||ch==='!'||ch==='?'||ch==='。'||ch==='…') break; if(ch==='.'&&!/\d/.test(text[j+1]||'')) break; } return text.slice(j+1,i); }
/* 머리에 금지 표현까지 이어지는 절차 조건이 있나 — 금지 표현에 가장 가까운 조건 하나만 본다(더 먼 조건은 그 사이에 끊김이 있거나 더 멀다) */
function condHead(head,wish){ let last=null; COND_END.lastIndex=0; let m; while((m=COND_END.exec(head))) last={at:m.index,end:m.index+m[0].length,w:m[0]}; if(!last) return false;
  const toks=last.w.trim().split(/\s+/); const word=toks[toks.length-1]; if(COND_NOT.test(word)) return false;
  const light=toks.length>1||COND_LIGHT.test(word);   /* 「확인된 경우」「승인 뒤」「입고되는 대로」「승인 시」 · 「보내 주시면」「결재가 나면」 — 앞 낱말이 조건의 내용 */
  const scope=light?head.slice(0,last.at).trim().split(/\s+/).slice(-2).join(' ')+' '+last.w:last.w;
  if(!COND_EVENT.test(scope)&&!(wish&&COND_WISH.test(scope))) return false;
  const gap=head.slice(last.end); return gap.length<=40&&!COND_BREAK.test(gap); }
/* strict = 조건절 허용 끔(④) · 약속꼴이 아니거나 값·일정·예외 표현은 늘 끔(③) · strict==='wish' = 바람 조건도 조건(⑤) ·
   strict==='any' = 표현 꼴과 무관하게 허용(수락 판정 — 「요청하신 대로」는 약속꼴이 아니지만 뒤에 붙는 말이 약속이다 · acceptHit) */
function forbidHit(text,k,strict){ const hard=strict===true||(strict!=='any'&&(!FORBID_PROMISE.test(k)||FORBID_ABS.test(k))); let i=text.indexOf(k); while(i>=0){ const tail=text.slice(i+k.length,i+k.length+28); if(!FORBID_NEG.test(tail)&&(hard||!condHead(sentHead(text,i),strict==='wish'))) return true; i=text.indexOf(k,i+1); } return false; }
/* 그 글의 금지 표현 하나의 조건절 판정 — true(허용 끔: spec.forbidStrict true | [표현…]) · 'wish'(바람 조건도: spec.forbidWish) · false */
function strictOf(spec,k){ const s=spec&&spec.forbidStrict; if(s===true||(Array.isArray(s)&&s.includes(k))) return true; return spec&&spec.forbidWish?'wish':false; }
/* 57차 E1(C16 · 10팀 2차 ①) — 「받아들이면 안 되는 글」의 수락 표현(엔진 공통 기본 금지). 거절이 정답인 카드의 회신 · 첫 글이 상신인 두 글 카드의 둘째 글 · 7화 거절 아침 카드(카드 데이터로 끄고 켠다 — acceptWrong).
   카드 금지 표현과 같이 부정 인식(forbidHit)을 거친다 — 「요청하신 대로 진행하기는 어렵습니다」는 수락이 아니다.
   대안을 안내하는 거절문에도 흔한 말(「처리해 드리겠습니다」·「가능합니다」·「말씀하신 대로」)은 넣지 않았다 — 70화 모범 답안에서 잡히는 것 0(스크래치 accept_scan).
   팀 데이터로 더 막을 말은 카드 compose.forbid 에 둔다(그 카드의 금지 표현으로 걸린다) */
const ACCEPT_DEFAULT=['요청하신 대로','요청대로','원하시는 대로','원하신 대로','그대로 진행','그대로 처리','그대로 반영','그대로 적용','그대로 해 드리','동의합니다','동의드립니다','동의하겠','수락합니다','수락하겠','승인해 드리','받아들이겠'];
/* 값 하나가 들어 있나: mustAlt 로 대체 표기 허용 */
function hasValue(text,k,alt){ if(text.includes(k)) return true; const a=(alt&&alt[k])||[]; return a.some(x=>text.includes(x)); }

/* 규칙 채점: 5요소 각 20 · mustInclude 누락 −15 · forbid −20 · replyCheck 미달이면 상한 · 조항 미인용이면 정보 축 상한 60
   57차 E1(C3 · 10팀 2차 ⑧): 「다음 행동」이 메신저 말투(쓸게·보낼게·갈게)와 일반 -겠습니다(만들겠습니다·뽑겠습니다)를 읽는다 */
const NEXT_ACT=/드리겠|하겠|겠습니다|겠어요|예정|안내|드릴게|할게|[가-힣]게요|해 두|드립니다|주세요|주시면|반영|처리했|접수했|요청했|보고했|진행|회신드리|알려 드리|보내 드리/;
function gradeText(c,text,spec){ spec=spec||composeSpec(c); const isMsg=c.type==='msg'||spec.msg; const t=text||'';
  const must=spec.mustInclude||[]; const missing=must.filter(k=>!hasValue(t,k,spec.mustAlt)); const anyOk=!spec.mustAny||spec.mustAny.length===0||includesAny(t,spec.mustAny);
  const forbid=uniq((spec.forbid||[]).filter(k=>k&&forbidHit(t,k,strictOf(spec,k)))); const rc=spec.replyCheck; const needOk=rc?rc.need.every(g=>g.some(k=>t.includes(k))):true;
  const rules=spec.ruleFacts||[]; const cited=rules.length?rules.some(id=>t.includes(id)):null;
  const els={ '인사':isMsg||/안녕하세요|안녕하십니까|감사|죄송/.test(t), '확인':/문의|주신|확인|말씀|받았|받으신|주문|요청|접수|건은|건이|건,|말씀하신|보내 주신|주셨/.test(t),
    '답':(must.length?missing.length===0:(rc?needOk:t.replace(/\s/g,'').length>=30))&&anyOk, '다음 행동':NEXT_ACT.test(t), '맺음':isMsg||/감사합니다|감사드립니다|드림|올림|부탁드립니다|양해 부탁|죄송합니다\.?\s*$/.test(t) };
  let score=Object.values(els).filter(Boolean).length*20; score-=missing.length*15; score-=forbid.length*20; if(!anyOk) score-=10;
  if(rc&&!needOk) score=Math.min(score,rc.partialScore||60); if(cited===false) score-=10; score=Math.max(0,Math.min(100,score));
  const rcMiss=rc?rc.need.map((g,i)=>g.some(k=>t.includes(k))?null:'#'+i).filter(Boolean):[];
  return {score,els,missing,forbid,partial:rc?!needOk:false,cited,anyOk,rcMiss,source:'규칙 채점'}; }
/* 카드에서 작성 규격을 모은다: compose > 낱개 필드(mustInclude/replyBan/ruleFacts) > 분기 표에서 온 금지 표현(forbid:…)
   57차 E1(10팀 2차 ⑦): 둘째 글(alsoReply 객체)은 **그 글의 replyCheck** 만 본다 — 예전에는 첫 글 replyCheck.need·model 을 물려받아 둘째 글이 첫 글 필수 값으로 채점됐다 */
function composeSpec(c,which){ const second=which==='second'; const also=second&&typeof c.alsoReply==='object'?c.alsoReply:null; const cp=also||c.compose||{};
  const rc=second&&also?(also.replyCheck||null):(c.replyCheck||null);
  const spec={mustInclude:cp.mustInclude||[],mustAny:cp.mustAny||c.mustAny||[],mustAlt:cp.mustAlt||c.mustAlt||null,forbid:(cp.forbid||[]).slice(),ruleFacts:cp.ruleFacts||[],replyCheck:rc,model:cp.model||(rc&&rc.model)||''};
  if(!second){ if(!c.compose&&c.mustInclude&&c.mode!=='ask') spec.mustInclude=c.mustInclude; if(c.replyBan) spec.forbid=spec.forbid.concat(c.replyBan); if(!cp.ruleFacts&&c.ruleFacts&&Array.isArray(c.ruleFacts)&&c.ruleFacts.some(x=>RULE_ID1.test(x))) spec.ruleFacts=c.ruleFacts; }
  else { if(cp.replyBan) spec.forbid=spec.forbid.concat(cp.replyBan); }
  /* ask 카드: 받은 답 값(mustInclude)은 회신에 들어가야 한다 */
  if(c.mode==='ask'&&!second&&c.mustInclude&&!spec.mustInclude.length) spec.mustInclude=c.mustInclude;
  const br=(D&&D.branches&&D.branches[c.id])||{}; for(const k of Object.keys(br)){ if(k.startsWith('forbid:')){ const p=k.slice(7); if(p&&!spec.forbid.includes(p)) spec.forbid.push(p); } }
  spec.forbid=uniq(spec.forbid); spec.which=second?'reply2':'reply';
  /* 57차 E1 후속 2 — 조건절 판정 표시(forbidHit ④⑤): 첫 글 compose.forbidStrict(없으면 replyCheck.forbidStrict) · 둘째 글 alsoReply.forbidStrict —
     true(허용 끔) | [금지 표현…](그 표현만 끔) | false(허용 — 검토해서 켜 둔 글임을 적는 표시). 작성 규격(compose·replyCheck)이 없는 카드의 첫 글(replyBan·분기 forbid: 만 있는
     전달·보고 카드의 흐름 밖 글)은 끈다 — 조건부 문장이 맞는지 가늠할 모범 답안이 없다. forbidWish = 바람 조건도 조건으로(⑤) */
  const fsOf=(o)=>(o&&typeof o==='object'&&(typeof o.forbidStrict==='boolean'||Array.isArray(o.forbidStrict)))?o.forbidStrict:null;
  const fwOf=(o)=>(o&&typeof o==='object'&&typeof o.forbidWish==='boolean')?o.forbidWish:null;
  spec.forbidStrict=second?fsOf(also):(fsOf(c.compose)!=null?fsOf(c.compose):fsOf(c.replyCheck)!=null?fsOf(c.replyCheck):(c.compose||c.replyCheck)?null:true);
  spec.forbidWish=!!(second?fwOf(also):(fwOf(c.compose)!=null?fwOf(c.compose):fwOf(c.replyCheck))); return spec; }
/* 조항 인용 검사(사규집 실재 여부 포함) */
function citedRules(text){ const ids=uniq((String(text||'').match(RULE_ID)||[])); const RB=(window.OC&&OC.data&&OC.data.RULEBOOK)||null; if(!RB) return {ids,unknown:[]}; const all=new Set(); for(const b of RB.books) for(const a of b.articles) all.add(a.id); return {ids,unknown:ids.filter(i=>!all.has(i))}; }
/* 계산값·결과값 대조 */
function checkWork(c,ans){ if(workCells(c)) return checkWorkCells(c,ans); const a=normNum(ans); if(!a) return {ok:false,trap:false}; const right=[c.workAnswer].concat(c.workAlt||[]).filter(Boolean).map(normNum); const trap=(c.workTrap||[]).map(normNum); if(right.includes(a)) return {ok:true,trap:false}; return {ok:false,trap:trap.includes(a)}; }
/* 답 칸이 여러 개인 표·양식: workAnswers:[{key,label,unit?,answer,alt?,trap?,hint?}] */
function workCells(c){ return Array.isArray(c.workAnswers)&&c.workAnswers.length?c.workAnswers:null; }
function parseCells(ans){ return (typeof ans==='string')?(()=>{ try{ return JSON.parse(ans); }catch(e){ return {}; } })():(ans||{}); }
function checkWorkCells(c,ans){ const cells=workCells(c); const got=parseCells(ans);
  const wrong=[]; const okKeys=[]; let trap=false;
  for(const cell of cells){ const v=normNum(got[cell.key]); const right=[cell.answer].concat(cell.alt||[]).filter(x=>x!=null).map(normNum);
    if(v&&right.includes(v)){ okKeys.push(cell.key); continue; } wrong.push(cell.label||cell.key); if(v&&(cell.trap||[]).map(normNum).includes(v)) trap=true; }
  return {ok:wrong.length===0,trap,wrong,okKeys,cells:cells.length,right:cells.length-wrong.length}; }
/* 여러 칸 답을 화면·저장에 쓰는 한 줄로 */
function workText(c,ans){ const cells=workCells(c); if(!cells) return String(ans==null?'':ans); const got=parseCells(ans);
  return cells.map(x=>{ const v=String(got[x.key]==null||got[x.key]===''?'-':got[x.key]); const u=x.unit||''; return `${x.label||x.key} ${v}${(!u||v==='-'||v.endsWith(u))?'':u}`; }).join(' · '); }
/* 결재 검토: 지적 항목 개수 */
function countFlags(c,text){ const f=c.mustFlag||(c.compose&&c.compose.mustInclude)||[]; if(!f.length) return {n:0,all:0,hit:[]}; const hit=f.map(k=>[].concat(k).some(x=>x&&text.includes(x))); return {n:hit.filter(Boolean).length,all:f.length,hit}; }   /* 45차: 지적 항목 하나를 [동의어…] 배열로도 받는다 */


/* ======================================================================
   ▼ 순수 채점 공용부 — 서버(backend/ws7_grade.gs 번들)와 클라이언트(js/play/grader.js)가 **같은 코드**를 돈다.
   규칙: DOM·S·P·window 를 만지지 않는다. 입력은 카드(정답이 든 정본)·학생 입력·카드 상태의 일부이고,
   출력은 점수·코멘트·부를 분기 키·셈 증분(counts)·상태 표시(flags)·역량 증거(ev)다. 부작용(runBranch·record·toast)은 부르는 쪽이 한다.
   전역 D 는 「지금 화의 이야기 데이터」다(서버는 요청마다 D 를 그 화로 바꿔 끼운다). tools/build_secure.mjs 가 이 파일을 번들에 넣는다(js/ncs.js 레지스트리와 함께).
   ====================================================================== */
function hasCompose(c){ return !!(c.compose||c.replyCheck); }
function isTextCard(c){ return c.type==='email'||c.type==='msg'||c.type==='comment'; }
function flowOf(c){ const m=c.mode; const steps=[];
  if(c.followup) return ['confirm'];
  if(m==='phone') return ['phone'];
  if(m==='visit') return ['visit'];
  if(m==='reflect') return ['pick'];
  if(m==='sheet'||c.type==='sheet'||(!c.compose&&Array.isArray(c.workAnswers)&&c.workAnswers.length)){ steps.push('work'); if(c.deliver) steps.push('deliver'); return steps; }
  if(m==='approval'||c.type==='approval') return ['approval'];
  if(m==='report'||c.type==='report'){ steps.push('report'); if(c.alsoReply||hasCompose(c)) steps.push('reply'); return steps; }
  if(c.deliver&&typeof c.deliver==='object'){ steps.push('deliver'); if(c.alsoReply||hasCompose(c)) steps.push('reply'); return steps; }
  if(m==='ask'){ return ['ask','reply']; }
  steps.push('reply'); if(typeof c.alsoReply==='object'||(c.alsoReply===true&&!c.deliver)) steps.push('reply2'); return steps; }
/* 질문 카드 — 맞는 질문 번호 · 답 3개 · 질문별 상한 */
function rightQ(c){ if(c.rightQ!=null) return c.rightQ; if(c.gotValues&&c.gotValues.length){ let bi=0; c.gotValues.forEach((v,i)=>{ if(v>c.gotValues[bi]) bi=i; }); return bi; } const br=(D.branches&&D.branches[c.id])||{}; if(br.q1&&!br.q2&&!br.q3) return 1; return 0; }
function askAnswers(c){ if(c.answers&&c.answers.length) return c.answers; const r=rightQ(c); const br=(D.branches&&D.branches[c.id])||{}; return (c.question||[]).map((q,i)=>{ if(i===r) return c.answer||'…'; const b=br['q'+(i+1)]; if(b&&b.now&&b.now.text) return b.now.text; return '그건 제가 답할 게 아닌데요. 다른 걸 물으신 거 아니에요?'; }); }
function askCap(c,i){ const r=rightQ(c); if(i===r) return 100; if(c.gotValues){ const v=c.gotValues[i]||0, mx=Math.max.apply(null,c.gotValues)||1; return v<=0?40:Math.max(40,Math.round(100*v/mx)); } const b=(D.branches&&D.branches[c.id]||{})['q'+(i+1)]; if(b&&b.today){ const m=b.today.match(/(\d{2,3})/); if(m) return +m[1]; } return i===r?100:(i<r?60:40); }
/* 메일·메신저로 온 보고 카드의 「메일로 상신」 분기 */
function mailConfirmBranch(c){ return (c&&c.mode==='report'&&c.type!=='report'&&((D.branches||{})[c.id]||{}).mailConfirm)||null; }
/* 분기 존재 여부 — runBranch 와 같은 규칙(forbid:… 가 없으면 forbid 로) · 목록에서 처음 있는 것 */
function branchExists(c,key){ if(!key) return false; const all=(D.branches||{})[c.id]||{}; if(all[key]) return true; return !!(key.startsWith('forbid:')&&all.forbid); }
function firstBranch(c,keys){ for(const k of keys) if(branchExists(c,k)) return k; return null; }
const bestComment=(c)=>(c.act&&c.best&&c.act[c.best]&&c.act[c.best][1])||'';
const bestRC=(c)=>!!(c.best&&['reject','confirm'].includes(c.best));
/* 작성 안내에 쓰는 개수만 — 정답 없이도 「반드시 들어갈 값 N가지」를 적을 수 있게(공개본은 composeMeta 로 온다) */
function specMeta(c,which){ const m=c.composeMeta; if(m&&!hasFullData(c)) return (which==='second'?m.second:m.first)||{must:0,rules:false};
  const sp=composeSpec(c,which); return {must:sp.mustInclude.length,rules:sp.ruleFacts.length>0}; }
function hasFullData(c){ return !(D&&D.stripped); }
/* act 표 점수 — 없는 키는 null */
const actScore=(c,k)=>(c&&c.act&&Array.isArray(c.act[k])&&typeof c.act[k][0]==='number')?c.act[k][0]:null;
/* D11 — 거절은 처리 방식이 아니라 회신의 내용이다: 거절이 정답인 카드에서 흐름 안의 첫 글(회신)은 key=reject 로 채점한다(서버가 정한다 — 57차 E1 B5).
   회신 단계가 없는 전달 흐름(qc_ep5_cert1·ga_ep5_badge1)에 쓴 글은 흐름 밖 「회신」 그대로(E2후속 C10) */
function textKey(c,key,which){ if(which==='reply2') return 'reply'; if((key==null||key==='reply')&&c&&c.best==='reject'&&flowOf(c).includes('reply')) return 'reject'; return key||'reply'; }
/* 수락 판정을 할 글인가(C16 · 10팀 2차 ①) — 받아들이면 안 되는 글: 거절이 정답인 회신형 카드(best=reject · 흐름에 reply)의 회신 ·
   첫 글이 상신인 두 글 카드(best=confirm · alsoReply)의 둘째 글(요청자 안내 — 팀장 판단 전에 요청을 들어주겠다고 약속하면 안 된다) ·
   7화 거절 아침 카드(pre7 이 같은 판정).
   57차 E1 후속(edu 3차): 둘째 글에서 요청자가 정당한 것을 청한 카드(edu ghost 「요청하신 대로 사유서는 오늘 드리겠습니다」 · print 「발주서 발행 뒤
   그대로 진행해 주세요」)는 수락 표현이 곧 잘못이 아니다 — 카드 데이터로 끈다. 기본을 끄면 20장 중 19장이 둘째 글 끝에 붙인
   「요청하신 대로 그대로 진행해 드리겠습니다」를 100 으로 받는다(카드별 금지 표현은 그 카드의 말꼴만 막는다) — 그래서 기본은 켜 두고 카드 단위 스위치를 둔다.
   데이터 스위치(공개본에서는 빠지는 compose·replyCheck·alsoReply 안): compose.acceptCheck(없으면 replyCheck.acceptCheck) = false|true → 첫 글 끔|켬 ·
   alsoReply.acceptCheck = false|true → 둘째 글 끔|켬 */
function acceptSwitch(o){ return (o&&typeof o==='object'&&typeof o.acceptCheck==='boolean')?o.acceptCheck:null; }
function acceptWrong(c,which){ if(!c) return false;
  if(which==='reply2'){ const sw=acceptSwitch(c.alsoReply); if(sw!=null) return sw; return c.best==='confirm'&&typeof c.alsoReply==='object'; }
  const sw=acceptSwitch(c.compose)!=null?acceptSwitch(c.compose):acceptSwitch(c.replyCheck); if(sw!=null) return sw;
  return c.best==='reject'&&flowOf(c).includes('reply'); }

/* ======================================================================
   ▼ 57차 E1 — NCS 역량 증거(Ev) · spec §2(항목 표·경로 규칙 D12·가중·1일차 계수) · §3-5 · docs/ncs57/E1-api.md
   카드 매핑 c.ncs2.items 의 항목 하나를 0~3 으로 판정해 {i, el, s, m, cx, wv, ov, x?, tip?} 로 낸다(ov = 레지스트리 짧은 이름).
   · 레지스트리(NCS — js/ncs.js)가 없으면 증거를 내지 않는다(카드 점수는 그대로).
   · NCS 증거는 AI 첨삭이 켜져도 규칙 판정이다(D6) — 글 짜임(form)도 규칙 요소 + 문장성 게이트.
   · 브라우저가 직접 판정하는 항목(전달·질문 상대 route · 끝까지 follow · 하루 집계 ontime·own)도 Ev.item 으로 같은 모양을 만든다.
   ====================================================================== */
const Ev=(function(){
  const R=()=>(typeof NCS!=='undefined'&&NCS&&NCS.ov)?NCS:null;
  const on=()=>!!R();
  const items=(c)=>(c&&c.ncs2&&Array.isArray(c.ncs2.items))?c.ncs2.items:[];
  const epNo=()=>(typeof D!=='undefined'&&D&&+D.ep)||1;
  /* 난이도 — 항목 cx → 카드 cx → 화(1~2화 1 · 3~5화 2 · 6~7화 3). 70화 채점 카드는 전부 카드 cx 가 있다(없는 24장은 기록형 note) */
  function cxOf(c,it,ep){ const v=(it&&it.cx!=null)?it.cx:(c&&c.ncs2&&c.ncs2.cx!=null)?c.ncs2.cx:(ep<=2?1:ep<=5?2:3); return Math.max(1,Math.min(3,Math.round(+v)||1)); }
  function defect(ov,c){ const N=R(); let v=1; for(const d of Object.values(N.defects||{})){ if(!(d.ov||[]).includes(ov)) continue; if(d.when==='msg'&&!(c&&c.type==='msg')) continue; v=Math.min(v,+d.v); } return v; }
  /* 실효 가중 = w(항목 → 표) × v(항목 타당도) × 전역 결함 계수 × 1일차 0.5 — tools/ncs_coverage.mjs 와 같은 식 */
  function wvOf(c,it,ep){ const N=R(); const O=N.ov[it.ov]||{}; const w=it.w!=null?+it.w:+(O.w||0); const v=it.v!=null?+it.v:1; return Math.round(w*v*defect(it.ov,c)*(ep===1?+N.day1:1)*1000)/1000; }
  function mOf(it){ const N=R(); return it.m||((N.ov[it.ov]||{}).m)||'p'; }
  function tipOf(it){ const N=R(); return it.ind||((N.ov[it.ov]||{}).tip)||''; }
  /* 항목 하나의 증거. opt.x = D12 「하지 않음」의 0 · opt.ep = 몇 일차(기본 지금 화) */
  function item(c,it,s,opt){ opt=opt||{}; const N=R(); if(!N||!it||!N.ov[it.ov]) return null; const ep=opt.ep||epNo();
    const e={i:it.id,el:it.el,s:+s,m:mOf(it),cx:cxOf(c,it,ep),wv:wvOf(c,it,ep),ov:(N.ovCode&&N.ovCode[it.ov])||it.ov}; if(opt.x){ e.s=0; e.x=1; }
    if(e.s<=1){ const t=tipOf(it); if(t) e.tip=t; } return e; }
  /* 띠: 비율 → s */
  function band(r,kind){ const N=R(); const B=(N&&N.bands&&N.bands[kind||'ratio'])||[[1,3],[2/3,2],[1/3,1]]; for(const [lo,s] of B) if(r>=lo-1e-9) return s; return 0; }
  function ratioS(ok,all){ if(!all) return null; if(all===1) return ok>=1?3:0; return band(ok/all,'ratio'); }
  /* 선택지 → 등급(§2-5): 정답(best)은 3 · 그 밖은 점수 띠(≥90 3 · 50~89 2 · 25~49 1 · 0~24 0) · 항목 grade:{키:s} 가 덮어쓴다 */
  function gradeS(score,isBest,key,it){ if(it&&it.grade&&key!=null&&it.grade[key]!=null) return +it.grade[key]; if(isBest) return 3; return band(+score||0,'pick'); }
  /* 주 항목 — 카드 items[0] · 둘째 글(reply2)은 which:'reply2' 인 첫 항목 */
  function main(c,which){ const L=items(c); if(which==='reply2') return L.find(it=>it.which==='reply2')||null; return L[0]||null; }
  /* 목록 합치기(같은 항목 id 는 뒤가 이긴다) */
  function merge(a,b){ const m={}; for(const e of (a||[]).concat(b||[])) if(e&&e.i) m[e.i]=e; return Object.values(m); }
  /* ── 문장성 게이트(§2-2 form · co-work-sim _sentenceQuality 의 발상만) ──
     조사·종결 어미가 있는 문장이 2개 이상(메신저 1개)이고, 어절 절반 이상이 채점 낱말(필수 값·mustAny·replyCheck 낱말) 자체가 아니어야 한다 — 낱말 나열에 속지 않게 */
  /* 종결 어미(존댓말·반말·명사형) — 동기에게 쓰는 반말 메신저(「보낼게」·「맞아」·「비워 줘」)도 문장이다 */
  const END=/(다|요|까|죠|네|오|세|라|자|음|함|임|됨|어|아|야|게|지|해|줘|져|래|걸|든|니|냐|군|나|데)$/;
  const tailOf=(p)=>{ let x=p; for(let i=0;i<3;i++) x=x.replace(/\s*\([^()]*\)\s*$/,'').replace(/[^가-힣A-Za-z0-9)]+$/,''); return x; };
  function sentenceOk(text,spec,isMsg){ const t=String(text||''); const parts=t.split(/[.!?。…](?!\d)|\n+/).map(x=>x.trim()).filter(Boolean);
    const sent=parts.filter(p=>p.split(/\s+/).filter(Boolean).length>=2&&/[가-힣]/.test(p)&&END.test(tailOf(p))).length;
    if(sent<(isMsg?1:2)) return false;
    const words=[]; const addW=(v)=>{ for(const w of String(v||'').split(/\s+/)) if(w&&w.length>=2) words.push(w); };
    for(const v of (spec.mustInclude||[])) addW(v); for(const arr of Object.values(spec.mustAlt||{})) for(const v of (arr||[])) addW(v); for(const v of (spec.mustAny||[])) addW(v);
    if(spec.replyCheck&&Array.isArray(spec.replyCheck.need)) for(const g of spec.replyCheck.need) for(const v of g) addW(v);
    const toks=t.split(/\s+/).map(x=>x.replace(/^[^가-힣A-Za-z0-9]+|[^가-힣A-Za-z0-9%]+$/g,'')).filter(Boolean); if(!toks.length) return false;
    const scoring=toks.filter(tk=>words.some(w=>tk===w||(tk.startsWith(w)&&tk.length-w.length<=2))).length;
    return scoring*2<=toks.length; }
  /* ── 글 한 편의 항목(need·form·cite·ban·cc·calc·key) — Score.text·pre7·offFlow 가 부른다 ──
     o = {c, text, spec, which('reply'|'reply2'), key(그 글의 처리 키), rule(gradeText 결과 — AI 전 규칙 요소), ans(결과값 칸 값|null), work(checkWork 결과|null), tries(결과값 앞선 오답 수),
          st:{ask}, off(D12 — 정답이 아닌 처리로 끝냄), ccOk(참조 넣음), onlyForm(흐름 밖 상신 — 글 짜임만)} */
  function text(o){ if(!on()) return null; const c=o.c, t=String(o.text||''), spec=o.spec, isSecond=o.which==='reply2', out=[];
    const L=items(c).filter(it=>(it.which==='reply2')===isSecond);
    const isMsg=c.type==='msg'||spec.msg; const flow=flowOf(c); const unlocked=((typeof D!=='undefined'&&D&&D.unlock)||[]).includes('rulebook');
    const askSkip=!isSecond&&c.mode==='ask'&&!(o.st&&o.st.ask);
    for(const it of L){ let s=null;
      switch(it.ov){
        case 'need': { if(askSkip&&String(it.el).startsWith('1-2.1')) break;   /* 묻지 않고 답함 — 들은 값은 미관찰(§2-6) */
          const T=needTargets(spec,it); if(!T.length) break; const ok=T.filter(x=>needOk(x,t,spec)).length; s=ratioS(ok,T.length); break; }
        case 'form': { const K=isMsg?['확인','다음 행동']:['인사','확인','다음 행동','맺음']; const els=(o.rule&&o.rule.els)||{}; const ok=K.filter(k=>els[k]).length; s=band(ok/K.length,'form'); if(s>1&&!sentenceOk(t,spec,isMsg)) s=1; break; }
        case 'cite': { if(!unlocked) break; const s0=citeS(spec,t); if(s0!=null) s=s0; break; }
        case 'ban': { if(t.replace(/\s/g,'').length<=8) break; const fb=(it.of&&it.of.length)?it.of:(spec.forbid||[]); if(!fb.length) break; s=fb.some(k=>k&&forbidHit(t,k,strictOf(spec,k)))?0:3; break; }
        case 'cc': { if(isSecond||!(c.ccTeams&&c.ccTeams.length)) break; s=o.ccOk?3:0; break; }
        case 'calc': { if(isSecond||o.ans==null||!c.workAnswer||!o.work) break; s=o.work.ok?(o.tries>0?2:3):0; break; }
        case 'key': { if(isSecond) break; const k=o.key||'reply'; s=gradeS(o.keyScore!=null?o.keyScore:actScore(c,k),k===c.best&&o.keyScore==null,k,it); break; }
        case 'askopen': case 'askq': case 'route': { if(askSkip&&flow.includes('ask')) s=0; break; }   /* 앞 단계(질문)를 건너뜀 — 그 단계 항목 0(§2-6) */
      }
      if(s!=null){ const e=item(c,it,s); if(e) out.push(e); } }
    if(o.off||o.onlyForm) return d12(c,out,isSecond?'reply2':null,{keepForm:true,off:!!o.off});
    return out; }
  /* D12 ①(정답이 아닌 처리로 끝냄): 주 항목 0(!) · key 는 고른 처리대로 · 글을 썼으면 form 만 · 나머지 미관찰 */
  function d12(c,list,which,opt){ opt=opt||{}; const m=main(c,which); const keep=list.filter(e=>{ const it=items(c).find(x=>x.id===e.i); if(!it) return false; return it.ov==='key'||(opt.keepForm&&it.ov==='form'); });
    if(opt.off!==false&&m&&m.ov!=='key'&&!(opt.have||[]).includes(m.id)){ const z=item(c,m,0,{x:true}); if(z) return merge(keep.filter(e=>e.i!==m.id),[z]); }
    return keep; }
  function needTargets(spec,it){ const rc=(spec.replyCheck&&Array.isArray(spec.replyCheck.need))?spec.replyCheck.need:[]; const T=[];
    if(it.of&&it.of.length){ for(const v of it.of){ if(v==='*any') T.push({k:'*any'}); else if(typeof v==='number') T.push({k:'#'+v,g:rc[v]||[]}); else T.push({k:String(v)}); } return T; }
    for(const v of (spec.mustInclude||[])) if(!RULE_ID1.test(String(v))) T.push({k:String(v)});
    rc.forEach((g,i)=>T.push({k:'#'+i,g})); if((spec.mustAny||[]).length) T.push({k:'*any'}); return T; }
  function needOk(x,t,spec){ if(x.k==='*any') return includesAny(t,spec.mustAny); if(x.g) return x.g.some(k=>k&&t.includes(k)); return hasValue(t,x.k,spec.mustAlt); }
  /* 조항 인용 — 필수 값의 조항 번호 전부 + 관련 조항(ruleFacts) 하나 이상 + 없는 번호 0 → 3 · 기대 조항 하나 이상 → 2 · 다른 실재 조항만 → 1 · 없음 0 */
  function citeS(spec,t){ const mustIds=(spec.mustInclude||[]).filter(x=>RULE_ID1.test(String(x))); const rf=(spec.ruleFacts||[]).filter(x=>RULE_ID1.test(String(x)));
    if(!mustIds.length&&!rf.length) return null; const cr=citedRules(t); const got=cr.ids;
    const any=mustIds.concat(rf).some(x=>got.includes(x));
    if(any&&mustIds.every(x=>got.includes(x))&&(!rf.length||rf.some(x=>got.includes(x)))&&!cr.unknown.length) return 3;
    if(any) return 2; if(got.some(x=>!cr.unknown.includes(x))) return 1; return 0; }
  /* 선택형 항목(pick·key·askq) 한 번에 */
  function picks(c,ovs,s,opt){ const out=[]; for(const it of items(c)) if(ovs.includes(it.ov)){ const e=item(c,it,typeof s==='function'?s(it):s,opt); if(e) out.push(e); } return out; }
  /* ── 문자열(저장 형식 id:el:s:m:cx:wv:ov — E1-api §2-3) ── */
  const num=(v)=>{ const r=Math.round((+v||0)*1000)/1000; const s=String(r); return s.startsWith('0.')?s.slice(1):s; };
  function str(list){ return (list||[]).filter(Boolean).map(e=>[e.i,e.el,num(e.s)+(e.x?'!':''),e.m,e.cx,num(e.wv),e.ov||''].join(':')).join('|'); }
  function parse(s){ const out=[]; for(const p of String(s||'').split('|')){ if(!p) continue; const a=p.split(':'); if(a.length<6) continue; const x=/!$/.test(a[2]); out.push({i:a[0],el:a[1],s:parseFloat(a[2]),x:x?1:0,m:a[3],cx:+a[4]||1,wv:parseFloat(a[5])||0,ov:a[6]||''}); } return out; }
  return {on,items,item,band,ratioS,gradeS,main,merge,text,d12,picks,str,parse,citeS,sentenceOk,cxOf,wvOf};
})();
/* 결과에 증거를 붙인다(없으면 붙이지 않음 — 레지스트리가 없는 옛 번들 대비) */
function withEv(out,ev){ if(Ev.on()&&Array.isArray(ev)){ out.evv=1; out.ev=ev.filter(Boolean); } return out; }

/* ======================================================================
   ▼ 57차 E1 후속 — 채점 결과 서명(B2 · docs/ncs57/E1-api.md §5) 공용부. HMAC 은 서버(ws7_secure.gs)에만 있다 — 여기는 서명할 글과 규칙만.
   카드 한 장의 「봉인 상태」 = 서버가 낸 단계 점수(s) + 서버가 낸 증거(m — route·follow 를 뺀 항목을 id 순으로). 서버는 채점할 때마다
   앞 봉인(s·m·서명 g)을 확인하고 새 결과를 합쳐 다시 서명한다. 저장 때(ws7SaveCheck) 카드 기록의 ev·ss·sg 로 같은 글을 다시 만들어 대조한다.
   · 브라우저가 판정하는 항목(전달·질문 상대 route · 끝까지 follow · 하루 ontime·own)은 봉인 밖이다 — 서버가 볼 수 없는 행동이다(공개본 매핑으로 브라우저가 매긴다).
   · 단계 코드: r 회신 · 2 둘째 글 · a 결재 · w 검산 · p 대면 보고 · d 검산 가져가기 · x 한 번에 끝(선택·흐름 밖·7화 아침 카드) · 값 u = 무채점
   ====================================================================== */
const Seal=(function(){
  const BROWSER={r:1,l:1};
  const STEP={reply:'r',reply2:'2',approval:'a',work:'w',report:'p',deliver:'d'};
  const byId=(a,b)=>a.i<b.i?-1:a.i>b.i?1:0;
  function canonList(list){ return Ev.str((list||[]).filter(e=>e&&e.i&&!BROWSER[e.ov]).slice().sort(byId)); }
  function canon(ev){ return canonList(Ev.parse(ev)); }
  function merge(m,list){ return canonList(Ev.merge(Ev.parse(m),(list||[]).filter(e=>e&&e.i&&!BROWSER[e.ov]))); }
  function steps(s){ const o={}; for(const p of String(s||'').split(',')){ if(p.length<2) continue; const k=p[0], v=p.slice(1); if(v==='u') o[k]='u'; else if(isFinite(+v)) o[k]=+v; } return o; }
  function stepsStr(o){ return Object.keys(o||{}).sort().map(k=>k+(o[k]==='u'?'u':Math.round(+o[k]||0))).join(','); }
  /* 채점 한 번이 카드 점수에 보태는 단계 — 서버가 결과로 정한다(브라우저 finalize·record 가 쓰는 값과 같다). 재시도·질문은 단계 없음 */
  function step(kind,input,res,workFinal){ if(!res||res.retry) return null; input=input||{};
    if(kind==='text') return [input.which==='reply2'?'2':'r',res.unscored?'u':res.score];
    if(kind==='approval'||kind==='approve') return typeof res.score==='number'?['a',res.score]:null;
    if(kind==='report') return ['p',res.score];
    if(kind==='sheetDeliver') return ['d',res.score];
    if(kind==='work'){ if(res.ok) return ['w',100]; if(res.trap) return ['w',20]; return workFinal?['w',0]:null; }
    if(kind==='pick') return ['x',res.ok?100:60];
    if(kind==='act') return ['x',typeof res.score==='number'?res.score:30];   /* 방문 응대에 없는 키 → 화면이 30 으로 적는다(cards.js) */
    if(kind==='offFlow'||kind==='pre7') return typeof res.score==='number'?['x',res.score]:null;
    if(kind==='mailConfirm') return (res.mode!=='line'&&typeof res.score==='number')?['x',res.score]:null;
    return null; }
  /* 봉인된 단계로 낼 수 있는 카드 점수의 상한 — 한 번에 끝(x)이면 그 점수. 아니면 필요한 단계(flowOf − 질문)의 평균:
     봉인된 단계는 그 점수 · 브라우저 판정 단계(전달 — 봉인 d 가 없을 때)는 100 · 안 한 단계는 0 · 무채점(u)은 빼고 센다.
     정직한 finalize(한 단계들 평균 · 건너뛴 전달 뺌)와 partialEnd(안 한 단계 0)는 늘 이 값 이하다 */
  function bound(c,S){ S=S||{}; if(typeof S.x==='number') return S.x;
    const req=flowOf(c).filter(k=>k!=='ask'); let sum=0,n=0;
    for(const k of req){ const code=STEP[k]; const v=code!=null?S[code]:undefined; if(v==='u') continue; n++;
      if(typeof v==='number') sum+=v; else if(k==='deliver') sum+=100; }
    return n?Math.round(sum/n):100; }
  /* 서명하는 글(형식 1) — 카드 · 6화 분류 · 7화 최종 */
  function cardMsg(code,ep,id,s,m){ return ['c1',code,+ep,id,s||'',m||''].join('|'); }
  function triageMsg(code,ep,hit,total,score,m){ return ['t1',code,+ep,+hit||0,+total||0,+score||0,m||''].join('|'); }
  function rubricStr(r){ return Object.keys(r||{}).sort().map(k=>k+':'+r[k]).join(','); }
  function ep7Msg(code,ending,total,rubric,m){ return ['e1',code,7,ending||'',+total||0,rubricStr(rubric),m||''].join('|'); }
  return {BROWSER,STEP,canon,canonList,merge,steps,stepsStr,step,bound,cardMsg,triageMsg,ep7Msg};
})();
/* 흐름 밖 상신 글(요청자 규격이 아니라 팀장·결재자 앞 보고)의 꼴 — 규칙 5요소 가운데 「답」만 「내용이 있나(30자 이상)」로 본다.
   빠진 값·금지 표현 표시는 싣지 않는다(요청자가 받지 않은 글). AI 첨삭이 준 요소가 있으면 그것을 쓴다 — 57차 E1(B5·E2f §8-1): cards.js upForm 을 서버로 */
function upForm(r,text){ const els=Object.assign({},(r&&r.detail&&r.detail.els)||(r&&r.els)||{}); els['답']=String(text||'').replace(/\s/g,'').length>=30;
  return {score:Object.values(els).filter(Boolean).length*20,detail:{els,missing:[],forbid:[],partial:false,cited:r&&r.detail?r.detail.cited:(r?r.cited:null)}}; }
/* 흐름을 건너뛴 끝내기의 점수 상한 — 57차 E1(10팀 2차 ⑤ · D12): 「최선보다 낮은 것 중 최고」가 60 까지 나왔다(plandue1).
   정답 처리의 절반을 넘지 않는다 — 하루 끝에 한 단계만 한 카드(전달만·보고만·첫 글만 = 단계 평균, 빠진 단계 0)와 같은 뜻 */
const OFFFLOW_CAP=50;
/* 흐름 밖 글의 금지 표현(57차 E1 후속 2 · done-cs 16) — 상한(cap: 고른 처리의 act 점수)에서 금지 하나마다 −20.
   분기 표가 그 금지 분기에 점수를 적어 두었으면(today 맨 앞 수 — 「replyBan → 10」·「30. …」·「20 · …」) 그 점수도 넘지 않는다(메일로 상신·질문 상한과 같은 today 읽기 ·
   「09:26 …」 시각·「③ 30」 같은 칸 번호는 점수가 아니다). 흐름 밖 상한(50) 안이다 */
function todayScore(b){ const m=String((b&&b.today)||'').match(/^\s*(?:[A-Za-z]+\s*→\s*)?(\d{1,3})\s*점?(?=\s*(?:[.,·(]|$|\s))/); return m?Math.min(100,+m[1]):null; }
function offForbid(c,cap,fb){ let s=cap-20*fb.length; const all=((D&&D.branches)||{})[c.id]||{}; const k=firstBranch(c,['forbid:'+fb[0],'forbid']); const t=k?todayScore(all[k]||(k.startsWith('forbid:')?all.forbid:null)):null; if(t!=null) s=Math.min(s,t); return Math.max(0,s); }

const Score={};
/* 단추 행동 · 전화 · 방문 — act 표에서 점수·코멘트. after 는 전화를 끊은 뒤 한마디(분기 after > 정답이 아닐 때 카드 after)
   57차 E1: 증거 — 전화·방문은 pick(등급) · 그 밖 단추는 key(등급), 정답이 아니면 D12 ①(주 항목 0!). key:'timeout'(전화·방문 무응답)은 act 에 없어도 받는다(pick 0) */
Score.act=(c,inp)=>{ const key=inp.key; const flow=flowOf(c); const choice=flow[0]==='phone'||flow[0]==='visit';
  if(key==='timeout'){ return withEv({ok:true,key,score:10,comment:'',isBest:false,bestRC:bestRC(c),bestComment:bestComment(c),branch:'timeout',after:null},choice?Ev.picks(c,['pick'],0):Ev.d12(c,[],null)); }
  const a=c.act&&c.act[key]; if(!a) return {ok:false,key};
  const isBest=key===c.best; const all=(D.branches||{})[c.id]||{}; const br=all[key]||(isBest?all.ok:null);
  const out={ok:true,key,score:a[0],comment:a[1]||'',isBest,bestRC:bestRC(c),bestComment:bestComment(c),branch:isBest?'ok':key,after:(br&&br.after)||(!isBest&&c.after)||null};
  if(choice) return withEv(out,Ev.picks(c,['pick'],(it)=>Ev.gradeS(a[0],isBest,key,it)));
  const ev=Ev.picks(c,['key'],(it)=>Ev.gradeS(a[0],isBest,key,it)); return withEv(out,isBest?ev:Ev.d12(c,ev,null)); };
/* 팀장 대면 보고의 선택 */
Score.report=(c,inp)=>{ const key=inp.key; const rp=c.report||c; const score=(rp.score&&rp.score[key])!=null?rp.score[key]:(key===c.best?100:30); const isBest=(key===c.best)||(score>=100);
  return withEv({key,score,isBest,bestRC:bestRC(c),bestComment:bestComment(c)},Ev.picks(c,['pick'],(it)=>Ev.gradeS(score,isBest,key,it))); };
/* 검산 결과를 팀장에게 가져갔을 때의 선택 */
Score.sheetDeliver=(c,inp)=>{ const key=inp.key; const d=c.deliver||{}; const bestK=Object.entries(d.score||{}).sort((a,b)=>b[1]-a[1])[0]; const score=(d.score&&d.score[key])!=null?d.score[key]:30;
  const isBest=!!(bestK&&key===bestK[0]); return withEv({key,score,isBest,bestKey:bestK?bestK[0]:null,bestComment:bestComment(c)},Ev.picks(c,['pick'],(it)=>Ev.gradeS(score,isBest,key,it))); };
/* 계산값·표 답 대조 — 틀린 값(함정 아님)은 다시 셀 수 있으니 정답 코멘트를 싣지 않는다(57차 R3 — 검산 카드 13장 중 8장은 코멘트에 정답 값이 있다).
   맞았거나 함정이면(검산이 끝남) 그대로 준다. 틀린 칸 이름(wrong)은 「아직 맞지 않은 칸」 안내라 남긴다.
   57차 E1: 증거(work)는 끝났을 때만(맞음·함정·세 번째 오답) — inp.st.workTries = 앞선 오답 수(배포본은 서버가 센 값 — E3-6).
   s = 첫 제출 전부 맞음 3 · 둘째 2 · 셋째 1 · 끝내 틀림: 그 항목의 칸이 일부 맞으면 1, 아니면 0 · 함정 0(항목 of = 칸 key) */
Score.work=(c,inp)=>{ const w=checkWork(c,inp.ans); const tries=Math.max(0,Math.floor(+((inp.st&&inp.st.workTries)||0))); const fin=w.ok||w.trap||tries>=2;
  const out={ok:w.ok,trap:!!w.trap,wrong:w.wrong||[],bestComment:(w.ok||w.trap)?bestComment(c):''};
  if(!fin) return out;
  const cells=workCells(c); const okKeys=new Set(w.okKeys||[]);
  return withEv(out,Ev.picks(c,['work'],(it)=>{ const ks=(it.of&&it.of.length)?it.of:(cells?cells.map(x=>x.key):null);
    if(!ks){ return w.ok?(tries===0?3:tries===1?2:1):0; }
    const n=ks.filter(k=>okKeys.has(k)).length; if(n===ks.length) return tries===0?3:tries===1?2:1; if(w.trap) return 0; return n>0?1:0; })); };
/* 반성 카드 — 고른 카드가 답 후보에 있나 */
Score.pick=(c,inp)=>{ const ok=(c.answerAny||[]).includes(inp.pick); return withEv({ok,comment:ok?(c.act&&c.act.reply&&c.act.reply[1])||'':(c.fallback||'')},Ev.picks(c,['pick'],(it)=>Ev.gradeS(ok?100:60,ok,ok?'ok':'fallback',it))); };
/* 질문 카드 — 맞는 사람 앞에서 고를 질문 3개의 답(내용) · 고른 질문의 상한 */
Score.askAnswers=(c)=>({answers:askAnswers(c)});
Score.ask=(c,inp)=>{ const cap=askCap(c,inp.choice); return withEv({choice:inp.choice,cap,answer:askAnswers(c)[inp.choice]||''},Ev.picks(c,['askq'],Ev.band(cap,'askq'))); };
/* ---------- 직접 묻기(askOpen · docs/plan-interaction-design.md §3-A) ----------
   준비된 질문 3개 대신 학생이 **한 줄로 직접 묻는다.** 담당자는 질문이 건드린 조각(facts[].topic)만 답하고,
   못 알아들으면 되묻는다(unknown). 끝났을 때의 상한(cap)은 옛 askCap 과 같은 자리 — 회신 점수의 상한.
   대조는 공백·문장부호를 지운 부분 문자열이다(「입구가 어디예요」→ 입구·어디). AI 를 쓰지 않는다 — 주제가 좁아 규칙으로 충분하고, 오탐은 되묻기로 회복된다. */
function askOpenSpec(c){ const a=c.askOpen; if(!a||!Array.isArray(a.facts)||!a.facts.length) return null;
  const facts=a.facts.filter(f=>f&&f.key&&Array.isArray(f.topic)&&f.topic.length&&f.say);
  const keys=facts.map(f=>f.key); const need=(Array.isArray(a.need)&&a.need.length?a.need:keys).filter(k=>keys.includes(k));
  return {facts,need,tries:Math.max(1,+a.tries||3),unknown:[].concat(a.unknown||['음, 뭘 물으시는 거예요?','좀 더 구체적으로 물어봐 주세요.']),nudge:a.nudge||'',greet:a.greet||'네, 말씀하세요.',model:a.model||''}; }
const askOpenNorm=(s)=>String(s==null?'':s).toLowerCase().replace(/[\s.,!?…~"'「」()\-·]/g,'');
/* 한 질문 — inp {text, got:[이미 얻은 키], n:이번이 몇 번째 질문(1부터)}. 돌려주는 것: hits(이번에 새로 건드린 키) · say(담당자 대사) · got(누적) · done · cap
   57차 E1(C2): 상한은 **필요한 조각(need)** 을 몇 개 얻었나로 — 예전에는 need 밖 조각까지 세어 엉뚱한 조각 하나로 100 이 됐다(by17) */
Score.askOpen=(c,inp)=>{ const sp=askOpenSpec(c); if(!sp) return {ok:false};
  const q=askOpenNorm(inp.text); const got=uniq([].concat(inp.got||[])); const n=Math.max(1,+inp.n||1);
  const hitAll=q?sp.facts.filter(f=>f.topic.some(t=>{ const k=askOpenNorm(t); return k&&q.includes(k); })).map(f=>f.key):[];
  const hits=hitAll.filter(k=>!got.includes(k)); const after=uniq(got.concat(hits));
  const left=sp.need.filter(k=>!after.includes(k)); const done=left.length===0||n>=sp.tries;
  let say='';
  if(hitAll.length){ say=sp.facts.filter(f=>hitAll.includes(f.key)).map(f=>f.say).join(' '); if(hits.length===0) say=(sp.repeat||'아까 말씀드린 대로예요. ')+say; }
  else { const miss=Math.max(0,n-1-got.length); say=sp.unknown[Math.min(miss,sp.unknown.length-1)]||sp.unknown[0]; if(sp.nudge&&n>=2) say+=' '+sp.nudge; }
  const gotNeed=sp.need.filter(k=>after.includes(k)).length; const cap=gotNeed>=sp.need.length?100:gotNeed?60:40;
  return {ok:true,hits,hitAll,say,got:after,left,done,cap,n,tries:sp.tries,need:sp.need.length}; };
/* 자동 플레이용 한 줄 — 조각의 첫 topic 을 이어 붙여 한 번에 전부 묻는다(정본 데이터에서만 만든다) */
Score.askOpenModel=(c)=>{ const sp=askOpenSpec(c); if(!sp) return {q:''}; if(sp.model) return {q:sp.model}; return {q:sp.need.map(k=>(sp.facts.find(f=>f.key===k)||{}).topic[0]).filter(Boolean).join('이랑 ')+' 어떻게 돼요?'}; };
/* 다 물은 뒤 회신에 넘길 답(얻은 조각의 대사만). 57차 E1: inp.final 이면 직접 묻기 증거(askopen — 얻은 조각 비율 띠, 항목 of = 조각 key · 없으면 need) */
Score.askOpenAnswer=(c,inp)=>{ const sp=askOpenSpec(c); if(!sp) return {answer:''}; const got=[].concat(inp.got||[]); const out={answer:sp.facts.filter(f=>got.includes(f.key)).map(f=>f.say).join(' '),greet:sp.greet,tries:sp.tries};
  if(!inp.final) return out;
  return withEv(out,Ev.picks(c,['askopen'],(it)=>{ const ks=(it.of&&it.of.length)?it.of:sp.need; return Ev.ratioS(ks.filter(k=>got.includes(k)).length,ks.length)||0; })); };
/* 메일로 상신 — 분기 표에 점수(today)가 있으면 그 점수로 끝, 점수가 없으면 팀장 한마디만 듣고 대면으로.
   대면으로 돌아가는 경우(line)는 카드가 안 끝났으니 정답 코멘트·정답 행동 표시를 싣지 않는다(57차 R3 — 코멘트가 맞는 보고 선택을 말해 준다)
   57차 E1: 점수로 끝나면 보고 선택 항목(pick)은 그 점수 띠(§2-2 「메일로 상신은 그 점수 띠」) */
Score.mailConfirm=(c)=>{ const br=mailConfirmBranch(c); if(!br){ const a=Score.act(c,{key:'confirm'}); return Object.assign({mode:'act'},a); }
  const m=String(br.today||'').match(/(\d{2,3})/); const out={mode:m?'score':'line',score:m?+m[1]:null,bestRC:m?bestRC(c):false,bestComment:m?bestComment(c):''};
  return m?withEv(out,Ev.picks(c,['pick'],(it)=>Ev.gradeS(+m[1],false,'mailConfirm',it))):out; };
/* 결재 「이상 없음(승인)」 — 57차 E1: 증거 key = 승인의 등급 · 지적 항목(flags) 0(「이상 없음」 승인 0) · 승인이 정답이 아니면 D12 ① */
Score.approve=(c)=>{ const a=(c.act&&(c.act.approve||c.act.reply))||[35,'"확인했습니다"로 넘기면 그 숫자 그대로 나가요.']; const isBest=c.best==='approve';
  const out={score:a[0],comment:a[1]||'',branch:firstBranch(c,['forbid:이상 없음','forbid:확인했습니다','reply','approve']),bestComment:bestComment(c)};
  let ev=Ev.picks(c,['key'],(it)=>Ev.gradeS(a[0],isBest,'approve',it)); if(!isBest) ev=Ev.d12(c,ev,null);
  return withEv(out,Ev.merge(Ev.picks(c,['flags'],0),ev)); };
/* 6화 분류 — 57차 E1(C3 · C11): **모든 카드의 칸 일치 비율**. 예전에는 「지금」 칸 적중만 세어 전부 「지금」에 넣어도 만점이었고,
   09:00 에 온 분기 카드(pre)까지 목록에 들어가 「지금」으로 셌다. 이제 분류 대상은 화 데이터 triage.cards 중 도착한 것뿐이다.
   맞는 칸 = now → 「지금」 · morning → 「오전 중」 · 나머지 → 「오늘 중」. 카드 점수 = 일치 비율 × 100(반올림) — D33 의 예외(분류 점수)
   증거 triage(화 ncs2 의 하루 항목) = 비율 띠 */
function triageSlot(T,id){ return (T.now||[]).includes(id)?'now':(T.morning||[]).includes(id)?'morning':'today'; }
Score.triage=(_,inp)=>{ const T=D.triage||{}; const tc=T.cards||[]; const ids=(inp.ids||[]).filter(i=>tc.includes(i)); const A=inp.assign||{};
  const hit=ids.filter(i=>A[i]===triageSlot(T,i)).length; const total=ids.length; const score=total?Math.round(100*hit/total):0;
  const it=((D.ncs2&&D.ncs2.items)||[]).find(x=>x.ov==='triage'); const ev=it&&total?[Ev.item(null,it,Ev.ratioS(hit,total))]:[];
  return withEv({hit,total,score,slots:ids.map(i=>A[i]===triageSlot(T,i)?1:0)},ev); };
/* 분기 카드 등장 조건 — 전날 기록(P.done[d-1])의 그 카드 결과와 대조. 전날 기록이 없으면 안 온다.
   7일차 아침 카드는 클라이언트(day.js 7화 시작 · ep7grade.js make)와 서버(ws7GradeEp7 → make · 저장된 진행)가 ep7PreCards 하나로 거른다(57차 R1) —
   예전 서버는 걸러지지 않은 카드 전부를 넘겨, 받지도 않은 카드의 위반 후보(violationHint)로 엔딩 C 를 냈다.
   규칙은 day.js triggerMet(2~6일차 prepareDay)과 같다 — tools/ep7_grade_test.mjs 가 두 함수의 답을 데이터의 trigger 전부로 대조한다.
   57차 E1(C6 · 10팀 2차 ④): miss(빠진 필수 값 — 값 하나 또는 목록, "*any" = mustAny) · anyMiss(mustAny 미달)도 본다 — AI 첨삭이 켜져도 기록된다 */
function branchTriggerMet(tr,prev){ if(!tr||!prev) return false; if(tr.anyOf) return tr.anyOf.some(t=>branchTriggerMet(Object.assign({card:tr.card},t),prev)); const pc=prev.cards&&prev.cards[tr.card]; if(!pc) return false;
  if(tr.act!=null&&pc.act!==tr.act) return false; if(tr.choice!=null&&pc.choice!==tr.choice) return false; if(tr.report!=null&&pc.choice!==tr.report) return false;
  if(tr.forbidHit!=null&&!!pc.forbidHit!==!!tr.forbidHit) return false; if(tr.replyBanHit!=null&&!!pc.replyBanHit!==!!tr.replyBanHit) return false; if(tr.delivered!=null&&!!pc.delivered!==!!tr.delivered) return false;
  if(tr.partial!=null&&!!pc.partial!==!!tr.partial) return false;
  if(tr.miss!=null){ const want=[].concat(tr.miss); const got=pc.miss||[]; if(!want.some(v=>got.includes(v))) return false; }
  if(tr.anyMiss!=null&&!!(pc.miss||[]).includes('*any')!==!!tr.anyMiss) return false; return true; }
function ep7PreCards(cards,prog){ const prev=(prog&&prog.done&&prog.done['6'])||null; return (cards||[]).filter(c=>!c.trigger||branchTriggerMet(c.trigger,prev)); }
/* 수락 글의 점수 상한 — act.reply(스스로 받아들임)의 점수. 단 데이터가 회신을 최선과 같은 점수로 뒀거나(rec 10장 — 「거절인지 수락인지는 글 내용으로 본다」)
   회신 칸이 없으면(edu_ep5_extedu3) 그 카드의 가장 낮은 처리 점수(50 이하)로 본다 — 다른 9팀 73장 중 47장이 수락(act.reply)을 가장 낮은 처리 이하로 적었다 */
function acceptCap(c){ const r=actScore(c,'reply'); const top=actScore(c,c.best); if(r!=null&&(top==null||r<top)) return r;
  const below=Object.keys(c.act||{}).filter(k=>k!==c.best&&k!=='reply').map(k=>actScore(c,k)).filter(v=>v!=null&&(top==null||v<top)); return Math.min(below.length?Math.min(...below):OFFFLOW_CAP,OFFFLOW_CAP); }
/* 수락 판정 — 이 글에 수락 표현(엔진 기본 · 부정 인식)이 있나. 있으면 그 표현 */
/* 57차 E1 후속 2 — 조건절(forbidHit ①~④)은 둘째 글(상신 뒤 요청자 안내)에서만 허용한다: 「결재가 나면 요청하신 대로 진행해 드리겠습니다」는 팀장 판단 전에 들어주겠다는 약속이 아니라
   바른 조건부 안내다. 거절이 정답인 카드의 첫 글·7화 거절 아침 카드는 예전처럼 조건이 있어도 수락으로 본다(규정상 받아 줄 수 없는 요청) · alsoReply.forbidStrict:true 면 둘째 글도 */
function acceptHit(c,which,text){ if(!acceptWrong(c,which)) return null; const t=String(text||''); const strict=which!=='reply2'||!!(c.alsoReply&&typeof c.alsoReply==='object'&&c.alsoReply.forbidStrict===true); return ACCEPT_DEFAULT.find(k=>forbidHit(t,k,strict?true:'any'))||null; }
/* 7일차 아침 분기 카드 — 57차 E1(E2f §8-2 · 10팀 2차 ②): 금지 표현이 걸리면 정답 반응(ok) 대신 금지 분기 · 흐름 밖 상신 글은 보고의 꼴(upForm)로 ·
   거절 카드의 수락 글은 act.reply 로(C16) · 증거는 1~6일차 글 카드와 같은 규칙 */
Score.pre7=(c,inp)=>{ let k=inp.key; const text=inp.text; let score, comment, detail=null, forbidHit=false, branch, ev=[]; const choice=c.choices&&Object.keys(c.choices).length;
  /* act 에 없는 기본 키(데이터 누락 대비 · E2-2) — act 최저점 + 공통 코멘트 · 증거 없음(57차 E1 후속: 예전에는 ep7.js 가 키마다 물어 최저점을 골랐다 — 서버 서명이 한 결과에 붙게 한 번에) */
  if(!(c.act&&Object.prototype.hasOwnProperty.call(c.act,k))){ let lo=null; for(const a of Object.values(c.act||{})) if(Array.isArray(a)&&typeof a[0]==='number'&&(lo==null||a[0]<lo)) lo=a[0];
    return {key:k,score:lo!=null?lo:0,comment:'이 건에는 맞지 않는 처리예요.',detail:null,forbidHit:false,branch:'other',synth:1}; }
  if(k==='reply') k=textKey(c,k,'reply');
  if(text!=null){ const spec=composeSpec(c); const g=gradeText(c,text,spec); const acc=acceptHit(c,'reply',text); if(acc){ k='reply'; }
    const up=k==='confirm'&&c.best!=='confirm';
    if(up){ const f=upForm(g,text); score=f.score; detail=f.detail; comment=(c.act[k]&&c.act[k][1])||''; if(c.act[k]) score=Math.min(score,c.act[k][0]); branch=firstBranch(c,[k,'other']);
      ev=Ev.text({c,text,spec,which:'reply',key:k,rule:g,st:{ask:true},onlyForm:true,off:true}); }
    else { score=g.score; comment=(c.act[k]&&c.act[k][1])||''; const fb=g.forbid.slice(); if(acc&&!fb.includes(acc)) fb.push(acc);
      if(fb.length){ score=Math.min(score,20); comment=(acc?`받아들이면 안 되는 건이에요(「${acc}」). `:'금지 표현: '+fb.join(', ')+'. ')+comment; forbidHit=true; }
      if(acc) score=Math.min(score,acceptCap(c)); else if(k!==c.best&&c.act[k]) score=Math.min(score,c.act[k][0]);
      detail={els:g.els,missing:g.missing,forbid:fb};
      branch=forbidHit?(firstBranch(c,acc?['reply','forbid','other']:['forbid:'+fb[0],'forbid','other'])):(k===c.best?'ok':k);
      ev=Ev.text({c,text,spec,which:'reply',key:k,rule:g,st:{ask:true},off:k!==c.best||!!acc,keyScore:acc?acceptCap(c):null}); } }
  else { score=c.act[k][0]; comment=c.act[k][1]; branch=k===c.best?'ok':k;
    ev=choice?Ev.picks(c,['pick'],(it)=>Ev.gradeS(score,k===c.best,k,it)):Ev.picks(c,['key'],(it)=>Ev.gradeS(score,k===c.best,k,it)); if(!choice&&k!==c.best) ev=Ev.d12(c,ev,null); }
  return withEv({key:k,score,comment,detail,forbidHit,branch},ev); };

/* 재시도 응답(57차 R3) — 결과값을 처음 틀렸을 때는 「다시 확인하라」만 돌려준다. 모범 답안(model)·규칙 채점 결과(rule — 빠진 필수 값 missing)·
   정답 코멘트(bestComment)·정답 행동 표시(bestRC)·요소 판정(detail)은 싣지 않는다 — 일부러 틀린 값을 넣어 정답을 받아 가지 못하게.
   남기는 것은 작성기로 돌려보내는 데 쓰는 셈(counts)·상태 표시(flags: 몇 번째 시도인지)뿐. 재시도가 끝난 최종 결과는 그대로다. 역량 증거(ev)도 싣지 않는다 */
const retryResult=(o)=>({which:o.which,key:o.key,score:0,comment:'',source:'규칙 채점',feedback:'',detail:null,branches:[],counts:o.counts,flags:o.flags,retry:true,rule:null,unscored:false,model:'',bestComment:'',bestRC:false});
/* 회신·안내 회신 작성 — sendCompose 의 채점 부분. st = {workTries, ask:{cap}} 만 본다. ai = 이미 받은 AI 첨삭({score,els,feedback,source}) 또는 null.
   retry:true 면 「결과값이 틀렸어요, 다시」 — 점수를 내지 않고 작성기로 돌려보낸다(flags·counts 는 그래도 적용 · 정답은 싣지 않는다 retryResult).
   57차 E1:
   · 처리 키는 서버가 정한다(B5) — 거절이 정답인 카드의 흐름 안 첫 글은 reject(D11 · textKey). 결과 key 가 그 글의 처리다(카드 기록 act).
   · 수락 판정(C16 · 10팀 2차 ①) — 받아들이면 안 되는 글(거절 카드의 회신 · 두 글 카드의 요청자 앞 둘째 글 — 카드 데이터로 끄고 켠다, acceptWrong)에 수락 표현이 있으면
     금지 표현으로 걸리고(−20·forbidHit) 그 글은 act.reply(스스로 받아들임)의 점수·코멘트로 상한 — 처리 키도 reply 로 · flags.off.
   · 빠진 필수 값은 AI 첨삭이 켜져도 flags.partial·flags.miss(값 목록)로 남긴다(C6 · 10팀 2차 ④ — trigger 가 쓸 수 있게).
   · 둘째 글 코멘트는 act.reply 문장을 쓰지 않는다(10팀 2차 ⑥ — 바른 순서 100점에도 「틀린 길」 코멘트가 붙었다).
   · 증거 ev — 그 글의 항목(need·form·cite·ban·cc·calc·key). 흐름 밖에서 끝내면·수락 글이면 D12 ①. 재시도 응답에는 없다 */
Score.text=(c,inp)=>{ const text=inp.text||'', which=inp.which||'reply', ans=inp.ans, st=inp.st||{}, ai=inp.ai||null; const isSecond=which==='reply2';
  let key=textKey(c,inp.key,which);
  const out={which,key,score:0,comment:'',source:'규칙 채점',feedback:'',detail:null,branches:[],counts:{},flags:{},retry:false,rule:null,unscored:false,model:'',bestComment:bestComment(c),bestRC:bestRC(c)};
  if((c.scored===false&&c.mode==='story')||c.unscored||c.axis==='self'){ out.unscored=true; out.branches.push('reply'); return withEv(out,Ev.picks(c,['note'],text.trim()?3:0)); }
  const spec=composeSpec(c,isSecond?'second':null); const g=gradeText(c,text,spec); const ruleEls=Object.assign({},g.els); out.rule=g; out.model=spec.model||'';
  const acc=acceptHit(c,which,text); if(acc&&!isSecond) key='reply';
  out.key=key;
  /* 코멘트의 바탕은 act 표(카드 전체의 처리 결과) — 회신이 카드의 첫 단계일 때만 쓴다. 전달·대면 보고 뒤의 회신(흐름 deliver+reply·report+reply)에서
     act.reply 는 「회신만 했을 때」 오답 코멘트라 바르게 끝내도 그 말이 붙었다(57차 E1 후속 · QA Y-4① — 10팀 72장). 그때는 비워 두고 끝낼 때 정답 코멘트(finalize) */
  let score=g.score, comment=(isSecond||!(key===c.best||flowOf(c)[0]==='reply'))?'':((c.act&&c.act[key]&&c.act[key][1])||'');
  if(ai){ score=ai.score; g.els=ai.els; out.source=ai.source; out.feedback=ai.feedback||''; if(typeof ai.quality==='number') out.aiq=ai.quality; }
  let neg=false; const br=(k)=>{ if(k) out.branches.push(k); };
  let w=null, tries=0;
  if(ans!=null&&c.workAnswer&&!isSecond){ w=checkWork(c,ans); tries=Math.max(0,Math.floor(+st.workTries||0)); out.flags.answer=ans; out.flags.workOk=w.ok; out.counts.calcAll=1; if(w.ok){ out.counts.calc=1; } else { const t2=tries+1; out.flags.workTries=t2; if(!w.trap&&t2<2) return retryResult(out); score=Math.min(score,w.trap?20:0); comment='결과값이 틀렸어요. '+comment; neg=true; br(w.trap?'trap':'wrong'); } }
  const forbid=g.forbid.slice(); if(acc&&!forbid.includes(acc)){ forbid.push(acc); score-=20; }
  const miss=g.missing.slice().concat(g.anyOk?[]:['*any']).concat(g.rcMiss||[]);
  if(forbid.length){ neg=true; out.flags.forbidHit=true; out.flags.replyBanHit=true; const p=forbid[0]; comment=(acc?'':'금지 표현이 들어갔어요: '+forbid.join(', ')+'. ')+comment;
    br(acc?firstBranch(c,['reply','forbid','other']):firstBranch(c,['forbid:'+p,(c.id==='cs22'&&p.includes('계좌'))?'forbidAccount':'forbid'])); }
  else if(g.partial){ neg=true; comment='답이 절반이에요. 빠진 값을 채워야 상대가 다시 묻지 않아요. '+comment; out.flags.partial=true; br('partial'); }
  else if(g.missing.length){ neg=true; out.flags.partial=true; br('partial'); }
  if(miss.length){ out.flags.miss=miss; if(g.missing.length||g.partial) out.flags.partial=true; }
  if(g.cited===false){ out.flags.citeMiss=true; comment=(comment?comment+' ':'')+'근거 조항 번호가 없어요.'; } else if(g.cited===true) out.counts.cite=1;
  let ccOk=true;
  if(c.ccTeams&&!isSecond){ const names=c.ccTeams.map(k=>TEAM_NAMES[k]||k); ccOk=names.some(n=>text.includes(n.replace('팀',''))); if(!ccOk){ score=Math.min(score,60); comment='함께 알아야 할 팀을 참조에 넣지 않았어요. '+comment; out.flags.noCc=true; neg=true; br('noCc'); } }
  /* 흐름 밖 처리로 끝냄(회신형 카드에서 정답이 아닌 키) · 수락 글 — 그 키의 act 점수·코멘트가 상한
     57차 E1 후속 2(done-cs 16): 카드 금지 표현이 걸린 흐름 밖 글은 상한을 씌운 **뒤** 금지 하나마다 −20(offForbid — 흐름 안 회신과 같은 감점) · 코멘트 앞에 「금지 표현이 들어갔어요」를 남긴다.
     예전에는 act 상한이 금지 감점을 덮고 코멘트도 act 문장으로 바뀌어 한도를 들어 거절한 글과 금액을 약속한 글이 같은 점수·같은 코멘트였다(cs32) */
  const off=!isSecond&&key!==c.best&&!!c.best&&!!(c.act&&c.act[key])&&flowOf(c)[0]==='reply';
  if(off){ const cap=acc?acceptCap(c):c.act[key][0]; score=Math.min(score,cap); if(g.forbid.length){ score=Math.min(score,offForbid(c,cap,g.forbid)); out.offForbid=1; }
    const actCmt=c.act[key][1]||''; comment=(acc?`받아들이면 안 되는 건이에요(「${acc}」). `:'')+(actCmt?(acc||!g.forbid.length?'':'금지 표현이 들어갔어요: '+g.forbid.join(', ')+'. ')+actCmt:comment); neg=true; if(!acc) br(firstBranch(c,[key,'other'])); }
  else if(acc){ score=Math.min(score,acceptCap(c)); comment=(`받아들이면 안 되는 건이에요(「${acc}」). `+((c.act&&c.act.reply&&c.act.reply[1])||'')).trim(); }
  if(acc) out.flags.off=1;
  if(!isSecond&&c.best&&['reject','confirm'].includes(c.best)&&flowOf(c)[0]==='reply'){ out.counts.rejectAll=1; if(key===c.best) out.counts.reject=1; }
  if(c.mode==='ask'&&!isSecond){ if(st.ask) score=Math.min(score,st.ask.cap); else { score=Math.min(score,g.missing.length?40:60); comment='먼저 물어보지 않고 답했어요. '+comment; } }
  out.detail={els:g.els,missing:g.missing,forbid,partial:g.partial,cited:g.cited};
  if(!isSecond&&!neg&&flowOf(c)[0]==='reply'&&(!c.best||key===c.best)&&score>=60) br('ok');
  out.score=Math.max(0,Math.min(100,score)); out.comment=comment;
  let ev=Ev.text({c,text,spec,which,key,rule:{els:ruleEls},ans:isSecond?null:ans,work:w,tries,st,ccOk,off:off||!!acc,keyScore:acc?acceptCap(c):null});
  /* 두 글 카드의 둘째 글이 수락이면 처리 판단(key — 첫 글에서 3)도 「스스로 받아들임」의 등급으로 바꾼다(부르는 쪽이 같은 id 를 덮어쓴다) */
  if(ev&&isSecond&&acc) ev=ev.concat(Ev.picks(c,['key'],(it)=>Ev.gradeS(acceptCap(c),false,'reply',it)));
  return withEv(out,ev); };
/* 결재 검토(반려 의견) — sendApproval 의 채점 부분. approve:true 면 「이상 없음」으로 쓴 것 → 승인 경로
   57차 E1: 증거 flags(지적 항목 비율 — of = mustFlag 번호) · calc(합계 — 첫 시도라 맞음 3·틀림 0) · cite · ban · key(반려). 반려가 정답이 아니면 D12 ① */
Score.approval=(c,inp)=>{ const text=inp.text||'', ans=inp.ans, ai=inp.ai||null; const spec=composeSpec(c); const g=gradeText(c,text,spec);
  const out={score:0,comment:'',rule:g,source:'규칙 채점',feedback:'',detail:null,branches:[],counts:{},flags:{},approve:false,model:spec.model||'',bestRC:bestRC(c),bestComment:bestComment(c)};
  if(ai){ out.source=ai.source; out.feedback=ai.feedback||''; if(typeof ai.quality==='number') out.aiq=ai.quality; }
  if(/이상 없음|그대로 적용/.test(text)&&!/반려/.test(text)){ out.approve=true; return out; }
  const f=countFlags(c,text); let score=100, comment=(c.act&&c.act.reject&&c.act.reject[1])||'';
  if(f.all){ score=f.n>=f.all?100:f.n===f.all-1?70:f.n>=1?40:20; if(f.n<f.all){ comment=`지적 항목 ${f.n}/${f.all}. `+comment; out.branches.push(f.n===f.all-1?'flag2':'flag1'); } }
  let w=null;
  if(c.workAnswer){ w=checkWork(c,ans||text); out.flags.answer=ans; out.flags.workOk=w.ok; out.counts.calcAll=1; if(w.ok) out.counts.calc=1; else { score=Math.min(score,w.trap?30:35); comment='맞는 합계가 없어요. '+comment; out.branches.push(w.trap?'trap':'wrong'); } }
  if(g.forbid.length){ out.flags.forbidHit=true; score=Math.min(score,20); const k=firstBranch(c,['forbid:'+g.forbid[0],'forbid']); if(k) out.branches.push(k); }
  if(g.cited===true) out.counts.cite=1; out.counts.rejectAll=1; if(c.best==='reject') out.counts.reject=1;
  out.detail={els:g.els,missing:g.missing,forbid:g.forbid,cited:g.cited}; out.score=score; out.comment=comment;
  if(!Ev.on()) return out;
  const unlocked=((D&&D.unlock)||[]).includes('rulebook'); const isBest=c.best==='reject'; const ev=[];
  for(const it of Ev.items(c)){ let s=null;
    if(it.ov==='flags'&&f.all){ const idx=(it.of&&it.of.length)?it.of:f.hit.map((_,i)=>i); s=Ev.ratioS(idx.filter(i=>f.hit[i]).length,idx.length); }
    else if(it.ov==='calc'&&w) s=w.ok?3:0;
    else if(it.ov==='cite'&&unlocked){ const s0=Ev.citeS(spec,text); if(s0!=null) s=s0; }
    else if(it.ov==='ban'&&text.replace(/\s/g,'').length>8){ const fb=(it.of&&it.of.length)?it.of:(spec.forbid||[]); if(fb.length) s=fb.some(k=>k&&forbidHit(text,k,strictOf(spec,k)))?0:3; }
    else if(it.ov==='key') s=Ev.gradeS(actScore(c,'reject'),isBest,'reject',it);
    if(s!=null){ const e=Ev.item(c,it,s); if(e) ev.push(e); } }
  return withEv(out,isBest?ev:Ev.d12(c,ev,null)); };
/* ---------- 흐름 밖 처리로 끝내기 — 57차 E1(B5 · E2f §8-1): cards.js actEnd 의 점수 규칙을 서버로(배포본 요청 2~6건 → 1건) ----------
   inp = {key, flowSkip, text?, st:{ask}, have:[이미 관찰한 항목 id], started(단계를 하나라도 함), ai?}
   · 흐름 안의 최선 단추(보류가 정답 · 회신형의 최선 전달 등, 글 없음) → 그 act 점수
   · ① act 에 없는 기본 키 → act 최저점 + 공통 코멘트
   · ② 흐름을 건너뛰고 최선 키로 끝내려 함(flowSkip) · ③ 글 없이 끝나는(또는 상신 글) 처리인데 데이터에 만점 키가 둘
       → 최선보다 낮은 것 중 가장 높은 점수, **단 50 을 넘지 않는다**(OFFFLOW_CAP · 10팀 2차 ⑤)
   · 그 밖 → 고른 키의 act 점수
   · 글을 썼으면 그 글도 채점해 둘 중 낮은 쪽 — 〔상신하기〕 글은 보고의 꼴(upForm)만, 그 밖 글은 규칙 채점(금지 표현·빠진 값 표시·분기 포함)
   증거: 정답 경로(최선 단추) → key 3 · 그 밖 D12 ① — key(끝낸 점수의 등급) · 주 항목 0!(이미 관찰한 것은 그대로) · 글이 있으면 form · 단계를 하나라도 했으면 follow 0 */
Score.offFlow=(c,inp)=>{ const key=inp.key, text=inp.text!=null?String(inp.text):null, st=inp.st||{}; const keys=Object.keys(c.act||{}); const has=keys.includes(key);
  const inPath=has&&key===c.best&&!inp.flowSkip&&text==null;
  const out={ok:true,key,score:0,comment:'',isBest:false,bestRC:false,bestComment:'',how:'act',branches:[],flags:{},counts:{},detail:null,source:'규칙 채점',feedback:''};
  if(inPath){ const a=c.act[key]; out.score=a[0]; out.comment=a[1]||''; out.isBest=true; out.bestRC=bestRC(c); out.bestComment=bestComment(c); out.branches.push('ok');
    return withEv(out,Ev.picks(c,['key'],3)); }
  const top=has&&c.best&&c.act[c.best]?c.act[c.best][0]:null; const mine=has?c.act[key]:null;
  const need=!has||key===c.best||(mine&&top!=null&&mine[0]>=top&&(text==null||key==='confirm'));
  if(need){ const rs=keys.map(k=>({k,s:actScore(c,k)})).filter(x=>x.s!=null); out.bestRC=bestRC(c);
    if(!has){ const lo=rs.reduce((a,r)=>!a||r.s<a.s?r:a,null); out.score=lo?lo.s:0; out.comment='이 건에는 맞지 않는 처리예요.'; out.how='min'; }
    else { const t=top!=null?top:Math.max(...rs.map(r=>r.s)); const below=rs.filter(r=>r.k!==c.best&&r.s<t); const hi=below.reduce((a,r)=>!a||r.s>a.s?r:a,null)||rs.reduce((a,r)=>!a||r.s<a.s?r:a,null);
      out.score=Math.min(hi?hi.s:0,OFFFLOW_CAP); out.comment='이 건은 그 처리만으로는 끝나지 않아요. 누가 무엇을 해야 끝나는 일인지 다시 봐요.'; out.how='below'; } }
  else { out.score=mine[0]; out.comment=mine[1]||''; out.bestRC=bestRC(c); out.isBest=key===c.best&&!inp.flowSkip; out.bestComment=bestComment(c); }
  let formEv=[];
  if(text!=null){ const spec=composeSpec(c); const g=gradeText(c,text,spec); const ai=inp.ai||null; const ruleEls=Object.assign({},g.els); if(ai){ g.els=ai.els; out.source=ai.source; out.feedback=ai.feedback||''; }
    if(key==='confirm'){ const f=upForm({detail:{els:g.els,cited:g.cited}},text); if(g.cited===true) out.counts.cite=1; out.detail=f.detail;
      if(f.score<out.score){ out.score=f.score; out.comment=(out.comment?out.comment+' ':'')+'올린 글에 무슨 건인지·판단받을 것·다음 행동이 다 담기지 않았어요.'; } }
    else { const r=Score.text(c,{text,which:'reply',key:has?key:'reply',ans:null,st:{workTries:1,ask:st.ask||null},ai});
      if(!r.unscored){ Object.assign(out.flags,r.flags); Object.assign(out.counts,r.counts); for(const b of (r.branches||[])) if(b!=='ok') out.branches.push(b); out.detail=r.detail; if(r.aiq!=null) out.aiq=r.aiq; if(r.score<out.score){ out.score=r.score; out.comment=r.comment||out.comment; }
        /* 57차 E1 후속 2 — 흐름 밖 글의 금지 표현: 고른 처리의 act 점수(out.score)가 금지 감점을 덮지 않게(Score.text 가 이미 흐름 밖으로 셌으면 한 번만) */
        const fb=((r.detail&&r.detail.forbid)||[]).filter(k=>!ACCEPT_DEFAULT.includes(k));
        if(fb.length&&!r.offForbid){ const s=offForbid(c,out.score,fb); if(s<out.score){ out.score=s; out.comment='금지 표현이 들어갔어요: '+fb.join(', ')+'. '+String(out.comment||'').replace(/^금지 표현이 들어갔어요: [^\n]*?\. /,''); } } } }
    formEv=Ev.text({c,text,spec,which:'reply',key,rule:{els:ruleEls},st:{ask:true},onlyForm:true,off:false}).filter(e=>{ const it=Ev.items(c).find(x=>x.id===e.i); return it&&it.ov==='form'; });
    out.isBest=false; }
  if(!out.isBest) out.flags.off=1;
  /* 반응 — 글의 분기(금지 표현 등)를 먼저, 그다음 고른 처리의 분기(없으면 other). 예전 cards.js actEnd 와 같은 순서 */
  { const b=out.isBest?'ok':(has&&out.how==='act')?firstBranch(c,[key,'other']):firstBranch(c,['other']); if(b) out.branches.push(b); }
  if(!Ev.on()) return out;
  if(out.isBest) return withEv(out,Ev.picks(c,['key'],3));
  /* 이미 관찰한 항목(앞 단계 — 전달 상대·첫 글 등)은 그대로 둔다. 처리 판단(key)만 마지막에 고른 처리로 바뀐다 */
  const have=[].concat(inp.have||[]); let ev=Ev.picks(c,['key'],(it)=>Ev.gradeS(out.score,false,key,it)).concat(formEv.filter(e=>!have.includes(e.i)));
  ev=Ev.d12(c,ev,null,{keepForm:true,have});
  if(inp.started) ev=Ev.merge(ev,Ev.picks(c,['follow'],0).filter(e=>!have.includes(e.i)));
  /* 상대를 찾다 못 찾고(틀린 상대 tries>0) 흐름 밖으로 끝냈으면 route 0 — 하루 끝(dayEnd)과 같은 규칙(57차 E1 후속 · QA W-3: 흐름 밖으로 끝낸 카드가 끝까지 안 한 카드보다 덜 깎였다) */
  if(+inp.tries>0) ev=Ev.merge(ev,Ev.picks(c,['route'],0).filter(e=>!have.includes(e.i)));
  return withEv(out,ev); };
/* 하루 끝 — 도착했는데 끝내지 않은 카드의 증거(57차 E1 · B4 · D12 ②). 배포본 브라우저는 주 항목(items[0])을 모른다(공개본 ncs2 는 route·follow 만) → 서버가 낸다.
   inp.cards = {카드id:{have:[이미 관찰한 항목 id], started(단계를 하나라도 함), tries(틀린 상대에게 간 수)}}
   → 주 항목 0!(이미 관찰했으면 그대로) · 단계를 하나라도 했으면 follow 0 · 상대를 찾다 못 찾았으면(tries>0) route 0 · 나머지 미관찰 */
Score.dayEnd=(_,inp)=>{ const outEv={}; const list=(inp&&inp.cards)||{};
  for(const [id,x] of Object.entries(list)){ const c=((D&&D.cards)||[]).find(k=>k.id===id); if(!c||!Ev.on()) continue; const have=[].concat((x&&x.have)||[]); let ev=[];
    const m=Ev.main(c,null); if(m&&!have.includes(m.id)){ const z=Ev.item(c,m,0,{x:true}); if(z) ev.push(z); }
    if(x&&x.started) ev=Ev.merge(ev,Ev.picks(c,['follow'],0).filter(e=>!have.includes(e.i)&&e.i!==(m&&m.id)));
    if(x&&x.tries>0) ev=Ev.merge(ev,Ev.picks(c,['route'],0).filter(e=>!have.includes(e.i)&&e.i!==(m&&m.id)));
    outEv[id]=ev; }
  return withEv({ok:true,cards:outEv},[]); };
/* ▲ 순수 채점 공용부 끝 */

/* AI 첨삭 훅 — Backend.grade 가 있으면 호출, 실패·미설정이면 규칙 채점 그대로 */
async function gradeWithAI(c,text,spec,rule){ if(!aiOn()) return null;
  try{ const r=await withTimeout(window.Backend.grade({code:S.code,team:S.team,ep:S.ep,cardId:c.id,subj:c.subj,body:c.body,text,channel:c.type,which:(spec&&spec.which)||'reply'}),12000);
    if(!r||!r.ok||typeof r.score!=='number') return null; const els={}; const src=r.elements||{}; const alt={'다음 행동':'다음행동'};
    for(const k of ['인사','확인','답','다음 행동','맺음']){ const v=src[k]!=null?src[k]:src[alt[k]]; els[k]=v!=null?!!v:rule.els[k]; } const o={score:Math.max(0,Math.min(100,Math.round(r.score))),els,feedback:r.feedback||'',source:'AI 첨삭'}; if(typeof r.quality==='number') o.quality=r.quality; return o; }
  catch(e){ console.warn('AI 첨삭 실패:',e.message); return null; } }
