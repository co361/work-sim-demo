import assert from 'node:assert/strict';
import test from 'node:test';
import {createRunPosture} from '../js/office-run-posture.js';
const T=await import(process.env.WORKSIM_THREE_MODULE||'three');

function fixture(id){
 const model=new T.Group(),bones={};model.name=`acnh_${id}-resident-root`;
 const bone=(name,parent,p)=>{const b=new T.Bone();b.name=name;b.position.fromArray(p);parent.add(b);bones[name]=b;return b;};
 const hips=bone('Hips',model,[0,.4,0]),spine=bone('Spine',hips,[0,.07,0]),chest=bone('Chest',spine,[0,.05,0]);bone('Head',chest,[0,.16,0]);
 for(const [side,sign] of [['L',-1],['R',1]]){const upper=bone('UpperArm_'+side,chest,[sign*.085,-.01,.01]),fore=bone('Forearm_'+side,upper,[sign*.007,-.117,.01]);bone('Hand_'+side,fore,[sign*.002,-.077,.02]);}
 const animations=['idle','idle_breath','walk','jog','sit'].map(name=>new T.AnimationClip(name,1,Object.values(bones).map(b=>new T.QuaternionKeyframeTrack(b.name+'.quaternion',[0,1],[0,0,0,1,0,0,0,1]))));
 const mixer=new T.AnimationMixer(model),posture=createRunPosture(T,{model,bones,mixer,animations});
 const pose=name=>{posture.restore();mixer.stopAllAction();mixer.clipAction(animations.find(c=>c.name===name)).play();mixer.update(.25);model.updateMatrixWorld(true);};
 const state=()=>Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.toArray(),q:b.quaternion.toArray(),s:b.scale.toArray(),world:b.getWorldPosition(new T.Vector3()).toArray()}]));
 return{model,bones,mixer,posture,pose,state};
}
test('only the long-jacket actor receives a walking and breathing palm clearance',()=>{
 for(const id of [18,19,20,45,65])for(const clip of ['idle','idle_breath','walk','sit']){
  const f=fixture(id);f.pose(clip);const before=f.state();f.posture.update();f.model.updateMatrixWorld(true);const after=f.state();
  if(id!==19||['idle','sit'].includes(clip)){assert.deepEqual(after,before);continue;}
  for(const side of ['L','R']){
   const names=['UpperArm_'+side,'Forearm_'+side,'Hand_'+side];
   assert(Math.abs(after[names[2]].world[0])>=.136-1e-7);
   for(let i=0;i<2;i++){const length=s=>Math.hypot(...s[names[i]].world.map((v,k)=>v-s[names[i+1]].world[k]));assert(Math.abs(length(before)-length(after))<1e-7);}
  }
  for(const n of Object.keys(before)){assert.deepEqual(after[n].p,before[n].p);assert.deepEqual(after[n].s,before[n].s);}
  for(const n of ['Hips','Spine','Chest','Head'])assert.deepEqual(after[n],before[n]);
  f.posture.restore();f.model.updateMatrixWorld(true);assert.deepEqual(f.state(),before);
 }
});
