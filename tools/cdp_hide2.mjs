import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", PORT=9230;
const profile=mkdtempSync(join(tmpdir(),"rrhide-"));
spawn(CHROME,["--headless=new","--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader",`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,"--no-first-run","http://127.0.0.1:8899/?boot=skip&noaudio=1&autostart=city&level=1&bike=4&skipcount=1&sim=8"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function target(){for(let i=0;i<60;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(x=>x.type==="page");if(p?.webSocketDebuggerUrl)return p.webSocketDebuggerUrl;}catch{}await sleep(250);}throw Error("no target");}
const ws=new WebSocket(await target());await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let id=0;const pending=new Map();ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expression=>(await send("Runtime.evaluate",{expression,returnByValue:true})).result?.value;
async function cap(n){const s=await send("Page.captureScreenshot",{format:"png"});writeFileSync(`preview/${n}.png`,Buffer.from(s.data,"base64"));console.log("shot",n);}
await send("Page.enable");await send("Runtime.enable");await sleep(3500);
await ev(`(()=>{const r=window.__race;r.parked.forEach(p=>p.sprite.visible=false);r.render();return 'ok'})()`);await cap("hide_parked");
await ev(`(()=>{const r=window.__race;r.cars.forEach(c=>c.sprite.visible=false);r.render();return 'ok'})()`);await cap("hide_cars");
await ev(`(()=>{const r=window.__race;r.propPool.forEach(s=>s.visible=false);r.scenePool.forEach(s=>s.visible=false);r.render();return 'ok'})()`);await cap("hide_props");
await ev(`(()=>{const r=window.__race;r.horizon.visible=false;r.render();return 'ok'})()`);await cap("hide_horizon2");
process.exit(0);
