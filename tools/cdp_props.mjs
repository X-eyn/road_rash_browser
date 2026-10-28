import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", PORT=9229;
const profile=mkdtempSync(join(tmpdir(),"rrprop-"));
spawn(CHROME,["--headless=new","--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader",`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,"--no-first-run","http://127.0.0.1:8899/?boot=skip&noaudio=1&autostart=city&level=1&bike=4&skipcount=1&sim=8"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function target(){for(let i=0;i<60;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(x=>x.type==="page");if(p?.webSocketDebuggerUrl)return p.webSocketDebuggerUrl;}catch{}await sleep(250);}throw Error("no target");}
const ws=new WebSocket(await target());await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let id=0;const pending=new Map();ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expression=>(await send("Runtime.evaluate",{expression,returnByValue:true})).result?.value;
await send("Runtime.enable");await sleep(3500);
console.log(await ev(`JSON.stringify([...new Set(window.__race.propPool.filter(s=>s.visible).map(s=>s.userData.propName))])`));
console.log(await ev(`JSON.stringify(window.__race.propPool.filter(s=>s.visible).map(s=>({n:s.userData.propName,x:+s.position.x.toFixed(1),y:+s.position.y.toFixed(1),z:+s.position.z.toFixed(1),w:+s.scale.x.toFixed(1),h:+s.scale.y.toFixed(1)})).slice(0,20))`));
process.exit(0);
