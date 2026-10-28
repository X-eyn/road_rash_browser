import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9226;
const profile = mkdtempSync(join(tmpdir(), "rratk-"));
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run", "http://127.0.0.1:8899/?boot=skip&noaudio=1"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() { for (let i=0;i<60;i++){ try { const l=await(await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p=l.find(x=>x.type==="page"); if(p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl; } catch{} await sleep(250);} throw Error("no target"); }
const ws = new WebSocket(await target());
await new Promise((res, rej) => { ws.onopen=res; ws.onerror=rej; });
let id=0; const pending=new Map(); const errors=[];
ws.onmessage=(ev)=>{ const m=JSON.parse(ev.data); if(m.method==="Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text+" "+(m.params.exceptionDetails?.exception?.description||"")); if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);} };
const send=(method,params={})=>new Promise((resolve,reject)=>{const i=++id;pending.set(i,{resolve,reject});ws.send(JSON.stringify({id:i,method,params}));});
const ev=async(expression)=>{const r=await send("Runtime.evaluate",{expression,returnByValue:true}); if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result?.value;};
await send("Runtime.enable"); await send("Page.enable"); await send("Emulation.setFocusEmulationEnabled",{enabled:true});
await sleep(2200);
await ev(`window.RR.ui.startQuickOrCareer({track:'city',level:1,mode:'quick',bikeIndex:4}); 'ok'`);
await sleep(1800);
console.log("setup", await ev(`(()=>{const r=window.__race; if(!r) return 'no race'; r.countdown=0; r.setState='ride'; r.hudCount.classList.remove('on'); r.riders.forEach(x=>x.state='ride'); const p=r.player, q=r.riders[1]; q.s=p.s+0.8; q.lat=p.lat+1.1; q.state='ride'; q.world=r.posAt(q.s,q.lat,0.05); window.dispatchEvent(new KeyboardEvent('keydown',{key:'j',bubbles:true})); return JSON.stringify({has:!!r, keys:[...r.input.keys], pressed:[...r.input.pressed], pState:p.state, atkCd:p.atkCd, attack:p.attack, rival:q.state});})()`));
await sleep(120);
console.log("after-j", await ev(`(()=>{const r=window.__race,p=r.player; return JSON.stringify({attack:p.attack?{kind:p.attack.kind,t:p.attack.t,side:p.attack.side}:null, frame:p.frame, atkCd:p.atkCd, rival:{state:r.riders[1].state,hitT:r.riders[1].hitT,stamina:r.riders[1].stamina}, pressed:[...r.input.pressed]});})()`));
await sleep(400);
console.log("after-swing", await ev(`(()=>{const r=window.__race,p=r.player; return JSON.stringify({attack:p.attack, frame:p.frame, rival:r.riders[1].state, stamina:r.riders[1].stamina});})()`));
// direct tryAttack to bypass key handling
console.log("direct", await ev(`(()=>{const r=window.__race,p=r.player; p.atkCd=0; r.tryAttack('kick'); return JSON.stringify({attack:p.attack, frame:p.frame});})()`));
await sleep(100);
console.log("direct-after", await ev(`(()=>{const r=window.__race,p=r.player; return JSON.stringify({attack:p.attack, frame:p.frame, rival:r.riders[1].state});})()`));
const s=await send("Page.captureScreenshot",{format:"png"}); writeFileSync("preview/cdp_attack.png",Buffer.from(s.data,"base64"));
console.log("errors", JSON.stringify(errors.slice(0,5)));
ws.close(); chrome.kill(); process.exit(0);
