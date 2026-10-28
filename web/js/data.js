// Road Rash '96 browser port — data tables and helpers.
import { loadJSON } from "./assets.js";

export const TRACK_ORDER = ["city", "hiway", "medly", "napa", "canyn"];
export const CHAR_IDS = ["axle", "bose", "cydney", "jon", "pearl", "rhonda", "jim", "mike"];
export const BIKE_PICS = {
  rat: ["banzai", "corsair", "kamikaze", "perro", "killer"],
  sport: ["diablo", "kamikaze", "stiletto", "dmg", "perro"],
  super: ["banzai", "diablo", "stiletto", "corsair", "kamikaze"],
};
export const SHOP_TO_ID = (i) => (i < 5 ? i : i < 10 ? 10 + (i - 5) : 5 + (i - 10));

export const DATA = {
  courses: null,
  tracks: null,
  bikes: null,
  text: null,
  cars: null,
  rider: null,
  shopBikes: [],
  chars: [],
  rivalNames: [],
};

export async function loadData(onProgress = () => {}) {
  const files = ["courses", "tracks", "bikes", "text", "cars", "rider"];
  let n = 0;
  const results = await Promise.all(
    files.map(async (name) => {
      const data = await loadJSON(`./data/${name}.json`);
      onProgress(++n / files.length);
      return [name, data];
    })
  );
  for (const [name, data] of results) DATA[name] = data;
  buildTables();
  return DATA;
}

function fmtMoney(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function sprintf(template, ...args) {
  let i = 0;
  return String(template).replace(/%[sd]/g, () => {
    const v = args[i++];
    return v == null ? "" : String(v);
  });
}

function buildTables() {
  const T = DATA.text;
  const t = (id) => T[String(id)] ?? "";
  // Original shop order: Rat 0-4, Sport 5-9, Super 10-14. Internal ids are
  // Rat 0-4, Super 5-9, Sport 10-14 (the game's own enumeration).
  DATA.shopBikes = Array.from({ length: 15 }, (_, i) => {
    const cls = i < 5 ? "rat" : i < 10 ? "sport" : "super";
    const internal = SHOP_TO_ID(i);
    const spec = DATA.bikes.bikes.find((b) => b.id === internal) || DATA.bikes.bikes[internal];
    const pic = BIKE_PICS[cls][i % 5];
    return {
      shopIndex: i,
      id: internal,
      cls,
      brand: t(96 + i),
      model: t(112 + i),
      full: t(128 + i),
      blurb: t(144 + i),
      price: spec.price,
      pic,
      floor: `assets/art/showroom/${cls}/${pic}.jpg`,
      shot: `assets/art/bikes/${cls}/${pic}.jpg`,
      spec,
      grip: { rat: 1.06, sport: 1.0, super: 0.94 }[cls],
    };
  });
  DATA.chars = CHAR_IDS.map((id, i) => {
    const c = DATA.bikes.chars[i];
    const r = DATA.bikes.riders[c.row];
    const bike = DATA.shopBikes.find((b) => b.id === c.bike) || DATA.shopBikes[0];
    const cash = c.cash;
    const height = `${Math.floor(r.height / 12)}'${r.height % 12}"`;
    return {
      index: i,
      id,
      name: t(32 + i),
      short: t(358 + i),
      bio: sprintf(t(40 + i), height, `${r.weight} lbs`, bike.full, fmtMoney(cash)),
      portrait: `assets/art/chars/${id}-n.jpg`,
      row: c.row,
      rider: r,
      bike,
      cash,
    };
  });
  DATA.rivalNames = Array.from({ length: 36 }, (_, i) => t(320 + i)).filter(Boolean);
}

export function text(id) {
  return DATA.text?.[String(id)] ?? "";
}

export function trackInfo(id) {
  return DATA.tracks.find((t) => t.id === id);
}

export function trackName(id) {
  return text(trackInfo(id).nameId);
}

export function trackBlurb(id) {
  const raw = text(trackInfo(id).blurbId);
  return raw.replace(/\n+Length:[\s\S]*$/, "");
}

export function trackLength(id, level, units = "mph") {
  const tenths = trackInfo(id).lengths[level - 1];
  if (units === "km") return `${(tenths * 0.160934).toFixed(1)} km`;
  return `${(tenths / 10).toFixed(1)} mi`;
}

export function trackCard(id) {
  return `assets/art/postcards/${trackInfo(id).card.toLowerCase()}.jpg`;
}

export function bikeByShopIndex(i) {
  return DATA.shopBikes[i];
}

export function charByIndex(i) {
  return DATA.chars[i];
}

export function bikeStatsLine(bike) {
  const m = bike.blurb.match(/(\d+) HP\/(\d+) lbs/);
  return m ? `${m[1]} HP · ${m[2]} lbs` : "";
}

export function defaultSave() {
  return {
    version: 1,
    char: null,
    cash: 1000,
    bike: 4,
    owned: [4],
    progress: { city: 1, hiway: 1, medly: 1, napa: 1, canyn: 1 },
    best: {},
    settings: {
      master: 0.85,
      music: 0.35,
      sfx: 0.8,
      engine: 0.65,
      units: "mph",
      camera: "chase",
      assist: 0.45,
      musicOn: true,
    },
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem("rr96-save");
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    const d = defaultSave();
    return {
      ...d,
      ...s,
      progress: { ...d.progress, ...(s.progress || {}) },
      best: s.best || {},
      settings: { ...d.settings, ...(s.settings || {}) },
      owned: Array.isArray(s.owned) && s.owned.length ? s.owned : d.owned,
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s) {
  try {
    localStorage.setItem("rr96-save", JSON.stringify(s));
  } catch {}
}

export function careerReady(s) {
  return !!s.char && typeof s.char === "number";
}

export function allDone(s) {
  return TRACK_ORDER.every((id) => (s.progress[id] || 1) > 5);
}

export function placeSuffix(n) {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

export function prizeFor(place, level) {
  const base = [1200, 750, 450, 180, 120, 90, 70, 50][Math.max(0, place - 1)] || 50;
  return Math.round(base * (0.6 + level * 0.4));
}
