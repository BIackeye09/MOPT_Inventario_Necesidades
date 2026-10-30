// Se ejecutan las acciones del formulario sin depender de un navegador instalado.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setupStations,setupEditorTabs} from '../dist/js/station-ui.js';
import {createInventory,addSheet} from '../dist/js/model.js';
import {createGraphic,createStationGraphic,constrainGraphic,GRAPH_FRAME,GRAPH_ZONES,stationFrame} from '../dist/js/graphics-model.js';

function screen() {
  const nodes=new Map();
  function node(id){
    if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,innerHTML:'',textContent:'',dataset:{},attributes:{},events:{},
      addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this.attributes[name]=String(value);},
      getAttribute(name){return this.attributes[name];},removeAttribute(name){delete this.attributes[name];},focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();}});
    return nodes.get(id);
  }
  const tabs=['header','stations','graphics','sketch'].map(name=>{const n=node(`tab-${name}`);n.dataset.editorTab=name;n.attributes['aria-controls']=`panel-${name}`;return n;});
  const navigation=[['header','stations'],['stations','header'],['stations','graphics'],['graphics','stations'],['graphics','sketch'],['sketch','graphics']].map(([from,to])=>{const n=node(`go-${from}-${to}`);n.dataset.goSection=to;return n;});
  globalThis.document={getElementById:node,querySelectorAll:selector=>selector==='[data-go-section]'?navigation:tabs};
  let inventory=addSheet(createInventory()),commits=0,ui;
  const commit=()=>{commits++;ui?.refresh();};
  ui=setupStations({getInventory:()=>inventory,commit,notify(){},confirmAction:async()=>true,nextSheet(){inventory=addSheet(inventory);inventory.activeSheetId=inventory.sheets.at(-1).id;commit();}});
  const submit=()=>node('station-form').events.submit({preventDefault(){}});
  const click=(dataset)=>node('station-list').events.click({target:{closest(selector){if(selector==='[data-station-symbols]'&&dataset.stationSymbols)return {dataset};if(selector==='[data-edit-station]'&&dataset.editStation)return {dataset};if(selector==='[data-delete-station]'&&dataset.deleteStation)return {dataset};return null;}}});
  const symbolAction=dataset=>node('station-symbol-list').events.click({target:{closest(selector){const key={'[data-show-station-symbol]':'showStationSymbol','[data-edit-station-symbol]':'editStationSymbol','[data-remove-station-symbol]':'removeStationSymbol'}[selector];return key&&dataset[key]?{dataset}:null;}}});
  return {node,ui,submit,click,symbolAction,tabs,navigation,get inventory(){return inventory;},get commits(){return commits;}};
}
test('seleccionar por nombre coloca un solo símbolo automático en ambos carriles y evita doble agregado',async()=>{
  const s=screen();s.node('station-km').value='2,870';await s.submit();const sheet=s.inventory.sheets[0],record=sheet.stations[0];
  await s.click({stationSymbols:record.id});assert.equal(s.node('station-symbol-dialog').open,true);
  s.node('station-symbol-choice').value='alcantarilla-existente';s.node('station-symbol-area').value='road';s.node('station-symbol-area').events.change();s.node('station-symbol-side').value='both';
  s.node('station-symbol-side').events.change();s.node('station-symbol-place').events.click();
  assert.equal(sheet.graphics.free.length,1);const item=sheet.graphics.free[0];assert.equal(item.placement.stationId,record.id);assert.equal(item.placement.side,'both');
  assert.ok(Math.abs(item.width*GRAPH_FRAME.width-(GRAPH_ZONES.road.both[1]-GRAPH_ZONES.road.both[0]-.8))<.00001);
  s.node('station-symbol-place').events.click();assert.equal(sheet.graphics.free.length,1);assert.equal(s.node('station-symbol-error').hidden,false);
});
test('la galería selecciona la figura y las aceras y cunetas admiten izquierda y derecha',async()=>{
  const s=screen();s.node('station-km').value='0,0';await s.submit();const sheet=s.inventory.sheets[0];s.ui.openSymbols(sheet.stations[0].id);
  s.node('station-symbol-images').events.click({target:{closest:()=>({dataset:{stationPickSymbol:'poste-electrico'}})}});
  assert.equal(s.node('station-symbol-choice').value,'poste-electrico');assert.equal(s.node('station-symbol-gallery').open,false);
  for(const area of ['sidewalk','ditch'])for(const side of ['left','right']){
    s.node('station-symbol-area').value=area;s.node('station-symbol-area').events.change();s.node('station-symbol-side').value=side;s.node('station-symbol-side').events.change();s.node('station-symbol-place').events.click();
    assert.equal(sheet.graphics.free.at(-1).placement.area,area);assert.equal(sheet.graphics.free.at(-1).placement.side,side);
    assert.doesNotMatch(s.node('station-symbol-side').innerHTML,/value="both"/);
  }
  assert.equal(sheet.graphics.free.length,4);
});
test('editar ubicación reutiliza la figura, mantiene el bloqueo y permite quitarla sin borrar la estación',async()=>{
  const s=screen();s.node('station-km').value='4,9';await s.submit();const sheet=s.inventory.sheets[0];s.ui.openSymbols(sheet.stations[0].id);
  s.node('station-symbol-choice').value='bacheo';s.node('station-symbol-place').events.click();const item=sheet.graphics.free[0];item.locked=true;item.placement.manual=true;Object.assign(item,constrainGraphic(item,{rotation:37}));
  await s.symbolAction({editStationSymbol:item.id});s.node('station-symbol-area').value='sidewalk';s.node('station-symbol-area').events.change();s.node('station-symbol-side').value='right';s.node('station-symbol-place').events.click();
  assert.equal(sheet.graphics.free.length,1);assert.equal(sheet.graphics.free[0].id,item.id);assert.equal(sheet.graphics.free[0].locked,true);assert.equal(sheet.graphics.free[0].rotation,0);assert.equal(sheet.graphics.free[0].placement.manual,undefined);
  await s.symbolAction({removeStationSymbol:item.id});assert.equal(sheet.graphics.free.length,0);assert.equal(sheet.stations.length,1);
});
test('al insertar una estación menor sus símbolos siguen el orden numérico y al eliminarla se conservan los libres',async()=>{
  const s=screen();s.node('station-km').value='2,870';await s.submit();const sheet=s.inventory.sheets[0],record=sheet.stations[0];
  s.ui.openSymbols(record.id);s.node('station-symbol-choice').value='bacheo';s.node('station-symbol-place').events.click();s.node('station-symbol-dialog').close();
  const before=sheet.graphics.free[0].y,free=createGraphic('tomas');sheet.graphics.free.push(free);
  s.node('station-km').value='2,864';await s.submit();assert.ok(sheet.graphics.free[0].y<before);
  const row=stationFrame(sheet.stations,record.id);assert.ok(sheet.graphics.free[0].y*GRAPH_FRAME.height>=row.top);
  await s.click({deleteStation:record.id});assert.deepEqual(sheet.graphics.free,[free]);
});
test('elegir símbolos después de guardar es opcional y la ventana se cierra al cambiar de hoja',async()=>{
  const s=screen();s.node('station-symbols-after-save').checked=true;s.node('station-km').value='0,0';await s.submit();
  assert.equal(s.node('station-symbol-dialog').open,true);
  s.inventory.activeSheetId=s.inventory.sheets[1].id;s.ui.refresh();assert.equal(s.node('station-symbol-dialog').open,false);
});
test('el renglón y el selector muestran todas las figuras existentes junto al siguiente símbolo',async()=>{
  const s=screen();s.node('station-km').value='2,870';await s.submit();const sheet=s.inventory.sheets[0],record=sheet.stations[0];
  sheet.graphics.free=['bacheo','tomas','poste-electrico','alcantarilla-existente','alcantarilla-nueva','cabezales','asfalto'].map(symbolId=>createStationGraphic(symbolId,sheet.stations,{stationId:record.id,area:'road',side:'left'}));
  const before=structuredClone(sheet.graphics);s.ui.refresh();s.ui.openSymbols(record.id);
  assert.equal((s.node('station-symbol-preview').innerHTML.match(/data-placed-symbol=/g)||[]).length,7);
  assert.equal((s.node('station-list').innerHTML.match(/<li>/g)||[]).length,7);assert.match(s.node('station-list').innerHTML,/Alcantarilla nueva/);
  s.node('station-symbol-choice').value='puente';s.node('station-symbol-choice').events.change();
  assert.equal((s.node('station-symbol-preview').innerHTML.match(/data-placed-symbol=/g)||[]).length,7);
  assert.match(s.node('station-symbol-preview').innerHTML,/data-pending-symbol=/);assert.deepEqual(sheet.graphics,before);
});
test('un símbolo ajustado a mano sigue visible y no permite repetir su ubicación vinculada',async()=>{
  const s=screen();s.node('station-km').value='0,0';await s.submit();const sheet=s.inventory.sheets[0],record=sheet.stations[0];
  const item=createStationGraphic('bacheo',sheet.stations,{stationId:record.id,area:'road',side:'left'});item.placement.manual=true;Object.assign(item,constrainGraphic(item,{rotation:37}));sheet.graphics.free=[item];
  s.ui.openSymbols(record.id);s.node('station-symbol-choice').value='bacheo';s.node('station-symbol-choice').events.change();
  assert.equal(s.node('station-symbol-place').disabled,true);assert.equal(s.node('station-symbol-place').textContent,'Ya colocado');
  assert.match(s.node('station-symbol-preview').innerHTML,/rotate\(37 /);assert.doesNotMatch(s.node('station-symbol-preview').innerHTML,/data-pending-symbol=/);
  s.node('station-symbol-place').events.click();assert.equal(sheet.graphics.free.length,1);
  s.node('station-symbol-side').value='right';s.node('station-symbol-side').events.change();assert.equal(s.node('station-symbol-place').disabled,false);
});
test('los dibujos libres del renglón aparecen y evitan otro símbolo encima sin crear un vínculo',async()=>{
  const s=screen();s.node('station-km').value='0,0';await s.submit();const sheet=s.inventory.sheets[0],record=sheet.stations[0];
  const free=createStationGraphic('bacheo',sheet.stations,{stationId:record.id,area:'road',side:'left'});delete free.placement;sheet.graphics.free=[free];const before=structuredClone(free);
  s.ui.refresh();s.ui.openSymbols(record.id);s.node('station-symbol-choice').value='bacheo';s.node('station-symbol-choice').events.change();
  assert.match(s.node('station-symbol-list').innerHTML,/Dibujo libre/);assert.doesNotMatch(s.node('station-symbol-list').innerHTML,/data-edit-station-symbol=/);
  assert.match(s.node('station-list').innerHTML,/data-placed-symbol=/);assert.equal(s.node('station-symbol-place').disabled,true);assert.deepEqual(sheet.graphics.free[0],before);
  await s.symbolAction({removeStationSymbol:free.id});assert.equal(sheet.graphics.free.length,0);assert.equal(s.node('station-symbol-place').disabled,false);
  assert.doesNotMatch(s.node('station-symbol-preview').innerHTML,/data-placed-symbol=/);assert.match(s.node('station-symbol-preview').innerHTML,/data-pending-symbol=/);assert.equal(sheet.stations.length,1);
});
test('agregar y quitar actualiza inmediatamente la vista y el bloqueo del siguiente agregado',async()=>{
  const s=screen();s.node('station-km').value='0,0';await s.submit();const sheet=s.inventory.sheets[0];s.ui.openSymbols(sheet.stations[0].id);
  s.node('station-symbol-choice').value='bacheo';s.node('station-symbol-choice').events.change();assert.match(s.node('station-symbol-preview').innerHTML,/data-pending-symbol=/);
  s.node('station-symbol-place').events.click();const id=sheet.graphics.free[0].id;
  assert.equal(s.node('station-symbol-place').disabled,true);assert.match(s.node('station-symbol-preview').innerHTML,/data-placed-symbol=/);assert.doesNotMatch(s.node('station-symbol-preview').innerHTML,/data-pending-symbol=/);
  await s.symbolAction({removeStationSymbol:id});assert.equal(s.node('station-symbol-place').disabled,false);assert.doesNotMatch(s.node('station-list').innerHTML,/data-placed-symbol=/);
});
test('agregar con campos opcionales vacíos, editar y eliminar conserva el renglón del registro',async()=>{
  const s=screen();s.node('station-km').value='0,0';await s.submit();
  assert.equal(s.commits,1);const records=s.inventory.sheets[0].stations;
  assert.equal(records.length,1);assert.equal(records[0].diameter,'');assert.equal(s.node('station-km').value,'');
  s.node('station-km').value='12,678';s.node('station-diameter').value='0,80';await s.submit();
  await s.click({editStation:records[0].id});s.node('station-observations').value='Huecos 2x2 (6)';await s.submit();
  assert.equal(s.inventory.sheets[0].stations[0].station,'0,0');
  assert.equal(s.inventory.sheets[0].stations[0].observations,'Huecos 2x2 (6)');
  assert.equal(s.inventory.sheets[0].stations[1].station,'12,678');
  await s.click({deleteStation:records[0].id});assert.equal(s.inventory.sheets[0].stations.length,1);
  assert.ok(s.node('station-list').innerHTML.includes('1 desde abajo'));
});
test('un número inválido impide guardar y cambiar de hoja conserva formularios independientes',async()=>{
  const s=screen();s.node('station-km').value='4,9';s.node('station-number').value='dos';await s.submit();
  assert.equal(s.commits,0);assert.equal(s.node('station-error').hidden,false);
  s.node('station-form').events.input();assert.equal(s.inventory.sheets[0].stationDraft.station,'4,9');
  s.inventory.activeSheetId=s.inventory.sheets[1].id;s.ui.refresh();
  assert.equal(s.node('station-km').value,'');s.node('station-km').value='12,678';await s.submit();
  assert.equal(s.inventory.sheets[1].stations.length,1);assert.equal(s.inventory.sheets[0].stations.length,0);
  s.inventory.activeSheetId=s.inventory.sheets[0].id;s.ui.refresh();assert.equal(s.node('station-km').value,'4,9');assert.equal(s.node('station-number').value,'dos');
});
test('se exige una sola coma o punto y entre uno y tres decimales, sin guardar entradas inválidas',async()=>{
  const s=screen();
  for(const value of ['2','2,','2.','2,,870','2.8.7','2,8701','-2,0','2/870','2 ,870']) {
    s.node('station-km').value=value;await s.submit();assert.equal(s.commits,0,value);
    assert.equal(s.node('station-error').hidden,false);assert.equal(s.node('station-km').attributes['aria-invalid'],'true');
  }
  for(const value of ['2,870','3.86','4,9']){s.node('station-km').value=value;await s.submit();}
  assert.equal(s.inventory.sheets[0].stations.length,3);
});
test('las estaciones equivalentes no se repiten al agregar, editar, cambiar de hoja ni hacer doble envío',async()=>{
  const s=screen();s.node('station-km').value='2,870';await Promise.all([s.submit(),s.submit()]);
  const first=s.inventory.sheets[0].stations[0];assert.equal(s.commits,1);
  for(const value of ['2.870','02,87','2,870']){s.node('station-km').value=value;await s.submit();assert.equal(s.commits,1);assert.match(s.node('station-error').textContent,/ya existe/i);}
  await s.click({editStation:first.id});const beforeEdit=s.commits;s.node('station-km').value='2.87';await s.submit();assert.equal(s.commits,beforeEdit+1);
  s.node('station-km').value='2,864';await s.submit();const second=s.inventory.sheets[0].stations[0];
  await s.click({editStation:second.id});s.node('station-km').value='2,870';await s.submit();
  assert.equal(s.inventory.sheets[0].stations.length,2);assert.equal(s.inventory.sheets[0].stations[0].station,'2,864');
  s.inventory.activeSheetId=s.inventory.sheets[1].id;s.ui.refresh();s.node('station-km').value='2.870';await s.submit();
  assert.equal(s.inventory.sheets[1].stations.length,0);assert.match(s.node('station-error').textContent,/hoja 1/i);
});
test('agregar y editar ordena numéricamente cada hoja y conserva los detalles sin mover el dibujo de la carretera',async()=>{
  const s=screen();
  for(const value of ['12,01','2,870','2,864','2,9']){s.node('station-km').value=value;s.node('station-observations').value='Hallazgo '+value;await s.submit();}
  const sheet=s.inventory.sheets[0];assert.deepEqual(sheet.stations.map(r=>r.station),['2,864','2,870','2,9','12,01']);
  const target=sheet.stations[1];sheet.graphics.free=[createGraphic('bacheo')];
  const before=structuredClone(sheet.graphics.free);
  await s.click({editStation:target.id});s.node('station-km').value='1,0';await s.submit();
  assert.equal(sheet.stations[0].id,target.id);assert.equal(sheet.stations[0].observations,'Hallazgo 2,870');
  assert.deepEqual(sheet.graphics.free,before);
  assert.match(s.node('station-order-note').textContent,/menor a mayor/i);
});
test('una hoja llena permite editar y continuar en una hoja nueva sin sobrescribir estaciones',async()=>{
  const s=screen();
  for(let i=0;i<26;i++){s.node('station-km').value=`${i},0`;await s.submit();}
  assert.equal(s.inventory.sheets[0].stations.length,26);assert.equal(s.node('station-save').disabled,true);
  assert.equal(s.node('station-next-sheet').hidden,false);
  await s.click({editStation:s.inventory.sheets[0].stations[0].id});assert.equal(s.node('station-save').disabled,false);
  s.node('station-cancel').events.click();s.node('station-next-sheet').events.click();
  assert.equal(s.inventory.sheets.length,3);assert.equal(s.inventory.activeSheetId,s.inventory.sheets[2].id);
  assert.equal(s.inventory.sheets[0].stations.length,26);assert.equal(s.node('station-save').disabled,false);
});
test('las pestañas cambian de panel con clic y teclado sin mezclar el formulario',()=>{
  const s=screen();setupEditorTabs();s.tabs[1].events.click();
  assert.equal(s.node('panel-header').hidden,true);assert.equal(s.node('panel-stations').hidden,false);
  assert.equal(s.tabs[1].attributes['aria-selected'],'true');
  s.tabs[1].events.keydown({key:'ArrowLeft',preventDefault(){}});
  assert.equal(s.node('panel-header').hidden,false);assert.equal(s.node('panel-stations').hidden,true);
  assert.equal(s.tabs[0].tabIndex,0);
});
test('Anterior y Siguiente recorren las cuatro secciones, enfocan su inicio y conservan el formulario',()=>{
  const s=screen(),selected=[],previousRAF=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=fn=>fn();
  try{
    s.node('station-km').value='0,';s.node('station-observations').value='Un hueco';s.node('station-form').events.input();
    const before=structuredClone(s.inventory),commits=s.commits;setupEditorTabs({onSelect:name=>selected.push(name)});
    for(const button of s.navigation){
      button.events.click();const name=button.dataset.goSection,panel=s.node(`panel-${name}`);
      assert.equal(panel.hidden,false);assert.equal(panel.focused,true);assert.equal(panel.scrolled,true);
      assert.equal(s.node(`tab-${name}`).attributes['aria-selected'],'true');
      for(const tab of s.tabs)if(tab.dataset.editorTab!==name)assert.equal(s.node(tab.attributes['aria-controls']).hidden,true);
    }
    assert.deepEqual(selected,['stations','header','graphics','stations','sketch','graphics']);assert.equal(s.commits,commits);assert.deepEqual(s.inventory,before);
  }finally{if(previousRAF===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousRAF;}
});

test('escribir guarda un formulario incompleto y descartarlo no registra una estación',()=>{
  const s=screen();s.node('station-km').value='2,';s.node('station-observations').value='Revisión pendiente';
  s.node('station-form').events.input();const first=s.inventory.sheets[0];
  assert.equal(first.stationDraft.station,'2,');assert.equal(first.stations.length,0);assert.equal(s.node('station-cancel').hidden,false);
  s.inventory.activeSheetId=s.inventory.sheets[1].id;s.ui.refresh();assert.equal(s.node('station-km').value,'');
  s.inventory.activeSheetId=first.id;s.ui.refresh();assert.equal(s.node('station-km').value,'2,');assert.equal(s.node('station-observations').value,'Revisión pendiente');
  s.node('station-cancel').events.click();assert.equal(first.stationDraft,null);assert.equal(first.stations.length,0);assert.equal(s.node('station-km').value,'');
});
