import assert from 'node:assert/strict';
import test from 'node:test';
import {createArmPosture} from '../js/office-arm-posture.js';
const T=await import(process.env.WORKSIM_THREE_MODULE||'three');

test('reference arm sampling excludes live garment tracks without changing actor channels or transforms',()=>{
 const model=new T.Group(),bones={};model.name='reference-test';
 for(const side of ['L','R']){
  let parent=model;
  for(const [prefix,x] of [['UpperArm_',.1],['Forearm_',.2],['Hand_',.2]]){
   const bone=new T.Bone();bone.name=prefix+side;bone.position.set(side==='L'?x:-x,.5,0);parent.add(bone);bones[bone.name]=bone;parent=bone;
  }
 }
 const cloth=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());cloth.name='Cloth';cloth.workSimMotionWeights=[0,0];model.add(cloth);
 const transform=new T.VectorKeyframeTrack('UpperArm_L.position',[0,1],[.1,.5,0,.2,.6,0]);
 const corrective=new T.NumberKeyframeTrack('Cloth.workSimMotionWeights',[0,1],[0,1,1,0]);
 const animations=['idle','type2'].map(name=>new T.AnimationClip(name,1,[transform,corrective]));
 model.updateMatrixWorld(true);const before=Object.values(bones).map(b=>b.matrixWorld.toArray());
 const errors=[],old=console.error;console.error=(...args)=>errors.push(args);
 try{createArmPosture(T,{model,bones,mixer:new T.AnimationMixer(model),animations});}finally{console.error=old;}
 assert.deepEqual(errors,[]);assert.deepEqual(cloth.workSimMotionWeights,[0,0]);
 for(const clip of animations){assert.equal(clip.tracks[0],transform);assert.equal(clip.tracks[1],corrective);}
 model.updateMatrixWorld(true);assert.deepEqual(Object.values(bones).map(b=>b.matrixWorld.toArray()),before);
 const mixer=new T.AnimationMixer(model);mixer.clipAction(animations[0]).play();mixer.update(.25);
 assert.deepEqual(cloth.workSimMotionWeights,[.25,.75]);assert(Math.abs(bones.UpperArm_L.position.x-.125)<1e-7);
});
