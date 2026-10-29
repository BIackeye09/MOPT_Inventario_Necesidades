// Un solo editor sobre las medidas originales del DPA-301.
import {SYMBOLS,GRAPH_FRAME,GRAPH_LIMIT,createGraphics,createGraphic,constrainGraphic,stretchGraphic,snapGraphic,symbolById,symbolUrl,stationFrame,fitGraphicView,constrainGraphicView,zoomGraphicView} from './graphics-model.js';
import {formatStation} from './stations.js';
import {sheetLabel} from './model.js';
import {createId} from './ids.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=value=>structuredClone(value);
const MAX_VIEW_ZOOM=16;
const phoneLayout=()=>Boolean(globalThis.matchMedia?.('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches);

export function setupGraphics({getInventory,commit,notify}) {
  let sheetId='',signature='',selected=null,drag=null;
  let full=null,viewDrag=null,snap=false;
  // El modo elegido es un bloqueo: ninguna herramienta lo cambia por su cuenta.
  const symbolsEnabled=()=>!full||full.interaction==='symbol';
  const histories=new Map();
  const activeSheet=()=>getInventory().sheets.find(s=>s.id===getInventory().activeSheetId);
  function state(){const sheet=activeSheet();return sheet.graphics??=(createGraphics());}
  const list=()=>state().free;
  const historyKey=()=>`${getInventory().id}:${activeSheet().id}`;
  const history=()=>{const key=historyKey();if(!histories.has(key))histories.set(key,[]);return histories.get(key);};
  function remember(items){const h=history();h.push(copy(items));if(h.length>30)h.shift();}
  const chosen=()=>list().find(item=>item.id===selected);
  function frame(){return {top:0,height:GRAPH_FRAME.height};}
  function point(event,svg){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  function controls() {
    const item=chosen();
    $('graphic-selected').textContent=item?symbolById(item.symbolId).label+(item.locked?' · Bloqueado':''):'Seleccioná un símbolo para moverlo, girarlo o cambiar su tamaño.';
    for(const id of ['graphic-smaller','graphic-larger','graphic-duplicate','graphic-delete','graphic-rotate-left','graphic-rotate-right','graphic-angle','graphic-rotation-reset','graphic-move-left','graphic-move-right','graphic-move-up','graphic-move-down'])$(id).disabled=!item||Boolean(item.locked);
    $('graphic-lock').disabled=!item;$('graphic-lock').textContent=item?.locked?'Desbloquear símbolo':'Bloquear símbolo';
    $('graphic-lock').setAttribute('aria-pressed',String(Boolean(item?.locked)));
    $('graphic-snap').checked=snap;
    $('graphic-angle').value=String(item?.rotation||0);
    $('graphic-undo').disabled=history().length===0;
    $('graphic-count').textContent=`${list().length} ${list().length===1?'símbolo':'símbolos'}`;
    focusControls();
  }
  function paint(svg) {
    const items=list(),height=GRAPH_FRAME.height;
    const background=`<image href="./symbols/carretera.png" x="0" y="0" width="${GRAPH_FRAME.width}" height="${height}" preserveAspectRatio="none" pointer-events="none"/>`;
    let labels='',guides='';
    {
      const boundaries=new Set();
      for(const station of activeSheet().stations||[]) {
        const row=stationFrame(activeSheet().stations||[],station.id);
        labels+=`<text x="-3" y="${row.top+row.height/2+1.5}" text-anchor="end" class="graphic-station-mark">${esc(formatStation(station.station))}</text>`;
        // Usa los mismos renglones de la plantilla, de abajo hacia arriba.
        // Se redondea a su precisión original para no repetir un límite compartido.
        boundaries.add(Number(row.top.toFixed(3)));
        boundaries.add(Number((row.top+row.height).toFixed(3)));
      }
      // Son ayudas visuales del editor: no capturan el dedo ni se exportan.
      if(boundaries.size)guides=`<g class="graphic-station-guides" aria-hidden="true" pointer-events="none">`+
        [...boundaries].sort((a,b)=>a-b).map(y=>`<line x1="-22" y1="${y}" x2="${GRAPH_FRAME.width}" y2="${y}" class="graphic-station-guide"/>`).join('')+'</g>';
    }
    const padding=12*unitsPerPixel(svg);
    const symbols=items.map(item=>{
      const x=item.x*GRAPH_FRAME.width,y=item.y*height,w=item.width*GRAPH_FRAME.width,h=item.height*height;
      const peek=item.id===selected&&(item.locked||isFocus(svg)&&full.interaction==='view')?`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="graphic-selection" pointer-events="none"/>`:'';
      return `<g data-graphic-id="${esc(item.id)}" class="graphic-symbol${item.locked?' is-locked':''}" transform="rotate(${item.rotation||0} ${x+w/2} ${y+h/2})"><rect x="${x-padding}" y="${y-padding}" width="${w+2*padding}" height="${h+2*padding}" fill="transparent"/><image href="${symbolUrl(item.symbolId)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" pointer-events="none" draggable="false"/>${peek}<title>${esc(symbolById(item.symbolId).label)} · ${item.rotation||0}°${item.locked?' · Bloqueado':''}</title></g>`;
    }).join('');
    const item=items.find(item=>item.id===selected&&!item.locked&&(!isFocus(svg)||full.interaction==='symbol'));let selection='';
    if(item) {
      const x=item.x*GRAPH_FRAME.width,y=item.y*height,w=item.width*GRAPH_FRAME.width,h=item.height*height;
      const unit=unitsPerPixel(svg),inFocus=isFocus(svg),handle=inFocus?8*unit:2.2,hit=Math.max(handle,(inFocus?24:12)*unit);
      selection=`<g data-graphic-id="${esc(item.id)}" transform="rotate(${item.rotation||0} ${x+w/2} ${y+h/2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" class="graphic-selection" pointer-events="none"/>`;
      const extentX=Math.max(w/2+24*unit,48*unit),extentY=Math.max(h/2+24*unit,48*unit);
      if(inFocus) {
        // Separar los controles de la figura deja libre el centro para moverla,
        // aun si la imagen es una línea muy fina. Cada zona de toque mide 44 px.
        for(const [name,a,b,edgeX,edgeY]of [['w',x+w/2-extentX,y+h/2,x,y+h/2],['e',x+w/2+extentX,y+h/2,x+w,y+h/2],['n',x+w/2,y+h/2-extentY,x+w/2,y],['s',x+w/2,y+h/2+extentY,x+w/2,y+h]]) {
          const horizontal=name==='w'||name==='e',u=unit,label=horizontal?'Cambiar largo':'Cambiar grosor';
          const arrow=horizontal?`M ${a-4*u} ${b} h ${8*u} m ${-6*u} ${-2*u} l ${-2*u} ${2*u} l ${2*u} ${2*u} m ${4*u} ${-4*u} l ${2*u} ${2*u} l ${-2*u} ${2*u}`:`M ${a} ${b-4*u} v ${8*u} m ${-2*u} ${-6*u} l ${2*u} ${-2*u} l ${2*u} ${2*u} m ${-4*u} ${4*u} l ${2*u} ${2*u} l ${2*u} ${-2*u}`;
          selection+=`<line x1="${edgeX}" y1="${edgeY}" x2="${a}" y2="${b}" class="graphic-axis-stem"/><circle cx="${a}" cy="${b}" r="${8*u}" class="graphic-axis-knob"/><path d="${arrow}" class="graphic-axis-arrow"/><circle cx="${a}" cy="${b}" r="${22*u}" data-handle="${name}" class="graphic-axis-hit ${name}" tabindex="0" role="button" aria-label="${label}: arrastrá este extremo o usá las flechas del teclado"/>`;
        }
      } else selection+= [['nw',x,y],['ne',x+w,y],['sw',x,y+h],['se',x+w,y+h]].map(([name,a,b])=>`<rect x="${a-hit/2}" y="${b-hit/2}" width="${hit}" height="${hit}" data-handle="${name}" class="graphic-handle-hit ${name}"/><rect x="${a-handle/2}" y="${b-handle/2}" width="${handle}" height="${handle}" class="graphic-handle ${name}"/>`).join('');
      selection+='</g>';
      // Giro circular separado de los tiradores de largo y grosor.
      const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=x+w/2,cy=y+h/2;
      const edgeX=cx+h/2*s,edgeY=cy-h/2*c;
      const gap=inFocus?30*unit:7,margin=inFocus?Math.min(6,22*unit):6,k=inFocus?12*unit/3.2:1;
      // El giro va en la esquina exterior para no tapar el control de grosor.
      const rx=inFocus?cx+extentX*c+extentY*s:clamp(edgeX+gap*s,margin,GRAPH_FRAME.width-margin);
      const ry=inFocus?cy+extentX*s-extentY*c:clamp(edgeY-gap*c,margin,height-margin);
      selection+=`<g data-graphic-id="${esc(item.id)}" class="graphic-rotation-control"><line x1="${edgeX}" y1="${edgeY}" x2="${rx}" y2="${ry}" class="graphic-rotation-stem" pointer-events="none"/><circle cx="${rx}" cy="${ry}" r="${3.2*k}" class="graphic-rotation-knob" pointer-events="none"/><path d="M ${rx+1.6*k} ${ry+.1*k} a ${1.6*k} ${1.6*k} 0 1 1 ${-.6*k} ${-1.35*k} m 0 ${-1.1*k} v ${1.3*k} h ${-1.3*k}" class="graphic-rotation-arrow" pointer-events="none"/><circle cx="${rx}" cy="${ry}" r="${inFocus?22*unit:6}" fill="transparent" data-handle="rotate" tabindex="0" role="button" aria-label="Girar símbolo: arrastrá la flecha circular o usá izquierda y derecha" class="graphic-rotation-hit"/></g>`;
    }
    svg.innerHTML=background+guides+labels+symbols+selection;
  }
  function paintAll() {
    paint($('graphic-free-canvas'));
    if(full)paint($('graphic-focus-canvas'));
    controls();
  }
  function selection(id){selected=id;paintAll();}
  function changed(before) {remember(before);signature='';commit();paintAll();}
  function add(symbolId,position) {
    if(!symbolsEnabled())return;
    if(list().length>=GRAPH_LIMIT){notify(`Esta hoja ya tiene ${GRAPH_LIMIT} símbolos.`);return;}
    const box=frame();
    let x=.5,y=.5;
    if(position){x=position.x/GRAPH_FRAME.width;y=position.y/box.height;}
    // Si la carretera ocupa más de una pantalla, se agrega en el tramo visible.
    else {
      const rect=$('graphic-free-canvas').getBoundingClientRect(),pageHeight=globalThis.innerHeight;
      if(Number.isFinite(rect.top)&&Number.isFinite(pageHeight)) {
        const top=Math.max(0,rect.top),bottom=Math.min(pageHeight,rect.bottom);
        y=bottom>top?clamp(((top+bottom)/2-rect.top)/rect.height,.02,.98):.02;
      }
    }
    const before=copy(list()),item=createGraphic(symbolId,{x,y});
    list().push(item);selected=item.id;changed(before);
  }
  function resize(factor) {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item||item.locked)return;
    const width=Math.min(1,item.width*factor),height=Math.min(1,item.height*factor),before=copy(list());
    Object.assign(item,constrainGraphic(item,{width,height,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2},frame().height));changed(before);
  }
  function stretch(axis,factor) {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item||item.locked)return;
    const before=copy(list()),next=stretchGraphic(item,axis,item[axis]*factor,frame().height);
    if(JSON.stringify(item)===JSON.stringify(next))return;
    Object.assign(item,next);changed(before);
  }
  // Controles alternativos al gesto táctil y a la flecha de giro.
  function rotate(value) {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item||item.locked)return;
    if(value===''||!Number.isFinite(Number(value))){controls();notify('Ingresá un ángulo en grados.');return;}
    const before=copy(list()),next=constrainGraphic(item,{rotation:Number(value)},frame().height);
    if(JSON.stringify(item)===JSON.stringify(next)){controls();return;}
    Object.assign(item,next);changed(before);
  }
  function duplicate() {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item||item.locked||list().length>=GRAPH_LIMIT)return;
    const before=copy(list()),next=constrainGraphic({...item,id:createId()},{x:item.x+.04,y:item.y+.015},frame().height);
    list().push(next);selected=next.id;changed(before);
  }
  function remove() {
    if(!symbolsEnabled())return;
    if(!chosen()||chosen().locked)return;const before=copy(list());state().free=list().filter(item=>item.id!==selected);selected=null;changed(before);
  }
  function nudge(dx,dy){
    const item=chosen();if(!symbolsEnabled()||!item||item.locked)return;
    const before=copy(list()),next=constrainGraphic(item,{x:item.x+dx/GRAPH_FRAME.width,y:item.y+dy/GRAPH_FRAME.height});
    if(JSON.stringify(item)===JSON.stringify(next))return;Object.assign(item,next);changed(before);
  }
  function toggleLock(){
    if(!symbolsEnabled())return;abortGesture();const item=chosen();if(!item)return;
    const before=copy(list());if(item.locked)delete item.locked;else item.locked=true;changed(before);
  }
  function unitsPerPixel(svg) {
    // La matriz mide el dibujo real, independiente del ancho de la página.
    const matrix=svg.getScreenCTM(),scale=matrix&&Math.hypot(matrix.a,matrix.b);
    if(scale>0)return 1/scale;
    const width=svg.getBoundingClientRect().width;
    return 113.077/(width||440);
  }
  function hitSymbol(p,svg) {
    const height=GRAPH_FRAME.height;
    const tolerance=16*unitsPerPixel(svg);
    let best=null,bestDistance=Infinity;
    // En cruces se escoge la figura más próxima al dedo; los empates siguen el orden visual.
    for(const item of [...list()].reverse()) {
      const w=item.width*GRAPH_FRAME.width,h=item.height*height,cx=(item.x+item.width/2)*GRAPH_FRAME.width,cy=(item.y+item.height/2)*height;
      const angle=-(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      const dx=p.x-cx,dy=p.y-cy,localX=dx*c-dy*s,localY=dx*s+dy*c;
      const distance=Math.hypot(Math.max(0,Math.abs(localX)-w/2),Math.max(0,Math.abs(localY)-h/2));
      if(distance<=tolerance&&distance<bestDistance){best=item;bestDistance=distance;}
    }
    return best;
  }
  const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  const isFocus=svg=>Boolean(full&&svg===$('graphic-focus-canvas'));
  function focusControls() {
    if(!full)return;
    const item=chosen(),editing=full.interaction==='symbol';
    $('graphic-focus-view-tools').hidden=editing;$('graphic-focus-symbol-tools').hidden=!editing;
    const precision=Boolean(full.precision&&editing&&item);
    $('graphic-focus-precision').hidden=!precision;$('graphic-focus-dialog').dataset.precision=String(precision);
    $('graphic-focus-precision-toggle').disabled=!editing||!item;
    $('graphic-focus-precision-toggle').setAttribute('aria-pressed',String(Boolean(full.precision)));
    $('graphic-focus-precision-toggle').textContent=full.precision?'Ocultar flechas del dibujo':'Mostrar flechas sobre el dibujo';
    $('graphic-focus-selected').textContent=!editing?'Símbolos bloqueados. Elegí «Símbolo» para editar.':item?symbolById(item.symbolId).label+(item.locked?' · Bloqueado':''):'Tocá un símbolo en el dibujo para seleccionarlo.';
    for(const id of ['graphic-focus-smaller','graphic-focus-larger','graphic-focus-longer','graphic-focus-shorter','graphic-focus-thicker','graphic-focus-thinner','graphic-focus-left','graphic-focus-right','graphic-focus-duplicate','graphic-focus-delete','graphic-focus-move-left','graphic-focus-move-right','graphic-focus-move-up','graphic-focus-move-down'])$(id).disabled=!editing||!item||Boolean(item.locked);
    $('graphic-focus-lock').disabled=!editing||!item;$('graphic-focus-lock').textContent=item?.locked?'Desbloquear símbolo':'Bloquear símbolo';
    $('graphic-focus-lock').setAttribute('aria-pressed',String(Boolean(item?.locked)));
    $('graphic-focus-snap').checked=snap;$('graphic-focus-snap').disabled=!editing;
    $('graphic-focus-undo').disabled=!editing||!history().length;
    $('graphic-focus-add').disabled=!editing;
    for(const id of ['graphic-focus-fit','graphic-focus-working','graphic-focus-zoom-in','graphic-focus-zoom-out'])$(id).disabled=editing;
    $('graphic-focus-view').setAttribute('aria-pressed',String(full.interaction==='view'));
    $('graphic-focus-symbol').setAttribute('aria-pressed',String(full.interaction==='symbol'));
    $('graphic-focus-hint').textContent=editing?(item?.locked?'Figura bloqueada. Desbloqueala en ☰ para editar.':'Laterales: largo. Arriba/abajo: grosor. Vista fija.'):'Solo vista: mover y zoom. Símbolos bloqueados.';
    $('graphic-focus-zoom').textContent=`${Math.round((full.base?.width/full.box?.width||1)*100)}%`;
  }
  function focusPanels(which) {
    $('graphic-focus-menu').hidden=which!=='tools';$('graphic-focus-palette').hidden=which!=='symbols';
    $('graphic-focus-menu-toggle').setAttribute('aria-expanded',String(which==='tools'));
  }
  function setFocusView(box) {
    if(!full)return;
    full.box=constrainGraphicView(box,full.bounds);
    $('graphic-focus-canvas').setAttribute('viewBox',`${full.box.x} ${full.box.y} ${full.box.width} ${full.box.height}`);
    paint($('graphic-focus-canvas'));focusControls();
  }
  function fitFocus(preset='keep',center) {
    if(!full)return;
    const svg=$('graphic-focus-canvas'),rect=svg.getBoundingClientRect(),row=frame();
    if(!row)return;
    const zoom=full.base&&full.box?full.base.width/full.box.width:1;
    center??=full.box?{x:full.box.x+full.box.width/2,y:full.box.y+full.box.height/2}:{x:GRAPH_FRAME.width/2,y:row.height/2};
    full.bounds={x:-23,y:-8,width:GRAPH_FRAME.width+23,height:GRAPH_FRAME.height+16};
    full.base=fitGraphicView(full.bounds,rect.width||390,rect.height||650);
    const factor=preset==='all'?1:preset==='working'?Math.max(1,full.base.width/full.bounds.width):zoom;
    setFocusView(zoomGraphicView({...full.base,x:center.x-full.base.width/2,y:center.y-full.base.height/2},clamp(factor,1,MAX_VIEW_ZOOM)));
  }
  function focusZoom(factor,anchor) {
    if(!full||full.interaction!=='view')return;
    const current=full.base.width/full.box.width,target=clamp(current*factor,1,MAX_VIEW_ZOOM);
    setFocusView(zoomGraphicView(full.box,target/current,anchor));
  }
  function changeFocusMode(value) {
    if(!full)return;
    abortGesture();abortView(true);full.interaction=value;focusPanels();paintAll();
  }
  function openFocus() {
    const interaction=full?.interaction||'view';
    abortGesture();abortView();
    full={sheetId:activeSheet().id,interaction};
    const svg=$('graphic-focus-canvas');
    focusPanels();
    if(!$('graphic-focus-dialog').open)$('graphic-focus-dialog').showModal();
    document.body.classList.add('graphic-editor-open');
    // Al volver a abrir se centra el último trabajo guardado.
    const item=chosen()||list().at(-1),last=activeSheet().stations?.at(-1);
    const lastRow=last&&stationFrame(activeSheet().stations,last.id);
    const center=item?{x:(item.x+item.width/2)*GRAPH_FRAME.width,y:(item.y+item.height/2)*GRAPH_FRAME.height}:
      {x:GRAPH_FRAME.width/2,y:lastRow?lastRow.top+lastRow.height/2:GRAPH_FRAME.height/2};
    // El diálogo llena la app sin disparar avisos nativos del navegador.
    fitFocus('working',center);svg.focus({preventScroll:true});
  }
  function closeFocus() {abortGesture();abortView();$('graphic-focus-dialog').close();}
  // La cámara usa coordenadas de pantalla durante todo el gesto. Así el zoom
  // no desplaza la referencia debajo de los dedos ni cambia medidas del símbolo.
  function rebaseView() {
    viewDrag.startBox=copy(full.box);viewDrag.startZoom=full.base.width/full.box.width;
    viewDrag.start=[...viewDrag.pointers.values()].map(copy);
  }
  function startView(event,svg) {
    if(!full||full.interaction!=='view')return;
    if(viewDrag) {
      if(viewDrag.pointers.size>=2)return;
      viewDrag.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});rebaseView();
    } else {
      viewDrag={svg,pointers:new Map([[event.pointerId,{x:event.clientX,y:event.clientY}]]),original:copy(full.box)};
      rebaseView();
    }
    focusPanels();svg.setPointerCapture(event.pointerId);event.preventDefault();
  }
  function moveView(event) {
    if(!viewDrag?.pointers.has(event.pointerId)||!full||full.interaction!=='view')return false;
    viewDrag.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    const points=[...viewDrag.pointers.values()],rect=viewDrag.svg.getBoundingClientRect(),width=rect.width||390,height=rect.height||650,base=viewDrag.startBox;
    let next;
    if(points.length===2) {
      const start=midpoint(...viewDrag.start),mid=midpoint(...points);
      const factor=clamp(distance(...points)/Math.max(1,distance(...viewDrag.start)),1/viewDrag.startZoom,MAX_VIEW_ZOOM/viewDrag.startZoom);
      const anchor={x:base.x+(start.x-(rect.left||0))/width*base.width,y:base.y+(start.y-(rect.top||0))/height*base.height};
      next=zoomGraphicView(base,factor,anchor);
      next.x-=(mid.x-start.x)/width*next.width;next.y-=(mid.y-start.y)/height*next.height;
    } else next={...base,x:base.x-(points[0].x-viewDrag.start[0].x)/width*base.width,y:base.y-(points[0].y-viewDrag.start[0].y)/height*base.height};
    setFocusView(next);event.preventDefault();return true;
  }
  function abortView(restore=false) {
    if(!viewDrag)return;const done=viewDrag;viewDrag=null;release(done);
    if(restore&&full)setFocusView(done.original);
  }
  function finishView(event,cancel=false) {
    if(!viewDrag?.pointers.has(event.pointerId))return false;
    if(cancel){abortView(true);return true;}
    moveView(event);const done=viewDrag;done.pointers.delete(event.pointerId);
    if(done.svg.hasPointerCapture(event.pointerId))done.svg.releasePointerCapture(event.pointerId);
    if(done.pointers.size){rebaseView();return true;}
    viewDrag=null;
    return true;
  }
  function undoGraphic() {
    if(!symbolsEnabled())return;
    abortGesture();const before=history().pop();
    if(before){state().free=before;selected=null;signature='';commit();paintAll();}
  }
  function rebaseGesture() {
    const points=[...drag.pointers.values()],item=chosen();if(!item)return;
    drag.item=copy(item);drag.start=points[0];
    drag.center={x:(item.x+item.width/2)*GRAPH_FRAME.width,y:(item.y+item.height/2)*drag.height};
    drag.startAngle=Math.atan2(points[0].y-drag.center.y,points[0].x-drag.center.x);
    if(points.length===2){drag.mid=midpoint(...points);drag.distance=Math.max(.001,distance(...points));drag.handle=null;}
  }
  function release(done) {
    for(const id of done.pointers.keys())if(done.svg.hasPointerCapture(id))done.svg.releasePointerCapture(id);
  }
  function abortGesture() {
    if(!drag)return;const done=drag;drag=null;release(done);
    if(done.kind!=='pan'){const item=list().find(i=>i.id===done.id),original=done.before.find(i=>i.id===done.id);if(item&&original)Object.assign(item,original);}
    paintAll();
  }
  function start(event) {
    if(event.button!==0)return;
    const svg=event.target.closest('svg[data-graphic-canvas]');if(!svg)return;
    // En teléfono, la miniatura abre el editor; no mezcla el scroll de la
    // página con un arrastre de símbolos antes de entrar a la pantalla de trabajo.
    if(!isFocus(svg)&&phoneLayout())return;
    if(isFocus(svg)&&full.interaction==='view'){startView(event,svg);return;}
    const p=point(event,svg);
    if(drag) {
      if(drag.svg!==svg||drag.kind==='pan'||drag.pointers.size>=2)return;
      drag.pointers.set(event.pointerId,p);svg.setPointerCapture(event.pointerId);rebaseGesture();event.preventDefault();return;
    }
    const group=event.target.closest('[data-graphic-id]');
    const handle=event.target.dataset.handle;
    const hit=handle&&group?list().find(i=>i.id===group.dataset.graphicId):hitSymbol(p,svg);
    // El hit del DOM sirve también al teclado, ratón y pruebas de eventos delegados.
    const item=hit||(group?list().find(i=>i.id===group.dataset.graphicId):null);
    if(!item) {
      selection(null);svg.focus({preventScroll:true});
      // En Símbolo el fondo no mueve la cámara, ni con uno ni con dos dedos.
      if(isFocus(svg)){event.preventDefault();return;}
      // El fondo recorre la página completa.
      const viewport=document.scrollingElement||$('graphic-free-viewport');
      drag={kind:'pan',svg,pointers:new Map([[event.pointerId,p]]),pointerId:event.pointerId,
        viewport,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      svg.setPointerCapture(event.pointerId);event.preventDefault();return;
    }
    selected=item.id;if(item.locked){paintAll();svg.focus({preventScroll:true});event.preventDefault();return;}const box=frame();
    drag={svg,height:box.height,pointers:new Map([[event.pointerId,p]]),before:copy(list()),id:item.id,
      handle};
    rebaseGesture();svg.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});paintAll();event.preventDefault();
  }
  function move(event) {
    if(moveView(event))return;
    if(!drag||!drag.pointers.has(event.pointerId))return;
    if(drag.kind==='pan') {
      drag.viewport.scrollLeft=drag.left+drag.x-event.clientX;drag.viewport.scrollTop=drag.top+drag.y-event.clientY;event.preventDefault();return;
    }
    const item=chosen();if(!item||item.locked)return;
    const p=point(event,drag.svg);drag.pointers.set(event.pointerId,p);
    const dx=(p.x-drag.start.x)/GRAPH_FRAME.width,dy=(p.y-drag.start.y)/drag.height,original=drag.item;
    let patch;
    if(drag.pointers.size===2) {
      const points=[...drag.pointers.values()],mid=midpoint(...points);
      const scale=clamp(distance(...points)/drag.distance,Math.max(.002/original.width,.0005/original.height),Math.min(1/original.width,1/original.height));
      const width=original.width*scale,height=original.height*scale;
      const cx=mid.x+(drag.center.x-drag.mid.x)*scale,cy=mid.y+(drag.center.y-drag.mid.y)*scale;
      patch={width,height,x:cx/GRAPH_FRAME.width-width/2,y:cy/drag.height-height/2};
    } else if(drag.handle==='rotate') {
      let rotation=(original.rotation||0)+(Math.atan2(p.y-drag.center.y,p.x-drag.center.x)-drag.startAngle)*180/Math.PI;
      if(event.shiftKey)rotation=Math.round(rotation/15)*15;else rotation=Math.round(rotation*10)/10;
      patch={rotation};
    } else if(['e','w','n','s'].includes(drag.handle)) {
      const angle=(original.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),horizontal=drag.handle==='e'||drag.handle==='w';
      const delta=horizontal?(dx*GRAPH_FRAME.width*c+dy*drag.height*s)/GRAPH_FRAME.width:(-dx*GRAPH_FRAME.width*s+dy*drag.height*c)/drag.height;
      const start=drag.handle==='w'||drag.handle==='n',axis=horizontal?'width':'height';
      patch=stretchGraphic(original,axis,original[axis]+(start?-delta:delta),drag.height,start?'end':'start');
    } else if(drag.handle) {
      const angle=(original.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      const localX=(dx*GRAPH_FRAME.width*c+dy*drag.height*s)/GRAPH_FRAME.width;
      const localY=(-dx*GRAPH_FRAME.width*s+dy*drag.height*c)/drag.height;
      const west=drag.handle.includes('w'),north=drag.handle.includes('n');
      const width=clamp(original.width+(west?-localX:localX),.002,1),height=clamp(original.height+(north?-localY:localY),.0005,1);
      const shiftX=(width-original.width)*GRAPH_FRAME.width*(west?-.5:.5),shiftY=(height-original.height)*drag.height*(north?-.5:.5);
      patch={width,height,x:original.x+(original.width-width)/2+(shiftX*c-shiftY*s)/GRAPH_FRAME.width,
        y:original.y+(original.height-height)/2+(shiftX*s+shiftY*c)/drag.height};
    } else patch={x:original.x+dx,y:original.y+dy};
    let next=constrainGraphic(original,patch,drag.height);
    if(snap&&!drag.handle&&drag.pointers.size===1)next=snapGraphic(next,activeSheet().stations||[],8*unitsPerPixel(drag.svg));
    Object.assign(item,next);
    paint(drag.svg);controls();event.preventDefault();
  }
  function finish(event,cancel=false) {
    if(finishView(event,cancel))return;
    if(!drag||!drag.pointers.has(event.pointerId))return;
    if(cancel){abortGesture();return;}
    move(event);
    // Al levantar un dedo del pellizco,
    // se toma una nueva referencia para seguir arrastrando sin saltos.
    const done=drag;done.pointers.delete(event.pointerId);
    if(done.svg.hasPointerCapture(event.pointerId))done.svg.releasePointerCapture(event.pointerId);
    if(done.pointers.size){rebaseGesture();return;}
    drag=null;
    if(done.kind!=='pan'&&JSON.stringify(list())!==JSON.stringify(done.before))changed(done.before);
  }
  function refresh() {
    const sheet=activeSheet();if(!sheet)return;
    const key=`${getInventory().id}:${sheet.id}`;
    if(sheetId!==key){if(drag){const previous=drag;drag=null;release(previous);}sheetId=key;selected=null;signature='';}
    state();
    if(full&&full.sheetId!==sheet.id)closeFocus();
    $('graphic-sheet').textContent=sheetLabel(getInventory());
    const next=JSON.stringify([sheet.id,sheet.graphics,sheet.stations]);
    if(next===signature){controls();return;}signature=next;
    if(!chosen())selected=null;
    paintAll();
  }
  function activate(){refresh();requestAnimationFrame(()=>{
    $('graphic-free-viewport').scrollTop=0;$('graphic-free-viewport').scrollLeft=0;paintAll();
  });}
  $('graphic-palette').innerHTML=SYMBOLS.map(s=>`<button type="button" class="graphic-palette-item" draggable="true" data-add-symbol="${s.id}" title="Agregar ${esc(s.label)}"><img src="${symbolUrl(s.id)}" alt="" draggable="false"><span>${esc(s.label)}</span></button>`).join('');
  $('graphic-palette').addEventListener('click',event=>{const button=event.target.closest('[data-add-symbol]');if(button)add(button.dataset.addSymbol);});
  $('graphic-palette').addEventListener('dragstart',event=>{const button=event.target.closest('[data-add-symbol]');if(button){event.dataTransfer.setData('text/plain',button.dataset.addSymbol);event.dataTransfer.effectAllowed='copy';}});
  const panel=$('panel-graphics');
  for(const root of [panel,$('graphic-focus-dialog')]) {
    root.addEventListener('dragstart',event=>{if(event.target.closest('svg[data-graphic-canvas]'))event.preventDefault();});
    root.addEventListener('lostpointercapture',event=>{if(drag?.pointers.has(event.pointerId))abortGesture();if(viewDrag?.pointers.has(event.pointerId))abortView(true);});
    root.addEventListener('pointerdown',start);root.addEventListener('pointermove',move);root.addEventListener('pointerup',event=>finish(event));root.addEventListener('pointercancel',event=>finish(event,true));
  }
  panel.addEventListener('dragover',event=>{if(event.target.closest('svg[data-graphic-canvas]'))event.preventDefault();});
  panel.addEventListener('click',event=>{const svg=event.target.closest('svg[data-graphic-canvas]');if(svg&&phoneLayout()){event.preventDefault();openFocus();}});
  panel.addEventListener('drop',event=>{const svg=event.target.closest('svg[data-graphic-canvas]'),id=event.dataTransfer.getData('text/plain');if(svg&&symbolById(id)){event.preventDefault();add(id,point(event,svg));}});
  function graphicKeys(event) {
    const svg=event.target.closest('svg[data-graphic-canvas]');if(!svg)return;
    if(!isFocus(svg)&&phoneLayout()&&['Enter',' '].includes(event.key)){event.preventDefault();openFocus();return;}
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
    if(isFocus(svg)&&full.interaction==='view') {
      if(direction){event.preventDefault();const unit=unitsPerPixel(svg);setFocusView({...full.box,x:full.box.x+direction[0]*20*unit,y:full.box.y+direction[1]*20*unit});}return;
    }
    if(!chosen()||chosen().locked)return;
    const handle=event.target.dataset?.handle;
    if(['e','w','n','s'].includes(handle)&&direction) {
      event.preventDefault();const axis=handle==='e'||handle==='w'?'width':'height';
      stretch(axis,(direction[0]+direction[1])>0?1.05:1/1.05);return;
    }
    if(event.target.dataset?.handle==='rotate'&&['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault();rotate((chosen().rotation||0)+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?15:1));return;
    }
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();remove();return;}
    if(direction){event.preventDefault();const item=chosen(),before=copy(list()),step=event.shiftKey?4:.5,box=frame();Object.assign(item,constrainGraphic(item,{x:item.x+direction[0]*step/GRAPH_FRAME.width,y:item.y+direction[1]*step/box.height},box.height));changed(before);}
  }
  panel.addEventListener('keydown',graphicKeys);$('graphic-focus-dialog').addEventListener('keydown',graphicKeys);
  $('graphic-smaller').addEventListener('click',()=>resize(.85));$('graphic-larger').addEventListener('click',()=>resize(1.15));
  $('graphic-rotate-left').addEventListener('click',()=>rotate((chosen()?.rotation||0)-15));
  $('graphic-rotate-right').addEventListener('click',()=>rotate((chosen()?.rotation||0)+15));
  $('graphic-angle').addEventListener('change',event=>rotate(event.target.value));
  $('graphic-angle').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();rotate(event.target.value);}});
  $('graphic-rotation-reset').addEventListener('click',()=>rotate(0));
  $('graphic-duplicate').addEventListener('click',duplicate);$('graphic-delete').addEventListener('click',remove);
  $('graphic-undo').addEventListener('click',undoGraphic);
  for(const prefix of ['graphic','graphic-focus']){
    $(prefix+'-lock').addEventListener('click',toggleLock);
    $(prefix+'-snap').addEventListener('change',event=>{if(prefix==='graphic-focus'&&!symbolsEnabled())return;snap=Boolean(event.target.checked);controls();});
    for(const [direction,dx,dy]of [['left',-1,0],['right',1,0],['up',0,-1],['down',0,1]])$(prefix+'-move-'+direction).addEventListener('click',()=>nudge(dx,dy));
  }
  $('graphic-open-full').addEventListener('click',()=>openFocus());$('graphic-focus-close').addEventListener('click',closeFocus);
  $('graphic-focus-view').addEventListener('click',()=>changeFocusMode('view'));$('graphic-focus-symbol').addEventListener('click',()=>changeFocusMode('symbol'));
  $('graphic-focus-add').addEventListener('click',()=>{if(full?.interaction==='symbol')focusPanels($('graphic-focus-palette').hidden?'symbols':undefined);});
  $('graphic-focus-menu-toggle').addEventListener('click',()=>focusPanels($('graphic-focus-menu').hidden?'tools':undefined));
  $('graphic-focus-menu-close').addEventListener('click',()=>focusPanels());$('graphic-focus-palette-close').addEventListener('click',()=>focusPanels());
  $('graphic-focus-fit').addEventListener('click',()=>{if(full?.interaction==='view'){fitFocus('all');focusPanels();}});
  $('graphic-focus-working').addEventListener('click',()=>{if(full?.interaction==='view'){fitFocus('working');focusPanels();}});
  $('graphic-focus-zoom-in').addEventListener('click',()=>focusZoom(1.4));$('graphic-focus-zoom-out').addEventListener('click',()=>focusZoom(1/1.4));
  $('graphic-focus-undo').addEventListener('click',undoGraphic);
  $('graphic-focus-precision-toggle').addEventListener('click',()=>{if(full?.interaction!=='symbol'||!chosen())return;full.precision=!full.precision;focusPanels();focusControls();});
  $('graphic-focus-precision-close').addEventListener('click',()=>{if(full){full.precision=false;focusControls();}});
  for(const [id,action]of [['graphic-focus-smaller',()=>resize(.85)],['graphic-focus-larger',()=>resize(1.15)],['graphic-focus-longer',()=>stretch('width',1.15)],['graphic-focus-shorter',()=>stretch('width',1/1.15)],['graphic-focus-thicker',()=>stretch('height',1.15)],['graphic-focus-thinner',()=>stretch('height',1/1.15)],['graphic-focus-left',()=>rotate((chosen()?.rotation||0)-15)],['graphic-focus-right',()=>rotate((chosen()?.rotation||0)+15)],['graphic-focus-duplicate',duplicate],['graphic-focus-delete',remove]]) {
    $(id).addEventListener('click',()=>{if(full?.interaction==='symbol')action();});
  }
  $('graphic-focus-symbols').innerHTML=SYMBOLS.map(s=>`<button type="button" data-focus-symbol="${s.id}"><img src="${symbolUrl(s.id)}" alt="" draggable="false"><span>${esc(s.label)}</span></button>`).join('');
  $('graphic-focus-symbols').addEventListener('click',event=>{
    const id=event.target.closest('[data-focus-symbol]')?.dataset.focusSymbol;if(full?.interaction!=='symbol'||!symbolById(id))return;
    focusPanels();add(id,{x:full.box.x+full.box.width/2,y:full.box.y+full.box.height/2});
  });
  $('graphic-focus-canvas').addEventListener('wheel',event=>{if(full){event.preventDefault();if(full.interaction==='view')focusZoom(Math.exp(-event.deltaY*.002),point(event,$('graphic-focus-canvas')));}},{passive:false});
  $('graphic-focus-canvas').addEventListener('dblclick',event=>{if(full){event.preventDefault();if(full.interaction==='view')focusZoom(1.8,point(event,$('graphic-focus-canvas')));}});
  $('graphic-focus-dialog').addEventListener('cancel',event=>{
    if(!$('graphic-focus-menu').hidden||!$('graphic-focus-palette').hidden){event.preventDefault();focusPanels();}else{abortGesture();abortView();}
  });
  $('graphic-focus-dialog').addEventListener('close',()=>{abortGesture();abortView();full=null;focusPanels();document.body.classList.remove('graphic-editor-open');$('tab-graphics').focus({preventScroll:true});});
  // Mantiene las zonas táctiles del mismo tamaño al girar o redimensionar la pantalla.
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(!drag)paint($('graphic-free-canvas'));}).observe($('graphic-free-viewport'));
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(full){abortGesture();abortView(true);fitFocus();}}).observe($('graphic-focus-canvas'));
  globalThis.addEventListener?.('pagehide',()=>{abortGesture();abortView();});
  refresh();return {refresh,activate};
}
