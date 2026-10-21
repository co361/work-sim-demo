"""Render the actual revised GLB with the original portrait lighting; never export over it."""
import bpy,json,sys,os
from pathlib import Path
from mathutils import Vector
R=Path.cwd()
ident=int(sys.argv[sys.argv.index('--')+1])
source=Path(os.environ['WORKSIM_PORTRAIT_LIGHTING_DIR'])/f'acnh_{ident}.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
sc=bpy.context.scene
for o in list(bpy.data.objects):
 if o.type not in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
bpy.ops.import_scene.gltf(filepath=str(R/'blender-source'/f'acnh_{ident}-decoded.glb'))
# The import supplies one action slot per rig/shape-key datablock. Select idle
# using its actual NLA slot, then mute all NLA tracks for an unambiguous frame.
for datablock in list(bpy.data.objects)+list(bpy.data.shape_keys):
 ad=datablock.animation_data
 if not ad:continue
 match=None
 for tr in ad.nla_tracks:
  for strip in tr.strips:
   if strip.action and strip.action.name=='idle':match=(strip.action,strip.action_slot)
  tr.mute=True
 if match:ad.action=match[0];ad.action_slot=match[1]
 else:ad.action=None
sc.frame_set(0);bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
head=next(o for o in bpy.data.objects if o.type=='MESH' and (o.name.replace('_',' ').startswith('00 Face') or 'Continuous head' in o.data.name))
def points(o):
 ev=o.evaluated_get(deps);m=ev.to_mesh();p=[ev.matrix_world@v.co for v in m.vertices];ev.to_mesh_clear();return p
pts=points(head);chin=min(p.z for p in pts);top=max(p.z for p in pts);xmin=min(p.x for p in pts);xmax=max(p.x for p in pts)
for o in bpy.data.objects:
 if o.type=='MESH' and (o.name.replace('_',' ').startswith('Hair') or 'hair' in o.data.name.lower()):top=max(top,max(p.z for p in points(o)))
sc.render.engine='CYCLES';sc.cycles.samples=64;sc.cycles.use_denoising=True;sc.cycles.seed=21
sc.render.threads_mode='FIXED';sc.render.threads=4
sc.render.resolution_x=512;sc.render.resolution_y=512;sc.render.resolution_percentage=100
sc.render.film_transparent=True;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA'
cam=sc.camera;cam.data.type='ORTHO';cam.data.ortho_scale=max(top-chin,xmax-xmin)*1.24
target=Vector(((xmin+xmax)/2,0,(top+chin)/2));cam.location=target+Vector((0,-3,.03));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
out=R/'candidate/portraits';out.mkdir(exist_ok=True)
sc.render.filepath=str(out/f'acnh_{ident}.png')
bpy.ops.wm.save_as_mainfile(filepath=str(R/'blender-source'/f'acnh_{ident}-review.blend'))
bpy.ops.render.render(write_still=True)
(R/'evidence'/f'portrait-{ident}.json').write_text(json.dumps({'id':ident,'engine':sc.render.engine,'samples':sc.cycles.samples,'size':[512,512],'view':sc.view_settings.view_transform,'look':sc.view_settings.look,'exposure':sc.view_settings.exposure,'camera':list(cam.location),'target':list(target),'orthoScale':cam.data.ortho_scale,'sourceLighting':str(source),'modelSource':str(R/'blender-source'/f'acnh_{ident}-decoded.glb')},indent=2))
print('PORTRAIT_DONE',ident,flush=True)
