// Dos editores sobre las mismas medidas del DPA-301. Cada caso tiene su dibujo.
import {SYMBOLS,GRAPH_FRAME,GRAPH_LIMIT,MODES,createGraphics,createGraphic,constrainGraphic,symbolById,stationFrame} from './graphics-model.js';
import {formatStation} from './stations.js';
import {sheetLabel} from './model.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=value=>structuredClone(value);

export function setupGraphics({getInventory,commit,notify,selectStations}) {
  let sheetId='',signature='',selected=null,drag=null,pendingScroll=true,stationSignature='';
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
  }
  function paint(svg,stationId) {
    const box=frame(stationId);if(!box)return;
    const items=list().filter(item=>!stationId||item.stationId===stationId),height=box.height;
    const roadImage=`<image href="./symbols/carretera.png" x="0" y="${-box.top}" width="${GRAPH_FRAME.width}" height="${GRAPH_FRAME.height}" preserveAspectRatio="none" pointer-events="none"/>`;
    const clipId=`graphic-row-${(activeSheet().stations||[]).findIndex(s=>s.id===stationId)}`;
    const background=stationId?`<defs><clipPath id="${clipId}"><rect width="${GRAPH_FRAME.width}" height="${height}"/></clipPath></defs><g clip-path="url(#${clipId})">${roadImage}</g><rect width="${GRAPH_FRAME.width}" height="${height}" fill="none" stroke="#cbd7e5" stroke-width=".3" pointer-events="none"/>`:roadImage;
    let labels='';
    if(!stationId)for(const station of activeSheet().stations||[]) {
      const row=frame(station.id);
      labels+=`<text x="-3" y="${row.top+row.height/2+1.5}" text-anchor="end" class="graphic-station-mark">${esc(formatStation(station.station))}</text>`;
    }
    const symbols=items.map(item=>{
      const x=item.x*GRAPH_FRAME.width,y=item.y*height,w=item.width*GRAPH_FRAME.width,h=item.height*height;
      return `<g data-graphic-id="${esc(item.id)}" class="graphic-symbol" transform="rotate(${item.rotation||0} ${x+w/2} ${y+h/2})"><rect x="${x}" y="${y-Math.max(0,1.2-h/2)}" width="${w}" height="${Math.max(h,2.4)}" fill="transparent"/><image href="./symbols/${item.symbolId}.png" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="none"/><title>${esc(symbolById(item.symbolId).label)} · ${item.rotation||0}°</title></g>`;
    }).join('');
    const item=items.find(item=>item.id===selected);let selection='';
    if(item) {
      const x=item.x*GRAPH_FRAME.width,y=item.y*height,w=item.width*GRAPH_FRAME.width,h=item.height*height;
      const handle=stationId?1.5:2.2;
      selection=`<g data-graphic-id="${esc(item.id)}" transform="rotate(${item.rotation||0} ${x+w/2} ${y+h/2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" class="graphic-selection" pointer-events="none"/>`+
        [['nw',x,y],['ne',x+w,y],['sw',x,y+h],['se',x+w,y+h]].map(([name,a,b])=>`<rect x="${a-handle/2}" y="${b-handle/2}" width="${handle}" height="${handle}" data-handle="${name}" class="graphic-handle ${name}"/>`).join('')+'</g>';
      // El control circular queda dentro del lienzo, aun en un renglón pequeño.
      const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),cx=x+w/2,cy=y+h/2;
      const edgeX=cx+h/2*s,edgeY=cy-h/2*c;
      const rx=clamp(edgeX+7*s,6,GRAPH_FRAME.width-6),ry=clamp(edgeY-7*c,stationId?-6:6,stationId?height+6:height-6);
      selection+=`<g data-graphic-id="${esc(item.id)}" class="graphic-rotation-control"><line x1="${edgeX}" y1="${edgeY}" x2="${rx}" y2="${ry}" class="graphic-rotation-stem" pointer-events="none"/><circle cx="${rx}" cy="${ry}" r="3.2" class="graphic-rotation-knob" pointer-events="none"/><path d="M ${rx+1.6} ${ry+.1} a 1.6 1.6 0 1 1 -.6 -1.35 m 0 -1.1 v 1.3 h -1.3" class="graphic-rotation-arrow" pointer-events="none"/><circle cx="${rx}" cy="${ry}" r="6" fill="transparent" data-handle="rotate" tabindex="0" role="button" aria-label="Girar símbolo: arrastrá la flecha circular o usá izquierda y derecha" class="graphic-rotation-hit"/></g>`;
    }
    svg.innerHTML=background+labels+symbols+selection;
  }
  function paintAll() {
    paint($('graphic-free-canvas'));
    document.querySelectorAll('#station-graphic-list svg[data-graphic-canvas]').forEach(svg=>paint(svg,svg.dataset.stationId));
    controls();
  }
  function selection(id){selected=id;paintAll();}
  function changed(before) {remember(before);signature='';commit();}
  function add(symbolId,stationId,position) {
    if(list().length>=GRAPH_LIMIT){notify(`Este caso ya tiene ${GRAPH_LIMIT} símbolos.`);return;}
    const box=frame(stationId);if(!box)return;
    let x=.5,y=.5;
    if(position){x=position.x/GRAPH_FRAME.width;y=position.y/box.height;}
    else if(!stationId){const viewport=$('graphic-free-viewport'),svg=$('graphic-free-canvas');y=clamp((viewport.scrollTop+viewport.clientHeight/2)/svg.getBoundingClientRect().height,.02,.98);}
    const before=copy(list()),item=createGraphic(symbolId,{stationId,frameHeight:box.height,x,y});
    list().push(item);selected=item.id;changed(before);
  }
  function resize(factor) {
    const item=chosen();if(!item)return;
    const width=Math.min(1,item.width*factor),height=Math.min(1,item.height*factor),before=copy(list());
    Object.assign(item,constrainGraphic(item,{width,height,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2},frame(item.stationId).height));changed(before);
  }
  // Botones grandes y un ángulo numérico evitan depender de gestos con dos dedos.
  function rotate(value) {
    const item=chosen();if(!item)return;
    if(value===''||!Number.isFinite(Number(value))){controls();notify('Ingresá un ángulo en grados.');return;}
    const before=copy(list()),next=constrainGraphic(item,{rotation:Number(value)},frame(item.stationId).height);
    if(JSON.stringify(item)===JSON.stringify(next)){controls();return;}
    Object.assign(item,next);changed(before);
  }
  function duplicate() {
    const item=chosen();if(!item||list().length>=GRAPH_LIMIT)return;
    const before=copy(list()),next=constrainGraphic({...item,id:globalThis.crypto.randomUUID()},{x:item.x+.04,y:item.y+.015},frame(item.stationId).height);
    list().push(next);selected=next.id;changed(before);
  }
  function remove() {
    if(!chosen())return;const before=copy(list());state()[mode()]=list().filter(item=>item.id!==selected);selected=null;changed(before);
  }
  function start(event) {
    if(event.button!==0)return;
    const svg=event.target.closest('svg[data-graphic-canvas]');if(!svg)return;
    const group=event.target.closest('[data-graphic-id]');
    if(!group){selection(null);svg.focus();return;}
    selected=group.dataset.graphicId;const item=chosen();if(!item)return;
    const stationId=svg.dataset.stationId||undefined,box=frame(stationId);
    const start=point(event,svg),center={x:(item.x+item.width/2)*GRAPH_FRAME.width,y:(item.y+item.height/2)*box.height};
    drag={pointerId:event.pointerId,svg,stationId,height:box.height,start,center,startAngle:Math.atan2(start.y-center.y,start.x-center.x),item:copy(item),before:copy(list()),handle:event.target.dataset.handle,changed:false};
    svg.setPointerCapture(event.pointerId);svg.focus();paintAll();event.preventDefault();
  }
  function move(event) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    const item=chosen();if(!item)return;
    const p=point(event,drag.svg),dx=(p.x-drag.start.x)/GRAPH_FRAME.width,dy=(p.y-drag.start.y)/drag.height,original=drag.item;
    let patch;
    if(drag.handle==='rotate') {
      // Ángulo relativo al punto donde se agarró la flecha: evita saltos al tocarla.
      let rotation=(original.rotation||0)+(Math.atan2(p.y-drag.center.y,p.x-drag.center.x)-drag.startAngle)*180/Math.PI;
      if(event.shiftKey)rotation=Math.round(rotation/15)*15;
      else rotation=Math.round(rotation*10)/10;
      patch={rotation};
    } else if(drag.handle) {
      // Las esquinas giran con la imagen: el arrastre se transforma a sus ejes.
      const angle=(original.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      const localX=(dx*GRAPH_FRAME.width*c+dy*drag.height*s)/GRAPH_FRAME.width;
      const localY=(-dx*GRAPH_FRAME.width*s+dy*drag.height*c)/drag.height;
      const west=drag.handle.includes('w'),north=drag.handle.includes('n');
      const width=clamp(original.width+(west?-localX:localX),.002,1),height=clamp(original.height+(north?-localY:localY),.0005,1);
      const shiftX=(width-original.width)*GRAPH_FRAME.width*(west?-.5:.5),shiftY=(height-original.height)*drag.height*(north?-.5:.5);
      patch={width,height,x:original.x+(original.width-width)/2+(shiftX*c-shiftY*s)/GRAPH_FRAME.width,
        y:original.y+(original.height-height)/2+(shiftX*s+shiftY*c)/drag.height};
    } else patch={x:original.x+dx,y:original.y+dy};
    Object.assign(item,constrainGraphic(original,patch,drag.height));drag.changed=JSON.stringify(item)!==JSON.stringify(original);
    paint(drag.svg,drag.stationId);controls();event.preventDefault();
  }
  function finish(event,cancel=false) {
    if(!drag||event.pointerId!==drag.pointerId)return;
    const done=drag;drag=null;
    if(done.svg.hasPointerCapture(event.pointerId))done.svg.releasePointerCapture(event.pointerId);
    if(cancel){const item=chosen();if(item)Object.assign(item,done.item);paintAll();}
    else if(done.changed)changed(done.before);
  }
  function refresh() {
    const sheet=activeSheet();if(!sheet)return;
    if(sheetId!==sheet.id){sheetId=sheet.id;selected=null;signature='';pendingScroll=true;drag=null;}
    state();const stationKey=JSON.stringify((sheet.stations||[]).map(s=>s.id));
    if(stationKey!==stationSignature){stationSignature=stationKey;histories.delete(`${sheetId}:station`);}
    const next=JSON.stringify([sheet.id,sheet.graphics,sheet.stations]);
    $('graphic-sheet').textContent=sheetLabel(getInventory());
    $('graphic-export-case').textContent=`Vista previa, Excel y PDF usarán: ${MODES[mode()]}.`;
    $('graphic-free-panel').hidden=mode()!=='free';$('graphic-station-panel').hidden=mode()!=='station';
    for(const [id,value]of [['graphic-case-free','free'],['graphic-case-station','station']])$(id).setAttribute('aria-pressed',String(mode()===value));
    if(next===signature){controls();return;}signature=next;
    if(!chosen())selected=null;
    const options=SYMBOLS.map(s=>`<option value="${s.id}">${esc(s.label)}</option>`).join('');
    $('station-graphic-empty').hidden=(sheet.stations||[]).length>0;
    $('station-graphic-list').innerHTML=(sheet.stations||[]).map((station,index)=>({station,index})).reverse().map(({station,index})=>{
      const box=frame(station.id);
      return `<article class="station-graphic-row"><div class="station-graphic-detail"><h3>${esc(formatStation(station.station))}</h3><small>${index+1} desde abajo</small><p>${esc(station.observations)||'Sin observaciones'}</p><label for="symbol-${esc(station.id)}">Símbolo</label><select id="symbol-${esc(station.id)}" data-station-symbol="${esc(station.id)}">${options}</select><button type="button" class="button secondary" data-add-station-symbol="${esc(station.id)}">Agregar símbolo</button></div><div class="station-graphic-canvas"><svg data-graphic-canvas="station" data-station-id="${esc(station.id)}" tabindex="0" role="application" aria-label="Representación gráfica de la estación ${esc(formatStation(station.station))}" viewBox="0 -12 ${GRAPH_FRAME.width} ${box.height+24}"></svg></div></article>`;
    }).join('');
    paintAll();
  }
  function activate(){refresh();requestAnimationFrame(()=>{if(pendingScroll&&mode()==='free'){$('graphic-free-viewport').scrollTop=$('graphic-free-viewport').scrollHeight;pendingScroll=false;}});}
  $('graphic-palette').innerHTML=SYMBOLS.map(s=>`<button type="button" class="graphic-palette-item" draggable="true" data-add-symbol="${s.id}" title="Agregar ${esc(s.label)}"><img src="./symbols/${s.id}.png" alt="" draggable="false"><span>${esc(s.label)}</span></button>`).join('');
  $('graphic-palette').addEventListener('click',event=>{const button=event.target.closest('[data-add-symbol]');if(button)add(button.dataset.addSymbol);});
  $('graphic-palette').addEventListener('dragstart',event=>{const button=event.target.closest('[data-add-symbol]');if(button){event.dataTransfer.setData('text/plain',button.dataset.addSymbol);event.dataTransfer.effectAllowed='copy';}});
  const panel=$('panel-graphics');
  panel.addEventListener('pointerdown',start);panel.addEventListener('pointermove',move);panel.addEventListener('pointerup',event=>finish(event));panel.addEventListener('pointercancel',event=>finish(event,true));
  panel.addEventListener('dragover',event=>{if(event.target.closest('svg[data-graphic-canvas]'))event.preventDefault();});
  panel.addEventListener('drop',event=>{const svg=event.target.closest('svg[data-graphic-canvas]'),id=event.dataTransfer.getData('text/plain');if(svg&&symbolById(id)){event.preventDefault();add(id,svg.dataset.stationId||undefined,point(event,svg));}});
  panel.addEventListener('keydown',event=>{
    if(!event.target.closest('svg[data-graphic-canvas]')||!chosen())return;
    if(event.target.dataset?.handle==='rotate'&&['ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault();rotate((chosen().rotation||0)+(event.key==='ArrowLeft'?-1:1)*(event.shiftKey?15:1));return;
    }
    if(['Delete','Backspace'].includes(event.key)){event.preventDefault();remove();return;}
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];
    if(direction){event.preventDefault();const item=chosen(),before=copy(list()),step=event.shiftKey?4:.5,box=frame(item.stationId);Object.assign(item,constrainGraphic(item,{x:item.x+direction[0]*step/GRAPH_FRAME.width,y:item.y+direction[1]*step/box.height},box.height));changed(before);}
  });
  for(const [id,value]of [['graphic-case-free','free'],['graphic-case-station','station']])$(id).addEventListener('click',()=>{if(mode()!==value){state().activeMode=value;selected=null;signature='';commit();activate();}});
  $('station-graphic-list').addEventListener('click',event=>{const button=event.target.closest('[data-add-station-symbol]');if(button){const id=button.dataset.addStationSymbol;add(document.getElementById(`symbol-${id}`).value,id);}});
  $('graphic-go-stations').addEventListener('click',selectStations);
  $('graphic-smaller').addEventListener('click',()=>resize(.85));$('graphic-larger').addEventListener('click',()=>resize(1.15));
  $('graphic-rotate-left').addEventListener('click',()=>rotate((chosen()?.rotation||0)-15));
  $('graphic-rotate-right').addEventListener('click',()=>rotate((chosen()?.rotation||0)+15));
  $('graphic-angle').addEventListener('change',event=>rotate(event.target.value));
  $('graphic-angle').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();rotate(event.target.value);}});
  $('graphic-rotation-reset').addEventListener('click',()=>rotate(0));
  $('graphic-duplicate').addEventListener('click',duplicate);$('graphic-delete').addEventListener('click',remove);
  $('graphic-undo').addEventListener('click',()=>{const before=history().pop();if(before){state()[mode()]=before;selected=null;signature='';commit();}});
  $('graphic-zoom').addEventListener('input',event=>{const zoom=Number(event.target.value)/100;$('graphic-free-canvas').style.width=`${100*zoom}%`;$('graphic-free-canvas').style.maxWidth=`${440*zoom}px`;$('graphic-zoom-value').textContent=`${event.target.value}%`;});
  refresh();return {refresh,activate};
}
