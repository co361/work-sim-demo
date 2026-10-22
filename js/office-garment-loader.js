/* Read tagged corrective shapes sparsely before GLTFLoader expands every target
   into a full vertex array. The GLB remains standard glTF for other viewers. */
export function registerGarmentMotion(THREE, loader) {
  loader.register(parser => {
    const pending = [];
    const transientViews = new Set();
    async function sparse(accessorIndex) {
      const a = parser.json.accessors[accessorIndex];
      if (!a.sparse) return { indices: new Uint16Array(), values: new Float32Array() };
      const s = a.sparse;
      transientViews.add(s.indices.bufferView);transientViews.add(s.values.bufferView);
      const [ib, vb] = await Promise.all([parser.getDependency('bufferView', s.indices.bufferView), parser.getDependency('bufferView', s.values.bufferView)]);
      const Index = {5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array}[s.indices.componentType];
      return {indices: new Index(ib, s.indices.byteOffset || 0, s.count), values: new Float32Array(vb, s.values.byteOffset || 0, s.count * 3)};
    }
    async function shape(target) {
      const [p, n] = await Promise.all([sparse(target.POSITION), sparse(target.NORMAL)]);
      function visit(emit) {
        let pi = 0, ni = 0, count = 0;
        while (pi < p.indices.length || ni < n.indices.length) {
          const index = Math.min(p.indices[pi] ?? Infinity, n.indices[ni] ?? Infinity);
          const pv = p.indices[pi] === index ? pi++ * 3 : -1;
          const nv = n.indices[ni] === index ? ni++ * 3 : -1;
          emit?.(count, index, pv, nv);count++;
        }
        return count;
      }
      const count = visit(), indices = new Uint32Array(count), values = new Float32Array(count * 6);
      visit((i, index, pv, nv) => {
        indices[i] = index * 3;
        for (let k = 0; k < 3; k++) {
          values[i * 6 + k] = pv < 0 ? 0 : p.values[pv + k];
          values[i * 6 + 3 + k] = nv < 0 ? 0 : n.values[nv + k];
        }
      });
      return {indices, values};
    }
    return {
      name: 'WORKSIM_sparse_garment_motion',
      beforeRoot() {
        const json = parser.json;
        for (let nodeIndex = 0; nodeIndex < json.nodes.length; nodeIndex++) {
          const node = json.nodes[nodeIndex], mesh = json.meshes?.[node.mesh];
          if (node.extras?.worksimGarmentMotion !== 1 || mesh?.primitives.length !== 1) continue;
          const primitive = mesh.primitives[0], names = mesh.extras?.targetNames;
          if (!names || !primitive.targets) continue;
          const selected = names.map((n, i) => n.startsWith('contact_envelope_') ? i : -1).filter(i => i >= 0);
          const keep = names.map((_, i) => i).filter(i => !selected.includes(i));
          const tracks = (json.animations || []).flatMap((a, ai) => a.channels.filter(c => c.target.node === nodeIndex && c.target.path === 'weights').map(c => ({animation: ai, channel: c, sampler: a.samplers[c.sampler]})));
          // Unsupported tagged assets use the existing dense fallback unchanged.
          if (!selected.length || !keep.length || tracks.some(t => !['LINEAR', 'STEP'].includes(t.sampler.interpolation || 'LINEAR'))) continue;
          if (selected.some(i => ['POSITION', 'NORMAL'].some(k => {
            const a = json.accessors[primitive.targets[i][k]];
            return !a || a.componentType !== 5126 || a.type !== 'VEC3' || a.bufferView !== undefined;
          }))) continue;
          const data = {nodeIndex, count: names.length, selected, keep};
          data.shapes = Promise.all(selected.map(i => shape(primitive.targets[i])));
          data.tracks = Promise.all(tracks.map(async t => ({...t, input: await parser.getDependency('accessor', t.sampler.input), output: await parser.getDependency('accessor', t.sampler.output)})));
          for (const t of tracks) json.animations[t.animation].channels = json.animations[t.animation].channels.filter(c => c !== t.channel);
          primitive.targets = keep.map(i => primitive.targets[i]);
          mesh.extras.targetNames = keep.map(i => names[i]);
          mesh.weights = keep.map(i => mesh.weights?.[i] || 0);
          if (node.weights) node.weights = keep.map(i => node.weights[i]);
          pending.push(data);
        }
        // Retained GPU morphs (including jacket buttons) still need bounds.
        // Read sparse values directly so correcting missing glTF metadata does
        // not expand the removed garment poses into dense vertex arrays.
        const bounds = [];
        const positions = new Set(pending.length ? (json.meshes || []).flatMap(m => m.primitives.flatMap(p => (p.targets || []).map(t => t.POSITION))) : []);
        for (const index of positions) {
          const a = json.accessors[index];
          if (!a || (a.min && a.max) || !a.sparse || a.bufferView !== undefined || a.componentType !== 5126 || a.type !== 'VEC3') continue;
          bounds.push(sparse(index).then(({values}) => {
            const implicitZero = a.sparse.count < a.count;
            const min = Array(3).fill(implicitZero ? 0 : Infinity), max = Array(3).fill(implicitZero ? 0 : -Infinity);
            for (let i = 0; i < values.length; i++) {const k = i % 3;min[k] = Math.min(min[k], values[i]);max[k] = Math.max(max[k], values[i]);}
            if ([...min, ...max].every(Number.isFinite)) {a.min ??= min;a.max ??= max;}
          }));
        }
        return Promise.all([...pending.flatMap(d => [d.shapes, d.tracks]), ...bounds]);
      },
      async afterRoot(result) {
        for (const d of pending) {
          const node = await parser.getDependency('node', d.nodeIndex);
          const shapes = await d.shapes;
          node.traverse(mesh => {
            if (!mesh.isSkinnedMesh || mesh.userData?.worksimGarmentMotion !== 1) return;
            mesh.workSimGarmentSamples = shapes;
            mesh.workSimMotionWeights = d.selected.map(() => 0);
          });
          for (const t of await d.tracks) {
            const times = t.input.array, values = t.output.array;
            const subset = indices => {
              const out = new Float32Array(times.length * indices.length);
              for (let r = 0; r < times.length; r++) for (let j = 0; j < indices.length; j++) out[r * indices.length + j] = values[r * d.count + indices[j]];
              return out;
            };
            node.traverse(mesh => {
              if (!mesh.workSimGarmentSamples) return;
              const interpolation = t.sampler.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear;
              result.animations[t.animation].tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.morphTargetInfluences', times, subset(d.keep), interpolation));
              result.animations[t.animation].tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.workSimMotionWeights', times, subset(d.selected), interpolation));
            });
          }
        }
        // These sparse source views are now copied into the compact runtime data.
        for (const view of transientViews) parser.cache.remove('bufferView:' + view);
        pending.length = 0;transientViews.clear();
      }
    };
  });
  return loader;
}
