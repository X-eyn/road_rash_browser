import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9225;
const profile = mkdtempSync(join(tmpdir(), "rrmob-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "--no-first-run",
  "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((x) => x.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("no target");
}
const ws = new WebSocket(await target());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } };
const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJS = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.value;
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
await send("Page.navigate", { url: "http://127.0.0.1:8899/?boot=skip&noaudio=1&touch=1&autostart=city&level=1&bike=4&skipcount=1&sim=5" });
await sleep(4500);
console.log(await evalJS(`JSON.stringify({w:innerWidth,h:innerHeight,touch:document.body.className,stage:(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})(),transform:document.querySelector('#stage').style.transform})`));
const s = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("preview/cdp_mobile.png", Buffer.from(s.data, "base64"));
console.log("shot cdp_mobile.png");
ws.close(); chrome.kill(); process.exit(0);
