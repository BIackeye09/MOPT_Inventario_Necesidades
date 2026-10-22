// Eventos reales del controlador, con un lienzo registrador para revisar sus operaciones.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setupSketch} from '../dist/js/sketch-ui.js';
import {createInventory,addSheet} from '../dist/js/model.js';
import {documentValues} from '../dist/js/documents.js';
function screen() {
  let inventory=addSheet(createInventory()),ui,commits=0;const nodes=new Map(),calls=[],saved=[];
  const context={globalCompositeOperation:'source-over',save(){saved.push(this.globalCompositeOperation);},restore(){this.globalCompositeOperation=saved.pop();},
    clearRect(){calls.push(['clear']);},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},arc(){},
    fill(){calls.push(['fill',this.globalCompositeOperation]);},stroke(){calls.push(['stroke',this.globalCompositeOperation]);}};
  function node(id){if(!nodes.has(id))nodes.set(id,{dataset:{},style:{},events:{},disabled:false,hidden:false,captures:new Set(),value:'',scrollLeft:0,scrollTop:0,
    addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,value){this[name]=String(value);},focus(){},getContext(){return context;},
    getBoundingClientRect(){return {left:0,top:0,width:1000,height:600};},setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);}});return nodes.get(id);}
  globalThis.document={getElementById:node};
  ui=setupSketch({getInventory:()=>inventory,commit(){commits++;ui?.refresh();},notify(){},confirmAction:async()=>true});
  const pointer=(name,x=100,y=100,extra={})=>node('sketch-canvas').events[name]({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){},...extra});
  const line=()=>{pointer('pointerdown',100,120);pointer('pointermove',500,300);pointer('pointerup',700,420);};
  return {inventory,node,ui,pointer,line,calls,click:id=>node(id).events.click(),get commits(){return commits;}};
}
test('lápiz y borrador parcial se guardan como operaciones y llegan al documento',()=>{
  const s=screen();s.line();s.click('sketch-eraser');s.pointer('pointerdown',400,250);s.pointer('pointermove',450,260);s.pointer('pointerup',460,260);
  const strokes=s.inventory.sheets[0].sketch.strokes;assert.equal(strokes.length,2);assert.equal(strokes[0].tool,'pen');assert.equal(strokes[1].tool,'eraser');
  assert.equal(strokes[0].points.length,3);assert.equal(s.commits,2);
  assert.ok(s.calls.some(c=>c[1]==='destination-out'));assert.deepEqual(documentValues(s.inventory).sketch.strokes,strokes);
  s.click('sketch-undo');assert.equal(strokes.length,1);s.click('sketch-redo');assert.equal(strokes.length,2);
});
test('limpiar y deshacer recupera el dibujo y mantiene historias distintas por hoja',async()=>{
  const s=screen();s.line();const before=structuredClone(s.inventory.sheets[0].sketch);
  await s.click('sketch-clear');assert.equal(s.inventory.sheets[0].sketch.strokes.length,0);s.click('sketch-undo');assert.deepEqual(s.inventory.sheets[0].sketch,before);
  s.inventory.activeSheetId=s.inventory.sheets[1].id;s.ui.refresh();assert.equal(s.node('sketch-undo').disabled,true);s.line();
  s.inventory.activeSheetId=s.inventory.sheets[0].id;s.ui.refresh();s.click('sketch-undo');assert.equal(s.inventory.sheets[0].sketch.strokes.length,0);assert.equal(s.inventory.sheets[1].sketch.strokes.length,1);
});
test('ratón o dedo captura el puntero, limita bordes y cancela sin guardar un trazo accidental',()=>{
  const s=screen();s.pointer('pointerdown',20,20);assert.equal(s.node('sketch-canvas').hasPointerCapture(1),true);
  s.pointer('pointermove',1200,-50);s.pointer('pointerup',1200,-50);const stroke=s.inventory.sheets[0].sketch.strokes[0];assert.deepEqual(stroke.points.at(-1),[1,0]);
  assert.equal(s.node('sketch-canvas').hasPointerCapture(1),false);s.pointer('pointerdown',30,30);s.pointer('pointermove',300,300);s.pointer('pointercancel',300,300);
  assert.equal(s.inventory.sheets[0].sketch.strokes.length,1);assert.equal(s.commits,1);
});
test('el grosor es independiente por herramienta y el teclado deshace y rehace',()=>{
  const s=screen();s.node('sketch-size').events.input({target:{value:'8'}});s.line();assert.equal(s.inventory.sheets[0].sketch.strokes[0].size,8);
  s.click('sketch-eraser');assert.equal(s.node('sketch-size').value,'24');s.node('sketch-size').events.input({target:{value:'40'}});s.click('sketch-pencil');assert.equal(s.node('sketch-size').value,'8');
  const key=key=>s.node('sketch-canvas').events.keydown({key,ctrlKey:true,preventDefault(){}});key('z');assert.equal(s.inventory.sheets[0].sketch.strokes.length,0);key('y');assert.equal(s.inventory.sheets[0].sketch.strokes.length,1);
});
test('Mover lienzo permite recorrer el zoom sin dibujar ni modificar el croquis',()=>{
  const s=screen();s.click('sketch-pan');s.node('sketch-viewport').scrollLeft=150;
  s.pointer('pointerdown',500,200);s.pointer('pointermove',300,150);s.pointer('pointerup',300,150);
  assert.equal(s.node('sketch-viewport').scrollLeft,350);assert.equal(s.node('sketch-viewport').scrollTop,50);
  assert.equal(s.inventory.sheets[0].sketch.strokes.length,0);assert.equal(s.commits,0);
});
