/** Deterministic bleached herringbone parquet, authored locally for the white office. */
export function createWhiteFloorMap(THREE, repeatX=5, repeatY=4){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const c=canvas.getContext('2d');c.fillStyle='#dddeda';c.fillRect(0,0,512,512);
 c.save();c.translate(256,256);c.rotate(Math.PI/4);
 const plank=32,length=128;
 for(let row=-20;row<=20;row++)for(let col=-8;col<=8;col++){
  const x=col*(length+plank)+row*plank,y=row*plank;
  const tone=229+Math.abs((row*17+col*31)%7);
  c.fillStyle=`rgb(${tone},${tone+1},${tone-2})`;c.fillRect(x+1,y+1,length-2,plank-2);
  c.fillStyle='rgba(121,127,122,.055)';
  for(let k=0;k<5;k++)c.fillRect(x+5,y+4+k*5,length-10, .6);
  c.fillStyle=`rgb(${tone-2},${tone},${tone-3})`;c.fillRect(x+length+1,y+1,plank-2,length-2);
  c.fillStyle='rgba(121,127,122,.055)';
  for(let k=0;k<5;k++)c.fillRect(x+length+4+k*5,y+5,.6,length-10);
 }
 c.restore();const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(repeatX,repeatY);map.anisotropy=8;map.userData.reviewOwnedTexture=true;return map;
}
