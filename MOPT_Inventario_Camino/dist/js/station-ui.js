// Edición por hoja: orden numérico y estaciones únicas en el inventario.
import {createId} from './ids.js';
import {STATION_CAPACITY, stationFields, validateStation, cleanStation, formatStation, formatMetres,validStationInput,parseStation,sortStations,findDuplicateStation,duplicateStationValues,restoreStationDraft} from './stations.js';
import {checkStationForDocument} from './documents.js';
import {sheetLabel} from './model.js';
import {SYMBOLS,GRAPH_FRAME,GRAPH_LIMIT,GRAPH_ZONES,GRAPH_SIDES,symbolById,symbolUrl,stationFrame,stationGraphicRect,createStationGraphic,reflowStationSymbols,stationGraphicEntries,findStationGraphicDuplicate} from './graphics-model.js';
const $=id=>document.getElementById(id);
const ids={station:'station-km',diameter:'station-diameter',culvertLength:'station-length',
  headwallNumber:'station-number',headwallType:'station-type',observations:'station-observations'};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function setupStations({getInventory,commit,notify,confirmAction,nextSheet,onGraphicsChange=()=>{},showGraphic=()=>{}}) {
  let currentSheet='',editingId=null,signature='',saving=false;
  let symbolContext=null,editingGraphicId=null;
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
  function saveDraft(){sheet().stationDraft=restoreStationDraft({...read(),editingId},sheet().stations);commit();}
  function reset() {editingId=null;sheet().stationDraft=null;fill();}
  function refresh() {
    const active=sheet();if(!active)return;
    const key=`${getInventory().id}:${active.id}`;
    if(currentSheet!==key) {
      currentSheet=key;const draft=active.stationDraft;editingId=draft?.editingId??null;fill(draft||{});
    }
    if(symbolContext){if(symbolTarget())renderSymbolDialog();else $('station-symbol-dialog').close();}
    const records=active.stations||[],next=JSON.stringify([active.id,records,active.graphics,getInventory().sheets.length]);
    $('station-sheet').textContent=sheetLabel(getInventory());
    $('station-count').textContent=`${records.length} de ${STATION_CAPACITY}`;
    $('station-order-note').textContent=editingId?'Al guardar se ordenará de menor a mayor, de abajo hacia arriba.':
      records.length===STATION_CAPACITY?'Esta hoja está completa. Continuá en otra hoja.':
      records.length===0?'Orden de menor a mayor, de abajo hacia arriba. La primera ocupará el renglón inferior.':'Orden de menor a mayor, de abajo hacia arriba; cada estación se acomoda automáticamente.';
    $('station-save').disabled=saving||(!editingId&&records.length>=STATION_CAPACITY);
    $('station-cancel').hidden=!editingId&&!active.stationDraft;
    $('station-cancel').textContent=editingId?'Cancelar edición':'Descartar borrador';
    $('station-draft-status').textContent=active.stationDraft?'Formulario pendiente: agregalo para incluirlo en el documento.':'Agregá la estación para incluirla en el documento.';
    $('station-next-sheet').hidden=records.length<STATION_CAPACITY;
    if(next===signature)return;signature=next;
    const duplicates=duplicateStationValues(getInventory().sheets),repeated=[...new Set(records.filter(r=>duplicates.has(parseStation(r.station))).map(r=>formatStation(r.station)))];
    $('station-duplicates-note').hidden=!repeated.length;
    $('station-duplicates-note').textContent=repeated.length?`Este borrador ya tenía estaciones repetidas: ${repeated.join(', ')}. Se conservaron sus datos; editá o eliminá las repeticiones antes de continuar.`:'';
    $('station-empty').hidden=records.length>0;
    $('station-table-wrap').hidden=records.length===0;
    $('station-list').innerHTML=records.map((record,index)=>({record,index})).reverse().map(({record:r,index})=>
      `<tr><th scope="row"><strong>${esc(formatStation(r.station))}</strong><small>${index+1} desde abajo</small></th><td data-label="Diámetro">${esc(formatMetres(r.diameter))||'—'}</td><td data-label="Longitud">${esc(formatMetres(r.culvertLength))||'—'}</td><td data-label="N.º de cabezales">${esc(r.headwallNumber)||'—'}</td><td data-label="Tipo de cabezal">${esc(r.headwallType)||'—'}</td><td class="station-description" data-label="Observaciones">${esc(r.observations)||'—'}</td><td class="station-symbol-cell" data-label="Símbolos">${stationSymbolSummary(active,r.id)}</td><td class="station-row-actions"><button type="button" class="text-button" data-station-symbols="${esc(r.id)}" aria-label="Símbolos de estación ${esc(formatStation(r.station))}">Símbolos</button><button type="button" class="text-button" data-edit-station="${esc(r.id)}" aria-label="Editar estación ${esc(formatStation(r.station))}">Editar</button><button type="button" class="text-button" data-delete-station="${esc(r.id)}" aria-label="Eliminar estación ${esc(formatStation(r.station))}">Eliminar</button></td></tr>`).join('');
  }
  $('station-km').addEventListener('input',formatHint);
  $('station-form').addEventListener('input',()=>{clearError();saveDraft();});
  $('station-cancel').addEventListener('click',()=>{reset();commit();refresh();$('station-km').focus();});
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
      if(JSON.stringify(read())!==JSON.stringify(record)){notify('El formulario cambió mientras se revisaba. Tocá Agregar estación de nuevo.');return;}
      const duplicate=duplicateError(value.station,saveId);if(duplicate)throw new Error(duplicate);
      if(active.stations!==records)throw new Error('La lista cambió mientras se guardaba. Revisá los datos y volvé a guardar.');
      const beforeGraphics=JSON.stringify(active.graphics);active.stations=ordered;reflowStationSymbols(active,records);
      if(JSON.stringify(active.graphics)!==beforeGraphics)onGraphicsChange();
      const edited=Boolean(saveId);reset();commit({sheets:true});
      notify(`Estación ${formatStation(value.station)} ${edited?'actualizada':'agregada'}.`);
      if($('station-symbols-after-save').checked)openSymbols(value.id);else $('station-km').focus();
    } catch(error) {$('station-error').textContent=error.message;$('station-error').hidden=false;}
    finally {saving=false;refresh();}
  });
  $('station-list').addEventListener('click',async event=>{
    const symbols=event.target.closest('[data-station-symbols]'),edit=event.target.closest('[data-edit-station]'),remove=event.target.closest('[data-delete-station]');
    const active=sheet(),records=active.stations||[];
    if(symbols){openSymbols(symbols.dataset.stationSymbols);return;}
    if(edit) {
      const record=records.find(r=>r.id===edit.dataset.editStation);if(!record)return;
      editingId=record.id;fill(record);saveDraft();refresh();$('station-km').focus();
    } else if(remove) {
      const record=records.find(r=>r.id===remove.dataset.deleteStation);if(!record)return;
      const linked=(active.graphics?.free||[]).filter(item=>item.placement?.stationId===record.id).length;
      if(await confirmAction(`Eliminar estación ${formatStation(record.station)}`,`Se quitarán los datos de esta estación${linked?` y sus ${linked} símbolos vinculados`:''}. Las estaciones restantes se acomodarán de abajo hacia arriba; los dibujos libres se conservan.`,'Eliminar estación')) {
        if(sheet()!==active||active.stations!==records)return;
        const beforeGraphics=JSON.stringify(active.graphics);
        active.stations=records.filter(r=>r.id!==record.id);
        reflowStationSymbols(active,records);if(JSON.stringify(active.graphics)!==beforeGraphics)onGraphicsChange();
        if(editingId===record.id)reset();commit({sheets:true});notify('Estación eliminada.');
      }
    }
  });
  function symbolImage(graphic,attributes=''){
    const {x,y,width,height,rotation=0}=graphic;
    return `<image href="${symbolUrl(graphic.symbolId)}" x="${x}" y="${y}" width="${width}" height="${height}" transform="rotate(${rotation} ${x+width/2} ${y+height/2})" preserveAspectRatio="none" ${attributes}/>`;
  }
  function rowDrawing(active,stationId){
    const row=stationFrame(sortStations(active.stations),stationId),entries=stationGraphicEntries(active,stationId);
    return {row,entries,markup:`<image href="./symbols/carretera.png" x="0" y="0" width="${GRAPH_FRAME.width}" height="${GRAPH_FRAME.height}" preserveAspectRatio="none"/>${entries.filter(entry=>entry.visible).map(entry=>symbolImage(entry.graphic,`data-placed-symbol="${esc(entry.item.id)}"`)).join('')}`};
  }
  function symbolDescription(item,stationId){
    const placement=item.placement;
    if(!placement)return 'Dibujo libre';
    const location=`${GRAPH_ZONES[placement.area].label} · ${GRAPH_SIDES[placement.side]}`;
    return location+(placement.stationId!==stationId?' · De otra estación':placement.manual?' · Ajustado en el gráfico':'');
  }
  function stationSymbolSummary(active,stationId){
    const {row,entries,markup}=rowDrawing(active,stationId);if(!entries.length)return '<span class="field-hint">Sin símbolos colocados</span>';
    return `<svg class="station-row-preview" role="img" aria-label="Símbolos colocados en el renglón de esta estación" viewBox="0 ${row.top} ${GRAPH_FRAME.width} ${row.height}" preserveAspectRatio="xMidYMid meet">${markup}</svg><ul class="station-symbol-names">${entries.map(({item,visible})=>`<li><strong>${esc(symbolById(item.symbolId).label)}</strong><small>${esc(symbolDescription(item,stationId))}${!visible?' · Fuera de este renglón':''}</small></li>`).join('')}</ul><small>${entries.length} ${entries.length===1?'símbolo':'símbolos'}</small>`;
  }
  function symbolTarget(){
    const active=sheet();if(!symbolContext||getInventory().id!==symbolContext.inventoryId||active.id!==symbolContext.sheetId)return null;
    const record=(active.stations||[]).find(item=>item.id===symbolContext.stationId);return record?{active,record}:null;
  }
  function openSymbols(stationId){
    const active=sheet();if(!(active.stations||[]).some(record=>record.id===stationId))return;
    symbolContext={inventoryId:getInventory().id,sheetId:active.id,stationId};editingGraphicId=null;
    $('station-symbol-error').hidden=true;$('station-symbol-gallery').open=false;
    if(!Object.hasOwn(GRAPH_ZONES,$('station-symbol-area').value))$('station-symbol-area').value='road';
    renderSymbolDialog();$('station-symbol-dialog').showModal();$('station-symbol-choice').focus();
  }
  function symbolControls(){
    const area=$('station-symbol-area').value||'road',previous=$('station-symbol-side').value;
    $('station-symbol-side').innerHTML=Object.keys(GRAPH_ZONES[area]).filter(key=>key!=='label').map(side=>`<option value="${side}">${esc(GRAPH_SIDES[side])}</option>`).join('');
    $('station-symbol-side').value=Object.hasOwn(GRAPH_ZONES[area],previous)&&previous!=='label'?previous:'left';
    const target=symbolTarget(),id=$('station-symbol-choice').value,selected=Boolean(symbolById(id)),
      duplicate=selected&&target?findStationGraphicDuplicate(target.active,id,{stationId:target.record.id,area,side:$('station-symbol-side').value},editingGraphicId):null;
    $('station-symbol-place').disabled=!selected||!target||Boolean(duplicate);
    $('station-symbol-place').textContent=duplicate?'Ya colocado':editingGraphicId?'Aplicar ajuste automático':'Colocar símbolo';
    $('station-symbol-placement-status').textContent=duplicate?'Este símbolo ya está colocado en esa ubicación. Revisalo en la lista de abajo o elegí otra posición.':selected?'El recuadro azul indica dónde quedará el nuevo símbolo.':'Los símbolos negros ya están colocados en el gráfico.';
    $('station-symbol-cancel-edit').hidden=!editingGraphicId;
  }
  function renderSymbolPreview(){
    const target=symbolTarget();if(!target)return;
    const area=$('station-symbol-area').value,side=$('station-symbol-side').value,
      {row,markup}=rowDrawing(target.active,target.record.id),[left,right]=GRAPH_ZONES[area][side],id=$('station-symbol-choice').value;
    let figure='';
    if(symbolById(id)){
      const box=stationGraphicRect(id,target.active.stations,{stationId:target.record.id,area,side});
      if(!findStationGraphicDuplicate(target.active,id,{stationId:target.record.id,area,side},editingGraphicId))figure=symbolImage({symbolId:id,x:box.x*GRAPH_FRAME.width,y:box.y*GRAPH_FRAME.height,width:box.width*GRAPH_FRAME.width,height:box.height*GRAPH_FRAME.height},'data-pending-symbol="true" opacity=".45"');
    }
    $('station-symbol-preview').setAttribute('viewBox',`0 ${row.top} ${GRAPH_FRAME.width} ${row.height}`);
    $('station-symbol-preview').innerHTML=`${markup}<rect x="${left}" y="${row.top}" width="${right-left}" height="${row.height}" fill="none" stroke="#2469ac" stroke-width="1.5" stroke-dasharray="3 2" vector-effect="non-scaling-stroke"/>${figure}`;
    $('station-symbol-location').textContent=`${GRAPH_ZONES[area].label} · ${GRAPH_SIDES[side]} · Estación ${formatStation(target.record.station)}`;
  }
  function renderSymbolDialog(){
    const target=symbolTarget();if(!target)return;
    $('station-symbols-title').textContent=`Símbolos · ${formatStation(target.record.station)}`;
    const entries=stationGraphicEntries(target.active,target.record.id);
    $('station-symbol-list').innerHTML=entries.map(({item,linked,visible})=>`<article class="station-linked-symbol"><div><img src="${symbolUrl(item.symbolId)}" alt=""><span><strong>${esc(symbolById(item.symbolId).label)}</strong><small>${esc(symbolDescription(item,target.record.id))}${!visible?' · Fuera de este renglón':''}${item.locked?' · Bloqueado':''}</small></span></div><div class="station-linked-actions"><button class="text-button" type="button" data-show-station-symbol="${esc(item.id)}">Ver en gráfico</button>${linked?`<button class="text-button" type="button" data-edit-station-symbol="${esc(item.id)}">Ubicación</button>`:''}<button class="text-button" type="button" data-remove-station-symbol="${esc(item.id)}" aria-label="Quitar ${esc(symbolById(item.symbolId).label)}">Quitar</button></div></article>`).join('');
    $('station-symbol-list-status').textContent=entries.length?`${entries.length} ${entries.length===1?'símbolo registrado':'símbolos registrados'}. Incluye dibujos libres que cruzan este renglón.`:'Todavía no hay símbolos colocados en este renglón.';
    symbolControls();renderSymbolPreview();
  }
  function changeSymbol(){
    $('station-symbol-error').hidden=true;symbolControls();renderSymbolPreview();
  }
  $('station-symbol-choice').innerHTML='<option value="">Seleccionar por nombre…</option>'+SYMBOLS.map(symbol=>`<option value="${symbol.id}">${esc(symbol.label)}</option>`).join('');
  $('station-symbol-images').innerHTML=SYMBOLS.map(symbol=>`<button class="graphic-palette-item" type="button" data-station-pick-symbol="${symbol.id}" aria-label="Elegir ${esc(symbol.label)}"><img src="${symbolUrl(symbol.id)}" alt=""><span>${esc(symbol.label)}</span></button>`).join('');
  $('station-symbol-choice').addEventListener('change',changeSymbol);$('station-symbol-area').addEventListener('change',changeSymbol);$('station-symbol-side').addEventListener('change',changeSymbol);
  $('station-symbol-images').addEventListener('click',event=>{const id=event.target.closest('[data-station-pick-symbol]')?.dataset.stationPickSymbol;if(!symbolById(id))return;$('station-symbol-choice').value=id;$('station-symbol-gallery').open=false;changeSymbol();});
  $('station-symbol-place').addEventListener('click',()=>{
    const target=symbolTarget();if(!target)return;
    try{
      const id=$('station-symbol-choice').value,area=$('station-symbol-area').value,side=$('station-symbol-side').value,
        items=target.active.graphics.free,existing=editingGraphicId?items.find(item=>item.id===editingGraphicId&&item.placement?.stationId===target.record.id):null;
      if(editingGraphicId&&!existing)throw new Error('El símbolo ya no está disponible. Volvé a abrir sus opciones.');
      if(!existing&&items.length>=GRAPH_LIMIT)throw new Error(`La hoja ya tiene ${GRAPH_LIMIT} símbolos.`);
      if(findStationGraphicDuplicate(target.active,id,{stationId:target.record.id,area,side},editingGraphicId))throw new Error('Este símbolo ya está colocado en esa ubicación. Podés elegir otra posición o ajustarlo en el gráfico.');
      const item=createStationGraphic(id,target.active.stations,{stationId:target.record.id,area,side});
      if(existing){item.id=existing.id;if(existing.locked)item.locked=true;items[items.indexOf(existing)]=item;}else items.push(item);
      editingGraphicId=null;onGraphicsChange();commit();$('station-symbol-error').hidden=true;
      notify(`Símbolo colocado en ${GRAPH_ZONES[area].label.toLowerCase()}, ${GRAPH_SIDES[side].toLowerCase()}, estación ${formatStation(target.record.station)}.`);
    }catch(error){$('station-symbol-error').textContent=error.message;$('station-symbol-error').hidden=false;}
  });
  $('station-symbol-cancel-edit').addEventListener('click',()=>{editingGraphicId=null;renderSymbolDialog();});
  $('station-symbol-list').addEventListener('click',async event=>{
    const target=symbolTarget();if(!target)return;
    const show=event.target.closest('[data-show-station-symbol]')?.dataset.showStationSymbol,
      edit=event.target.closest('[data-edit-station-symbol]')?.dataset.editStationSymbol,
      remove=event.target.closest('[data-remove-station-symbol]')?.dataset.removeStationSymbol;
    const item=stationGraphicEntries(target.active,target.record.id).find(entry=>entry.item.id===(show||edit||remove))?.item;if(!item)return;
    if(show){$('station-symbol-dialog').close();showGraphic(item.id);return;}
    if(edit&&item.placement?.stationId===target.record.id){editingGraphicId=item.id;$('station-symbol-choice').value=item.symbolId;$('station-symbol-area').value=item.placement.area;symbolControls();$('station-symbol-side').value=item.placement.side;symbolControls();renderSymbolPreview();$('station-symbol-choice').focus();return;}
    if(remove&&await confirmAction('Quitar símbolo de la estación','Se quitará esta figura del gráfico y de los documentos. Los datos de la estación se conservan.','Quitar símbolo')){
      if(symbolTarget()?.active!==target.active)return;
      target.active.graphics.free=target.active.graphics.free.filter(value=>value.id!==item.id);editingGraphicId=null;onGraphicsChange();commit();
    }
  });
  $('station-symbol-dialog').addEventListener('close',()=>{symbolContext=null;editingGraphicId=null;});
  function edit(id){const record=(sheet().stations||[]).find(r=>r.id===id);if(!record)return;editingId=id;fill(record);saveDraft();refresh();$('station-km').focus();}
  refresh();return {refresh,edit,openSymbols};
}

export function setupEditorTabs({onSelect=()=>{}}={}) {
  const tabs=[...document.querySelectorAll('[data-editor-tab]')];
  function select(tab,focusPanel=false) {
    for(const button of tabs) {
      const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
      $(button.getAttribute('aria-controls')).hidden=!active;
    }
    onSelect(tab.dataset.editorTab);
    // La navegación inferior del teléfono lleva directamente a la sección,
    // aunque se venga de una lista larga o del final de la carretera.
    if(focusPanel||globalThis.matchMedia?.('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches) {
      requestAnimationFrame(()=>{
        const panel=$(tab.getAttribute('aria-controls'));
        if(focusPanel){panel.setAttribute('tabindex','-1');panel.focus({preventScroll:true});}
        panel.scrollIntoView({block:'start',behavior:'auto'});
      });
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
  const goTo=(name,focusPanel=false)=>{const tab=tabs.find(t=>t.dataset.editorTab===name);if(tab)select(tab,focusPanel);};
  // Anterior/Siguiente usa las mismas pestañas y conserva el formulario pendiente.
  document.querySelectorAll('[data-go-section]').forEach(button=>button.addEventListener('click',()=>goTo(button.dataset.goSection,true)));
  return {select:name=>goTo(name)};
}
