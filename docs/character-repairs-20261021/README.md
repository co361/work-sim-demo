# Character repairs — 2026-10-21

The seven character assets have the requested local clothing/hair corrections and portraits rendered from their revised models. Face, body, ears, topology, UVs, textures and skeletal animation channels remain unchanged. Game progress, NCS, evaluation, scenario and performance work are outside this patch.

| User-facing character | Model | Correction | Before/after |
| --- | --- | --- | --- |
| 조민서 | 52 | Attach the floating collar to the shirt, using its surface and skin weights | [52](compare-52.jpg) |
| 장 주임 | 54 | Relax the anatomical left upper sleeve crease; restore modest volume along the part | [54](compare-54.jpg) |
| 오 대리 | 18 | Refine the hair silhouette and knit surface; remove thigh-through-hem in locomotion | [18](compare-18.jpg) |
| 신 주임 | 38 | Join narrow hair gaps behind both ears, preserving the exposed ear edge | [38](compare-38.jpg) |
| 류하진 | 40 | Extend the nape about 6.8 cm; enable the existing additive run posture correction | [40](compare-40.jpg) |
| 조성민 팀장 | 41 | Extend the shirt hem 2.5 cm; smooth the waist fold and correct moving-thigh clearance | [41](compare-41.jpg) |
| Introduction portrait: 이수아 | 21 | Bridge the ear-top hair notch and replace the stale portrait | [21](compare-21.jpg) |

The runtime story binding resolves the user-facing names above. Underlying roster labels are unchanged. Before is the upper row of comparison sheets; after is the lower row. Camera, target, lighting, phase and blink settings were locked.

The run reference is character 40. Identical shared jog channels in the inspected models identify the authored clip's forward upper-body pitch as the cause, rather than a character 40 retargeting defect. Only 40 is newly opted into the pre-existing additive correction: sampled forward pitch falls from 13.52–13.84° to 7.81–8.20°. Idle/walk bone transforms remain exact, and hips/legs/feet/toes remain exact in all sampled poses. Other characters' run flags and the shared clip are unchanged.

For 18 and 41, garment-only shapes follow each locomotion/transition pose. `office-garment-motion.js` evaluates active sparse corrective samples on the CPU after the mixer. The GPU retains 1 and 3 original shapes respectively, instead of 178 extra targets. Model files retain standard morph animation channels for Blender and ordinary GLB viewers. Ship the helper and office runtime changes together with the GLBs; asset-only cherry-picks can use much more GPU memory. Cached roster/model references and the service worker version are updated.

Validation: 7 decoded-asset invariant audits; 56 matched static pairs, 140 matched motion pairs, 80 matched close-up pairs; 216 lower-garment contact frames across 12 walk/run/transition clips per affected garment. No sampled penetration greater than 1 mm; minimum projected clearance 2.54 mm. Final comparison, motion and detail sheets plus 24 transition screenshots were visually reviewed. Two interpolation/reset tests pass. See [verification summary](verification-summary.json), [model audit](model-audit.json) and [run audit](final-runtime-audit.json).

Seven 512×512 RGBA portraits were rendered in Blender 5.2.1/Cycles with 64 samples using the original portrait lighting. Texture bytes and vertex/triangle counts are unchanged. GLBs together increase by 25,408,540 bytes, predominantly the 18/41 corrective data. Full office FPS and Safari have not been benchmarked. Contact checks sample projected garment surfaces; they are not an exhaustive collision proof for every possible blend.

Originals are recoverable from work-sim-v2 `ef02d5d71a1c22c35d4c612be22b2fde151320e4` and work-sim-demo `8fc9a1b9fe8fac8d6c45ca8efb09fea55646fffd`, and the task's `baseline/` copies. Editable review sources are saved separately as `blender-source/acnh_<ID>-review.blend`; original local Blender files were never overwritten. Final hashes are in [asset manifest](asset-manifest.json). Authoring scripts live in `tools/character-repairs-20261021/`.

This patch is prepared for coordinated review/release. It does not deploy itself.
