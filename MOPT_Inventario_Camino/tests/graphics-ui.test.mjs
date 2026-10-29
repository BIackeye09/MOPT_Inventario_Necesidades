// Ejercita los eventos del editor y sus datos sin depender del navegador remoto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setupGraphics} from '../dist/js/graphics-ui.js';
import {createInventory} from '../dist/js/model.js';
import {GRAPH_FRAME,graphicPlacements} from '../dist/js/graphics-model.js';
function screen({phone=false}={}) {
  const inventory=createInventory(),nodes=new Map();let ui,commits=0;
  inventory.sheets[0].stations=['0,0','1,25','4,9'].map((station,i)=>({id:`s${i}`,station,observations:''}));
  function node(id) {
    if(!nodes.has(id)) {
      let html='';const value={id,dataset:{},value:'100',hidden:false,disabled:false,textContent:'',events:{},captures:new Set(),scrollTop:600,clientHeight:300,scrollHeight:1000,
        addEventListener(name,fn){this.events[name]=fn;},setAttribute(name,v){this[name]=String(v);},getAttribute(name){return this[name]??null;},focus(){},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},
        getBoundingClientRect(){return {height:1000,width:440};},getScreenCTM(){return {inverse(){return {};}};},
        setPointerCapture(id){this.captures.add(id);},hasPointerCapture(id){return this.captures.has(id);},releasePointerCapture(id){this.captures.delete(id);},style:{}};
      Object.defineProperty(value,'innerHTML',{get:()=>html,set:text=>{html=text;}});
      nodes.set(id,value);
    }
    return nodes.get(id);
  }
  const fullscreenCalls={enter:0,exit:0};
  globalThis.document={getElementById:node,querySelectorAll:()=>[],body:{classList:{add(){},remove(){}}},
    documentElement:{requestFullscreen(){fullscreenCalls.enter++;return Promise.resolve();}},exitFullscreen(){fullscreenCalls.exit++;return Promise.resolve();}};
  globalThis.requestAnimationFrame=fn=>fn();
  globalThis.matchMedia=()=>({matches:phone});
  globalThis.DOMPoint=class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:this.x*(m.a??1)+(m.e??0),y:this.y*(m.d??1)+(m.f??0)};}};
  ui=setupGraphics({getInventory:()=>inventory,commit(){commits++;ui?.refresh();},notify(){},selectStations(){}});
  const click=id=>node(id).events.click();
  const add=id=>node('graphic-palette').events.click({target:{closest:()=>({dataset:{addSymbol:id}})}});
  const lastPoints=new Map();
  function pointer(type,{id,x,y,handle,stationId,pointerId=1,pointerType='mouse',focus=false}={}) {
    const last=lastPoints.get(pointerId)||{x:0,y:0};x??=last.x;y??=last.y;lastPoints.set(pointerId,{x,y});
    const svg=node(focus?'graphic-focus-canvas':'graphic-free-canvas');
    const event={button:0,pointerId,pointerType,clientX:x,clientY:y,preventDefault(){},target:{dataset:{handle},closest(selector){return selector.startsWith('svg')?svg:id?{dataset:{graphicId:id}}:null;}}};
    node(focus?'graphic-focus-dialog':'panel-graphics').events[type](event);
  }
  return {node,inventory,ui,click,add,pointer,fullscreenCalls,get commits(){return commits;}};
}

// Ejercita el único editor con las mismas acciones del teléfono y del ratón.
function focusEditor() {
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');s.click('graphic-open-full');
  const item=sheet.graphics.free[0];
  return {...s,get commits(){return s.commits;},sheet,item,height:GRAPH_FRAME.height,
    key(key){s.node('graphic-focus-dialog').events.keydown({key,shiftKey:false,preventDefault(){},target:{closest:()=>s.node('graphic-focus-canvas')}});},
    touch(type,pointerId,x,y,id){s.pointer(type,{focus:true,pointerType:'touch',pointerId,x,y,id});}};
}
test('Símbolo bloquea la cámara aunque ambos dedos comiencen en el fondo, en la carretera completa',()=>{
   {
    const s=focusEditor();s.click('graphic-focus-symbol');
    const view=s.node('graphic-focus-canvas').getAttribute('viewBox'),before=structuredClone(s.sheet.graphics),commits=s.commits;
    s.touch('pointerdown',1,-1000,-1000);s.touch('pointerdown',2,-900,-1000);
    s.touch('pointermove',1,-1100,-950);s.touch('pointermove',2,-800,-900);
    s.touch('pointerup',2,-800,-900);s.touch('pointerup',1,-1100,-950);
    assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view,'carretera');
    assert.deepEqual(s.sheet.graphics,before);assert.equal(s.commits,commits);
    for(const id of ['graphic-focus-fit','graphic-focus-working','graphic-focus-zoom-in','graphic-focus-zoom-out']) {
      assert.equal(s.node(id).disabled,true,id);s.click(id);
    }
    for(const event of ['wheel','dblclick'])s.node('graphic-focus-canvas').events[event]({deltaY:-100,clientX:30,clientY:30,preventDefault(){}});
    assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view);
    assert.equal(s.node('graphic-focus-symbol')['aria-pressed'],'true');
  }
});

test('Mover y zoom bloquea todas las herramientas de símbolos sin cambiar de modo, en la carretera completa',()=>{
   {
    const s=focusEditor(),before=structuredClone(s.sheet.graphics),commits=s.commits;
    for(const id of ['graphic-focus-smaller','graphic-focus-larger','graphic-focus-left','graphic-focus-right','graphic-focus-duplicate','graphic-focus-delete','graphic-focus-undo','graphic-focus-add']) {
      assert.equal(s.node(id).disabled,true,id);s.click(id);
      assert.deepEqual(s.sheet.graphics,before,id);assert.equal(s.node('graphic-focus-view')['aria-pressed'],'true',id);
    }
    s.node('graphic-focus-symbols').events.click({target:{closest:()=>({dataset:{focusSymbol:'poste-electrico'}})}});
    s.key('Delete');s.key('Backspace');assert.deepEqual(s.sheet.graphics,before);assert.equal(s.commits,commits);
    assert.equal(s.node('graphic-focus-palette').hidden,true);
  }
});

test('Mover y zoom sobre una figura o su giro solo cambia la vista y no la selección, en el editor',()=>{
   {
    const s=focusEditor(),before=structuredClone(s.sheet.graphics),commits=s.commits;
    const x=(s.item.x+s.item.width/2)*GRAPH_FRAME.width,y=(s.item.y+s.item.height/2)*s.height;
    const touch=(type,pointerId,a,b)=>s.pointer(type,{focus:true,id:s.item.id,handle:'rotate',pointerType:'touch',pointerId,x:a,y:b});
    const view=s.node('graphic-focus-canvas').getAttribute('viewBox');
    touch('pointerdown',1,x-2,y);touch('pointerdown',2,x+2,y);touch('pointermove',2,x+12,y+2);
    touch('pointerup',2,x+12,y+2);touch('pointerup',1,x-2,y);
    assert.notEqual(s.node('graphic-focus-canvas').getAttribute('viewBox'),view);
    s.touch('pointerdown',1,-1000,-1000);s.touch('pointerup',1,-1000,-1000);
    s.click('graphic-focus-symbol');assert.equal(s.node('graphic-focus-delete').disabled,false,'Tocar el fondo en vista no borra la selección.');
    assert.deepEqual(s.sheet.graphics,before);assert.equal(s.commits,commits);
  }
});

test('cambiar de modo durante un gesto cancela el cambio pendiente y libera los dedos',()=>{
   {
    const s=focusEditor();s.click('graphic-focus-symbol');const before=structuredClone(s.sheet.graphics),commits=s.commits;
    const x=(s.item.x+s.item.width/2)*GRAPH_FRAME.width,y=(s.item.y+s.item.height/2)*s.height;
    s.touch('pointerdown',1,x,y,s.item.id);s.touch('pointermove',1,x+2,y+1,s.item.id);
    assert.notDeepEqual(s.sheet.graphics,before);s.click('graphic-focus-view');
    assert.deepEqual(s.sheet.graphics,before);assert.equal(s.node('graphic-focus-canvas').captures.size,0);
    s.touch('pointermove',1,x+20,y+10);s.touch('pointerup',1,x+20,y+10);assert.deepEqual(s.sheet.graphics,before);
    const view=s.node('graphic-focus-canvas').getAttribute('viewBox');
    s.touch('pointerdown',1,100,100);s.touch('pointerdown',2,150,100);s.touch('pointermove',2,250,110);
    s.click('graphic-focus-symbol');assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view);
    assert.equal(s.node('graphic-focus-canvas').captures.size,0);assert.equal(s.commits,commits);
  }
});

test('abrir gráficos conserva toda la superficie de la app sin activar el aviso de pantalla completa',()=>{
  const s=screen();s.click('graphic-open-full');assert.equal(s.node('graphic-focus-dialog').open,true);
  assert.equal(s.fullscreenCalls.enter,0);s.click('graphic-focus-close');assert.equal(s.fullscreenCalls.exit,0);
});

test('Símbolo permite mover, escalar, girar y usar el teclado manteniendo fija la cámara en el editor',()=>{
   {
    const s=focusEditor();s.click('graphic-focus-symbol');const view=s.node('graphic-focus-canvas').getAttribute('viewBox');
    const center=()=>({x:(s.item.x+s.item.width/2)*GRAPH_FRAME.width,y:(s.item.y+s.item.height/2)*s.height});
    let p=center(),before={...s.item};s.touch('pointerdown',1,p.x,p.y,s.item.id);s.touch('pointermove',1,p.x+2,p.y);s.touch('pointerup',1,p.x+2,p.y);
    assert.ok(s.item.x>before.x);p=center();before={...s.item};
    s.touch('pointerdown',1,p.x-1,p.y,s.item.id);s.touch('pointerdown',2,p.x+1,p.y);
    s.touch('pointermove',2,p.x+2,p.y);s.touch('pointerup',2,p.x+2,p.y);s.touch('pointerup',1,p.x-1,p.y);
    assert.ok(s.item.width>before.width);s.click('graphic-focus-right');assert.equal(s.item.rotation,15);
    before={...s.item};s.key('ArrowLeft');assert.ok(s.item.x<before.x);
    assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view,'carretera');
  }
});

test('el dedo estira solo el largo o el grosor, incluso girado, en el editor y con Deshacer',()=>{
  for(const rotation of [0,37,90])for(const handle of ['e','w','n','s']) {
    const s=focusEditor();s.click('graphic-focus-symbol');
    for(let i=0;i<4;i++)s.click('graphic-focus-smaller');
    s.node('graphic-angle').events.change({target:{value:String(rotation)}});
    const before={...s.item},view=s.node('graphic-focus-canvas').getAttribute('viewBox'),commits=s.commits;
    const angle=rotation*Math.PI/180,c=Math.cos(angle),sin=Math.sin(angle);
    const horizontal=handle==='e'||handle==='w',sign=handle==='w'||handle==='n'?-1:1;
    // El movimiento perpendicular simula el temblor normal de un dedo.
    const localX=horizontal?sign*.5:.2,localY=horizontal?.2:sign*.5;
    const x=(before.x+before.width/2)*GRAPH_FRAME.width,y=(before.y+before.height/2)*s.height;
    s.pointer('pointerdown',{focus:true,id:s.item.id,handle,pointerType:'touch',x,y});
    s.pointer('pointermove',{focus:true,pointerType:'touch',x:x+localX*c-localY*sin,y:y+localX*sin+localY*c});
    s.pointer('pointerup',{focus:true,pointerType:'touch'});
    assert.ok(s.item[horizontal?'width':'height']>before[horizontal?'width':'height'],`carretera ${rotation} ${handle}`);
    assert.equal(s.item[horizontal?'height':'width'],before[horizontal?'height':'width']);
    assert.equal(s.item.rotation,before.rotation);assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view);
    assert.equal(s.commits,commits+1);assert.doesNotThrow(()=>graphicPlacements(s.sheet));
    s.click('graphic-focus-undo');assert.deepEqual(s.sheet.graphics.free[0],before);
  }
});

test('los botones de largo y grosor actúan por separado y quedan bloqueados en Mover y zoom',()=>{
   {
    const s=focusEditor(),actions=[['graphic-focus-longer','width',1],['graphic-focus-shorter','width',-1],['graphic-focus-thicker','height',1],['graphic-focus-thinner','height',-1]];
    for(const [id,axis,sign]of actions) {
      const locked=structuredClone(s.sheet.graphics);assert.equal(s.node(id).disabled,true);s.click(id);assert.deepEqual(s.sheet.graphics,locked);
      s.click('graphic-focus-symbol');const current=s.sheet.graphics.free[0];
      const x=(current.x+current.width/2)*GRAPH_FRAME.width,y=(current.y+current.height/2)*s.height;
      s.pointer('pointerdown',{focus:true,id:current.id,x,y});s.pointer('pointerup',{focus:true,x,y});
      const before={...current};
      assert.equal(s.node(id).disabled,false);s.click(id);const after=s.sheet.graphics.free[0];
      assert.ok((after[axis]-before[axis])*sign>0);assert.equal(after[axis==='width'?'height':'width'],before[axis==='width'?'height':'width']);
      s.click('graphic-focus-undo');assert.deepEqual(s.sheet.graphics.free[0],before);s.click('graphic-focus-view');
    }
  }
});

test('cancelar un estiramiento restaura largo y grosor y libera el dedo',()=>{
  const s=focusEditor();s.click('graphic-focus-symbol');const before={...s.item};
  s.pointer('pointerdown',{focus:true,id:s.item.id,handle:'e',pointerType:'touch',x:40,y:200});
  s.pointer('pointermove',{focus:true,pointerType:'touch',x:48,y:201});s.pointer('pointercancel',{focus:true,pointerType:'touch'});
  assert.deepEqual(s.item,before);assert.equal(s.node('graphic-focus-canvas').captures.size,0);
});
test('el editor completo agrega, agranda, duplica, elimina y deshace sin alterar las estaciones',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');assert.equal(sheet.graphics.free.length,1);
  const original=structuredClone(sheet.graphics.free[0]);s.click('graphic-larger');assert.ok(sheet.graphics.free[0].width>original.width);
  s.click('graphic-duplicate');assert.equal(sheet.graphics.free.length,2);
  s.click('graphic-delete');assert.equal(sheet.graphics.free.length,1);s.click('graphic-undo');assert.equal(sheet.graphics.free.length,2);
  assert.equal(sheet.stations.length,3);assert.ok(s.commits>=4);
});

test('Mover y zoom usa dos dedos para la cámara y nunca cambia el símbolo ni agrega pasos de Deshacer',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-nueva');const before=structuredClone(sheet.graphics),commits=s.commits;
  s.node('graphic-focus-canvas').getBoundingClientRect=()=>({left:0,top:0,width:390,height:650});
  s.click('graphic-open-full');s.click('graphic-focus-fit');
  const box=()=>s.node('graphic-focus-canvas').getAttribute('viewBox').split(' ').map(Number),start=box();
  const touch=(type,pointerId,x,y)=>s.pointer(type,{focus:true,pointerType:'touch',pointerId,x,y});
  touch('pointerdown',1,150,300);touch('pointerdown',2,200,300);touch('pointermove',1,125,300);touch('pointermove',2,225,300);
  assert.ok(Math.abs(box()[2]-start[2]/2)<1e-7);assert.equal(s.node('graphic-focus-zoom').textContent,'200%');
  assert.deepEqual(sheet.graphics,before);assert.equal(s.commits,commits);
  touch('pointerup',2,225,300);const pinned=box();touch('pointermove',1,125,350);touch('pointerup',1,125,350);
  assert.notEqual(box()[1],pinned[1]);assert.deepEqual(sheet.graphics,before);assert.equal(s.commits,commits);
  s.click('graphic-focus-close');assert.equal(s.node('graphic-focus-dialog').open,false);assert.deepEqual(sheet.graphics,before);
});

test('Símbolo cambia el tamaño con dos dedos sin cambiar el zoom y permite deshacer desde su menú',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-nueva');s.click('graphic-open-full');s.click('graphic-focus-symbol');
  const item=sheet.graphics.free[0],before={...item},view=s.node('graphic-focus-canvas').getAttribute('viewBox');
  const cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*GRAPH_FRAME.height;
  const touch=(type,pointerId,x,y,id)=>s.pointer(type,{focus:true,pointerType:'touch',pointerId,x,y,id});
  touch('pointerdown',1,cx-2,cy,item.id);touch('pointerdown',2,cx+2,cy);touch('pointermove',1,cx-3,cy);touch('pointermove',2,cx+3,cy);
  touch('pointerup',2,cx+3,cy);touch('pointerup',1,cx-3,cy);
  assert.ok(Math.abs(item.width-before.width*1.5)<1e-8);assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view);
  s.click('graphic-focus-undo');assert.deepEqual(sheet.graphics.free[0],before);
});

test('cancelar el zoom restaura toda la vista y libera ambos dedos sin modificar el inventario',()=>{
  const s=screen();s.add('bacheo');s.click('graphic-open-full');const before=structuredClone(s.inventory),view=s.node('graphic-focus-canvas').getAttribute('viewBox');
  s.pointer('pointerdown',{focus:true,pointerType:'touch',pointerId:1,x:100,y:200});s.pointer('pointerdown',{focus:true,pointerType:'touch',pointerId:2,x:150,y:200});
  s.pointer('pointermove',{focus:true,pointerType:'touch',pointerId:2,x:250,y:220});s.pointer('pointercancel',{focus:true,pointerType:'touch',pointerId:1});
  assert.equal(s.node('graphic-focus-canvas').getAttribute('viewBox'),view);assert.equal(s.node('graphic-focus-canvas').captures.size,0);assert.deepEqual(s.inventory,before);
});

test('en teléfono tocar la miniatura abre el editor y arrastrar sobre ella no modifica símbolos',()=>{
  const s=screen({phone:true});s.add('bacheo');const before=structuredClone(s.inventory.sheets[0].graphics),item=before.free[0];
  s.pointer('pointerdown',{id:item.id,x:20,y:200});s.pointer('pointermove',{id:item.id,x:50,y:240});s.pointer('pointerup',{id:item.id});
  assert.deepEqual(s.inventory.sheets[0].graphics,before);
  s.node('panel-graphics').events.click({preventDefault(){},target:{closest:()=>s.node('graphic-free-canvas')}});
  assert.equal(s.node('graphic-focus-dialog').open,true);assert.deepEqual(s.inventory.sheets[0].graphics,before);
});

test('el ancho de trabajo aprovecha el teléfono vertical y horizontal y el zoom tiene un límite estable',()=>{
  for(const [width,height]of [[390,700],[844,258]]) {
    const s=screen();s.node('graphic-focus-canvas').getBoundingClientRect=()=>({left:0,top:0,width,height});s.click('graphic-open-full');
    const view=s.node('graphic-focus-canvas').getAttribute('viewBox').split(' ').map(Number);
    assert.ok(Math.abs(view[2]-113.077)<1e-7);assert.ok(Math.abs(view[2]/view[3]-width/height)<1e-7);
    s.click('graphic-focus-fit');
    s.pointer('pointerdown',{focus:true,pointerType:'touch',pointerId:1,x:100,y:100});s.pointer('pointerdown',{focus:true,pointerType:'touch',pointerId:2,x:101,y:100});
    s.pointer('pointermove',{focus:true,pointerType:'touch',pointerId:2,x:10000,y:100});
    assert.equal(s.node('graphic-focus-zoom').textContent,'1600%');
    s.pointer('pointerup',{focus:true,pointerId:2});s.pointer('pointerup',{focus:true,pointerId:1});
    assert.equal(s.inventory.sheets[0].graphics.free.length,0);
  }
});

test('abrir el dibujo sin una selección centra el trabajo guardado para que no haya que buscarlo',()=>{
  const s=screen();s.add('bacheo');s.pointer('pointerdown',{x:0,y:0});s.pointer('pointerup',{x:0,y:0});
  s.node('graphic-focus-canvas').getBoundingClientRect=()=>({width:844,height:258,left:0,top:0});s.click('graphic-open-full');
  const item=s.inventory.sheets[0].graphics.free[0],center=(item.y+item.height/2)*GRAPH_FRAME.height;
  const view=s.node('graphic-focus-canvas').getAttribute('viewBox').split(' ').map(Number);
  assert.ok(center>=view[1]&&center<=view[1]+view[3]);
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
test('cancelar un arrastre restaura el dibujo y el teclado mueve y elimina la selección',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('tomas');const item=sheet.graphics.free[0],original={...item};
  s.pointer('pointerdown',{id:item.id,x:20,y:200});s.pointer('pointermove',{id:item.id,x:35,y:210});s.pointer('pointercancel',{id:item.id});assert.deepEqual(item,original);
  const svg=s.node('graphic-free-canvas'),key=key=>s.node('panel-graphics').events.keydown({key,shiftKey:false,preventDefault(){},target:{closest:()=>svg}});
  key('ArrowLeft');assert.ok(item.x<original.x);key('Delete');assert.equal(sheet.graphics.free.length,0);
});
test('los botones y el ángulo giran el dibujo, duplicar conserva el giro y Deshacer lo revierte',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('direccion-agua');
  s.click('graphic-rotate-left');assert.equal(sheet.graphics.free[0].rotation,345);
  s.click('graphic-rotate-right');assert.equal(sheet.graphics.free[0].rotation,0);
  s.node('graphic-angle').events.change({target:{value:'90'}});assert.equal(sheet.graphics.free[0].rotation,90);
  assert.match(s.node('graphic-free-canvas').innerHTML,/transform="rotate\(90 /);
  s.click('graphic-duplicate');assert.equal(sheet.graphics.free[1].rotation,90);
  s.click('graphic-rotation-reset');assert.equal(sheet.graphics.free[1].rotation,0);
  s.click('graphic-undo');assert.equal(sheet.graphics.free[1].rotation,90);
});
test('redimensionar una esquina girada sigue los ejes del símbolo y permite seguir moviéndolo',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');
  s.node('graphic-angle').events.change({target:{value:'90'}});const item=sheet.graphics.free[0],before={...item};
  s.pointer('pointerdown',{id:item.id,x:40,y:200,handle:'se'});s.pointer('pointermove',{id:item.id,x:37,y:203});s.pointer('pointerup',{id:item.id});
  assert.ok(item.width>before.width&&item.height>before.height);assert.equal(item.rotation,90);
  const moved={...item};s.pointer('pointerdown',{id:item.id,x:40,y:200});s.pointer('pointermove',{id:item.id,x:42,y:200});s.pointer('pointerup',{id:item.id});
  assert.ok(item.x>moved.x);assert.equal(item.rotation,90);
});
test('la flecha circular gira arrastrando alrededor del centro y permite deshacer en el editor',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-existente');
  function turn(item,stationId,height){
    const cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*height;
    s.pointer('pointerdown',{id:item.id,stationId,x:cx,y:cy-15,handle:'rotate'});
    s.pointer('pointermove',{id:item.id,stationId,x:cx+15,y:cy});s.pointer('pointerup',{id:item.id,stationId});
    assert.ok(Math.abs(item.rotation-90)<1e-7);assert.match(s.node('graphic-free-canvas').innerHTML,/data-handle="rotate"/);
  }
  turn(sheet.graphics.free[0],undefined,GRAPH_FRAME.height);s.click('graphic-undo');assert.equal(sheet.graphics.free[0].rotation,0);
});
test('cancelar el giro restaura el ángulo y el tamaño previos',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');const item=sheet.graphics.free[0],before={...item};
  const cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*GRAPH_FRAME.height;
  s.pointer('pointerdown',{id:item.id,x:cx,y:cy-15,handle:'rotate'});s.pointer('pointermove',{id:item.id,x:cx+15,y:cy});s.pointer('pointercancel',{id:item.id});assert.deepEqual(item,before);
});
test('dos dedos agrandan y achican proporcionalmente y un solo Deshacer revierte el gesto',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-nueva');
  const item=sheet.graphics.free[0],before={...item},cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*GRAPH_FRAME.height;
  const touch=(type,pointerId,x,y,id)=>s.pointer(type,{pointerType:'touch',pointerId,x,y,id});
  const commits=s.commits;
  touch('pointerdown',1,cx-2,cy,item.id);touch('pointerdown',2,cx+2,cy);
  touch('pointermove',1,cx-3,cy);touch('pointermove',2,cx+3,cy);
  assert.ok(Math.abs(item.width-before.width*1.5)<1e-8);assert.ok(Math.abs(item.height-before.height*1.5)<1e-8);
  assert.equal(s.commits,commits);
  touch('pointermove',1,cx-1.5,cy);touch('pointermove',2,cx+1.5,cy);
  assert.ok(Math.abs(item.width/before.width-.75)<1e-6);
  touch('pointerup',2,cx+1.5,cy);const pinned={...item};
  touch('pointermove',1,cx-.5,cy);assert.ok(Math.abs(item.x-pinned.x-1/GRAPH_FRAME.width)<1e-6);
  touch('pointerup',1,cx-.5,cy);assert.equal(s.commits,commits+1);
  s.click('graphic-undo');assert.deepEqual(sheet.graphics.free[0],before);
});
test('un dedo puede agarrar una línea fina aun si el evento alcanza el fondo y no el SVG del símbolo',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-existente');const item=sheet.graphics.free[0],before={...item};
  const x=(item.x+item.width/2)*GRAPH_FRAME.width,y=item.y*GRAPH_FRAME.height-2;
  s.pointer('pointerdown',{x,y,pointerType:'touch'});s.pointer('pointermove',{x:x+5,y:y+6,pointerType:'touch'});s.pointer('pointerup');
  assert.ok(Math.abs(item.x-before.x-5/GRAPH_FRAME.width)<1e-6);assert.ok(Math.abs(item.y-before.y-6/GRAPH_FRAME.height)<1e-6);
});
test('cancelar cualquiera de los dedos restaura el gesto completo y libera todas las capturas',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');const item=sheet.graphics.free[0],before={...item};
  s.pointer('pointerdown',{id:item.id,x:35,y:200,pointerType:'touch'});s.pointer('pointermove',{x:37,y:203,pointerType:'touch'});
  s.pointer('pointerdown',{pointerId:2,x:45,y:203,pointerType:'touch'});s.pointer('pointermove',{pointerId:2,x:50,y:203,pointerType:'touch'});
  s.pointer('pointercancel',{pointerId:2});assert.deepEqual(item,before);assert.equal(s.node('graphic-free-canvas').captures.size,0);
});
test('un pellizco grande mantiene proporciones y el contorno girado dentro del documento',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('bacheo');s.node('graphic-angle').events.change({target:{value:'35'}});
  const item=sheet.graphics.free[0],ratio=item.width/item.height,cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*GRAPH_FRAME.height;
  s.pointer('pointerdown',{id:item.id,x:cx-1,y:cy,pointerType:'touch'});s.pointer('pointerdown',{pointerId:2,x:cx+1,y:cy,pointerType:'touch'});
  s.pointer('pointermove',{pointerId:2,x:cx+999,y:cy,pointerType:'touch'});s.pointer('pointerup',{pointerId:2});s.pointer('pointerup');
  assert.ok(Math.abs(item.width/item.height-ratio)<1e-5);assert.equal(item.rotation,35);
  assert.doesNotThrow(()=>graphicPlacements(sheet));
});
test('la ruta ajustada mantiene el área de agarre al tener márgenes laterales y no se desplaza al abrir',()=>{
  const s=screen(),sheet=s.inventory.sheets[0];s.add('alcantarilla-existente');const item=sheet.graphics.free[0],before={...item};
  const svg=s.node('graphic-free-canvas');svg.getScreenCTM=()=>({a:2,b:0,inverse(){return {a:.5,d:.5};}});
  s.ui.activate();assert.equal(s.node('graphic-free-viewport').scrollTop,0);
  const x=(item.x+item.width/2)*GRAPH_FRAME.width*2,y=(item.y*GRAPH_FRAME.height-6)*2;
  s.pointer('pointerdown',{x,y,pointerType:'touch'});s.pointer('pointermove',{x:x+10,y,pointerType:'touch'});s.pointer('pointerup');
  assert.ok(Math.abs(item.x-before.x-5/GRAPH_FRAME.width)<1e-6);assert.equal(item.height,before.height);
});
test('una figura nueva queda en la parte visible de la página ampliada',()=>{
  const s=screen(),svg=s.node('graphic-free-canvas'),previous=Object.getOwnPropertyDescriptor(globalThis,'innerHeight');
  svg.getBoundingClientRect=()=>({top:-500,bottom:1500,height:2000,width:440});
  try {
    Object.defineProperty(globalThis,'innerHeight',{value:800,configurable:true});s.add('alcantarilla-existente');
    const item=s.inventory.sheets[0].graphics.free[0],centerOnScreen=-500+(item.y+item.height/2)*2000;
    assert.ok(centerOnScreen>=0&&centerOnScreen<=800,'El símbolo no requiere buscarlo fuera de la pantalla.');
    assert.ok(Math.abs(centerOnScreen-400)<.001);
  } finally {if(previous)Object.defineProperty(globalThis,'innerHeight',previous);else delete globalThis.innerHeight;}
});
test('arrastrar el fondo recorre la página completa y no mueve los símbolos ni otro recuadro',()=>{
  const s=screen(),page={scrollTop:100,scrollLeft:0};document.scrollingElement=page;
  const original=structuredClone(s.inventory.sheets[0].graphics),internalScroll=s.node('graphic-free-viewport').scrollTop;
  s.pointer('pointerdown',{x:0,y:200,pointerType:'touch'});s.pointer('pointermove',{x:0,y:100,pointerType:'touch'});s.pointer('pointerup');
  assert.equal(page.scrollTop,200);assert.equal(s.node('graphic-free-viewport').scrollTop,internalScroll);
  assert.deepEqual(s.inventory.sheets[0].graphics,original);assert.equal(s.commits,0);
});
