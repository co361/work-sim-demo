import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareGarmentMotion} from '../js/office-garment-motion.js';
import {registerGarmentMotion} from '../js/office-garment-loader.js';
const T = await import(process.env.WORKSIM_THREE_MODULE || 'three');

test('cloth samples interpolate exactly and return to neutral without affecting bone tracks', () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0], 3));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [[0, .2, 0, 0, .2, 0], [0, 0, 1, 0, 0, 2], [0, 0, 3, 0, 0, 4]].map(a => new T.Float32BufferAttribute(a, 3));
  geometry.morphAttributes.normal = [0, 1, 2].map(() => new T.Float32BufferAttribute(new Float32Array(6), 3));
  geometry.morphAttributes.position.forEach((a, i) => a.name = ['seated_proportion_reset', 'contact_envelope_walk_00', 'contact_envelope_walk_01'][i]);
  const cloth = new T.SkinnedMesh(geometry, new T.MeshBasicMaterial());
  cloth.name = 'Cloth'; cloth.userData.worksimGarmentMotion = 1;
  const untouched = new T.SkinnedMesh(geometry.clone(), new T.MeshBasicMaterial());
  untouched.name = 'Untouched';
  const rig = new T.Group();rig.add(cloth, untouched);
  const bone = new T.Bone();bone.name = 'Hips';rig.add(bone);
  const boneTrack = new T.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 2, 0]);
  const weights = new T.NumberKeyframeTrack('Cloth.morphTargetInfluences', [0, 1], [0, 1, 0, 0, 0, 1]);
  const clip = new T.AnimationClip('walk', 1, [boneTrack, weights]);
  const controller = prepareGarmentMotion(T, rig, [clip]);
  assert.equal(clip.tracks[0], boneTrack);
  assert.equal(untouched.geometry.morphAttributes.position.length, 3);
  assert.equal(cloth.geometry.morphAttributes.position.length, 1);
  const mixer = new T.AnimationMixer(rig);mixer.clipAction(clip).play();mixer.update(.25);controller.update();
  assert.deepEqual(Array.from(cloth.geometry.attributes.position.array), [0, 0, 1.5, 1, 0, 2.5]);
  assert.equal(bone.position.y, .5);
  assert.deepEqual(controller.report, [{mesh: 'Cloth', poseTargets: 2, gpuTargets: 1}]);
  mixer.stopAllAction();controller.update();
  assert.deepEqual(Array.from(cloth.geometry.attributes.position.array), [0, 0, 0, 1, 0, 0]);
  assert.deepEqual(cloth.morphTargetDictionary, {seated_proportion_reset: 0});
});

test('models without the explicit marker retain their geometry and animation objects', () => {
  const model = new T.Group(), geometry = new T.BufferGeometry();
  const mesh = new T.SkinnedMesh(geometry, new T.MeshBasicMaterial());model.add(mesh);
  const clip = new T.AnimationClip('idle', 1, []), tracks = clip.tracks;
  const controller = prepareGarmentMotion(T, model, [clip]);controller.update();
  assert.equal(mesh.geometry, geometry);assert.equal(clip.tracks, tracks);assert.deepEqual(controller.report, []);
});

test('sparse loader preserves interpolated cloth and never expands pose accessors', async () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
  geometry.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0], 3));
  geometry.morphTargetsRelative = true;
  geometry.morphAttributes.position = [new T.Float32BufferAttribute([0, .2, 0, 0, .2, 0], 3)];
  geometry.morphAttributes.position[0].name = 'seated_proportion_reset';
  geometry.morphAttributes.normal = [new T.Float32BufferAttribute(new Float32Array(6), 3)];
  const cloth = new T.SkinnedMesh(geometry, new T.MeshBasicMaterial());cloth.name = 'Cloth';cloth.userData.worksimGarmentMotion = 1;
  const rig = new T.Group();rig.add(cloth);const bone = new T.Bone();bone.name = 'Hips';rig.add(bone);
  const boneTrack = new T.VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 2, 0]);
  const clip = new T.AnimationClip('walk', 1, [boneTrack]);
  const vec = {componentType: 5126, type: 'VEC3', count: 2};
  const sparse = view => ({...vec, sparse: {count: 2, indices: {bufferView: 0, componentType: 5123}, values: {bufferView: view}}});
  const json = {
    nodes: [{mesh: 0, extras: {worksimGarmentMotion: 1}}],
    meshes: [{extras: {targetNames: ['seated_proportion_reset', 'contact_envelope_walk_00', 'contact_envelope_walk_01']}, weights: [0, 0, 0], primitives: [{targets: [{POSITION: 0, NORMAL: 0}, {POSITION: 1, NORMAL: 2}, {POSITION: 3, NORMAL: 2}]}]}],
    accessors: [{...vec, bufferView: 3, min: [0,0,0], max: [0,0,0]}, sparse(1), {...vec}, sparse(2), {componentType: 5126, type: 'SCALAR', count: 2}, {componentType: 5126, type: 'SCALAR', count: 6}],
    animations: [{channels: [{sampler: 0, target: {node: 0, path: 'weights'}}], samplers: [{input: 4, output: 5, interpolation: 'LINEAR'}]}]
  };
  const views = [new Uint16Array([0, 1]).buffer, new Float32Array([0, 0, 1, 0, 0, 2]).buffer, new Float32Array([0, 0, 3, 0, 0, 4]).buffer];
  const loadedAccessors = [], removed = [];
  const parser = {json, cache: {remove: key => removed.push(key)}, async getDependency(type, index) {
    if (type === 'bufferView') return views[index];
    if (type === 'node') return cloth;
    loadedAccessors.push(index);
    if (index === 4) return new T.Float32BufferAttribute([0, 1], 1);
    if (index === 5) return new T.Float32BufferAttribute([0, 1, 0, 0, 0, 1], 1);
    throw new Error('Pose accessor unexpectedly expanded');
  }};
  let factory;registerGarmentMotion(T, {register(fn) {factory = fn;}});const plugin = factory(parser);
  await plugin.beforeRoot();assert.equal(json.meshes[0].primitives[0].targets.length, 1);assert.equal(json.animations[0].channels.length, 0);
  await plugin.afterRoot({animations: [clip]});
  assert.deepEqual(loadedAccessors.sort(), [4, 5]);assert.equal(removed.length, 3);assert.equal(clip.tracks[0], boneTrack);
  const controller = prepareGarmentMotion(T, rig, [clip]), mixer = new T.AnimationMixer(rig);
  mixer.clipAction(clip).play();mixer.update(.25);controller.update();
  assert.deepEqual(Array.from(cloth.geometry.attributes.position.array), [0, 0, 1.5, 1, 0, 2.5]);assert.equal(bone.position.y, .5);
  mixer.stopAllAction();controller.update();assert.deepEqual(Array.from(cloth.geometry.attributes.position.array), [0, 0, 0, 1, 0, 0]);
});

test('sparse loader leaves untagged assets and unsupported dense targets untouched', async () => {
  for (const tagged of [false, true]) {
    const json = {nodes: [{mesh: 0, extras: tagged ? {worksimGarmentMotion: 1} : {}}], meshes: [{extras: {targetNames: ['seated', 'contact_envelope_walk_00']}, primitives: [{targets: [{POSITION: 0, NORMAL: 0}, {POSITION: 0, NORMAL: 0}]}]}], accessors: [{componentType: 5126, type: 'VEC3', count: 1, bufferView: 0}], animations: []};
    const before = structuredClone(json);let factory;
    registerGarmentMotion(T, {register(fn) {factory = fn;}});
    const plugin = factory({json, cache: {remove() {throw Error('unexpected cache change')}}, getDependency() {throw Error('unexpected load')}});
    await plugin.beforeRoot();await plugin.afterRoot({});assert.deepEqual(json, before);
  }
});

test('retained sparse morph bounds include implicit zeros without expanding accessors', async () => {
  const vec = {componentType:5126,type:'VEC3',count:3};
  const sparse = (count,view) => ({...vec,sparse:{count,indices:{bufferView:0,componentType:5123},values:{bufferView:view}}});
  const json = {nodes:[{mesh:0,extras:{worksimGarmentMotion:1}}],meshes:[{extras:{targetNames:['partial','full','contact_envelope_test']},primitives:[{targets:[{POSITION:0,NORMAL:1},{POSITION:3,NORMAL:1},{POSITION:2,NORMAL:1}]}]}],accessors:[sparse(1,1),{...vec},sparse(3,2),sparse(3,3)],animations:[]};
  const views = [new Uint16Array([0,1,2]).buffer,new Float32Array([-2,3,-4]).buffer,new Float32Array([1,2,3,-1,-2,-3,0,0,0]).buffer,new Float32Array([1,2,3,4,5,6,2,3,4]).buffer];
  const bytes = views.map(v => Array.from(new Uint8Array(v)));let factory;
  registerGarmentMotion(T,{register(fn){factory=fn;}});
  await factory({json,async getDependency(type,index){assert.equal(type,'bufferView');return views[index];}}).beforeRoot();
  assert.deepEqual(json.accessors[0].min,[-2,0,-4]);assert.deepEqual(json.accessors[0].max,[0,3,0]);
  assert.deepEqual(json.accessors[3].min,[1,2,3]);assert.deepEqual(json.accessors[3].max,[4,5,6]);
  assert.equal(json.accessors[2].min,undefined);assert.deepEqual(views.map(v=>Array.from(new Uint8Array(v))),bytes);
});

test('retained dense button bounds reuse the renderer accessor', async () => {
  const vec={componentType:5126,type:'VEC3',count:2};
  const json={nodes:[{mesh:0,extras:{worksimGarmentMotion:1}}],meshes:[{extras:{targetNames:['neutral','contact_envelope_test']},primitives:[{targets:[{POSITION:0,NORMAL:0},{POSITION:1,NORMAL:1}]}]},{primitives:[{targets:[{POSITION:2}]}]}],accessors:[{...vec,min:[0,0,0],max:[0,0,0]},{...vec},{...vec,bufferView:0}],animations:[]};
  let factory,loads=0;registerGarmentMotion(T,{register(fn){factory=fn;}});
  await factory({json,async getDependency(type,index){assert.equal(type,'accessor');assert.equal(index,2);loads++;return new T.Float32BufferAttribute([-2,3,4,1,5,-6],3);}}).beforeRoot();
  assert.equal(loads,1);assert.deepEqual(json.accessors[2].min,[-2,3,-6]);assert.deepEqual(json.accessors[2].max,[1,5,4]);
});
