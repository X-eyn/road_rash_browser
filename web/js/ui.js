// Front end: splash-era menu screens, career, shop, options, results.
import {
  DATA, TRACK_ORDER, trackInfo, trackName, trackBlurb, trackLength, trackCard,
  sprintf, placeSuffix, prizeFor, allDone, text, bikeStatsLine, bikeByShopIndex,
} from "./data.js";

const $ = (sel, root = document) => root.querySelector(sel);
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const clock = (sec) => {
  if (!Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.floor((sec % 1) * 100);
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};

export class UI {
  constructor(ctx) {
    this.ctx = ctx; // { save, saveNow, startRace, audio, toast }
    this.save = ctx.save;
    this.audio = ctx.audio;
    this.stack = [];
    this.list = null;
    this.raceMode = false;
    this.lastRaceOpts = null;
    this.muted = false;
    this._key = (e) => this.onKey(e);
    this._bindStage();
  }

  _bindStage() {
    this.stage = $("#stage");
    this.bg = $("#bg");
    this.shade = $("#shade");
    this.ui = $("#ui");
    this.raceEl = $("#race");
    this.fade = $("#fade");
    this.toastEl = $("#toast");
    window.addEventListener("keydown", this._key);
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = Math.min(w / 640, h / 480);
    this.stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    this.stage.style.left = "50%";
    this.stage.style.top = "50%";
    this.stage.style.position = "fixed";
    this.scale = s;
  }

  setBg(url) {
    this.bg.style.backgroundImage = url ? `url("${url}")` : "none";
    this.bg.style.backgroundSize = "cover";
  }

  setScreen(html, bg, cls = "") {
    this.ui.style.display = "block";
    this.bg.style.display = "block";
    this.shade.style.display = "block";
    this.raceEl.classList.remove("on");
    this.raceEl.hidden = true;
    this.bg.style.backgroundImage = bg ? `url("${bg}")` : "none";
    this.ui.innerHTML = `<div class="screen ${cls}">${html}</div>`;
    this.audio.playMusic("menu");
  }

  setRacing(on) {
    this.raceMode = on;
    this.ui.style.display = on ? "none" : "block";
    this.bg.style.display = on ? "none" : "block";
    this.shade.style.display = on ? "none" : "block";
    this.raceEl.hidden = !on;
    this.raceEl.classList.toggle("on", on);
    if (on) this.list = null;
  }

  onKey(e) {
    if (this.raceMode) return;
    const k = e.key;
    if (k === "m" || k === "M") {
      this.muted = !this.muted;
      this.audio.setVolumes({ master: this.muted ? 0 : this.save.settings.master });
      this.toast(this.muted ? "Sound off" : "Sound on");
      return;
    }
    if (k === "f" || k === "F") {
      this.toggleFullscreen();
      return;
    }
    if (this.list) {
      this.list.key(e);
      return;
    }
    if (k === "Escape" && this.backFn) this.backFn();
    if ((k === "Enter" || k === " ") && this.enterFn) this.enterFn();
  }

  bind(items, onSelect, { onChange, initial = 0 } = {}) {
    const els = [...this.ui.querySelectorAll("[data-i]")];
    let idx = Math.min(initial, Math.max(0, items.length - 1));
    const enabled = (i) => items[i] && !items[i].disabled;
    const paint = () => {
      els.forEach((el, i) => el.classList.toggle("on", i === idx));
      if (items[idx]?.onFocus) items[idx].onFocus(idx);
    };
    const move = (d) => {
      let n = idx;
      for (let c = 0; c < items.length; c++) {
        n = (n + d + items.length) % items.length;
        if (enabled(n)) break;
      }
      if (enabled(n)) {
        idx = n;
        this.audio.click();
        paint();
      }
    };
    const choose = (i = idx) => {
      if (!enabled(i)) return;
      idx = i;
      paint();
      this.audio.click();
      onSelect(i);
    };
    this.list = {
      key: (e) => {
        if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") { e.preventDefault(); move(-1); }
        else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") { e.preventDefault(); if (onChange) { onChange(idx, -1); paint(); } }
        else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") { e.preventDefault(); if (onChange) { onChange(idx, 1); paint(); } }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
        else if (e.key === "Escape" && this.backFn) { e.preventDefault(); this.backFn(); }
      },
    };
    els.forEach((el, i) => {
      el.addEventListener("mouseenter", () => { if (enabled(i)) { idx = i; paint(); } });
      el.addEventListener("click", () => choose(i));
    });
    // skip disabled initial entries
    if (!enabled(idx)) {
      for (let i = 0; i < items.length; i++) if (enabled(i)) { idx = i; break; }
    }
    paint();
    return { choose, move, paint, get index() { return idx; } };
  }

  clearBindings() {
    this.list = null;
    this.backFn = null;
    this.enterFn = null;
  }

  menuHTML(items) {
    return `<ul class="menu">${items.map((it, i) => {
      const cls = it.disabled ? "off" : "";
      return `<li class="${cls}" data-i="${i}">${it.label}${it.sub ? `<small class="sub">${it.sub}</small>` : ""}${it.right ? `<span class="price">${it.right}</span>` : ""}</li>`;
    }).join("")}</ul>`;
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add("on");
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.remove("on"), 1600);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  // ------------------------------------------------------------------ main
  showMain() {
    this.clearBindings();
    const s = this.save;
    const career = s.char != null;
    const char = career ? DATA.chars[s.char] : null;
    const bike = career ? bikeByShopIndex(s.bike) : null;
    const done = TRACK_ORDER.filter((id) => (s.progress[id] || 1) > 5).length;
    const items = [
      { label: "Quick Race", sub: "one race · any track · any bike" },
      { label: career ? "Continue Career" : "Career", sub: career ? `${char.short} · ${money(s.cash)}` : "create a rider", onFocus: () => {} },
      { label: "Bike Shop", sub: career ? "Olley's Skoot-A-Rama" : "start a career first" },
      { label: "How to Play" },
      { label: "Restroom", sub: "options & sound" },
      { label: "Credits" },
    ];
    const html = `
      <div class="logo">
        <div class="l1">ROAD</div><div class="l2">RASH</div>
        <div class="tagline">1996 · browser preservation port</div>
      </div>
      <div class="panel progress">
        ${career
          ? `<b>${char.short}</b><br>${money(s.cash)} · ${bike.model}<br>${done}/5 courses conquered`
          : `No career yet.<br>Pick <b>Career</b> to build a rider.`}
      </div>
      ${this.menuHTML(items)}
      <div class="hint">↑↓ select · Enter choose · M mute · F fullscreen</div>
      <div class="corner-note">Original game © Electronic Arts 1996.<br>Fan preservation port · no affiliation.</div>`;
    this.setScreen(html, "./assets/art/street.jpg", "mainmenu");
    this.backFn = null;
    const list = this.bind(items, (i) => {
      if (i === 0) this.showTracks("quick");
      else if (i === 1) this.save.char == null ? this.showChars("new", () => this.showMain()) : this.showCareer();
      else if (i === 2) this.save.char == null ? this.showChars("new", () => this.showMain()) : this.showShop(() => this.showMain());
      else if (i === 3) this.showHelp(() => this.showMain());
      else if (i === 4) this.showOptions(() => this.showMain());
      else if (i === 5) this.showCredits(() => this.showMain());
    });
  }

  // --------------------------------------------------------------- tracks
  showTracks(mode = "career", back = () => this.showMain()) {
    this.clearBindings();
    const s = this.save;
    let focus = 0;
    const update = (i) => {
      const id = TRACK_ORDER[i];
      const t = trackInfo(id);
      const lvl = mode === "career" ? Math.min(5, s.progress[id] || 1) : this.quickLevel || 1;
      const done = (s.progress[id] || 1) > 5;
      const desc = $(".track-desc", this.ui);
      if (desc) desc.textContent = trackBlurb(id);
      const len = $(".track-length", this.ui);
      if (len) len.textContent = `${trackLength(id, lvl, s.settings.units)} · ${done ? "CHAMPION" : mode === "career" ? `Level ${lvl}/5` : "Quick Race"}`;
      const card = $(".cardwrap img", this.ui);
      if (card) card.src = trackCard(id);
    };
    const items = TRACK_ORDER.map((id, i) => {
      const lvl = s.progress[id] || 1;
      const sub = mode === "career" ? (lvl > 5 ? "champion" : `Lv ${lvl}`) : "";
      return { label: trackName(id), sub };
    });
    const html = `
      <div class="left-rail"></div>
      <div class="titlebox"><div class="eyebrow">${mode === "career" ? "Big Game" : "Quick Race"}</div><div class="title">Choose Track</div></div>
      <div class="tracklist">${this.menuHTML(items)}</div>
      <div class="desc track-desc"></div>
      <div class="track-length"></div>
      <div class="cardwrap"><img class="card" alt=""></div>
      <div class="hint">↑↓ choose track · Enter ${mode === "career" ? "race" : "pick level"} · Esc back</div>`;
    this.setScreen(html, "./assets/art/street.jpg", "trackscreen");
    this.backFn = back;
    const list = this.bind(items, (i) => {
      const id = TRACK_ORDER[i];
      if (mode === "career") {
        this.startQuickOrCareer({ track: id, level: Math.min(5, s.progress[id] || 1), mode: "career" });
      } else {
        this.showLevels(id, () => this.showTracks("quick"));
      }
    }, { initial: focus });
    items.forEach((it, i) => (it.onFocus = () => update(i)));
    update(0);
  }

  showLevels(trackId, back) {
    this.clearBindings();
    const s = this.save;
    const items = Array.from({ length: 5 }, (_, i) => ({
      label: `Level ${i + 1}`,
      sub: trackLength(trackId, i + 1, s.settings.units),
    }));
    const html = `
      <div class="left-rail"></div>
      <div class="titlebox"><div class="eyebrow">${trackName(trackId)}</div><div class="title">Choose Level</div></div>
      <div class="tracklist" style="top:150px">${this.menuHTML(items)}</div>
      <div class="desc track-desc">${trackBlurb(trackId)}</div>
      <div class="cardwrap"><img class="card" src="${trackCard(trackId)}" alt=""></div>
      <div class="hint">↑↓ level · Enter choose bike · Esc back</div>`;
    this.setScreen(html, "./assets/art/street.jpg", "trackscreen");
    this.backFn = back;
    this.bind(items, (i) => this.showBikeSelect({ track: trackId, level: i + 1, mode: "quick" }, () => this.showLevels(trackId, back)));
  }

  // ------------------------------------------------------------- bike pick
  showBikeSelect({ track, level, mode = "quick", char }, back) {
    this.clearBindings();
    const s = this.save;
    let focus = s.bike || 0;
    const focusInfo = (i) => {
      const b = DATA.shopBikes[i];
      const img = $(".shop-pic", this.ui);
      if (img) img.src = b.shot;
      const info = $(".shop-info", this.ui);
      if (info) {
        info.innerHTML = `<div class="name">${b.full}<span class="price">${b.cls.toUpperCase()}</span></div>
          <div class="desc">${bikeStatsLine(b)}\nTOP SPEED: ${b.spec.top.toFixed(0)} mph\n${b.blurb.replace(/\n\$%d[\s\S]*/, "").slice(0, 150)}</div>`;
      }
    };
    const items = DATA.shopBikes.map((b, i) => ({
      label: b.full,
      sub: b.cls.toUpperCase(),
      onFocus: () => focusInfo(i),
    }));
    const html = `
      <div class="left-rail" style="width:280px"></div>
      <div class="titlebox"><div class="eyebrow">${trackName(track)} · Level ${level}</div><div class="title">Choose Bike</div></div>
      <div class="shoplist" style="top:118px;width:250px">${this.menuHTML(items)}</div>
      <img class="shop-pic" alt="">
      <div class="shop-info panel"></div>
      <div class="hint">↑↓ bike · Enter race · Esc back</div>`;
    this.setScreen(html, "./assets/art/street.jpg", "shopscreen");
    this.backFn = back;
    this.bind(items, (i) => {
      s.bike = i;
      s.owned = [...new Set([...(s.owned || []), i])];
      this.ctx.saveNow();
      this.startQuickOrCareer({ track, level, mode, bikeIndex: i, char });
    }, { initial: focus });
    focusInfo(focus);
  }

  // --------------------------------------------------------------- career
  showCareer(back = () => this.showMain()) {
    this.clearBindings();
    const s = this.save;
    if (s.char == null) return this.showChars("new", () => this.showMain());
    const c = DATA.chars[s.char];
    const b = bikeByShopIndex(s.bike);
    const done = TRACK_ORDER.filter((id) => (s.progress[id] || 1) > 5).length;
    const champ = done === 5;
    const items = [
      { label: champ ? "Defend Your Title" : "Next Race", sub: "Bulletin Board" },
      { label: "Bike Shop", sub: `Olley's · ${money(s.cash)}` },
      { label: "Rider Card", sub: c.short },
      { label: "Main Menu" },
    ];
    const prog = TRACK_ORDER.map((id) => {
      const lv = s.progress[id] || 1;
      return `<div style="display:flex;justify-content:space-between;gap:8px"><span>${trackName(id)}</span><b style="color:${lv > 5 ? "#8bff9b" : "#f8f078"}">${lv > 5 ? "DONE" : `Lv ${lv}`}</b></div>`;
    }).join("");
    const html = `
      <div class="left-rail" style="width:286px"></div>
      <div class="titlebox"><div class="eyebrow">Big Game</div><div class="title">${champ ? "Champion" : "Career"}</div></div>
      <div class="charportrait" style="left:300px;width:340px;height:420px;background:url('${c.portrait}') center/cover no-repeat;position:absolute;"></div>
      <div style="position:absolute;left:18px;top:122px;width:250px">${this.menuHTML(items)}</div>
      <div class="panel" style="position:absolute;left:18px;bottom:24px;width:250px;padding:8px 12px;font-size:12px;line-height:17px">
        <b style="color:var(--hot);font-size:16px">${c.short}</b><br>
        ${money(s.cash)} · ${b.full}<br>
        <div style="margin-top:6px;color:#a9bab5">${prog}</div>
      </div>
      <div class="hint">↑↓ select · Enter choose · Esc main menu</div>`;
    this.setScreen(html, "./assets/art/street.jpg", "careerscreen");
    this.backFn = back;
    this.bind(items, (i) => {
      if (i === 0) this.showTracks("career", () => this.showCareer());
      else if (i === 1) this.showShop(() => this.showCareer());
      else if (i === 2) this.showCharInfo(c.index, () => this.showCareer());
      else this.showMain();
    });
  }

  showChars(mode = "new", back = () => this.showMain()) {
    this.clearBindings();
    let focus = 0;
    const update = (i) => {
      const c = DATA.chars[i];
      const img = $(".charportrait", this.ui);
      if (img) img.src = c.portrait;
      const bio = $(".charbio", this.ui);
      if (bio) bio.textContent = c.bio;
      const stats = $(".charstats", this.ui);
      if (stats) {
        const r = c.rider;
        stats.innerHTML = `<b>${c.name}</b> · ${money(c.cash)} · ${c.bike.full}<br>
          ${Math.floor(r.height / 12)}'${r.height % 12}" · ${r.weight} lbs · STR ${r.strength} · STA ${r.stamina}<br>
          Weapon: ${["fists", "club", "chain"][r.weapon] || "fists"}`;
      }
    };
    const items = DATA.chars.map((c, i) => ({ label: c.short, sub: i === 0 ? "starter" : "", onFocus: () => update(i) }));
    const html = `
      <div class="left-rail"></div>
      <div class="titlebox"><div class="eyebrow">${mode === "view" ? "Rider" : "Big Game"}</div><div class="title">${mode === "view" ? "Rider Card" : "Choose Rider"}</div></div>
      <img class="charportrait" alt="">
      <div class="charlist">${this.menuHTML(items)}</div>
      <div class="desc charbio"></div>
      <div class="panel charstats"></div>
      <div class="hint">↑↓ rider · Enter ${mode === "view" ? "back" : "start career"} · Esc back</div>`;
    this.setScreen(html, "./assets/art/panzer.jpg", "charscreen");
    this.backFn = back;
    this.bind(items, (i) => {
      if (mode === "view") return back();
      const c = DATA.chars[i];
      const s = this.save;
      s.char = i;
      s.cash = c.cash;
      s.bike = c.bike.shopIndex;
      s.owned = [c.bike.shopIndex];
      s.progress = Object.fromEntries(TRACK_ORDER.map((id) => [id, 1]));
      s.best = {};
      this.ctx.saveNow();
      this.toast(`${c.short} is ready to race`);
      this.showCareer();
    }, { initial: focus });
    update(0);
  }

  showCharInfo(index, back) {
    this.clearBindings();
    const c = DATA.chars[index];
    const r = c.rider;
    const html = `
      <div class="left-rail"></div>
      <div class="titlebox"><div class="eyebrow">Big Game</div><div class="title">${c.short}</div></div>
      <img class="charportrait" src="${c.portrait}" alt="">
      <div class="desc" style="top:130px;width:220px">${c.bio}</div>
      <div class="panel" style="position:absolute;left:18px;bottom:30px;width:215px;padding:8px 10px;font-size:12px;line-height:17px">
        <b style="color:var(--hot)">${c.bike.full}</b><br>
        ${Math.floor(r.height / 12)}'${r.height % 12}" · ${r.weight} lbs<br>
        Strength ${r.strength} · Stamina ${r.stamina}<br>
        ${money(c.cash)} starting cash
      </div>
      <div class="hint">Esc back</div>`;
    this.setScreen(html, "./assets/art/panzer.jpg", "charscreen");
    this.backFn = back;
    this.enterFn = back;
  }

  // ----------------------------------------------------------------- shop
  showShop(back, initial = null) {
    this.clearBindings();
    const s = this.save;
    let focus = initial == null ? (s.bike || 0) : initial;
    const focusInfo = (i) => {
      const b = DATA.shopBikes[i];
      const img = $(".shop-pic", this.ui);
      if (img) img.src = b.floor;
      const info = $(".shop-info", this.ui);
      if (info) {
        const owned = s.owned.includes(i);
        const equipped = s.bike === i;
        info.innerHTML = `<div class="name">${b.full}<span class="price">${owned ? (equipped ? "RIDING" : "OWNED") : money(b.price)}</span></div>
          <div class="desc">${bikeStatsLine(b)} · ${b.spec.top.toFixed(0)} mph top speed\n${b.blurb.replace(/\n\$%d[\s\S]*/, "").slice(0, 230)}</div>`;
      }
      const buy = $(".shop-buy", this.ui);
      if (buy) {
        const owned = s.owned.includes(i);
        buy.textContent = owned ? (s.bike === i ? "Equipped" : "Ride this bike") : s.cash >= b.price ? "Buy bike" : "Not enough cash";
        buy.disabled = !owned && s.cash < b.price;
      }
    };
    const items = DATA.shopBikes.map((b, i) => {
      const owned = s.owned.includes(i);
      const eq = s.bike === i;
      return {
        label: b.full,
        sub: "",
        right: eq ? "RIDING" : owned ? "OWNED" : money(b.price),
        onFocus: () => focusInfo(i),
      };
    });
    const html = `
      <div class="left-rail" style="width:292px"></div>
      <div class="titlebox"><div class="eyebrow">Olley's Skoot-A-Rama</div><div class="title">Bike Shop</div></div>
      <div class="shoplist">${this.menuHTML(items)}</div>
      <img class="shop-pic" alt="">
      <div class="shop-info panel"></div>
      <button class="shop-buy" type="button">Buy bike</button>
      <div class="panel" style="position:absolute;right:12px;bottom:52px;padding:5px 10px;font-size:13px;color:var(--hot)">Cash: ${money(s.cash)}</div>
      <div class="hint">↑↓ browse · Enter buy/equip · Esc back</div>`;
    this.setScreen(html, "./assets/art/olleys.jpg", "shopscreen");
    this.backFn = back;
    const action = (i) => {
      const b = DATA.shopBikes[i];
      if (s.owned.includes(i)) {
        s.bike = i;
        this.ctx.saveNow();
        this.toast(`Now riding ${b.full}`);
        this.showShop(back, i);
        return;
      }
      if (s.cash < b.price) {
        this.toast("Not enough cash");
        return;
      }
      s.cash -= b.price;
      s.owned.push(i);
      s.bike = i;
      this.ctx.saveNow();
      this.audio.sfx("bounce", { volume: 0.5, rate: 1.4 });
      this.toast(`${b.full} purchased`);
      this.showShop(back, i);
    };
    const list = this.bind(items, action, { initial: focus });
    $(".shop-buy", this.ui).addEventListener("click", () => action(list.index));
    focusInfo(focus);
  }

  // -------------------------------------------------------------- options
  showOptions(back = () => this.showMain()) {
    this.clearBindings();
    const s = this.save;
    const st = s.settings;
    const defs = [
      ["master", "Master Volume", 0, 1, 0.05, "Overall game volume."],
      ["music", "Music Volume", 0, 1, 0.05, "Procedural tribute soundtrack."],
      ["sfx", "Effects Volume", 0, 1, 0.05, "Crashes, punches, sirens."],
      ["engine", "Engine Volume", 0, 1, 0.05, "Bike engine loop."],
      ["musicOn", "Music", "toggle", null, null, "Turn the soundtrack on or off."],
      ["units", "Units", "units", null, null, "Speed and race length units."],
      ["camera", "Camera", "camera", null, null, "Chase camera or a closer view."],
      ["assist", "Racing Assist", 0, 1, 0.05, "Gentler traffic and rivals when you need it."],
      ["fullscreen", "Fullscreen", "fullscreen", null, null, "Toggle browser fullscreen."],
      ["delete", "Erase Career", "delete", null, null, "Delete the saved career and start over."],
    ];
    let focus = 0;
    const valueOf = (d) => {
      const [key, , a, b, step, desc] = d;
      if (key === "fullscreen") return document.fullscreenElement ? "On" : "Off";
      if (key === "delete") return "Erase";
      const v = st[key];
      if (key === "units") return v === "km" ? "km/h" : "mph";
      if (key === "camera") return v === "close" ? "Close" : "Chase";
      if (key === "musicOn") return v ? "On" : "Off";
      return `${Math.round(v * 100)}%`;
    };
    const render = () => DATA ? defs.map((d, i) => {
      const label = d[1];
      const cls = d[0] === "delete" ? 'style="color:#ff8a70"' : "";
      return `<li data-i="${i}" ${cls}>${label}<span class="val">${valueOf(d)}</span></li>`;
    }).join("") : "";
    const updateDesc = (i) => {
      const desc = $(".optdesc", this.ui);
      if (desc) desc.textContent = defs[i][5] || "";
    };
    const html = `
      <div class="left-rail" style="width:330px"></div>
      <div class="titlebox"><div class="eyebrow">The Restroom</div><div class="title">Options</div></div>
      <div class="optlist"><ul class="menu">${render()}</ul></div>
      <div class="optdesc panel"></div>
      <div class="hint">↑↓ option · ←→ change · Enter toggle · Esc back</div>`;
    this.setScreen(html, "./assets/art/restroom/rest1.jpg", "optscreen");
    this.backFn = back;
    const apply = (key) => {
      this.ctx.saveNow();
      this.audio.setVolumes({ master: st.master, music: st.music, sfx: st.sfx, engine: st.engine });
      this.audio.setMusic(st.musicOn);
    };
    const change = (i, dir) => {
      const [key] = defs[i];
      if (["musicOn", "units", "camera", "fullscreen", "delete"].includes(key)) {
        if (key === "musicOn") st.musicOn = !st.musicOn;
        else if (key === "units") st.units = st.units === "mph" ? "km" : "mph";
        else if (key === "camera") st.camera = st.camera === "chase" ? "close" : "chase";
        else if (key === "fullscreen") this.toggleFullscreen();
        else if (key === "delete") return this.confirmDelete(back);
      } else if (key === "assist") {
        st.assist = Math.max(0, Math.min(1, Math.round((st.assist + dir * 0.05) * 100) / 100));
      } else {
        st[key] = Math.max(0, Math.min(1, Math.round((st[key] + dir * defs[i][4]) * 100) / 100));
      }
      apply(key);
      const ul = $(".optlist .menu", this.ui);
      if (ul) ul.innerHTML = render();
      updateDesc(i);
      // rebind to keep listeners on new elements
      this.bindOptions(defs, i, change, updateDesc, back);
    };
    this.bindOptions(defs, focus, change, updateDesc, back);
    updateDesc(0);
    this.enterFn = () => this.confirmDelete(back);
  }

  bindOptions(defs, focus, change, updateDesc, back) {
    const items = defs.map((d, i) => ({
      label: d[1],
      sub: "",
      onFocus: () => updateDesc(i),
    }));
    // values are already in the rendered li; bind needs li elements
    const els = [...this.ui.querySelectorAll(".optlist [data-i]")];
    let idx = Math.min(focus, defs.length - 1);
    const enabled = (i) => !!defs[i];
    const paint = () => {
      els.forEach((el, i) => el.classList.toggle("on", i === idx));
      updateDesc(idx);
    };
    const move = (dir) => {
      idx = (idx + dir + defs.length) % defs.length;
      this.audio.click();
      paint();
    };
    this.list = {
      key: (e) => {
        if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); move(-1); }
        else if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); change(idx, -1); }
        else if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); change(idx, 1); }
        else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); change(idx, 1); }
        else if (e.key === "Escape") { e.preventDefault(); back(); }
      },
    };
    els.forEach((el, i) => {
      el.addEventListener("mouseenter", () => { idx = i; paint(); });
      el.addEventListener("click", () => { idx = i; paint(); change(i, 1); });
    });
    paint();
  }

  confirmDelete(back) {
    this.clearBindings();
    const html = `
      <div class="left-rail" style="width:420px"></div>
      <div class="titlebox"><div class="eyebrow">Warning</div><div class="title">Erase Career?</div></div>
      <div class="desc" style="top:140px;width:380px">This deletes your rider, cash, bikes, progress and best times. It cannot be undone.</div>
      <ul class="menu" style="position:absolute;left:18px;top:260px">
        <li data-i="0">No, keep my career</li>
        <li data-i="1" style="color:#ff8a70">Yes, erase everything</li>
      </ul>
      <div class="hint">Esc cancel</div>`;
    this.setScreen(html, "./assets/art/restroom/rest2.jpg", "optscreen");
    this.backFn = back;
    const items = [{ label: "No" }, { label: "Yes" }];
    this.bind(items, (i) => {
      if (i === 0) return back();
      localStorage.removeItem("rr96-save");
      this.toast("Career erased — reloading");
      setTimeout(() => location.reload(), 400);
    });
  }

  // -------------------------------------------------------------- credits
  showCredits(back) {
    this.clearBindings();
    const html = `
      <div class="left-rail" style="width:280px"></div>
      <div class="titlebox"><div class="eyebrow">The Street</div><div class="title">Credits</div></div>
      <div class="creditscroll panel">
        <h3>Original Game</h3>
        <p><b>Road Rash</b> (1996, PC)<br>Published by Electronic Arts.<br>PC version developed by Papyrus Design Group.<br>Original design, art, music and characters © Electronic Arts.</p>
        <h3>This Port</h3>
        <p>A non-commercial fan preservation project. Built in the browser with Three.js. No original CD audio is included; the soundtrack is a procedural tribute.</p>
        <p>Reverse engineering: CRSR/LBTR resource containers, RPTH road paths, HIBOB rider banks, BOB paletted art, ENU.DLL string tables and the BIKESPEC tables. Format work was assisted by the REA reverse-engineering toolkit.</p>
        <h3>Assets</h3>
        <p>All original artwork, rider sprites, fonts, sound effects and text are read from the user's own Road Rash installation. Please do not redistribute the extracted game assets.</p>
        <h3>Thanks</h3>
        <p>To the people who made the original, and to everyone keeping 90s PC racing alive.</p>
        <p style="margin-top:18px;color:#9fb2ad">If you enjoy this, buy a legitimate copy of the original game.</p>
      </div>
      <div class="hint">Esc / Enter back</div>`;
    this.setScreen(html, "./assets/art/credits.jpg", "creditsscreen");
    this.backFn = back;
    this.enterFn = back;
  }

  // ----------------------------------------------------------------- help
  showHelp(back) {
    this.clearBindings();
    const html = `
      <div class="left-rail" style="width:430px"></div>
      <div class="titlebox"><div class="eyebrow">The Street</div><div class="title">How to Play</div></div>
      <div class="desc" style="top:126px;width:390px;font-size:14px;line-height:19px">
        You are in a point-to-point road race. Finish in the top three to qualify. Fight rivals with your fists, feet, a club or a chain. Traffic hurts. So do police.
      </div>
      <div class="panel" style="position:absolute;left:18px;top:240px;width:390px;padding:10px 14px;font-size:13px;line-height:19px">
        <b style="color:var(--hot)">KEYBOARD</b><br>
        <span class="kbd">↑ / W</span> throttle · <span class="kbd">↓ / S</span> brake<br>
        <span class="kbd">← → / A D</span> steer & lean<br>
        <span class="kbd">J</span> / <span class="kbd">Z</span> / left click punch · <span class="kbd">K</span> / <span class="kbd">X</span> / right click kick<br>
        <span class="kbd">Shift</span> nitro · <span class="kbd">C</span> camera · <span class="kbd">P / Esc</span> pause<br>
        <b style="color:var(--hot)">TOUCH</b><br>
        Left/right pads steer. GAS, BRAKE, PUNCH, KICK and NITRO are on the right.<br>
        <b style="color:var(--hot)">TIPS</b><br>
        Stay off the dirt. Draft traffic, then punch the rider beside you. Save nitro for the straights.
      </div>
      <div class="hint">Esc / Enter back</div>`;
    this.setScreen(html, "./assets/art/street.jpg", "helpscreen");
    this.backFn = back;
    this.enterFn = back;
  }

  // --------------------------------------------------------------- launch
  async startQuickOrCareer(opts) {
    const s = this.save;
    if (opts.mode === "career" && s.char == null) return this.showChars("new", () => this.showMain());
    const mode = opts.mode || "quick";
    const bikeIndex = opts.bikeIndex ?? s.bike;
    const bike = DATA.shopBikes[bikeIndex];
    const level = opts.level || 1;
    const scheme = mode === "career" ? [5, 2, 10, 8, 1, 4, 11, 6][s.char] % 8 : 0;
    const raceOpts = {
      track: opts.track,
      level,
      mode,
      bike,
      bikeIndex,
      char: mode === "career" ? DATA.chars[s.char] : null,
      scheme,
      assist: s.settings.assist,
      units: s.settings.units,
      camera: s.settings.camera,
    };
    this.lastRaceOpts = raceOpts;
    this.setRacing(true);
    this.audio.stopMusic();
    let result;
    try {
      result = await this.ctx.startRace(raceOpts);
    } catch (err) {
      console.error(err);
      this.setRacing(false);
      this.toast("Race failed to start — see console");
      return this.showMain();
    }
    this.setRacing(false);
    if (!result || result.status === "quit") {
      if (mode === "career") this.showCareer();
      else this.showTracks("quick");
      return;
    }
    this.handleResult(result, raceOpts);
  }

  handleResult(result, raceOpts) {
    const s = this.save;
    const level = raceOpts.level;
    const track = raceOpts.track;
    let cash = 0;
    let qualified = false;
    let advanced = false;
    let champion = false;
    if (result.status === "finished") {
      cash = prizeFor(result.place, level);
      if (raceOpts.mode === "career") {
        if (result.place <= 3) {
          qualified = true;
          const cur = s.progress[track] || 1;
          if (level >= cur && cur <= 5) {
            s.progress[track] = cur + 1;
            advanced = true;
            if (s.progress[track] > 5 && allDone(s)) champion = true;
          }
        }
        s.cash += cash;
        s.best[`${track}-${level}`] = Math.min(s.best[`${track}-${level}`] ?? Infinity, result.time);
        this.ctx.saveNow();
      }
      this.audio.sfx(result.place === 1 ? "f_yeah" : "m_yeah", { volume: 0.7 });
    } else {
      this.audio.sfx(result.status === "busted" ? "siren" : "crashhar", { volume: 0.5 });
    }
    this.showResults(result, { ...raceOpts, cash, qualified, advanced, champion });
  }

  showResults(result, opts) {
    this.clearBindings();
    const s = this.save;
    const level = opts.level;
    let art;
    if (result.status === "busted") art = `bust${Math.min(6, level)}`;
    else if (result.status === "wrecked") art = `wreck${Math.min(6, level)}`;
    else if (result.status === "finished") art = result.place <= 3 ? `win${Math.min(6, result.place)}` : `lose${Math.min(6, result.place - 3)}`;
    else art = `lose${Math.min(6, level)}`;
    if (opts.champion) art = "finale";
    const place = result.status === "finished" ? `${result.place}${placeSuffix(result.place)}` : (result.status === "busted" ? "BUSTED" : "WRECKED");
    const qual = result.status === "finished" && opts.mode === "career"
      ? (opts.qualified ? (opts.champion ? "YOU REIGN SUPREME!" : `QUALIFIED — ${opts.advanced ? `Level ${Math.min(5, level + 1)} unlocked` : "keep racing"}`) : "No qualification — finish top 3")
      : "";
    const bestKey = `${opts.track}-${level}`;
    const best = s.best[bestKey];
    const items = [
      { label: opts.mode === "career" ? "Continue" : "Main Menu" },
      { label: "Race Again" },
      { label: "Choose Track" },
    ];
    const html = `
      <img class="results-art" src="./assets/art/results/${art}.jpg" alt="">
      <div class="results-panel">
        <div class="place">${place}</div>
        <div class="line">${trackName(opts.track)} · Level ${level}${"<br>"}${clock(result.time)}${result.best ? " · new best" : ""}</div>
        ${result.status === "finished" ? `<div class="line money">Prize: ${money(opts.cash || 0)}${opts.mode === "career" ? ` · Cash: ${money(s.cash)}` : ""}</div>` : ""}
        ${best && result.status === "finished" ? `<div class="line" style="color:#a9bab5">Best: ${clock(best)}</div>` : ""}
        ${qual ? `<div class="line" style="color:var(--hot);margin-top:4px">${qual}</div>` : ""}
      </div>
      <div class="panel results-menu">${this.menuHTML(items)}</div>
      <div class="banner">${result.status === "finished" ? "RACE COMPLETE" : result.status === "busted" ? "BUSTED" : "WRECKED"}</div>
      <div class="hint">↑↓ choose · Enter select</div>`;
    this.setScreen(html, "", "resultsscreen");
    this.audio.playMusic("menu");
    this.backFn = () => this.showMain();
    this.bind(items, (i) => {
      if (i === 0) return opts.mode === "career" ? this.showCareer() : this.showMain();
      if (i === 1) return this.startQuickOrCareer(opts);
      if (i === 2) return this.showTracks(opts.mode);
    });
  }
}
