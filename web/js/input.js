// Keyboard, touch and gamepad input.
export class RaceInput {
  constructor(root = document) {
    this.root = root;
    this.keys = new Set();
    this.touch = new Set();
    this.pressed = new Set();
    this.steerAxis = 0;
    this.throttleAxis = 0;
    this.brakeAxis = 0;
    this.pad = null;
    this.onKey = null;
    this._kd = (e) => {
      if (this.onKey) this.onKey(e);
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    };
    this._ku = (e) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", this._kd);
    window.addEventListener("keyup", this._ku);
    this._bindTouch();
  }

  _bindTouch() {
    const on = (el) => {
      const a = el.dataset.action;
      const down = (e) => {
        e.preventDefault();
        if (!this.touch.has(a)) this.pressed.add(a);
        this.touch.add(a);
        el.classList.add("on");
      };
      const up = (e) => {
        e.preventDefault();
        this.touch.delete(a);
        el.classList.remove("on");
      };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    this.root.querySelectorAll?.("[data-action]").forEach(on);
  }

  update() {
    const pads = navigator.getGamepads?.() || [];
    this.pad = [...pads].find((p) => p && p.connected) || null;
    if (this.pad) {
      const ax = this.pad.axes[0] || 0;
      if (Math.abs(ax) > 0.18) this.steerAxis = ax;
      const b = this.pad.buttons;
      if (b[0]?.pressed) this.throttleAxis = 1;
      if (b[1]?.pressed) this.brakeAxis = 1;
      if (b[2]?.pressed) {
        if (!this.padPrev?.[2]) this.pressed.add("j");
      }
      if (b[3]?.pressed) {
        if (!this.padPrev?.[3]) this.pressed.add("k");
      }
      if (b[5]?.pressed) {
        if (!this.padPrev?.[5]) this.pressed.add("shift");
      }
      this.padPrev = b.map((x) => x.pressed);
    } else {
      this.padPrev = null;
    }
  }

  down(...names) {
    return names.some((n) => this.keys.has(n) || this.touch.has(n));
  }

  hit(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  get steer() {
    let s = 0;
    if (this.down("arrowleft", "a")) s -= 1;
    if (this.down("arrowright", "d")) s += 1;
    if (this.down("left")) s -= 1;
    if (this.down("right")) s += 1;
    if (this.steerAxis) s = this.steerAxis;
    return Math.max(-1, Math.min(1, s));
  }

  get throttle() {
    return (this.down("arrowup", "w", "gas") || this.throttleAxis ? 1 : 0);
  }

  get brake() {
    return (this.down("arrowdown", "s", "brake") || this.brakeAxis ? 1 : 0);
  }

  get nitro() {
    return this.down("shift", "nitro");
  }

  get punch() {
    return this.hit("j", "z", "punch", "numpad1", "1", "control", "alt", "space");
  }

  get kick() {
    return this.hit("k", "x", "kick", "numpad2", "2");
  }

  get camera() {
    return this.hit("c");
  }

  endFrame() {
    this.pressed.clear();
    this.throttleAxis = 0;
    this.brakeAxis = 0;
    this.steerAxis = 0;
  }

  destroy() {
    window.removeEventListener("keydown", this._kd);
    window.removeEventListener("keyup", this._ku);
  }
}
