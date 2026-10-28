import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const CHROME="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", PORT=9228;
const profile=mkdtempSync(join(tmpdir(),"rrcar-"));
const chrome=spawn(CHROME,["--headless=new","--no-sandbox","--enable-unsafe-swiftshader","--use-angle=swiftshader",`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,"--no-first-run","http://127.0.0.1:8899/?boot=skip&noaudio=1"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function target(){for(let i=0;i<60;i++){try{const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();const p=l.find(x=>x.type==="page");if(p?.webSocketDebuggerUrl)return p.webSocketDebuggerUrl;}catch{}await sleep(250);}throw Error("no target");}
const ws=new WebSocket(await target());await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let id=0;const pending=new Map();ws.onmessage=ev=>{const m=JSON.parse(ev.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const ev=async expression=>{const r=await send("Runtime.evaluate",{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
await send("Page.enable");await send("Runtime.enable");await send("Emulation.setFocusEmulationEnabled",{enabled:true});await sleep(2200);
await ev(`window.RR.ui.startQuickOrCareer({track:'city',level:1,mode:'quick',bikeIndex:4});'ok'`);await sleep(1800);
console.log(await ev(`(()=>{const r=window.__race;r.countdown=0;r.setState='ride';r.hudCount.classList.remove('on');r.riders.forEach(x=>x.state='ride');r.player.speed=12;const c=r.cars[0];c.s=r.player.s+2.2;c.lat=0;c.speed=0;r.updateTrafficVisual();const q=r.riders[1];q.s=r.player.s+0.6;q.lat=r.player.lat+1.0;q.state='ride';q.world=r.posAt(q.s,q.lat,.05);window.dispatchEvent(new KeyboardEvent('keydown',{key:'j',bubbles:true}));r.updateRidersVisual(1/60);r.updateCamera(1/60);r.render();return JSON.stringify({car:{s:c.s,p:r.player.s,vis:c.sprite.visible,scale:c.sprite.scale.toArray(),pos:c.sprite.position.toArray(),mat:!!c.sprite.material.map},rival:q.state,attack:r.player.attack,frame:r.player.frame});})()`));
await sleep(120);await ev(`window.__race.render();`);
const s=await send("Page.captureScreenshot",{format:"png"});writeFileSync("preview/cdp_car_attack.png",Buffer.from(s.data,"base64"));console.log("shot");
ws.close();chrome.kill();process.exit(0);
