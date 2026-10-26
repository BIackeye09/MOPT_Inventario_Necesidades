// Se ejecutan las acciones del formulario sin depender de un navegador instalado.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setupStations,setupEditorTabs} from '../dist/js/station-ui.js';
import {createInventory,addSheet} from '../dist/js/model.js';

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
test('una hoja llena permite editar y continuar en una hoja nueva sin sobrescribir estaciones',async()=>{
  const s=screen();
  for(let i=0;i<26;i++){s.node('station-km').value=String(i);await s.submit();}
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
