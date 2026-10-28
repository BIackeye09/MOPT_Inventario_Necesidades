// Edición por hoja: orden numérico y estaciones únicas en el inventario.
import {createId} from './ids.js';
import {STATION_CAPACITY, stationFields, validateStation, cleanStation, formatStation, formatMetres,validStationInput,parseStation,sortStations,findDuplicateStation,duplicateStationValues} from './stations.js';
import {checkStationForDocument} from './documents.js';
import {sheetLabel} from './model.js';
import {removeStationGraphics,reflowStationGraphics} from './graphics-model.js';
const $=id=>document.getElementById(id);
const ids={station:'station-km',diameter:'station-diameter',culvertLength:'station-length',
  headwallNumber:'station-number',headwallType:'station-type',observations:'station-observations'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function setupStations({getInventory,commit,notify,confirmAction,nextSheet}) {
  let currentSheet='',editingId=null,signature='',saving=false;
  const drafts=new Map();
  const sheet=()=>getInventory().sheets.find(s=>s.id===getInventory().activeSheetId);
  const read=()=>Object.fromEntries(stationFields.map(field=>[field,$(ids[field]).value]));
  function clearError() {
    $('station-error').hidden=true;
    Object.values(ids).forEach(id=>$(id).removeAttribute('aria-invalid'));
  }
  function formatHint() {
    const value=$('station-km').value;
    $('station-format').textContent=validStationInput(value)?formatStation(value):value.trim()?'Usá una coma o punto y de 1 a 3 decimales.':'0 + 000';
  }
  function duplicateError(value,id) {
    const found=findDuplicateStation(getInventory().sheets,value,{sheetId:sheet().id,stationId:id});
    return found?`La estación ${formatStation(value)} ya existe en la hoja ${found.sheetIndex+1}. Editá ese registro o ingresá otra estación.`:'';
  }
  function fill(record={}) {
    for(const field of stationFields)$(ids[field]).value=record[field]??'';
    $('station-save').textContent=editingId?'Guardar cambios':'Agregar estación';
    $('station-cancel').hidden=!editingId;
    $('station-form-title').textContent=editingId?'Editar estación':'Nueva estación';
    clearError();formatHint();
  }
  function reset() {editingId=null;drafts.delete(currentSheet);fill();}
  function refresh() {
    const active=sheet();if(!active)return;
    if(currentSheet!==active.id) {
      if(currentSheet)drafts.set(currentSheet,{...read(),editingId});
      currentSheet=active.id;const draft=drafts.get(currentSheet);editingId=draft?.editingId??null;fill(draft);
    }
    const records=active.stations||[],next=JSON.stringify([active.id,records,getInventory().sheets.length]);
    $('station-sheet').textContent=sheetLabel(getInventory());
    $('station-count').textContent=`${records.length} de ${STATION_CAPACITY}`;
    $('station-order-note').textContent=editingId?'Al guardar se ordenará de menor a mayor, de abajo hacia arriba.':
      records.length===STATION_CAPACITY?'Esta hoja está completa. Continuá en otra hoja.':
      records.length===0?'Orden de menor a mayor, de abajo hacia arriba. La primera ocupará el renglón inferior.':'Orden de menor a mayor, de abajo hacia arriba; cada estación se acomoda automáticamente.';
    $('station-save').disabled=saving||(!editingId&&records.length>=STATION_CAPACITY);
    $('station-next-sheet').hidden=records.length<STATION_CAPACITY;
    if(next===signature)return;signature=next;
    const duplicates=duplicateStationValues(getInventory().sheets),repeated=[...new Set(records.filter(r=>duplicates.has(parseStation(r.station))).map(r=>formatStation(r.station)))];
    $('station-duplicates-note').hidden=!repeated.length;
    $('station-duplicates-note').textContent=repeated.length?`Este borrador ya tenía estaciones repetidas: ${repeated.join(', ')}. Se conservaron sus datos; editá o eliminá las repeticiones antes de continuar.`:'';
    $('station-empty').hidden=records.length>0;
    $('station-table-wrap').hidden=records.length===0;
    $('station-list').innerHTML=records.map((record,index)=>({record,index})).reverse().map(({record:r,index})=>
      `<tr><th scope="row"><strong>${esc(formatStation(r.station))}</strong><small>${index+1} desde abajo</small></th><td data-label="Diámetro">${esc(formatMetres(r.diameter))||'—'}</td><td data-label="Longitud">${esc(formatMetres(r.culvertLength))||'—'}</td><td data-label="N.º de cabezales">${esc(r.headwallNumber)||'—'}</td><td data-label="Tipo de cabezal">${esc(r.headwallType)||'—'}</td><td class="station-description" data-label="Observaciones">${esc(r.observations)||'—'}</td><td class="station-row-actions"><button type="button" class="text-button" data-edit-station="${esc(r.id)}" aria-label="Editar estación ${esc(formatStation(r.station))}">Editar</button><button type="button" class="text-button" data-delete-station="${esc(r.id)}" aria-label="Eliminar estación ${esc(formatStation(r.station))}">Eliminar</button></td></tr>`).join('');
  }
  $('station-km').addEventListener('input',formatHint);
  $('station-form').addEventListener('input',clearError);
  $('station-cancel').addEventListener('click',()=>{reset();refresh();$('station-km').focus();});
  $('station-next-sheet').addEventListener('click',()=>{nextSheet();$('station-km').focus();});
  $('station-form').addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;
    clearError();const active=sheet(),record=read(),saveId=editingId,errors=validateStation(record);
    if(!errors.some(e=>e.field==='station')){const message=duplicateError(record.station,saveId);if(message)errors.push({field:'station',message});}
    if(errors.length) {
      $('station-error').textContent=errors.map(e=>e.message).join(' ');$('station-error').hidden=false;
      errors.forEach(e=>$(ids[e.field]).setAttribute('aria-invalid','true'));$(ids[errors[0].field]).focus();return;
    }
    const records=active.stations||[],index=saveId?records.findIndex(r=>r.id===saveId):records.length;
    if(index<0||index>=STATION_CAPACITY)return;
    saving=true;$('station-save').disabled=true;
    try {
      const value={id:saveId||createId(),...cleanStation(record)},candidate=records.filter(r=>r.id!==saveId);
      candidate.push(value);const ordered=sortStations(candidate);
      // Una inserción puede cambiar el renglón de otros textos: se comprueba
      // toda la tabla antes de guardar la nueva distribución del documento.
      await Promise.all(ordered.map((r,i)=>checkStationForDocument(r,i)));
      // Si se cambió de hoja mientras se comprobaba el texto, se conserva el formulario.
      if(sheet().id!==active.id||editingId!==saveId)return;
      const duplicate=duplicateError(value.station,saveId);if(duplicate)throw new Error(duplicate);
      if(active.stations!==records)throw new Error('La lista cambió mientras se guardaba. Revisá los datos y volvé a guardar.');
      active.stations=ordered;reflowStationGraphics(active,records);
      const edited=Boolean(saveId);reset();commit({sheets:true});
      notify(`Estación ${formatStation(value.station)} ${edited?'actualizada':'agregada'}.`);
      $('station-km').focus();
    } catch(error) {$('station-error').textContent=error.message;$('station-error').hidden=false;}
    finally {saving=false;refresh();}
  });
  $('station-list').addEventListener('click',async event=>{
    const edit=event.target.closest('[data-edit-station]'),remove=event.target.closest('[data-delete-station]');
    const active=sheet(),records=active.stations||[];
    if(edit) {
      const record=records.find(r=>r.id===edit.dataset.editStation);if(!record)return;
      editingId=record.id;fill(record);refresh();$('station-km').focus();
    } else if(remove) {
      const record=records.find(r=>r.id===remove.dataset.deleteStation);if(!record)return;
      if(await confirmAction(`Eliminar estación ${formatStation(record.station)}`,'Se eliminarán también sus símbolos del caso por estación. Las estaciones restantes se acomodarán de abajo hacia arriba.','Eliminar estación')) {
        active.stations=records.filter(r=>r.id!==record.id);
        removeStationGraphics(active,record.id,records);
        if(editingId===record.id)reset();commit({sheets:true});notify('Estación eliminada.');
      }
    }
  });
  refresh();return {refresh};
}

export function setupEditorTabs({onSelect=()=>{}}={}) {
  const tabs=[...document.querySelectorAll('[data-editor-tab]')];
  function select(tab) {
    for(const button of tabs) {
      const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
      $(button.getAttribute('aria-controls')).hidden=!active;
    }
    onSelect(tab.dataset.editorTab);
    // La navegación inferior del teléfono lleva directamente a la sección,
    // aunque se venga de una lista larga o del final de la carretera.
    if(globalThis.matchMedia?.('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches) {
      requestAnimationFrame(()=>$(tab.getAttribute('aria-controls')).scrollIntoView({block:'start',behavior:'auto'}));
    }
  }
  tabs.forEach((tab,index)=>{
    tab.addEventListener('click',()=>select(tab));
    tab.addEventListener('keydown',event=>{
      let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;
      if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;
      if(event.key==='Home')next=0;if(event.key==='End')next=tabs.length-1;
      if(next!==undefined){event.preventDefault();select(tabs[next]);tabs[next].focus();}
    });
  });
  return {select:name=>{const tab=tabs.find(t=>t.dataset.editorTab===name);if(tab)select(tab);}};
}
