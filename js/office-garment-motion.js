/* Evaluate the revised 18/41 cloth correctives on the CPU. Only the two
   neighboring pose samples normally have nonzero weights; the GPU still sees
   the original seated shapes instead of hundreds of inactive pose targets. */
export function prepareGarmentMotion(THREE, model, animations) {
  const entries = [];
  model.traverse(mesh => {
    if (!mesh.isSkinnedMesh || mesh.userData?.worksimGarmentMotion !== 1) return;
    if (mesh.workSimGarmentSamples) {
      entries.push({mesh, basePosition: mesh.geometry.attributes.position.array.slice(), baseNormal: mesh.geometry.attributes.normal.array.slice(), shapes: mesh.workSimGarmentSamples, previous: null});
      delete mesh.workSimGarmentSamples;
      return;
    }
    const dictionary = mesh.morphTargetDictionary;
    const names = Object.keys(dictionary).sort((a, b) => dictionary[a] - dictionary[b]);
    const selected = names.map((name, index) => name.startsWith('contact_envelope_') ? index : -1).filter(i => i >= 0);
    if (!selected.length) return;
    const keep = names.map((_, i) => i).filter(i => !selected.includes(i));
    const geometry = mesh.geometry;
    const basePosition = geometry.attributes.position.array.slice();
    const baseNormal = geometry.attributes.normal.array.slice();
    const shapes = selected.map(i => {
      const p = geometry.morphAttributes.position[i].array;
      const n = geometry.morphAttributes.normal[i].array;
      const indices = [], values = [];
      for (let j = 0; j < p.length; j += 3) {
        if (p[j] === 0 && p[j + 1] === 0 && p[j + 2] === 0 && n[j] === 0 && n[j + 1] === 0 && n[j + 2] === 0) continue;
        indices.push(j);
        values.push(p[j], p[j + 1], p[j + 2], n[j], n[j + 1], n[j + 2]);
      }
      return { indices: new Uint32Array(indices), values: new Float32Array(values) };
    });
    for (const clip of animations) {
      const tracks = [];
      for (const track of clip.tracks) {
        if (track.name !== mesh.name + '.morphTargetInfluences' && track.name !== mesh.uuid + '.morphTargetInfluences') {
          tracks.push(track);
          continue;
        }
        const rows = track.times.length;
        const subset = indices => {
          const values = new Float32Array(rows * indices.length);
          for (let r = 0; r < rows; r++) for (let j = 0; j < indices.length; j++) values[r * indices.length + j] = track.values[r * names.length + indices[j]];
          return values;
        };
        tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.morphTargetInfluences', track.times, subset(keep), track.getInterpolation()));
        tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.workSimMotionWeights', track.times, subset(selected), track.getInterpolation()));
      }
      clip.tracks = tracks;
    }
    geometry.morphAttributes.position = keep.map(i => geometry.morphAttributes.position[i]);
    geometry.morphAttributes.normal = keep.map(i => geometry.morphAttributes.normal[i]);
    mesh.morphTargetInfluences = keep.map(i => mesh.morphTargetInfluences[i]);
    mesh.morphTargetDictionary = Object.fromEntries(keep.map((i, j) => [names[i], j]));
    mesh.workSimMotionWeights = selected.map(() => 0);
    entries.push({ mesh, basePosition, baseNormal, shapes, previous: null });
  });
  return {
    update() {
      for (const entry of entries) {
        const weights = entry.mesh.workSimMotionWeights;
        if (entry.previous && weights.every((w, i) => w === entry.previous[i])) continue;
        const { position, normal } = entry.mesh.geometry.attributes;
        position.array.set(entry.basePosition);
        normal.array.set(entry.baseNormal);
        for (let i = 0; i < weights.length; i++) {
          const w = weights[i];
          if (!w) continue;
          const { indices, values } = entry.shapes[i];
          for (let j = 0; j < indices.length; j++) {
            const dst = indices[j], src = j * 6;
            for (let k = 0; k < 3; k++) {
              position.array[dst + k] += values[src + k] * w;
              normal.array[dst + k] += values[src + 3 + k] * w;
            }
          }
        }
        position.needsUpdate = normal.needsUpdate = true;
        entry.previous = [...weights];
      }
    },
    get report() { return entries.map(e => ({ mesh: e.mesh.name, poseTargets: e.shapes.length, gpuTargets: e.mesh.geometry.morphAttributes.position.length })); }
  };
}
