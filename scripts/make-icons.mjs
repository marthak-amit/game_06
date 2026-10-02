// Renders launcher icons + splash with headless Chromium: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const html = `<canvas id=c></canvas><script>
function draw(size, mode){ // mode: 'full' | 'fg' | 'round'
  const c=document.getElementById('c'); c.width=c.height=size; const g=c.getContext('2d'); const s=size/512;
  g.clearRect(0,0,size,size);
  const k = mode==='fg' ? 0.62 : 1;
  if(mode!=='fg'){
    const bg=g.createLinearGradient(0,0,0,size); bg.addColorStop(0,'#2a1c7a'); bg.addColorStop(1,'#0b0d24');
    g.fillStyle=bg; g.beginPath();
    if(mode==='round') g.arc(size/2,size/2,size/2,0,7); else g.roundRect(0,0,size,size,size*0.22); g.fill();
  }
  g.save(); g.translate(size/2,size/2); g.scale(s*k,s*k); g.translate(-256,-256);
  // bricks
  const cols=['#ff5d73','#ff9f43','#f4d03f'];
  [[96,96],[208,96],[320,96]].forEach((p,i)=>{const gr=g.createLinearGradient(0,p[1],0,p[1]+96);gr.addColorStop(0,cols[i]);gr.addColorStop(1,'#00000055');g.fillStyle=cols[i];g.beginPath();g.roundRect(p[0],p[1],96,96,22);g.fill();g.fillStyle=gr;g.beginPath();g.roundRect(p[0],p[1],96,96,22);g.fill();g.fillStyle='rgba(255,255,255,.25)';g.beginPath();g.roundRect(p[0]+8,p[1]+8,80,28,12);g.fill();});
  // trail
  g.lineCap='round';
  for(let i=0;i<14;i++){const t=i/14;g.strokeStyle='rgba(56,232,255,'+(0.08+t*0.5)+')';g.lineWidth=10+t*26;g.beginPath();g.moveTo(256-(1-t)*60+0, 430-(1-t)*190);g.lineTo(256-(1-t-0.07)*60, 430-(1-t-0.07)*190);g.stroke();}
  // ball
  const rg=g.createRadialGradient(240,300,6,256,320,56);rg.addColorStop(0,'#fff');rg.addColorStop(.35,'#38e8ff');rg.addColorStop(1,'#1b8cff');
  g.shadowColor='#38e8ff';g.shadowBlur=40;g.fillStyle=rg;g.beginPath();g.arc(256,320,52,0,7);g.fill();
  g.restore();
}
function splash(w,h){const c=document.getElementById('c');c.width=w;c.height=h;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#1b1450');gr.addColorStop(1,'#0b0d24');g.fillStyle=gr;g.fillRect(0,0,w,h);}
</script>`;
const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
const b = await chromium.launch({ executablePath: process.env.CHROME });
const page = await (await b.newContext()).newPage();
await page.setContent(html);
const shot = async (fn, args, file) => {
  await page.evaluate(([f, a]) => window[f](...a), [fn, args]);
  const data = await page.locator('#c').screenshot({ omitBackground: true });
  fs.mkdirSync(file.replace(/\/[^/]+$/, ''), { recursive: true }); fs.writeFileSync(file, data);
};
for (const [d, [legacy, fg]] of Object.entries(dens)) {
  const dir = `resources/android/mipmap-${d}`;
  await shot('draw', [legacy, 'full'], `${dir}/ic_launcher.png`);
  await shot('draw', [legacy, 'round'], `${dir}/ic_launcher_round.png`);
  await shot('draw', [fg, 'fg'], `${dir}/ic_launcher_foreground.png`);
}
await shot('draw', [1024, 'full'], 'resources/icon-1024.png');
await shot('draw', [512, 'full'], 'resources/play-store-icon-512.png');
await shot('splash', [480, 800], 'resources/splash.png');
await b.close();
