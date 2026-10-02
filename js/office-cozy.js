/* 2026-09-29 사무실 「아늑한 화이트」 가안(?look=cozy). 기본 화면은 건드리지 않는다 — office.html 이 COZY 일 때만 부른다.
   기준: docs/OFFICE_WHITE_REDESIGN_20260929.md(따뜻한 화이트 벽·책상, 밝은 회색 의자·금속, 연한 청회색 창) + 동물의 숲식 아늑함
   (원목 바닥·러그·가죽은 제 색, 팀마다 다른 포인트 색과 소품). 좌석·동선·충돌 상자 계약은 office.html 쪽 그대로다. */

/* 팀별 포인트 색(러그·파티션 천·소파 쿠션·명패 띠) — 채도를 낮춘 따뜻한 톤 */
/* 2026-09-29 참고 이미지(v2/assets/office_ref: 동물의 숲 HHP 서버실·NL 관리사무소·포켓캠프 사무실·강아지 사무실)에 맞춤:
   회색 카펫 타일 바닥 · 흰/크림 책상 · 연회색 금속 가구 · 민트빛 블라인드 · 색 있는 사무 의자 · 전구 펜던트.
   팀 구분은 의자 색·팀 소품·액자로 한다(바닥 러그는 카펫 톤 안에서 조금 진한 구역만) */
export const COZY_TEAM={
  cs:  {accent:'#d9825b',chair:'#d9825b',motto:'오늘도 웃으며 응대'},
  logi:{accent:'#3e8f86',chair:'#3e8f86',motto:'정확한 출고, 안전한 적재'},
  acct:{accent:'#48609e',chair:'#4a66a8',motto:'숫자는 정직하게'},
  ga:  {accent:'#9a7b35',chair:'#c29a3a',motto:'모두가 편한 사무실'},
  rec: {accent:'#95507f',chair:'#9b5a86',motto:'좋은 동료를 찾아요'},
  plan:{accent:'#3a6a98',chair:'#3f73b4',motto:'한 걸음 앞을 봐요'},
  qc:  {accent:'#4c8a44',chair:'#4f8f47',motto:'기록이 품질이다'},
  pr:  {accent:'#b0496f',chair:'#c0567c',motto:'이야기를 전해요'},
  edu: {accent:'#a88428',chair:'#caa033',motto:'함께 배우고 자라요'},
  buy: {accent:'#7a6a55',chair:'#6f7d8c',motto:'좋은 조건, 믿을 거래'},
};
for(const t of Object.values(COZY_TEAM)){ t.rug='#8f8d97'; t.rug2='#9896a0'; t.fab='#d7dbd9'; t.wain='#dfe6e2'; }
export const COZY_BG='#e7e6e2';

const tex=(THREE,w,h,draw,rep)=>{ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  if(rep){ t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rep[0],rep[1]); } return t; };
/* 난수 대신 고정 수열(방을 다시 지어도 무늬가 같다) */
const rng=(seed)=>{ let s=seed>>>0||1; return ()=>((s=Math.imul(s^(s>>>15),2246822507)^Math.imul(s^(s>>>13),3266489909),(s>>>0)/4294967296)); };

/* 밝은 원목 마루(가로 판, 이음매 엇갈림) */
export function cozyFloorMap(THREE,rx,ry){ return tex(THREE,512,512,(g,w,h)=>{ const r=rng(7);   /* 카펫 타일 2×2(참고 1·2·4) */
  for(let y=0;y<2;y++) for(let x=0;x<2;x++){ g.fillStyle=((x+y)%2)?'#a2a0a8':'#aba9b0'; g.fillRect(x*256,y*256,256,256); }
  for(let i=0;i<26000;i++){ g.fillStyle=r()<0.5?'rgba(0,0,0,0.06)':'rgba(255,255,255,0.05)'; g.fillRect(r()*w,r()*h,1.6,1.6); }
  g.fillStyle='rgba(60,58,70,0.18)'; for(const k of [0,256]){ g.fillRect(k,0,1.5,h); g.fillRect(0,k,w,1.5); } },[rx,ry]); }
/* 따뜻한 크림 벽(얼룩 점 없음 — 위로 갈수록 살짝 밝게) */
export function cozyWallMap(THREE){ return tex(THREE,64,256,(g,w,h)=>{ const gr=g.createLinearGradient(0,0,0,h); gr.addColorStop(0,'#f7f6f1'); gr.addColorStop(0.6,'#f2f1ec'); gr.addColorStop(1,'#ecebe5'); g.fillStyle=gr; g.fillRect(0,0,w,h); }); }
/* 천장: 한 가지 색(예전 반점 무늬 삭제) */
export function cozyCeilMap(THREE){ return tex(THREE,8,8,(g,w,h)=>{ g.fillStyle='#f6f5f1'; g.fillRect(0,0,w,h); }); }
/* 복도 바닥: 따뜻한 베이지 타일 */
export function cozyTileMap(THREE,rx,ry){ return tex(THREE,256,256,(g,w,h)=>{ g.fillStyle='#e9dfcf'; g.fillRect(0,0,w,h);
  for(let y=0;y<2;y++) for(let x=0;x<2;x++){ g.fillStyle=((x+y)%2)?'#f1e9dc':'#ece2d3'; g.fillRect(x*128+2,y*128+2,124,124); } },[rx,ry]); }

/* 재질 톤 바꾸기(같은 재질 객체의 색만 바꾼다 — 참조하는 코드는 그대로) */
export function applyCozyMaterials(THREE,M,{RW,RD}){
  M.floor.map=cozyFloorMap(THREE,RW/1.2,RD/1.2); M.floor.roughness=0.95; M.floor.needsUpdate=true;
  M.wall.map=cozyWallMap(THREE); M.wall.needsUpdate=true;
  M.ceil.map=cozyCeilMap(THREE); M.ceil.needsUpdate=true;
  const set=(k,c,r)=>{ if(!M[k]) return; M[k].color.set(c); if(r!==undefined) M[k].roughness=r; };
  set('base','#d5d9d6'); set('cream','#f1ede2'); set('wood','#c9a57a',0.7); set('woodDark','#8f6a48');
  set('leather','#4f8a70',0.6); set('leatherLight','#7aa892',0.6); set('metal','#c9cdcc'); set('white','#f7f6f2');
  set('pot','#eeece6'); set('fabric','#e3e6e3'); set('blind','#bcdcd5'); set('doorPanel','#f1f0ea'); set('doorFrame','#b9bebc');
  M.trim=new THREE.MeshStandardMaterial({color:'#cfd8d4',roughness:0.75});   /* 벽 아랫단 몰딩(연한 민트 회색, 참고 1) */
  M.deskTop=new THREE.MeshStandardMaterial({color:'#ece6d4',roughness:0.6});   /* 책상 상판 크림(참고 1·3) */
  M.cabinet=new THREE.MeshStandardMaterial({color:'#dde2df',roughness:0.55,metalness:0.15});   /* 연회색 철제 수납장(참고 1) */
  M.cabinetFace=new THREE.MeshStandardMaterial({color:'#eef1ee',roughness:0.5,metalness:0.1});
  return M; }

/* ---------- 작은 도우미 ---------- */
function kit(THREE){
  const mat=(c,r=0.8,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:r},o));
  const box=(w,h,d,m)=>{ const x=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); x.castShadow=x.receiveShadow=true; return x; };
  const cyl=(rt,rb,h,m,s=16)=>{ const x=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,s),m); x.castShadow=x.receiveShadow=true; return x; };
  const sph=(r,m,s=12)=>{ const x=new THREE.Mesh(new THREE.SphereGeometry(r,s,s),m); x.castShadow=true; return x; };
  const at=(o,x,y,z,ry=0)=>{ o.position.set(x,y,z); o.rotation.y=ry; return o; };
  return {mat,box,cyl,sph,at};
}
/* 화분(둥근 잎 덩어리) */
function pottedPlant(THREE,K,h=0.34,potCol='#c9835a',leaf='#6fa35a'){ const g=new THREE.Group();
  const pot=K.cyl(0.07,0.055,0.1,K.mat(potCol,0.85),14); pot.position.y=0.05; g.add(pot);
  const L=K.mat(leaf,0.9), L2=K.mat('#5a8f4a',0.9);
  for(const [x,y,z,r,m] of [[0,h*0.62,0,0.085,L],[0.05,h*0.5,0.02,0.06,L2],[-0.05,h*0.52,-0.02,0.062,L],[0.01,h*0.8,0.01,0.06,L2]]){ const s=K.sph(r,m); s.position.set(x,y,z); g.add(s); }
  return g; }

/* 팀 소품 모음(뒤벽 왼쪽 구석, 종이상자 자리). 발자국 x∈[-0.29,0.29] z∈[-0.26,0.26], 높이 0.95 이하.
   원점 = 바닥 가운데, +z 가 방 안쪽(앞). */
export function cozyTeamCorner(THREE,team,M){
  const K=kit(THREE), g=new THREE.Group(); g.name='CozyTeamCorner_'+team; const T=COZY_TEAM[team]||COZY_TEAM.cs;
  const A=K.mat(T.accent,0.7), wood=M.wood, dark=M.woodDark, paper=M.paper, kraft=K.mat('#c9a275',0.95);
  const shelf=(w,h,d,tiers)=>{ const s=new THREE.Group(); for(const sx of [-1,1]){ const side=K.box(0.02,h,d,wood); side.position.set(sx*(w/2-0.01),h/2,0); s.add(side); }
    for(let i=0;i<=tiers;i++){ const b=K.box(w,0.02,d,wood); b.position.set(0,0.01+i*(h-0.02)/tiers,0); s.add(b); } const back=K.box(w,h,0.01,dark); back.position.set(0,h/2,-d/2+0.005); s.add(back); return s; };
  switch(team){
    case 'cs':{ const t=K.box(0.56,0.03,0.3,wood); t.position.set(0,0.4,0); g.add(t); for(const [x,z] of [[-0.25,-0.12],[0.25,-0.12],[-0.25,0.12],[0.25,0.12]]){ const l=K.cyl(0.012,0.012,0.4,dark,8); l.position.set(x,0.2,z); g.add(l); }
      const vase=K.cyl(0.035,0.045,0.12,K.mat('#f3e6d3',0.4),14); vase.position.set(-0.15,0.475,0); g.add(vase);
      for(const [x,z,c] of [[-0.17,0.01,'#f08a8a'],[-0.13,-0.02,'#f7c46b'],[-0.15,0.03,'#f4a3c0'],[-0.12,0.02,'#f08a8a']]){ const st=K.cyl(0.004,0.004,0.1,K.mat('#5f9a4d'),6); st.position.set(x,0.58,z); g.add(st); const fl=K.sph(0.025,K.mat(c,0.6)); fl.position.set(x,0.64,z); g.add(fl); }
      const hs=K.cyl(0.006,0.006,0.16,M.metal,8); hs.position.set(0.12,0.495,0); g.add(hs); const band=new THREE.Mesh(new THREE.TorusGeometry(0.05,0.008,8,20,Math.PI),K.mat('#3b3b40',0.5)); band.position.set(0.12,0.585,0); g.add(band);
      for(const sx of [-1,1]){ const cup=K.cyl(0.022,0.022,0.02,A,12); cup.rotation.z=Math.PI/2; cup.position.set(0.12+sx*0.05,0.555,0); g.add(cup); }
      const cards=K.box(0.12,0.012,0.08,K.mat('#fff4e6')); cards.position.set(0.05,0.422,0.08); cards.rotation.y=0.2; g.add(cards); break; }
    case 'logi':{ for(const [x,y,z,s,ry] of [[-0.12,0.13,-0.06,0.26,0.05],[-0.12,0.39,-0.06,0.24,-0.12],[0.14,0.1,-0.08,0.2,0.3]]){ const b=K.box(s,s,s,kraft); b.position.set(x,y,z); b.rotation.y=ry; g.add(b); const tp=K.box(s+0.004,0.02,0.05,K.mat('#e9d9b6')); tp.position.set(x,y+s/2,z); tp.rotation.y=ry; g.add(tp); }
      const cart=new THREE.Group(); cart.position.set(0.18,0,0.12); cart.rotation.y=-0.4; g.add(cart); const plate=K.box(0.2,0.02,0.1,A); plate.position.set(0,0.03,0.05); cart.add(plate);
      for(const sx of [-1,1]){ const rail=K.cyl(0.01,0.01,0.52,A,8); rail.position.set(sx*0.08,0.28,0); cart.add(rail); const wh=K.cyl(0.035,0.035,0.02,K.mat('#2f2f33'),12); wh.rotation.z=Math.PI/2; wh.position.set(sx*0.1,0.035,-0.02); cart.add(wh); }
      const top=K.cyl(0.01,0.01,0.18,A,8); top.rotation.z=Math.PI/2; top.position.set(0,0.54,0); cart.add(top); break; }
    case 'acct':{ const s=shelf(0.56,0.62,0.26,2); g.add(s); const cols=['#34497e','#48609e','#6b7fb8','#2c3b62','#9aa8cf','#34497e','#b24a3a','#48609e'];
      for(let tier=0;tier<2;tier++) for(let i=0;i<7;i++){ const b=K.box(0.055,0.25,0.2,K.mat(cols[(i+tier*3)%cols.length],0.7)); b.position.set(-0.24+i*0.07,0.02+tier*0.3+0.135,0.01); g.add(b); const lb=K.box(0.03,0.05,0.002,paper); lb.position.set(-0.24+i*0.07,0.02+tier*0.3+0.19,0.112); g.add(lb); }
      const calc=K.box(0.12,0.02,0.16,K.mat('#3a3a40',0.5)); calc.position.set(0.12,0.64,0.02); calc.rotation.y=-0.2; g.add(calc); const disp=K.box(0.09,0.004,0.035,K.mat('#b9d2a8',0.3)); disp.position.set(0.115,0.652,-0.035); disp.rotation.y=-0.2; g.add(disp); break; }
    case 'ga':{ const s=shelf(0.56,0.6,0.3,2); g.add(s);
      for(const [x,tier,c] of [[-0.18,0,'#ffffff'],[-0.05,0,'#fdfdf7'],[0.1,0,'#f7f2e6']]){ for(let k=0;k<3;k++){ const ream=K.box(0.12,0.05,0.18,K.mat(c,0.95)); ream.position.set(x,0.045+k*0.052+tier*0.3,0); g.add(ream); } const wrap=K.box(0.121,0.02,0.181,A); wrap.position.set(x,0.1,0); g.add(wrap); }
      for(const [x,c] of [[-0.15,'#8fc2d8'],[0.02,'#f2c4c4'],[0.17,'#c9e0b0']]){ const tb=K.box(0.13,0.09,0.12,K.mat(c,0.9)); tb.position.set(x,0.37,0.02); g.add(tb); }
      const tool=K.box(0.22,0.1,0.11,K.mat('#c8433a',0.6)); tool.position.set(0.02,0.66,0); g.add(tool); const handle=new THREE.Mesh(new THREE.TorusGeometry(0.04,0.008,6,14,Math.PI),K.mat('#3a3a40')); handle.position.set(0.02,0.71,0); g.add(handle); break; }
    case 'rec':{ const bench=K.box(0.56,0.05,0.26,M.leather); bench.position.set(0,0.27,0); g.add(bench); for(const sx of [-1,1]){ const l=K.box(0.03,0.25,0.22,dark); l.position.set(sx*0.24,0.125,0); g.add(l); }
      const tray=K.box(0.24,0.04,0.18,wood); tray.position.set(-0.12,0.315,0); g.add(tray); for(let k=0;k<3;k++){ const f=K.box(0.21,0.008,0.15,K.mat(['#fbf2e4','#f3d2e3','#dcb3cf'][k])); f.position.set(-0.12,0.34+k*0.009,0); f.rotation.y=k*0.08; g.add(f); }
      const p=pottedPlant(THREE,K,0.3,'#e6d3c1','#7fae62'); p.position.set(0.16,0.295,0); g.add(p);
      const stand=K.box(0.16,0.2,0.01,K.mat('#fff9f1')); stand.position.set(0.02,0.4,-0.1); stand.rotation.x=-0.18; g.add(stand); const stripe=K.box(0.16,0.03,0.012,A); stripe.position.set(0.02,0.48,-0.112); stripe.rotation.x=-0.18; g.add(stripe); break; }
    case 'plan':{ const easel=new THREE.Group(); easel.position.set(0,0,0); g.add(easel);
      for(const [x,z,rz] of [[-0.2,0.05,0.08],[0.2,0.05,-0.08]]){ const leg=K.box(0.025,0.92,0.025,wood); leg.position.set(x,0.46,z); leg.rotation.z=rz; easel.add(leg); } const back=K.box(0.025,0.9,0.025,wood); back.position.set(0,0.45,-0.18); back.rotation.x=0.22; easel.add(back);
      const board=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.38,0.015),[M.white,M.white,M.white,M.white,new THREE.MeshStandardMaterial({map:tex(THREE,256,196,(c,w,h)=>{ c.fillStyle='#fdfbf6'; c.fillRect(0,0,w,h); c.strokeStyle='#c9bba6'; c.lineWidth=3; c.strokeRect(2,2,w-4,h-4); const v=[40,70,55,95,120]; v.forEach((y,i)=>{ c.fillStyle=i===4?T.accent:'#9dbbdb'; c.fillRect(34+i*42,h-24-y,28,y); }); c.strokeStyle='#e0845a'; c.lineWidth=4; c.beginPath(); v.forEach((y,i)=>{ const X=48+i*42,Y=h-34-y; i?c.lineTo(X,Y):c.moveTo(X,Y); }); c.stroke(); }),roughness:0.8}),M.white]);
      board.position.set(0,0.66,0.07); board.castShadow=true; easel.add(board); const ledge=K.box(0.52,0.02,0.05,wood); ledge.position.set(0,0.46,0.08); easel.add(ledge);
      for(const [x,c] of [[-0.12,'#d9825b'],[-0.08,'#3a6a98'],[0.1,'#4c8a44']]){ const mk=K.cyl(0.007,0.007,0.07,K.mat(c,0.5),8); mk.rotation.z=Math.PI/2; mk.position.set(x,0.48,0.09); easel.add(mk); } break; }
    case 'qc':{ const t=K.box(0.56,0.03,0.32,M.white); t.position.set(0,0.42,0); g.add(t); for(const [x,z] of [[-0.25,-0.13],[0.25,-0.13],[-0.25,0.13],[0.25,0.13]]){ const l=K.cyl(0.014,0.014,0.41,M.metal,8); l.position.set(x,0.205,z); g.add(l); }
      const lampBase=K.cyl(0.04,0.05,0.02,K.mat('#f3f0e8'),14); lampBase.position.set(-0.18,0.445,-0.06); g.add(lampBase); const arm=K.cyl(0.008,0.008,0.26,K.mat('#f3f0e8'),8); arm.position.set(-0.15,0.57,-0.02); arm.rotation.z=-0.35; g.add(arm);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(0.06,0.012,10,24),A); ring.position.set(-0.08,0.68,0.04); ring.rotation.x=-1.1; g.add(ring); const lens=new THREE.Mesh(new THREE.CircleGeometry(0.052,20),new THREE.MeshStandardMaterial({color:'#e8f3f7',transparent:true,opacity:0.5,roughness:0.1})); lens.position.copy(ring.position); lens.rotation.x=-1.1-Math.PI/2; g.add(lens);
      for(const [x,z,c] of [[0.08,-0.05,'#f2f2ee'],[0.18,0.06,'#c9e0b0'],[0.02,0.08,'#f7e3b5']]){ const b=K.box(0.08,0.05,0.08,K.mat(c,0.8)); b.position.set(x,0.46,z); g.add(b); }
      const clip=K.box(0.12,0.006,0.16,K.mat('#8b6a45')); clip.position.set(0.14,0.44,-0.08); clip.rotation.y=0.3; g.add(clip); const sheet=K.box(0.1,0.004,0.13,paper); sheet.position.set(0.14,0.446,-0.08); sheet.rotation.y=0.3; g.add(sheet);
      const chk=K.box(0.03,0.002,0.008,K.mat('#4c8a44')); chk.position.set(0.14,0.449,-0.1); chk.rotation.y=0.3; g.add(chk); break; }
    case 'pr':{ const tri=new THREE.Group(); tri.position.set(0.12,0,0.02); g.add(tri); for(let i=0;i<3;i++){ const a=i*Math.PI*2/3; const leg=K.cyl(0.008,0.008,0.62,K.mat('#2f2f33',0.5),8); leg.position.set(Math.sin(a)*0.1,0.3,Math.cos(a)*0.1); leg.rotation.set(Math.cos(a)*0.18,0,-Math.sin(a)*0.18); tri.add(leg); }
      const cam=K.box(0.12,0.08,0.07,K.mat('#2f2f33',0.4)); cam.position.set(0,0.64,0); tri.add(cam); const lensC=K.cyl(0.028,0.03,0.06,K.mat('#1b1b1e',0.3),14); lensC.rotation.x=Math.PI/2; lensC.position.set(0,0.64,0.06); tri.add(lensC); const dot=K.sph(0.008,A); dot.position.set(0.04,0.69,0.03); tri.add(dot);
      const banner=new THREE.Group(); banner.position.set(-0.16,0,-0.08); g.add(banner); const baseB=K.box(0.26,0.04,0.08,K.mat('#c9c3ba')); baseB.position.y=0.02; banner.add(baseB);
      const bm=new THREE.MeshStandardMaterial({map:tex(THREE,128,320,(c,w,h)=>{ c.fillStyle=T.accent; c.fillRect(0,0,w,h); c.fillStyle='#fff6f0'; c.beginPath(); c.arc(w/2,h*0.3,34,0,Math.PI*2); c.fill(); c.fillStyle=T.accent; c.font='bold 30px sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText('PR',w/2,h*0.3); c.fillStyle='#fff6f0'; c.fillRect(20,h*0.55,w-40,8); c.fillRect(20,h*0.62,w-60,8); c.fillRect(20,h*0.69,w-50,8); }),roughness:0.8});
      const bn=new THREE.Mesh(new THREE.PlaneGeometry(0.24,0.62),bm); bn.position.set(0,0.35,0.001); banner.add(bn); const bpole=K.cyl(0.006,0.006,0.66,M.metal,6); bpole.position.set(0,0.35,-0.01); banner.add(bpole); break; }
    case 'edu':{ const easel=new THREE.Group(); easel.position.set(-0.08,0,-0.02); g.add(easel);
      for(const [x,rz] of [[-0.16,0.06],[0.16,-0.06]]){ const leg=K.box(0.022,0.9,0.022,wood); leg.position.set(x,0.45,0.04); leg.rotation.z=rz; easel.add(leg); } const back=K.box(0.022,0.88,0.022,wood); back.position.set(0,0.44,-0.15); back.rotation.x=0.2; easel.add(back);
      const pad=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.46,0.01),[paper,paper,paper,paper,new THREE.MeshStandardMaterial({map:tex(THREE,160,184,(c,w,h)=>{ c.fillStyle='#fffdf8'; c.fillRect(0,0,w,h); c.fillStyle=T.accent; c.fillRect(0,0,w,14); c.fillStyle='#7a6a55'; for(let i=0;i<6;i++) c.fillRect(18,34+i*22,w-36-(i*13)%40,4); c.fillStyle='#d9825b'; c.beginPath(); c.arc(w-30,h-28,12,0,Math.PI*2); c.fill(); }),roughness:0.9}),paper]);
      pad.position.set(0,0.64,0.07); pad.castShadow=true; easel.add(pad); const clampBar=K.box(0.42,0.03,0.03,dark); clampBar.position.set(0,0.88,0.07); easel.add(clampBar);
      for(let k=0;k<4;k++){ const bk=K.box(0.17,0.035,0.13,K.mat(['#d9825b','#48609e','#a88428','#4c8a44'][k],0.8)); bk.position.set(0.19,0.018+k*0.036,0.1); bk.rotation.y=k*0.12; g.add(bk); } break; }
    case 'buy':{ const s=shelf(0.56,0.66,0.28,2); g.add(s); const cols=['#d9825b','#7a6a55','#8fc2b8','#e6d08f','#b4c0de','#dd9cb2'];
      for(let tier=0;tier<3;tier++) for(let i=0;i<3;i++){ if(tier===2&&i===1) continue; const sz=0.1+((i+tier)%2)*0.03; const b=K.box(sz+0.03,sz,0.14,K.mat(cols[(i+tier*2)%cols.length],0.8)); b.position.set(-0.17+i*0.17,0.02+tier*0.32+sz/2,0.02); if(tier<2) g.add(b); }
      for(let k=0;k<3;k++){ const cat=K.box(0.2,0.012,0.15,K.mat(['#fbf2e4','#e8dcc6','#d4c6b2'][k])); cat.position.set(0.05,0.674+k*0.013,0.02); cat.rotation.y=k*0.1-0.1; g.add(cat); }
      const tag=K.box(0.07,0.04,0.004,A); tag.position.set(-0.17,0.29,0.142); g.add(tag); break; }
  }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; } });
  return g; }

/* 앞벽(카메라 쪽) 낮은 소품 — 기본 카메라 앞을 가리던 키 큰 캐비닛·책장 자리. 발자국은 그대로, 높이만 낮다 */
export function cozyLowPlanter(THREE,M,w=0.53,d=0.27){ const K=kit(THREE), g=new THREE.Group();
  const b=K.box(w,0.26,d,M.wood); b.position.y=0.13; g.add(b); const soil=K.box(w-0.04,0.02,d-0.04,K.mat('#6b4d34',1)); soil.position.y=0.265; g.add(soil);
  for(let i=0;i<3;i++){ const p=pottedPlant(THREE,K,0.3,'#c9835a',i%2?'#6fa35a':'#7fb069'); p.position.set(-w/2+0.1+i*(w-0.2)/2,0.2,0); p.children[0].visible=false; g.add(p); }
  return g; }
export function cozyLowBookshelf(THREE,M,w=0.47,d=0.21){ const K=kit(THREE), g=new THREE.Group(); const h=0.42;
  for(const sx of [-1,1]){ const s=K.box(0.02,h,d,M.wood); s.position.set(sx*(w/2-0.01),h/2,0); g.add(s); } for(let i=0;i<3;i++){ const b=K.box(w,0.02,d,M.wood); b.position.set(0,0.01+i*0.2,0); g.add(b); }
  const cols=['#d9825b','#48609e','#e6d08f','#4c8a44','#b0496f','#7a6a55']; for(let t=0;t<2;t++){ let x=-w/2+0.04; let k=t*2; while(x<w/2-0.06){ const bw=0.028+((k*7)%3)*0.008, bh=0.12+((k*5)%4)*0.015; const bk=K.box(bw,bh,d*0.7,K.mat(cols[k%cols.length],0.85)); bk.position.set(x+bw/2,0.02+t*0.2+bh/2,0); g.add(bk); x+=bw+0.004; k++; } }
  const p=pottedPlant(THREE,K,0.22,'#f3e6d3','#6fa35a'); p.position.set(w/2-0.1,0.42,0); g.add(p); return g; }

/* 벽 액자(팀 한 줄 소개) — 벽 고정 소품, 카메라를 따라 돌지 않는다. +z 가 앞면 */
export function cozyTeamFrame(THREE,team){ const T=COZY_TEAM[team]||COZY_TEAM.cs; const g=new THREE.Group(); g.userData.wallMounted=true;
  const m=new THREE.MeshStandardMaterial({map:tex(THREE,512,320,(c,w,h)=>{ c.fillStyle='#fffaf2'; c.fillRect(0,0,w,h); c.fillStyle=T.rug2; c.fillRect(22,22,w-44,h-44);
      c.fillStyle=T.accent; c.beginPath(); c.arc(w/2,118,58,0,Math.PI*2); c.fill(); c.fillStyle='#fffaf2'; c.beginPath(); c.arc(w/2-20,104,9,0,Math.PI*2); c.arc(w/2+20,104,9,0,Math.PI*2); c.fill();
      c.strokeStyle='#fffaf2'; c.lineWidth=7; c.lineCap='round'; c.beginPath(); c.arc(w/2,122,26,0.2*Math.PI,0.8*Math.PI); c.stroke();
      c.fillStyle='#4a3a2c'; c.font='600 38px "Apple SD Gothic Neo","Noto Sans KR",sans-serif'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(T.motto,w/2,232); }),roughness:0.85});
  const frame=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.33,0.02),new THREE.MeshStandardMaterial({color:'#b98b5e',roughness:0.6})); g.add(frame);
  const face=new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.29),m); face.position.z=0.0105; g.add(face);
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } }); return g; }

/* 복도 문 위 명패(가안): 크고 대비가 큰 인쇄 판. 문틀·벽에 붙은 고정 판 — Sprite 아님.
   twoSided=true 면 앞뒤 양면 인쇄(반높이 파티션 문틀 위에 얹는 판) */
export const COZY_SIGN={width:1.2,height:0.34};
export function cozyDoorSign(THREE,text,accent,{twoSided=false,width=COZY_SIGN.width,height=COZY_SIGN.height}={}){
  const g=new THREE.Group(); g.name='Wall_Team_Plaque_'+text; g.userData.wallMounted=true;
  const map=tex(THREE,1024,300,(c,w,h)=>{ c.fillStyle='#fffaf1'; c.fillRect(0,0,w,h); c.fillStyle=accent; c.fillRect(0,0,w,34); c.fillRect(0,h-12,w,12);
    let size=210; const font=s=>`800 ${s}px "Apple SD Gothic Neo","Noto Sans KR",sans-serif`; c.font=font(size); while(c.measureText(text).width>960&&size>60){ size-=4; c.font=font(size); }
    c.fillStyle='#2b2118'; c.textAlign='center'; c.textBaseline='middle'; c.fillText(text,w/2,h/2+14); });
  const faceMat=new THREE.MeshStandardMaterial({map,roughness:0.8});
  const board=new THREE.Mesh(new THREE.BoxGeometry(width,height,0.03),new THREE.MeshStandardMaterial({color:'#a57b52',roughness:0.6})); g.add(board);
  const f=new THREE.Mesh(new THREE.PlaneGeometry(width-0.03,height-0.03),faceMat); f.position.z=0.0155; g.add(f);
  if(twoSided){ const b=f.clone(); b.rotation.y=Math.PI; b.position.z=-0.0155; g.add(b); }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; o.receiveShadow=true; } }); return g; }

/* 대화 카메라 가림 흐리게: 카메라→상대 얼굴 선을 막는 사람(나·동료)과 책상 소품(모니터 등)을 대화 동안만 반투명으로 */
export function createTalkFade(THREE){
  const faded=new Map(); const ray=new THREE.Ray(), v=new THREE.Vector3(), hd=new THREE.Vector3(), cam=new THREE.Vector3(), sph=new THREE.Sphere(), bb=new THREE.Box3(), hit=new THREE.Vector3();
  const boxCache=new WeakMap();
  /* 반투명 대신 알파 해시(점묘) — 깊이 쓰기를 그대로 두어 머리카락 속 눈·헤드폰 같은 안쪽 부품이 비쳐 보이지 않는다.
     사람은 자기 재질(인물마다 따로 불러온 것)을, 소품은 복제본끼리 재질을 나눠 쓰므로 복제해서 바꾼다 */
  const fadeObj=(o,a)=>{ const own=!!o.setOpacity, root=own?o.model:o;
    root.traverse(m=>{ if(!m.isMesh) return;
      if(!own&&!m.userData.fadeOrig){ m.userData.fadeOrig=m.material; m.material=Array.isArray(m.material)?m.material.map(x=>x.clone()):m.material.clone(); }
      for(const x of [].concat(m.material)){ if(x.userData.fadeKeep===undefined) x.userData.fadeKeep={alphaHash:!!x.alphaHash,opacity:x.opacity}; x.alphaHash=true; x.opacity=a; x.needsUpdate=true; } }); };
  const restore=(o)=>{ const own=!!o.setOpacity, root=own?o.model:o;
    root.traverse(m=>{ if(!m.isMesh) return;
      if(!own&&m.userData.fadeOrig){ for(const x of [].concat(m.material)) x.dispose(); m.material=m.userData.fadeOrig; delete m.userData.fadeOrig; return; }
      for(const x of [].concat(m.material)){ const k=x.userData.fadeKeep; if(k){ x.alphaHash=k.alphaHash; x.opacity=k.opacity; delete x.userData.fadeKeep; x.needsUpdate=true; } } }); };
  return function tick({camera,npc,chars,props,headOf}){
    const want=new Set();
    if(npc&&npc.model&&npc.model.visible){ camera.getWorldPosition(cam); headOf(npc).getWorldPosition(hd);
      const targets=[[0,0.1,0],[0,0.02,0],[0,-0.12,0],[0.09,0.06,0],[-0.09,0.06,0],[0,-0.24,0]];
      /* 카메라 코앞(1.5m 안)에서 화면을 덮는 사람(어깨 너머로 찍을 때 내 뒷머리 등)도 흐리게 */
      for(const c of chars){ if(c===npc||!c.model||!c.model.visible) continue; const h=headOf(c).getWorldPosition(new THREE.Vector3());
        if(h.distanceTo(cam)<1.5){ const q=h.clone().project(camera); if(q.z<1&&Math.abs(q.x)<1.15&&Math.abs(q.y)<1.15) want.add(c); } }
      for(const [ox,oy,oz] of targets){ v.set(hd.x+ox,hd.y+oy,hd.z+oz); const dist=cam.distanceTo(v)-0.06; ray.origin.copy(cam); ray.direction.subVectors(v,cam).normalize();
        for(const c of chars){ if(c===npc||!c.model||!c.model.visible) continue; const h=headOf(c).getWorldPosition(new THREE.Vector3());
          for(const [dy,r] of [[0.06,0.2],[-0.18,0.17],[-0.38,0.16]]){ sph.center.set(h.x,h.y+dy,h.z); sph.radius=r; if(ray.intersectSphere(sph,hit)&&cam.distanceTo(hit)<dist){ want.add(c); break; } } }
        if(props&&oy>-0.3) for(const p of props.children){ if(!p.visible) continue; let b=boxCache.get(p); if(!b){ b=new THREE.Box3().setFromObject(p); boxCache.set(p,b); }
          if(b.max.y<0.3) continue; if(ray.intersectBox(b,hit)&&cam.distanceTo(hit)<dist&&!b.containsPoint(v)) want.add(p); } } }
    for(const o of want) if(!faded.has(o)){ fadeObj(o,o.setOpacity?0.32:0.25); faded.set(o,true); }
    for(const o of [...faded.keys()]) if(!want.has(o)){ restore(o); faded.delete(o); }
    return want.size; };
}
