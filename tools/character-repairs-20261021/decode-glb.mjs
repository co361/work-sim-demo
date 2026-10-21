// Blender 5.2's meshopt FILTER import fails on these assets. Decode losslessly for artist source only.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {MeshoptDecoder} from 'meshoptimizer';
import {editGlb} from './glb-edit.mjs';
await MeshoptDecoder.ready;
const [input,output]=process.argv.slice(2),e=editGlb(input),g=structuredClone(e.g),bin=e.source.subarray(28+e.source.readUInt32LE(12)),parts=[];let offset=0;
for(const v of g.bufferViews){let data;const m=v.extensions?.EXT_meshopt_compression;if(m){data=new Uint8Array(m.count*m.byteStride);MeshoptDecoder.decodeGltfBuffer(data,m.count,m.byteStride,bin.subarray(m.byteOffset,m.byteOffset+m.byteLength),m.mode,m.filter);delete v.extensions.EXT_meshopt_compression;if(!Object.keys(v.extensions).length)delete v.extensions;}else{assert.equal(v.buffer,0);data=bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);}if(offset%4){parts.push(Buffer.alloc(4-offset%4));offset+=4-offset%4;}v.buffer=0;v.byteOffset=offset;v.byteLength=data.length;parts.push(Buffer.from(data));offset+=data.length;}
if(offset%4){parts.push(Buffer.alloc(4-offset%4));offset+=4-offset%4;}
g.buffers=[{byteLength:offset}];for(const k of ['extensionsUsed','extensionsRequired'])if(g[k])g[k]=g[k].filter(s=>s!=='EXT_meshopt_compression');
let js=Buffer.from(JSON.stringify(g));if(js.length%4)js=Buffer.concat([js,Buffer.alloc(4-js.length%4,32)]);const h=Buffer.alloc(20),bh=Buffer.alloc(8);h.writeUInt32LE(0x46546c67);h.writeUInt32LE(2,4);h.writeUInt32LE(28+js.length+offset,8);h.writeUInt32LE(js.length,12);h.writeUInt32LE(0x4e4f534a,16);bh.writeUInt32LE(offset);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(output,Buffer.concat([h,js,bh,...parts]));const check=editGlb(output);for(let i=0;i<g.accessors.length;i++)assert.deepEqual(check.values(i),e.values(i),'accessor '+i);console.log(JSON.stringify({input,output,verifiedAccessors:g.accessors.length,bytes:fs.statSync(output).size}));
