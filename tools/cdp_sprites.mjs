import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", PORT=9231;
const profile=mkdtempSync(join(tmpdir(),"rrspr-"));
spawn(CHROME,["--headless=new","--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader",`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,"--no-first-run","http://127.0.0.1:8899/?boot=skip&noaudio=1&autostart=city&level=1&bike=4&skipcount=1&sim=8"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function target(){for(let i=0;i<60;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(x=>x.type==="page");if(p?.webSocketDebuggerUrl)return p.webSocketDebuggerUrl;}catch{}await sleep(250);}throw Error("no target");}
const ws=new WebSocket(await target());await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let id=0;const pending=new Map();ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expression=>(await send("Runtime.evaluate",{expression,returnByValue:true})).result?.value;
await send("Page.enable");await send("Runtime.enable");await sleep(3500);
console.log(await ev(`(()=>{const r=window.__race;const c={};for(const o of r.scene.children){if(!o.isSprite||!o.visible)continue;const s=o.material?.map?.image?.src||(o.material?.map?.image?'canvas':'none');c[s]=(c[s]||0)+1}return JSON.stringify(c)})()`));
console.log(await ev(`(()=>{const r=window.__race;r.scene.traverse(o=>{if(o.isSprite)o.visible=false});r.render();return 'ok'})()`));
const s=await send("Page.captureScreenshot",{format:"png"});writeFileSync("preview/hide_sprites.png",Buffer.from(s.data,"base64"));console.log("shot");
process.exit(0);
