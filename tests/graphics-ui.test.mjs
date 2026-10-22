// Ejercita los eventos del editor y sus datos sin depender del navegador remoto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setupGraphics} from '../dist/js/graphics-ui.js';
import {createInventory} from '../dist/js/model.js';
import {GRAPH_FRAME,graphicPlacements} from '../dist/js/graphics-model.js';
function screen() {
  const inventory=createInventory(),nodes=new Map();let svgRows=[],ui,commits=0;
  inventory.sheets[0].stations=['0,0','1,25','4,9'].map((station,i)=>({id:`s${i}`,station,observations:''}));
  function node(id) {
    if(!nodes.has(id)) {
      let html='';const value={dataset:{},value:'100',hidden:false,disabled:false,textContent:'',events:{},captures:new Set(),scrollTop:600,clientHeight:300,scrollHeight:1000,
        addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,v){this[name]=String(v);},focus(){},
        getBoundingClientRect(){return {height:1000,width:440};},getScreenCTM(){return {inverse(){return {};}};},
        setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);},style:{}};
      Object.defineProperty(value,'innerHTML',{get:()=>html,set:text=>{html=text;if(id==='station-graphic-list')svgRows=[...text.matchAll(/data-station-id="([^"]+)"/g)].map(m=>{const svg=node(`svg-${m[1]}`);svg.dataset.stationId=m[1];return svg;});}});
      nodes.set(id,value);
    }
    return nodes.get(id);
  }
  globalThis.document={getElementById:node,querySelectorAll:()=>svgRows};
  globalThis.requestAnimationFrame=fn=>fn();
  globalThis.DOMPoint=class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
  ui=setupGraphics({getInventory:()=>inventory,commit(){commits++;ui?.refresh();},notify(){},selectStations(){}});
  const click=id=>node(id).events.click();
  const add=id=>node('graphic-palette').events.click({target:{closest:()=>({dataset:{addSymbol:id}})}});
  function pointer(type,{id,x=0,y=0,handle,stationId}={}) {
    const svg=node(stationId?`svg-${stationId}`:'graphic-free-canvas');
    const event={button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},target:{dataset:{handle},closest(selector){return selector.startsWith('svg')?svg:id?{dataset:{graphicId:id}}:null;}}};
    node('panel-graphics').events[type](event);
  }
  return {node,inventory,ui,click,add,pointer,get commits(){return commits;}};
}
test('el editor completo agrega, agranda, duplica, elimina y deshace sin alterar las estaciones',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');assert.equal(sheet.graphics.free.length,1);
  const original=structuredClone(sheet.graphics.free[0]);s.click('graphic-larger');assert.ok(sheet.graphics.free[0].width>original.width);
  s.click('graphic-duplicate');assert.equal(sheet.graphics.free.length,2);
  s.click('graphic-delete');assert.equal(sheet.graphics.free.length,1);s.click('graphic-undo');assert.equal(sheet.graphics.free.length,2);
  assert.equal(sheet.stations.length,3);assert.ok(s.commits>=4);
});
test('arrastrar y redimensionar actualiza las posiciones que reciben Excel y PDF y limita los bordes',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-existente');const item=sheet.graphics.free[0],original={...item};
  s.pointer('pointerdown',{id:item.id,x:20,y:200});s.pointer('pointermove',{id:item.id,x:29,y:210});s.pointer('pointerup',{id:item.id,x:29,y:210});
  assert.ok(Math.abs(item.x-original.x-9/GRAPH_FRAME.width)<1e-7);
  assert.ok(Math.abs(item.y-original.y-10/GRAPH_FRAME.height)<1e-7);
  const moved={...item};s.pointer('pointerdown',{id:item.id,x:30,y:210,handle:'se'});s.pointer('pointermove',{id:item.id,x:40,y:215});s.pointer('pointerup',{id:item.id,x:40,y:215});
  assert.ok(item.width>moved.width&&item.height>moved.height);
  s.pointer('pointerdown',{id:item.id,x:40,y:215});s.pointer('pointermove',{id:item.id,x:9999,y:9999});s.pointer('pointerup',{id:item.id,x:9999,y:9999});
  assert.ok(item.x+item.width<=1.0000001&&item.y+item.height<=1.0000001);
  const placement=graphicPlacements(sheet)[0];assert.ok(Math.abs(placement.width-item.width*GRAPH_FRAME.width)<1e-8);
});
test('el caso por estación usa su lista, conserva el otro caso y no deja salir el símbolo de la fila',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');const free=structuredClone(sheet.graphics.free);
  s.click('graphic-case-station');s.node('symbol-s1').value='poste-electrico';
  s.node('station-graphic-list').events.click({target:{closest:()=>({dataset:{addStationSymbol:'s1'}})}});
  const item=sheet.graphics.station[0];assert.equal(item.stationId,'s1');assert.equal(sheet.graphics.activeMode,'station');
  s.pointer('pointerdown',{id:item.id,stationId:'s1',x:40,y:5,handle:'se'});s.pointer('pointermove',{id:item.id,stationId:'s1',x:60,y:99});s.pointer('pointerup',{id:item.id,stationId:'s1',x:60,y:99});
  assert.ok(item.y+item.height<=1.0000001);assert.deepEqual(sheet.graphics.free,free);
  s.click('graphic-case-free');assert.deepEqual(sheet.graphics.free,free);assert.equal(sheet.graphics.station.length,1);
});
test('cancelar un arrastre restaura el dibujo y el teclado mueve y elimina la selección',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('tomas');const item=sheet.graphics.free[0],original={...item};
  s.pointer('pointerdown',{id:item.id,x:20,y:200});s.pointer('pointermove',{id:item.id,x:35,y:210});s.pointer('pointercancel',{id:item.id});assert.deepEqual(item,original);
  const svg=s.node('graphic-free-canvas'),key=key=>s.node('panel-graphics').events.keydown({key,shiftKey:false,preventDefault(){},target:{closest:()=>svg}});
  key('ArrowLeft');assert.ok(item.x<original.x);key('Delete');assert.equal(sheet.graphics.free.length,0);
});
test('los botones y el ángulo giran ambos casos, duplicar conserva el giro y Deshacer lo revierte',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('direccion-agua');
  s.click('graphic-rotate-left');assert.equal(sheet.graphics.free[0].rotation,345);
  s.click('graphic-rotate-right');assert.equal(sheet.graphics.free[0].rotation,0);
  s.node('graphic-angle').events.change({target:{value:'90'}});assert.equal(sheet.graphics.free[0].rotation,90);
  assert.match(s.node('graphic-free-canvas').innerHTML,/transform="rotate\(90 /);
  s.click('graphic-duplicate');assert.equal(sheet.graphics.free[1].rotation,90);
  s.click('graphic-rotation-reset');assert.equal(sheet.graphics.free[1].rotation,0);
  s.click('graphic-undo');assert.equal(sheet.graphics.free[1].rotation,90);
  s.click('graphic-case-station');s.node('symbol-s1').value='alcantarilla-existente';
  s.node('station-graphic-list').events.click({target:{closest:()=>({dataset:{addStationSymbol:'s1'}})}});
  s.node('graphic-angle').events.change({target:{value:'45'}});assert.equal(sheet.graphics.station[0].rotation,45);
  assert.equal(graphicPlacements(sheet)[0].rotation,45);assert.equal(sheet.graphics.free[0].rotation,90);
});
test('redimensionar una esquina girada sigue los ejes del símbolo y permite seguir moviéndolo',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');
  s.node('graphic-angle').events.change({target:{value:'90'}});const item=sheet.graphics.free[0],before={...item};
  s.pointer('pointerdown',{id:item.id,x:40,y:200,handle:'se'});s.pointer('pointermove',{id:item.id,x:37,y:203});s.pointer('pointerup',{id:item.id});
  assert.ok(item.width>before.width&&item.height>before.height);assert.equal(item.rotation,90);
  const moved={...item};s.pointer('pointerdown',{id:item.id,x:40,y:200});s.pointer('pointermove',{id:item.id,x:42,y:200});s.pointer('pointerup',{id:item.id});
  assert.ok(item.x>moved.x);assert.equal(item.rotation,90);
});
test('la flecha circular gira arrastrando alrededor del centro y permite deshacer en ambos casos',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-existente');
  function turn(item,stationId,height){
    const cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*height;
    s.pointer('pointerdown',{id:item.id,stationId,x:cx,y:cy-15,handle:'rotate'});
    s.pointer('pointermove',{id:item.id,stationId,x:cx+15,y:cy});s.pointer('pointerup',{id:item.id,stationId});
    assert.ok(Math.abs(item.rotation-90)<1e-7);assert.match(s.node(stationId?`svg-${stationId}`:'graphic-free-canvas').innerHTML,/data-handle="rotate"/);
  }
  turn(sheet.graphics.free[0],undefined,GRAPH_FRAME.height);s.click('graphic-undo');assert.equal(sheet.graphics.free[0].rotation,0);
  s.click('graphic-case-station');s.node('symbol-s1').value='alcantarilla-existente';s.node('station-graphic-list').events.click({target:{closest:()=>({dataset:{addStationSymbol:'s1'}})}});
  turn(sheet.graphics.station[0],'s1',15.386);assert.equal(sheet.graphics.free[0].rotation,0);
});
test('cancelar el giro restaura el ángulo y el tamaño previos',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');const item=sheet.graphics.free[0],before={...item};
  const cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*GRAPH_FRAME.height;
  s.pointer('pointerdown',{id:item.id,x:cx,y:cy-15,handle:'rotate'});s.pointer('pointermove',{id:item.id,x:cx+15,y:cy});s.pointer('pointercancel',{id:item.id});assert.deepEqual(item,before);
});
