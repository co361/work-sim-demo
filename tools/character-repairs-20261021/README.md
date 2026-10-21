Character repair authoring scripts (2026-10-21)

The production GLBs are authoritative. These scripts preserve the exact baseline topology, vertex colors, UVs, textures, body/face/ear geometry and skeletal animation channels. The only changed animation channels are garment weights for18/41. Run from a scratch working directory with baseline/, candidate/ and evidence/ subfolders; do not run over a production checkout.

Baseline: work-sim-v2 ef02d5d71a1c22c35d4c612be22b2fde151320e4; equivalent character assets in work-sim-demo 8fc9a1b9fe8fac8d6c45ca8efb09fea55646fffd. Extract assets/native_staff50/characters/acnh_{18,21,38,40,41,52,54}.glb with git show. Install the pinned dependencies in this tools folder.

Order: repair52.mjs; repair-models.mjs 18 21 38 40 41 54; sample-garment-poses.mjs 18 41 against the candidate office runtime; fit-garment-motion.mjs 18 41; set worksimGarmentMotion:1 on the18/41 garment node and mesh extras; clean-motion-normal-noise.mjs 18 41; pack-lossless.mjs 18 21 38 40 41 52 54; audit-models.mjs.

The sampler expects the review server at127.0.0.1:8994/after/ and the current inspection API. It freezes characters, samples their real skin matrices, and writes the input digest so a different model cannot silently receive those corrective shapes. Final motion correctives require office-garment-motion.js in the game runtime. Raw GLB viewers and Blender can also evaluate the stored shapes directly.

Do not run speculative PCA or the rejected hem-weight experiment: neither is part of these final assets. The normal cleanup removes only newly introduced corrective-normal roundoff below1e-7 per component. Base normals, mesh positions and textures are unaffected. pack-lossless verifies all reachable decoded accessors and all image bytes exactly and performs no geometry quantization.

render-portrait.py uses the original local revision9 Blender lighting, imports a losslessly decoded final GLB, selects its actual idle action slot and renders512px RGBA at64 Cycles samples. The original .blend is only read; a separate review .blend is saved. Run it from the scratch directory and set WORKSIM_PORTRAIT_LIGHTING_DIR to the original revision9 characters directory. Local execution evidence and the seven Blender review copies are in the delegated task folder, listed in the handoff report.
