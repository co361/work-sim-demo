import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {editGlb} from './glb-edit.mjs';
for(const id of [18,41]){
 const e=editGlb(`candidate/acnh_${id}.glb`),g=e.g,node=g.nodes.findIndex(n=>/Wardrobe \| (Shirt|Knit) continuous shell/.test(n.name)),m=g.meshes[g.nodes[node].mesh],p=m.primitives[0],names=m.extras.targetNames;
 const used=new Set();for(const a of g.animations){const c=a.channels.find(c=>c.target.node===node&&c.target.path==='weights');if(c)for(const[v,i]of Array.from(e.values(a.samplers[c.sampler].output),(v,i)=>[v,i]))if(v)used.add(i%names.length)}
 for(const[w,i]of (m.weights||[]).map((v,i)=>[v,i]))if(w)used.add(i);
 for(const[w,i]of (g.nodes[node].weights||[]).map((v,i)=>[v,i]))if(w)used.add(i);
 const canonical=new Map(),keep=[],map=[],removed=[];
 for(let i=0;i<names.length;i++){
  if(!used.has(i)){map[i]=-1;removed.push({index:i,name:names[i],reason:'zero in every animation key and default weight'});continue}
  const h=crypto.createHash('sha256');for(const key of ['POSITION','NORMAL'])h.update(Buffer.from(new Float32Array(e.values(p.targets[i][key])).buffer));const hash=h.digest('hex');
  if(canonical.has(hash)){map[i]=canonical.get(hash);removed.push({index:i,name:names[i],reason:'bit-identical position and normal deltas',canonical:keep[map[i]]});}
  else{map[i]=keep.length;canonical.set(hash,keep.length);keep.push(i)}
 }
 for(const a of g.animations){const c=a.channels.find(c=>c.target.node===node&&c.target.path==='weights');if(!c)continue;const s=a.samplers[c.sampler],v=e.values(s.output),rows=v.length/names.length,out=new Float32Array(rows*keep.length);assert.equal(s.interpolation||'LINEAR','LINEAR');
  for(let r=0;r<rows;r++)for(let i=0;i<names.length;i++){if(map[i]<0)assert.equal(v[r*names.length+i],0);else out[r*keep.length+map[i]]+=v[r*names.length+i]}
  const ai=g.accessors.length;g.accessors.push({componentType:5126,type:'SCALAR',count:out.length});e.put(ai,out);s.output=ai;
 }
 const merge=w=>{const out=Array(keep.length).fill(0);w?.forEach((v,i)=>{if(map[i]>=0)out[map[i]]+=v;else assert.equal(v,0)});return out};
 m.weights=merge(m.weights);if(g.nodes[node].weights)g.nodes[node].weights=merge(g.nodes[node].weights);p.targets=keep.map(i=>p.targets[i]);m.extras.targetNames=keep.map(i=>names[i]);
 const bytes=e.save(`candidate/acnh_${id}.glb`);
 fs.writeFileSync(`evidence/perf-review/compact-${id}.json`,JSON.stringify({id,oldCount:names.length,newCount:keep.length,removed,oldToNew:map,sourceSha256:crypto.createHash('sha256').update(e.source).digest('hex'),outputBeforePackingBytes:bytes.length,proof:'Kept deltas are bit-identical. Duplicate coefficients are summed. Removed coefficients are exactly zero at every key and default. All garment interpolation is LINEAR, so the weighted displacement is preserved for all interpolated times and blends.'},null,2));
 console.log(JSON.stringify({id,before:names.length,after:keep.length,removed:removed.length}));
}
