// Lápiz y borrador sobre una capa transparente; la plantilla queda debajo.
import {SKETCH_FRAME,SKETCH_LIMITS,createSketch,sketchPoint,renderSketch,drawSketchStroke} from './sketch-model.js';
import {sheetLabel} from './model.js';
import {backObservationLines} from './back-observations.js';
const $=id=>document.getElementById(id);
export function setupSketch({getInventory,commit,notify,confirmAction}) {
  const canvas=$('sketch-canvas'),context=canvas.getContext('2d'),cursor=$('sketch-cursor'),viewport=$('sketch-viewport');
  canvas.width=2160;canvas.height=Math.round(canvas.width*SKETCH_FRAME.height/SKETCH_FRAME.width);
  let sheetId='',signature='',tool='pen',draft=null,internal=false,limited=false;
  let paperMode='fill',paperWidth=0,paperHeight=0,previousViewport=null;
  const sizes={pen:3,eraser:24},histories=new Map();
  const sheet=()=>getInventory().sheets.find(s=>s.id===getInventory().activeSheetId);
  const state=()=>sheet().sketch??=createSketch();
  const history=()=>{const id=sheet().id;if(!histories.has(id))histories.set(id,{undo:[],redo:[]});return histories.get(id);};
  const count=()=>state().strokes.reduce((n,s)=>n+s.points.length,0);
  function paint(){renderSketch(context,state(),canvas.width,canvas.height);}
  function controls() {
    $('sketch-pencil').setAttribute('aria-pressed',String(tool==='pen'));
    $('sketch-eraser').setAttribute('aria-pressed',String(tool==='eraser'));
    $('sketch-pan').setAttribute('aria-pressed',String(tool==='pan'));
    $('sketch-size').min=tool==='eraser'?'4':'1';$('sketch-size').max=tool==='eraser'?'100':'24';$('sketch-size').value=String(sizes[tool]||sizes.pen);$('sketch-size').disabled=tool==='pan';
    $('sketch-size-value').textContent=tool==='pan'?'—':String(sizes[tool]);
    $('sketch-tool-status').textContent=tool==='pen'?'Lápiz negro: arrastrá para dibujar.':tool==='eraser'?'Borrador: arrastrá sobre la parte del trazo que querés quitar.':'Mover lienzo: arrastrá para recorrer el croquis ampliado.';
    $('sketch-undo').disabled=!history().undo.length;$('sketch-redo').disabled=!history().redo.length;
    $('sketch-clear').disabled=!state().strokes.length;
    $('sketch-count').textContent=`${state().strokes.length} trazos y pasadas de borrador`;
    canvas.dataset.tool=tool;cursor.hidden=true;
  }
  function save(action) {
    const h=history();h.undo.push(action);if(h.undo.length>30)h.undo.shift();h.redo=[];
    internal=true;try{commit();}finally{internal=false;}
    signature=JSON.stringify(state());paint();controls();
  }
  // Las herramientas flotan sobre el papel; nunca reservan una franja de pantalla.
  function menu(open) {
    if(open)flush();
    $('sketch-menu').hidden=!open;
    $('sketch-menu-toggle').setAttribute('aria-expanded',String(open));
    $('sketch-menu-toggle').textContent=open?'×':'☰';
    if(!open&&$('sketch-dialog').open)canvas.focus({preventScroll:true});
  }
  function selectTool(value){tool=value;controls();menu(false);}
  function point(event) {
    const box=canvas.getBoundingClientRect();
    return sketchPoint((event.clientX-box.left)/box.width,(event.clientY-box.top)/box.height);
  }
  function showCursor(event) {
    if(tool!=='eraser'){cursor.hidden=true;return;}
    const box=canvas.getBoundingClientRect(),[x,y]=point(event),size=sizes.eraser*box.width/1000;
    cursor.style.width=`${size}px`;cursor.style.height=`${size}px`;
    cursor.style.left=`${x*box.width}px`;cursor.style.top=`${y*box.height}px`;cursor.hidden=false;
  }
  function start(event) {
    if(event.button!==0||draft)return;
    menu(false);
    if(!context){notify('Este navegador no permite dibujar el croquis.');return;}
    if(tool==='pan'){
      draft={kind:'pan',pointerId:event.pointerId,sheetId:sheet().id,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});event.preventDefault();return;
    }
    if(state().strokes.length>=SKETCH_LIMITS.strokes||count()>=SKETCH_LIMITS.points){notify('El croquis está lleno. Deshacé o limpiá algunos trazos para continuar.');return;}
    if(tool==='eraser'&&!state().strokes.length)return;
    draft={pointerId:event.pointerId,sheetId:sheet().id,stroke:{tool,size:sizes[tool],points:[point(event)]},available:SKETCH_LIMITS.points-count()};limited=false;
    canvas.setPointerCapture(event.pointerId);canvas.focus({preventScroll:true});
    drawSketchStroke(context,draft.stroke,canvas.width,canvas.height);showCursor(event);event.preventDefault();
  }
  function move(event) {
    showCursor(event);
    if(!draft||event.pointerId!==draft.pointerId)return;
    if(draft.kind==='pan'){viewport.scrollLeft=draft.left+draft.x-event.clientX;viewport.scrollTop=draft.top+draft.y-event.clientY;event.preventDefault();return;}
    const points=draft.stroke.points,added=[];
    const samples=event.getCoalescedEvents?.();
    for(const sample of samples?.length?samples:[event]) {
      if(points.length>=Math.min(SKETCH_LIMITS.perStroke,draft.available)){limited=true;break;}
      const p=point(sample),last=points.at(-1);
      if(p[0]===last[0]&&p[1]===last[1])continue;
      added.push(p);points.push(p);
    }
    if(added.length)drawSketchStroke(context,{...draft.stroke,points:[points[points.length-added.length-1],...added]},canvas.width,canvas.height);
    event.preventDefault();
  }
  function finish(event,cancel=false) {
    if(!draft||event.pointerId!==draft.pointerId)return;
    if(!cancel)move(event);
    const done=draft;draft=null;
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(done.kind==='pan')return;
    if(done.sheetId!==sheet().id)return;
    if(cancel){paint();return;}
    state().strokes.push(done.stroke);save({type:'add',stroke:done.stroke});
    if(limited)notify('Se guardó el trazo. Soltá y volvé a dibujar para continuar.');
  }
  function flush() {
    if(!draft)return;
    const done=draft;draft=null;
    if(canvas.hasPointerCapture(done.pointerId))canvas.releasePointerCapture(done.pointerId);
    if(done.kind!=='pan'&&done.sheetId===sheet().id){state().strokes.push(done.stroke);save({type:'add',stroke:done.stroke});}
    cursor.hidden=true;
  }
  function observationStatus() {
    const status=$('back-observations-status');
    try {
      const lines=backObservationLines(sheet().backObservations);
      status.textContent=`${lines.length} de 8 renglones de la plantilla. Se incluyen en vista previa, Excel y PDF.`;
      status.classList.remove('has-errors');$('back-observations').removeAttribute('aria-invalid');
    } catch(error) {
      status.textContent=error.message;status.classList.add('has-errors');$('back-observations').setAttribute('aria-invalid','true');
    }
  }
  function fitPaper() {
    if(!$('sketch-dialog').open)return;
    const width=Math.max(1,viewport.clientWidth),height=Math.max(1,viewport.clientHeight),ratio=SKETCH_FRAME.width/SKETCH_FRAME.height;
    const center=previousViewport&&paperWidth?{x:(viewport.scrollLeft+previousViewport.width/2)/paperWidth,y:(viewport.scrollTop+previousViewport.height/2)/paperHeight}:{x:.5,y:.5};
    // Llenar la pantalla conserva la proporción del formulario. En una pantalla
    // distinta se recorre el papel con Mover lienzo, sin estirar los trazos.
    const base=paperMode==='fill'?Math.max(width,height*ratio):Math.min(width,height*ratio);
    paperWidth=base*Number($('sketch-zoom').value||100)/100;paperHeight=paperWidth/ratio;
    $('sketch-surface').style.width=`${paperWidth}px`;$('sketch-surface').style.height=`${paperHeight}px`;
    previousViewport={width,height};
    viewport.scrollLeft=Math.max(0,Math.min(paperWidth-width,center.x*paperWidth-width/2));
    viewport.scrollTop=Math.max(0,Math.min(paperHeight-height,center.y*paperHeight-height/2));
  }
  function viewPaper(mode) {
    flush();paperMode=mode;$('sketch-zoom').value='100';$('sketch-zoom-value').textContent='100%';fitPaper();menu(false);
  }
  function openScreen() {
    $('sketch-dialog').showModal();document.body.classList.add('drawing-open');
    menu(false);paperMode='fill';paperWidth=0;paperHeight=0;previousViewport=null;
    $('sketch-zoom').value='100';$('sketch-zoom-value').textContent='100%';
    // Se llena la ventana de la app sin disparar el aviso nativo del navegador.
    fitPaper();canvas.focus({preventScroll:true});
  }
  function closeScreen() {flush();$('sketch-dialog').close();}
  function undo() {
    if(draft)return;const h=history(),action=h.undo.pop();if(!action)return;
    if(action.type==='add')state().strokes.pop();else state().strokes=action.previous;
    h.redo.push(action);internal=true;try{commit();}finally{internal=false;}signature=JSON.stringify(state());paint();controls();
  }
  function redo() {
    if(draft)return;const h=history(),action=h.redo.pop();if(!action)return;
    if(action.type==='add')state().strokes.push(action.stroke);else state().strokes=[];
    h.undo.push(action);internal=true;try{commit();}finally{internal=false;}signature=JSON.stringify(state());paint();controls();
  }
  function refresh() {
    const active=sheet();if(!active)return;state();const next=JSON.stringify(active.sketch);
    if(sheetId!==active.id){if(draft&&canvas.hasPointerCapture(draft.pointerId))canvas.releasePointerCapture(draft.pointerId);draft=null;sheetId=active.id;signature='';cursor.hidden=true;}
    else if(next!==signature&&!internal)histories.delete(active.id);
    $('sketch-sheet').textContent=sheetLabel(getInventory());
    $('sketch-screen-sheet').textContent=sheetLabel(getInventory());
    if($('back-observations').value!==(active.backObservations||''))$('back-observations').value=active.backObservations||'';
    observationStatus();
    if(next!==signature){signature=next;paint();}controls();
  }
  canvas.addEventListener('pointerdown',start);canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',event=>finish(event));canvas.addEventListener('pointercancel',event=>finish(event,true));
  canvas.addEventListener('pointerleave',()=>{cursor.hidden=true;});
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  canvas.addEventListener('keydown',event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
    else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
    else if(event.key.toLowerCase()==='b')selectTool('pen');else if(event.key.toLowerCase()==='e')selectTool('eraser');else if(event.key.toLowerCase()==='h')selectTool('pan');
  });
  $('sketch-pencil').addEventListener('click',()=>selectTool('pen'));
  $('sketch-eraser').addEventListener('click',()=>selectTool('eraser'));
  $('sketch-pan').addEventListener('click',()=>selectTool('pan'));
  $('sketch-size').addEventListener('input',event=>{sizes[tool]=Number(event.target.value);controls();});
  $('sketch-undo').addEventListener('click',undo);$('sketch-redo').addEventListener('click',redo);
  $('sketch-clear').addEventListener('click',async()=>{
    const active=sheet();if(!state().strokes.length)return;
    if(await confirmAction('Limpiar el croquis','Se quitarán los trazos del croquis de esta hoja. Podés recuperarlos con Deshacer.','Limpiar croquis')) {
      if(sheet().id!==active.id)return;const previous=state().strokes;state().strokes=[];save({type:'clear',previous});
    }
  });
  $('sketch-zoom').addEventListener('input',event=>{fitPaper();$('sketch-zoom-value').textContent=`${event.target.value}%`;});
  $('sketch-menu-toggle').addEventListener('click',()=>menu($('sketch-menu').hidden));
  $('sketch-menu-close').addEventListener('click',()=>menu(false));
  $('sketch-fit').addEventListener('click',()=>viewPaper('fit'));$('sketch-fill').addEventListener('click',()=>viewPaper('fill'));
  $('open-sketch').addEventListener('click',openScreen);$('close-sketch').addEventListener('click',closeScreen);
  $('sketch-dialog').addEventListener('cancel',event=>{if(!$('sketch-menu').hidden){event.preventDefault();menu(false);}else flush();});
  $('sketch-dialog').addEventListener('close',()=>{flush();menu(false);document.body.classList.remove('drawing-open');$('open-sketch').focus({preventScroll:true});});
  document.addEventListener?.('fullscreenchange',fitPaper);
  if(globalThis.ResizeObserver)new ResizeObserver(fitPaper).observe(viewport);
  globalThis.addEventListener?.('resize',fitPaper);
  globalThis.addEventListener?.('pagehide',flush);
  $('back-observations').addEventListener('input',event=>{sheet().backObservations=event.target.value;commit();});
  refresh();return {refresh,activate:refresh};
}
