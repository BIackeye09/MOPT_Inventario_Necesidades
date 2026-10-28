// La caché solo guarda los recursos de esta aplicación, nunca otras páginas del sitio.
const CACHE = 'mopt-inventario-v0.8.4';
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./data/caminos.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./js/app.js",
  "./js/back-observations.js",
  "./js/ids.js",
  "./js/document-ui.js",
  "./js/excel-format.js",
  "./js/documents.js",
  "./js/excel-template.js",
  "./js/model.js",
  "./js/graphics-ui.js",
  "./js/graphics-model.js",
  "./js/sketch-model.js",
  "./js/sketch-ui.js",
  "./js/symbol-catalog.js",
  "./js/excel-drawing.js",
  "./js/stations.js",
  "./js/station-ui.js",
  "./js/pwa.js",
  "./symbols/carretera.png",
  "./manifest.webmanifest",
  "./templates/DPA-301-original.pdf",
  "./templates/DPA-301-original.xls",
  "./vendor/pdf-lib.esm.min.js",
  "./vendor/pdf.min.mjs",
  "./vendor/pdf.worker.min.mjs",
  "./vendor/standard_fonts/FoxitDingbats.pfb",
  "./vendor/standard_fonts/FoxitFixed.pfb",
  "./vendor/standard_fonts/FoxitFixedBold.pfb",
  "./vendor/standard_fonts/FoxitFixedBoldItalic.pfb",
  "./vendor/standard_fonts/FoxitFixedItalic.pfb",
  "./vendor/standard_fonts/FoxitSerif.pfb",
  "./vendor/standard_fonts/FoxitSerifBold.pfb",
  "./vendor/standard_fonts/FoxitSerifBoldItalic.pfb",
  "./vendor/standard_fonts/FoxitSerifItalic.pfb",
  "./vendor/standard_fonts/FoxitSymbol.pfb",
  "./vendor/standard_fonts/LICENSE_FOXIT",
  "./vendor/standard_fonts/LICENSE_LIBERATION",
  "./vendor/standard_fonts/LiberationSans-Bold.ttf",
  "./vendor/standard_fonts/LiberationSans-BoldItalic.ttf",
  "./vendor/standard_fonts/LiberationSans-Italic.ttf",
  "./vendor/standard_fonts/LiberationSans-Regular.ttf"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('mopt-inventario-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const path = new URL(event.request.url).pathname;
  const isAsset = ASSETS.some(asset => new URL(asset, self.registration.scope).pathname === path);
  if (!isAsset && event.request.mode !== 'navigate') return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try { return await fetch(event.request); }
    catch (error) {
      if (event.request.mode === 'navigate') return (await cache.match(new URL('./index.html', self.registration.scope).href)) || Response.error();
      throw error;
    }
  }));
});
