// Dos editores sobre las mismas medidas del DPA-301. Cada caso tiene su dibujo.
import {SYMBOLS,GRAPH_FRAME,GRAPH_LIMIT,MODES,createGraphics,createGraphic,constrainGraphic,symbolById,symbolUrl,stationFrame,fitGraphicView,constrainGraphicView,zoomGraphicView} from './graphics-model.js';
import {formatStation} from './stations.js';
import {sheetLabel} from './model.js';
import {createId} from './ids.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=value=>structuredClone(value);
const MAX_VIEW_ZOOM=16;
const phoneLayout=()=>Boolean(globalThis.matchMedia?.('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches);

export function setupGraphics({getInventory,commit,notify,selectStations}) {
  let sheetId='',signature='',selected=null,drag=null,stationSignature='';
  let full=null,viewDrag=null;
  // El modo elegido es un bloqueo: ninguna herramienta lo cambia por su cuenta.
  const symbolsEnabled=()=>!full||full.interaction==='symbol';
  const histories=new Map();
  const activeSheet=()=>getInventory().sheets.find(s=>s.id===getInventory().activeSheetId);
  function state(){const sheet=activeSheet();return sheet.graphics??=(createGraphics());}
  const mode=()=>state().activeMode;
  const list=()=>state()[mode()];
  const historyKey=()=>`${activeSheet().id}:${mode()}`;
  const history=()=>{const key=historyKey();if(!histories.has(key))histories.set(key,[]);return histories.get(key);};
  function remember(items){const h=history();h.push(copy(items));if(h.length>30)h.shift();}
  const chosen=()=>list().find(item=>item.id===selected);
  function frame(stationId){return stationId?stationFrame(activeSheet().stations||[],stationId):{top:0,height:GRAPH_FRAME.height};}
  function point(event,svg){return new DOMPoint(event.clientX,event.clientY).matrixTransform(svg.getScreenCTM().inverse());}
  function controls() {
    const item=chosen();
    $('graphic-selected').textContent=item?symbolById(item.symbolId).label:'Seleccioná un símbolo para moverlo, girarlo o cambiar su tamaño.';
    for(const id of ['graphic-smaller','graphic-larger','graphic-duplicate','graphic-delete','graphic-rotate-left','graphic-rotate-right','graphic-angle','graphic-rotation-reset'])$(id).disabled=!item;
    $('graphic-angle').value=String(item?.rotation||0);
    $('graphic-undo').disabled=history().length===0;
    $('graphic-count').textContent=`${list().length} símbolos`;
    focusControls();
  }
  function paint(svg,stationId) {
    const box=frame(stationId);if(!box)return;
    const items=list().filter(item=>!stationId||item.stationId===stationId),height=box.height;
    const roadImage=`<image href="./symbols/carretera.png" x="0" y="${-box.top}" width="${GRAPH_FRAME.width}" height="${GRAPH_FRAME.height}" preserveAspectRatio="none" pointer-events="none"/>`;
    const clipId=`graphic-${svg.id||'row'}-${(activeSheet().stations||[]).findIndex(s=>s.id===stationId)}`;
    const background=stationId?`<defs><clipPath id="${clipId}"><rect width="${GRAPH_FRAME.width}" height="${height}"/></clipPath></defs><g clip-path="url(#${clipId})">${roadImage}</g><rect width="${GRAPH_FRAME.width}" height="${height}" fill="none" stroke="#cbd7e5" stroke-width=".3" pointer-events="none"/>`:roadImage;
    let labels='';
    if(!stationId)for(const station of activeSheet().stations||[]) {
      const row=frame(station.id);
      labels+=`<text x="-3" y="${row.top+row.height/2+1.5}" text-anchor="end" class="graphic-station-mark">${esc(formatStation(station.station))}</text>`;
    }
    const padding=12*unitsPerPixel(svg,stationId);
    const symbols=items.map(item=>{
      const x=item.x*GRAPH_FRAME.width,y=item.y*height,w=item.width*GRAPH_FRAME.width,h=item.height*height;
      const peek=isFocus(svg)&&full.interaction==='view'&&item.id===selected?`<rect x="${x}" y="${y}" width="${w}" height="${h}" class="graphic-selection" pointer-events="none"/>`:'';
      return `<g data-graphic-id="${esc(item.id)}" class="graphic-symbol" transform="rotate(${item.rotation||0} ${x+w/2} ${y+h/2})"><rect x="${x-padding}" y="${y-padding}" width="${w+2*padding}" height="${h+2*padding}" fill="transparent"/><image href="${symbolUrl(item.symbolId)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none" pointer-events="none" draggable="false"/>${peek}<title>${esc(symbolById(item.symbolId).label)} · ${item.rotation||0}°</title></g>`;
    }).join('');
    const item=items.find(item=>item.id===selected&&(!isFocus(svg)||full.interaction==='symbol'));let selection='';
    if(item) {
      const x=item.x*GRAPH_FRAME.width,y=item.y*height,w=item.width*GRAPH_FRAME.width,h=item.height*height;
      const unit=unitsPerPixel(svg,stationId),inFocus=isFocus(svg),handle=inFocus?8*unit:(stationId?1.5:2.2),hit=Math.max(handle,(inFocus?24:12)*unit);
      selection=`<g data-graphic-id="${esc(item.id)}" transform="rotate(${item.rotation||0} ${x+w/2} ${y+h/2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" class="graphic-selection" pointer-events="none"/>`+
        [['nw',x,y],['ne',x+w,y],['sw',x,y+h],['se',x+w,y+h]].map(([name,a,b])=>`<rect x="${a-hit/2}" y="${b-hit/2}" width="${hit}" height="${hit}" data-handle="${name}" class="graphic-handle-hit ${name}"/><rect x="${a-handle/2}" y="${b-handle/2}" width="${handle}" height="${handle}" class="graphic-handle ${name}"/>`).join('')+'</g>';
      // El control circular queda dentro del lienzo, aun en un renglón pequeño.
      const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=x+w/2,cy=y+h/2;
      const edgeX=cx+h/2*s,edgeY=cy-h/2*c;
      const gap=inFocus?30*unit:7,margin=inFocus?Math.min(6,22*unit):6,k=inFocus?12*unit/3.2:1;
      const rx=clamp(edgeX+gap*s,margin,GRAPH_FRAME.width-margin),ry=clamp(edgeY-gap*c,stationId?-margin:margin,stationId?height+margin:height-margin);
      selection+=`<g data-graphic-id="${esc(item.id)}" class="graphic-rotation-control"><line x1="${edgeX}" y1="${edgeY}" x2="${rx}" y2="${ry}" class="graphic-rotation-stem" pointer-events="none"/><circle cx="${rx}" cy="${ry}" r="${3.2*k}" class="graphic-rotation-knob" pointer-events="none"/><path d="M ${rx+1.6*k} ${ry+.1*k} a ${1.6*k} ${1.6*k} 0 1 1 ${-.6*k} ${-1.35*k} m 0 ${-1.1*k} v ${1.3*k} h ${-1.3*k}" class="graphic-rotation-arrow" pointer-events="none"/><circle cx="${rx}" cy="${ry}" r="${inFocus?22*unit:6}" fill="transparent" data-handle="rotate" tabindex="0" role="button" aria-label="Girar símbolo: arrastrá la flecha circular o usá izquierda y derecha" class="graphic-rotation-hit"/></g>`;
    }
    svg.innerHTML=background+labels+symbols+selection;
  }
  function paintAll() {
    paint($('graphic-free-canvas'));
    document.querySelectorAll('#station-graphic-list svg[data-graphic-canvas]').forEach(svg=>paint(svg,svg.dataset.stationId));
    if(full)paint($('graphic-focus-canvas'),full.stationId);
    controls();
  }
  function selection(id){selected=id;paintAll();}
  function changed(before) {remember(before);signature='';commit();paintAll();}
  function add(symbolId,stationId,position) {
    if(!symbolsEnabled())return;
    if(list().length>=GRAPH_LIMIT){notify(`Este caso ya tiene ${GRAPH_LIMIT} símbolos.`);return;}
    const box=frame(stationId);if(!box)return;
    let x=.5,y=.5;
    if(position){x=position.x/GRAPH_FRAME.width;y=position.y/box.height;}
    // Si la carretera ocupa más de una pantalla, se agrega en el tramo visible.
    else if(!stationId) {
      const rect=$('graphic-free-canvas').getBoundingClientRect(),pageHeight=globalThis.innerHeight;
      if(Number.isFinite(rect.top)&&Number.isFinite(pageHeight)) {
        const top=Math.max(0,rect.top),bottom=Math.min(pageHeight,rect.bottom);
        y=bottom>top?clamp(((top+bottom)/2-rect.top)/rect.height,.02,.98):.02;
      }
    }
    const before=copy(list()),item=createGraphic(symbolId,{stationId,frameHeight:box.height,x,y});
    list().push(item);selected=item.id;changed(before);
  }
  function resize(factor) {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item)return;
    const width=Math.min(1,item.width*factor),height=Math.min(1,item.height*factor),before=copy(list());
    Object.assign(item,constrainGraphic(item,{width,height,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2},frame(item.stationId).height));changed(before);
  }
  // Controles alternativos al gesto táctil y a la flecha de giro.
  function rotate(value) {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item)return;
    if(value===''||!Number.isFinite(Number(value))){controls();notify('Ingresá un ángulo en grados.');return;}
    const before=copy(list()),next=constrainGraphic(item,{rotation:Number(value)},frame(item.stationId).height);
    if(JSON.stringify(item)===JSON.stringify(next)){controls();return;}
    Object.assign(item,next);changed(before);
  }
  function duplicate() {
    if(!symbolsEnabled())return;
    const item=chosen();if(!item||list().length>=GRAPH_LIMIT)return;
    const before=copy(list()),next=constrainGraphic({...item,id:createId()},{x:item.x+.04,y:item.y+.015},frame(item.stationId).height);
    list().push(next);selected=next.id;changed(before);
  }
  function remove() {
    if(!symbolsEnabled())return;
    if(!chosen())return;const before=copy(list());state()[mode()]=list().filter(item=>item.id!==selected);selected=null;changed(before);
  }
  function unitsPerPixel(svg,stationId) {
    // La matriz mide el dibujo real, independiente del ancho de la página.
    const matrix=svg.getScreenCTM(),scale=matrix&&Math.hypot(matrix.a,matrix.b);
    if(scale>0)return 1/scale;
    const width=svg.getBoundingClientRect().width;
    return (stationId?GRAPH_FRAME.width:113.077)/(width||440);
  }
  function hitSymbol(p,svg,stationId) {
    const height=frame(stationId)?.height;if(!height)return null;
    const tolerance=16*unitsPerPixel(svg,stationId);
    let best=null,bestDistance=Infinity;
    // En cruces se escoge la figura más próxima al dedo; los empates siguen el orden visual.
    for(const item of [...list()].reverse()) {
      if(stationId&&item.stationId!==stationId)continue;
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
    $('graphic-focus-selected').textContent=!editing?'Símbolos bloqueados. Elegí «Símbolo» para editar.':item?symbolById(item.symbolId).label:'Tocá un símbolo en el dibujo para seleccionarlo.';
    for(const id of ['graphic-focus-smaller','graphic-focus-larger','graphic-focus-left','graphic-focus-right','graphic-focus-duplicate','graphic-focus-delete'])$(id).disabled=!editing||!item;
    $('graphic-focus-undo').disabled=!editing||!history().length;
    $('graphic-focus-add').disabled=!editing;
    for(const id of ['graphic-focus-fit','graphic-focus-working','graphic-focus-zoom-in','graphic-focus-zoom-out'])$(id).disabled=editing;
    $('graphic-focus-view').setAttribute('aria-pressed',String(full.interaction==='view'));
    $('graphic-focus-symbol').setAttribute('aria-pressed',String(full.interaction==='symbol'));
    $('graphic-focus-hint').textContent=editing?'Solo símbolo: mover, tamaño y giro. Vista fija.':'Solo vista: mover y zoom. Símbolos bloqueados.';
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
    paint($('graphic-focus-canvas'),full.stationId);focusControls();
  }
  function fitFocus(preset='keep',center) {
    if(!full)return;
    const svg=$('graphic-focus-canvas'),rect=svg.getBoundingClientRect(),row=frame(full.stationId);
    if(!row)return;
    const zoom=full.base&&full.box?full.base.width/full.box.width:1;
    center??=full.box?{x:full.box.x+full.box.width/2,y:full.box.y+full.box.height/2}:{x:GRAPH_FRAME.width/2,y:row.height/2};
    full.bounds=full.stationId?{x:-8,y:-10,width:GRAPH_FRAME.width+16,height:row.height+20}:{x:-23,y:-8,width:GRAPH_FRAME.width+23,height:GRAPH_FRAME.height+16};
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
  function openFocus(stationId) {
    stationId=mode()==='station'?(stationId||activeSheet().stations?.at(-1)?.id):undefined;
    if(mode()==='station'&&!stationId)return;
    const interaction=full?.interaction||'view';
    abortGesture();abortView();
    if(chosen()?.stationId!==stationId)selected=null;
    full={sheetId:activeSheet().id,mode:mode(),stationId,interaction};
    $('graphic-focus-dialog').dataset.mode=mode();
    const svg=$('graphic-focus-canvas');svg.dataset.graphicCanvas=mode();
    if(stationId)svg.dataset.stationId=stationId;else delete svg.dataset.stationId;
    $('graphic-focus-title').textContent=stationId?'Caso 2 · Estación':'Caso 1 · Carretera';
    $('graphic-focus-station').hidden=!stationId;
    $('graphic-focus-station').innerHTML=(activeSheet().stations||[]).map(s=>`<option value="${esc(s.id)}">${esc(formatStation(s.station))}</option>`).join('');
    $('graphic-focus-station').value=stationId||'';
    focusPanels();
    if(!$('graphic-focus-dialog').open)$('graphic-focus-dialog').showModal();
    document.body.classList.add('graphic-editor-open');
    // Al volver a abrir, se muestra el último símbolo de ese dibujo en lugar
    // de dejar el trabajo guardado fuera de la vista inicial.
    const item=chosen()||list().filter(i=>!stationId||i.stationId===stationId).at(-1),last=activeSheet().stations?.at(-1),lastRow=last&&frame(last.id);
    const center=item?{x:(item.x+item.width/2)*GRAPH_FRAME.width,y:(item.y+item.height/2)*frame(stationId).height}:
      {x:GRAPH_FRAME.width/2,y:stationId?frame(stationId).height/2:lastRow?lastRow.top+lastRow.height/2:GRAPH_FRAME.height/2};
    // El diálogo llena la app sin solicitar pantalla completa al navegador:
    // esa solicitud mostraba un aviso nativo encima del dibujo al entrar.
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
    if(before){state()[mode()]=before;selected=null;signature='';commit();paintAll();}
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
    const stationId=svg.dataset.stationId||undefined,group=event.target.closest('[data-graphic-id]');
    const handle=event.target.dataset.handle;
    const hit=handle&&group?list().find(i=>i.id===group.dataset.graphicId):hitSymbol(p,svg,stationId);
    // El hit del DOM sirve también al teclado, ratón y pruebas de eventos delegados.
    const item=hit||(group?list().find(i=>i.id===group.dataset.graphicId):null);
    if(!item) {
      selection(null);svg.focus({preventScroll:true});
      // En Símbolo el fondo no mueve la cámara, ni con uno ni con dos dedos.
      if(isFocus(svg)){event.preventDefault();return;}
      const rows=$('station-graphic-list');
      // El fondo desplaza la página completa, sin encerrar la ruta en otro scroll.
      const viewport=stationId?(rows.scrollHeight>rows.clientHeight+1?rows:(document.scrollingElement||rows)):(document.scrollingElement||$('graphic-free-viewport'));
      drag={kind:'pan',svg,pointers:new Map([[event.pointerId,p]]),pointerId:event.pointerId,
        viewport,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
      svg.setPointerCapture(event.pointerId);event.preventDefault();return;
    }
    selected=item.id;const box=frame(stationId);
    drag={svg,stationId,height:box.height,pointers:new Map([[event.pointerId,p]]),before:copy(list()),id:item.id,
      handle:event.pointerType==='touch'&&handle!=='rotate'?null:handle};
    rebaseGesture();svg.setPointerCapture(event.pointerId);svg.focus({preventScroll:true});paintAll();event.preventDefault();
  }
  function move(event) {
    if(moveView(event))return;
    if(!drag||!drag.pointers.has(event.pointerId))return;
    if(drag.kind==='pan') {
      drag.viewport.scrollLeft=drag.left+drag.x-event.clientX;drag.viewport.scrollTop=drag.top+drag.y-event.clientY;event.preventDefault();return;
    }
    const item=chosen();if(!item)return;
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
    Object.assign(item,constrainGraphic(original,patch,drag.height));
    paint(drag.svg,drag.stationId);controls();event.preventDefault();
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
    if(sheetId!==sheet.id){if(drag){const previous=drag;drag=null;release(previous);}sheetId=sheet.id;selected=null;signature='';}
    state();
    if(full&&(full.sheetId!==sheet.id||full.mode!==mode()||(full.stationId&&!frame(full.stationId))))closeFocus();
    const stationKey=JSON.stringify((sheet.stations||[]).map(s=>s.id));
    if(stationKey!==stationSignature){stationSignature=stationKey;histories.delete(`${sheetId}:station`);}
    const next=JSON.stringify([sheet.id,sheet.graphics,sheet.stations]);
    $('graphic-sheet').textContent=sheetLabel(getInventory());
    $('graphic-export-case').textContent=`Vista previa, Excel y PDF usarán: ${MODES[mode()]}.`;
    $('graphic-free-panel').hidden=mode()!=='free';$('graphic-station-panel').hidden=mode()!=='station';
    $('panel-graphics').setAttribute('data-graphic-mode',mode());
    for(const [id,value]of [['graphic-case-free','free'],['graphic-case-station','station']])$(id).setAttribute('aria-pressed',String(mode()===value));
    if(next===signature){controls();return;}signature=next;
    if(!chosen())selected=null;
    const options=SYMBOLS.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('');
    $('station-graphic-empty').hidden=(sheet.stations||[]).length>0;
    $('station-graphic-list').innerHTML=(sheet.stations||[]).map((station,index)=>({station,index})).reverse().map(({station,index})=>{
      const box=frame(station.id);
      return `<article class="station-graphic-row"><div class="station-graphic-detail"><h3>${esc(formatStation(station.station))}</h3><small>${index+1} desde abajo</small><p>${esc(station.observations)||'Sin observaciones'}</p><div class="station-inline-add"><label for="symbol-${esc(station.id)}">Símbolo</label><select id="symbol-${esc(station.id)}" data-station-symbol="${esc(station.id)}">${options}</select><button type="button" class="button secondary" data-add-station-symbol="${esc(station.id)}">Agregar símbolo</button></div><button type="button" class="button primary station-graphic-open" data-open-station-editor="${esc(station.id)}" aria-label="Editar dibujo de la estación ${esc(formatStation(station.station))}">Editar dibujo</button></div><div class="station-graphic-canvas"><svg data-graphic-canvas="station" data-station-id="${esc(station.id)}" tabindex="0" role="application" aria-label="Representación gráfica de la estación ${esc(formatStation(station.station))}" viewBox="0 -12 ${GRAPH_FRAME.width} ${box.height+24}"></svg></div></article>`;
    }).join('');
    paintAll();
  }
  function activate(){refresh();requestAnimationFrame(()=>{
    if(mode()==='free'){$('graphic-free-viewport').scrollTop=0;$('graphic-free-viewport').scrollLeft=0;paintAll();}
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
  panel.addEventListener('click',event=>{const svg=event.target.closest('svg[data-graphic-canvas]');if(svg&&phoneLayout()){event.preventDefault();openFocus(svg.dataset.stationId||undefined);}});
  panel.addEventListener('drop',event=>{const svg=event.target.closest('svg[data-graphic-canvas]'),id=event.dataTransfer.getData('text/plain');if(svg&&symbolById(id)){event.preventDefault();add(id,svg.dataset.stationId||undefined,point(event,svg));}});
  function graphicKeys(event) {
    const svg=event.target.closest('svg[data-graphic-canvas]');if(!svg)return;
    if(!isFocus(svg)&&phoneLayout()&&['Enter',' '].includes(event.key)){event.preventDefault();openFocus(svg.dataset.stationId||undefined);return;}
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
    if(isFocus(svg)&&full.interaction==='view') {
      if(direction){event.preventDefault();const unit=unitsPerPixel(svg,full.stationId);setFocusView({...full.box,x:full.box.x+direction[0]*20*unit,y:full.box.y+direction[1]*20*unit});}return;
    }
    if(!chosen())return;
    if(event.target.dataset?.handle==='rotate'&&['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault();rotate((chosen().rotation||0)+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?15:1));return;
    }
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();remove();return;}
    if(direction){event.preventDefault();const item=chosen(),before=copy(list()),step=event.shiftKey?4:.5,box=frame(item.stationId);Object.assign(item,constrainGraphic(item,{x:item.x+direction[0]*step/GRAPH_FRAME.width,y:item.y+direction[1]*step/box.height},box.height));changed(before);}
  }
  panel.addEventListener('keydown',graphicKeys);$('graphic-focus-dialog').addEventListener('keydown',graphicKeys);
  for(const [id,value]of [['graphic-case-free','free'],['graphic-case-station','station']])$(id).addEventListener('click',()=>{if(mode()!==value){abortGesture();state().activeMode=value;selected=null;signature='';commit();activate();}});
  $('station-graphic-list').addEventListener('click',event=>{
    const open=event.target.closest('[data-open-station-editor]');if(open?.dataset.openStationEditor){openFocus(open.dataset.openStationEditor);return;}
    const button=event.target.closest('[data-add-station-symbol]');if(button?.dataset.addStationSymbol){const id=button.dataset.addStationSymbol;add(document.getElementById(`symbol-${id}`).value,id);}
  });
  $('graphic-go-stations').addEventListener('click',selectStations);
  $('graphic-smaller').addEventListener('click',()=>resize(.85));$('graphic-larger').addEventListener('click',()=>resize(1.15));
  $('graphic-rotate-left').addEventListener('click',()=>rotate((chosen()?.rotation||0)-15));
  $('graphic-rotate-right').addEventListener('click',()=>rotate((chosen()?.rotation||0)+15));
  $('graphic-angle').addEventListener('change',event=>rotate(event.target.value));
  $('graphic-angle').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();rotate(event.target.value);}});
  $('graphic-rotation-reset').addEventListener('click',()=>rotate(0));
  $('graphic-duplicate').addEventListener('click',duplicate);$('graphic-delete').addEventListener('click',remove);
  $('graphic-undo').addEventListener('click',undoGraphic);
  $('graphic-open-full').addEventListener('click',()=>openFocus());$('graphic-focus-close').addEventListener('click',closeFocus);
  $('graphic-focus-view').addEventListener('click',()=>changeFocusMode('view'));$('graphic-focus-symbol').addEventListener('click',()=>changeFocusMode('symbol'));
  $('graphic-focus-add').addEventListener('click',()=>{if(full?.interaction==='symbol')focusPanels($('graphic-focus-palette').hidden?'symbols':undefined);});
  $('graphic-focus-menu-toggle').addEventListener('click',()=>focusPanels($('graphic-focus-menu').hidden?'tools':undefined));
  $('graphic-focus-menu-close').addEventListener('click',()=>focusPanels());$('graphic-focus-palette-close').addEventListener('click',()=>focusPanels());
  $('graphic-focus-fit').addEventListener('click',()=>{if(full?.interaction==='view'){fitFocus('all');focusPanels();}});
  $('graphic-focus-working').addEventListener('click',()=>{if(full?.interaction==='view'){fitFocus('working');focusPanels();}});
  $('graphic-focus-zoom-in').addEventListener('click',()=>focusZoom(1.4));$('graphic-focus-zoom-out').addEventListener('click',()=>focusZoom(1/1.4));
  $('graphic-focus-undo').addEventListener('click',undoGraphic);
  for(const [id,action]of [['graphic-focus-smaller',()=>resize(.85)],['graphic-focus-larger',()=>resize(1.15)],['graphic-focus-left',()=>rotate((chosen()?.rotation||0)-15)],['graphic-focus-right',()=>rotate((chosen()?.rotation||0)+15)],['graphic-focus-duplicate',duplicate],['graphic-focus-delete',remove]]) {
    $(id).addEventListener('click',()=>{if(full?.interaction==='symbol')action();});
  }
  $('graphic-focus-symbols').innerHTML=SYMBOLS.map(s=>`<button type="button" data-focus-symbol="${s.id}"><img src="${symbolUrl(s.id)}" alt="" draggable="false"><span>${esc(s.label)}</span></button>`).join('');
  $('graphic-focus-symbols').addEventListener('click',event=>{
    const id=event.target.closest('[data-focus-symbol]')?.dataset.focusSymbol;if(full?.interaction!=='symbol'||!symbolById(id))return;
    focusPanels();add(id,full.stationId,{x:full.box.x+full.box.width/2,y:full.box.y+full.box.height/2});
  });
  $('graphic-focus-station').addEventListener('change',event=>openFocus(event.target.value));
  $('graphic-focus-canvas').addEventListener('wheel',event=>{if(full){event.preventDefault();if(full.interaction==='view')focusZoom(Math.exp(-event.deltaY*.002),point(event,$('graphic-focus-canvas')));}},{passive:false});
  $('graphic-focus-canvas').addEventListener('dblclick',event=>{if(full){event.preventDefault();if(full.interaction==='view')focusZoom(1.8,point(event,$('graphic-focus-canvas')));}});
  $('graphic-focus-dialog').addEventListener('cancel',event=>{
    if(!$('graphic-focus-menu').hidden||!$('graphic-focus-palette').hidden){event.preventDefault();focusPanels();}else{abortGesture();abortView();}
  });
  $('graphic-focus-dialog').addEventListener('close',()=>{abortGesture();abortView();full=null;focusPanels();document.body.classList.remove('graphic-editor-open');$('tab-graphics').focus({preventScroll:true});});
  // Mantiene las zonas táctiles del mismo tamaño al girar o redimensionar la pantalla.
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(mode()==='free'&&!drag)paint($('graphic-free-canvas'));}).observe($('graphic-free-viewport'));
  if(globalThis.ResizeObserver)new ResizeObserver(()=>{if(full){abortGesture();abortView(true);fitFocus();}}).observe($('graphic-focus-canvas'));
  globalThis.addEventListener?.('pagehide',()=>{abortGesture();abortView();});
  refresh();return {refresh,activate};
}
