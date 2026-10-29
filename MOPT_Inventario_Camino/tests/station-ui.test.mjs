// Se ejecutan las acciones del formulario sin depender de un navegador instalado.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setupStations,setupEditorTabs} from '../dist/js/station-ui.js';
import {createInventory,addSheet} from '../dist/js/model.js';
import {createGraphic} from '../dist/js/graphics-model.js';

function screen() {
  const nodes=new Map();
  function node(id){
    if(!nodes.has(id))nodes.set(id,{value:'',hidden:false,disabled:false,innerHTML:'',textContent:'',dataset:{},attributes:{},events:{},
      addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this.attributes[name]=String(value);},
      getAttribute(name){return this.attributes[name];},removeAttribute(name){delete this.attributes[name];},focus(){this.focused=true;}});
    return nodes.get(id);
  }
  const tabs=['header','stations'].map(name=>{const n=node(`tab-${name}`);n.dataset.editorTab=name;n.attributes['aria-controls']=`panel-${name}`;return n;});
  globalThis.document={getElementById:node,querySelectorAll:()=>tabs};
  let inventory=addSheet(createInventory()),commits=0,ui;
  const commit=()=>{commits++;ui?.refresh();};
  ui=setupStations({getInventory:()=>inventory,commit,notify(){},confirmAction:async()=>true,nextSheet(){inventory=addSheet(inventory);inventory.activeSheetId=inventory.sheets.at(-1).id;commit();}});
  const submit=()=>node('station-form').events.submit({preventDefault(){}});
  const click=(dataset)=>node('station-list').events.click({target:{closest(selector){if(selector==='[data-edit-station]'&&dataset.editStation)return {dataset};if(selector==='[data-delete-station]'&&dataset.deleteStation)return {dataset};return null;}}});
  return {node,ui,submit,click,tabs,get inventory(){return inventory;},get commits(){return commits;}};
}
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
  await s.click({editStation:first.id});s.node('station-km').value='2.87';await s.submit();assert.equal(s.commits,2);
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
