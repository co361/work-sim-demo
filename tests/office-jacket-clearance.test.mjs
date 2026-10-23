import assert from 'node:assert/strict';
import test from 'node:test';
const {createRunPosture}=await import(process.env.WORKSIM_RUN_POSTURE_MODULE||'../js/office-run-posture.js');
const T=await import(process.env.WORKSIM_THREE_MODULE||'three');

function fixture(id){
 const model=new T.Group(),bones={};model.name=`acnh_${id}-resident-root`;
 const bone=(name,parent,p)=>{const b=new T.Bone();b.name=name;b.position.fromArray(p);parent.add(b);bones[name]=b;return b;};
 const hips=bone('Hips',model,[0,.4,0]),spine=bone('Spine',hips,[0,.07,0]),chest=bone('Chest',spine,[0,.05,0]);bone('Head',chest,[0,.16,0]);
 for(const [side,sign] of [['L',-1],['R',1]]){const upper=bone('UpperArm_'+side,chest,[sign*.085,-.01,.01]),fore=bone('Forearm_'+side,upper,[sign*.007,-.117,.01]);bone('Hand_'+side,fore,[sign*.002,-.077,.02]);}
 const names=['idle','idle_breath','walk','jog','sit','sit_down','stand_up','type2'];
 const animations=names.map(name=>new T.AnimationClip(name,1,Object.values(bones).map(b=>{
  // A bent authored jog is needed to exercise the real run blend envelope.
  const q=name==='jog'&&b.name.startsWith('Forearm')?new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2).toArray():[0,0,0,1];
  return new T.QuaternionKeyframeTrack(b.name+'.quaternion',[0,1],[...q,...q]);
 })));
 const mixer=new T.AnimationMixer(model),posture=createRunPosture(T,{model,bones,mixer,animations});
 const pose=name=>{posture.restore();mixer.stopAllAction();mixer.clipAction(animations.find(c=>c.name===name)).reset().play();mixer.update(.25);model.updateMatrixWorld(true);};
 const state=()=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.toArray(),q:b.quaternion.toArray(),s:b.scale.toArray(),world:b.getWorldPosition(new T.Vector3()).toArray()}]));
 return{model,bones,mixer,posture,pose,state};
}
const skirts=[17,21,22,30,32,33,34,35,38,40,42,44,46,52,54,56,58,60,62,64,68,70,20,66];
const shirts=[18,23,24,26,29,36,37,45,47,48,53,55,57,65];
const unchanged=[27,28,31,39,43,59,61,63,67,69];
const all=[19,...skirts,...shirts,41,...unchanged];
function structuralChecks(before,after){
 for(const side of ['L','R']){const names=['UpperArm_'+side,'Forearm_'+side,'Hand_'+side];for(let i=0;i<2;i++){const length=s=>Math.hypot(...s[names[i]].world.map((v,k)=>v-s[names[i+1]].world[k]));assert(Math.abs(length(before)-length(after))<1e-7);}}
 for(const n of Object.keys(before)){assert.deepEqual(after[n].p,before[n].p);assert.deepEqual(after[n].s,before[n].s);assert(after[n].world.every(Number.isFinite));}
 for(const n of ['Hips','Spine','Chest','Head'])assert.deepEqual(after[n],before[n]);
}
test('reviewed walking and breathing hand paths preserve limb lengths and restore',()=>{
 assert.equal(new Set(all).size,50);
 for(const id of all)for(const clip of ['walk','idle_breath']){
  const f=fixture(id);f.pose(clip);const before=f.state();f.posture.update();f.model.updateMatrixWorld(true);const after=f.state();
  if(unchanged.includes(id)||(id===41&&clip==='walk')){assert.deepEqual(after,before);continue;}
  const minimum=id===19?.136:skirts.includes(id)?(clip==='walk'?.142:.129):(clip==='walk'?.132:.130);
  for(const side of ['L','R'])assert(Math.abs(after['Hand_'+side].world[0])>=minimum-1e-7,`#${id} ${clip} ${side}`);
  structuralChecks(before,after);f.posture.restore();f.model.updateMatrixWorld(true);assert.deepEqual(f.state(),before);
 }
});
test('ordinary idle, seated and interaction poses remain unchanged for all 50 actors',()=>{
 for(const id of all)for(const clip of ['idle','sit','sit_down','stand_up','type2']){const f=fixture(id);f.pose(clip);const before=f.state();f.posture.update();f.model.updateMatrixWorld(true);assert.deepEqual(f.state(),before,`#${id} ${clip}`);}
});
test('jog clearance uses the authored run envelope, keeps fixed limbs, and restores',()=>{
 for(const id of [19,...skirts,...shirts,41]){const f=fixture(id);f.pose('jog');const before=f.state();f.posture.update();f.model.updateMatrixWorld(true);const after=f.state();assert(f.posture.state.armWeight>.99);const minimum=id===19?.136:skirts.includes(id)?.129:.136;for(const side of ['L','R'])assert(Math.abs(after['Hand_'+side].world[0])>=minimum-1e-7,`#${id} jog ${side}`);structuralChecks(before,after);f.posture.restore();f.model.updateMatrixWorld(true);assert.deepEqual(f.state(),before);}
});
