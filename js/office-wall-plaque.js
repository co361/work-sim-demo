// A physical wall-mounted sign. Its text is baked onto a fixed mesh, never a Sprite.
// 2026-09-29 v2(사용자 「팻말 너무 크고 초록 줄 이상해 — 다 없애고 더 작게」): 문 폭(0.53)보다 훨씬 작은 얇은 판,
// 짙은 회색 한 가지 바탕 + 팀 이름 글자만. 테두리·색 띠·세로 줄 없음. 기존·가안(?look=cozy) 두 모습이 같은 명패를 쓴다.
export function createWallTeamPlaque(THREE, text, {width=.30,height=.085,depth=.006}={}) {
  const group=new THREE.Group();group.name='Wall_Team_Plaque_'+text;group.userData.wallMounted=true;group.userData.depth=depth;
  const W=1024,H=Math.round(1024*height/width);
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#3d4043';ctx.fillRect(0,0,W,H);
  const font=s=>`500 ${s}px "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  let size=Math.round(H*.5);ctx.font=font(size);
  while(ctx.measureText(text).width>W*.8&&size>24){size-=2;ctx.font=font(size);}
  ctx.fillStyle='#f3f0e9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,W/2,H/2+size*.04);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;map.userData.reviewOwnedTexture=true;
  const plateMat=new THREE.MeshStandardMaterial({color:'#3d4043',roughness:.6});
  const faceMat=new THREE.MeshStandardMaterial({map,roughness:.6});
  for(const m of [plateMat,faceMat])m.userData.reviewOwnedMaterial=true;
  const plate=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),plateMat);plate.name='Plaque_plate';group.add(plate);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(width,height),faceMat);face.position.z=depth/2+.0004;face.name='Plaque_fixed_print';group.add(face);
  group.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=true;o.userData.reviewOwned='geometry';}});
  return group;
}
