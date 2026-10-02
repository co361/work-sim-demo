import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
// Actual deformed GLB measurements, in character-root coordinates (metres).
// No fallback silently becomes a validated fit. Refresh after a batch JSON update.
const measured = await fetch(new URL('../data/office_seat_profiles.json', import.meta.url),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Seat measurements HTTP '+r.status);return r.json();});
export function getSeatFit(modelId) {
  const key=String(modelId).startsWith('acnh_')?String(modelId):'acnh_'+modelId;
  const entry=measured[key];
  return entry?{...entry.profile,modelId:key,measurementSha256:entry.sourceSha256}:{validated:false,measurementComplete:false,modelId:key};
}
export function createFittedWorkChair(THREE, p) {
  if(!p?.measurementComplete)throw new Error('A measured seat profile is required');
  const g=new THREE.Group();g.name='Fitted_grey_work_chair';g.userData.officeProp=true;
  g.userData.seatFit={...p};
  const leather=new THREE.MeshStandardMaterial({color:'#a8adb0',roughness:.67});
  const edge=new THREE.MeshStandardMaterial({color:'#d1d5d7',roughness:.7});
  const metal=new THREE.MeshStandardMaterial({color:'#696e70',roughness:.4,metalness:.65});
  const rubber=new THREE.MeshStandardMaterial({color:'#343739',roughness:.9});
  [leather,edge,metal,rubber].forEach(m=>m.userData.reviewOwnedMaterial=true);
  function add(name,geo,mat,x,y,z){geo.userData.reviewOwned='geometry';const m=new THREE.Mesh(geo,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.reviewOwned='geometry';g.add(m);return m;}
  function roundedGeometry(w,h,d){
    const bevel=Math.min(.003,d*.20,w*.04,h*.10),a=w/2-bevel,b=h/2-bevel;
    const radius=Math.min(.010,a,b),shape=new THREE.Shape();
    shape.moveTo(-a+radius,-b);shape.lineTo(a-radius,-b);shape.quadraticCurveTo(a,-b,a,-b+radius);shape.lineTo(a,b-radius);shape.quadraticCurveTo(a,b,a-radius,b);shape.lineTo(-a+radius,b);shape.quadraticCurveTo(-a,b,-a,b-radius);shape.lineTo(-a,-b+radius);shape.quadraticCurveTo(-a,-b,-a+radius,-b);
    const geo=new THREE.ExtrudeGeometry(shape,{depth:d-2*bevel,bevelEnabled:true,bevelSize:bevel,bevelThickness:bevel,bevelSegments:3,curveSegments:6,steps:1});geo.translate(0,0,-d/2+bevel);return geo;
  }
  function box(name,w,h,d,mat,x,y,z){return add(name,roundedGeometry(w,h,d),mat,x,y,z);}
  function cylinder(name,r,h,mat,x,y,z){return add(name,new THREE.CylinderGeometry(r,r,h,16),mat,x,y,z);}
  const z=p.chairSeatZ,y=p.chairSeatY,w=p.seatWidth,d=p.seatDepth;
  // Seat upper face equals the measured underside. Padding extends down only.
  box('Seat_cushion',w,.022,d,leather,0,y-.011,z);
  box('Seat_undertray',w-.018,.008,d-.012,metal,0,y-.026,z);
  // 2026-09-29: 긴 머리 인물은 자리 프로필의 backrestZ·backrestHeight 로 등받이만 낮추고/뒤로 뺀다(앉는 위치·좌판은 그대로).
  // 값이 없으면 예전과 같은 등받이(높이 .190, 앞면 seatBackZ).
  const backFront=p.backrestZ??p.seatBackZ;
  const backHeight=p.backrestHeight??.190;
  box('Backrest_leather',w*.96,backHeight,.025,leather,0,y+.003+backHeight/2,backFront-.0125);
  box('Backrest_soft_top',w*.96,.012,.026,edge,0,y+.008+backHeight,backFront-.013);
  box('Backrest_support',.022,.11,.014,metal,0,y+.018,backFront-.033);
  // 등받이를 좌판 뒤로 뺀 자리(긴 머리)는 좌판 아래에서 등받이 기둥까지 가로 연결대를 둔다 — 등받이가 떠 보이지 않게
  if(backFront<p.seatBackZ-.02){ const zA=z-d/2+.01,zB=backFront-.033; box('Backrest_connector',.022,.012,zA-zB,metal,0,y-.032,(zA+zB)/2); }
  // Arm inner faces remain outside the occupied body/garment envelope.
  for(const side of [-1,1]){
    const ax=side*(p.armInnerWidth/2+.008);
    box('Armrest_'+(side<0?'L':'R'),.016,.016,d*.82,leather,ax,p.armY,z+.006);
    box('Arm_support_'+side,.008,Math.max(.01,p.armY-y+.026),.01,metal,ax,(p.armY+y-.026)/2,z-.023);
  }
  const baseY=.026,postBottom=.035,postTop=y-.03;
  cylinder('Height_adjustment_column',.017,Math.max(.012,postTop-postBottom),metal,0,(postTop+postBottom)/2,z);
  cylinder('Wheel_hub',.025,.016,metal,0,baseY,z);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5,reach=.13;
    const spoke=box('Wheel_spoke_'+i,.014,.012,reach,metal,Math.sin(a)*reach/2,baseY, z+Math.cos(a)*reach/2);spoke.rotation.y=a;
    const wheel=cylinder('Caster_'+i,.018,.014,rubber,Math.sin(a)*reach,.018,z+Math.cos(a)*reach);wheel.rotation.z=Math.PI/2;
  }
  return g;
}
