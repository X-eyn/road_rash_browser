// Real-time Chrome DevTools smoke test (Node built-ins only).
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9223;
const URL = "http://127.0.0.1:8899/?boot=skip&noaudio=1";
const profile = mkdtempSync(join(tmpdir(), "rrcdp-"));
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--enable-unsafe-swiftshader",
  "--use-angle=swiftshader", "--window-size=1280,960", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
  URL,
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await r.json();
      const page = list.find((x) => x.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error("CDP target not found");
}

const wsUrl = await getTarget();
const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(JSON.stringify(m.error)));
    else resolve(m.result);
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJS(expression, awaitPromise = false) {
  const r = await send("Runtime.evaluate", { expression, awaitPromise, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + JSON.stringify(r.exceptionDetails.exception?.description || ""));
  return r.result?.value;
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`preview/${name}`, Buffer.from(r.data, "base64"));
  console.log("shot", name);
}
async function state(label) {
  const v = await evalJS(`(() => {
    const r = window.__race;
    return {
      time: document.querySelector('#hud-time')?.textContent,
      count: document.querySelector('#hud-count')?.className,
      countText: document.querySelector('#hud-count')?.textContent,
      speed: document.querySelector('#hud-speed')?.textContent,
      place: document.querySelector('#hud-place')?.textContent,
      results: document.querySelector('.results-panel .place')?.textContent || null,
      resultsTitle: document.querySelector('.banner')?.textContent || null,
      race: r ? { s: +r.player.s.toFixed(1), speed: +r.player.speed.toFixed(1), state: r.player.state, set: r.setState, time: +r.raceTime.toFixed(2), finish: r.finish, place: r.playersPlace(), hasRenderer: !!r.renderer } : null,
      career: (() => { const s = window.RR.save; return { char: s.char, cash: s.cash, bike: s.bike, prog: s.progress }; })(),
    };
  })()`);
  console.log(label, JSON.stringify(v));
  return v;
}

await send("Page.enable");
await send("Runtime.enable");
await sleep(2500);
await state("menu");
await shot("cdp_menu.png");

// Start a quick race through the normal UI path.
await evalJS(`window.RR.ui.startQuickOrCareer({track:'city',level:1,mode:'quick',bikeIndex:4}); 'ok'`);
await sleep(1200);
await evalJS(`if (window.__race) { window.__race.autoThrottle = true; window.__race.autoSteer = true; } 'ok'`);
await sleep(5500);
await state("race-after-6s");
await shot("cdp_race.png");

// Teleport close to the finish, let the normal update loop complete it.
await evalJS(`(() => { const r = window.__race; r.player.s = r.finish - 55; r.player.speed = 35; r.raceTime = 150; r.autoThrottle = true; return 'ok'; })()`);
await sleep(6000);
await state("finish");
await shot("cdp_finish.png");

// Career character selection, using real clicks.
await evalJS(`window.RR.ui.showChars('new'); 'ok'`);
await sleep(700);
await evalJS(`document.querySelector('.charlist [data-i="2"]')?.click(); 'ok'`);
await sleep(900);
await state("career");
await shot("cdp_career.png");

ws.close();
chrome.kill();
process.exit(0);
