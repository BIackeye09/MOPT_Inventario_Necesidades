// Opciones compactas para conservar trabajos, recuperar copias y revisar antes
// de entregar. Ninguna de estas ayudas modifica la plantilla del documento.
import {toBackup,validateHeader} from './model.js';
import {hasPendingStation,editableFilename} from './inventory-store.js';
import {duplicateStationValues,parseStation,formatStation} from './stations.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function reviewOverview(inventory){
  const issues=validateHeader(inventory).map(issue=>({...issue,tab:'header'}));
  const duplicates=duplicateStationValues(inventory.sheets);
  const sheets=inventory.sheets.map((sheet,index)=>{
    if(hasPendingStation(sheet))issues.push({sheetId:sheet.id,tab:'stations',field:'station-km',message:`Hoja ${index+1}: hay un formulario pendiente de agregar. Todavía no se incluye en los documentos.`});
    for(const station of sheet.stations||[])if(duplicates.has(parseStation(station.station)))issues.push({sheetId:sheet.id,stationId:station.id,tab:'stations',message:`Hoja ${index+1}: la estación ${formatStation(station.station)} está repetida en el inventario.`});
    return {id:sheet.id,number:index+1,stations:sheet.stations?.length||0,symbols:sheet.graphics?.free?.length||0,
      sketch:Boolean(sheet.sketch?.strokes?.length),observations:Boolean(sheet.backObservations?.trim())};
  });
  return {issues,sheets};
}
export function setupInventoryUI({getInventory,repository,saveCurrent,onNew,onOpen,onImport,navigate,checkTexts,confirmAction,notify}){
  let reviewToken=0,reviewItems=[];
  const closeMenu=()=>{$('document-more').open=false;};
  function exportCopy(){
    closeMenu();const inventory=getInventory(),url=URL.createObjectURL(new Blob([toBackup(inventory)],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=editableFilename(inventory);document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);notify('Copia editable descargada con hojas, dibujos y formularios pendientes.');
  }
  function renderList(){
    try{
      const query=$('inventory-search').value.toLocaleLowerCase('es').trim();
      const entries=repository.list().filter(entry=>[entry.code,entry.number,entry.description].join(' ').toLocaleLowerCase('es').includes(query));
      $('inventory-list').innerHTML=entries.map(entry=>{
        const active=entry.id===getInventory().id;
        const date=Number.isFinite(Date.parse(entry.updatedAt))?new Intl.DateTimeFormat('es-CR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(entry.updatedAt)):'Sin fecha';
        return `<article class="saved-inventory"><div><h3>${esc(entry.code||'Camino sin seleccionar')}${entry.number?` · ${esc(entry.number)}`:''}</h3><p>${esc(entry.description||'Inventario en preparación')}</p><small>${esc(date)} · ${Number(entry.sheets)||0} ${entry.sheets===1?'hoja':'hojas'} · ${Number(entry.stations)||0} ${entry.stations===1?'estación':'estaciones'}${entry.pending?` · ${Number(entry.pending)} ${entry.pending===1?'formulario pendiente':'formularios pendientes'}`:''}</small></div><div class="saved-inventory-actions"><button class="button ${active?'secondary':'primary'}" type="button" data-open-inventory="${esc(entry.id)}"${active?' disabled':''}>${active?'Actual':'Continuar'}</button>${active?'':`<button class="text-button" type="button" data-remove-inventory="${esc(entry.id)}">Quitar del dispositivo</button>`}</div></article>`;
      }).join('');
      $('inventory-list-status').textContent=entries.length?`${entries.length} ${entries.length===1?'inventario guardado':'inventarios guardados'}`:'No hay inventarios que coincidan con la búsqueda.';
    }catch(error){$('inventory-list-status').textContent=error.message;}
  }
  function openList(){closeMenu();saveCurrent();$('inventory-search').value='';renderList();$('inventories-dialog').showModal();$('inventory-search').focus();}
  function renderReview(){
    $('review-issues').innerHTML=reviewItems.map((issue,index)=>`<button class="review-issue" type="button" data-review-issue="${index}"><span>${esc(issue.message)}</span><span aria-hidden="true">→</span></button>`).join('');
  }
  async function openReview(){
    closeMenu();const token=++reviewToken,inventory=structuredClone(getInventory()),overview=reviewOverview(inventory);reviewItems=overview.issues;
    $('review-status').textContent='Comprobando los textos de la plantilla…';renderReview();
    $('review-sheets').innerHTML=overview.sheets.map(sheet=>`<article class="review-sheet"><div><h3>Hoja ${sheet.number}</h3><p>${sheet.stations} de 26 estaciones · ${sheet.symbols} ${sheet.symbols===1?'símbolo':'símbolos'}</p><small>Croquis: ${sheet.sketch?'con trazos':'sin trazos'} · Observaciones del reverso: ${sheet.observations?'con texto':'sin texto'}</small></div><button class="button secondary" type="button" data-review-sheet="${esc(sheet.id)}">Ver hoja ${sheet.number}</button></article>`).join('');
    $('review-dialog').showModal();
    try{
      const textIssues=await checkTexts(inventory);if(token!==reviewToken)return;
      const seen=new Set();
      for(const issue of textIssues){const key=issue.tab==='header'?issue.message:`${issue.sheetId}:${issue.message}`;if(seen.has(key))continue;seen.add(key);reviewItems.push({...issue,message:issue.tab==='header'?issue.message:`Hoja ${issue.sheetNumber}: ${issue.message}`});}
      renderReview();$('review-status').textContent=reviewItems.length?`${reviewItems.length} ${reviewItems.length===1?'pendiente para revisar':'pendientes para revisar'}. Tocá uno para ir a ese campo.`:'Sin pendientes detectados en los datos y textos. Revisá también los dibujos en Vista previa.';
    }catch(error){if(token===reviewToken)$('review-status').textContent=`No se pudo completar la revisión: ${error.message}`;}
  }
  $('open-inventories').addEventListener('click',openList);
  $('menu-inventories').addEventListener('click',openList);
  $('inventory-search').addEventListener('input',renderList);
  $('inventory-list').addEventListener('click',async event=>{
    const remove=event.target.closest('[data-remove-inventory]')?.dataset.removeInventory;
    if(remove){
      if(!await confirmAction('Quitar inventario del dispositivo','Se quitará este trabajo guardado. Para conservar una copia editable, cancelá, abrilo con Continuar y guardá la copia desde Más antes de quitarlo.','Quitar del dispositivo'))return;
      try{repository.removeArchived(remove,getInventory().id);saveCurrent();renderList();notify('Inventario quitado del dispositivo.');}catch(error){notify(error.message);}return;
    }
    const id=event.target.closest('[data-open-inventory]')?.dataset.openInventory;if(!id)return;
    try{onOpen(id);$('inventories-dialog').close();}catch(error){notify(error.message);}
  });
  $('inventory-create').addEventListener('click',()=>{try{onNew();$('inventories-dialog').close();}catch(error){notify(error.message);}});
  $('save-editable').addEventListener('click',exportCopy);
  const chooseFile=()=>{closeMenu();$('editable-file').click();};
  $('open-editable').addEventListener('click',chooseFile);$('inventory-import').addEventListener('click',chooseFile);
  $('editable-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{if(file.size>32*1024*1024)throw new Error('La copia editable supera los 32 MB admitidos.');onImport(await file.text());$('inventories-dialog').close();notify('Copia abierta como un inventario independiente. El trabajo anterior sigue guardado.');}
    catch(error){notify(`No se pudo abrir la copia: ${error.message}`);}
    finally{event.target.value='';}
  });
  $('open-review').addEventListener('click',openReview);$('review-shortcut').addEventListener('click',openReview);
  $('review-dialog').addEventListener('close',()=>{reviewToken++;});
  $('review-issues').addEventListener('click',event=>{const button=event.target.closest('[data-review-issue]');if(!button)return;const issue=reviewItems[Number(button.dataset.reviewIssue)];if(issue){$('review-dialog').close();navigate(issue);}});
  $('review-sheets').addEventListener('click',event=>{const id=event.target.closest('[data-review-sheet]')?.dataset.reviewSheet;if(id){$('review-dialog').close();navigate({sheetId:id,tab:'stations'});}});
  // El menú se cierra al salir de él y no ocupa espacio fijo del formulario.
  document.addEventListener('click',event=>{if(!event.target.closest('#document-more'))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
  function refresh(){
    const pending=getInventory().sheets.filter(hasPendingStation).length;
    $('review-shortcut').textContent=pending?`Revisar · ${pending} ${pending===1?'formulario pendiente':'formularios pendientes'}`:'Revisar inventario';
    if($('inventories-dialog').open)renderList();
  }
  refresh();return {refresh,exportCopy};
}
