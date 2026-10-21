import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareGarmentMotion} from '../js/office-garment-motion.js';
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
