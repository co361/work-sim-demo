# Character repairs — 2026-10-21

The seven character assets have the requested local clothing/hair corrections and portraits rendered from their revised models. Face, body, ears, topology, UVs, textures and skeletal animation channels remain unchanged. Game progress, NCS, evaluation, scenario and broader office performance work are outside this patch.

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

For 18 and 41, garment-only shapes follow each locomotion/transition pose. Exact duplicate and unused shapes were removed without quantization: each model retains 166 pose correctives and 1 seated target. `office-garment-loader.js` reads tagged sparse targets before GLTFLoader would expand them; `office-garment-motion.js` evaluates active samples after the mixer. The GPU retains only the seated target. Model files retain standard morph animation channels for Blender and ordinary GLB viewers. Ship both helpers and office runtime changes together with the GLBs; asset-only cherry-picks can use much more memory. Cached roster/model references and the service worker version are updated.

Validation: 7 decoded-asset invariant audits; 56 matched static pairs, 140 matched motion pairs, 80 matched close-up pairs; 216 lower-garment contact frames across 12 walk/run/transition clips per affected garment. No sampled penetration greater than 1 mm; minimum projected clearance 2.54 mm. Final comparison, motion and detail sheets plus 24 transition screenshots were visually reviewed. Four helper/loader tests pass. A further 366 pose/blend samples compared the first reviewed repair with the compacted candidate: bones exact, maximum garment position difference 1.49e-8 m, normal component difference 5.96e-8. Eight matching close-ups were visually reviewed. See [verification summary](verification-summary.json), [model audit](model-audit.json) and [run audit](final-runtime-audit.json).

Seven 512×512 RGBA portraits were rendered in Blender 5.2.1/Cycles with 64 samples using the original portrait lighting. Texture bytes and vertex/triangle counts are unchanged. Lossless data compaction saved 3,986,288 bytes from the first repair; GLBs now increase by 21,422,252 bytes over the original. On this M5/16 GB Mac, repeated headless Chrome comparisons reduced heap median from the first repair's 340.8/420.4 MB to 154.9/196.4 MB for18/41. Original medians were104.4/201.4 MB, so18 still increases memory. Walking/running helper mean cost is0.25–0.54 ms; the frame interval p95 stays16.7–16.8 ms in the local single-character test. Synthetic4x CPU comparisons also completed. These are not cold-WAN, peak-memory, full-office or low-end hardware guarantees. Real Safari validation is deferred by the explicit no-foreground instruction. See [performance review](PERFORMANCE_REVIEW.md) and [raw summary](perf-review/summary.json).

Originals are recoverable from work-sim-v2 `ef02d5d71a1c22c35d4c612be22b2fde151320e4` (same character bytes at `2bdb1d5`) and work-sim-demo `8fc9a1b9fe8fac8d6c45ca8efb09fea55646fffd`, and the task's `baseline/` copies. Editable review sources are saved separately as `blender-source/acnh_<ID>-review.blend`; original local Blender files were never overwritten. Those editable sources preserve the first reviewed repair; final GLBs additionally apply the documented storage compaction. Final hashes are in [asset manifest](asset-manifest.json). Authoring scripts live in `tools/character-repairs-20261021/`.

This patch is prepared for coordinated review/release. It does not deploy itself.
