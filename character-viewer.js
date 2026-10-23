/* A separate review UI around the existing, deployed game's inspection mode.
   No game storage, feedback service, authentication or model files are written. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), frame = $('viewer');
  const query = new URLSearchParams(location.search);
  const knownId = value => /^acnh_\d+$/.test(value || '') ? value : /^\d+$/.test(value || '') ? 'acnh_' + value : 'acnh_52';
  const S = {id:knownId(query.get('id')), pose:['idle','sit','type','walk','jog'].includes(query.get('pose'))?query.get('pose'):'idle', view:['full','head','top','hands'].includes(query.get('view'))?query.get('view'):'full', paused:false, ready:false, token:0, roster:[], filtered:[], error:null};
  const feedback = {acnh_52:'목선에서 시작하는 상의 형태와 공중에 떠 보이는 옷깃.', acnh_54:'왼팔 소매의 접힌 자국, 가르마 쪽 머리카락의 눌린 볼륨.', acnh_18:'상의와 머리카락 전체 수정. 얼굴과 체형은 보존.'};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const controls = () => frame.contentWindow.__office;
  const inspect = () => frame.contentWindow.__inspect;
  const actor = () => inspect()?.char();
  const clean = s => String(s).replace(/\s+/g,'').toLowerCase();
  const movable = () => S.ready && actor()?.CH === S.id;
  function message(text) { $('notice').textContent=text; }
  function busy(on,text) { S.ready=!on; $('loading').hidden=!on; if(text)$('load-message').textContent=text; document.querySelectorAll('[data-view],[data-angle],[data-turn],[data-zoom],[data-pose],#pause').forEach(b=>b.disabled=on); }
  function syncURL() { const q=new URLSearchParams({id:S.id.replace('acnh_',''),pose:S.pose,view:S.view}); history.replaceState(null,'',location.pathname+'?'+q); }
  function identity() {
    const r=S.roster.find(r=>r.character_id===S.id); if(!r)return;
    $('name').textContent=r.display_name; $('team').textContent=r.team_name; $('number').textContent='#'+S.id.replace('acnh_','');
    $('position').textContent=(S.filtered.findIndex(r=>r.character_id===S.id)+1)+' / '+S.filtered.length;
    $('character').value=S.id; $('count').textContent=S.roster.length+'명';
    $('feedback').hidden=!feedback[S.id]; $('feedback-text').textContent=feedback[S.id]||'';
    document.querySelectorAll('[data-character]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.character===S.id));const entry=S.roster.find(r=>r.character_id===b.dataset.character);if(entry)b.textContent=entry.display_name;});
    document.querySelectorAll('[data-pose]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.pose===S.pose)));
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===S.view)));
    $('pause').setAttribute('aria-pressed',String(S.paused)); $('pause').textContent=S.paused?'계속 재생':'일시 정지';
  }
  function filter() {
    const word=clean($('search').value); S.filtered=S.roster.filter(r=>clean([r.display_name,r.team_name,r.character_id.replace('acnh_','')].join(' ')).includes(word));
    const select=$('character');select.replaceChildren();
    for(const r of S.filtered){const o=document.createElement('option');o.value=r.character_id;o.textContent=`${r.team_name} · ${r.display_name} · #${r.character_id.replace('acnh_','')}`;select.append(o);}
    if(!S.filtered.length){const o=document.createElement('option');o.textContent='검색 결과가 없습니다';select.append(o);}
    select.disabled=!S.filtered.length; $('previous').disabled=$('next').disabled=S.filtered.length<2;
    select.value=S.filtered.some(r=>r.character_id===S.id)?S.id:S.filtered[0]?.character_id||'';
    $('position').textContent=(S.filtered.findIndex(r=>r.character_id===S.id)+1)+' / '+S.filtered.length;
  }
  function hook(c) {
    if(c.__oneByOneUpdate)return;
    const original=c.update; c.__oneByOneUpdate=original;
    c.update=function(dt,cam){
      if(c===actor()&&S.paused){c.__insLast=performance.now();return;}
      // The original gait clips play in place for garment inspection; floor travel
      // and planted-foot anchors are not a locomotion test in this review screen.
      if(c===actor()&&['walk','jog'].includes(S.pose)){
        c._lp=null; c._plant={}; c._plantE={};
        const a=S.pose==='jog'?c.actions.jog:c.actions.walk;if(a)a.timeScale=1;
      }
      original(dt,cam);
    };
  }
  function camera(view=S.view, angle=null) {
    if(!movable())return;
    const c=actor(),o=controls(),target=o.controls.target.clone(),pos=c.model.position.clone(),H=c.H||1;
    const offset=o.camera.position.clone().sub(o.controls.target),az=angle===null?Math.atan2(offset.x,offset.z):angle*Math.PI/180;
    let height;
    if(view==='head'){c.bones.Head.getWorldPosition(target);target.y+=H*.14;height=H*.54;}
    else if(view==='top'){(c.bones.Chest||c.bones.Spine).getWorldPosition(target);target.y-=H*.025;height=H*.57;}
    else if(view==='hands'){c.bones.Hand_L.getWorldPosition(target);target.add(c.bones.Hand_R.getWorldPosition(pos)).multiplyScalar(.5);height=H*.27;}
    else {target.copy(pos);target.y+=H*.51;height=H*1.10;}
    const aspect=Math.max(.2,o.camera.aspect),distance=height/(2*Math.tan(o.camera.fov*Math.PI/360))*Math.max(1,.72/aspect);
    const tilt=view==='hands'?.22:.04;
    if(o.controls._sphericalDelta)o.controls._sphericalDelta.set(0,0,0);
    if(o.controls._panOffset)o.controls._panOffset.set(0,0,0);
    if('_scale' in o.controls)o.controls._scale=1;
    o.controls.target.copy(target);o.camera.position.set(target.x+Math.sin(az)*distance,target.y+distance*tilt,target.z+Math.cos(az)*distance);o.controls.update();
    S.view=view;identity();syncURL();
  }
  async function pose(value) {
    const c=actor();if(!c)return;
    S.paused=false;S.pose=value;
    if(['walk','jog'].includes(value)){
      await inspect().pose('idle');
      if(value==='jog'&&!c.actions.jog){S.pose='idle';message('이 캐릭터의 달리기 동작을 불러오지 못했습니다.');}
      else{c.gait=value;c.play('walk',{direct:true,fade:.18});c.mode='walk';c.model.visible=true;}
    } else await inspect().pose(value);
    await sleep(80);if(c!==actor())return;
    const seat=inspect().seat;if(seat.nativeChair)seat.nativeChair.visible=['sit','type'].includes(S.pose);
    hook(c);identity();camera();
  }
  async function select(id) {
    if(!S.roster.some(r=>r.character_id===id))return;
    const token=++S.token;S.id=id;S.error=null;S.paused=false;identity();syncURL();busy(true,'캐릭터를 불러오는 중입니다.');$('retry').hidden=true;
    try{
      // The legacy inspection stage reuses one seat. Rebuild its fitted chair
      // for the selected actor without retaining earlier actors' chairs.
      const seat=inspect().seat;
      if(seat.nativeChair&&seat.nativeChairFor!==id){seat.nativeChair.parent?.remove(seat.nativeChair);seat.nativeChair=null;seat.chair=null;}
      const ok=await inspect().show(id);if(token!==S.token)return;
      if(!ok||!inspect().state().ready)throw Error(inspect().state().err||'캐릭터 파일을 불러오지 못했습니다.');
      hook(actor());await pose(S.pose);if(token!==S.token)return;
      busy(false);camera(S.view,0);identity();
    }catch(e){if(token!==S.token)return;fail(e);}
  }
  function fail(e){S.error=String(e.message||e);busy(true,'불러오기를 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');$('retry').hidden=false;message(S.error);}
  function step(direction){if(!S.filtered.length)return;const i=S.filtered.findIndex(r=>r.character_id===S.id);select(S.filtered[(Math.max(0,i)+direction+S.filtered.length)%S.filtered.length].character_id);}
  function frameStyle(){const d=frame.contentDocument;if(!d||d.getElementById('one-by-one-ui'))return;const style=d.createElement('style');style.id='one-by-one-ui';style.textContent='#insTitle,#insPanel,#hud,#hint,#prompt,#pad,#touchTalk,#choice,#bubbles,#fade,#log{display:none!important}';d.head.append(style);
    frame.contentWindow.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopImmediatePropagation();step(e.key==='ArrowRight'?1:-1);}},true);
  }
  async function start(){
    busy(true);S.error=null;$('retry').hidden=true;
    // Both existing projects live on the same GitHub Pages origin. Use the formal
    // game's read-only inspector so selected seats and runtime posture stay exact.
    const url=new URL('../work-sim-v2/office.html',location.href);
    url.search=new URLSearchParams({inspect:'1',office:'legacy',ch:S.id,pose:'idle',v:'effa91d0fe291425'}).toString();frame.src=url;
    const startTime=performance.now();
    while(performance.now()-startTime<90000){
      await sleep(200);
      try{
        frameStyle();
        if(inspect()&&controls()&&window.WorkSimRoster){
          // The game may apply authored dialogue aliases to its own roster.
          // Review labels use the canonical roster, without mutating game NPCs.
          S.roster=window.WorkSimRoster.data.characters.slice().sort((a,b)=>a.team_name.localeCompare(b.team_name,'ko')||Number(a.character_id.replace('acnh_',''))-Number(b.character_id.replace('acnh_','')));
          if(S.roster.length!==50||new Set(S.roster.map(r=>r.character_id)).size!==50)throw Error('현재 게임의 50명 명단을 확인하지 못했습니다.');
          if(!S.roster.some(r=>r.character_id===S.id))S.id='acnh_52';
          filter();identity();
          await select(S.id);return;
        }
        const status=frame.contentDocument?.getElementById('status')?.textContent;
        if(status)$('load-message').textContent='검수 화면 준비 · '+status;
      }catch(e){if(e.name!=='SecurityError'){fail(e);return;}}
    }
    fail(Error('캐릭터 검수 화면 연결 시간이 초과되었습니다.'));
  }
  $('search').addEventListener('input',()=>{filter();if(S.filtered.length&&!S.filtered.some(r=>r.character_id===S.id))select(S.filtered[0].character_id);});
  $('character').addEventListener('change',e=>select(e.target.value));
  $('previous').onclick=()=>step(-1);$('next').onclick=()=>step(1);
  document.querySelectorAll('[data-character]').forEach(b=>b.onclick=()=>{if(!S.roster.length)return;$('search').value='';filter();select(b.dataset.character);});
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>camera(b.dataset.view));
  document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>camera(S.view,Number(b.dataset.angle)));
  document.querySelectorAll('[data-pose]').forEach(b=>b.onclick=()=>pose(b.dataset.pose).catch(fail));
  document.querySelectorAll('[data-turn]').forEach(b=>b.onclick=()=>{if(!movable())return;const o=controls(),d=o.camera.position.clone().sub(o.controls.target),a=Number(b.dataset.turn)*Math.PI/180,x=d.x*Math.cos(a)+d.z*Math.sin(a),z=d.z*Math.cos(a)-d.x*Math.sin(a);d.x=x;d.z=z;o.camera.position.copy(o.controls.target).add(d);o.controls.update();});
  document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{if(!movable())return;const o=controls(),d=o.camera.position.clone().sub(o.controls.target);d.multiplyScalar(Number(b.dataset.zoom));d.clampLength(o.controls.minDistance,o.controls.maxDistance);o.camera.position.copy(o.controls.target).add(d);o.controls.update();});
  $('pause').onclick=()=>{if(!movable())return;S.paused=!S.paused;identity();};
  $('retry').onclick=start;
  $('share').onclick=async()=>{syncURL();try{await navigator.clipboard.writeText(location.href);message('이 캐릭터를 바로 여는 링크를 복사했습니다. 휴대폰에서도 열 수 있습니다.');}catch(e){$('share-fallback').hidden=false;$('share-url').value=location.href;$('share-url').focus();$('share-url').select();message('선택된 링크를 복사해 주세요.');}};
  addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||e.metaKey||e.ctrlKey||e.altKey)return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();step(e.key==='ArrowRight'?1:-1);}});
  let resizeTimer;new ResizeObserver(()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>camera(),150);}).observe($('stage'));
  window.CharacterViewer=Object.freeze({get state(){return {...S,roster:S.roster.map(r=>({id:r.character_id,name:r.display_name,team:r.team_name,model:r.model_url})),filtered:S.filtered.map(r=>r.character_id),runtime:inspect()?.state(),clip:actor()?.clip};},select,pose,view:camera});
  start().catch(fail);
})();
