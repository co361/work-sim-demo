/* Shared native-staff run correction. The keyed clips already contain the
   correct footfall/root timing, but their upper body is a forward-biased jog:
   deep waist lean, both wrists in front, and inward-turned forearms.
   Read the authored arm phase in the idle chest frame, then rotate the fixed
   length arm chains through a relaxed reciprocal pump. No wall-clock phase,
   hip/leg edits, bone translations, mesh edits, or asset resampling.
   Call restore() before the mixer and update() after pose blending. */
export function createRunPosture(T,{model,bones,mixer,animations}) {
 const hips=bones.Hips,spine=bones.Spine,chest=bones.Chest,head=bones.Head;
 const clips=animations.filter(c=>/^(jog(?:_start|_stop_[LR])?|walk_to_jog_[LR]|jog_to_walk_[LR])$/.test(c.name));
 const jog=animations.find(c=>c.name==='jog'),idle=animations.find(c=>c.name==='idle');
 if(!hips||!spine||!chest||!head||!jog||!idle)return null;
 const arms=['L','R'].map(side=>({side,upper:bones['UpperArm_'+side],fore:bones['Forearm_'+side],hand:bones['Hand_'+side],min:Infinity,max:-Infinity})).filter(a=>a.upper&&a.fore&&a.hand);
 const rad=Math.PI/180,up=new T.Vector3(0,1,0),forward=new T.Vector3(),right=new T.Vector3(),v=new T.Vector3(),s=new T.Vector3(),e=new T.Vector3(),w=new T.Vector3(),upper=new T.Vector3(),lower=new T.Vector3(),target=new T.Vector3();
 const modelQ=new T.Quaternion(),modelInv=new T.Quaternion(),chestQ=new T.Quaternion(),chestDeltaInv=new T.Quaternion(),q=new T.Quaternion(),pq=new T.Quaternion(),worldQ=new T.Quaternion(),turn=new T.Quaternion(),headQ=new T.Quaternion();
 const saved=Object.values(bones).map(b=>({b,q:b.quaternion.clone(),p:b.position.clone(),s:b.scale.clone()}));
 const tracks=clip=>clip.tracks.flatMap(tr=>{const match=/^(.+)\.(quaternion|position|scale)$/.exec(tr.name),b=match&&bones[match[1]];return b?[{b,key:match[2],i:tr.createInterpolant()}]:[];});
 const sample=(ts,t)=>{for(const x of ts)x.b[x.key].fromArray(x.i.evaluate(t));model.updateMatrixWorld(true);};
 sample(tracks(idle),0);model.getWorldQuaternion(modelQ);modelInv.copy(modelQ).invert();
 const idleChest=chest.getWorldQuaternion(new T.Quaternion()).premultiply(modelInv),idleChestInv=idleChest.clone().invert();
 const chestUp=up.clone().applyQuaternion(chest.getWorldQuaternion(q).invert()),hipsUp=up.clone().applyQuaternion(hips.getWorldQuaternion(q).invert());
 function chestFrame(){model.getWorldQuaternion(modelQ);modelInv.copy(modelQ).invert();chest.getWorldQuaternion(chestQ).premultiply(modelInv);chestDeltaInv.copy(chestQ).multiply(idleChestInv).invert();}
 function armPhase(a){a.upper.getWorldPosition(s);a.fore.getWorldPosition(e);v.subVectors(e,s).applyQuaternion(modelInv).applyQuaternion(chestDeltaInv);return Math.atan2(v.z,-v.y);}
 // Calibrate from this model's own jog (not a particular bind-pose Euler axis).
 // Only transform channels are sampled; garment/morph bindings are untouched.
 let minRunBend=Infinity;
 const jt=tracks(jog);for(let i=0;i<48;i++){
  sample(jt,jog.duration*i/48);chestFrame();let bend=0;
  for(const a of arms){const angle=armPhase(a);a.min=Math.min(a.min,angle);a.max=Math.max(a.max,angle);a.hand.getWorldPosition(w);upper.subVectors(e,s);lower.subVectors(w,e);bend+=upper.angleTo(lower);a.sign=Math.sign(target.copy(s).sub(hips.getWorldPosition(v)).applyQuaternion(modelInv).x)||(a.side==='L'?1:-1);}
  if(arms.length)minRunBend=Math.min(minRunBend,bend/arms.length);
 }
 const bendEnd=Math.max(50*rad,minRunBend-2*rad),bendStart=Math.min(45*rad,bendEnd-5*rad);
 for(const x of saved){x.b.quaternion.copy(x.q);x.b.position.copy(x.p);x.b.scale.copy(x.s);}model.updateMatrixWorld(true);
 const edits=[spine,chest,head,...arms.flatMap(a=>[a.upper,a.fore])].map(b=>({b,pre:new T.Quaternion(),post:new T.Quaternion(),used:false})),byBone=new Map(edits.map(x=>[x.b,x]));
 const remember=b=>{const x=byBone.get(b);if(!x.used){x.pre.copy(b.quaternion);x.used=true;}};
 function rotate(b,delta){if(Math.abs(delta)<1e-9)return;remember(b);b.parent.getWorldQuaternion(pq);b.getWorldQuaternion(worldQ);turn.setFromAxisAngle(right,delta);worldQ.premultiply(turn);b.quaternion.copy(pq.invert().multiply(worldQ)).normalize();b.updateMatrixWorld(true);}
 function aim(b,from,to,weight){if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)return;remember(b);b.parent.getWorldQuaternion(pq);b.getWorldQuaternion(worldQ);turn.setFromUnitVectors(from.normalize(),to.normalize());q.copy(pq).invert().multiply(worldQ.premultiply(turn)).normalize();b.quaternion.slerp(q,weight).normalize();b.updateMatrixWorld(true);}
 function pitch(b,ref){b.getWorldQuaternion(q);v.copy(ref).applyQuaternion(q);return Math.atan2(v.dot(forward),v.y);}
 const info={active:false,weight:0,armWeight:0,pelvisPitch:0,chestPitch:0,correction:0,arms:arms.map(a=>({side:a.side,sourceMin:a.min,sourceMax:a.max,signal:0,upperPitch:0,elbowBend:0}))};
 return {
  restore(){for(const x of edits){if(x.used&&Math.max(Math.abs(x.b.quaternion.x-x.post.x),Math.abs(x.b.quaternion.y-x.post.y),Math.abs(x.b.quaternion.z-x.post.z),Math.abs(x.b.quaternion.w-x.post.w))<1e-7)x.b.quaternion.copy(x.pre);x.used=false;}},
  update(){
   let weight=0;for(const c of clips){const a=mixer.existingAction(c);if(a?.enabled&&a.isScheduled())weight+=a.getEffectiveWeight();}
   weight=T.MathUtils.clamp(weight,0,1);info.active=weight>1e-4;info.weight=weight;info.armWeight=0;info.correction=0;if(!info.active)return info;
   model.updateMatrixWorld(true);chestFrame();forward.set(0,0,1).applyQuaternion(modelQ);forward.y=0;forward.normalize();right.set(forward.z,0,-forward.x);
   let bend=0;
   for(const a of arms){
    a.angle=armPhase(a);a.hand.getWorldPosition(w);upper.subVectors(e,s);lower.subVectors(w,e);bend+=upper.angleTo(lower);
    a.signal=T.MathUtils.clamp(2*(a.angle-a.min)/Math.max(1e-6,a.max-a.min)-1,-1,1);
   }
   // Start/stop and walk/run transitions inherit the baked elbow envelope.
   // This reaches zero at walking/idle endpoints and stays phase-locked even
   // when the simulation is sped up, slowed down, or sampled out of order.
   const armWeight=arms.length?weight*T.MathUtils.smoothstep(bend/arms.length,bendStart,bendEnd):0;info.armWeight=armWeight;
   const hp=pitch(hips,hipsUp),cp=pitch(chest,chestUp),delta=Math.max(0,cp-8*rad)*weight;
   info.pelvisPitch=hp;info.chestPitch=cp;info.correction=delta;head.getWorldQuaternion(headQ);
   // Keep a small whole-body forward inclination, removing the waist fold.
   rotate(spine,-delta*.65);rotate(chest,-delta*.35);
   if(delta>1e-9){remember(head);head.parent.getWorldQuaternion(pq);head.quaternion.copy(pq.invert().multiply(headQ)).normalize();head.updateMatrixWorld(true);}
   for(let i=0;i<arms.length;i++){
    const a=arms[i],swing=(-5+35*a.signal)*rad,out=16*rad,elbow=(78+8*Math.max(0,a.signal))*rad;
    a.upper.getWorldPosition(s);a.fore.getWorldPosition(e);upper.subVectors(e,s);
    target.set(a.sign*Math.sin(out),-Math.cos(swing)*Math.cos(out),Math.sin(swing)*Math.cos(out)).applyQuaternion(modelQ);aim(a.upper,upper,target,armWeight);
    a.fore.getWorldPosition(e);a.hand.getWorldPosition(w);lower.subVectors(w,e);
    // The forearm pumps alongside the torso instead of turning across it.
    target.set(0,-Math.cos(swing+elbow),Math.sin(swing+elbow)).applyQuaternion(modelQ);aim(a.fore,lower,target,armWeight);
    const d=info.arms[i];d.signal=a.signal;d.upperPitch=swing;d.elbowBend=elbow;
   }
   for(const x of edits)if(x.used)x.post.copy(x.b.quaternion);return info;
  },
  get state(){return {...info,arms:info.arms.map(a=>({...a}))};}
 };
}
