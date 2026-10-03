/* Native staff50: reduce the authored jog's waist fold without moving the legs.
   Call restore() before the AnimationMixer, and update() after pose blending.
   Source meshes, clips and bone lengths remain unchanged. */
export function createRunPosture(THREE,{model,bones,mixer,animations}) {
 const hips=bones.Hips, spine=bones.Spine, chest=bones.Chest, head=bones.Head;
 const clips=animations.filter(c=>/^(jog(?:_start|_stop_[LR])?|walk_to_jog_[LR]|jog_to_walk_[LR])$/.test(c.name));
 if(!hips||!spine||!chest||!head||!clips.length)return null;
 const undo=new Map(),refs={},saved=new Map(),byName=new Map(Object.values(bones).map(b=>[b.name,b]));
 const v=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),local=new THREE.Vector3();
 const q=new THREE.Quaternion(),pq=new THREE.Quaternion(),wq=new THREE.Quaternion(),turn=new THREE.Quaternion(),headQ=new THREE.Quaternion();
 const idle=animations.find(c=>c.name==='idle');
 for(const b of Object.values(bones))saved.set(b,b.quaternion.clone());
 if(idle)for(const tr of idle.tracks){const m=/^(.+)\.quaternion$/.exec(tr.name),b=m&&byName.get(m[1]);if(b&&tr.values.length>=4)b.quaternion.fromArray(tr.values,0);}
 model.updateMatrixWorld(true);
 for(const [name,b] of [['hips',hips],['chest',chest]]){b.getWorldQuaternion(q);refs[name]=new THREE.Vector3(0,1,0).applyQuaternion(q.invert());}
 for(const [b,original]of saved)b.quaternion.copy(original);
 model.updateMatrixWorld(true);
 const remember=b=>{if(!undo.has(b))undo.set(b,{pre:b.quaternion.clone(),post:null});};
 const rotate=(b,delta)=>{if(Math.abs(delta)<1e-9)return;remember(b);b.parent.getWorldQuaternion(pq);b.getWorldQuaternion(wq);turn.setFromAxisAngle(right,delta);wq.premultiply(turn);b.quaternion.copy(pq.invert().multiply(wq));b.updateMatrixWorld(true);};
 const pitch=(b,ref)=>{b.getWorldQuaternion(q);v.copy(ref).applyQuaternion(q);return Math.atan2(v.dot(forward),v.y);};
 const info={active:false,weight:0,pelvisPitch:0,chestPitch:0,correction:0};
 return {
  restore(){for(const [b,u]of undo){const p=u.post;if(p&&Math.max(Math.abs(b.quaternion.x-p.x),Math.abs(b.quaternion.y-p.y),Math.abs(b.quaternion.z-p.z),Math.abs(b.quaternion.w-p.w))<1e-7)b.quaternion.copy(u.pre);}undo.clear();},
  update(){
   let weight=0;for(const clip of clips){const a=mixer.existingAction(clip);if(a&&a.enabled&&a.isScheduled())weight+=a.getEffectiveWeight();}
   weight=Math.max(0,Math.min(1,weight));info.active=weight>1e-4;info.weight=weight;info.correction=0;if(!info.active)return info;
   model.updateMatrixWorld(true);model.getWorldQuaternion(q);forward.set(0,0,1).applyQuaternion(q);forward.y=0;forward.normalize();right.set(forward.z,0,-forward.x);
   const hp=pitch(hips,refs.hips),cp=pitch(chest,refs.chest),maxForward=10*Math.PI/180,maxBend=10*Math.PI/180;
   const delta=Math.max(0,cp-Math.min(maxForward,hp+maxBend))*weight;
   info.pelvisPitch=hp;info.chestPitch=cp;info.correction=delta;if(delta<1e-6)return info;
   head.getWorldQuaternion(headQ);
   // World-space pitch around the character's right axis; do not use local Euler axes.
   rotate(spine,-delta*.4);rotate(chest,-delta*.6);
   remember(head);head.parent.getWorldQuaternion(pq);head.quaternion.copy(pq.invert().multiply(headQ));head.updateMatrixWorld(true);
   for(const [b,u]of undo)u.post=b.quaternion.clone();
   return info;
  },
  get state(){return {...info};}
 };
}
