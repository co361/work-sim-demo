import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createRunPosture } from './js/office-run-posture.js?v=20261003run1';
import { createTalkFace } from './js/office-talkface.js';

// A focused review tool in the existing HTML/Three.js application. No game state is changed.
const $ = id => document.getElementById(id);
const roster = window.WorkSimRoster.data.characters;
const byId = new Map(roster.map(c => [c.character_id, c]));
const STORE = 'worksim-character-review-v1';
const localApi = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const tokenKey = STORE + '-access-token';
const fragmentToken = new URLSearchParams(location.hash.slice(1)).get('reviewToken');
if (fragmentToken && /^[a-f0-9]{64}$/.test(fragmentToken)) {
  sessionStorage.setItem(tokenKey, fragmentToken);
  history.replaceState(null, '', location.pathname + location.search);
}
const accessToken = sessionStorage.getItem(tokenKey) || '';
const apiRequested = localApi || !!accessToken;
const apiFetch = (path, options = {}) => fetch(path, {...options, headers:{...options.headers, ...(accessToken ? {'X-Review-Token':accessToken} : {})}});
const clientId = localStorage.getItem(STORE + '-client') || crypto.randomUUID();
localStorage.setItem(STORE + '-client', clientId);
let data = {schema: 1, clientId, notes: [], characters: {}, employeeSelections: {}};
let db, selected, actor, currentAction, currentClip = 'idle', paused = false;
let snapshotNote = null, draft = null, noteDirty = false, modelSha = '', loadGeneration = 0, activeFetch;
let saveTimer, editorTimer, employeeTimer, saving = Promise.resolve(), syncTimer;
let apiAvailable = false, pendingNotes = new Map(), pendingCharacters = {}, pendingEmployees = {};
let storageError = false;
const now = () => new Date().toISOString();
const clone = v => structuredClone(v);
const activeNotes = id => data.notes.filter(n => n.characterId === id && !n.deleted);
const statusText = c => data.characters[c.character_id]?.reviewed ? '검토 완료' : activeNotes(c.character_id).length ? '수정 의견 있음' : '미검토';
const notice = text => { $('notice').textContent = text; $('notice').hidden = false; clearTimeout(notice.timer); notice.timer = setTimeout(() => $('notice').hidden = true, 4300); };
const make = (tag, text, className) => {const e = document.createElement(tag); if (text != null) e.textContent = text; if (className) e.className = className; return e;};

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(STORE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('state');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
function dbGet(key) {return new Promise((resolve, reject) => {const r = db.transaction('state').objectStore('state').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);});}
function dbPut(key, value) {return new Promise((resolve, reject) => {const tx = db.transaction('state', 'readwrite'); tx.objectStore('state').put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);});}
function saveStatus(text) { $('save-status').textContent = text; }
function persist(immediate = false) {
  clearTimeout(saveTimer);
  saveStatus('저장 중');
  const run = () => {
    const snapshot = clone({...data, draft});
    saving = saving.catch(() => {}).then(async () => {
      try { await dbPut('review', snapshot); storageError = false; saveStatus(apiAvailable ? (pendingNotes.size || Object.keys(pendingCharacters).length || Object.keys(pendingEmployees).length ? '브라우저 저장 완료 · Mac 동기화 중' : 'Mac 저장 연결됨 · 브라우저 저장 완료') : '이 브라우저에 저장 완료'); }
      catch (e) { storageError = true; saveStatus('브라우저 저장 실패 · 검토 파일을 내보내 주세요'); }
      if (apiAvailable) scheduleSync();
    });
    return saving;
  };
  if (immediate) return run();
  saveTimer = setTimeout(run, 250);
}
function queueNote(note) {pendingNotes.set(note.id, clone(note)); persist();}
function scheduleSync() {clearTimeout(syncTimer); syncTimer = setTimeout(sync, 500);}
async function sync() {
  if (!apiAvailable || (!pendingNotes.size && !Object.keys(pendingCharacters).length && !Object.keys(pendingEmployees).length)) return;
  const batch = [...pendingNotes.values()].slice(0, 4);
  const characters = clone(pendingCharacters), employeeSelections = clone(pendingEmployees);
  try {
    const r = await apiFetch('/api/review', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({schema:1, clientId, notes:batch, characters, employeeSelections}), signal:AbortSignal.timeout(12000)});
    if (!r.ok) throw new Error('sync');
    for (const n of batch) if (JSON.stringify(pendingNotes.get(n.id)) === JSON.stringify(n)) pendingNotes.delete(n.id);
    for (const [k,v] of Object.entries(characters)) if (JSON.stringify(pendingCharacters[k]) === JSON.stringify(v)) delete pendingCharacters[k];
    for (const [k,v] of Object.entries(employeeSelections)) if (JSON.stringify(pendingEmployees[k]) === JSON.stringify(v)) delete pendingEmployees[k];
    saveStatus(storageError ? 'Mac에 저장 완료 · 브라우저 저장은 실패' : '브라우저와 Mac에 저장 완료');
    if (pendingNotes.size) scheduleSync();
  } catch (e) {saveStatus(storageError ? '저장 실패 · 검토 파일을 내보내 주세요' : '브라우저 저장 완료 · Mac 동기화 재시도 대기'); clearTimeout(syncTimer); syncTimer = setTimeout(sync, 15000);}
}
function validateRecord(n) {
  return n && typeof n.id === 'string' && n.id.length < 100 && byId.has(n.characterId) && typeof n.text === 'string' && n.text.length <= 5000 && typeof n.updatedAt === 'string' && typeof n.createdAt === 'string' && ['open','resolved'].includes(n.status) && typeof n.modelSha === 'string' && /^[a-f0-9]{64}$/.test(n.modelSha) && typeof n.image === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(n.image) && n.image.length < 2000000 && Number.isInteger(n.imageWidth) && n.imageWidth > 0 && n.imageWidth <= 2560 && Number.isInteger(n.imageHeight) && n.imageHeight > 0 && n.imageHeight <= 2560 && (n.pin == null || (Number.isFinite(n.pin.x) && Number.isFinite(n.pin.y) && n.pin.x >= 0 && n.pin.x <= 1 && n.pin.y >= 0 && n.pin.y <= 1));
}
function validSelection(team, s) {
  if (!s || typeof s.note !== 'string' || s.note.length > 2000 || typeof s.updatedAt !== 'string') return false;
  return ['male','female'].every(g => {const c = byId.get(s[g]); return c && c.team_code === team && c.gender === g;});
}
function mergeIncoming(incoming, imported = false) {
  if (incoming?.schema !== 1 || !Array.isArray(incoming.notes)) throw new Error('지원하지 않는 검토 파일입니다.');
  if (incoming.notes.length > 2000) throw new Error('의견이 너무 많은 파일입니다.');
  let count = 0;
  for (const value of incoming.notes) {
    if (!validateRecord(value)) throw new Error('검토 의견 형식이나 사진이 올바르지 않습니다.');
  }
  for (const value of incoming.notes) {
    let n = clone(value); const existing = data.notes.find(x => x.id === n.id);
    if (existing) {
      if (JSON.stringify(existing) === JSON.stringify(n)) continue;
      if (!imported) { if (existing.updatedAt >= n.updatedAt) continue; Object.assign(existing, n); count++; continue; }
      // Import preserves the current record. Conflicting versions become a separate opinion.
      if (n.deleted) continue;
      n.sourceId = n.id; n.id = crypto.randomUUID(); n.updatedAt = now(); n.clientId = clientId;
    }
    data.notes.push(n); if (imported) pendingNotes.set(n.id, clone(n)); count++;
  }
  for (const [id,s] of Object.entries(incoming.characters || {})) {
    if (!byId.has(id) || typeof s.reviewed !== 'boolean' || typeof s.updatedAt !== 'string') continue;
    if (!data.characters[id] || (!imported && s.updatedAt > data.characters[id].updatedAt)) data.characters[id] = clone(s);
    if (imported && data.characters[id]) pendingCharacters[id] = clone(data.characters[id]);
  }
  for (const [team,s] of Object.entries(incoming.employeeSelections || {})) {
    if (!validSelection(team,s)) continue;
    if (!data.employeeSelections[team] || (!imported && s.updatedAt > data.employeeSelections[team].updatedAt)) data.employeeSelections[team] = clone(s);
    else if (imported && JSON.stringify(data.employeeSelections[team]) !== JSON.stringify(s)) {
      data.employeeSelectionAlternatives ||= [];
      data.employeeSelectionAlternatives.push({team, ...clone(s), importedAt:now()});
    }
    if (imported) pendingEmployees[team] = clone(data.employeeSelections[team]);
  }
  return count;
}
function refreshProgress() {
  const completed = roster.filter(c => data.characters[c.character_id]?.reviewed).length;
  $('progress').textContent = `${completed} / ${roster.length}명 검토 완료 · 수정 의견 ${data.notes.filter(n => !n.deleted).length}개`;
}
function renderRoster() {
  const q = $('search').value.trim().toLowerCase(), team = $('team-filter').value, st = $('status-filter').value;
  const list = $('character-list'); list.replaceChildren();
  const rows = roster.filter(c => (!team || c.team_code === team) && (!q || `${c.character_id} ${c.display_name}`.toLowerCase().includes(q)) && (!st || (st === 'reviewed' ? data.characters[c.character_id]?.reviewed : st === 'notes' ? activeNotes(c.character_id).length : !data.characters[c.character_id]?.reviewed && !activeNotes(c.character_id).length)));
  for (const c of rows) {
    const b = make('button', null, 'character-row' + (selected?.character_id === c.character_id ? ' active' : ''));
    b.type='button'; b.dataset.id=c.character_id; b.setAttribute('aria-pressed', String(selected?.character_id === c.character_id));
    b.append(make('span',c.character_id.replace('acnh_',''),'num'));
    const body=make('span'); body.append(make('strong',c.display_name),make('small',c.team_name),make('small',statusText(c),'badge')); b.append(body); b.onclick=() => selectCharacter(c.character_id); list.append(b);
  }
  if (!rows.length) list.append(make('p','조건에 맞는 캐릭터가 없어요.','empty'));
  refreshProgress();
}
function renderNotes() {
  if (!selected) return;
  const notes=activeNotes(selected.character_id); $('note-count').textContent=`${notes.length}개`;
  $('notes-list').replaceChildren();
  for (const [i,n] of notes.entries()) {
    const b=make('button',null,'note-row'+(snapshotNote?.id===n.id?' active':'')); b.type='button'; b.dataset.noteId=n.id;
    const im=make('img'); im.src=n.image; im.alt=`${i+1}번 의견의 캐릭터 화면`;
    const body=make('span'); body.append(make('strong',n.text || '위치 표시만 저장됨'),make('small',`${i+1} · ${n.status==='resolved'?'수정 확인 완료':'수정 요청'}${n.modelSha!==modelSha?' · 이전 파일':''}`)); b.append(im,body); b.onclick=() => editNote(n); $('notes-list').append(b);
  }
  if(!notes.length) $('notes-list').append(make('p','고칠 곳을 찾으면 화면에 위치를 표시하고 의견을 적어 주세요.','empty'));
  $('reviewed').checked=!!data.characters[selected.character_id]?.reviewed;
}
function renderEmployee() {
  if(!selected)return;
  const team=selected.team_code,s=data.employeeSelections[team];
  for(const g of ['male','female']){
    const el=$('employee-'+g);el.replaceChildren();
    for(const c of roster.filter(c=>c.team_code===team&&c.gender===g)) {
      const o=make('option',`${c.character_id.replace('acnh_','')} · ${c.display_name}${c.seat_id==='staff_'+g[0]?' (현재 사원)':''}`);o.value=c.character_id;el.append(o);
    }
    el.value=s?.[g] || roster.find(c=>c.team_code===team&&c.seat_id==='staff_'+g[0]).character_id;
  }
  $('employee-note').value=s?.note || '';
}
function saveEmployee() {
  clearTimeout(employeeTimer); employeeTimer=null; if(!selected)return;
  const team=selected.team_code,s={male:$('employee-male').value,female:$('employee-female').value,note:$('employee-note').value,updatedAt:now(),clientId};
  if(!validSelection(team,s))return;
  data.employeeSelections[team]=s;pendingEmployees[team]=clone(s);persist();
}

const stage=$('stage'), renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
stage.prepend(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xe8edef);
const env=new THREE.PMREMGenerator(renderer), room=new RoomEnvironment();scene.environment=env.fromScene(room,.04).texture;room.dispose();env.dispose();
scene.add(new THREE.HemisphereLight(0xffffff,0x88999a,2.0));
const key=new THREE.DirectionalLight(0xffffff,2.4);key.position.set(3,5,4);scene.add(key);
const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(-3,2,-3);scene.add(fill);
const camera=new THREE.PerspectiveCamera(35,1,.01,100);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=.15;controls.maxDistance=15;controls.enablePan=true;controls.target.set(0,.8,0);
const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
let center=new THREE.Vector3(), height=1.6, fitDistance=3;
const clipLabels={idle:'서 있기',idle_breath:'자연스럽게 서 있기',walk:'걷기',jog:'달리기',sit:'앉기',sit_down:'의자에 앉기',stand_up:'일어서기',type2:'앉아서 타자',chat:'대화'};
function disposeActor(a) {
  if(!a)return;a.mixer.stopAllAction();a.mixer.uncacheRoot(a.gltf.scene);scene.remove(a.root);
  const geometries=new Set(),materials=new Set(),textures=new Set();
  a.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material])) if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}if(o.isSkinnedMesh)o.skeleton?.dispose();});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.renderLists.dispose();
}
function setView(view) {
  if(!actor||snapshotNote)return;
  const target=center.clone(),distance=view==='face'?height*.72:fitDistance;
  if(view==='face') target.y=height*.83;
  controls.target.copy(target);const angles={front:0,left:-Math.PI/2,right:Math.PI/2,back:Math.PI,face:0};const ang=angles[view]||0;
  camera.position.set(target.x+Math.sin(ang)*distance,target.y+height*.07,target.z+Math.cos(ang)*distance);controls.update();
}
function playClip(name) {
  if(!actor)return;actor.mixer.stopAllAction();
  const clip=actor.gltf.animations.find(c=>c.name===name);if(!clip)return;
  currentClip=name;currentAction=actor.mixer.clipAction(clip);currentAction.reset().play();currentAction.paused=paused;
}
async function selectCharacter(id) {
  commitEditor();saveEmployeePending();await persist(true);
  selected=byId.get(id);localStorage.setItem(STORE+'-selected',id);loadGeneration++;const generation=loadGeneration;
  activeFetch?.abort();activeFetch=new AbortController();disposeActor(actor);actor=null;modelSha='';draft=null;resumeViewer();
  $('character-team').textContent=selected.team_name;$('character-name').textContent=selected.display_name;$('character-number').textContent=selected.character_id.replace('acnh_','#');
  $('stage-loading').hidden=false;$('stage-loading').textContent='캐릭터를 불러오는 중';$('capture').disabled=true;$('motion').disabled=true;
  renderRoster();renderNotes();renderEmployee();
  try {
    const r=await fetch(selected.model_url,{signal:activeFetch.signal});if(!r.ok)throw new Error('캐릭터 파일을 불러오지 못했어요.');
    const bytes=await r.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',bytes);
    const sha=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const gltf=await loader.parseAsync(bytes,new URL('assets/native_staff50/characters/',location.href).href);
    const root=new THREE.Group();root.add(gltf.scene);const mixer=new THREE.AnimationMixer(gltf.scene);const faceMeshes=[];
    gltf.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;if(o.morphTargetDictionary)faceMeshes.push(o);}});
    const bones={};root.traverse(o=>{if(o.isBone)bones[o.name]=o;});
    const runPosture=createRunPosture(THREE,{model:root,bones,mixer,animations:gltf.animations});
    const a={root,gltf,mixer,runPosture,fx:createTalkFace(faceMeshes,gltf.animations,{seed:parseInt(id.replace(/\D/g,''),10)}),sha};
    if(generation!==loadGeneration){disposeActor(a);return;}
    actor=a;scene.add(root);modelSha=sha;
    const bounds=new THREE.Box3().setFromObject(root);height=bounds.max.y-bounds.min.y;const mid=bounds.getCenter(new THREE.Vector3());root.position.set(-mid.x,-bounds.min.y,-mid.z);
    center.set(0,height*.49,0);fitDistance=height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)))*1.17;
    const opts=$('motion');opts.replaceChildren();for(const c of gltf.animations){const o=make('option',clipLabels[c.name]||c.name);o.value=c.name;opts.append(o);}
    opts.value=gltf.animations.some(c=>c.name==='idle_breath')?'idle_breath':'idle';paused=false;$('pause').textContent='동작 멈춤';playClip(opts.value);$('expression').value='neutral';setView('front');
    $('stage-loading').hidden=true;$('capture').disabled=false;opts.disabled=false;renderNotes();
    if(data.draft?.characterId===id&&validateRecord(data.draft)){draft=clone(data.draft);editNote(draft,true);delete data.draft;}
  } catch(e) {if(e.name==='AbortError'||generation!==loadGeneration)return;$('stage-loading').textContent=`${e.message} 잠시 뒤 이 캐릭터를 다시 선택해 주세요.`;}
}
const resize=()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();placePin();};new ResizeObserver(resize).observe(stage);resize();
let prev=performance.now();renderer.setAnimationLoop(t=>{const dt=Math.min((t-prev)/1000,.05);prev=t;if(actor&&!snapshotNote){actor.runPosture?.restore();if(!paused)actor.mixer.update(dt);actor.runPosture?.update();actor.fx?.update(dt,false,currentClip);}controls.update();renderer.render(scene,camera);});

function captureView() {
  commitEditor();if(!actor)return;
  renderer.render(scene,camera);
  const out=document.createElement('canvas'),max=1280,scale=Math.min(1,max/renderer.domElement.width,max/renderer.domElement.height);out.width=Math.round(renderer.domElement.width*scale);out.height=Math.round(renderer.domElement.height*scale);out.getContext('2d').drawImage(renderer.domElement,0,0,out.width,out.height);
  draft={id:crypto.randomUUID(),characterId:selected.character_id,modelSha,modelUrl:selected.model_url,displayName:selected.display_name,teamCode:selected.team_code,image:out.toDataURL('image/jpeg',.86),imageWidth:out.width,imageHeight:out.height,pin:null,text:'',status:'open',createdAt:now(),updatedAt:now(),clientId,view:{camera:camera.position.toArray(),target:controls.target.toArray(),clip:currentClip,time:currentAction?.time||0,expression:$('expression').value}};
  editNote(draft,true);persist();$('note-text').focus({preventScroll:true});
}
function editNote(note,isDraft=false) {
  commitEditor();snapshotNote=note;draft=isDraft?note:null;noteDirty=false;
  $('snapshot-image').src=note.image;$('snapshot').hidden=false;$('resume').hidden=false;$('capture').hidden=true;controls.enabled=false;$('editor').hidden=false;
  $('note-text').value=note.text;$('note-status').value=note.status;
  $('pin-help').textContent=note.pin?'표시 위치와 의견을 수정할 수 있어요.':'사진에서 고칠 곳을 누른 뒤 의견을 적어 주세요.';
  $('view-help').textContent='사진을 누르면 수정 위치가 표시됩니다.';placePin();renderNotes();
}
function snapshotRect() {
  const r=$('snapshot').getBoundingClientRect(),n=snapshotNote;if(!n)return null;
  const scale=Math.min(r.width/n.imageWidth,r.height/n.imageHeight),w=n.imageWidth*scale,h=n.imageHeight*scale;
  return {x:(r.width-w)/2,y:(r.height-h)/2,width:w,height:h,left:r.left,top:r.top};
}
function placePin() {
  const p=snapshotNote?.pin,r=snapshotRect();$('pin').hidden=!p;if(!p||!r)return;
  $('pin').style.left=`${r.x+p.x*r.width}px`;$('pin').style.top=`${r.y+p.y*r.height}px`;
  const i=activeNotes(selected.character_id).findIndex(n=>n.id===snapshotNote.id);$('pin').textContent=String(i<0?activeNotes(selected.character_id).length+1:i+1);
}
let pinPointer=null;
$('snapshot').addEventListener('pointerdown',e=>{pinPointer={id:e.pointerId,x:e.clientX,y:e.clientY};});
$('snapshot').addEventListener('pointercancel',()=>{pinPointer=null;});
$('snapshot').addEventListener('pointerup',e=>{const start=pinPointer;pinPointer=null;if(!start||start.id!==e.pointerId||Math.hypot(e.clientX-start.x,e.clientY-start.y)>12||!snapshotNote)return;const r=snapshotRect(),x=(e.clientX-r.left-r.x)/r.width,y=(e.clientY-r.top-r.y)/r.height;if(x<0||y<0||x>1||y>1)return;snapshotNote.pin={x,y};noteDirty=true;commitEditor();placePin();$('pin-help').textContent='표시 위치와 의견이 자동 저장됩니다.';});
function commitEditor() {
  clearTimeout(editorTimer);if(!snapshotNote)return;
  if(!draft&&!noteDirty&&snapshotNote.text===$('note-text').value&&snapshotNote.status===$('note-status').value)return;
  snapshotNote.text=$('note-text').value;snapshotNote.status=$('note-status').value;snapshotNote.updatedAt=now();
  if(draft&&!snapshotNote.text.trim()&&!snapshotNote.pin){persist();return;}
  const found=data.notes.find(n=>n.id===snapshotNote.id);if(!found)data.notes.push(snapshotNote);else Object.assign(found,snapshotNote);
  draft=null;noteDirty=false;queueNote(snapshotNote);renderRoster();renderNotes();placePin();
}
function resumeViewer() {
  commitEditor();snapshotNote=null;draft=null;$('snapshot').hidden=true;$('editor').hidden=true;$('resume').hidden=true;$('capture').hidden=false;controls.enabled=true;
  $('view-help').textContent='드래그로 회전 · 휠 또는 두 손가락으로 확대';if(selected)renderNotes();
}
function saveEmployeePending(){if(employeeTimer){clearTimeout(employeeTimer);employeeTimer=null;saveEmployee();}}
$('note-text').addEventListener('input',()=>{clearTimeout(editorTimer);editorTimer=setTimeout(commitEditor,450);});
$('note-status').onchange=commitEditor;
$('delete-note').onclick=()=>{if(!snapshotNote)return;const n=data.notes.find(n=>n.id===snapshotNote.id);if(n){n.deleted=true;n.updatedAt=now();queueNote(n);}draft=null;resumeViewer();renderRoster();persist();notice('의견을 삭제했어요.');};
$('capture').onclick=captureView;$('resume').onclick=()=>{resumeViewer();persist();};
$('reviewed').onchange=()=>{data.characters[selected.character_id]={reviewed:$('reviewed').checked,updatedAt:now(),clientId};pendingCharacters[selected.character_id]=clone(data.characters[selected.character_id]);persist();renderRoster();};
$('motion').onchange=()=>playClip($('motion').value);
$('expression').onchange=()=>actor?.fx?.setMood($('expression').value,1,600000);
$('talk').onclick=()=>actor?.fx?.say({text:'캐릭터 수정 의견을 편하게 적어 주세요. 감사합니다.',ms:4000,mood:$('expression').value,src:'say'});
$('pause').onclick=()=>{paused=!paused;if(currentAction)currentAction.paused=paused;$('pause').textContent=paused?'동작 재생':'동작 멈춤';};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));$('fit').onclick=()=>setView('front');
for(const id of ['search','team-filter','status-filter'])$(id).addEventListener(id==='search'?'input':'change',renderRoster);
for(const id of ['employee-male','employee-female'])$(id).onchange=saveEmployee;
$('employee-note').oninput=()=>{clearTimeout(employeeTimer);employeeTimer=setTimeout(saveEmployee,450);};
$('export').onclick=async()=>{commitEditor();saveEmployeePending();await persist(true);const out=clone(data);delete out.draft;out.exportedAt=now();const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=`worksim-character-review-${now().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);notice('사진과 수정 의견을 함께 내보냈어요.');};
$('import').onclick=()=>$('import-file').click();
$('import-file').onchange=async()=>{const f=$('import-file').files[0];if(!f)return;try{if(f.size>100*1024*1024)throw new Error('100 MB 이하 파일을 선택해 주세요.');commitEditor();const incoming=JSON.parse(await f.text()),count=mergeIncoming(incoming,true);await persist(true);renderRoster();renderNotes();renderEmployee();notice(`${count}개 의견을 추가했어요. 기존 의견은 보존했습니다.`);}catch(e){notice(e.message||'검토 파일을 읽지 못했어요.');}finally{$('import-file').value='';}};
window.addEventListener('pagehide',()=>{commitEditor();saveEmployeePending();persist(true);if(apiAvailable&&pendingNotes.size){const batch=[...pendingNotes.values()].slice(0,4),body=JSON.stringify({schema:1,clientId,notes:batch,characters:pendingCharacters,employeeSelections:pendingEmployees});if(new Blob([body]).size<60000)apiFetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});}});
window.addEventListener('online',()=>{if(apiAvailable)sync();});
for(const [team,name] of new Map(roster.map(c=>[c.team_code,c.team_name]))) {const o=make('option',name);o.value=team;$('team-filter').append(o);}
try {
  db=await openDb();const stored=await dbGet('review');if(stored){data={...data,...stored,clientId};draft=stored.draft;data.draft=draft;}
  if(apiRequested){try{const r=await apiFetch('/api/review',{signal:AbortSignal.timeout(6000)});if(r.ok){const remote=await r.json();mergeIncoming(remote);apiAvailable=true;for(const n of data.notes)pendingNotes.set(n.id,clone(n));pendingCharacters=clone(data.characters);pendingEmployees=clone(data.employeeSelections);$('storage-help').textContent='이 브라우저와 Mac의 검토 파일에 자동 저장됩니다. 다른 기기로 옮길 때는 검토 파일을 내보내 주세요.';}else if(r.status===401){notice('Mac 저장 연결 권한이 없어요. 전달받은 전용 검토 링크로 다시 열어 주세요.');}}catch(e){notice('Mac 저장 연결을 확인하지 못했어요. 이 브라우저에 저장하며 파일로 내보낼 수 있습니다.');}}
  saveStatus(apiAvailable?'브라우저와 Mac 자동 저장 준비됨':'이 브라우저에 자동 저장');
  await selectCharacter(byId.has(data.draft?.characterId)?data.draft.characterId:byId.has(localStorage.getItem(STORE+'-selected'))?localStorage.getItem(STORE+'-selected'):roster[0].character_id);if(apiAvailable)scheduleSync();
} catch(e){saveStatus('브라우저 저장을 사용할 수 없어요 · 파일 내보내기로 보관해 주세요');storageError=true;await selectCharacter(roster[0].character_id);}
// Read-only diagnostics used to verify the real controls without exposing game/private data.
window.CharacterReview=Object.freeze({get state(){return {selected:selected?.character_id,modelSha,loaded:!!actor,count:roster.length,notes:data.notes.filter(n=>!n.deleted).length,snapshot:snapshotNote?.id,apiAvailable,geometryCount:renderer.info.memory.geometries,runPosture:actor?.runPosture?.state||null,employeeSelections:clone(data.employeeSelections)};}});
