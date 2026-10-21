import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const ownedGeometry = new WeakMap();

// Batch only opaque, static leaf siblings. Parent groups remain intact so doors,
// fitted chairs, wall culling, screen picking and whole-prop visibility still work.
// Geometry attributes, materials, textures, triangle counts and shadow flags stay
// unchanged. Never call this on characters or an animated/skinned subtree.
export function compactStaticSiblings(THREE, root) {
  if (!ownedGeometry.has(root)) {
    ownedGeometry.set(root, new Set());
    // Fitted chairs can be replaced when another employee uses the seat. Only
    // this root's newly created buffers are owned here; prototypes are shared.
    root.addEventListener('removed', () => {
      for (const geometry of ownedGeometry.get(root)) geometry.dispose();
    });
  }
  let removed = 0;
  const visit = parent => {
    for (const child of parent.children.slice()) visit(child);
    const groups = new Map();
    for (const mesh of parent.children) {
      const g = mesh.geometry, m = mesh.material;
      if (!mesh.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.children.length ||
          !mesh.visible || !g || !m || Array.isArray(m) || m.transparent ||
          mesh.morphTargetInfluences || g.attributes.skinIndex ||
          Object.keys(g.morphAttributes).length ||
          /^(Monitor|Laptop)[ _]Screen$/.test(mesh.name) ||
          mesh.userData.noMerge || mesh.userData.wallMounted ||
          g.drawRange.start !== 0 || g.drawRange.count !== Infinity) continue;
      mesh.updateMatrix();
      // Reflections require winding reversal; keep those meshes separate.
      if (mesh.matrix.determinant() <= 0) continue;
      const attributes = Object.entries(g.attributes).map(([name,a]) =>
        `${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join('|');
      const key = [m.uuid, !!g.index, attributes, mesh.castShadow, mesh.receiveShadow,
        mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled].join(';');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(mesh);
    }
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const parts = list.map(mesh => {mesh.updateMatrix();return mesh.geometry.clone().applyMatrix4(mesh.matrix);});
      let geometry;
      try {geometry = mergeGeometries(parts, false);} catch (_) {geometry = null;}
      finally {for (const g of parts) g.dispose();}
      if (!geometry) continue;
      const source = list[0], batch = new THREE.Mesh(geometry, source.material);
      batch.name = 'static_batch';
      batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
      batch.renderOrder = source.renderOrder; batch.layers.mask = source.layers.mask;
      batch.frustumCulled = source.frustumCulled;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      parent.add(batch);
      ownedGeometry.get(root).add(geometry);
      for (const mesh of list) parent.remove(mesh);
      // The originals can be shared by the kit prototypes and other chairs.
      // Do not dispose their buffers/materials/textures here.
      removed += list.length - 1;
    }
  };
  visit(root);
  root.userData.staticBatchRemoved = (root.userData.staticBatchRemoved || 0) + removed;
  return root;
}

// Only descendants are fixed. The root is still moved/rotated by the caller.
// Use after fitting (not before the chair backrest has been adjusted).
export function freezeStaticDescendants(root) {
  root.traverse(node => {
    if (node === root) return;
    node.updateMatrix(); node.matrixAutoUpdate = false;
  });
  return root;
}
