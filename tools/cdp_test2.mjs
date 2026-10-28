// Real-time finish/results/career test.
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9224;
const profile = mkdtempSync(join(tmpdir(), "rrcdp2-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader", "--window-size=1280,960", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
  "http://127.0.0.1:8899/?boot=skip&noaudio=1",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((x) => x.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("no target");
}
const ws = new WebSocket(await getTarget());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
};
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evalJS(expression, awaitPromise = false) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result?.value;
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`preview/${name}`, Buffer.from(r.data, "base64"));
  console.log("shot", name);
}
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setFocusEmulationEnabled", { enabled: true });
await send("Page.bringToFront");
await sleep(2200);

// Create a career and open the career hub.
console.log(await evalJS(`(() => {
  const s = window.RR.save;
  s.char = 0; s.cash = 6000; s.bike = 4; s.owned = [4];
  s.progress = { city:1, hiway:1, medly:1, napa:1, canyn:1 };
  window.RR.ui.ctx.saveNow();
  window.RR.ui.showCareer();
  return JSON.stringify({char:s.char,cash:s.cash,bike:s.bike});
})()`));
await sleep(500);

// Next Race -> first track -> career race.
await evalJS(`document.querySelector('.menu [data-i="0"]')?.click(); 'ok'`);
await sleep(600);
await evalJS(`document.querySelector('.tracklist [data-i="0"]')?.click(); 'ok'`);
await sleep(2500);
console.log("race", await evalJS(`JSON.stringify({r:!!window.__race, s:window.__race?.player.s, level:window.__race?.level, state:window.__race?.player.state})`));

// Put the player on the finish line and advance updates deterministically.
console.log(await evalJS(`(() => {
  const r = window.__race;
  if (!r) return 'no race';
  r.autoThrottle = true; r.autoSteer = true;
  r.player.s = r.finish - 2;
  r.player.speed = 30;
  r.raceTime = 100;
  for (let i = 0; i < 240; i++) r.update(1/60);
  return JSON.stringify({s:r.player.s, state:r.player.state, finishing:r.finishing, ended:r.ended, result:r.result});
})()`));
await sleep(900);
console.log("results", await evalJS(`JSON.stringify({place:document.querySelector('.results-panel .place')?.textContent, banner:document.querySelector('.banner')?.textContent, cash:window.RR.save.cash, prog:window.RR.save.progress, best:window.RR.save.best})`));
await shot("cdp_results_career.png");

// Continue -> career hub, then bike shop.
await evalJS(`document.querySelector('.results-menu [data-i="0"]')?.click(); 'ok'`);
await sleep(500);
await evalJS(`window.RR.save.cash = 20000; window.RR.ui.ctx.saveNow(); document.querySelector('.menu [data-i="1"]')?.click(); 'ok'`);
await sleep(500);
console.log("shop", await evalJS(`JSON.stringify({items:document.querySelectorAll('.shoplist [data-i]').length, cash:document.querySelector('.panel[style*="right:12px"]')?.textContent, first:document.querySelector('.shoplist [data-i="0"]')?.textContent})`));
// Buy the first bike through the shop action.
await evalJS(`document.querySelector('.shoplist [data-i="0"]')?.click(); 'ok'`);
await sleep(400);
console.log("bought", await evalJS(`JSON.stringify({cash:window.RR.save.cash, bike:window.RR.save.bike, owned:window.RR.save.owned})`));
await shot("cdp_shop_bought.png");

ws.close(); chrome.kill(); process.exit(0);
