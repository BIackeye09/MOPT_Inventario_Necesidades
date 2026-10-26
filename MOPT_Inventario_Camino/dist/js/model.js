// Reglas del inventario independientes de la pantalla para poder verificarlas.
import {restoreStations} from './stations.js';
import {restoreGraphics,createGraphics} from './graphics-model.js';
import {restoreSketch,createSketch} from './sketch-model.js';
import {restoreBackObservations} from './back-observations.js';
import {createId as id} from './ids.js';
export const APP_VERSION = 1;
export const STORAGE_KEY = 'mopt.inventario-camino.v1';
export const SURFACES = [
  { code: '1', name: 'Asfalto' }, { code: '2', name: 'Concreto' },
  { code: '3', name: 'Tratamiento superficial' },
  { code: '4', name: 'Lastre o grava' }, { code: '5', name: 'Tierra' }
];

const clean = (v, max = 1000) => String(v ?? '').trim().slice(0, max);

export function createInventory() {
  const sheetId = id();
  return { schemaVersion: APP_VERSION, id: id(), number: '', macroRegion: 'V',
    surface: '', road: null, sheets: [{ id: sheetId, stations: [], graphics:createGraphics(),sketch:createSketch(),backObservations:'' }], activeSheetId: sheetId,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function selectRoad(inventory, road) {
  // Se copia el registro para que una corrección no modifique el catálogo.
  return { ...inventory, road: { ...road, source: { ...road.source }, mode: 'catalog' } };
}

export function createManualRoad() {
  return { mode: 'manual', type: 'C', code: '', section: '', route: '', lengthKm: '',
    from: '', to: '', description: '', provinceCode: '4', provinceName: 'Heredia',
    cantonCode: '', cantonName: '', network: 'Ingreso manual', needsReview: false };
}

export function sheetLabel(inventory, sheetId = inventory.activeSheetId) {
  const index = inventory.sheets.findIndex(s => s.id === sheetId);
  return `Hoja ${index + 1} de ${inventory.sheets.length}`;
}

export function addSheet(inventory) {
  // El encabezado es común. Agregar una hoja conserva la hoja que se estaba usando.
  return { ...inventory, sheets: [...inventory.sheets, { id: id(), stations: [], graphics:createGraphics(),sketch:createSketch(),backObservations:'' }] };
}

export function removeSheet(inventory, sheetId) {
  if (inventory.sheets.length <= 1) return inventory;
  const sheets = inventory.sheets.filter(s => s.id !== sheetId);
  return { ...inventory, sheets,
    activeSheetId: sheets.some(s => s.id === inventory.activeSheetId) ? inventory.activeSheetId : sheets[0].id };
}

export function parseKm(value) {
  if (value === '' || value === null || value === undefined) return null;
  const s = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function validateHeader(inventory) {
  const errors = [];
  const road = inventory.road;
  const issue = (field, message) => errors.push({ field, message });
  if (!road) issue('road-picker', 'Seleccioná un camino o agregalo manualmente.');
  else {
    if (!['N', 'C'].includes(road.type)) issue('road-type', 'Indicá si la ruta es nacional o cantonal.');
    if (!clean(road.code)) issue('road-code', 'Completá el código del camino.');
    if (!clean(road.from)) issue('road-from', 'Completá el punto de inicio (DE).');
    if (!clean(road.to)) issue('road-to', 'Completá el punto final (A).');
    if (!clean(road.route)) issue('road-route', 'Completá el número de ruta.');
    if (parseKm(road.lengthKm) === null) issue('road-length', 'La longitud debe ser mayor que cero, en kilómetros.');
    if (!road.provinceCode || !road.provinceName) issue('road-province', 'Seleccioná la provincia.');
    if (!road.cantonCode || !road.cantonName) issue('road-canton', 'Seleccioná el cantón.');
  }
  if (!SURFACES.some(s => s.code === inventory.surface)) issue('surface', 'Seleccioná el tipo de superficie actual.');
  // NÚMERO es opcional: todavía no se ha definido su criterio institucional.
  return errors;
}

export function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function searchRoads(roads, { query = '', province = '4', canton = '' } = {}) {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return roads.filter(r => {
    if (province && r.provinceCode !== province) return false;
    if (canton && r.cantonCode !== canton) return false;
    const haystack = normalize([r.code, r.section, r.route, r.description, r.cantonName, r.provinceName,
      r.code.replace(/-/g, '')].join(' '));
    return terms.every(t => haystack.includes(t));
  }).sort((a, b) => {
    // Un código exacto se presenta primero, seguido de coincidencias de ruta.
    const q = normalize(query).trim();
    const rank = r => (r.code === q || r.section === q) ? 0 : r.route === q ? 1 : 2;
    return rank(a) - rank(b) || Number(a.section) - Number(b.section);
  });
}

export function toBackup(inventory) {
  return JSON.stringify({ application: 'MOPT-DPA-301', backupVersion: 1, inventory }, null, 2);
}

export function fromBackup(raw, catalog) {
  // Solo se aceptan campos conocidos. Los códigos geográficos deben existir en el catálogo.
  const payload = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (payload?.application !== 'MOPT-DPA-301' || payload.backupVersion !== 1) throw new Error('Este archivo no es un respaldo de Inventario del Camino.');
  const input = payload.inventory;
  if (!input || input.schemaVersion !== APP_VERSION || input.macroRegion !== 'V') throw new Error('La versión o macro región del respaldo no es compatible.');
  if (!Array.isArray(input.sheets) || input.sheets.length < 1 || input.sheets.length > 1000) throw new Error('El respaldo debe contener entre 1 y 1000 hojas.');
  const sheets = input.sheets.map(s => {
    const stations=restoreStations(s?.stations);
    return {id:clean(s?.id,120),stations,graphics:restoreGraphics(s?.graphics,stations),sketch:restoreSketch(s?.sketch),backObservations:restoreBackObservations(s?.backObservations)};
  });
  if (sheets.some(s => !s.id) || new Set(sheets.map(s => s.id)).size !== sheets.length) throw new Error('La numeración de hojas del respaldo está dañada.');
  let road = null;
  if (input.road) {
    const r = input.road;
    if (!['N', 'C'].includes(r.type) || !['manual', 'catalog'].includes(r.mode)) throw new Error('El tipo de camino del respaldo no es válido.');
    if (r.provinceCode && !catalog.provinces[r.provinceCode]) throw new Error('La provincia del respaldo no existe en el catálogo.');
    const cantonKey = r.provinceCode + String(r.cantonCode || '');
    if (r.cantonCode && !catalog.cantons[cantonKey]) throw new Error('El cantón no corresponde a la provincia indicada.');
    const canonical = r.mode === 'catalog' ? catalog.roads.find(x => x.id === r.id) : null;
    if (r.mode === 'catalog' && !canonical) throw new Error('El camino del respaldo no se encuentra en esta versión del catálogo.');
    road = canonical ? { ...canonical, mode: 'catalog', from: clean(r.from), to: clean(r.to) } : {
      ...createManualRoad(), type: r.type, code: clean(r.code, 60), route: clean(r.route, 40),
      lengthKm: clean(r.lengthKm, 40), from: clean(r.from), to: clean(r.to),
      provinceCode: clean(r.provinceCode, 1), provinceName: catalog.provinces[r.provinceCode] || '',
      cantonCode: clean(r.cantonCode, 2), cantonName: catalog.cantons[cantonKey] || '' };
  }
  const surface = clean(input.surface, 20);
  if (surface && !SURFACES.some(s => s.code === surface)) throw new Error('El tipo de superficie del respaldo no es válido.');
  return { schemaVersion: APP_VERSION, id: clean(input.id, 120) || id(), number: clean(input.number, 60),
    macroRegion: 'V', road, surface, sheets,
    activeSheetId: sheets.some(s => s.id === input.activeSheetId) ? input.activeSheetId : sheets[0].id,
    createdAt: clean(input.createdAt, 40), updatedAt: clean(input.updatedAt, 40) };
}
