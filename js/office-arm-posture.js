// Rigid middle sections retain their authored thickness. Bending is confined
// to the shoulder and elbow; the complete sleeve rim follows one joint to avoid uneven pulling.
function createArmSkinning(T, model) {
 const edits=[], report=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const g=mesh.geometry,a=g.attributes;if(!a.skinIndex||!a.skinWeight)return;
  const indices=a.skinIndex.array.slice(),next=a.skinWeight.array.slice();let changed=0;
  const garment=/Wardrobe|Blouse|shirt|jacket|outer|sleeve/i.test(mesh.name);
  for(const side of ['L','R']) {
   const ids=['UpperArm_','Forearm_','Hand_'].map(n=>mesh.skeleton.bones.findIndex(b=>b.name===n+side));
   if(ids.some(i=>i<0))continue;
   const [upper,fore,hand]=ids;
   const [S,E,W]=ids.map(i=>new T.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[i].clone().invert()));
   const axis=W.clone().sub(S).normalize(),elbow=E.clone().sub(S).dot(axis),wrist=W.clone().sub(S).dot(axis),v=new T.Vector3();
   for(let i=0;i<a.position.count;i++) {
    let armWeight=0;const old=[];
    for(let j=0;j<4;j++){const joint=a.skinIndex.getComponent(i,j),w=a.skinWeight.getComponent(i,j);old.push([joint,w]);if(ids.includes(joint))armWeight+=w;}
    if(armWeight<.05)continue;
    v.fromBufferAttribute(a.position,i).applyMatrix4(mesh.bindMatrix).sub(S);const d=v.dot(axis);v.addScaledVector(axis,-d);
    if(d<-.01 || d>wrist+.065 || v.length()>.075)continue;
    const mask=T.MathUtils.smoothstep(d,-.01,.04);if(mask===0)continue;
    const f=T.MathUtils.smoothstep(d,elbow-.016,elbow+.016),h=garment?T.MathUtils.smoothstep(d,wrist-.025,wrist-.012):T.MathUtils.smoothstep(d,wrist-.010,wrist+.014);
    const weights=new Map();for(const [joint,w]of old)if(w>0)weights.set(joint,(weights.get(joint)||0)+w*(1-mask));
    for(const [joint,w]of [[upper,1-f],[fore,f*(1-h)],[hand,h]])if(w>0)weights.set(joint,(weights.get(joint)||0)+w*mask);
    const values=[...weights].filter(x=>x[1]>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=values.reduce((s,p)=>s+p[1],0);
    for(let j=0;j<4;j++){indices[4*i+j]=values[j]?.[0]||0;next[4*i+j]=(values[j]?.[1]||0)/sum;}changed++;
   }
  }
  if(changed){mesh.geometry=g.clone();edits.push({mesh,oldI:a.skinIndex.array.slice(),oldW:a.skinWeight.array.slice(),indices,next});report.push({mesh:mesh.name,vertices:changed});}
 });
 function setEnabled(enabled){for(const e of edits){const a=e.mesh.geometry.attributes;a.skinIndex.array.set(enabled?e.indices:e.oldI);a.skinWeight.array.set(enabled?e.next:e.oldW);a.skinIndex.needsUpdate=true;a.skinWeight.needsUpdate=true;}}
 setEnabled(true);return {setEnabled,report};
}

// A seated proportion key moved sleeve vertices away from their joint pivots.
// Keep the authored standing arm shape and move the whole arm chain with the
// same seated offset. Segment lengths and scales remain unchanged.
function createArmRestShape(T,model){
 const edits=[],sources={L:[],R:[]},report=[];
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const k=mesh.morphTargetDictionary?.seated_proportion_reset,g=mesh.geometry,a=g.attributes;
  const pos=g.morphAttributes.position?.[k];if(k===undefined||!pos||!g.morphTargetsRelative)return;
  const original=pos.array.slice(),next=original.slice(),normal=g.morphAttributes.normal?.[k],oldN=normal?.array.slice(),newN=oldN?.slice();let changed=0;
  for(let i=0;i<a.position.count;i++){
   let w=0;for(let j=0;j<4;j++){const n=mesh.skeleton.bones[a.skinIndex.getComponent(i,j)].name;if(/^(UpperArm|Forearm|Hand|Palm|Thumb|Finger)/.test(n))w+=a.skinWeight.getComponent(i,j);}
   w=T.MathUtils.smoothstep(w,.1,.95);if(w===0)continue;
   for(let j=0;j<3;j++){next[i*3+j]*=1-w;if(newN)newN[i*3+j]*=1-w;}changed++;
  }
  for(const side of ['L','R']){
   let count=0,sum=0;
   for(let i=0;i<pos.count;i++){let w=0;for(let j=0;j<4;j++)if(mesh.skeleton.bones[a.skinIndex.getComponent(i,j)].name==='Hand_'+side)w+=a.skinWeight.getComponent(i,j);if(w>.999){count++;sum+=pos.getY(i);}}
   if(count)sources[side].push({mesh,index:k,lift:sum/count,coverage:count/pos.count});
  }
  if(changed){mesh.geometry=g.clone();edits.push({mesh,k,original,next,oldN,newN});report.push({mesh:mesh.name,vertices:changed});}
 });
 // Three r180 caches morph textures per geometry. Attribute needsUpdate alone
 // does not invalidate that cache; replacing geometry makes before/after truthful.
 let lastEnabled=null;
 function setEnabled(enabled){
  if(lastEnabled===enabled)return;lastEnabled=enabled;
  for(const e of edits){
   const previous=e.mesh.geometry,g=previous.clone();
   g.morphAttributes.position[e.k].array.set(enabled?e.next:e.original);
   if(e.oldN)g.morphAttributes.normal[e.k].array.set(enabled?e.newN:e.oldN);
   e.mesh.geometry=g;previous.dispose();
  }
 }
 setEnabled(true);
 return {setEnabled,report,lift(side){const s=sources[side].reduce((best,v)=>!best||v.coverage>best.coverage?v:best,null);return s?s.lift*(s.mesh.morphTargetInfluences?.[s.index]||0):0;}};
}

/* Seated arm IK: rotate the authored bones; never change a bone's length or scale. */
export function createArmPosture(T,{model,bones,mixer,animations,getSeat}){
 const male53=model.name==='acnh_53-resident-root';
 const cuffs=male53?{setEnabled(){},report:[{bakedWeights:true,character:'acnh_53'}]}:createArmSkinning(T,model),restShape=createArmRestShape(T,model);
 const clips=animations.filter(c=>/^(sit$|sit_down$|stand_up$|type2$|work_)/.test(c.name));
 const arms=['L','R'].map(side=>({side,upper:bones['UpperArm_'+side],fore:bones['Forearm_'+side],hand:bones['Hand_'+side]})).filter(a=>a.upper&&a.fore&&a.hand);
 // Read the authored endpoints on an independent hierarchy. The transition
 // moves the whole fixed-length chain between these poses instead of passing
 // through the native lap pose, which folded the elbow back toward the body.
 const reference=model.clone(true),referenceBones={};reference.traverse(o=>{if(o.isBone)referenceBones[o.name]=o;});
 const referenceMixer=new T.AnimationMixer(reference),endpoints={};
 for(const name of ['idle','type2']){
  const clip=animations.find(c=>c.name===name);if(!clip)continue;
  referenceMixer.stopAllAction();referenceMixer.clipAction(clip).reset().play();referenceMixer.update(0);reference.updateMatrixWorld(true);
  endpoints[name]={};for(const a of arms){const [s,e,w]=['UpperArm_','Forearm_','Hand_'].map(n=>referenceBones[n+a.side].getWorldPosition(new T.Vector3()));endpoints[name][a.side]={delta:w.clone().sub(s),upper:e.clone().sub(s),hand:referenceBones['Hand_'+a.side].getWorldQuaternion(new T.Quaternion())};}
 }
 referenceMixer.stopAllAction();referenceMixer.uncacheRoot(reference);
 const undo=new Map(),info={enabled:true,active:false,weight:0,arms:[],method:'forward-typing-continuous-arcs',shape:restShape.report,cuffs:cuffs.report};
 const identity=new T.Quaternion();
 let computerSeat=true;
 function remember(b){if(!undo.has(b))undo.set(b,{pre:b.quaternion.clone(),preP:b.position.clone(),post:null,postP:null});}
 function aim(b,from,to){if(from.lengthSq()<1e-12||to.lengthSq()<1e-12)return;remember(b);const delta=new T.Quaternion().setFromUnitVectors(from.normalize(),to.normalize()),parent=b.parent.getWorldQuaternion(new T.Quaternion()),world=b.getWorldQuaternion(new T.Quaternion());b.quaternion.copy(parent.invert().multiply(world.premultiply(delta))).normalize();b.updateMatrixWorld(true);}
 function restore(){for(const [b,u]of undo){if(u.post&&Math.max(Math.abs(b.quaternion.x-u.post.x),Math.abs(b.quaternion.y-u.post.y),Math.abs(b.quaternion.z-u.post.z),Math.abs(b.quaternion.w-u.post.w))<1e-7)b.quaternion.copy(u.pre);if(u.postP&&b.position.distanceToSquared(u.postP)<1e-14)b.position.copy(u.preP);}undo.clear();}
 return {restore,seatAdvance:seat=>(info.enabled && seat && seat.pc!==false) ? .025 : 0,setEnabled(v){restore();info.enabled=!!v;restShape.setEnabled(info.enabled);cuffs.setEnabled(info.enabled);},get state(){return structuredClone(info)},update(){
  info.arms=[];const seat=getSeat?.();if(seat)computerSeat=seat.pc!==false;let weight=0,reach=0,transitionWeight=0,seatedPhase=0;
  for(const c of clips){const a=mixer.existingAction(c);if(a?.enabled&&a.isScheduled()){const w=a.getEffectiveWeight();weight+=w;if(/^(type2$|work_)/.test(c.name))reach+=w;if(/^(sit_down|stand_up)$/.test(c.name)){const p=T.MathUtils.clamp(a.time/c.duration,0,1),seat=c.name==='sit_down'?T.MathUtils.smoothstep(p,.25,1):1-T.MathUtils.smoothstep(p,0,.55);transitionWeight+=w;seatedPhase+=w*seat;}}}
  if(transitionWeight>0)seatedPhase/=transitionWeight;
  if(!computerSeat)transitionWeight=0;
  weight=Math.min(1,weight);reach=Math.min(1,reach);info.weight=weight;info.active=info.enabled&&weight>1e-5;if(!info.active)return info;
  model.updateMatrixWorld(true);const modelQ=model.getWorldQuaternion(new T.Quaternion()),down=new T.Vector3(0,-1,0).applyQuaternion(modelQ);
  for(const a of arms){
   const liftY=restShape.lift(a.side);if(Math.abs(liftY)>1e-8){remember(a.upper);const target=a.upper.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,liftY,0).applyQuaternion(modelQ));a.upper.position.copy(a.upper.parent.worldToLocal(target));a.upper.updateMatrixWorld(true);}
   const S=a.upper.getWorldPosition(new T.Vector3()),E=a.fore.getWorldPosition(new T.Vector3()),originalW=a.hand.getWorldPosition(new T.Vector3()),W=originalW.clone(),handQ=a.hand.getWorldQuaternion(new T.Quaternion());
   const upper=E.clone().sub(S),lower=W.clone().sub(E),l1=upper.length(),l2=lower.length();if(Math.min(l1,l2)<1e-6)continue;
   const reachLift=T.MathUtils.smoothstep(originalW.clone().sub(S).dot(down.clone().negate()),-.015,.07);
   // Reach forward along the keyboard axis. Preserve the authored wrist height
   // and spacing, and solve shoulder/elbow rotation at 99.7% of the fixed reach.
   // A small remaining bend avoids the fully straight IK singularity.
   const localDelta=originalW.clone().sub(S).applyQuaternion(modelQ.clone().invert());
   const reachLength=(l1+l2)*.997;
   const forward=Math.sqrt(Math.max(0,reachLength*reachLength-localDelta.x*localDelta.x-localDelta.y*localDelta.y));
   const forwardW=S.clone().add(new T.Vector3(localDelta.x,localDelta.y,forward).applyQuaternion(modelQ));
   const direct=reach*(1-reachLift),tw=Math.min(1,transitionWeight),idle=endpoints.idle?.[a.side],typing=endpoints.type2?.[a.side];
   let transitionPole=null;
   if(tw>0&&idle&&typing){
    const idleDirection=idle.delta.clone().normalize(),typeDelta=typing.delta.clone();
    typeDelta.z=Math.sqrt(Math.max(0,reachLength*reachLength-typeDelta.x*typeDelta.x-typeDelta.y*typeDelta.y));
    const typeDirection=typeDelta.clone().normalize(),arc=new T.Quaternion().setFromUnitVectors(idleDirection,typeDirection);
    const direction=idleDirection.clone().applyQuaternion(new T.Quaternion().slerp(arc,seatedPhase));
    const distance=T.MathUtils.lerp(idle.delta.length(),reachLength,seatedPhase);
    const transitionW=S.clone().add(direction.multiplyScalar(distance).applyQuaternion(modelQ));
    W.multiplyScalar(Math.max(0,1-direct-tw)).addScaledVector(forwardW,direct).addScaledVector(transitionW,tw);
    const idlePole=idle.upper.clone().addScaledVector(idleDirection,-idle.upper.dot(idleDirection)).normalize();
    transitionPole=idlePole.lerp(new T.Vector3(a.side==='L'?-.08:.08,-1,0).normalize(),seatedPhase).normalize().applyQuaternion(modelQ);
    const h=idle.hand.clone().slerp(typing.hand,seatedPhase).premultiply(modelQ);handQ.slerp(h,tw);
   }else W.lerp(forwardW,direct);
   const axis=W.clone().sub(S),rawDistance=axis.length();if(rawDistance<1e-6)continue;axis.divideScalar(rawDistance);
   const d=T.MathUtils.clamp(rawDistance,Math.abs(l1-l2)+1e-5,l1+l2-1e-5);W.copy(S).addScaledVector(axis,d);
   const along=(l1*l1-l2*l2+d*d)/(2*d),r=Math.sqrt(Math.max(0,l1*l1-along*along));
   const radial=upper.clone().addScaledVector(axis,-upper.dot(axis)),pole=down.clone().add(new T.Vector3(a.side==='L'?-.08:.08,0,0).applyQuaternion(modelQ));if(transitionPole)pole.lerp(transitionPole,tw);pole.addScaledVector(axis,-pole.dot(axis));
   if(pole.lengthSq()<1e-8)continue;pole.normalize();if(radial.lengthSq()<1e-8)radial.copy(pole);else radial.normalize();
   const lift=T.MathUtils.smoothstep(W.clone().sub(S).dot(down.clone().negate()),-.015,.07),influence=weight*(1-lift);
   const swivel=new T.Quaternion().setFromUnitVectors(radial,pole).slerp(identity,1-influence);
   const target=radial.applyQuaternion(swivel).multiplyScalar(r).addScaledVector(axis,along).add(S);
   aim(a.upper,E.clone().sub(S),target.clone().sub(S));
   const nowE=a.fore.getWorldPosition(new T.Vector3()),nowW=a.hand.getWorldPosition(new T.Vector3());aim(a.fore,nowW.sub(nowE),W.clone().sub(nowE));
   remember(a.hand);const parent=a.hand.parent.getWorldQuaternion(new T.Quaternion());a.hand.quaternion.copy(parent.invert().multiply(handQ)).normalize();a.hand.updateMatrixWorld(true);
   const finalE=a.fore.getWorldPosition(new T.Vector3()),finalW=a.hand.getWorldPosition(new T.Vector3());
   info.arms.push({side:a.side,influence,reach,transitionWeight:tw,seatedPhase,wristError:finalW.distanceTo(W),elbowMove:finalE.distanceTo(E),upperLength:l1,lowerLength:l2,upperLengthError:Math.abs(finalE.distanceTo(S)-l1),lowerLengthError:Math.abs(finalW.distanceTo(finalE)-l2),shoulder:S.toArray(),elbow:finalE.toArray(),wrist:finalW.toArray(),bendDegrees:180-finalE.clone().sub(S).negate().angleTo(finalW.clone().sub(finalE))*180/Math.PI});
  }
  for(const [b,u]of undo){u.post=b.quaternion.clone();u.postP=b.position.clone();}return info;
 }};
}

// Keep the laptop screen unchanged while setting a thin deck at the authored hand height.
export function fitLaptopHeight(root){
 const base=root.getObjectByName('Laptop_Base');if(!base)return null;const parts=base.parent.children.map(o=>({o,y:o.position.y,sy:o.scale.y}));
 const drop=.015,rootY=root.position.y;let enabled=true;function setEnabled(value){enabled=!!value;for(const p of parts){p.o.position.y=p.y;p.o.scale.y=p.sy;if(enabled){if(p.o===base){p.o.position.y*=.375;p.o.scale.y*=.375;}else p.o.position.y-=drop;}}root.position.y=rootY-(enabled?.004:0);root.updateMatrixWorld(true);}
 root.traverse(o=>{o.userData.noMerge=true});root.userData.workstationFit={setEnabled,drop};root.userData.workstationHeightDrop=drop+.004;setEnabled(true);return root.userData.workstationFit;
}
