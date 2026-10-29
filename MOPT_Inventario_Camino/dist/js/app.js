// Control de la interfaz: el catálogo y las reglas de numeración viven separados.
import { APP_VERSION, STORAGE_KEY, SURFACES, createInventory, selectRoad, createManualRoad,
  sheetLabel, addSheet, removeSheet, parseKm, validateHeader, searchRoads, toBackup, fromBackup } from './model.js';

import { setupDocuments } from './document-ui.js';
import {setupStations,setupEditorTabs} from './station-ui.js';
import {setupGraphics} from './graphics-ui.js';
import {setupSketch} from './sketch-ui.js';
import {InventoryRepository,inventoryHasData,editableFilename} from './inventory-store.js';
import {setupInventoryUI} from './inventory-ui.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const km = value => parseKm(value) === null ? '—' : new Intl.NumberFormat('es-CR', { maximumFractionDigits: 6 }).format(parseKm(value));
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let documents, stations, graphics, sketch, editorTabs,repository,inventoryUI;
let catalog, inventory, toastTimer, storageFailed = false, offlineReady = false;
let catalogPage = 0, matches = [];
const PAGE_SIZE = 15;

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
}

function downloadText(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function persist() {
  inventory.updatedAt = new Date().toISOString();
  try {
    repository.save(inventory);
    $('save-status').textContent = 'Guardado en este dispositivo';
    if ($('boot-error').dataset.kind === 'storage') $('boot-error').hidden = true;
    storageFailed = false;return true;
  } catch(error) {
    $('save-status').textContent = 'No se pudo guardar';
    if (!$('recover-draft')) {
      $('boot-error').dataset.kind = 'storage';
      $('boot-error').hidden = false;
      const message=error.name==='QuotaExceededError'?'No hay espacio para guardar más trabajo en este navegador.':error.message||'Este navegador no permite guardar el inventario.';
      $('boot-error').innerHTML=`${esc(message)} Guardá una copia editable antes de cerrar. <button id="storage-copy" class="text-button" type="button">Guardar copia editable</button>`;
      $('storage-copy').addEventListener('click',()=>downloadText(toBackup(inventory),editableFilename(inventory)));
    }
    if (!storageFailed) toast('No se pudo guardar. Usá Guardar copia editable para conservar el trabajo.');
    storageFailed = true;return false;
  }
}

function populateProvinces(select, selected = '', all = false) {
  select.innerHTML = `${all ? '<option value="">Todas las provincias</option>' : '<option value="">Sin seleccionar</option>'}` +
    Object.entries(catalog.provinces).map(([code, name]) => `<option value="${code}">${code} · ${esc(name)}</option>`).join('');
  select.value = selected;
}

function populateCantons(select, province, selected = '', all = false) {
  select.innerHTML = `<option value="">${all ? 'Todos los cantones' : 'Seleccionar cantón'}</option>` +
    Object.entries(catalog.cantons).filter(([code]) => code.startsWith(province) && province)
      .map(([code, name]) => `<option value="${code.slice(1)}">${code.slice(1)} · ${esc(name)}</option>`).join('');
  select.value = selected;
}

function renderForm() {
  const r = inventory.road;
  const manual = r?.mode === 'manual';
  $('inventory-number').value = inventory.number;
  $('macro-region').value = 'V';
  $('surface').value = inventory.surface;
  $('road-type').value = r?.type || '';
  $('road-type').disabled = !manual;
  for (const [field, prop] of [['code', 'code'], ['route', 'route'], ['from', 'from'], ['to', 'to'], ['length', 'lengthKm'], ['section', 'section']]) {
    $(`road-${field}`).value = r?.[prop] ?? '';
  }
  for (const field of ['code', 'route', 'length']) $(`road-${field}`).readOnly = !manual;
  $('road-from').disabled = !r;
  $('road-to').disabled = !r;
  populateProvinces($('road-province'), r?.provinceCode || '');
  populateCantons($('road-canton'), r?.provinceCode || '', r?.cantonCode || '');
  $('road-province').disabled = !manual;
  $('road-canton').disabled = !manual || !r?.provinceCode;
  $('province-code').textContent = r?.provinceCode || '—';
  $('canton-code').textContent = r?.cantonCode || '—';
  $('picker-title').textContent = r ? (manual ? 'Camino ingresado manualmente' : `${r.code} · Ruta ${r.route}`) : 'Seleccionar un camino';
  $('picker-caption').textContent = r ? (manual ? 'Podés completar los campos o elegir del catálogo' : `${r.cantonName}, ${r.provinceName} · ${km(r.lengthKm)} km`) : `${catalog.audit.herediaCount} secciones de Heredia y red nacional disponible`;
  $('road-mode-note').textContent = manual ? 'Completá los datos del camino con información verificada.' : r ? 'DE y A se pueden ajustar al tramo de trabajo.' : 'Los datos se completan al elegir un camino.';
  $('road-description').hidden = !r?.source;
  if (r?.source) $('road-description').innerHTML = `<strong>Tramo del catálogo:</strong> ${esc(r.description)}<br><strong>Fuente:</strong> Excel 2024 · ${esc(r.source.sheet)} · fila ${r.source.row}`;
  $('road-alert').hidden = !(manual || r?.needsReview);
  $('road-alert').textContent = manual ? 'Los adjuntos no incluyen un catálogo de caminos cantonales. Verificá el tipo N/C, el código y los demás datos antes de continuar.' : 'La descripción del catálogo tiene una separación ambigua. Revisá el tramo de referencia y completá DE y A manualmente.';
  $('length-hint').textContent = manual ? 'Admite decimales con coma o punto. Debe ser mayor que cero.' : 'Longitud de la sección del Excel 2024; no es la suma de toda la ruta.';
}

function renderDerived() {
  $('current-sheet').textContent = sheetLabel(inventory);
  documents?.refresh();
  stations?.refresh();
  graphics?.refresh();
  sketch?.refresh();
  inventoryUI?.refresh();
}

function renderSheets() {
  $('active-sheet').innerHTML = inventory.sheets.map((sheet, i) => `<option value="${esc(sheet.id)}">${i+1} de ${inventory.sheets.length}</option>`).join('');
  $('active-sheet').value = inventory.activeSheetId;
  $('delete-sheet').disabled = inventory.sheets.length <= 1;
  $('add-sheet').disabled = inventory.sheets.length >= 1000;
}

function clearValidation() {
  $('validation-box').hidden = true;
  document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
}

function commit({ form = false, sheets = false } = {}) {
  clearValidation();
  persist();
  if (form) renderForm();
  if (sheets) renderSheets();
  renderDerived();
}

function confirmAction(title, message, acceptLabel = 'Continuar') {
  return new Promise(resolve => {
    const dialog = $('confirm-dialog');
    $('confirm-title').textContent = title;
    $('confirm-message').textContent = message;
    $('confirm-accept').textContent = acceptLabel;
    dialog.returnValue = 'cancel';
    const close = () => {
      dialog.removeEventListener('close', close);
      resolve(dialog.returnValue === 'accept');
    };
    dialog.addEventListener('close', close);
    dialog.showModal();
    $('confirm-cancel').focus();
  });
}

function openCatalog() {
  if (!catalog) return;
  $('catalog-dialog').showModal();
  renderResults(true);
  $('catalog-search').focus();
}

function renderResults(reset = false) {
  if (reset) catalogPage = 0;
  matches = searchRoads(catalog.roads, { query: $('catalog-search').value, province: $('filter-province').value, canton: $('filter-canton').value });
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  catalogPage = Math.min(catalogPage, pages - 1);
  $('result-count').textContent = `${matches.length} ${matches.length === 1 ? 'sección encontrada' : 'secciones encontradas'}`;
  $('catalog-results').innerHTML = matches.length ? matches.slice(catalogPage * PAGE_SIZE, (catalogPage + 1) * PAGE_SIZE).map((r, i) =>
    `<button class="result-row" data-result-index="${catalogPage * PAGE_SIZE + i}"><span class="result-code">${esc(r.code)}<small>${esc(r.network)} · N</small></span><span class="result-description">${esc(r.description)}<small>Ruta ${esc(r.route)} · ${esc(r.cantonName)}, ${esc(r.provinceName)} · Sección ${esc(r.section)}</small></span><span class="result-length">${km(r.lengthKm)}<small>km</small></span></button>`).join('') : '<div class="empty-results">No hay coincidencias. Probá con otro código, ruta o lugar,<br>o cambiá los filtros de provincia y cantón.</div>';
  $('results-page').textContent = `${catalogPage + 1} / ${pages}`;
  $('previous-results').disabled = catalogPage === 0;
  $('next-results').disabled = catalogPage + 1 >= pages;
  $('catalog-results').scrollTop = 0;
}

function setManualRoad() {
  if ($('catalog-dialog').open) $('catalog-dialog').close();
  inventory = { ...inventory, road: createManualRoad() };
  commit({ form: true });
  $('road-code').focus();
  toast('Ingreso manual habilitado. Completá los datos del camino.');
}

function checkHeader() {
  clearValidation();
  const errors = validateHeader(inventory);
  const box = $('validation-box');
  box.hidden = false;
  box.classList.toggle('has-errors', errors.length > 0);
  if (errors.length) {
    box.innerHTML = `<strong>Faltan ${errors.length} ${errors.length === 1 ? 'dato' : 'datos'} para completar el encabezado.</strong><ul>${errors.map(e => `<li><a href="#${e.field}" data-focus-field="${e.field}">${esc(e.message)}</a></li>`).join('')}</ul>`;
    errors.forEach(e => $(e.field).setAttribute('aria-invalid', 'true'));
    $(errors[0].field).focus();
  } else {
    box.innerHTML = `<strong>Encabezado completo.</strong> Los datos se comparten en ${inventory.sheets.length === 1 ? 'la hoja del inventario' : `las ${inventory.sheets.length} hojas del inventario`}.`;
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(storageFailed ? 'Encabezado completo. Descargá el Excel o PDF para conservarlo.' : 'Encabezado completo y guardado en este dispositivo.');
  }
}

function bindEvents() {
  $('road-picker').addEventListener('click', openCatalog);
  $('nav-catalog').addEventListener('click', openCatalog);
  $('nav-help').addEventListener('click', () => $('help-dialog').showModal());
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close('cancel'));
  $('confirm-accept').addEventListener('click', () => $('confirm-dialog').close('accept'));
  $('catalog-search').addEventListener('input', () => renderResults(true));
  $('filter-province').addEventListener('change', () => {
    populateCantons($('filter-canton'), $('filter-province').value, '', true);
    $('filter-canton').disabled = !$('filter-province').value;
    renderResults(true);
  });
  $('filter-canton').addEventListener('change', () => renderResults(true));
  $('previous-results').addEventListener('click', () => { catalogPage--; renderResults(); });
  $('next-results').addEventListener('click', () => { catalogPage++; renderResults(); });
  $('catalog-results').addEventListener('click', event => {
    const button = event.target.closest('[data-result-index]');
    if (!button) return;
    const road = matches[Number(button.dataset.resultIndex)];
    if (!road) return;
    inventory = selectRoad(inventory, road);
    commit({ form: true });
    $('catalog-dialog').close();
    toast(`Camino ${road.code} seleccionado. Revisá el tramo y elegí la superficie.`);
    (road.needsReview ? $('road-from') : $('surface')).focus();
  });
  $('manual-road').addEventListener('click', setManualRoad);
  $('catalog-manual').addEventListener('click', setManualRoad);
  $('inventory-number').addEventListener('input', event => { inventory.number = event.target.value; commit(); });
  $('surface').addEventListener('change', event => { inventory.surface = event.target.value; commit(); });
  for (const [field, prop] of [['code', 'code'], ['route', 'route'], ['from', 'from'], ['to', 'to'], ['length', 'lengthKm']]) {
    $(`road-${field}`).addEventListener('input', event => {
      if (!inventory.road) return;
      inventory.road[prop] = event.target.value;
      commit();
    });
  }
  $('road-type').addEventListener('change', event => { inventory.road.type = event.target.value; commit(); });
  $('road-province').addEventListener('change', event => {
    const code = event.target.value;
    Object.assign(inventory.road, { provinceCode: code, provinceName: catalog.provinces[code] || '', cantonCode: '', cantonName: '' });
    commit({ form: true });
  });
  $('road-canton').addEventListener('change', event => {
    const code = event.target.value;
    Object.assign(inventory.road, { cantonCode: code, cantonName: catalog.cantons[inventory.road.provinceCode + code] || '' });
    $('canton-code').textContent = code || '—';
    commit();
  });
  $('add-sheet').addEventListener('click', () => {
    if (inventory.sheets.length >= 1000) return;
    inventory = addSheet(inventory);
    commit({ sheets: true });
    const current = inventory.sheets.findIndex(s => s.id === inventory.activeSheetId) + 1;
    toast(`Hoja ${inventory.sheets.length} de ${inventory.sheets.length} creada. Seguís en la hoja ${current}.`);
  });
  $('active-sheet').addEventListener('change', event => {
    inventory.activeSheetId = event.target.value;
    commit({ sheets: true });
  });
  $('delete-sheet').addEventListener('click', async () => {
    if (inventory.sheets.length <= 1) return;
    const sheetId = inventory.activeSheetId, number = inventory.sheets.findIndex(s => s.id === sheetId) + 1;
    if (await confirmAction(`Eliminar hoja ${number}`, 'Se eliminarán sus estaciones, símbolos, croquis y observaciones. Las hojas restantes se volverán a numerar y el encabezado compartido se conserva.', 'Eliminar hoja')) {
      inventory = removeSheet(inventory, sheetId);
      commit({ sheets: true });
      toast('Hoja eliminada. La numeración quedó actualizada.');
    }
  });
  $('verify-header').addEventListener('click', checkHeader);
  $('validation-box').addEventListener('click', event => {
    const link = event.target.closest('[data-focus-field]');
    if (link) { event.preventDefault(); $(link.dataset.focusField).focus(); }
  });
  $('new-inventory').addEventListener('click',()=>{try{newInventory();}catch(error){toast(error.message);}});
}

function requireSaved(){if(!persist())throw new Error('No se pudo guardar el trabajo actual. Descargá su copia editable antes de cambiar de inventario.');}
function showInventory(next){
  inventory=next;clearValidation();renderForm();renderSheets();renderDerived();editorTabs.select('header');
  $('save-status').textContent='Inventario recuperado';
}
function newInventory(){
  requireSaved();
  if(!inventoryHasData(inventory)){editorTabs.select('header');toast('El inventario vacío ya está listo para comenzar.');$('road-picker').focus();return;}
  showInventory(repository.create());toast('Nuevo inventario creado. El anterior sigue en Mis inventarios.');$('road-picker').focus();
}

function updateConnection() {
  $('connection').innerHTML = `<span class="status-dot"></span>${navigator.onLine ? (offlineReady ? 'Modo sin conexión listo' : 'En línea') : 'Sin conexión'}`;
}

async function enableOffline() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    offlineReady = true;
    updateConnection();
  } catch {
    // La edición sigue disponible aunque no se pueda instalar la PWA.
    offlineReady = false;
    updateConnection();
  }
}

async function boot() {
  try {
    const response = await fetch('./data/caminos.json');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo de caminos.');
    catalog = await response.json();
    if (catalog.version !== APP_VERSION || !Array.isArray(catalog.roads)) throw new Error('El catálogo no es compatible con esta versión.');
    inventory = createInventory();
    repository=new InventoryRepository({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)},catalog);
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
      inventory=repository.current()||inventory;
    } catch {
      if (raw) {
        // Una recuperación fallida no debe borrar silenciosamente el borrador anterior.
        try { localStorage.setItem(`${STORAGE_KEY}.recovery`, raw); } catch { /* Se ofrece una copia de recuperación abajo. */ }
        $('boot-error').hidden = false;
        $('boot-error').innerHTML = 'No se pudo recuperar el borrador anterior. <button class="text-button" id="recover-draft">Descargar copia para recuperación</button> antes de seguir.';
        $('recover-draft').addEventListener('click', () => downloadText(raw, 'Inventario_DPA301_recuperacion.json'));
      }
    }
    populateProvinces($('filter-province'), '4', true);
    populateCantons($('filter-canton'), '4', '', true);
    renderForm(); renderSheets(); renderDerived(); bindEvents();
    editorTabs=setupEditorTabs({onSelect:name=>{if(name==='graphics')graphics?.activate();if(name==='sketch')sketch?.activate();}});
    stations=setupStations({getInventory:()=>inventory,commit,notify:toast,confirmAction,nextSheet:()=>{
      if(inventory.sheets.length>=1000){toast('El inventario ya tiene 1000 hojas.');return;}
      inventory=addSheet(inventory);inventory.activeSheetId=inventory.sheets.at(-1).id;commit({sheets:true});
    }});
    graphics=setupGraphics({getInventory:()=>inventory,commit,notify:toast});
    sketch=setupSketch({getInventory:()=>inventory,commit,notify:toast,confirmAction});
    documents = setupDocuments({ getInventory: () => inventory, notify: toast });
    inventoryUI=setupInventoryUI({getInventory:()=>inventory,repository,saveCurrent:persist,onNew:newInventory,
      onOpen:id=>{if(id===inventory.id)return;requireSaved();showInventory(repository.open(id));toast('Inventario abierto con sus hojas y dibujos.');},
      onImport:raw=>{fromBackup(raw,catalog);requireSaved();showInventory(repository.import(raw));},
      navigate:issue=>{
        if(issue.sheetId&&inventory.sheets.some(sheet=>sheet.id===issue.sheetId))inventory.activeSheetId=issue.sheetId;
        commit({sheets:true});editorTabs.select(issue.tab||'header');
        if(issue.stationId)stations.edit(issue.stationId);
        else if(issue.field)$(issue.field)?.focus();
        else $(`tab-${issue.tab||'header'}`)?.focus();
      },checkTexts:inventory=>documents.checkTexts(inventory),confirmAction,notify:toast});
    $('editor').setAttribute('aria-busy', 'false');
    $('save-status').textContent = raw && !$('recover-draft') ? 'Borrador recuperado' : 'Listo para completar';
    if(!$('recover-draft'))persist();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();
    enableOffline();
  } catch (error) {
    $('boot-error').textContent = `${error.message} Volvé a cargar la página con conexión para comenzar.`;
    $('boot-error').hidden = false;
    $('editor').setAttribute('aria-busy', 'false');
    document.querySelectorAll('#editor button, #editor input, #editor select, #editor textarea, #new-inventory, #nav-catalog').forEach(el => { el.disabled = true; });
    $('save-status').textContent = 'No se pudo iniciar';
  }
}

boot();
