// Pruebas de datos y reglas de negocio: sin librerías de producción adicionales.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import vm from 'node:vm';
import { createInventory, selectRoad, createManualRoad, addSheet, removeSheet, sheetLabel,
  validateHeader, parseKm, searchRoads, SURFACES, toBackup, fromBackup } from '../dist/js/model.js';

const catalog = JSON.parse(await readFile(new URL('../dist/data/caminos.json', import.meta.url), 'utf8'));
const road = section => catalog.roads.find(r => r.section === section);
const complete = () => ({ ...selectRoad(createInventory(), road('40000')), surface: '1' });

test('el código de Heredia toma ruta y longitud del Excel 2024', () => {
  const r = road('40000');
  assert.equal(r.code, '4-0000-00');
  assert.equal(r.route, '3');
  assert.equal(r.lengthKm, 4.865); // El RTF redondeado reportaba 4,87.
  assert.equal(r.provinceCode, '4');
  assert.equal(r.cantonCode, '01');
  assert.equal(r.cantonName, 'Heredia');
  assert.match(r.from, /Vuelta Del Virilla/);
  assert.match(r.to, /Heredia/);
});

test('Santo Domingo y Sarapiquí conservan sus códigos y cantones', () => {
  assert.equal(road('40050').cantonCode, '03');
  assert.equal(road('40050').cantonName, 'Santo Domingo');
  assert.equal(road('40761').cantonCode, '10'); // En el Excel se guarda como texto.
  assert.equal(road('40761').cantonName, 'Sarapiquí');
  assert.equal(road('40761').route, '507');
  assert.equal(road('40761').lengthKm, 7.375);
});

test('las travesías del inventario nacional conservan N', () => {
  assert.equal(road('49011').network, 'Travesía');
  assert.equal(road('49011').type, 'N');
  assert.equal(road('49011').route, '40111');
  assert.equal(road('40111').route, '103');
  assert.notEqual(road('49011').id, road('40111').id);
});

test('no se inventan los extremos de descripciones ambiguas', () => {
  const r = road('40540');
  assert.equal(r.needsReview, true);
  assert.equal(r.from, '');
  assert.equal(r.to, '');
  const inv = { ...selectRoad(createInventory(), r), surface: '1' };
  assert.deepEqual(validateHeader(inv).map(e => e.field), ['road-from', 'road-to']);
  inv.road.from = 'Bajos de Chilamate'; inv.road.to = 'Límite cantonal';
  assert.equal(validateHeader(inv).length, 0);
});

test('el catálogo tiene registros únicos y no confunde código con ruta', () => {
  assert.equal(catalog.audit.herediaCount, 109);
  assert.equal(catalog.audit.roadCount, 1323);
  assert.equal(catalog.roads.filter(r => r.provinceCode === '4' && r.network === 'Ruta nacional').length, 94);
  assert.equal(catalog.roads.filter(r => r.provinceCode === '4' && r.network === 'Travesía').length, 15);
  assert.equal(new Set(catalog.roads.map(r => r.id)).size, catalog.roads.length);
  for (const r of catalog.roads) {
    assert.ok(catalog.cantons[r.provinceCode + r.cantonCode]);
    assert.ok(Number.isFinite(r.lengthKm) && r.lengthKm > 0);
    assert.equal(r.type, 'N');
    assert.ok(r.source.row > 1);
  }
});

test('búsqueda por código, sección, ruta, cantón y acentos', () => {
  assert.equal(searchRoads(catalog.roads, { query: '4-0000-00' })[0].section, '40000');
  assert.equal(searchRoads(catalog.roads, { query: '40000' })[0].code, '4-0000-00');
  assert.ok(searchRoads(catalog.roads, { query: 'sarapiqui' }).length > 0);
  assert.ok(searchRoads(catalog.roads, { query: '507', canton: '10' }).some(r => r.section === '40761'));
  assert.ok(searchRoads(catalog.roads, { province: '', query: 'San Jose' }).length > 0);
  assert.equal(searchRoads(catalog.roads, { query: 'zzzz-no-existe' }).length, 0);
});

test('hojas 1/1, 1/2, 2/2 y 1/3 sin cambiar la hoja activa', () => {
  let inv = complete();
  const first = inv.activeSheetId;
  assert.equal(sheetLabel(inv), 'Hoja 1 de 1');
  inv = addSheet(inv);
  assert.equal(sheetLabel(inv), 'Hoja 1 de 2');
  assert.equal(inv.activeSheetId, first);
  assert.equal(sheetLabel(inv, inv.sheets[1].id), 'Hoja 2 de 2');
  inv = addSheet(inv);
  assert.equal(sheetLabel(inv), 'Hoja 1 de 3');
  assert.equal(inv.road.code, '4-0000-00');
  assert.equal(inv.macroRegion, 'V');
});

test('al eliminar la hoja activa se renumera y nunca se elimina la última', () => {
  let inv = addSheet(addSheet(complete()));
  inv.activeSheetId = inv.sheets[1].id;
  inv = removeSheet(inv, inv.activeSheetId);
  assert.equal(sheetLabel(inv), 'Hoja 1 de 2');
  assert.equal(sheetLabel(inv, inv.sheets[1].id), 'Hoja 2 de 2');
  inv = removeSheet(inv, inv.sheets[1].id);
  assert.equal(removeSheet(inv, inv.activeSheetId).sheets.length, 1);
});

test('la numeración opcional y los códigos de superficie siguen el DPA-301', () => {
  assert.equal(complete().number, '');
  assert.equal(validateHeader(complete()).length, 0);
  assert.equal(SURFACES.find(s => s.code === '2').name, 'Concreto');
  assert.equal(SURFACES.find(s => s.code === '3').name, 'Tratamiento superficial');
  assert.equal(validateHeader(createInventory()).length, 2);
});

test('longitud decimal válida con coma o punto y rechazo de valores inválidos', () => {
  assert.equal(parseKm('1,875'), 1.875);
  assert.equal(parseKm('1.875'), 1.875);
  for (const invalid of ['', '0', '-1', '1/8', 'abc', '1,2.3', 'Infinity', null]) assert.equal(parseKm(invalid), null);
});

test('los respaldos conservan hoja activa, encabezado y correcciones de DE/A', () => {
  let inv = addSheet(complete());
  inv.activeSheetId = inv.sheets[1].id;
  inv.road.from = 'Inicio corregido';
  const restored = fromBackup(toBackup(inv), catalog);
  assert.equal(sheetLabel(restored), 'Hoja 2 de 2');
  assert.equal(restored.road.from, 'Inicio corregido');
  assert.equal(restored.road.lengthKm, 4.865);
  assert.equal(road('40000').from.startsWith('Vuelta'), true);
});

test('un borrador manual incompleto se puede recuperar sin inventar ubicación', () => {
  const inv = { ...createInventory(), road: { ...createManualRoad(), provinceCode: '', provinceName: '' } };
  const restored = fromBackup(toBackup(inv), catalog);
  assert.equal(restored.road.provinceCode, '');
  assert.equal(restored.road.cantonName, '');
  assert.ok(validateHeader(restored).some(e => e.field === 'road-province'));
});

test('un camino cantonal manual conserva decimales y códigos geográficos', () => {
  const inv = { ...createInventory(), surface: '4', road: { ...createManualRoad(), code: '4-03-999', route: '999',
    from: 'Punto inicial', to: 'Punto final', lengthKm: '1,25', cantonCode: '03', cantonName: 'Santo Domingo' } };
  const restored = fromBackup(toBackup(inv), catalog);
  assert.equal(validateHeader(restored).length, 0);
  assert.equal(restored.road.type, 'C');
  assert.equal(restored.road.cantonName, 'Santo Domingo');
  assert.equal(parseKm(restored.road.lengthKm), 1.25);
});

test('se rechazan respaldos incompatibles y hojas repetidas', () => {
  const changes = [
    p => { p.inventory.macroRegion = 'IV'; },
    p => { p.inventory.surface = '11'; },
    p => { p.inventory.sheets.push({ ...p.inventory.sheets[0] }); },
    p => { p.inventory.road.id = 'desconocido'; },
    p => { p.inventory.road.provinceCode = '9'; },
    p => { p.inventory.road.cantonCode = '99'; },
    p => { p.inventory.sheets = []; },
    p => { p.backupVersion = 2; }
  ];
  for (const change of changes) {
    const p = JSON.parse(toBackup(complete())); change(p);
    assert.throws(() => fromBackup(p, catalog));
  }
});

test('la precarga sin conexión referencia solo archivos existentes', async () => {
  const source = await readFile(new URL('../dist/sw.js', import.meta.url), 'utf8');
  const handlers = {};
  let assets;
  const context = { self: { addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: async () => {} },
    caches: { open: async () => ({ addAll: async a => { assets = a; } }) } };
  vm.runInNewContext(source, context);
  let install;
  handlers.install({ waitUntil: promise => { install = promise; } });
  await install;
  for (const asset of assets) await access(new URL('../dist/' + (asset === './' ? 'index.html' : asset), import.meta.url));
  assert.ok(assets.includes('./data/caminos.json'));
});

test('todos los identificadores de interfaz usados por el controlador existen', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../dist/js/app.js', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, element] of source.matchAll(/\$\('([\w-]+)'\)/g)) {
    // Los botones de recuperación se incorporan únicamente al fallar el guardado.
    if (!['recover-draft','storage-copy'].includes(element)) assert.ok(ids.includes(element), `No existe #${element}`);
  }
});
