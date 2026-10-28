// Boot, stage scaling and app wiring.
import { loadData, DATA, loadSave, writeSave, defaultSave, TRACK_ORDER, trackName } from "./data.js";
import { loadImage } from "./assets.js";
import { audio } from "./audio.js";
import { UI } from "./ui.js";
import { startRace } from "./race.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const noAudio = params.get("noaudio") === "1" || params.has("noaudio");

const boot = {
  el: $("#boot"),
  bar: $("#boot-bar i"),
  prompt: $("#boot-prompt"),
  note: $("#boot-note"),
};

let save = loadSave();
let ui = null;
let ready = false;
let starting = false;

const ctx = {
  save,
  saveNow: () => writeSave(ctx.save),
  audio,
  startRace: async (opts) => startRace(opts),
};

async function bootFlow() {
  try {
    await loadData((p) => (boot.bar.style.width = `${Math.min(50, p * 50)}%`));
    const art = [
      "./assets/art/splash.jpg",
      "./assets/art/street.jpg",
      "./assets/art/olleys.jpg",
      "./assets/art/panzer.jpg",
      "./assets/art/credits.jpg",
      "./assets/art/restroom/rest1.jpg",
      "./assets/art/postcards/city.jpg",
      "./assets/art/chars/axle-n.jpg",
    ];
    let done = 0;
    await Promise.all(
      art.map(async (u) => {
        try { await loadImage(u); } catch {}
        boot.bar.style.width = `${50 + (++done / art.length) * 45}%`;
      })
    );
    try { await document.fonts.ready; } catch {}
    boot.bar.style.width = "100%";
    ready = true;
    boot.prompt.textContent = "CLICK TO RIDE";
    boot.prompt.classList.add("ready");
    boot.prompt.addEventListener("click", start);
    window.addEventListener("keydown", bootKey);
    if (params.get("boot") === "skip") setTimeout(start, 250);
  } catch (err) {
    console.error(err);
    boot.prompt.textContent = "LOAD FAILED — see console";
    boot.prompt.classList.remove("ready");
    boot.note.textContent = String(err.message || err);
  }
}

function bootKey(e) {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    start();
  }
}

async function start() {
  if (starting || !ready) return;
  starting = true;
  window.removeEventListener("keydown", bootKey);
  if (!noAudio) {
    try { await audio.init(); } catch (e) { console.warn("audio", e); }
  }
  audio.setVolumes({
    master: save.settings.master,
    music: save.settings.music,
    sfx: save.settings.sfx,
    engine: save.settings.engine,
  });
  audio.setMusic(save.settings.musicOn);
  boot.el.style.display = "none";
  $("#app").setAttribute("aria-hidden", "false");
  if (params.get("touch") === "1" || window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window) {
    document.body.classList.add("touch");
  }
  ui = new UI(ctx);
  save = ctx.save;
  window.RR = { data: DATA, ui, audio, get save() { return ctx.save; }, startRace };
  const auto = params.get("autostart");
  const screen = params.get("screen");
  const screens = {
    tracks: () => ui.showTracks("quick"),
    levels: () => ui.showLevels("city", () => ui.showTracks("quick")),
    chars: () => ui.showChars("new"),
    career: () => ui.showCareer(),
    shop: () => ui.showShop(() => ui.showMain()),
    options: () => ui.showOptions(() => ui.showMain()),
    credits: () => ui.showCredits(() => ui.showMain()),
    help: () => ui.showHelp(() => ui.showMain()),
    bike: () => ui.showBikeSelect({ track: "city", level: 1, mode: "quick" }, () => ui.showTracks("quick")),
    results: () => ui.showResults({ status: "finished", place: 1, time: 214.32, field: 8, condition: 0.82 },
      { track: "city", level: 1, mode: "quick", cash: 1200 }),
  };
  if (auto) {
    const track = TRACK_ORDER.includes(auto) ? auto : "city";
    const level = Math.max(1, Math.min(5, parseInt(params.get("level") || "1", 10)));
    const bike = Math.max(0, Math.min(14, parseInt(params.get("bike") || String(save.bike || 4), 10)));
    setTimeout(() => ui.startQuickOrCareer({ track, level, mode: "quick", bikeIndex: bike }), 250);
  } else if (screen && screens[screen]) {
    setTimeout(screens[screen], 250);
  } else {
    ui.showMain();
  }
}

window.addEventListener("beforeunload", () => writeSave(ctx.save));

bootFlow();
