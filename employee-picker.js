(() => {
  'use strict';
  const roster = window.WorkSimRoster.data.characters;
  const byId = new Map(roster.map(c => [c.character_id, c]));
  const teams = [...new Map(roster.map(c => [c.team_code, c.team_name]))];
  const KEY = 'worksim-employee-picker-v1', REVIEW = 'worksim-character-review-v1';
  const $ = id => document.getElementById(id);
  const make = (tag, text, cls) => { const e = document.createElement(tag); if(text != null)e.textContent=text; if(cls)e.className=cls; return e; };
  let token = '', clientId = crypto.randomUUID(), selections = {}, pending = {}, connected = false, timer, busy = false, lastTime = 0;
  let storageOK = true;
  try {
    const incoming = new URLSearchParams(location.hash.slice(1)).get('reviewToken');
    if(incoming && /^[a-f0-9]{64}$/.test(incoming)) { sessionStorage.setItem(REVIEW+'-access-token',incoming); history.replaceState(null,'',location.pathname+location.search); }
    token=sessionStorage.getItem(REVIEW+'-access-token')||'';
    clientId=localStorage.getItem(REVIEW+'-client')||clientId; localStorage.setItem(REVIEW+'-client',clientId);
    const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
    selections=saved.selections||{}; pending=saved.pending||{};
  } catch { storageOK=false; }
  const stamp=()=>{lastTime=Math.max(Date.now(),lastTime+1);return new Date(lastTime).toISOString();};
  const valid=(team,s,partial=false)=>s && (partial || (s.male && s.female)) && ['male','female'].every(g=>!s[g]?partial:byId.get(s[g])?.team_code===team && byId.get(s[g])?.gender===g);
  for(const [team,s] of Object.entries(selections))if(!valid(team,s,true))delete selections[team];
  for(const [team,s] of Object.entries(pending))if(!valid(team,s))delete pending[team];
  const complete=()=>teams.filter(([t])=>valid(t,selections[t])).length;
  function persist(){ try{localStorage.setItem(KEY,JSON.stringify({selections,pending}));}catch{storageOK=false;} }
  function api(path,opt={}){return fetch(path,{...opt,headers:{...opt.headers,'X-Review-Token':token},signal:opt.keepalive?undefined:AbortSignal.timeout(10000)});}
  function paint(){
    $('progress').textContent=`${complete()} / ${teams.length}팀 선택 완료 · 50명`;
    $('finish').disabled=complete()!==teams.length;
    for(const [team] of teams){
      const s=selections[team]||{},box=document.getElementById('team-'+team);
      box.classList.toggle('complete',!!valid(team,s));
      box.querySelector('.team-status').textContent=valid(team,s)?'남녀 선택 완료':'여자 1명 · 남자 1명';
      box.querySelector('.team-picked').textContent=`여자: ${byId.get(s.female)?.full_name||'선택 전'} / 남자: ${byId.get(s.male)?.full_name||'선택 전'}`;
      for(const b of box.querySelectorAll('.face')){const c=byId.get(b.dataset.character);const picked=s[c.gender]===c.character_id;b.setAttribute('aria-pressed',String(picked));b.querySelector('.choice').textContent=picked?(c.gender==='female'?'여자 사원 선택됨':'남자 사원 선택됨'):'누르면 선택';}
    }
  }
  function choose(c){
    const old=selections[c.team_code]||{}; if(old[c.gender]===c.character_id)return;
    const s={...old,[c.gender]:c.character_id,note:old.note||'',updatedAt:stamp(),clientId};
    selections[c.team_code]=s;
    if(valid(c.team_code,s))pending[c.team_code]=structuredClone(s);
    persist();paint();$('finish-message').textContent='';
    $('save-status').textContent=storageOK?'이 브라우저에 저장됨'+(valid(c.team_code,s)?'':' · 이 팀의 남녀를 모두 골라 주세요'):'브라우저 저장 불가 · 선택을 내보내 주세요';
    if(connected){clearTimeout(timer);timer=setTimeout(sync,350);}
  }
  async function sync(){
    if(!connected||busy)return;
    const batch=structuredClone(pending);if(!Object.keys(batch).length)return;
    busy=true;$('save-status').textContent='Mac에 저장 중';
    try{
      const r=await api('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:1,clientId,notes:[],characters:{},employeeSelections:batch})});
      if(!r.ok)throw new Error('save');
      for(const [t,s] of Object.entries(batch))if(JSON.stringify(pending[t])===JSON.stringify(s))delete pending[t];
      persist();$('save-status').textContent=storageOK?'브라우저와 Mac에 저장 완료':'Mac에 저장 완료 · 브라우저 저장 불가';
    }catch{$('save-status').textContent='Mac 저장 연결 대기 · 이 브라우저의 선택은 보존됩니다';}
    finally{busy=false;if(Object.keys(pending).length){clearTimeout(timer);timer=setTimeout(sync,12000);}}
  }
  async function connect(){
    if(!token){$('save-status').textContent='이 브라우저에 저장 · Mac 연결은 전용 링크에서 가능';$('storage-help').textContent='선택 내보내기로 결과를 보관할 수 있어요. Mac에 저장하려면 전달받은 전용 링크로 열어 주세요.';return;}
    try{
      const r=await api('/api/employee-selections');if(!r.ok)throw new Error('connect');const data=await r.json();
      for(const [t,s] of Object.entries(data.employeeSelections||{}))if(valid(t,s) && (!selections[t] || s.updatedAt>selections[t].updatedAt)){selections[t]=s;delete pending[t];}
      connected=true;persist();paint();$('save-status').textContent='Mac 저장 연결됨';$('storage-help').textContent='한 팀의 남녀를 모두 고르면 이 브라우저와 Mac에 자동 저장됩니다.';await sync();
    }catch{connected=false;$('save-status').textContent='Mac 연결을 확인하지 못했어요 · 선택 내보내기로 보관해 주세요';}
  }
  for(const [team,name] of teams){
    const section=make('section',null,'team');section.id='team-'+team;
    const head=make('div',null,'team-heading');head.append(make('h2',name),make('span','여자 1명 · 남자 1명','team-status'));section.append(head);
    const grid=make('div',null,'faces');
    for(const c of roster.filter(c=>c.team_code===team)){
      const button=make('button',null,'face');button.type='button';button.dataset.character=c.character_id;button.setAttribute('aria-label',`${c.full_name}, ${c.gender==='female'?'여자':'남자'} 사원 후보 선택`);button.setAttribute('aria-pressed','false');
      const img=make('img');img.src=`assets/native_staff50/portraits/${c.character_id}.png`+(c.model_url.match(/\?v=.*/)?.[0]||'');img.alt=c.full_name+' 얼굴';img.width=256;img.height=256;img.loading='lazy';img.decoding='async';img.onerror=()=>button.classList.add('image-error');
      button.append(img,make('strong',c.full_name),make('span',`${c.title} · ${c.gender==='female'?'여자':'남자'} · #${c.character_id.slice(5)}`,'meta'),make('span','누르면 선택','choice'));button.onclick=()=>choose(c);grid.append(button);
    }
    section.append(grid,make('p','','team-picked'));$('teams').append(section);
  }
  $('export').onclick=()=>{const pairs=Object.fromEntries(Object.entries(selections).filter(([t,s])=>valid(t,s)));const data={schema:1,notes:[],characters:{},employeeSelections:pairs,selectionDrafts:selections,exportedAt:stamp()};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=make('a');a.href=url;a.download='worksim-employee-selections.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  $('finish').onclick=async()=>{await sync();$('finish-message').textContent=connected&&!Object.keys(pending).length?'20명 선택을 Mac에 저장했어요. 이 채팅에 선택 완료라고 알려 주세요.':'20명을 선택했어요. 선택 내보내기로 결과를 보관해 주세요.';};
  window.addEventListener('focus',()=>{if(token)connect();});
  window.addEventListener('pagehide',()=>{persist();if(connected&&Object.keys(pending).length)api('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:1,clientId,notes:[],characters:{},employeeSelections:pending}),keepalive:true}).catch(()=>{});});
  paint();connect();
  window.EmployeePicker=Object.freeze({get state(){return {count:roster.length,completeTeams:complete(),connected,selections:structuredClone(selections),pendingTeams:Object.keys(pending).length};}});
})();
