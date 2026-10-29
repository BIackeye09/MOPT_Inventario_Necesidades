// Coordenadas compartidas por el editor único y por las exportaciones.
import {SYMBOLS} from './symbol-catalog.js';
import {createId} from './ids.js';
import {sortStations} from './stations.js';
export {SYMBOLS};
export const GRAPH_FRAME=Object.freeze({left:91.165,top:312.646,width:90.077,height:440.922});
// Bordes de la calzada medidos en la plantilla, usados solo como guías opcionales.
export const GRAPH_ROAD_BOUNDS=Object.freeze({left:20.989,right:68.653});
export const GRAPH_ROW_BOUNDS=Object.freeze([312.646,330.341,348.035,365.729,383.424,401.118,418.813,436.507,
  454.202,471.896,489.590,507.285,524.979,542.674,560.368,578.062,595.757,613.451,
  631.146,645.863,661.250,676.636,692.023,707.409,722.796,738.182,753.568]);
export const GRAPH_LIMIT=200;
export const symbolById=id=>SYMBOLS.find(s=>s.id===id);
const symbolUrls=new Map();
export function symbolUrl(id) {
  if(symbolUrls.has(id))return symbolUrls.get(id);
  const symbol=symbolById(id);if(!symbol)throw new Error('El símbolo no pertenece a la plantilla.');
  // Se recuperan los bytes originales incluidos en el catálogo. Una URL corta
  // evita repetir el Base64 en cada repintado durante el arrastre de símbolos.
  const bytes=Uint8Array.from(atob(symbol.pngBase64),c=>c.charCodeAt(0));
  const url=new URL(URL.createObjectURL(new Blob([bytes],{type:'image/png'})));
  symbolUrls.set(id,url);return url;
}
export const graphicAssetKey=item=>item.rotation?`${item.symbolId}@${item.rotation}:${item.width.toFixed(5)}:${item.height.toFixed(5)}`:item.symbolId;
export const createGraphics=()=>({free:[]});
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=value=>Math.round(value*1e8)/1e8;
// La cámara del editor usa las mismas coordenadas del documento. Su zoom y
// desplazamiento nunca forman parte de los datos guardados ni de la exportación.
export function fitGraphicView(bounds,width,height) {
  const ratio=Math.max(1,width)/Math.max(1,height),w=Math.max(bounds.width,bounds.height*ratio),h=w/ratio;
  return {x:bounds.x+(bounds.width-w)/2,y:bounds.y+(bounds.height-h)/2,width:w,height:h};
}
export function constrainGraphicView(view,bounds) {
  const x=view.width>=bounds.width?bounds.x+(bounds.width-view.width)/2:clamp(view.x,bounds.x,bounds.x+bounds.width-view.width);
  const y=view.height>=bounds.height?bounds.y+(bounds.height-view.height)/2:clamp(view.y,bounds.y,bounds.y+bounds.height-view.height);
  return {...view,x,y};
}
export function zoomGraphicView(view,factor,anchor={x:view.x+view.width/2,y:view.y+view.height/2}) {
  const width=view.width/factor,height=view.height/factor;
  return {x:anchor.x-(anchor.x-view.x)/factor,y:anchor.y-(anchor.y-view.y)/factor,width,height};
}
export const normalizeRotation=value=>round(((value%360)+360)%360);
// La rotación usa puntos reales; también valida las escalas de borradores antiguos.
export function graphicBounds(item,frameHeight=GRAPH_FRAME.height) {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const width=item.width*c+item.height*frameHeight/GRAPH_FRAME.width*s;
  const height=item.height*c+item.width*GRAPH_FRAME.width/frameHeight*s;
  return {x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2,width,height};
}
export function constrainGraphic(item,patch={},frameHeight=GRAPH_FRAME.height) {
  const next={...item,...patch};
  next.width=round(clamp(next.width,.002,1));next.height=round(clamp(next.height,.0005,1));
  next.rotation=normalizeRotation(next.rotation||0);
  const centerX=next.x+next.width/2,centerY=next.y+next.height/2,bounds=graphicBounds(next,frameHeight);
  // PDF y Excel reciben el contorno ya girado. El rectángulo sin girar puede
  // quedar fuera: limitarlo también reservaba espacio invisible junto a los bordes.
  const extentX=bounds.width,extentY=bounds.height;
  const scale=Math.min(1,1/extentX,1/extentY);
  next.width*=scale;next.height*=scale;
  next.x=clamp(centerX,extentX*scale/2,1-extentX*scale/2)-next.width/2;
  next.y=clamp(centerY,extentY*scale/2,1-extentY*scale/2)-next.height/2;
  for(const key of ['x','y','width','height'])next[key]=round(next[key]);
  return next;
}
// Estira un solo eje local del símbolo. El otro conserva exactamente su medida,
// también al girar o llegar al límite del recuadro del documento.
export function stretchGraphic(item,axis,value,frameHeight=GRAPH_FRAME.height,anchor='center') {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),ac=Math.abs(c),as=Math.abs(s);
  let maximum=1;
  if(axis==='width') {
    if(ac>1e-10)maximum=Math.min(maximum,(1-item.height*frameHeight/GRAPH_FRAME.width*as)/ac);
    if(as>1e-10)maximum=Math.min(maximum,(1-item.height*ac)*frameHeight/GRAPH_FRAME.width/as);
  } else if(axis==='height') {
    if(as>1e-10)maximum=Math.min(maximum,(1-item.width*ac)*GRAPH_FRAME.width/frameHeight/as);
    if(ac>1e-10)maximum=Math.min(maximum,(1-item.width*GRAPH_FRAME.width/frameHeight*as)/ac);
  } else throw new Error('El eje del símbolo no es válido.');
  const minimum=axis==='width'?.002:.0005,size=clamp(value,minimum,Math.max(minimum,maximum));
  const width=axis==='width'?size:item.width,height=axis==='height'?size:item.height;
  // El menú conserva el centro; cada tirador conserva el extremo opuesto.
  const direction=anchor==='start'?.5:anchor==='end'?-.5:0;
  const delta=(size-item[axis])*(axis==='width'?GRAPH_FRAME.width:frameHeight)*direction;
  return constrainGraphic(item,{width,height,
    x:item.x+(item.width-width)/2+delta*(axis==='width'?c:-s)/GRAPH_FRAME.width,
    y:item.y+(item.height-height)/2+delta*(axis==='width'?s:c)/frameHeight},frameHeight);
}
export function createGraphic(symbolId,{frameHeight=GRAPH_FRAME.height,x=.5,y=.5}={}) {
  const symbol=symbolById(symbolId);if(!symbol)throw new Error('El símbolo no pertenece a la plantilla.');
  let width=22,height=width*symbol.height/symbol.width;
  if(height>frameHeight*.7){height=frameHeight*.7;width=height*symbol.width/symbol.height;}
  return constrainGraphic({id:createId(),symbolId,
    x:x-width/GRAPH_FRAME.width/2,y:y-height/frameHeight/2,
    width:width/GRAPH_FRAME.width,height:height/frameHeight,rotation:0},{},frameHeight);
}
// La versión final solo guarda el dibujo de la carretera completa. La lectura
// antigua está aislada aquí; el editor y las descargas no eligen entre casos.
export function restoreGraphics(input,stations=[]) {
  if(input===undefined)return createGraphics();
  if(!input||typeof input!=='object')throw new Error('El dibujo guardado no es válido.');
  function read(items,heightFor=()=>GRAPH_FRAME.height) {
    if(!Array.isArray(items)||items.length>GRAPH_LIMIT)throw new Error(`Cada hoja admite hasta ${GRAPH_LIMIT} símbolos.`);
    const result=items.map(item=>{
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>120||!symbolById(item.symbolId))throw new Error('Hay un símbolo desconocido en el respaldo.');
      for(const key of ['x','y','width','height'])if(typeof item[key]!=='number'||!Number.isFinite(item[key]))throw new Error('La posición o el tamaño de un símbolo no es válido.');
      const rotation=item.rotation===undefined?0:item.rotation;
      if(typeof rotation!=='number'||!Number.isFinite(rotation)||rotation<0||rotation>=360)throw new Error('El ángulo de un símbolo no es válido.');
      if(item.width<=0||item.height<=0||item.width>1.0000001||item.height>1.0000001)throw new Error('El tamaño de un símbolo no es válido.');
      const box=graphicBounds({...item,rotation},heightFor(item));
      if(box.x<-.0000001||box.y<-.0000001||box.x+box.width>1.0000001||box.y+box.height>1.0000001)throw new Error('Un símbolo queda fuera de su recuadro.');
      if(item.locked!==undefined&&typeof item.locked!=='boolean')throw new Error('El bloqueo de un símbolo no es válido.');
      return {id:item.id,symbolId:item.symbolId,x:item.x,y:item.y,width:item.width,height:item.height,rotation,...(item.locked?{locked:true}:{})};
    });
    if(new Set(result.map(i=>i.id)).size!==result.length)throw new Error('Hay símbolos con identificadores repetidos.');
    return result;
  }
  const free=read(input.free);
  // El trabajo del editor libre tiene prioridad y no se mezcla con el anterior.
  if(free.length||input.station===undefined)return {free};
  const legacy=read(input.station,item=>{
    const row=stationFrame(stations,item.stationId);
    if(!row)throw new Error('Un símbolo anterior corresponde a una estación que no existe.');
    return row.height;
  });
  const ordered=sortStations(stations);
  return {free:legacy.map((item,index)=>{
    const id=input.station[index].stationId,before=stationFrame(stations,id),row=stationFrame(ordered,id);
    if(Math.abs(before.height-row.height)>1e-6)item=constrainGraphic(item,{},row.height);
    // Se conservan puntos, escala y giro; solo se cambia el sistema de coordenadas.
    return {...item,y:(row.top+item.y*row.height)/GRAPH_FRAME.height,height:item.height*row.height/GRAPH_FRAME.height};
  })};
}
export function stationFrame(stations,stationId) {
  const index=stations.findIndex(s=>s.id===stationId);if(index<0)return null;
  const row=25-index,top=GRAPH_ROW_BOUNDS[row]-GRAPH_FRAME.top;
  return {top,height:GRAPH_ROW_BOUNDS[row+1]-GRAPH_ROW_BOUNDS[row]};
}
export function snapGraphic(item,stations=[],tolerance=3) {
  if(item.locked)return {...item};
  const box=graphicBounds(item),x=box.x*GRAPH_FRAME.width,y=box.y*GRAPH_FRAME.height,
    width=box.width*GRAPH_FRAME.width,height=box.height*GRAPH_FRAME.height;
  const vertical=[0,GRAPH_ROAD_BOUNDS.left,GRAPH_ROAD_BOUNDS.right,GRAPH_FRAME.width];
  const horizontal=[0,GRAPH_FRAME.height];
  for(const station of stations){const row=stationFrame(stations,station.id);horizontal.push(row.top,row.top+row.height);}
  const nearest=(edges,guides)=>{let delta=0,distance=Math.max(0,tolerance);for(const edge of edges)for(const guide of guides){const next=guide-edge;if(Math.abs(next)<distance){distance=Math.abs(next);delta=next;}}return delta;};
  return constrainGraphic(item,{x:item.x+nearest([x,x+width],vertical)/GRAPH_FRAME.width,
    y:item.y+nearest([y,y+height],horizontal)/GRAPH_FRAME.height});
}
export function graphicPlacements(sheet={}) {
  return restoreGraphics(sheet.graphics,sheet.stations||[]).free.map(item=>({
    id:item.id,symbolId:item.symbolId,x:item.x*GRAPH_FRAME.width,y:item.y*GRAPH_FRAME.height,
    width:item.width*GRAPH_FRAME.width,height:item.height*GRAPH_FRAME.height,rotation:item.rotation
  }));
}
// El archivo recibe el contorno ya girado, sin depender de cómo Excel interprete
// la rotación OfficeArt. Cada figura sigue siendo una imagen nativa independiente.
export function exportGraphic(item) {
  const angle=(item.rotation||0)*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const width=item.width*c+item.height*s,height=item.height*c+item.width*s;
  return {...item,x:item.x+(item.width-width)/2,y:item.y+(item.height-height)/2,width,height,imageKey:graphicAssetKey(item)};
}
// La figura original tiene alta resolución y transparencia. El lienzo solo gira
// esos píxeles; se reutilizan los mismos bytes en PDF y Excel.
async function rotateGraphicPng(bytes,rotation,item) {
  const blob=new Blob([bytes],{type:'image/png'}),image=await createImageBitmap(blob);
  try {
    const angle=rotation*Math.PI/180,bounds=exportGraphic(item);
    const density=Math.min(16,2048/Math.max(bounds.width,bounds.height),Math.max(image.width/item.width,image.height/item.height));
    const width=Math.max(1,Math.ceil(bounds.width*density-1e-8)),height=Math.max(1,Math.ceil(bounds.height*density-1e-8));
    const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(width,height):Object.assign(document.createElement('canvas'),{width,height});
    const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar el símbolo girado.');
    context.translate(width/2,height/2);context.scale(width/bounds.width,height/bounds.height);context.rotate(angle);
    context.drawImage(image,-item.width/2,-item.height/2,item.width,item.height);
    const result=canvas.convertToBlob?await canvas.convertToBlob({type:'image/png'}):await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('No se pudo guardar el símbolo girado.')),'image/png'));
    return new Uint8Array(await result.arrayBuffer());
  } finally {image.close();}
}
export async function loadGraphicAssets(placements,read=async url=>{
  const response=await fetch(url);if(!response.ok)throw new Error('No se pudo cargar la simbología original.');
  return new Uint8Array(await response.arrayBuffer());
},rotate=rotateGraphicPng) {
  const ids=[...new Set(placements.map(item=>item.symbolId))];
  const originals=Object.fromEntries(await Promise.all(ids.map(async id=>{
    if(!symbolById(id))throw new Error('No se puede exportar un símbolo desconocido.');
    return [id,await read(symbolUrl(id))];
  })));
  const assets={...originals},turned=new Map(placements.filter(item=>item.rotation).map(item=>[graphicAssetKey(item),item]));
  for(const [key,item]of turned)assets[key]=await rotate(originals[item.symbolId],item.rotation,item);
  return assets;
}
