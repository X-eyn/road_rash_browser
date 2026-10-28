// Asset loading: images, JSON, Three.js textures, and per-track bundles.
import * as THREE from "three";
import { DATA } from "./data.js";

const images = new Map();
const textures = new Map();
const jsonCache = new Map();

export function loadImage(url) {
  if (images.has(url)) return images.get(url);
  const p = new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`image failed: ${url}`));
    im.src = url;
  });
  images.set(url, p);
  return p;
}

export async function loadJSON(url) {
  if (jsonCache.has(url)) return jsonCache.get(url);
  const p = fetch(url).then(async (r) => {
    if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
    return r.json();
  });
  jsonCache.set(url, p);
  return p;
}

export async function loadText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return r.text();
}

export function imageSync(url) {
  // returns the loaded image if available (UI helpers)
  const p = images.get(url);
  return p && p.__done ? p.__done : null;
}

export function texture(url, { nearest = true, flipY = true, wrap = THREE.ClampToEdgeWrapping } = {}) {
  const key = `${url}|${nearest}|${flipY}|${wrap}`;
  if (textures.has(key)) return textures.get(key);
  const img = new Image();
  img.onload = () => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
    t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = !nearest;
    t.flipY = flipY;
    t.wrapS = t.wrapT = wrap;
    t.needsUpdate = true;
    entry.tex = t;
    entry.resolve(t);
  };
  img.onerror = () => entry.reject(new Error(`texture failed: ${url}`));
  img.src = url;
  const entry = { tex: null, resolve: null, reject: null };
  const p = new Promise((res, rej) => {
    entry.resolve = res;
    entry.reject = rej;
  });
  entry.promise = p;
  textures.set(key, entry);
  return entry;
}

export async function getTexture(url, opts) {
  const e = texture(url, opts);
  if (e.tex) return e.tex;
  return e.promise;
}

export async function preload(urls, onProgress = () => {}) {
  let done = 0;
  const list = [...new Set(urls)].filter(Boolean);
  await Promise.all(
    list.map(async (u) => {
      try {
        await loadImage(u);
      } catch (e) {
        console.warn(e.message);
      }
      onProgress(++done / list.length);
    })
  );
}

export function uniqueCarUrls(course) {
  const c = DATA.cars?.[course];
  if (!c) return [];
  const names = [...new Set([...(c.moving || []), ...(c.parked || [])].map((x) => x.name))];
  return names.map((n) => `./assets/sprites/cars/${n}.png`);
}

export async function loadTrackBundle(course, schemes, onProgress = () => {}) {
  const urls = [
    `./assets/track/${course}/atlas.png`,
    `./assets/track/${course}/horizon.png`,
    `./assets/sprites/cloud-big.png`,
    `./assets/sprites/cloud-small.png`,
    ...schemes.map((s) => `./assets/sprites/rider${s}.png`),
    ...uniqueCarUrls(course),
  ];
  await preload(urls, onProgress);
  const [atlas, props, verge] = await Promise.all([
    loadJSON(`./assets/track/${course}/atlas.json`),
    loadJSON(`./assets/track/${course}/props.json`).catch(() => []),
    loadJSON(`./assets/track/${course}/verge.json`).catch(() => []),
  ]);
  return { atlas, props, verge, carUrls: uniqueCarUrls(course) };
}

export function disposeTextureCache() {
  for (const e of textures.values()) {
    if (e.tex) e.tex.dispose();
  }
  textures.clear();
}
